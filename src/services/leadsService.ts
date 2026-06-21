import { supabase } from '@/lib/supabase';
import { createTask } from './tasksService';
import { logActivity } from './activityService';
import { Lead } from '@/types';
import { countContactAttemptsBatch, calculateContactAttemptsFromStage } from '@/services/activityService';

// Calculate age in hours from created_at
function calculateAgeInHours(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

// Check if lead is overdue (more than 24 hours old and not assigned/contacted)
function isOverdue(lead: any): boolean {
  const ageInHours = calculateAgeInHours(lead.created_at);
  const inactiveValues = new Set(['Sold', 'Closed', 'Archived', 'Cancelled', 'Canceled', 'Dead', 'Lost', 'Gone Elsewhere', 'Not Proceeding', 'Completed', 'Instructed']);
  return ageInHours > 24 && !inactiveValues.has(lead.status) && !inactiveValues.has(lead.stage);
}

const ACTIVE_STATUSES_EXCLUDE = '("Sold","Closed","Archived","Cancelled","Canceled","Dead","Lost","Gone Elsewhere","Not Proceeding","Completed","Instructed")';
const ACTIVE_STAGES_EXCLUDE = '("Sold","Closed","Archived","Cancelled","Canceled","Dead","Lost","Gone Elsewhere","Not Proceeding","Completed","Instructed")';

const toISOUTC = (date: Date) => date.toISOString();

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

const getStartOfTodayIso = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return toISOUTC(start);
};

const getStartOfTomorrowIso = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return toISOUTC(tomorrow);
};

const getOverdueThresholdIso = () => {
  const threshold = new Date();
  threshold.setHours(threshold.getHours() - 24);
  return toISOUTC(threshold);
};

export interface LeadFilters {
  status?: string;
  statusIn?: string[];
  stage?: string;
  source?: string;
  assignedTo?: string;
  assignedNot?: string;
  userId?: string;
  instructionCreditUserId?: string;
  searchTerm?: string;
  includeContactSearch?: boolean;
  includeAttributionSearch?: boolean;
  includeLifecycleSearch?: boolean;
  isOverdue?: boolean;
  priority?: string;
  instructedToday?: boolean;
  isManuallyInstructed?: boolean;
  manualInstructedAfter?: string;
  manualInstructedBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
  assignedOnly?: boolean; // Filter for leads that have assigned_to not null
  leadIds?: string[];
  excludeInactive?: boolean;
  archivedLeadsOnly?: boolean;
  archivedCategory?: string; // Narrow archived view to one disqualify reason (fake/duplicate/wrong_number/test)
  includeArchivedLeads?: boolean;
  excludeArchivedLeads?: boolean;
  oldLeadsOnly?: boolean;
  includeOldLeads?: boolean;
  excludeOldLeads?: boolean;
  outcomeCode?: string | string[]; // Filter by outcome code (for milestone filtering) - can be single value or array
  customOutcomeReason?: string; // Filter by custom outcome reason (for milestone filtering)
  callbackOpenOnly?: boolean; // Only open callbacks (callback_status in requested/contacted)
  callbackToday?: boolean; // Only callbacks requested in the current UK day
  callbackStatus?: string; // Filter by a specific callback_status value
  callbackAssignee?: string; // Scope to a user's callbacks (callback_assigned_to when set, else assigned_to)
  quoteAcceptedOnly?: boolean; // Only leads with an accepted quote (quote_accepted_at not null)
  instructionRequestOpenOnly?: boolean; // Only open instruction requests (requested/contacted)
  instructionRequestToday?: boolean; // Only instruction requests in the current UK day
  instructionRequestStatus?: string; // Filter by a specific instruction_request_status value
  instructionRequestAssignee?: string; // Scope to a user's instruction requests
}

export interface LeadOption {
  id: string;
  shortCode?: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
}

export interface SearchLeadOptionsParams {
  search?: string;
  limit?: number;
  assignedOnly?: boolean;
  activeOnly?: boolean;
  includeClosed?: boolean;
  includeArchivedLeads?: boolean;
  userId?: string;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortDirection?: 'asc' | 'desc';
}

const sanitizeLeadSearch = (value: string) =>
  value
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueValues = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

const buildPhoneSearchTerms = (search: string) => {
  const digits = search.replace(/\D/g, '');
  if (digits.length < 4) return [];

  const variants = [digits];
  if (digits.startsWith('0') && digits.length > 6) {
    variants.push(`44${digits.slice(1)}`);
  }
  if (digits.startsWith('44') && digits.length > 6) {
    variants.push(`0${digits.slice(2)}`);
  }
  if (digits.length >= 7) {
    variants.push(digits.slice(-7));
  }

  return uniqueValues(variants);
};

const buildLeadSearchConditions = (
  value: string,
  options: {
    includeContact?: boolean;
    includeAttribution?: boolean;
    includeLifecycle?: boolean;
  } = {}
) => {
  const search = sanitizeLeadSearch(value);
  if (!search) return [];

  const tokens = search.split(' ').filter(Boolean);
  const namePatterns = [search];

  if (tokens.length > 1) {
    namePatterns.push(tokens.join('%'));
    namePatterns.push([...tokens].reverse().join('%'));
  }

  const searchableTextTerms = uniqueValues([
    search,
    search.toLowerCase(),
    search.replace(/\s+/g, ''),
  ]);

  const includeContact = options.includeContact !== false;
  const conditions = [
    ...uniqueValues(namePatterns).map(term => `name.ilike.%${term}%`),
    ...searchableTextTerms.map(term => `short_code.ilike.%${term}%`),
  ];

  if (includeContact) {
    conditions.push(
      ...searchableTextTerms.flatMap(term => [
      `email.ilike.%${term}%`,
    ]),
      ...buildPhoneSearchTerms(search).map(term => `phone.ilike.%${term}%`)
    );
  }

  if (options.includeLifecycle) {
    conditions.push(
      ...searchableTextTerms.flatMap(term => [
        `source.ilike.%${term}%`,
        `stage.ilike.%${term}%`,
        `status.ilike.%${term}%`,
      ])
    );
  }

  if (options.includeAttribution) {
    conditions.push(
      ...searchableTextTerms.flatMap(term => [
        `utm_source.ilike.%${term}%`,
        `utm_campaign.ilike.%${term}%`,
        `utm_term.ilike.%${term}%`,
        `utm_content.ilike.%${term}%`,
        `gad_campaignid.ilike.%${term}%`,
        `gclid.ilike.%${term}%`,
        `gbraid.ilike.%${term}%`,
        `wbraid.ilike.%${term}%`,
        `msclkid.ilike.%${term}%`,
        `landing_page.ilike.%${term}%`,
        `referrer.ilike.%${term}%`,
        ...(isUuid(term) ? [`comparison_lead_id.eq.${term}`] : []),
      ])
    );
  }

  return uniqueValues(conditions);
};

const buildLeadsQuery = (filters: LeadFilters = {}, selectArgs: string = '*', countOptions?: { count: 'exact' | 'planned' | 'estimated' }) => {
  let query = supabase.from('leads').select(selectArgs, countOptions);

  const archivedOnly = !!(filters.archivedLeadsOnly || filters.oldLeadsOnly);
  const includeArchived = !!(filters.includeArchivedLeads || filters.includeOldLeads);
  const excludeArchived = filters.excludeArchivedLeads !== false && filters.excludeOldLeads !== false;

  if (archivedOnly) {
    query = query.eq('is_funnel_archived', true);
    if (filters.archivedCategory) {
      query = query.eq('funnel_archived_category', filters.archivedCategory);
    }
  } else if (!includeArchived && excludeArchived) {
    query = query.not('is_funnel_archived', 'is', true);
  }

  if (filters.leadIds) {
    if (filters.leadIds.length === 0) {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      query = query.in('id', filters.leadIds);
    }
  }

  if (filters.statusIn && filters.statusIn.length > 0) {
    query = query.in('status', filters.statusIn);
  } else if (filters.status && filters.status !== 'All') {
    query = query.eq('status', filters.status);
  }

  if (filters.stage && filters.stage !== 'all') {
    if (filters.stage === 'unassigned') {
      query = query.is('assigned_to', null);
    } else if (filters.stage === 'claimed') {
      query = query.not('assigned_to', 'is', null);
    } else if (filters.stage === 'highPriority') {
      // This shouldn't happen - highPriority should be handled as priority filter
      // But handle it just in case
      query = query.eq('priority', 'High');
    } else if (filters.stage === 'instructedToday') {
      query = query
        .eq('is_manually_instructed', true)
        .gte('manual_instructed_at', getStartOfTodayIso())
        .lt('manual_instructed_at', getStartOfTomorrowIso());
    } else if (filters.stage === 'overdue') {
      query = query.eq('status', 'New').lt('created_at', getOverdueThresholdIso());
    } else {
      query = query.eq('stage', filters.stage);
    }
  }

  if (filters.source && filters.source !== 'All') {
    query = query.eq('source', filters.source);
  }

  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  if (filters.assignedNot) {
    query = query.neq('assigned_to', filters.assignedNot);
  }

  if (filters.userId) {
    query = query.eq('assigned_to', filters.userId);
  }

  if (filters.assignedOnly) {
    query = query.not('assigned_to', 'is', null);
  }

  if (filters.excludeInactive) {
    query = query
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);
  }

  if (filters.priority && filters.priority !== 'All') {
    query = query.eq('priority', filters.priority);
  }

  if (filters.searchTerm) {
    const searchConditions = buildLeadSearchConditions(filters.searchTerm, {
      includeContact: filters.includeContactSearch !== false,
      includeAttribution: filters.includeAttributionSearch !== false,
      includeLifecycle: !!filters.includeLifecycleSearch,
    });
    if (searchConditions.length > 0) {
      query = query.or(searchConditions.join(','));
    }
  }

  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lt('created_at', filters.createdBefore);
  }

  if (filters.isOverdue) {
    query = query
      .lt('created_at', getOverdueThresholdIso())
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);
  }

  if (filters.instructedToday) {
    query = query
      .eq('is_manually_instructed', true)
      .gte('manual_instructed_at', getStartOfTodayIso())
      .lt('manual_instructed_at', getStartOfTomorrowIso());
  }

  if (typeof filters.isManuallyInstructed === 'boolean') {
    query = query.eq('is_manually_instructed', filters.isManuallyInstructed);
  }

  if (filters.manualInstructedAfter) {
    query = query.gte('manual_instructed_at', filters.manualInstructedAfter);
  }

  if (filters.manualInstructedBefore) {
    query = query.lt('manual_instructed_at', filters.manualInstructedBefore);
  }

  if (filters.instructionCreditUserId) {
    query = query.eq('instruction_credit_user_id', filters.instructionCreditUserId);
  }

  // Note: outcome_code column may not exist in all databases yet
  // Filtering by outcome code is optional - if column doesn't exist, skip this filter
  // The column should be added via migration: add_outcome_code_to_leads.sql
  if (filters.outcomeCode) {
    // Try to apply filter - if column doesn't exist, the query will fail
    // but we'll handle it gracefully in the calling function
    if (Array.isArray(filters.outcomeCode)) {
      // If array, use 'in' filter to match any of the outcome codes
      query = query.in('outcome_code', filters.outcomeCode);
    } else {
      // If single value, use 'eq' filter
      query = query.eq('outcome_code', filters.outcomeCode);
    }
  }

  // Filter by custom outcome reason (for milestone filtering)
  if (filters.customOutcomeReason) {
    query = query.eq('custom_outcome_reason', filters.customOutcomeReason);
  }

  // Callback queue filters. callback_* columns are added by
  // add_callback_request_tracking.sql; the calling functions tolerate the
  // columns being absent (graceful fallback) until the migration runs.
  if (filters.callbackOpenOnly) {
    query = query.in('callback_status', ['requested', 'contacted']);
  } else if (filters.callbackStatus) {
    query = query.eq('callback_status', filters.callbackStatus);
  }

  if (filters.callbackToday) {
    query = query
      .gte('callback_requested_at', getStartOfTodayIso())
      .lt('callback_requested_at', getStartOfTomorrowIso());
  }

  if (filters.callbackAssignee) {
    // Agent scope: their own callbacks — explicitly assigned to them, or
    // unassigned callbacks on a lead they own. Matches the sidebar count.
    query = query.or(
      `callback_assigned_to.eq.${filters.callbackAssignee},and(callback_assigned_to.is.null,assigned_to.eq.${filters.callbackAssignee})`
    );
  }

  // Accepted-quote milestone (quote_accepted_at added by add_quote_accepted_milestone.sql).
  if (filters.quoteAcceptedOnly) {
    query = query.not('quote_accepted_at', 'is', null);
  }

  // Instruction-request queue (instruction_request_* added by add_instruction_request_tracking.sql).
  if (filters.instructionRequestOpenOnly) {
    query = query.in('instruction_request_status', ['requested', 'contacted']);
  } else if (filters.instructionRequestStatus) {
    query = query.eq('instruction_request_status', filters.instructionRequestStatus);
  }

  if (filters.instructionRequestToday) {
    query = query
      .gte('instruction_requested_at', getStartOfTodayIso())
      .lt('instruction_requested_at', getStartOfTomorrowIso());
  }

  if (filters.instructionRequestAssignee) {
    query = query.or(
      `instruction_request_assigned_to.eq.${filters.instructionRequestAssignee},and(instruction_request_assigned_to.is.null,assigned_to.eq.${filters.instructionRequestAssignee})`
    );
  }

  return query;
};

