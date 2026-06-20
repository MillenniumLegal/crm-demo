/**
 * Fee calculation engine (Hoowla-style).
 * Applies configurable fee rules, value bands, SDLT, and Land Registry to a quote.
 */

import type { QuoteFeeConfig, FeeRule, LegalFeeBand, SdltRate, LandRegistryFee } from '@/services/feeConfigService';

export interface QuoteForFeeCalc {
  propertyValue?: number;
  propertyType?: 'Freehold' | 'Leasehold' | 'Unknown';
  propertyRegion?: string;
  quoteType?: string;
  legalFeeExVat?: number;
  supplements?: Array<{ name: string; fee: string | number }>;
  disbursements?: Array<{ name: string; fee: string | number }>;
  isMortgaged?: boolean;
  isUnregistered?: boolean;
  isFirstTimeBuyer?: boolean;
  isNewBuild?: boolean;
  isSharedOwnership?: boolean;
  isBuyToLet?: boolean;
  isHelpToBuyEquityLoan?: boolean;
  isHelpToBuyIsa?: boolean;
  isRightToBuy?: boolean;
  isIslamicMortgage?: boolean;
  isAuctionRepossession?: boolean;
  isGiftedDeposit?: boolean;
  isNonUkResident?: boolean;
  isClientCompany?: boolean;
  isCompanyClaimingRelief?: boolean;
  sdltVersion?: string;
  landRegistryVersion?: string;
  electronicSubmission?: boolean;
}

export interface FeeEngineResult {
  legalFeeExVat: number | undefined;
  supplements: Array<{ name: string; fee: number }>;
  disbursements: Array<{ name: string; fee: number }>;
}

