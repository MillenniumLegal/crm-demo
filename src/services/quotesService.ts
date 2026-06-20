import { supabase } from '@/lib/supabase';

// Extended Quote interface matching the database schema
export interface Quote {
  id: string;
  shortCode?: string;
  leadId: string;
  leadName?: string;
  leadShortCode?: string;
  leadEmail?: string;
  leadPhone?: string;
  version: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  totalAmount: number;
  vatAmount: number;
  netAmount: number;
  totalExVat?: number;
  totalIncVat?: number;
  legalFeeExVat?: number;
  legalFeeIncVat?: number;
  validUntil?: string;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  items?: any[];
  notes?: string;
  terms?: string;
  // Hoowla quote fields
  hoowlaQuoteId?: string;
  externalId?: string;
  quoteType?: string;
  propertyAddress?: string;
  propertyValue?: number;
  propertyTenure?: string;
  propertyTitleNumber?: string;
  propertyCity?: string;
  propertyCounty?: string;
  propertyPostcode?: string;
  propertyRegion?: string;
  peopleCount?: number;
  expiryDate?: string;
  // Supplements and disbursements from Hoowla
  supplements?: Array<{ name: string; fee: string | number }>;
  disbursements?: Array<{ name: string; fee: string | number }>;
  // Property flags (Hoowla-style checkboxes)
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
  customSituations?: string[];
  // Hoowla Settings (quote editor)
  sdltVersion?: string;
  landRegistryVersion?: string;
  electronicSubmission?: boolean;
  referralFee?: number;
  panelMemberId?: string;
  employeeId?: string;
  emailSenderId?: string;
  propertyType?: 'Freehold' | 'Leasehold' | 'Unknown';
  isCompanyClaimingRelief?: boolean;
  // Quote acceptance workflow
  acceptance_token?: string;
  acceptance_url_slug?: string;
  lead?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    shortCode?: string;
  };
  // Additional fields for PDF generation
  legalFee?: number;
  legalFeeVAT?: number;
  supplementsVAT?: number;
  transactionType?: string;
  tenure?: string;
}

export interface FetchQuotesPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  transactionType?: string;
  solicitorFirmId?: string;
  leadId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'total_inc_vat' | 'status' | 'quote_type';
  sortDirection?: 'asc' | 'desc';
}

