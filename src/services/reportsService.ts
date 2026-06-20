import { supabase } from '@/lib/supabase';

export interface OverviewReportResponse {
  range: {
    start: string;
    end: string;
    startExclusive: string;
    endExclusive: string;
    days: number;
    timezone: string;
  };
  totals: {
    leadsGenerated: number;
    leadsSold: number;
    conversionRate: number;
    leadsDeleted: number;
    quotesAccepted: number;
    paymentsCreated: number;
    paymentsCompleted: number;
  };
  leadsByTransaction: Array<{ type: string; count: number }>;
  leadsBySource: Array<{ source: string; count: number; percentage: number }>;
  leadsByStatus: Array<{ status: string; count: number; percentage: number }>;
  salesByAgent: Array<{
    agentId: string | null;
    agentName: string;
    leadsCreated: number;
    sales: number;
    conversionRate: number;
  }>;
  salesByLeadAge: Array<{ bucket: string; count: number }>;
  deletedBreakdown: {
    byActor: Array<{ actor: string; count: number }>;
    byReason: Array<{ reason: string; count: number }>;
  };
  paymentsByStatus: Array<{ status: string; count: number }>;
}

export interface LeadQualityBreakdown {
  totalLeads: number;
  genuine: number;
  disqualified: number;
  fake: number;
  duplicate: number;
  wrongNumber: number;
  test: number;
  otherArchived: number;
  available: boolean; // false when the breakdown RPC isn't deployed yet
}

const EMPTY_LEAD_QUALITY: LeadQualityBreakdown = {
  totalLeads: 0,
  genuine: 0,
  disqualified: 0,
  fake: 0,
  duplicate: 0,
  wrongNumber: 0,
  test: 0,
  otherArchived: 0,
  available: false,
};

// "True numbers": total leads created in range vs genuine vs junk (fake /
// duplicate / wrong number / test). Tolerant of the RPC not being deployed yet —
// returns zeros with available:false so the Reports page renders cleanly.
export async function fetchLeadQualityBreakdown(params: {
  startDate: string;
  endDate: string;
  agentId?: string | null;
}): Promise<LeadQualityBreakdown> {
  const { data, error } = await supabase.rpc('get_lead_quality_breakdown', {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_agent_id: params.agentId || null,
  });

  if (error || !data) {
    if (error && !['42883', 'PGRST202', 'PGRST204'].includes(error.code)) {
      console.warn('Lead quality breakdown unavailable:', error.message);
    }
    return EMPTY_LEAD_QUALITY;
  }

  const row: any = data;
  return {
    totalLeads: Number(row.totalLeads || 0),
    genuine: Number(row.genuine || 0),
    disqualified: Number(row.disqualified || 0),
    fake: Number(row.fake || 0),
    duplicate: Number(row.duplicate || 0),
    wrongNumber: Number(row.wrongNumber || 0),
    test: Number(row.test || 0),
    otherArchived: Number(row.otherArchived || 0),
    available: true,
  };
}

export type DisqualifiedDimension = 'source' | 'campaign' | 'utm_source';
export type DisqualifiedDateBasis = 'lead_created' | 'disqualified_date';

export interface DisqualifiedBreakdownRow {
  dimensionType: string;
  dimensionValue: string;
  campaignName: string | null;
  campaignId: string | null;
  total: number;
  fake: number;
  duplicate: number;
  wrongNumber: number;
  test: number;
}

// Fake/duplicate leads grouped by source or campaign. Tolerant of the RPC not
// being deployed yet — returns [] so the Reports card simply hides.
export async function fetchDisqualifiedBreakdown(params: {
  startDate: string;
  endDate: string;
  dimension?: DisqualifiedDimension;
  dateBasis?: DisqualifiedDateBasis;
  agentId?: string | null;
}): Promise<DisqualifiedBreakdownRow[]> {
  const { data, error } = await supabase.rpc('get_disqualified_breakdown', {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_dimension: params.dimension || 'source',
    p_date_basis: params.dateBasis || 'lead_created',
    p_agent_id: params.agentId || null,
  });

  if (error || !Array.isArray(data)) {
    if (error && !['42883', 'PGRST202', 'PGRST204'].includes(error.code)) {
      console.warn('Disqualified breakdown unavailable:', error.message);
    }
    return [];
  }

  return (data as any[]).map((row) => ({
    dimensionType: String(row.dimensionType || ''),
    dimensionValue: String(row.dimensionValue || 'Unknown'),
    campaignName: row.campaignName ?? null,
    campaignId: row.campaignId ?? null,
    total: Number(row.total || 0),
    fake: Number(row.fake || 0),
    duplicate: Number(row.duplicate || 0),
    wrongNumber: Number(row.wrongNumber || 0),
    test: Number(row.test || 0),
  }));
}