export async function searchLeadOptions(params: SearchLeadOptionsParams = {}): Promise<LeadOption[]> {
  try {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const search = sanitizeLeadSearch(params.search || '');
    const sortBy = params.sortBy || (search ? 'name' : 'updated_at');
    const sortDirection = params.sortDirection || (sortBy === 'name' ? 'asc' : 'desc');

    let query = supabase
      .from('leads')
    .select('id, short_code, name, email, phone, source, stage, status, assigned_to, created_at, updated_at')
    .limit(limit);

    if (params.activeOnly && !params.includeClosed) {
      query = query
        .not('is_funnel_archived', 'is', true)
        .not('status', 'in', ACTIVE_STATUSES_EXCLUDE);
    } else if (!params.includeArchivedLeads) {
      query = query.not('is_funnel_archived', 'is', true);
    }

    if (params.assignedOnly) {
      query = query.not('assigned_to', 'is', null);
    }

    if (params.userId) {
      query = query.eq('assigned_to', params.userId);
    }

    if (search) {
      const searchConditions = buildLeadSearchConditions(search);
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    const { data, error } = await query.order(sortBy, { ascending: sortDirection === 'asc' });

    if (error) {
      console.error('Error searching lead options:', error);
      throw error;
    }

    const rows = ((data as any[]) || []);
    const assignedUserIds = uniqueValues(rows.map(row => row.assigned_to).filter(Boolean));
    const assignedUserNameMap = new Map<string, string>();

    if (assignedUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', assignedUserIds);

      if (usersError) {
        console.warn('Unable to resolve lead owner names for search options:', usersError);
      } else {
        (users || []).forEach((user: any) => {
          if (user.id) assignedUserNameMap.set(user.id, user.name || 'Unknown owner');
        });
      }
    }

    return rows.map(row => ({
      id: row.id,
      shortCode: row.short_code || undefined,
      name: row.name || 'Unnamed Lead',
      email: row.email || undefined,
      phone: row.phone || undefined,
      source: row.source || undefined,
      stage: row.stage || undefined,
      status: row.status || undefined,
      assignedTo: row.assigned_to || undefined,
      assignedToName: row.assigned_to ? assignedUserNameMap.get(row.assigned_to) || undefined : undefined,
    }));
  } catch (error) {
    console.error('Error in searchLeadOptions:', error);
    throw error;
  }
}

// Transform database lead to frontend Lead interface
function transformLead(dbLead: any): Lead {
  const ageInHours = calculateAgeInHours(dbLead.created_at);
  const overdue = isOverdue(dbLead);
  
  return {
    id: dbLead.id,
    shortCode: dbLead.short_code || undefined,
    name: dbLead.name,
    email: dbLead.email,
    phone: dbLead.phone,
    source: dbLead.source || 'Direct',
    quoteId: dbLead.quote_id,
    assignedTo: dbLead.assigned_to,
    assignedToName: dbLead.assigned_to_name,
    status: dbLead.status || 'New',
    stage: dbLead.stage || 'New',
    outcomeCode: dbLead.outcome_code,
    transactionType: dbLead.transaction_type,
    instructedFirm: dbLead.instructed_firm,
    customOutcomeReason: dbLead.custom_outcome_reason,
    createdAt: dbLead.created_at,
    updatedAt: dbLead.updated_at,
    lastActionAt: dbLead.last_action_at,
    isFunnelArchived: !!dbLead.is_funnel_archived,
    funnelArchivedAt: dbLead.funnel_archived_at || undefined,
    funnelArchivedBy: dbLead.funnel_archived_by || undefined,
    funnelArchivedReason: dbLead.funnel_archived_reason || undefined,
    funnelArchivedAuto: !!dbLead.funnel_archived_auto,
    notes: dbLead.notes,
    contactAttempts: dbLead.contact_attempts || 0,
    maxAttempts: dbLead.max_attempts || 5,
    priority: dbLead.priority || 'Medium',
    
    // Hoowla fields
    externalId: dbLead.external_id,
    hoowlaQuoteId: dbLead.hoowla_quote_id,
    propertyAddress: dbLead.property_address,
    propertyValue: dbLead.property_value,
    propertyTenure: dbLead.property_tenure,
    propertyTitleNumber: dbLead.property_title_number,
    propertyRegion: dbLead.property_region,
    clientAddress: dbLead.client_address,
    clientDob: dbLead.client_dob,
    clientNi: dbLead.client_ni,
    clientSource: dbLead.client_source,
    isMortgaged: dbLead.is_mortgaged,
    isUnregistered: dbLead.is_unregistered,
    isFirstTimeBuyer: dbLead.is_first_time_buyer,
    isNewBuild: dbLead.is_new_build,
    isSharedOwnership: dbLead.is_shared_ownership,
    isBuyToLet: dbLead.is_buy_to_let,
    customSituations: dbLead.custom_situations || [],
    // Quote-related fields
    legalFees: dbLead.legal_fees ? dbLead.legal_fees.toString() : undefined,
    sdtlVersion: dbLead.sdtl_version || undefined,
    numberOfPeople: dbLead.number_of_people ? dbLead.number_of_people.toString() : '1',
    customMessage: dbLead.custom_message || undefined,
    quoteSupplements: dbLead.quote_supplements ? (typeof dbLead.quote_supplements === 'string' ? JSON.parse(dbLead.quote_supplements) : dbLead.quote_supplements) : [],
    quoteDisbursements: dbLead.quote_disbursements ? (typeof dbLead.quote_disbursements === 'string' ? JSON.parse(dbLead.quote_disbursements) : dbLead.quote_disbursements) : [],
    whereThingsUpTo: dbLead.where_things_up_to || undefined,
    whereThingsUpToSale: dbLead.where_things_up_to_sale || undefined,

    // Comparison/ad attribution fields
    comparisonLeadId: dbLead.comparison_lead_id || undefined,
    utmSource: dbLead.utm_source || undefined,
    utmMedium: dbLead.utm_medium || undefined,
    utmCampaign: dbLead.utm_campaign || undefined,
    utmTerm: dbLead.utm_term || undefined,
    utmContent: dbLead.utm_content || undefined,
    gadSource: dbLead.gad_source || undefined,
    gadCampaignId: dbLead.gad_campaignid || undefined,
    gclid: dbLead.gclid || undefined,
    msclkid: dbLead.msclkid || undefined,
    gbraid: dbLead.gbraid || undefined,
    wbraid: dbLead.wbraid || undefined,
    landingPage: dbLead.landing_page || undefined,
    referrer: dbLead.referrer || undefined,
    attributionCapturedAt: dbLead.attribution_captured_at || undefined,
    rawAttributionJson: dbLead.raw_attribution_json || undefined,

    // Manual instruction tracking fields
    isManuallyInstructed: dbLead.is_manually_instructed || false,
    manualInstructionStatus: dbLead.manual_instruction_status || undefined,
    manualInstructedAt: dbLead.manual_instructed_at || undefined,
    manualInstructedBy: dbLead.manual_instructed_by || undefined,
    manualInstructedByName: dbLead.manual_instructed_by_name || undefined,
    instructionCreditUserId: dbLead.instruction_credit_user_id || undefined,
    instructionCreditUserName: dbLead.instruction_credit_user_name || undefined,
    assignedToAtInstruction: dbLead.assigned_to_at_instruction || undefined,
    assignedToNameAtInstruction: dbLead.assigned_to_name_at_instruction || undefined,
    instructionMarkSource: dbLead.instruction_mark_source || undefined,
    instructionMarkNotes: dbLead.instruction_mark_notes || undefined,
    
    // Quote status (from quotes table)
    quoteStatus: (dbLead as any).quote_status,
    
    // Computed
    ageInHours,
    isOverdue: overdue,
    quoteAmount: dbLead.quote_amount || undefined,
    
    // Quote-to-instruction workflow fields
    paymentLinkUrl: dbLead.payment_link_url || undefined,
    paymentIntentId: dbLead.payment_intent_id || undefined,
    instructionFormToken: dbLead.instruction_form_token || undefined,
    instructionFormLink: dbLead.instruction_form_link || undefined,
    instructionFormStatus: dbLead.instruction_form_status || undefined,
    instructionFormSubmittedAt: dbLead.instruction_form_submitted_at || undefined,
    instructionPdfUrl: dbLead.instruction_pdf_url || undefined,
    instructionPdfGeneratedAt: dbLead.instruction_pdf_generated_at || undefined,
    lastQuoteAcceptUrl: dbLead.last_quote_accept_url || undefined,

    // Callback request lifecycle (comparison-site callbacks). Columns added by
    // add_callback_request_tracking.sql; tolerate them being absent.
    callbackStatus: dbLead.callback_status || undefined,
    callbackRequested: !!dbLead.callback_requested,
    callbackRequestedAt: dbLead.callback_requested_at || undefined,
    callbackContactedAt: dbLead.callback_contacted_at || undefined,
    callbackCompletedAt: dbLead.callback_completed_at || undefined,
    callbackAssignedTo: dbLead.callback_assigned_to || undefined,
    callbackFirmName: dbLead.callback_firm_name || undefined,
    callbackResolution: dbLead.callback_resolution || undefined,

    // Quote-accepted milestone (add_quote_accepted_milestone.sql). Tolerate absence.
    quoteAcceptedAt: dbLead.quote_accepted_at || undefined,
    acceptedQuoteId: dbLead.accepted_quote_id || undefined,

    // Instruction-request lifecycle (comparison-site "Instruct This Solicitor").
    // Distinct from the formal manual instruction above. Tolerate absence.
    instructionRequestStatus: dbLead.instruction_request_status || undefined,
    instructionRequested: !!dbLead.instruction_requested,
    instructionRequestedAt: dbLead.instruction_requested_at || undefined,
    instructionRequestContactedAt: dbLead.instruction_request_contacted_at || undefined,
    instructionRequestCompletedAt: dbLead.instruction_request_completed_at || undefined,
    instructionRequestAssignedTo: dbLead.instruction_request_assigned_to || undefined,
    instructionRequestFirmName: dbLead.instruction_request_firm_name || undefined,
    instructionRequestResolution: dbLead.instruction_request_resolution || undefined,
  };
}

/**
 * Legacy full-fetch helper. Do not use for page loads, reports, or modal options.
 * Use fetchLeadsPage(), searchLeadOptions(), or targeted helpers instead.
 */
export async function fetchLeads(filters?: LeadFilters): Promise<Lead[]> {
  try {
    if (import.meta.env.DEV) {
      console.warn(
        'fetchLeads() is a legacy full-fetch helper. Use fetchLeadsPage(), searchLeadOptions(), or targeted helpers for new page/modal/report code.'
      );
    }

    const query = buildLeadsQuery(filters);
    // Sort by latest activity time so merged/new quote updates are surfaced immediately.
    // Fallback to created_at when updated_at is equal.
    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(999999);
    if (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }

    const rows = (data as any[]) ?? [];

    if (rows.length > 0) {
      // Filter out invalid UUIDs before querying (prevents 400 errors)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const leadIdsForQuotes = rows
        .map(l => l.id)
        .filter(id => id && uuidRegex.test(id));
      
      const quoteMap = new Map<string, number>();
      const quoteStatusMap = new Map<string, string>(); // Initialize outside the if block
      
      // Batch quotes query to prevent timeouts (Supabase limit ~100 items per .in())
      if (leadIdsForQuotes.length > 0) {
        try {
          const BATCH_SIZE = 100;
          const batches: string[][] = [];
          
          for (let i = 0; i < leadIdsForQuotes.length; i += BATCH_SIZE) {
            batches.push(leadIdsForQuotes.slice(i, i + BATCH_SIZE));
          }
          
          // Fetch quotes in parallel batches with timeout protection
          const quotePromises = batches.map(batch =>
            Promise.race([
              supabase
                .from('quotes')
                .select('lead_id, total_inc_vat, status, created_at')
                .in('lead_id', batch)
                .order('created_at', { ascending: false }),
              new Promise<{ data: null; error: null }>((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), 5000)
              )
            ]).catch(err => {
              console.warn('Quotes query failed or timed out:', err);
              return { data: null, error: err };
            })
          );
          
          const quoteResults = await Promise.all(quotePromises);
          
          quoteResults.forEach(result => {
            if (result.data) {
              result.data.forEach((quote: any) => {
                if (quote.lead_id) {
                  // Store quote amount (latest quote)
                  if (quote.total_inc_vat !== null && quote.total_inc_vat !== undefined) {
                    if (!quoteMap.has(quote.lead_id)) {
                      quoteMap.set(quote.lead_id, quote.total_inc_vat);
                    }
                  }
                  // Store quote status (latest quote)
                  if (quote.status && !quoteStatusMap.has(quote.lead_id)) {
                    quoteStatusMap.set(quote.lead_id, quote.status);
                  }
                }
              });
            }
          });
        } catch (error) {
          console.warn('Error fetching quotes (non-blocking):', error);
          // Continue without quotes - page will still load
        }
      }

      rows.forEach(lead => {
        const quoteAmount = quoteMap.get(lead.id);
        if (quoteAmount !== undefined) {
          lead.quote_amount = quoteAmount;
        }
        const quoteStatus = quoteStatusMap.get(lead.id);
        if (quoteStatus) {
          (lead as any).quote_status = quoteStatus;
        }
      });
    }

    // Fetch actual contact attempt counts from activity_log
    const leadIds = rows.map(lead => lead.id);
    const contactAttemptCounts = await countContactAttemptsBatch(leadIds);

    // Transform and filter
    let leads = rows.map(dbLead => {
      const lead = transformLead(dbLead);
      // Override contactAttempts with actual count from activity_log
      const actualCount = contactAttemptCounts.get(lead.id) || 0;
      lead.contactAttempts = actualCount;
      return lead;
    });

    // Filter overdue leads (after fetching, since it's computed)
    if (filters?.isOverdue) {
      leads = leads.filter(lead => lead.isOverdue);
    }

    // Filter high priority
    if (filters?.priority === 'High') {
      leads = leads.filter(lead => lead.priority === 'High');
    }

    return leads;
  } catch (error) {
    console.error('Error in fetchLeads:', error);
    return [];
  }
}