export interface FetchQuotesPageResult {
  quotes: Quote[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Transform database quote to frontend Quote interface
function transformQuote(dbQuote: any): Quote {
  // Parse supplements and disbursements from JSONB
  let supplements: Array<{ name: string; fee: string | number }> = [];
  let disbursements: Array<{ name: string; fee: string | number }> = [];
  
  if (dbQuote.supplements) {
    if (typeof dbQuote.supplements === 'string') {
      try {
        supplements = JSON.parse(dbQuote.supplements);
      } catch (e) {
        console.warn('Error parsing supplements:', e);
      }
    } else if (Array.isArray(dbQuote.supplements)) {
      supplements = dbQuote.supplements;
    }
  }
  
  if (dbQuote.disbursements) {
    if (typeof dbQuote.disbursements === 'string') {
      try {
        disbursements = JSON.parse(dbQuote.disbursements);
      } catch (e) {
        console.warn('Error parsing disbursements:', e);
      }
    } else if (Array.isArray(dbQuote.disbursements)) {
      disbursements = dbQuote.disbursements;
    }
  }

  // Handle lead data - it comes as an object from the join
  let leadName = '';
  let leadEmail = '';
  let leadPhone = '';
  let leadShortCode = dbQuote.lead_short_code || '';
  
  if (dbQuote.leads) {
    const lead = Array.isArray(dbQuote.leads) ? dbQuote.leads[0] : dbQuote.leads;
    leadName = lead?.name || '';
    leadEmail = lead?.email || '';
    leadPhone = lead?.phone || '';
    leadShortCode = lead?.short_code || leadShortCode;
  }

  return {
    id: dbQuote.id,
    shortCode: dbQuote.short_code || undefined,
    leadId: dbQuote.lead_id,
    leadName: leadName,
    leadShortCode: leadShortCode || undefined,
    leadEmail: leadEmail,
    leadPhone: leadPhone,
    version: dbQuote.version || 1,
    status: dbQuote.status || 'Draft',
    totalAmount: parseFloat(dbQuote.total_inc_vat || dbQuote.total_amount || '0'),
    vatAmount: parseFloat(dbQuote.total_inc_vat || '0') - parseFloat(dbQuote.total_ex_vat || '0'),
    netAmount: parseFloat(dbQuote.total_ex_vat || dbQuote.total_amount || '0'),
    totalExVat: dbQuote.total_ex_vat ? parseFloat(dbQuote.total_ex_vat.toString()) : undefined,
    totalIncVat: dbQuote.total_inc_vat ? parseFloat(dbQuote.total_inc_vat.toString()) : undefined,
    legalFeeExVat: dbQuote.legal_fee_ex_vat ? parseFloat(dbQuote.legal_fee_ex_vat.toString()) : undefined,
    legalFeeIncVat: dbQuote.legal_fee_inc_vat ? parseFloat(dbQuote.legal_fee_inc_vat.toString()) : undefined,
    validUntil: dbQuote.expiry_date || dbQuote.valid_until || '',
    expiryDate: dbQuote.expiry_date || '',
    createdAt: dbQuote.created_at,
    updatedAt: dbQuote.updated_at || dbQuote.last_edited_at,
    sentAt: dbQuote.sent_at,
    acceptedAt: dbQuote.accepted_at,
    rejectedAt: dbQuote.rejected_at,
    items: dbQuote.items || [],
    notes: dbQuote.notes,
    terms: dbQuote.terms,
    // Hoowla fields
    hoowlaQuoteId: dbQuote.hoowla_quote_id,
    externalId: dbQuote.external_id,
    quoteType: dbQuote.quote_type,
    propertyAddress: dbQuote.property_address,
    propertyValue: dbQuote.property_value ? parseFloat(dbQuote.property_value.toString()) : undefined,
    propertyTenure: dbQuote.property_tenure,
    propertyTitleNumber: dbQuote.property_title_number,
    propertyCity: dbQuote.property_city,
    propertyCounty: dbQuote.property_county,
    propertyPostcode: dbQuote.property_postcode,
    propertyRegion: dbQuote.property_region,
    peopleCount: dbQuote.people_count || 1,
    // Supplements and disbursements
    supplements: supplements,
    disbursements: disbursements,
    // Quote acceptance workflow
    acceptance_token: dbQuote.acceptance_token,
    acceptance_url_slug: dbQuote.acceptance_url_slug,
    // Lead object for PDF generation
    lead: {
      id: dbQuote.lead_id,
      name: leadName,
      email: leadEmail,
      phone: leadPhone,
      shortCode: leadShortCode
    },
    // Additional fields for PDF generation
    legalFee: dbQuote.legal_fee_ex_vat ? parseFloat(dbQuote.legal_fee_ex_vat.toString()) : undefined,
    legalFeeVAT: dbQuote.legal_fee_inc_vat && dbQuote.legal_fee_ex_vat
      ? parseFloat(dbQuote.legal_fee_inc_vat.toString()) - parseFloat(dbQuote.legal_fee_ex_vat.toString())
      : undefined,
    supplementsVAT: supplements.length > 0
      ? supplements.reduce((sum, s) => sum + (parseFloat(String(s.fee || 0)) * 0.2), 0)
      : undefined,
    transactionType: dbQuote.quote_type,
    tenure: dbQuote.property_tenure,
    // Property flags
    isMortgaged: dbQuote.is_mortgaged || false,
    isUnregistered: dbQuote.is_unregistered || false,
    isFirstTimeBuyer: dbQuote.is_first_time_buyer || false,
    isNewBuild: dbQuote.is_new_build || false,
    isSharedOwnership: dbQuote.is_shared_ownership || false,
    isBuyToLet: dbQuote.is_buy_to_let || false,
    isHelpToBuyEquityLoan: dbQuote.is_help_to_buy_equity_loan || false,
    isHelpToBuyIsa: dbQuote.is_help_to_buy_isa || false,
    isRightToBuy: dbQuote.is_right_to_buy || false,
    isIslamicMortgage: dbQuote.is_islamic_mortgage || false,
    isAuctionRepossession: dbQuote.is_auction_repossession || false,
    isGiftedDeposit: dbQuote.is_gifted_deposit || false,
    isNonUkResident: dbQuote.is_non_uk_resident || false,
    isClientCompany: dbQuote.is_client_company || false,
    customSituations: dbQuote.custom_situations ? (typeof dbQuote.custom_situations === 'string' ? JSON.parse(dbQuote.custom_situations) : dbQuote.custom_situations) : [],
    // Hoowla Settings
    sdltVersion: dbQuote.sdlt_version ?? undefined,
    landRegistryVersion: dbQuote.land_registry_version ?? undefined,
    electronicSubmission: dbQuote.electronic_submission ?? false,
    referralFee: dbQuote.referral_fee != null ? parseFloat(dbQuote.referral_fee.toString()) : undefined,
    panelMemberId: dbQuote.panel_member_id ?? undefined,
    employeeId: dbQuote.employee_id ?? undefined,
    emailSenderId: dbQuote.email_sender_id ?? undefined,
    propertyType: dbQuote.property_type && ['Freehold', 'Leasehold', 'Unknown'].includes(dbQuote.property_type) ? dbQuote.property_type : undefined,
    isCompanyClaimingRelief: dbQuote.is_company_claiming_relief ?? false
  };
}

/**
 * Legacy full-fetch helper. Do not use for page loads.
 * Use fetchQuotesPage(), fetchQuotesForLeadIds(), or fetchQuotes({ leadId }) for scoped usage.
 */
export async function fetchQuotes(filters?: {
  leadId?: string;
  status?: string;
  searchTerm?: string;
}): Promise<Quote[]> {
  try {
    if (import.meta.env.DEV && !filters?.leadId) {
      console.warn(
        'fetchQuotes() without leadId is a legacy full-fetch path. Use fetchQuotesPage() or fetchQuotesForLeadIds() for new page/report code.'
      );
    }

    let query = supabase
      .from('quotes')
      .select(`
        *,
        leads!quotes_lead_id_fkey(name, email, phone, short_code)
      `);

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId);
    }

    if (filters?.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }

    if (filters?.searchTerm) {
      query = query.or(`lead_name.ilike.%${filters.searchTerm}%,lead_email.ilike.%${filters.searchTerm}%`);
    }

    // Remove Supabase's default 1000 row limit to fetch all quotes
    const { data, error } = await query.order('created_at', { ascending: false }).limit(999999);

    if (error) {
      console.error('Error fetching quotes:', error);
      throw error;
    }

    return (data || []).map(transformQuote);
  } catch (error) {
    console.error('Error in fetchQuotes:', error);
    throw error;
  }
}

