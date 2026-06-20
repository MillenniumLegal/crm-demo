import { supabase } from '@/lib/supabase';

export interface FeeRule {
  id: string;
  createdAt: string;
  updatedAt: string;
  ruleKey: string;
  itemType: 'supplement' | 'disbursement';
  itemName: string;
  amountExVat: number;
  transactionTypes: string[] | null;
  region: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LegalFeeBand {
  id: string;
  createdAt: string;
  updatedAt: string;
  minValue: number;
  maxValue: number | null;
  legalFeeExVat: number;
  transactionType: string | null;
  region: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SdltRate {
  id: string;
  createdAt: string;
  updatedAt: string;
  versionLabel: string;
  region: string;
  isFirstTimeBuyer: boolean;
  bandMin: number;
  bandMax: number | null;
  ratePercent: number;
  isActive: boolean;
  sortOrder: number;
}

export interface LandRegistryFee {
  id: string;
  createdAt: string;
  updatedAt: string;
  versionLabel: string;
  minValue: number;
  maxValue: number | null;
  feeAmount: number;
  electronicSubmission: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface QuoteFeeConfig {
  feeRules: FeeRule[];
  legalFeeBands: LegalFeeBand[];
  sdltRates: SdltRate[];
  landRegistryFees: LandRegistryFee[];
}

function mapFeeRule(row: any): FeeRule {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ruleKey: row.rule_key,
    itemType: row.item_type,
    itemName: row.item_name,
    amountExVat: parseFloat(row.amount_ex_vat ?? 0),
    transactionTypes: row.transaction_types ?? null,
    region: row.region ?? null,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0
  };
}

function mapLegalFeeBand(row: any): LegalFeeBand {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    minValue: parseFloat(row.min_value ?? 0),
    maxValue: row.max_value != null ? parseFloat(row.max_value) : null,
    legalFeeExVat: parseFloat(row.legal_fee_ex_vat ?? 0),
    transactionType: row.transaction_type ?? null,
    region: row.region ?? null,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0
  };
}

function mapSdltRate(row: any): SdltRate {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versionLabel: row.version_label,
    region: row.region ?? 'England',
    isFirstTimeBuyer: row.is_first_time_buyer ?? false,
    bandMin: parseFloat(row.band_min ?? 0),
    bandMax: row.band_max != null ? parseFloat(row.band_max) : null,
    ratePercent: parseFloat(row.rate_percent ?? 0),
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0
  };
}

function mapLandRegistryFee(row: any): LandRegistryFee {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versionLabel: row.version_label,
    minValue: parseFloat(row.min_value ?? 0),
    maxValue: row.max_value != null ? parseFloat(row.max_value) : null,
    feeAmount: parseFloat(row.fee_amount ?? 0),
    electronicSubmission: row.electronic_submission ?? false,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0
  };
}

/** Fetch all active config for quote calculation (used by quote editor) */
export async function fetchQuoteFeeConfig(): Promise<QuoteFeeConfig> {
  const [rulesRes, bandsRes, sdltRes, lrRes] = await Promise.all([
    supabase.from('quote_fee_rules').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('quote_legal_fee_bands').select('*').eq('is_active', true).order('min_value', { ascending: true }),
    supabase.from('quote_sdlt_rates').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('quote_land_registry_fees').select('*').eq('is_active', true).order('min_value', { ascending: true })
  ]);

  if (rulesRes.error) {
    throw new Error(rulesRes.error.message || 'Failed to load fee rules.');
  }
  if (bandsRes.error) {
    throw new Error(bandsRes.error.message || 'Failed to load legal fee bands.');
  }
  if (sdltRes.error) {
    throw new Error(sdltRes.error.message || 'Failed to load SDLT rates.');
  }
  if (lrRes.error) {
    throw new Error(lrRes.error.message || 'Failed to load Land Registry fees.');
  }

  return {
    feeRules: (rulesRes.data ?? []).map(mapFeeRule),
    legalFeeBands: (bandsRes.data ?? []).map(mapLegalFeeBand),
    sdltRates: (sdltRes.data ?? []).map(mapSdltRate),
    landRegistryFees: (lrRes.data ?? []).map(mapLandRegistryFee)
  };
}