/** Lightweight fetch for FloatingTaskBox: assigned leads only, no quotes/contact attempts. */
export async function fetchLeadsForTaskBox(filters: { userId?: string; assignedOnly?: boolean }): Promise<Lead[]> {
  try {
    const selectFields = 'id, short_code, name, email, phone, source, assigned_to, status, stage, created_at, updated_at';
    let query = buildLeadsQuery(filters as LeadFilters, selectFields)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    const { data, error } = await query;
    if (error) {
      console.error('Error in fetchLeadsForTaskBox:', error);
      return [];
    }
    const rows = (data as any[]) ?? [];
    return rows.map(dbLead => transformLead(dbLead));
  } catch (error) {
    console.error('Error in fetchLeadsForTaskBox:', error);
    return [];
  }
}

/** Lightweight fetch for FloatingTaskBox dropped-leads section: unassigned leads only. */
export async function fetchUnassignedLeadsForDropped(limit: number = 100): Promise<Lead[]> {
  try {
    const selectFields = 'id, short_code, name, email, phone, source, assigned_to, status, stage, created_at, updated_at';
    const { data, error } = await supabase
      .from('leads')
      .select(selectFields)
      .is('assigned_to', null)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Error in fetchUnassignedLeadsForDropped:', error);
      return [];
    }
    const rows = (data as any[]) ?? [];
    return rows.map(dbLead => transformLead(dbLead));
  } catch (error) {
    console.error('Error in fetchUnassignedLeadsForDropped:', error);
    return [];
  }
}

export interface PaginatedLeadOptions {
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'source' | 'status';
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedLeadsResponse {
  leads: Lead[];
  total: number;
}

export interface FunnelArchivePreviewParams {
  createdFrom: string;
  createdTo: string;
  stageMode?: 'all' | 'call-2-5';
  recentActivityDays?: number;
  limit?: number;
}

export interface FunnelArchivePreviewRow {
  lead: Lead;
  latestActivityAt?: string;
  hasRecentActivity: boolean;
  protectedReason?: string;
  recommended: boolean;
}

export interface FunnelArchivePreviewResult {
  rows: FunnelArchivePreviewRow[];
  totalMatched: number;
  truncated: boolean;
  recentActivityCutoff: string;
}

export interface LeadSummary {
  totalActive: number;
  assignedActive: number;
  unassignedActive: number;
  claimedActive?: number;
  claimedToday?: number;
  closedAssigned?: number;
  teamProgress?: number;
  overdue: number;
  highPriority: number;
  instructedToday: number;
  callbackRequestsToday: number;
  quoteAccepted: number;
  instructionRequestsToday: number;
}

export async function fetchClaimedTodayLeadIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const startOfTodayIso = getStartOfTodayIso();
  const { data, error } = await supabase
    .from('activity_log')
    .select('lead_id, entity_id, done_by_id, metadata')
    .eq('activity_type', 'lead_assigned')
    .gte('created_at', startOfTodayIso)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.warn('Unable to fetch claimed today activity:', error);
    return [];
  }

  const candidateIds = Array.from(new Set((data || [])
    .filter((activity: any) => {
      const assignedTo = activity.metadata?.assignedTo || activity.metadata?.assigned_to;
      return activity.done_by_id === userId || assignedTo === userId;
    })
    .map((activity: any) => activity.lead_id || activity.entity_id)
    .filter(Boolean)));

  if (candidateIds.length === 0) {
    return [];
  }

  const { data: stillAssigned, error: leadsError } = await supabase
    .from('leads')
    .select('id')
    .in('id', candidateIds)
    .eq('assigned_to', userId)
    .not('is_funnel_archived', 'is', true)
    .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
    .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);

  if (leadsError) {
    console.warn('Unable to verify claimed today leads:', leadsError);
    return [];
  }

  return (stillAssigned || []).map((lead: any) => lead.id).filter(Boolean);
}