export async function fetchQuotesForLeadIds(leadIds: string[]): Promise<Quote[]> {
  try {
    const uniqueLeadIds = Array.from(new Set(leadIds.filter(Boolean)));
    if (uniqueLeadIds.length === 0) {
      return [];
    }

    const BATCH_SIZE = 100;
    const quoteRows: any[] = [];

    for (let i = 0; i < uniqueLeadIds.length; i += BATCH_SIZE) {
      const batch = uniqueLeadIds.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          leads!quotes_lead_id_fkey(name, email, phone, short_code)
        `)
        .in('lead_id', batch)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes for lead IDs:', error);
        throw error;
      }

      quoteRows.push(...(data || []));
    }

    return quoteRows.map(transformQuote);
  } catch (error) {
    console.error('Error in fetchQuotesForLeadIds:', error);
    throw error;
  }
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

const sanitizePostgrestSearch = (value: string) =>
  value
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueSearchValues = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

const buildPhoneSearchTerms = (search: string) => {
  const digits = search.replace(/\D/g, '');
  if (digits.length < 4) return [];

  const variants = [digits];
  if (digits.startsWith('0') && digits.length > 6) variants.push(`44${digits.slice(1)}`);
  if (digits.startsWith('44') && digits.length > 6) variants.push(`0${digits.slice(2)}`);
  if (digits.length >= 7) variants.push(digits.slice(-7));
  return uniqueSearchValues(variants);
};

const buildNameSearchTerms = (search: string) => {
  const tokens = search.split(' ').filter(Boolean);
  const terms = [search, search.toLowerCase(), search.replace(/\s+/g, '')];

  if (tokens.length > 1) {
    terms.push(tokens.join('%'), [...tokens].reverse().join('%'));
  }

  return uniqueSearchValues(terms);
};

async function findLeadIdsForQuoteSearch(search: string): Promise<string[]> {
  const term = sanitizePostgrestSearch(search);
  if (!term) return [];

  const textTerms = buildNameSearchTerms(term);
  const searchConditions = [
    ...textTerms.flatMap(value => [
      `name.ilike.%${value}%`,
      `email.ilike.%${value}%`,
      `short_code.ilike.%${value}%`,
    ]),
    ...buildPhoneSearchTerms(term).map(value => `phone.ilike.%${value}%`),
  ];

  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .or(uniqueSearchValues(searchConditions).join(','))
    .limit(100);

  if (error) {
    console.warn('Unable to search leads for quote lookup:', error);
    return [];
  }

  return (data || []).map((lead: any) => lead.id).filter(Boolean);
}

export async function fetchQuotesPage(params: FetchQuotesPageParams = {}): Promise<FetchQuotesPageResult> {
  try {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 20), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = params.sortBy || 'created_at';
    const sortDirection = params.sortDirection || 'desc';
    const search = sanitizePostgrestSearch(params.search || '');
    const searchLeadIds = search ? await findLeadIdsForQuoteSearch(search) : [];

    let query = supabase
      .from('quotes')
      .select(`
        *,
        leads!quotes_lead_id_fkey(name, email, phone, short_code)
      `, { count: 'exact' });

    if (params.leadId) {
      query = query.eq('lead_id', params.leadId);
    }

    if (params.status && params.status !== 'All') {
      query = query.eq('status', params.status);
    }

    if (params.transactionType && params.transactionType !== 'All') {
      query = query.eq('quote_type', params.transactionType);
    }

    if (params.solicitorFirmId && params.solicitorFirmId !== 'All') {
      query = query.eq('panel_member_id', params.solicitorFirmId);
    }

    if (params.dateFrom) {
      query = query.gte('created_at', params.dateFrom);
    }

    if (params.dateTo) {
      query = query.lte('created_at', params.dateTo);
    }

    if (search) {
      const textTerms = buildNameSearchTerms(search);
      const searchConditions = [
        ...textTerms.flatMap(term => [
          `short_code.ilike.%${term}%`,
          `lead_name.ilike.%${term}%`,
          `lead_email.ilike.%${term}%`,
          `quote_type.ilike.%${term}%`,
          `status.ilike.%${term}%`,
          `hoowla_quote_id.ilike.%${term}%`,
          `external_id.ilike.%${term}%`,
        ]),
      ];

      if (isUuid(search)) {
        searchConditions.push(`id.eq.${search}`);
      }

      if (searchLeadIds.length > 0) {
        searchConditions.push(`lead_id.in.(${searchLeadIds.join(',')})`);
      }

      query = query.or(uniqueSearchValues(searchConditions).join(','));
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortDirection === 'asc', nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching paginated quotes:', error);
      throw error;
    }

    const totalCount = count ?? 0;
    return {
      quotes: (data || []).map(transformQuote),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  } catch (error) {
    console.error('Error in fetchQuotesPage:', error);
    throw error;
  }
}

// Fetch a single quote by ID
export async function fetchQuoteById(id: string): Promise<Quote | null> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        leads!quotes_lead_id_fkey(name, email, phone, short_code)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching quote:', error);
      return null;
    }

    return transformQuote(data);
  } catch (error) {
    console.error('Error in fetchQuoteById:', error);
    return null;
  }
}

export async function fetchQuoteByShortCode(shortCode: string): Promise<Quote | null> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        leads!quotes_lead_id_fkey(name, email, phone, short_code)
      `)
      .eq('short_code', shortCode)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching quote by short code:', error);
      return null;
    }

    return transformQuote(data);
  } catch (error) {
    console.error('Error in fetchQuoteByShortCode:', error);
    return null;
  }
}