export async function fetchOverviewReport(params: {
  startDate: string;
  endDate: string;
}): Promise<OverviewReportResponse> {
  const searchParams = new URLSearchParams();
  if (params.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate);
  }

  // Call Supabase Edge Function instead of Vercel API route
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not configured');
  }
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const functionUrl = `${baseUrl}/functions/v1/reports-overview?${searchParams.toString()}`;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const response = await fetch(functionUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // Check if it's HTML (means route doesn't exist)
    if (errorBody.trim().startsWith('<!')) {
      throw new Error(`Reports endpoint not found. Status: ${response.status}`);
    }
    throw new Error(`Failed to load overview report: ${response.status} ${errorBody}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (text.trim().startsWith('<!')) {
      throw new Error('Reports endpoint returned HTML instead of JSON. The endpoint may not be deployed yet.');
    }
    throw new Error(`Invalid response type: ${contentType}`);
  }

  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error || 'Unknown error loading overview report');
  }

  return payload.data as OverviewReportResponse;
}

/**
 * Fast overview via DB RPC (aggregates in DB, returns counts only).
 * Use this first; fall back to client-side buildFallbackOverview if RPC is not available.
 */
export async function fetchOverviewReportViaRpc(params: {
  startDate: string;
  endDate: string;
}): Promise<OverviewReportResponse | null> {
  try {
    const { data, error } = await supabase.rpc('get_overview_report', {
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    });
    if (error) {
      console.warn('Overview RPC error (will use fallback):', error.message);
      return null;
    }
    if (data == null) return null;
    return data as OverviewReportResponse;
  } catch (e) {
    console.warn('Overview RPC failed (will use fallback):', e);
    return null;
  }
}

export type InstructionReportDateBasis = 'instruction_marked' | 'lead_created';

export interface InstructionReportFilters {
  startDate: string;
  endDate: string;
  dateBasis: InstructionReportDateBasis;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  gadCampaignId?: string;
  utmTerm?: string;
  instructionCreditUserId?: string;
}

export interface InstructionReportSummary {
  totalLeads: number;
  instructedLeads: number;
  conversionRate: number;
  instructionsInRange: number;
  missingAttributionCount: number;
  uniqueCreditedUsers: number;
}

export interface InstructionReportBreakdown {
  dimension: string;
  dimensionValue: string;
  totalLeads: number;
  instructedLeads: number;
  conversionRate: number;
  missingAttributionCount: number;
}

export interface InstructionReportLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  manualInstructedAt?: string;
  instructionCreditUserName?: string;
  manualInstructedByName?: string;
  instructionWeight: number;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  gadCampaignId?: string;
  utmTerm?: string;
  stage?: string;
  status?: string;
  comparisonLeadId?: string;
  totalCount: number;
}

export interface InstructionReportLeadParams extends InstructionReportFilters {
  dimension?: string | null;
  dimensionValue?: string | null;
  page: number;
  pageSize: number;
}

export interface InstructionReportExportParams extends InstructionReportFilters {
  dimension?: string | null;
  dimensionValue?: string | null;
  limit?: number;
}

export interface InstructionReportExportRow {
  leadName: string;
  email: string;
  phone: string;
  createdAt: string;
  manualInstructedAt?: string;
  instructionCreditUserName?: string;
  manualInstructedByName?: string;
  instructionWeight: number;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  gadCampaignId?: string;
  utmTerm?: string;
  clickId?: string;
  clickIdType?: string;
  gclid?: string;
  msclkid?: string;
  gbraid?: string;
  wbraid?: string;
  stage?: string;
  status?: string;
  currentStatusNote?: string;
  comparisonLeadId?: string;
  leadId: string;
  totalCount: number;
  exportLimit: number;
}

const blankToNull = (value?: string | null) => {
  if (!value || value === 'all') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const cleanExportValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
};

const toRpcFilters = (filters: InstructionReportFilters) => ({
  p_start_date: filters.startDate,
  p_end_date: filters.endDate,
  p_date_basis: filters.dateBasis,
  p_source: blankToNull(filters.source),
  p_utm_source: blankToNull(filters.utmSource),
  p_utm_campaign: blankToNull(filters.utmCampaign),
  p_gad_campaignid: blankToNull(filters.gadCampaignId),
  p_utm_term: blankToNull(filters.utmTerm),
  p_instruction_credit_user_id: blankToNull(filters.instructionCreditUserId),
});

export async function fetchInstructionReportSummary(
  filters: InstructionReportFilters
): Promise<InstructionReportSummary> {
  const { data, error } = await supabase.rpc('get_instruction_report_summary', toRpcFilters(filters));

  if (error) {
    console.error('Instruction report summary RPC error:', error);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalLeads: Number(row?.total_leads || 0),
    instructedLeads: Number(row?.instructed_leads || 0),
    conversionRate: Number(row?.conversion_rate || 0),
    instructionsInRange: Number(row?.instructions_in_range || 0),
    missingAttributionCount: Number(row?.missing_attribution_count || 0),
    uniqueCreditedUsers: Number(row?.unique_credited_users || 0),
  };
}

export async function fetchInstructionReportBreakdowns(
  filters: InstructionReportFilters
): Promise<InstructionReportBreakdown[]> {
  const { data, error } = await supabase.rpc('get_instruction_report_breakdowns', toRpcFilters(filters));

  if (error) {
    console.error('Instruction report breakdown RPC error:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    dimension: row.dimension,
    dimensionValue: row.dimension_value,
    totalLeads: Number(row.total_leads || 0),
    instructedLeads: Number(row.instructed_leads || 0),
    conversionRate: Number(row.conversion_rate || 0),
    missingAttributionCount: Number(row.missing_attribution_count || 0),
  }));
}

export async function fetchInstructionReportLeads(
  params: InstructionReportLeadParams
): Promise<{ leads: InstructionReportLead[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('get_instruction_report_leads', {
    ...toRpcFilters(params),
    p_dimension: blankToNull(params.dimension),
    p_dimension_value: blankToNull(params.dimensionValue),
    p_page: params.page,
    p_page_size: params.pageSize,
  });

  if (error) {
    console.error('Instruction report leads RPC error:', error);
    throw error;
  }

  const leads = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    createdAt: row.created_at,
    manualInstructedAt: row.manual_instructed_at || undefined,
    instructionCreditUserName: row.instruction_credit_user_name || undefined,
    manualInstructedByName: row.manual_instructed_by_name || undefined,
    instructionWeight: Number(row.instruction_weight || 1),
    source: row.source || undefined,
    utmSource: row.utm_source || undefined,
    utmCampaign: row.utm_campaign || undefined,
    gadCampaignId: row.gad_campaignid || undefined,
    utmTerm: row.utm_term || undefined,
    clickId: row.click_id || undefined,
    clickIdType: row.click_id_type || undefined,
    gclid: row.gclid || undefined,
    msclkid: row.msclkid || undefined,
    gbraid: row.gbraid || undefined,
    wbraid: row.wbraid || undefined,
    stage: row.stage || undefined,
    status: row.status || undefined,
    comparisonLeadId: row.comparison_lead_id || undefined,
    totalCount: Number(row.total_count || 0),
  }));

  return {
    leads,
    totalCount: leads[0]?.totalCount || 0,
  };
}

export async function fetchInstructionReportExportRows(
  params: InstructionReportExportParams
): Promise<{ rows: InstructionReportExportRow[]; totalCount: number; exportLimit: number; isCapped: boolean }> {
  const requestedLimit = params.limit || 10000;
  const { data, error } = await supabase.rpc('get_instruction_report_export', {
    ...toRpcFilters(params),
    p_dimension: blankToNull(params.dimension),
    p_dimension_value: blankToNull(params.dimensionValue),
    p_limit: requestedLimit,
  });

  if (error) {
    console.error('Instruction report export RPC error:', error);
    throw error;
  }

  const rows = (data || []).map((row: any) => {
    const msclkid = cleanExportValue(row.msclkid);
    const gclid = cleanExportValue(row.gclid);
    const gbraid = cleanExportValue(row.gbraid);
    const wbraid = cleanExportValue(row.wbraid);
    const clickId = cleanExportValue(row.click_id) || msclkid || gclid || gbraid || wbraid;
    const clickIdType =
      cleanExportValue(row.click_id_type)
      || (msclkid ? 'MSCLKID' : gclid ? 'GCLID' : gbraid ? 'GBRAID' : wbraid ? 'WBRAID' : undefined);

    return {
      leadName: row.lead_name || '',
      email: row.email || '',
      phone: row.phone || '',
      createdAt: row.created_at,
      manualInstructedAt: row.manual_instructed_at || undefined,
      instructionCreditUserName: row.instruction_credit_user_name || undefined,
      manualInstructedByName: row.manual_instructed_by_name || undefined,
      instructionWeight: Number(row.instruction_weight || 1),
      source: row.source || undefined,
      utmSource: row.utm_source || undefined,
      utmCampaign: row.utm_campaign || undefined,
      gadCampaignId: row.gad_campaignid || undefined,
      utmTerm: row.utm_term || undefined,
      clickId,
      clickIdType,
      gclid,
      msclkid,
      gbraid,
      wbraid,
      stage: row.stage || undefined,
      status: row.status || undefined,
      currentStatusNote: row.current_status_note || undefined,
      comparisonLeadId: row.comparison_lead_id || undefined,
      leadId: row.lead_id,
      totalCount: Number(row.total_count || 0),
      exportLimit: Number(row.export_limit || requestedLimit),
    };
  });

  const totalCount = rows[0]?.totalCount || 0;
  const exportLimit = rows[0]?.exportLimit || requestedLimit;

  return {
    rows,
    totalCount,
    exportLimit,
    isCapped: totalCount > rows.length,
  };
}