export async function fetchLeadsPage(
  filters: LeadFilters = {},
  options: PaginatedLeadOptions = {}
): Promise<PaginatedLeadsResponse> {
  const {
    limit = 20,
    offset = 0,
    activeOnly = false,
    sortBy = 'created_at',
    sortDirection = 'desc'
  } = options;

  // Build query with count support for pagination
  let query = buildLeadsQuery(filters, '*', { count: 'exact' });

  if (activeOnly) {
    query = query
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);
  }

  // Validate offset to prevent 416 errors
  // First, get the total count to validate the range
  const { count: totalCount, error: countError } = await query
    .select('id');

  if (countError) {
    console.error('Error getting total count:', countError);
    // If count query fails, still try to fetch data but handle errors
  }

  const total = totalCount ?? 0;
  
  // Validate and adjust offset if out of bounds
  let validOffset = offset;
  if (total > 0 && offset >= total) {
    // If offset is beyond total, reset to last valid page
    const lastPageOffset = Math.floor((total - 1) / limit) * limit;
    validOffset = Math.max(0, lastPageOffset);
    console.warn(`Offset ${offset} out of bounds (total: ${total}). Adjusting to ${validOffset}`);
  }

  // Ensure offset is not negative
  validOffset = Math.max(0, validOffset);

  // Calculate valid range end (don't exceed total)
  const rangeEnd = total > 0 
    ? Math.min(validOffset + limit - 1, total - 1)
    : validOffset + limit - 1;

  // If range is invalid (e.g., offset > total), return empty result
  if (total > 0 && validOffset > rangeEnd) {
    return {
      leads: [],
      total,
    };
  }

  // Rebuild query for actual data fetch
  let dataQuery = buildLeadsQuery(filters, '*', { count: 'exact' });
  if (activeOnly) {
    dataQuery = dataQuery
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);
  }

  // Execute query with validated range
  let { data, error, count } = await dataQuery
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .order('created_at', { ascending: false })
    .range(validOffset, rangeEnd);

  // Graceful degrade: if funnel_archived_category column isn't present yet
  // (migration add_lead_disqualification.sql not run), drop the category filter
  // and show all archived leads instead of erroring.
  if (error && error.code === '42703' && error.message?.includes('funnel_archived_category')) {
    console.warn('funnel_archived_category not present yet; showing all archived leads. Run add_lead_disqualification.sql.');
    const filtersWithoutCategory = { ...filters };
    delete filtersWithoutCategory.archivedCategory;
    const retry = await buildLeadsQuery(filtersWithoutCategory, '*', { count: 'exact' })
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .order('created_at', { ascending: false })
      .range(validOffset, rangeEnd);
    data = retry.data;
    error = retry.error;
    count = retry.count;
  }

  if (error) {
    // Handle missing outcome_code column error (42703) - retry without outcome_code filter
    if (error.code === '42703' && error.message?.includes('outcome_code')) {
      console.warn('outcome_code column does not exist, retrying without outcome_code filter');
      // Retry without outcome_code filter
      const filtersWithoutOutcomeCode = { ...filters };
      delete filtersWithoutOutcomeCode.outcomeCode;
      
      let retryQuery = buildLeadsQuery(filtersWithoutOutcomeCode, '*', { count: 'exact' });
      if (activeOnly) {
        retryQuery = retryQuery
          .not('is_funnel_archived', 'is', true)
          .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
          .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);
      }
      
      const { error: retryError } = await retryQuery
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .order('created_at', { ascending: false })
        .range(validOffset, rangeEnd);

      if (retryError) {
        console.error('Error on retry:', retryError);
        throw new Error('Failed to fetch leads. Please run the migration to add outcome_code column.');
      }
    } else if (error.code === 'PGRST116' || error.message?.includes('416') || error.message?.includes('Range')) {
      console.warn('Range error (416):', error);
      // Return empty result with total count
      return {
        leads: [],
        total: count ?? total ?? 0,
      };
    } else {
    // Handle missing outcome_code column - retry without outcome_code filter
    if (error.code === '42703' && error.message?.includes('outcome_code')) {
      console.warn('outcome_code column does not exist, retrying without outcome_code filter. Please run migration: add_outcome_code_to_leads.sql');
      const filtersWithoutOutcomeCode = { ...filters };
      delete filtersWithoutOutcomeCode.outcomeCode;
      const retryQuery = buildLeadsQuery(filtersWithoutOutcomeCode, '*', { count: 'exact' });
      const retryDataQuery = activeOnly 
        ? retryQuery.not('is_funnel_archived', 'is', true).not('status', 'in', ACTIVE_STATUSES_EXCLUDE).not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
        : retryQuery;
      const { error: retryError } = await retryDataQuery
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .order('created_at', { ascending: false })
        .range(validOffset, rangeEnd);
      if (retryError) {
        console.error('Error on retry:', retryError);
        throw new Error('Failed to fetch leads. Please run the migration to add outcome_code column.');
      }
    }
    
    console.error('Error fetching paginated leads:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Create a proper error object with a readable message
    let errorMessage = 'Failed to fetch leads. Please try again.';
    try {
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }
    } catch (e) {
      errorMessage = 'Failed to fetch leads. Please try again.';
    }
    throw new Error(errorMessage);
    }
  }

  const rows = (data as any[]) ?? [];
  
  // Filter out invalid UUIDs before querying (prevents 400 errors)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allLeadIds = rows.map(lead => lead.id);
  const validLeadIds = allLeadIds.filter(id => id && uuidRegex.test(id));

  const quoteMap = new Map<string, number>();
  
  // Batch quotes query to prevent timeouts (Supabase limit ~100 items per .in())
  if (validLeadIds.length > 0) {
    try {
      const BATCH_SIZE = 100;
      const batches: string[][] = [];
      
      for (let i = 0; i < validLeadIds.length; i += BATCH_SIZE) {
        batches.push(validLeadIds.slice(i, i + BATCH_SIZE));
      }
      
      // Fetch quotes in parallel batches with timeout protection
      const quotePromises = batches.map(batch =>
        Promise.race([
          supabase
            .from('quotes')
            .select('lead_id, total_inc_vat, created_at')
            .in('lead_id', batch)
            .order('created_at', { ascending: false }),
          new Promise<{ data: null; error: null }>((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 5000)
          )
        ]).catch(err => {
          console.warn('Quotes query failed or timed out:', err);
          return { data: null, error: err };
        })
      );
      
      const quoteResults = await Promise.all(quotePromises);
      
      quoteResults.forEach(result => {
        if (result.data) {
          result.data.forEach((quote: any) => {
            if (quote.lead_id && quote.total_inc_vat !== null && quote.total_inc_vat !== undefined) {
              if (!quoteMap.has(quote.lead_id)) {
                quoteMap.set(quote.lead_id, quote.total_inc_vat);
              }
            }
          });
        }
      });
    } catch (error) {
      console.warn('Error fetching quotes (non-blocking):', error);
      // Continue without quotes - page will still load
    }
  }

  rows.forEach(lead => {
    const quoteAmount = quoteMap.get(lead.id);
    if (quoteAmount !== undefined) {
      lead.quote_amount = quoteAmount;
    }
  });

  // Use all lead IDs for contact attempts (including invalid ones for logging)
  const contactAttemptCounts = await countContactAttemptsBatch(allLeadIds);
  const leads = rows.map(dbLead => {
    const lead = transformLead(dbLead);
    lead.contactAttempts = contactAttemptCounts.get(lead.id) || 0;
    return lead;
  });

  return {
    leads,
    total: count ?? leads.length,
  };
}

/** Page size used when fetching all leads for reports (avoids 1000-row cap). */
const REPORT_PAGE_SIZE = 1000;

/**
 * Fetches all leads by paginating in chunks. Use for manager/admin reports so that
 * a full month (or any range) shows more than 1000 leads when the server caps per-request rows.
 */
export async function fetchAllLeadsForReport(filters: LeadFilters = {}): Promise<Lead[]> {
  const all: Lead[] = [];
  let offset = 0;
  while (true) {
    const res = await fetchLeadsPage(filters, { limit: REPORT_PAGE_SIZE, offset });
    all.push(...res.leads);
    // Keep fetching until we get a partial page (don't rely on total; server may cap it at 1000)
    if (res.leads.length < REPORT_PAGE_SIZE) {
      break;
    }
    offset += REPORT_PAGE_SIZE;
  }
  return all;
}

export async function fetchLeadSummary(
  role: 'Admin' | 'Manager' | 'Agent',
  userId?: string
): Promise<LeadSummary> {
  const startOfTodayIso = getStartOfTodayIso();
  const startOfTomorrowIso = getStartOfTomorrowIso();
  const overdueThresholdIso = getOverdueThresholdIso();

  const baseActiveQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const assignedActiveQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
      .not('assigned_to', 'is', null);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const closedAssignedQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .in('status', ['Closed', 'Sold', 'Cancelled', 'Canceled', 'Archived', 'Dead', 'Lost', 'Gone Elsewhere', 'Not Proceeding', 'Completed']);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const unassignedActiveQuery = () =>
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
      .is('assigned_to', null);

  const overdueQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .eq('status', 'New')
      .lt('created_at', overdueThresholdIso);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const highPriorityQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'High')
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const instructedTodayQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .eq('is_manually_instructed', true)
      .gte('manual_instructed_at', startOfTodayIso)
      .lt('manual_instructed_at', startOfTomorrowIso);

    if (role === 'Agent' && userId) {
      query = query.eq('instruction_credit_user_id', userId);
    }

    return query;
  };

  // Callbacks requested today, open (requested/contacted). Managers/admins see
  // all; agents see only those assigned to them (callback_assigned_to when set,
  // otherwise the lead's assigned_to). callback_* columns may not exist until
  // the migration runs — safeCount() swallows that and returns 0.
  const callbackRequestsTodayQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .in('callback_status', ['requested', 'contacted'])
      .gte('callback_requested_at', startOfTodayIso)
      .lt('callback_requested_at', startOfTomorrowIso);

    if (role === 'Agent' && userId) {
      query = query.or(
        `callback_assigned_to.eq.${userId},and(callback_assigned_to.is.null,assigned_to.eq.${userId})`
      );
    }

    return query;
  };

  // Leads with an accepted quote (milestone). Managers/admins see all — including
  // UNASSIGNED accepted leads (often accepted before an agent is assigned); agents
  // see their own. quote_accepted_at may not exist until the migration runs.
  const quoteAcceptedQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('quote_accepted_at', 'is', null);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  // Instruction requests today, open (requested/contacted) — comparison-site
  // "Instruct This Solicitor". Managers see all; agents see their own. Tolerant of
  // the instruction_request_* columns not existing yet (safeCount).
  const instructionRequestsTodayQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .in('instruction_request_status', ['requested', 'contacted'])
      .gte('instruction_requested_at', startOfTodayIso)
      .lt('instruction_requested_at', startOfTomorrowIso);

    if (role === 'Agent' && userId) {
      query = query.or(
        `instruction_request_assigned_to.eq.${userId},and(instruction_request_assigned_to.is.null,assigned_to.eq.${userId})`
      );
    }

    return query;
  };

  const safeCount = async (qb: any): Promise<{ count: number | null }> => {
    try {
      const res = await qb;
      if (res?.error) return { count: 0 };
      return { count: res?.count ?? 0 };
    } catch {
      return { count: 0 };
    }
  };

  const claimedActiveQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
      .not('assigned_to', 'is', null);

    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    return query;
  };

  const teamProgressQuery = () => {
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('is_funnel_archived', 'is', true)
      .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
      .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
      .not('assigned_to', 'is', null);

    if (role === 'Agent' && userId) {
      query = query.neq('assigned_to', userId);
    }

    return query;
  };

  const [
    totalActiveRes,
    assignedActiveRes,
    unassignedActiveRes,
    claimedActiveRes,
    closedAssignedRes,
    teamProgressRes,
    overdueRes,
    highPriorityRes,
    instructedTodayRes,
    callbackRequestsTodayRes,
    quoteAcceptedRes,
    instructionRequestsTodayRes,
    claimedTodayIds,
  ] = await Promise.all([
    baseActiveQuery(),
    assignedActiveQuery(),
    unassignedActiveQuery(),
    claimedActiveQuery(),
    closedAssignedQuery(),
    teamProgressQuery(),
    overdueQuery(),
    highPriorityQuery(),
    instructedTodayQuery(),
    safeCount(callbackRequestsTodayQuery()),
    safeCount(quoteAcceptedQuery()),
    safeCount(instructionRequestsTodayQuery()),
    role === 'Agent' && userId ? fetchClaimedTodayLeadIds(userId) : Promise.resolve([]),
  ]);

  const getCount = (res: { count: number | null }) => res.count ?? 0;

  const totalActive = getCount(totalActiveRes);
  const assignedActive = getCount(assignedActiveRes);
  const unassignedActive =
    role === 'Agent' && userId
      ? getCount(
          await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .is('assigned_to', null)
            .not('is_funnel_archived', 'is', true)
            .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
            .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
        )
      : getCount(unassignedActiveRes);
  const claimedActive = getCount(claimedActiveRes);

  return {
    totalActive,
    assignedActive,
    unassignedActive,
    claimedActive,
    claimedToday: claimedTodayIds.length,
    closedAssigned: getCount(closedAssignedRes),
    teamProgress: getCount(teamProgressRes),
    overdue: getCount(overdueRes),
    highPriority: getCount(highPriorityRes),
    instructedToday: getCount(instructedTodayRes),
    callbackRequestsToday: getCount(callbackRequestsTodayRes),
    quoteAccepted: getCount(quoteAcceptedRes),
    instructionRequestsToday: getCount(instructionRequestsTodayRes),
  };
}