// Create a new quote
const normalizeNumeric = (value: any, defaultValue?: number | null) => {
  if (value === undefined) return defaultValue;
  if (value === null) return null;
  const num =
    typeof value === 'number'
      ? value
      : Number.parseFloat(typeof value === 'string' ? value : `${value}`);
  if (Number.isNaN(num)) {
    return defaultValue ?? null;
  }
  return num;
};

export async function createQuote(quoteData: Partial<Quote>): Promise<Quote | null> {
  try {
    const dbData: any = {
      lead_id: quoteData.leadId,
      status: quoteData.status || 'Draft',
      version: quoteData.version || 1,
      total_inc_vat: normalizeNumeric(quoteData.totalIncVat ?? quoteData.totalAmount, 0),
      total_ex_vat: normalizeNumeric(quoteData.totalExVat ?? quoteData.netAmount, 0),
      legal_fee_ex_vat: normalizeNumeric(quoteData.legalFeeExVat),
      legal_fee_inc_vat: normalizeNumeric(quoteData.legalFeeIncVat),
      expiry_date: quoteData.validUntil ? quoteData.validUntil : null,
      items: quoteData.items || [],
      supplements: quoteData.supplements || [],
      disbursements: quoteData.disbursements || [],
      notes: quoteData.notes,
      terms: quoteData.terms,
      property_address: quoteData.propertyAddress ?? null,
      property_city: quoteData.propertyCity ?? null,
      property_county: quoteData.propertyCounty ?? null,
      property_postcode: quoteData.propertyPostcode ?? null,
      property_tenure: quoteData.propertyTenure ?? null,
      property_region: quoteData.propertyRegion ?? null,
      property_value: normalizeNumeric(quoteData.propertyValue),
      people_count: (() => {
        if (quoteData.peopleCount === undefined || quoteData.peopleCount === null) return null;
        const count = normalizeNumeric(quoteData.peopleCount);
        if (count === null || count === undefined) return null;
        return Math.round(count);
      })(),
      quote_type: quoteData.quoteType || quoteData.transactionType || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sdlt_version: quoteData.sdltVersion ?? null,
      land_registry_version: quoteData.landRegistryVersion ?? null,
      electronic_submission: quoteData.electronicSubmission ?? false,
      referral_fee: normalizeNumeric(quoteData.referralFee, 0) ?? 0,
      panel_member_id: quoteData.panelMemberId ?? null,
      employee_id: quoteData.employeeId ?? null,
      email_sender_id: quoteData.emailSenderId ?? null,
      property_type: quoteData.propertyType ?? null,
      is_company_claiming_relief: quoteData.isCompanyClaimingRelief ?? false,
      is_mortgaged: quoteData.isMortgaged ?? false,
      is_help_to_buy_equity_loan: quoteData.isHelpToBuyEquityLoan ?? false,
      is_help_to_buy_isa: quoteData.isHelpToBuyIsa ?? false,
      is_right_to_buy: quoteData.isRightToBuy ?? false,
      is_islamic_mortgage: quoteData.isIslamicMortgage ?? false,
      is_auction_repossession: quoteData.isAuctionRepossession ?? false,
      is_gifted_deposit: quoteData.isGiftedDeposit ?? false,
      is_non_uk_resident: quoteData.isNonUkResident ?? false,
      is_client_company: quoteData.isClientCompany ?? false,
      is_first_time_buyer: quoteData.isFirstTimeBuyer ?? false,
      is_unregistered: quoteData.isUnregistered ?? false,
      is_new_build: quoteData.isNewBuild ?? false,
      is_shared_ownership: quoteData.isSharedOwnership ?? false,
      is_buy_to_let: quoteData.isBuyToLet ?? false
    };

    const { data, error } = await supabase
      .from('quotes')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating quote:', error);
      throw error;
    }

    return transformQuote(data);
  } catch (error) {
    console.error('Error in createQuote:', error);
    throw error;
  }
}