/** Fetch all config including inactive (for Settings CRUD) */
export async function fetchFeeRulesAll(): Promise<FeeRule[]> {
  const { data, error } = await supabase
    .from('quote_fee_rules')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('rule_key', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapFeeRule);
}

export async function fetchLegalFeeBandsAll(): Promise<LegalFeeBand[]> {
  const { data, error } = await supabase
    .from('quote_legal_fee_bands')
    .select('*')
    .order('min_value', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapLegalFeeBand);
}

export async function fetchSdltRatesAll(): Promise<SdltRate[]> {
  const { data, error } = await supabase
    .from('quote_sdlt_rates')
    .select('*')
    .order('version_label')
    .order('region')
    .order('band_min', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSdltRate);
}

export async function fetchLandRegistryFeesAll(): Promise<LandRegistryFee[]> {
  const { data, error } = await supabase
    .from('quote_land_registry_fees')
    .select('*')
    .order('version_label')
    .order('min_value', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapLandRegistryFee);
}

// CRUD Fee Rules
export async function createFeeRule(rule: Omit<FeeRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeeRule> {
  const { data, error } = await supabase
    .from('quote_fee_rules')
    .insert({
      rule_key: rule.ruleKey,
      item_type: rule.itemType,
      item_name: rule.itemName,
      amount_ex_vat: rule.amountExVat,
      transaction_types: rule.transactionTypes,
      region: rule.region,
      is_active: rule.isActive,
      sort_order: rule.sortOrder
    })
    .select()
    .single();
  if (error) throw error;
  return mapFeeRule(data);
}

export async function updateFeeRule(id: string, updates: Partial<FeeRule>): Promise<FeeRule> {
  const db: any = {};
  if (updates.ruleKey !== undefined) db.rule_key = updates.ruleKey;
  if (updates.itemType !== undefined) db.item_type = updates.itemType;
  if (updates.itemName !== undefined) db.item_name = updates.itemName;
  if (updates.amountExVat !== undefined) db.amount_ex_vat = updates.amountExVat;
  if (updates.transactionTypes !== undefined) db.transaction_types = updates.transactionTypes;
  if (updates.region !== undefined) db.region = updates.region;
  if (updates.isActive !== undefined) db.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
  const { data, error } = await supabase.from('quote_fee_rules').update(db).eq('id', id).select().single();
  if (error) throw error;
  return mapFeeRule(data);
}

export async function deleteFeeRule(id: string): Promise<void> {
  const { error } = await supabase.from('quote_fee_rules').delete().eq('id', id);
  if (error) throw error;
}

// CRUD Legal Fee Bands
export async function createLegalFeeBand(band: Omit<LegalFeeBand, 'id' | 'createdAt' | 'updatedAt'>): Promise<LegalFeeBand> {
  const { data, error } = await supabase
    .from('quote_legal_fee_bands')
    .insert({
      min_value: band.minValue,
      max_value: band.maxValue,
      legal_fee_ex_vat: band.legalFeeExVat,
      transaction_type: band.transactionType,
      region: band.region,
      is_active: band.isActive,
      sort_order: band.sortOrder
    })
    .select()
    .single();
  if (error) throw error;
  return mapLegalFeeBand(data);
}

export async function updateLegalFeeBand(id: string, updates: Partial<LegalFeeBand>): Promise<LegalFeeBand> {
  const db: any = {};
  if (updates.minValue !== undefined) db.min_value = updates.minValue;
  if (updates.maxValue !== undefined) db.max_value = updates.maxValue;
  if (updates.legalFeeExVat !== undefined) db.legal_fee_ex_vat = updates.legalFeeExVat;
  if (updates.transactionType !== undefined) db.transaction_type = updates.transactionType;
  if (updates.region !== undefined) db.region = updates.region;
  if (updates.isActive !== undefined) db.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
  const { data, error } = await supabase.from('quote_legal_fee_bands').update(db).eq('id', id).select().single();
  if (error) throw error;
  return mapLegalFeeBand(data);
}

export async function deleteLegalFeeBand(id: string): Promise<void> {
  const { error } = await supabase.from('quote_legal_fee_bands').delete().eq('id', id);
  if (error) throw error;
}

// CRUD SDLT Rates
export async function createSdltRate(rate: Omit<SdltRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SdltRate> {
  const { data, error } = await supabase
    .from('quote_sdlt_rates')
    .insert({
      version_label: rate.versionLabel,
      region: rate.region,
      is_first_time_buyer: rate.isFirstTimeBuyer,
      band_min: rate.bandMin,
      band_max: rate.bandMax,
      rate_percent: rate.ratePercent,
      is_active: rate.isActive,
      sort_order: rate.sortOrder
    })
    .select()
    .single();
  if (error) throw error;
  return mapSdltRate(data);
}

export async function updateSdltRate(id: string, updates: Partial<SdltRate>): Promise<SdltRate> {
  const db: any = {};
  if (updates.versionLabel !== undefined) db.version_label = updates.versionLabel;
  if (updates.region !== undefined) db.region = updates.region;
  if (updates.isFirstTimeBuyer !== undefined) db.is_first_time_buyer = updates.isFirstTimeBuyer;
  if (updates.bandMin !== undefined) db.band_min = updates.bandMin;
  if (updates.bandMax !== undefined) db.band_max = updates.bandMax;
  if (updates.ratePercent !== undefined) db.rate_percent = updates.ratePercent;
  if (updates.isActive !== undefined) db.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
  const { data, error } = await supabase.from('quote_sdlt_rates').update(db).eq('id', id).select().single();
  if (error) throw error;
  return mapSdltRate(data);
}

export async function deleteSdltRate(id: string): Promise<void> {
  const { error } = await supabase.from('quote_sdlt_rates').delete().eq('id', id);
  if (error) throw error;
}

// CRUD Land Registry Fees
export async function createLandRegistryFee(fee: Omit<LandRegistryFee, 'id' | 'createdAt' | 'updatedAt'>): Promise<LandRegistryFee> {
  const { data, error } = await supabase
    .from('quote_land_registry_fees')
    .insert({
      version_label: fee.versionLabel,
      min_value: fee.minValue,
      max_value: fee.maxValue,
      fee_amount: fee.feeAmount,
      electronic_submission: fee.electronicSubmission,
      is_active: fee.isActive,
      sort_order: fee.sortOrder
    })
    .select()
    .single();
  if (error) throw error;
  return mapLandRegistryFee(data);
}

export async function updateLandRegistryFee(id: string, updates: Partial<LandRegistryFee>): Promise<LandRegistryFee> {
  const db: any = {};
  if (updates.versionLabel !== undefined) db.version_label = updates.versionLabel;
  if (updates.minValue !== undefined) db.min_value = updates.minValue;
  if (updates.maxValue !== undefined) db.max_value = updates.maxValue;
  if (updates.feeAmount !== undefined) db.fee_amount = updates.feeAmount;
  if (updates.electronicSubmission !== undefined) db.electronic_submission = updates.electronicSubmission;
  if (updates.isActive !== undefined) db.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
  const { data, error } = await supabase.from('quote_land_registry_fees').update(db).eq('id', id).select().single();
  if (error) throw error;
  return mapLandRegistryFee(data);
}

export async function deleteLandRegistryFee(id: string): Promise<void> {
  const { error } = await supabase.from('quote_land_registry_fees').delete().eq('id', id);
  if (error) throw error;
}