// Fetch a single lead by ID
export async function fetchLeadById(id: string): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.error('Error fetching lead:', error);
      return null;
    }
    
    // Fetch quote amount if needed
    if (data.quote_id) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('total_inc_vat')
        .eq('id', data.quote_id)
        .single();
      if (quote) {
        data.quote_amount = quote.total_inc_vat;
      }
    }

    // Calculate contact attempts based on stage
    const actualCount = await calculateContactAttemptsFromStage(data.stage || 'New', id);
    
    const lead = transformLead(data);
    // Override contactAttempts with stage-based count
    lead.contactAttempts = actualCount;
    
    return lead;
  } catch (error) {
    console.error('Error in fetchLeadById:', error);
    return null;
  }
}

export async function fetchLeadsByIds(ids: string[]): Promise<Lead[]> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uniqueIds = Array.from(new Set(ids.filter(id => id && uuidRegex.test(id))));

    if (uniqueIds.length === 0) {
      return [];
    }

    const rows: any[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const batch = uniqueIds.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('id', batch);

      if (error) {
        console.error('Error fetching leads by IDs:', error);
        throw error;
      }

      rows.push(...((data as any[]) || []));
    }

    const rowById = new Map(rows.map(row => [row.id, row]));
    return uniqueIds
      .map(id => rowById.get(id))
      .filter(Boolean)
      .map(transformLead);
  } catch (error) {
    console.error('Error in fetchLeadsByIds:', error);
    return [];
  }
}

export interface MarkLeadInstructedParams {
  leadId: string;
  markedByUserId: string;
  markedByName: string;
  markedByRole: 'Admin' | 'Manager' | 'Agent';
  creditedUserId?: string | null;
  creditedUserName?: string | null;
  notes?: string | null;
  instructionEffectiveAt?: string | null;
}

export interface UnmarkLeadInstructedParams {
  leadId: string;
  markedByUserId: string;
  markedByName: string;
  markedByRole: 'Admin' | 'Manager' | 'Agent';
  notes?: string | null;
}