// Update a quote with versioning and change tracking
export async function updateQuote(id: string, updates: Partial<Quote>, userId?: string, userName?: string): Promise<Quote | null> {
  try {
    // First, fetch the current quote to track changes and increment version
    const { data: currentQuote, error: fetchError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentQuote) {
      console.error('Error fetching current quote:', fetchError);
      throw fetchError || new Error('Quote not found');
    }

    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };

    // Track if significant changes were made (amount, supplements, disbursements)
    const significantChanges: string[] = [];
    const oldAmount = parseFloat(currentQuote.total_inc_vat || currentQuote.total_amount || '0');
    
    // Handle status updates: if status is explicitly provided, use it
    // Otherwise, if quote was "Sent" and is being edited, set to "Draft"
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
    } else if (currentQuote.status === 'Sent') {
      // If quote was sent and is being edited (without explicit status), set to Draft
      // This ensures edited quotes go back to Draft unless explicitly sent
      const hasSignificantChanges = 
        (updates.totalIncVat !== undefined && Math.abs(parseFloat(updates.totalIncVat.toString()) - oldAmount) > 0.01) ||
        updates.supplements !== undefined ||
        updates.disbursements !== undefined ||
        updates.items !== undefined;
      
      if (hasSignificantChanges) {
        dbUpdates.status = 'Draft';
      }
    }
    if (updates.totalIncVat !== undefined) {
      const newAmount = normalizeNumeric(updates.totalIncVat);
      dbUpdates.total_inc_vat = newAmount;
      if (newAmount !== null && newAmount !== undefined && Math.abs(newAmount - oldAmount) > 0.01) {
        significantChanges.push(`Total amount: £${oldAmount.toFixed(2)} → £${newAmount.toFixed(2)}`);
      }
    }
    if (updates.totalAmount !== undefined) {
      const newAmount = normalizeNumeric(updates.totalAmount);
      dbUpdates.total_inc_vat = newAmount;
      if (newAmount !== null && newAmount !== undefined && Math.abs(newAmount - oldAmount) > 0.01) {
        significantChanges.push(`Total amount: £${oldAmount.toFixed(2)} → £${newAmount.toFixed(2)}`);
      }
    }
    if (updates.totalExVat !== undefined) dbUpdates.total_ex_vat = normalizeNumeric(updates.totalExVat);
    if (updates.netAmount !== undefined) dbUpdates.total_ex_vat = normalizeNumeric(updates.netAmount);
    if (updates.legalFeeExVat !== undefined) dbUpdates.legal_fee_ex_vat = normalizeNumeric(updates.legalFeeExVat);
    if (updates.legalFeeIncVat !== undefined) dbUpdates.legal_fee_inc_vat = normalizeNumeric(updates.legalFeeIncVat);
    if (updates.validUntil !== undefined) {
      dbUpdates.expiry_date = updates.validUntil ? updates.validUntil : null;
    }
    if (updates.items !== undefined) {
      dbUpdates.items = updates.items;
      significantChanges.push('Items updated');
    }
    if (updates.supplements !== undefined) {
      dbUpdates.supplements = updates.supplements;
      significantChanges.push('Supplements updated');
    }
    if (updates.disbursements !== undefined) {
      dbUpdates.disbursements = updates.disbursements;
      significantChanges.push('Disbursements updated');
    }
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.terms !== undefined) dbUpdates.terms = updates.terms;
    if (updates.propertyAddress !== undefined) dbUpdates.property_address = updates.propertyAddress ?? null;
    if (updates.propertyCity !== undefined) dbUpdates.property_city = updates.propertyCity ?? null;
    if (updates.propertyCounty !== undefined) dbUpdates.property_county = updates.propertyCounty ?? null;
    if (updates.propertyPostcode !== undefined) dbUpdates.property_postcode = updates.propertyPostcode ?? null;
    if (updates.propertyTenure !== undefined) dbUpdates.property_tenure = updates.propertyTenure ?? null;
    if (updates.propertyRegion !== undefined) dbUpdates.property_region = updates.propertyRegion ?? null;
    if (updates.propertyValue !== undefined) dbUpdates.property_value = normalizeNumeric(updates.propertyValue);
    if (updates.peopleCount !== undefined) {
      const count = normalizeNumeric(updates.peopleCount);
      dbUpdates.people_count = count === null || count === undefined ? null : Math.round(count);
      if (count !== null && count !== currentQuote.people_count) {
        significantChanges.push(`People count: ${currentQuote.people_count || 0} → ${count}`);
      }
    }
    if (updates.sentAt !== undefined) dbUpdates.sent_at = updates.sentAt;
    if (updates.acceptedAt !== undefined) dbUpdates.accepted_at = updates.acceptedAt;
    if (updates.rejectedAt !== undefined) dbUpdates.rejected_at = updates.rejectedAt;
    if (updates.sdltVersion !== undefined) dbUpdates.sdlt_version = updates.sdltVersion ?? null;
    if (updates.landRegistryVersion !== undefined) dbUpdates.land_registry_version = updates.landRegistryVersion ?? null;
    if (updates.electronicSubmission !== undefined) dbUpdates.electronic_submission = updates.electronicSubmission;
    if (updates.referralFee !== undefined) dbUpdates.referral_fee = normalizeNumeric(updates.referralFee, 0) ?? 0;
    if (updates.panelMemberId !== undefined) dbUpdates.panel_member_id = updates.panelMemberId ?? null;
    if (updates.employeeId !== undefined) dbUpdates.employee_id = updates.employeeId ?? null;
    if (updates.emailSenderId !== undefined) dbUpdates.email_sender_id = updates.emailSenderId ?? null;
    if (updates.propertyType !== undefined) dbUpdates.property_type = updates.propertyType ?? null;
    if (updates.isCompanyClaimingRelief !== undefined) dbUpdates.is_company_claiming_relief = updates.isCompanyClaimingRelief;
    if (updates.isMortgaged !== undefined) dbUpdates.is_mortgaged = updates.isMortgaged;
    if (updates.isFirstTimeBuyer !== undefined) dbUpdates.is_first_time_buyer = updates.isFirstTimeBuyer;
    if (updates.isUnregistered !== undefined) dbUpdates.is_unregistered = updates.isUnregistered;
    if (updates.isNewBuild !== undefined) dbUpdates.is_new_build = updates.isNewBuild;
    if (updates.isSharedOwnership !== undefined) dbUpdates.is_shared_ownership = updates.isSharedOwnership;
    if (updates.isBuyToLet !== undefined) dbUpdates.is_buy_to_let = updates.isBuyToLet;
    if (updates.isHelpToBuyEquityLoan !== undefined) dbUpdates.is_help_to_buy_equity_loan = updates.isHelpToBuyEquityLoan;
    if (updates.isHelpToBuyIsa !== undefined) dbUpdates.is_help_to_buy_isa = updates.isHelpToBuyIsa;
    if (updates.isRightToBuy !== undefined) dbUpdates.is_right_to_buy = updates.isRightToBuy;
    if (updates.isIslamicMortgage !== undefined) dbUpdates.is_islamic_mortgage = updates.isIslamicMortgage;
    if (updates.isAuctionRepossession !== undefined) dbUpdates.is_auction_repossession = updates.isAuctionRepossession;
    if (updates.isGiftedDeposit !== undefined) dbUpdates.is_gifted_deposit = updates.isGiftedDeposit;
    if (updates.isNonUkResident !== undefined) dbUpdates.is_non_uk_resident = updates.isNonUkResident;
    if (updates.isClientCompany !== undefined) dbUpdates.is_client_company = updates.isClientCompany;

    // Increment version if significant changes were made
    if (significantChanges.length > 0) {
      const currentVersion = currentQuote.version || 1;
      dbUpdates.version = currentVersion + 1;
    }

    const { data, error } = await supabase
      .from('quotes')
      .update(dbUpdates)
      .eq('id', id)
      .select(`
        *,
        leads!quotes_lead_id_fkey(id, name, email, phone, assigned_to)
      `)
      .single();

    if (error) {
      console.error('Error updating quote:', error);
      throw error;
    }

    // Log quote amendment activity if significant changes were made
    if (significantChanges.length > 0 && data.leads) {
      const lead = Array.isArray(data.leads) ? data.leads[0] : data.leads;
      try {
        await supabase
          .from('activity_log')
          .insert({
            activity_type: 'quote_updated',
            entity_type: 'quote',
            entity_id: id,
            lead_id: lead.id,
            lead_name: lead.name || 'Unknown',
            action_description: `Quote amended (v${dbUpdates.version || currentQuote.version || 1}): ${significantChanges.join(', ')}`,
            done_by_type: userId ? 'user' : 'system',
            done_by_id: userId || null,
            done_by_name: userName || 'System',
            metadata: {
              quoteId: id,
              version: dbUpdates.version || currentQuote.version || 1,
              changes: significantChanges,
              oldAmount: oldAmount,
              newAmount: parseFloat(data.total_inc_vat || data.total_amount || '0')
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        // If lead is assigned, this will show up in notifications
        console.log(`✅ Quote amendment logged: v${dbUpdates.version || currentQuote.version || 1} with ${significantChanges.length} change(s)`);
      } catch (logError) {
        console.warn('Could not log quote amendment activity:', logError);
      }
    }

    return transformQuote(data);
  } catch (error) {
    console.error('Error in updateQuote:', error);
    throw error;
  }
}
/**
 * Ensures a quote has an acceptance token and returns the acceptance URL
 * If the quote doesn't have a token, it generates one via the backend API
 */
export async function ensureQuoteAcceptanceToken(quoteId: string): Promise<string> {
  try {
    // Call Supabase Edge Function instead of Vercel API route
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured');
    }
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const functionUrl = `${baseUrl}/functions/v1/quote-acceptance-url/${quoteId}`;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    const response = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      // Try to get error details
      let errorText = '';
      try {
        errorText = await response.text();
        // Check if it's HTML (means route doesn't exist)
        if (errorText.trim().startsWith('<!')) {
          throw new Error(`API route not found. The acceptance URL endpoint may not be deployed yet. Status: ${response.status}`);
        }
        // Try to parse as JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Failed to generate acceptance URL (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('API route not found')) {
          throw parseError;
        }
        throw new Error(`Failed to generate acceptance URL: ${response.status} ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!')) {
        throw new Error('API route returned HTML instead of JSON. The route may not be deployed yet.');
      }
      throw new Error(`Invalid response type: ${contentType}`);
    }

    const result = await response.json();
    
    // Handle both response formats: { success: true, acceptanceUrl: ... } or { acceptanceUrl: ... }
    const acceptanceUrl = result.acceptanceUrl || result.data?.acceptanceUrl;
    
    if (!acceptanceUrl) {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid response from acceptance URL endpoint: missing acceptanceUrl');
    }

    return acceptanceUrl;
  } catch (error) {
    console.error('Error ensuring quote acceptance token:', error);
    throw error;
  }
}