const RULE_KEY_TO_CONDITION: Record<string, (q: QuoteForFeeCalc) => boolean> = {
  leasehold: (q) => q.propertyType === 'Leasehold',
  mortgaged: (q) => !!q.isMortgaged,
  first_time_buyer: (q) => !!q.isFirstTimeBuyer,
  new_build: (q) => !!q.isNewBuild,
  shared_ownership: (q) => !!q.isSharedOwnership,
  buy_to_let: (q) => !!q.isBuyToLet,
  unregistered: (q) => !!q.isUnregistered,
  help_to_buy_equity_loan: (q) => !!q.isHelpToBuyEquityLoan,
  help_to_buy_isa: (q) => !!q.isHelpToBuyIsa,
  right_to_buy: (q) => !!q.isRightToBuy,
  islamic_mortgage: (q) => !!q.isIslamicMortgage,
  auction_repossession: (q) => !!q.isAuctionRepossession,
  gifted_deposit: (q) => !!q.isGiftedDeposit,
  non_uk_resident: (q) => !!q.isNonUkResident,
  client_company: (q) => !!q.isClientCompany,
  company_claiming_relief: (q) => !!q.isCompanyClaimingRelief,
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

/** Get legal fee Ex VAT from value bands */
function getLegalFeeFromBands(
  value: number | undefined,
  region: string | undefined,
  transactionType: string | undefined,
  bands: LegalFeeBand[]
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const bandsFiltered = bands.filter(
    (b) =>
      (!b.region || b.region === region || !region) &&
      (!b.transactionType || b.transactionType === transactionType || !transactionType)
  );
  const band = bandsFiltered.find(
    (b) => value >= b.minValue && (b.maxValue == null || value < b.maxValue)
  );
  return band ? band.legalFeeExVat : undefined;
}

/** Check if a rule applies to this quote (condition + optional region/transaction type) */
function ruleApplies(rule: FeeRule, quote: QuoteForFeeCalc): boolean {
  const cond = RULE_KEY_TO_CONDITION[rule.ruleKey];
  if (!cond || !cond(quote)) return false;
  if (rule.region && quote.propertyRegion && rule.region !== quote.propertyRegion) return false;
  if (rule.transactionTypes?.length && quote.quoteType && !rule.transactionTypes.includes(quote.quoteType)) return false;
  return true;
}

/** Conflict: e.g. Freehold must not get leasehold fee */
function ruleConflicted(rule: FeeRule, quote: QuoteForFeeCalc): boolean {
  if (rule.ruleKey === 'leasehold' && quote.propertyType === 'Freehold') return true;
  return false;
}

/** Compute SDLT from bands (simplified: sum of (band width * rate) for each band) */
function computeSdlt(
  value: number,
  region: string,
  versionLabel: string | undefined,
  isFirstTimeBuyer: boolean,
  rates: SdltRate[]
): number {
  if (!versionLabel) return 0;
  const filtered = rates.filter(
    (r) =>
      r.versionLabel === versionLabel &&
      r.region === region &&
      r.isFirstTimeBuyer === isFirstTimeBuyer
  );
  if (filtered.length === 0) return 0;
  let tax = 0;
  let remaining = value;
  const sorted = [...filtered].sort((a, b) => a.bandMin - b.bandMin);
  for (const band of sorted) {
    const bandMax = band.bandMax ?? Infinity;
    const bandWidth = Math.min(remaining, Math.max(0, bandMax - band.bandMin));
    if (bandWidth <= 0) continue;
    const bandTax = (bandWidth * band.ratePercent) / 100;
    tax += bandTax;
    remaining -= bandWidth;
    if (remaining <= 0) break;
  }
  return roundCurrency(tax);
}

/** Get Land Registry fee from bands */
function getLandRegistryFee(
  value: number,
  versionLabel: string | undefined,
  electronicSubmission: boolean,
  fees: LandRegistryFee[]
): number {
  if (!versionLabel) return 0;
  const band = fees.find(
    (f) =>
      f.versionLabel === versionLabel &&
      f.electronicSubmission === electronicSubmission &&
      value >= f.minValue &&
      (f.maxValue == null || value < f.maxValue)
  );
  return band ? band.feeAmount : 0;
}

/** Apply fee config to quote and return updated legal fee, supplements, disbursements */
export function applyFeeConfig(quote: QuoteForFeeCalc, config: QuoteFeeConfig): FeeEngineResult {
  const value = quote.propertyValue ?? 0;
  const region = quote.propertyRegion || 'England';
  const transactionType = quote.quoteType;

  // 1. Legal fee from value bands (if we have bands and value)
  let legalFeeExVat: number | undefined = quote.legalFeeExVat !== undefined ? quote.legalFeeExVat : undefined;
  const bandFee = getLegalFeeFromBands(value, region, transactionType, config.legalFeeBands);
  if (bandFee !== undefined) {
    legalFeeExVat = bandFee;
  }

  // 2. Rule-driven supplements and disbursements: remove any that match a rule item name or engine-managed names, then add back those that apply
  const ruleItemNames = new Set(config.feeRules.map((r) => r.itemName));
  const engineDisbursementNames = new Set([...ruleItemNames, 'Stamp Duty (SDLT)', 'Land Registry Fees']);
  const existingSupplements = (quote.supplements ?? []).filter((s) => !ruleItemNames.has(s.name || ''));
  const existingDisbursements = (quote.disbursements ?? []).filter((d) => !engineDisbursementNames.has(d.name || ''));

  const supplementsFromRules: Array<{ name: string; fee: number }> = [];
  const disbursementsFromRules: Array<{ name: string; fee: number }> = [];

  for (const rule of config.feeRules) {
    if (ruleConflicted(rule, quote)) continue;
    if (!ruleApplies(rule, quote)) continue;
    const amount = roundCurrency(rule.amountExVat);
    if (rule.itemType === 'supplement') {
      supplementsFromRules.push({ name: rule.itemName, fee: amount });
    } else {
      disbursementsFromRules.push({ name: rule.itemName, fee: amount });
    }
  }

  const supplements: Array<{ name: string; fee: number }> = [
    ...existingSupplements.map((s) => ({ name: s.name || '', fee: toNum(s.fee) })),
    ...supplementsFromRules
  ];

  const disbursementsFromRulesMap = new Map(disbursementsFromRules.map((d) => [d.name, d.fee]));

  // 3. SDLT
  const sdltAmount = computeSdlt(
    value,
    region,
    quote.sdltVersion,
    !!quote.isFirstTimeBuyer,
    config.sdltRates
  );
  const sdltName = 'Stamp Duty (SDLT)';
  if (sdltAmount > 0) {
    disbursementsFromRulesMap.set(sdltName, sdltAmount);
  } else {
    disbursementsFromRulesMap.delete(sdltName);
  }

  // 4. Land Registry
  const lrAmount = getLandRegistryFee(
    value,
    quote.landRegistryVersion,
    !!quote.electronicSubmission,
    config.landRegistryFees
  );
  const lrName = 'Land Registry Fees';
  if (lrAmount > 0) {
    disbursementsFromRulesMap.set(lrName, lrAmount);
  } else {
    disbursementsFromRulesMap.delete(lrName);
  }

  const disbursementsFromRulesFinal = Array.from(disbursementsFromRulesMap.entries()).map(([name, fee]) => ({ name, fee }));
  const disbursements: Array<{ name: string; fee: number }> = [
    ...existingDisbursements.map((d) => ({ name: d.name || '', fee: toNum(d.fee) })),
    ...disbursementsFromRulesFinal
  ];

  return {
    legalFeeExVat,
    supplements,
    disbursements
  };
}