export interface LeadInstructionMarkedEvent {
  markedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface InstructionTrackerFilters {
  startDate: string;
  endDate: string;
  creditUserId?: string;
}

export async function markLeadInstructed(params: MarkLeadInstructedParams): Promise<Lead | null> {
  try {
    const { data, error } = await supabase.rpc('mark_lead_instructed', {
      p_lead_id: params.leadId,
      p_marked_by_user_id: params.markedByUserId,
      p_marked_by_name: params.markedByName,
      p_marked_by_role: params.markedByRole,
      p_credit_user_id: params.creditedUserId || null,
      p_credit_user_name: params.creditedUserName || null,
      p_notes: params.notes || null,
      p_instruction_effective_at: params.instructionEffectiveAt || null,
    });

    if (error) {
      console.error('Error marking lead instructed:', error);
      throw error;
    }

    const updatedLead = Array.isArray(data) ? data[0] : data;
    const lead = updatedLead ? transformLead(updatedLead) : await fetchLeadById(params.leadId);

    if (lead) {
      const effectiveDate = params.instructionEffectiveAt || lead.manualInstructedAt || new Date().toISOString();
      await logActivity({
        activityType: 'manual_instruction_marked',
        entityType: 'lead',
        entityId: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Lead marked as instructed${effectiveDate ? ` for ${new Date(effectiveDate).toLocaleDateString('en-GB')}` : ''}`,
        doneByType: 'user',
        doneById: params.markedByUserId,
        doneByName: params.markedByName,
        metadata: {
          instructionStatus: 'instructed',
          instructionEffectiveAt: effectiveDate,
          creditedUserId: lead.instructionCreditUserId || params.creditedUserId || null,
          creditedUserName: lead.instructionCreditUserName || params.creditedUserName || null,
          assignedToAtInstruction: lead.assignedToAtInstruction || null,
          assignedToNameAtInstruction: lead.assignedToNameAtInstruction || null,
        },
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in markLeadInstructed:', error);
    return null;
  }
}

export async function unmarkLeadInstructed(params: UnmarkLeadInstructedParams): Promise<Lead | null> {
  try {
    const { data, error } = await supabase.rpc('unmark_lead_instructed', {
      p_lead_id: params.leadId,
      p_marked_by_user_id: params.markedByUserId,
      p_marked_by_name: params.markedByName,
      p_marked_by_role: params.markedByRole,
      p_notes: params.notes || null,
    });

    if (error) {
      console.error('Error reversing lead instruction:', error);
      throw error;
    }

    const updatedLead = Array.isArray(data) ? data[0] : data;
    const lead = updatedLead ? transformLead(updatedLead) : await fetchLeadById(params.leadId);

    if (lead) {
      await logActivity({
        activityType: 'manual_instruction_reversed',
        entityType: 'lead',
        entityId: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: 'Instruction reversed',
        doneByType: 'user',
        doneById: params.markedByUserId,
        doneByName: params.markedByName,
        metadata: {
          instructionStatus: 'reversed',
          notes: params.notes || null,
        },
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in unmarkLeadInstructed:', error);
    return null;
  }
}

// ── Callback request lifecycle ───────────────────────────────────────────────
// Comparison-site callbacks are recorded on the lead by the edge function. These
// helpers move a callback through requested -> contacted -> completed/cancelled
// and log each transition. They tolerate the callback_* columns not existing yet.
export type CallbackTransition = 'contacted' | 'completed' | 'cancelled' | 'reopen';

export interface UpdateCallbackParams {
  leadId: string;
  transition: CallbackTransition;
  actorUserId: string;
  actorName: string;
  resolution?: string | null; // e.g. 'quote_accepted', 'not_interested'
  notes?: string | null;
}

export async function updateCallbackStatus(params: UpdateCallbackParams): Promise<Lead | null> {
  try {
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: nowIso };

    switch (params.transition) {
      case 'contacted':
        update.callback_status = 'contacted';
        update.callback_contacted_at = nowIso;
        break;
      case 'completed':
        update.callback_status = 'completed';
        update.callback_completed_at = nowIso;
        update.callback_resolution = params.resolution || 'completed';
        break;
      case 'cancelled':
        update.callback_status = 'cancelled';
        update.callback_completed_at = nowIso;
        update.callback_resolution = params.resolution || 'cancelled';
        break;
      case 'reopen':
        update.callback_status = 'requested';
        update.callback_contacted_at = null;
        update.callback_completed_at = null;
        update.callback_resolution = null;
        break;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(update)
      .eq('id', params.leadId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error updating callback status:', error);
      throw error;
    }

    const lead = data ? transformLead(data) : await fetchLeadById(params.leadId);

    if (lead) {
      await logActivity({
        activityType: `callback_${params.transition}`,
        entityType: 'lead',
        entityId: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Callback ${params.transition}${params.resolution ? ` (${params.resolution})` : ''}`,
        doneByType: 'user',
        doneById: params.actorUserId,
        doneByName: params.actorName,
        metadata: {
          callbackStatus: update.callback_status,
          resolution: params.resolution || null,
          notes: params.notes || null,
        },
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in updateCallbackStatus:', error);
    return null;
  }
}

export async function assignCallback(
  leadId: string,
  assigneeUserId: string,
  actorUserId: string,
  actorName: string,
  assigneeName?: string
): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({ callback_assigned_to: assigneeUserId, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error assigning callback:', error);
      throw error;
    }

    const lead = data ? transformLead(data) : await fetchLeadById(leadId);
    if (lead) {
      await logActivity({
        activityType: 'callback_assigned',
        entityType: 'lead',
        entityId: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Callback assigned${assigneeName ? ` to ${assigneeName}` : ''}`,
        doneByType: 'user',
        doneById: actorUserId,
        doneByName: actorName,
        metadata: { callbackAssignedTo: assigneeUserId },
      });
    }
    return lead;
  } catch (error) {
    console.error('Error in assignCallback:', error);
    return null;
  }
}

// ── Instruction-request lifecycle ────────────────────────────────────────────
// Comparison-site "Instruct This Solicitor" requests, recorded on the lead by the
// edge function. Mirrors the callback lifecycle. NEVER touches is_manually_instructed
// (formal instruction stays a separate agent action). Tolerant of columns missing.
export type InstructionRequestTransition = 'contacted' | 'completed' | 'cancelled' | 'reopen';

export interface UpdateInstructionRequestParams {
  leadId: string;
  transition: InstructionRequestTransition;
  actorUserId: string;
  actorName: string;
  resolution?: string | null; // e.g. 'instructed', 'not_proceeding'
  notes?: string | null;
}

export async function updateInstructionRequestStatus(params: UpdateInstructionRequestParams): Promise<Lead | null> {
  try {
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: nowIso };

    switch (params.transition) {
      case 'contacted':
        update.instruction_request_status = 'contacted';
        update.instruction_request_contacted_at = nowIso;
        break;
      case 'completed':
        update.instruction_request_status = 'completed';
        update.instruction_request_completed_at = nowIso;
        update.instruction_request_resolution = params.resolution || 'completed';
        break;
      case 'cancelled':
        update.instruction_request_status = 'cancelled';
        update.instruction_request_completed_at = nowIso;
        update.instruction_request_resolution = params.resolution || 'cancelled';
        break;
      case 'reopen':
        update.instruction_request_status = 'requested';
        update.instruction_request_contacted_at = null;
        update.instruction_request_completed_at = null;
        update.instruction_request_resolution = null;
        break;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(update)
      .eq('id', params.leadId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error updating instruction request status:', error);
      throw error;
    }

    const lead = data ? transformLead(data) : await fetchLeadById(params.leadId);

    if (lead) {
      await logActivity({
        activityType: `instruction_request_${params.transition}`,
        entityType: 'lead',
        entityId: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Instruction request ${params.transition}${params.resolution ? ` (${params.resolution})` : ''}`,
        doneByType: 'user',
        doneById: params.actorUserId,
        doneByName: params.actorName,
        metadata: {
          instructionRequestStatus: update.instruction_request_status,
          resolution: params.resolution || null,
          notes: params.notes || null,
        },
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in updateInstructionRequestStatus:', error);
    return null;
  }
}

export async function fetchLatestInstructionMarkedEvent(leadId: string): Promise<LeadInstructionMarkedEvent | null> {
  try {
    const { data, error } = await supabase
      .from('lead_instruction_events')
      .select('marked_at, metadata')
      .eq('lead_id', leadId)
      .eq('event_type', 'marked_instructed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching latest instruction audit event:', error);
      return null;
    }

    return data
      ? {
          markedAt: data.marked_at || undefined,
          metadata: (data.metadata || undefined) as Record<string, unknown> | undefined,
        }
      : null;
  } catch (error) {
    console.warn('Error in fetchLatestInstructionMarkedEvent:', error);
    return null;
  }
}

export async function fetchInstructionTrackerLeads(filters: InstructionTrackerFilters): Promise<Lead[]> {
  try {
    const endExclusive = new Date(`${filters.endDate}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);

    let query = supabase
      .from('leads')
      .select('*')
      .eq('is_manually_instructed', true)
      .gte('manual_instructed_at', `${filters.startDate}T00:00:00`)
      .lt('manual_instructed_at', endExclusive.toISOString())
      .order('manual_instructed_at', { ascending: false });

    if (filters.creditUserId && filters.creditUserId !== 'all') {
      query = query.eq('instruction_credit_user_id', filters.creditUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching instruction tracker leads:', error);
      throw error;
    }

    return ((data as any[]) || []).map(transformLead);
  } catch (error) {
    console.error('Error in fetchInstructionTrackerLeads:', error);
    return [];
  }
}

const normalizeEmail = (email?: string | null) =>
  email ? email.trim().toLowerCase() : undefined;

const normalizePhone = (phone?: string | null) =>
  phone ? phone.replace(/\D+/g, '') : undefined;

const normalizeText = (text?: string | null) =>
  text ? text.trim().toLowerCase() : undefined;

// Create a new lead
export async function createLead(leadData: Partial<Lead>): Promise<Lead | null> {
  try {
    const normalizedEmail = normalizeEmail(leadData.email);
    const normalizedPhone = normalizePhone(leadData.phone);
    const normalizedAddress = normalizeText(leadData.propertyAddress);

    let duplicateLead: {
      id: string;
      assigned_to?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      property_address?: string | null;
    } | null = null;
    let duplicateMatchReason = '';

    if (normalizedEmail) {
      const { data: emailMatches } = await supabase
        .from('leads')
        .select('id, assigned_to, name, email, phone, property_address')
        .ilike('email', normalizedEmail)
        .order('created_at', { ascending: true })
        .limit(1);

      if (emailMatches && emailMatches.length > 0) {
        duplicateLead = emailMatches[0];
        duplicateMatchReason = `email ${leadData.email}`;
      }
    }

    if (!duplicateLead && normalizedPhone) {
      const { data: phoneMatches } = await supabase
        .from('leads')
        .select('id, assigned_to, name, email, phone, property_address')
        .eq('phone', leadData.phone)
        .limit(1);

      if (
        phoneMatches &&
        phoneMatches.length > 0 &&
        normalizePhone(phoneMatches[0].phone) === normalizedPhone
      ) {
        duplicateLead = phoneMatches[0];
        duplicateMatchReason = `phone ${leadData.phone}`;
      }
    }

    if (!duplicateLead && normalizedAddress) {
      const { data: addressMatches } = await supabase
        .from('leads')
        .select('id, assigned_to, name, email, phone, property_address')
        .ilike('property_address', normalizedAddress)
        .limit(1);

      if (
        addressMatches &&
        addressMatches.length > 0 &&
        normalizeText(addressMatches[0].property_address) === normalizedAddress
      ) {
        duplicateLead = addressMatches[0];
        duplicateMatchReason = `property address ${leadData.propertyAddress}`;
      }
    }

    // If duplicate found by email, return existing lead instead of creating new one
    // This allows quotes to be merged into the existing lead
    if (duplicateLead && duplicateMatchReason.includes('email')) {
      console.log(`🔍 Duplicate lead found by email: ${duplicateLead.id} (${duplicateLead.name})`);
      console.log(`✅ Returning existing lead - quotes should be linked to this lead`);
      
      // Fetch the full lead data
      const { data: existingLeadData, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', duplicateLead.id)
        .single();
      
      if (fetchError || !existingLeadData) {
        console.error('Error fetching existing lead:', fetchError);
        // Continue with creating new lead if fetch fails
      } else {
        // Log activity about duplicate detection
        try {
          await logActivity({
            activityType: 'note_added',
            entityType: 'lead',
            entityId: duplicateLead.id,
            leadId: duplicateLead.id,
            leadName: existingLeadData.name || 'Unknown',
            actionDescription: `Duplicate lead detected by email ${leadData.email}. Returning existing lead to merge quotes.`,
            doneByType: 'system',
            doneById: undefined,
            doneByName: 'Automation System',
            metadata: {
              duplicateEmail: leadData.email,
              attemptedLeadName: leadData.name,
              matchReason: duplicateMatchReason
            }
          });
        } catch (activityError) {
          console.error('Error logging duplicate detection activity:', activityError);
        }
        
        return transformLead(existingLeadData);
      }
    }

    const dbData: any = {
      name: leadData.name,
      email: leadData.email ? leadData.email.trim() : leadData.email,
      phone: leadData.phone,
      source: leadData.source || 'Direct',
      status: leadData.status || 'New',
      stage: leadData.stage || 'New',
      priority: leadData.priority || 'Medium',
      notes: leadData.notes,
      transaction_type: leadData.transactionType,
      assigned_to:
        // If duplicate is detected, assign to current agent (who is creating the lead)
        // This ensures the agent who found/created the duplicate gets it assigned to them
        leadData.assignedTo ??
        (duplicateLead?.assigned_to as string | undefined) ??
        null,
      // Property fields
      property_address: leadData.propertyAddress,
      property_value: leadData.propertyValue ? parseFloat(leadData.propertyValue.toString()) : null,
      property_tenure: leadData.propertyTenure,
      property_title_number: leadData.propertyTitleNumber,
      property_region: leadData.propertyRegion,
      // Client info
      client_address: leadData.clientAddress,
      client_dob: leadData.clientDob,
      client_ni: leadData.clientNi,
      // Property flags
      is_mortgaged: leadData.isMortgaged || false,
      is_unregistered: leadData.isUnregistered || false,
      is_first_time_buyer: leadData.isFirstTimeBuyer || false,
      is_new_build: leadData.isNewBuild || false,
      is_shared_ownership: leadData.isSharedOwnership || false,
      is_buy_to_let: leadData.isBuyToLet || false,
      // Quote-related fields
      legal_fees: leadData.legalFees ? parseFloat(leadData.legalFees.toString()) : null,
      sdtl_version: leadData.sdtlVersion || null,
      number_of_people: leadData.numberOfPeople ? parseInt(leadData.numberOfPeople.toString()) : 1,
      custom_message: leadData.customMessage || null,
      quote_supplements: (leadData as any).quoteSupplements && Array.isArray((leadData as any).quoteSupplements) ? (leadData as any).quoteSupplements : [],
      quote_disbursements: (leadData as any).quoteDisbursements && Array.isArray((leadData as any).quoteDisbursements) ? (leadData as any).quoteDisbursements : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Remove undefined/null values to avoid database errors
    Object.keys(dbData).forEach(key => {
      if (dbData[key] === undefined || dbData[key] === '') {
        delete dbData[key];
      }
    });

    const { data, error } = await supabase
      .from('leads')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    const lead = transformLead(data);

    // If duplicate detected, notify the current agent (who is getting the duplicate assigned)
    if (lead && duplicateLead && lead.assignedTo) {
      const taskTitle = 'Duplicate quote detected';
      const matchDescription = duplicateMatchReason || 'matching contact details';
      const description = [
        `A new lead/quote submission (${lead.name || 'Unnamed'}) matched an existing lead (${duplicateLead.name || 'Unknown'}) by ${matchDescription}.`,
        'This duplicate lead has been automatically assigned to you to avoid duplicate outreach.',
        'Please review and continue the conversation with the client.'
      ].join(' ');

      try {
        await createTask({
          leadId: lead.id,
          assignedTo: lead.assignedTo, // Assign task to current agent (who is getting the duplicate)
          taskType: 'Follow-up',
          title: taskTitle,
          description,
          priority: 'High',
          dueDate: new Date().toISOString()
        });
      } catch (taskError) {
        console.error('Error creating duplicate notification task:', taskError);
      }

      try {
        await logActivity({
          activityType: 'note_added',
          entityType: 'lead',
          entityId: lead.id,
          leadId: lead.id,
          leadName: lead.name,
          actionDescription: `Duplicate lead detected based on ${matchDescription}. Assigned to current agent to avoid duplicate outreach.`,
          doneByType: 'system',
          doneById: undefined,
          doneByName: 'Automation System',
          metadata: {
            duplicateOfLeadId: duplicateLead.id,
            matchReason: matchDescription,
            assignedTo: lead.assignedTo
          }
        });
      } catch (activityError) {
        console.error('Error logging duplicate assignment activity:', activityError);
      }
    }

    // Trigger new lead workflow (async, don't wait)
    if (lead) {
      import('./workflowEngine').then(({ triggerNewLeadWorkflow }) => {
        triggerNewLeadWorkflow(lead.id, lead.assignedTo).catch(err => {
          console.error('Error triggering new lead workflow:', err);
        });
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in createLead:', error);
    return null;
  }
}

// Update a lead
export async function updateLead(id: string, updates: Partial<Lead>, userRole?: 'Admin' | 'Manager' | 'Agent', currentUserId?: string): Promise<Lead | null> {
  try {
    // Fetch old lead data for workflow triggers
    const oldLead = await fetchLeadById(id);
    const oldStage = oldLead?.stage;
    const oldStatus = oldLead?.status;
    const oldAssignedTo = oldLead?.assignedTo;

    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that exist in the database schema
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    // Handle assignedTo - convert undefined to null to properly clear assignment
    // BUT: Agents have restricted edit rights
    if ('assignedTo' in updates) {
      if (userRole === 'Agent') {
        // Agents can:
        // 1. Claim unassigned leads (set to themselves)
        // 2. Drop leads assigned to them (set to null)
        // 3. Keep the same assignment (no change)
        // But cannot change ownership to another agent
        const isUnassigned = !oldAssignedTo || oldAssignedTo === null || oldAssignedTo === '';
        const isClaimingToSelf = currentUserId && updates.assignedTo === currentUserId;
        const isDroppingOwnLead = currentUserId && oldAssignedTo === currentUserId && (updates.assignedTo === null || updates.assignedTo === undefined);
        const isKeepingSame = oldAssignedTo === updates.assignedTo;
        
        if (isUnassigned && isClaimingToSelf) {
          // Allow: Agent claiming an unassigned lead
          dbUpdates.assigned_to = updates.assignedTo;
          console.log('Agent claiming unassigned lead:', { leadId: id, agentId: currentUserId });
        } else if (isDroppingOwnLead) {
          // Allow: Agent dropping their own lead (unassigning it)
          dbUpdates.assigned_to = null;
          console.log('Agent dropping their own lead:', { leadId: id, agentId: currentUserId });
        } else if (isKeepingSame) {
          // Allow: Agent keeping the same assignment (no change)
          dbUpdates.assigned_to = updates.assignedTo;
        } else {
          // Block: Agent trying to change ownership to another agent
          console.warn('Agent attempted to change assigned_to - ignoring update', {
            leadId: id,
            oldAssignedTo,
            newAssignedTo: updates.assignedTo,
            currentUserId
          });
          // Don't include assigned_to in the update
        }
      } else {
        // Admin/Manager can change assigned_to
        // Convert undefined to null to properly clear assignment
        dbUpdates.assigned_to = updates.assignedTo !== undefined ? (updates.assignedTo ?? null) : undefined;
      }
    }
    // Only include outcome_code if it exists - try updating with it first, then without if it fails
    if (updates.outcomeCode !== undefined) dbUpdates.outcome_code = updates.outcomeCode;
    if (updates.transactionType !== undefined) dbUpdates.transaction_type = updates.transactionType;
    if (updates.instructedFirm !== undefined) dbUpdates.instructed_firm = updates.instructedFirm;
    if (updates.customOutcomeReason !== undefined) dbUpdates.custom_outcome_reason = updates.customOutcomeReason;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.lastActionAt !== undefined) dbUpdates.last_action_at = updates.lastActionAt;
    
    // Instruction form fields - handle null values explicitly
    if ('instructionFormStatus' in updates) dbUpdates.instruction_form_status = updates.instructionFormStatus ?? null;
    if ('instructionPdfUrl' in updates) dbUpdates.instruction_pdf_url = updates.instructionPdfUrl ?? null;
    if ('instructionFormSubmittedAt' in updates) dbUpdates.instruction_form_submitted_at = updates.instructionFormSubmittedAt ?? null;
    if ('instructionPdfGeneratedAt' in updates) dbUpdates.instruction_pdf_generated_at = updates.instructionPdfGeneratedAt ?? null;
    if ('instructionFormToken' in updates) dbUpdates.instruction_form_token = updates.instructionFormToken ?? null;
    if ('instructionFormLink' in updates) dbUpdates.instruction_form_link = updates.instructionFormLink ?? null;

    // Try updating with all fields first
    let { data, error } = await supabase
      .from('leads')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    // If error is about missing columns, retry without them
    if (error && error.message) {
      const missingColumns: string[] = [];
      if (error.message.includes('outcome_code')) missingColumns.push('outcome_code');
      if (error.message.includes('custom_outcome_reason')) missingColumns.push('custom_outcome_reason');
      if (error.message.includes('stage')) {
        console.error('Γ¥î CRITICAL: stage column not found in database! This will prevent stage updates.');
        missingColumns.push('stage');
      }
      
      if (missingColumns.length > 0) {
        console.warn(`Columns not found (${missingColumns.join(', ')}), updating without them:`, error.message);
        const dbUpdatesWithoutMissing = { ...dbUpdates };
        missingColumns.forEach(col => {
          if (col === 'outcome_code') delete dbUpdatesWithoutMissing.outcome_code;
          if (col === 'custom_outcome_reason') delete dbUpdatesWithoutMissing.custom_outcome_reason;
          if (col === 'stage') delete dbUpdatesWithoutMissing.stage;
        });
        
        console.log('≡ƒöä Retrying update with:', dbUpdatesWithoutMissing);
        
        const retryResult = await supabase
          .from('leads')
          .update(dbUpdatesWithoutMissing)
          .eq('id', id)
          .select()
          .single();
        
        if (retryResult.error) {
          console.error('Γ¥î Error updating lead (retry):', retryResult.error);
          // Check if it's a different column issue
          if (retryResult.error.message && retryResult.error.message.includes('Could not find')) {
            const missingCol = retryResult.error.message.match(/Could not find the '(\w+)' column/)?.[1];
            if (missingCol) {
              console.error(`Γ¥î Missing column detected: ${missingCol}`);
              // If stage is missing, this is critical
              if (missingCol === 'stage') {
                console.error('Γ¥îΓ¥îΓ¥î STAGE COLUMN MISSING! Leads cannot update stages without this column.');
              }
            }
          }
          throw retryResult.error;
        }
        
        console.log('Γ£à Update successful after removing missing columns:', retryResult.data);
        data = retryResult.data;
        error = null;
      }
    }

    if (error) {
      console.error('Error updating lead:', error);
      throw error;
    }

    const lead = transformLead(data);

    // Auto-complete previous stage tasks if stage changed (async, don't wait)
    if (lead && updates.stage !== undefined && oldStage !== updates.stage) {
      console.log(`≡ƒöä Stage changed from ${oldStage} to ${updates.stage} for lead ${lead.id}`);
      import('./tasksService').then(({ autoCompletePreviousStageTasks }) => {
        autoCompletePreviousStageTasks(
          lead.id,
          updates.stage!,
          undefined,
          'System'
        ).then(count => {
          if (count > 0) {
            console.log(`Γ£à Auto-completed ${count} task(s) for lead ${lead.id}`);
          }
        }).catch(err => {
          console.error('Error auto-completing previous stage tasks:', err);
        });
      });
    }

    // Complete all remaining tasks when lead is closed/completed
    if (lead && updates.status !== undefined && updates.status !== oldStatus) {
      const completionStatuses = new Set(['Completed', 'Closed', 'Archived', 'Sold']);
      if (completionStatuses.has(updates.status)) {
        import('./tasksService').then(({ completeAllPendingTasksForLead }) => {
          completeAllPendingTasksForLead(
            lead.id,
            `status changed to ${updates.status}`,
            updates.assignedTo || oldAssignedTo,
            'System'
          ).catch(err => {
            console.error('Error completing tasks for closed lead:', err);
          });
        });
      }
    }

    // Trigger workflow based on what changed (async, don't wait)
    if (lead) {
      import('./workflowEngine').then(({ 
        triggerLeadAssignedWorkflow, 
        triggerStageChangedWorkflow 
      }) => {
        // Check if assigned_to changed
        if (updates.assignedTo !== undefined && updates.assignedTo && oldAssignedTo !== updates.assignedTo) {
          triggerLeadAssignedWorkflow(lead.id, updates.assignedTo).catch(err => {
            console.error('Error triggering lead assigned workflow:', err);
          });
        }

        // Check if stage changed
        if (updates.stage !== undefined && oldStage !== updates.stage) {
          triggerStageChangedWorkflow(lead.id, oldStage || 'New', updates.stage, lead.assignedTo).catch(err => {
            console.error('Error triggering stage changed workflow:', err);
          });
        }
      });
    }

    return lead;
  } catch (error) {
    console.error('Error in updateLead:', error);
    return null;
  }
}

export async function archiveLeadsForFunnel(
  leadIds: string[],
  options?: {
    reason?: string;
    archivedById?: string;
    archivedByName?: string;
    auto?: boolean;
  }
): Promise<number> {
  try {
    const ids = Array.from(new Set((leadIds || []).filter(Boolean)));
    if (ids.length === 0) return 0;

    const { data, error } = await supabase.rpc('archive_leads_for_funnel', {
      p_lead_ids: ids,
      p_reason: options?.reason || 'Aged funnel cleanup',
      p_archived_by: options?.archivedById || null,
      p_archived_by_name: options?.archivedByName || null,
      p_auto: !!options?.auto,
    });

    if (error) throw error;
    return Number(data || 0);
  } catch (error) {
    console.error('Error archiving leads for funnel:', error);
    throw error;
  }
}

export async function restoreFunnelArchivedLeads(
  leadIds: string[],
  options?: {
    restoredById?: string;
    restoredByName?: string;
    reason?: string;
  }
): Promise<number> {
  try {
    const ids = Array.from(new Set((leadIds || []).filter(Boolean)));
    if (ids.length === 0) return 0;

    const { data, error } = await supabase.rpc('restore_funnel_archived_leads', {
      p_lead_ids: ids,
      p_restored_by: options?.restoredById || null,
      p_restored_by_name: options?.restoredByName || null,
      p_reason: options?.reason || 'Restored to active funnel',
    });

    if (error) throw error;
    return Number(data || 0);
  } catch (error) {
    console.error('Error restoring archived leads:', error);
    throw error;
  }
}

export const moveLeadsToArchive = archiveLeadsForFunnel;
export const restoreArchivedLeads = restoreFunnelArchivedLeads;

const FUNNEL_ARCHIVE_MEANINGFUL_ACTIVITY_TYPES = [
  'contact_attempt',
  'task_completed',
  'quote_sent',
  'quote_created',
  'quote_accepted',
  'payment_received',
  'payment_created',
  'manual_instruction_marked',
  'client_info_returned',
  'email_sent',
  'sms_sent',
  'lead_updated',
  'lead_status_changed',
  'outcome_code_set',
];

const FUNNEL_ARCHIVE_PROTECTED_STAGES = new Set([
  'Interested',
  'Ready to Solicit',
  'Quote Accepted - Awaiting Payment',
  'Payment Completed - Awaiting Client Information',
  'Instructed',
]);

const FUNNEL_ARCHIVE_PROTECTED_STATUSES = new Set([
  'Interested',
  'Quote Sent',
  'Sold',
  'Closed',
]);

const getArchiveProtectedReason = (lead: Lead) => {
  if (lead.isManuallyInstructed || lead.stage === 'Instructed') return 'Instructed lead';
  if (lead.stage === 'Ready to Solicit') return 'Ready to solicit';
  if (lead.stage === 'Quote Accepted - Awaiting Payment') return 'Quote accepted';
  if (lead.stage === 'Payment Completed - Awaiting Client Information') return 'Payment completed';
  if (FUNNEL_ARCHIVE_PROTECTED_STAGES.has(lead.stage)) return `Stage: ${lead.stage}`;
  if (FUNNEL_ARCHIVE_PROTECTED_STATUSES.has(lead.status)) return `Status: ${lead.status}`;
  return undefined;
};

const maxIso = (values: Array<string | undefined | null>) =>
  values
    .filter(Boolean)
    .map(value => new Date(value as string).getTime())
    .filter(value => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

export async function fetchFunnelArchivePreview(params: FunnelArchivePreviewParams): Promise<FunnelArchivePreviewResult> {
  const recentActivityDays = Math.min(Math.max(params.recentActivityDays ?? 14, 1), 365);
  const limit = Math.min(Math.max(params.limit ?? 1000, 1), 5000);
  const recentActivityCutoff = new Date(Date.now() - recentActivityDays * 24 * 60 * 60 * 1000).toISOString();
  const createdFrom = new Date(params.createdFrom);
  const createdTo = new Date(params.createdTo);

  if (Number.isNaN(createdFrom.getTime()) || Number.isNaN(createdTo.getTime())) {
    throw new Error('Choose a valid archive date range.');
  }

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .not('is_funnel_archived', 'is', true)
    .not('status', 'in', ACTIVE_STATUSES_EXCLUDE)
    .not('stage', 'in', ACTIVE_STAGES_EXCLUDE)
    .gte('created_at', createdFrom.toISOString())
    .lte('created_at', createdTo.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (params.stageMode === 'call-2-5') {
    query = query.in('stage', ['Call-2', 'Call-3', 'Call-4', 'Call-5']);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Error fetching funnel archive preview:', error);
    throw error;
  }

  const rows = ((data as any[]) || []).map(transformLead);
  const leadIds = rows.map(lead => lead.id).filter(Boolean);
  const latestActivityByLead = new Map<string, string>();
  const batchSize = 100;

  for (let index = 0; index < leadIds.length; index += batchSize) {
    const batch = leadIds.slice(index, index + batchSize);
    const { data: activities, error: activityError } = await supabase
      .from('activity_log')
      .select('lead_id, entity_id, created_at')
      .in('activity_type', FUNNEL_ARCHIVE_MEANINGFUL_ACTIVITY_TYPES)
      .gte('created_at', recentActivityCutoff)
      .or(`lead_id.in.(${batch.join(',')}),entity_id.in.(${batch.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (activityError) {
      console.warn('Unable to fetch recent activity for archive preview:', activityError);
      continue;
    }

    for (const activity of activities || []) {
      const leadId = activity.lead_id || activity.entity_id;
      if (!leadId || !activity.created_at) continue;
      const current = latestActivityByLead.get(leadId);
      if (!current || activity.created_at > current) {
        latestActivityByLead.set(leadId, activity.created_at);
      }
    }
  }

  return {
    rows: rows.map(lead => {
      const latestActivityAt = latestActivityByLead.get(lead.id);
      const ownLatestTime = maxIso([lead.lastActionAt, lead.updatedAt, latestActivityAt]);
      const hasRecentActivity = !!ownLatestTime && ownLatestTime >= new Date(recentActivityCutoff).getTime();
      const protectedReason = getArchiveProtectedReason(lead);

      return {
        lead,
        latestActivityAt: ownLatestTime ? new Date(ownLatestTime).toISOString() : undefined,
        hasRecentActivity,
        protectedReason,
        recommended: !hasRecentActivity && !protectedReason,
      };
    }),
    totalMatched: count ?? rows.length,
    truncated: (count ?? rows.length) > rows.length,
    recentActivityCutoff,
  };
}

// Assign leads to user
export async function assignLeads(
  leadIds: string[], 
  userId: string, 
  options?: {
    priority?: 'High' | 'Medium' | 'Low';
    notes?: string;
    assignedById?: string;
    assignedByName?: string;
  }
): Promise<boolean> {
  try {
    // First, fetch existing leads to check their current stage
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, stage, notes')
      .in('id', leadIds);

    if (!existingLeads || existingLeads.length === 0) {
      console.error('No leads found to assign');
      return false;
    }

    // Update each lead individually to handle stage logic
    const updatePromises = leadIds.map(async (leadId) => {
      const existingLead = existingLeads.find(l => l.id === leadId);
      if (!existingLead) return;

      const updateData: any = {
        assigned_to: userId,
        status: 'Assigned',
        updated_at: new Date().toISOString()
      };

      // Set stage to 'New' if lead has no stage, otherwise preserve existing stage
      if (!existingLead.stage || existingLead.stage === null || existingLead.stage === '') {
        updateData.stage = 'New';
      }
      // If stage exists, it will be preserved (not included in updateData)

      // Update priority if provided
      if (options?.priority) {
        updateData.priority = options.priority;
      }

      // Update notes if provided (append to existing notes)
      if (options?.notes) {
        const existingNotes = existingLead.notes || '';
        const newNotes = existingNotes 
          ? `${existingNotes}\n\n[Assignment Note - ${new Date().toLocaleString()}]: ${options.notes}`
          : `[Assignment Note - ${new Date().toLocaleString()}]: ${options.notes}`;
        updateData.notes = newNotes;
      }

      return supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);
    });

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r?.error);
    
    if (errors.length > 0) {
      console.error('Error assigning leads:', errors);
      throw errors[0]?.error || new Error('Failed to assign leads');
    }

    // Log activity for each lead if assignedById is provided
    if (options?.assignedById && options?.assignedByName) {
      try {
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, stage')
          .in('id', leadIds);

        const { data: agent } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single();

        if (leads && agent) {
          const activityPromises = leads.map(lead => {
            const stageInfo = existingLeads.find(l => l.id === lead.id);
            const stageChanged = stageInfo && (!stageInfo.stage || stageInfo.stage === null || stageInfo.stage === '') ? ' (Stage set to: New - Not Contacted)' : '';
            
            return logActivity({
              activityType: 'lead_assigned',
              entityType: 'lead',
              entityId: lead.id,
              leadId: lead.id,
              leadName: lead.name,
              actionDescription: `Lead assigned to ${agent.name}${options.priority ? ` (Priority: ${options.priority})` : ''}${stageChanged}`,
              doneByType: 'user',
              doneById: options.assignedById,
              doneByName: options.assignedByName,
              metadata: {
                assignedTo: userId,
                assignedToName: agent.name,
                priority: options.priority,
                notes: options.notes,
                previousStage: stageInfo?.stage || null,
                newStage: lead.stage || 'New'
              }
            }).catch(err => {
              console.error(`Error logging activity for lead ${lead.id}:`, err);
              return null;
            });
          });

          await Promise.all(activityPromises);
        }
      } catch (activityError) {
        console.error('Error logging assignment activities:', activityError);
        // Don't fail the assignment if activity logging fails
      }
    }

    // Notify assigned user
    return true;
  } catch (error) {
    console.error('Error in assignLeads:', error);
    return false;
  }
}

const getSupabaseErrorDetails = (error: any) => ({
  code: error?.code,
  message: error?.message,
  details: error?.details,
  hint: error?.hint,
});

// Permanently delete leads and related records
export async function deleteLeads(
  leadIds: string[],
  options?: {
    reason?: string;
    deletedById?: string;
    deletedByName?: string;
  }
): Promise<boolean> {
  try {
    if (!leadIds || leadIds.length === 0) {
      return true;
    }

    const ids = leadIds.filter(Boolean);
    if (ids.length === 0) {
      return true;
    }

    const { reason, deletedById, deletedByName } = options || {};

    const { data: leadsToDelete, error: fetchError } = await supabase
      .from('leads')
      .select('id, name, assigned_to')
      .in('id', ids);

    if (fetchError) {
      console.error('Error fetching leads before delete:', fetchError);
    }

    if (leadsToDelete && leadsToDelete.length > 0) {
      await Promise.all(
        leadsToDelete.map(async (lead) => {
          try {
            await logActivity({
              activityType: 'lead_deleted',
              entityType: 'lead',
              entityId: lead.id,
              leadId: undefined,
              leadName: lead.name,
              actionDescription: `Lead deleted from CRM${reason ? ` (${reason})` : ''}`,
              doneByType: deletedById ? 'user' : 'system',
              doneById: deletedById,
              doneByName: deletedByName || (deletedById ? 'User' : 'System'),
              metadata: {
                deletedLeadId: lead.id,
                reason: reason || null,
                assignedTo: lead.assigned_to || null
              }
            });
          } catch (activityError) {
            console.error('Error logging lead deletion activity:', activityError);
          }
        })
      );
    }

    // First, get all quote IDs for these leads before deleting quotes
    // We need to delete payments that reference these quotes
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select('id')
      .in('lead_id', ids);

    if (quotesError && !['PGRST116', '42P01'].includes(quotesError.code || '')) {
      console.warn('Error fetching quotes for deletion:', quotesError);
    }

    const quoteIds = quotesData?.map(q => q.id) || [];

    // Delete payments that reference these quotes (must be done before deleting quotes)
    if (quoteIds.length > 0) {
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .in('quote_id', quoteIds);

      if (paymentsError && !['PGRST116', '42P01'].includes(paymentsError.code || '')) {
        console.warn('Error deleting payments:', paymentsError);
        // Don't throw - payments table might not exist or might have a different structure
      }
    }

    // Preserve comparison-site history while removing the CRM FK that can block
    // lead deletion when comparison_leads.crm_lead_id points at this CRM lead.
    const { error: comparisonLeadUnlinkError } = await supabase
      .from('comparison_leads')
      .update({ crm_lead_id: null })
      .in('crm_lead_id', ids);

    if (comparisonLeadUnlinkError && !['PGRST116', '42P01', '42703', 'PGRST204', 'PGRST205'].includes(comparisonLeadUnlinkError.code || '')) {
      console.error('Error unlinking comparison leads before CRM lead deletion:', getSupabaseErrorDetails(comparisonLeadUnlinkError));
      throw comparisonLeadUnlinkError;
    }

    const tablesWithLeadId = [
      { table: 'diary_tasks', column: 'lead_id' },
      { table: 'quotes', column: 'lead_id' },
      { table: 'solicitor_instructions', column: 'lead_id' },
      { table: 'lead_instruction_events', column: 'lead_id' },
      { table: 'activity_log', column: 'lead_id' },
      { table: 'contact_attempts', column: 'lead_id' }
    ];

    const ignorableErrorCodes = new Set(['PGRST116', '42P01', 'PGRST205']);

    for (const { table, column } of tablesWithLeadId) {
      const { error: relatedError } = await supabase
        .from(table)
        .delete()
        .in(column, ids);

      if (relatedError && !ignorableErrorCodes.has(relatedError.code || '')) {
        console.error(`Error deleting related records from ${table}:`, getSupabaseErrorDetails(relatedError));
        throw relatedError;
      }
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting leads:', getSupabaseErrorDetails(error));
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteLeads:', getSupabaseErrorDetails(error));
    return false;
  }
}

export interface PulseSegment { label: string; count: number; color?: string; tone?: 'good' | 'warn' | 'bad'; }
export interface PulseBars { title: string; total: number; segments: PulseSegment[]; }
export interface PulseFunnelStage { stage: string; count: number; movement: number; }
export interface PulseCall { party: string; summary: string; outcome: string; when: string; }
export interface PulseDeposit { name: string; ref: string; amount: number; status: string; when: string; }
export interface PulseChip { key: string; label: string; count: number; }
export interface PipelinePulse {
  spread: { total: number; segments: PulseSegment[] };
  hot: PulseBars;
  otherActive: PulseBars;
  overdue: PulseBars;
  funnel: PulseFunnelStage[];
  recentCalls: PulseCall[];
  recentDeposits: PulseDeposit[];
  chips: PulseChip[];
}

// Pipeline Pulse landing aggregate. In ty this RPC rolls leads up by status/stage,
// overdue buckets, hot/temperature, today's movement, and recent activity.
export async function fetchPipelinePulse(): Promise<PipelinePulse> {
  const { data, error } = await supabase.rpc('get_pipeline_pulse', {});
  if (error) {
    console.error('Pipeline pulse RPC error:', error);
    throw error;
  }
  return data as PipelinePulse;
}

// Get dashboard statistics
export async function getDashboardStats(userId?: string, role?: string): Promise<{
  totalLeads: number;
  newLeads: number;
  activeLeads: number;
  closedLeads: number;
  assignedLeads: number;
  unassignedLeads: number;
}> {
  try {
    let query = supabase.from('leads').select('id, status, assigned_to', { count: 'exact' });

    // For agents, only count their leads
    if (role === 'Agent' && userId) {
      query = query.eq('assigned_to', userId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching stats:', error);
      return {
        totalLeads: 0,
        newLeads: 0,
        activeLeads: 0,
        closedLeads: 0,
        assignedLeads: 0,
        unassignedLeads: 0
      };
    }

    const leads = data || [];
    const newLeads = leads.filter(l => l.status === 'New').length;
    const activeLeads = leads.filter(l => ['New', 'Assigned', 'Contacted', 'Interested'].includes(l.status)).length;
    const closedLeads = leads.filter(l => ['Sold', 'Closed', 'Archived'].includes(l.status)).length;
    const assignedLeads = leads.filter(l => l.assigned_to).length;
    const unassignedLeads = leads.filter(l => !l.assigned_to).length;

    return {
      totalLeads: count || 0,
      newLeads,
      activeLeads,
      closedLeads,
      assignedLeads,
      unassignedLeads
    };
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return {
      totalLeads: 0,
      newLeads: 0,
      activeLeads: 0,
      closedLeads: 0,
      assignedLeads: 0,
      unassignedLeads: 0
    };
  }
}
