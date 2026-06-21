import { supabase } from '@/lib/supabase';
import { CrmCallAiAnalysis, CrmCallRecord } from '@/types';

export interface ThreeCxExtensionMapping {
  id: string;
  extension: string;
  userId?: string;
  userName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThreeCxCallSettings {
  autoAnalyzeEnabled: boolean;
  autoAnalyzeLimit: number;
  autoAnalyzeMinDurationSeconds: number;
  updatedAt?: string;
  updatedByName?: string;
}

const DEFAULT_THREECX_CALL_SETTINGS: ThreeCxCallSettings = {
  autoAnalyzeEnabled: true,
  autoAnalyzeLimit: 300,
  autoAnalyzeMinDurationSeconds: 20,
};

export interface CallAnalysisFilters {
  startDate: string;
  endDate: string;
  agentUserId?: string | null;
  direction?: string | null;
  callStatus?: string | null;
  transcriptStatus?: string | null;
  aiStatus?: string | null;
  matchStatus?: string | null;
  callType?: string | null;
  followUpNeeded?: boolean | null;
  reviewStatus?: string | null;
}

export interface CallAnalysisSummary {
  totalCalls: number;
  transcriptsReceived: number;
  aiAnalysed: number;
  pendingAi: number;
  failedAi: number;
  matchedLeads: number;
  needsReview: number;
  voicemails: number;
  followUpNeeded: number;
  instructionIntent: number;
  outboundCalls: number;
  outboundAnswered: number;
  outboundVoicemail: number;
  inboundHotCalls: number;
  possibleHotCalls: number;
  anyObjection: number;
  officialInstructions: number;
}

export interface CallDailyOverview {
  totalCalls: number;
  answeredCalls: number;
  voicemailCalls: number;
  missedAbandonedCalls: number;
  outboundCalls: number;
  outboundAnsweredCalls: number;
  outboundVoicemailCalls: number;
  outboundAnswerRate: number;
  uniqueLeadsAttempted: number;
  uniqueLeadsContacted: number;
  contactRate: number;
  officialInstructions: number;
  contactToInstructionRate: number;
  outboundAttempt1Calls: number;
  outboundAttempt2Calls: number;
  outboundAttempt3PlusCalls: number;
  inboundHotCalls: number;
  possibleHotCalls: number;
  outboundAttemptsPerLead: number;
  averageFirstOutboundDelaySeconds: number;
  averageDurationSeconds: number;
  transcriptsReceived: number;
  aiAnalysed: number;
  pendingAi: number;
  matchedLeads: number;
  unmatchedOrAmbiguous: number;
  followUpNeeded: number;
  instructionIntent: number;
  anyObjection: number;
  hasPositiveSignal: number;
  priceConcerns: number;
  uspMentions: number;
  op1Calls: number;
}

export interface CallAgentDailyBreakdown {
  agentUserId?: string;
  agentName: string;
  agentExtension?: string;
  totalCalls: number;
  answeredCalls: number;
  voicemailCalls: number;
  missedAbandonedCalls: number;
  outboundCalls: number;
  outboundAnsweredCalls: number;
  outboundVoicemailCalls: number;
  outboundAnswerRate: number;
  uniqueLeadsAttempted: number;
  uniqueLeadsContacted: number;
  contactRate: number;
  officialInstructions: number;
  contactToInstructionRate: number;
  inboundHotCalls: number;
  outboundAttempt1Calls: number;
  outboundAttempt2Calls: number;
  outboundAttempt3PlusCalls: number;
  outboundAttemptsPerLead: number;
  averageFirstOutboundDelaySeconds: number;
  op1Calls: number;
  followUpNeeded: number;
  instructionIntent: number;
  anyObjection: number;
  positiveSignals: number;
  crmInstructions: number;
  callToInstructionRate: number;
}

export interface CallSignalBreakdown {
  signalType: string;
  signalValue: string;
  callsCount: number;
}

export interface CallAnalysisRow {
  id: string;
  threecxCallId: string;
  leadId?: string;
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadOwnerId?: string;
  leadOwnerName?: string;
  direction?: string;
  callerNumber?: string;
  calledNumber?: string;
  normalizedPhone?: string;
  agentExtension?: string;
  agentUserId?: string;
  agentName?: string;
  startedAt?: string;
  durationSeconds?: number;
  callStatus?: string;
  transcriptAvailable: boolean;
  transcript?: string;
  cdrSummary?: string;
  cdrCallType?: string;
  recordingReference?: string;
  matchStatus: 'matched' | 'unmatched' | 'ambiguous';
  matchReason?: string;
  aiAnalysisStatus: 'not_analyzed' | 'analyzing' | 'completed' | 'failed';
  reviewStatus: 'pending_review' | 'reviewed' | 'ignored';
  reviewNote?: string;
  reviewedAt?: string;
  reviewedByName?: string;
  manualLinkedAt?: string;
  manualLinkedByName?: string;
  manualLinkReason?: string;
  analysisId?: string;
  summary?: string;
  callType?: string;
  outcome?: string;
  objections: string[];
  tags: string[];
  knockBackReason?: string;
  rejectionReason?: string;
  positiveSignals: string[];
  uspMentioned?: boolean;
  priceConcern?: boolean;
  instructionIntent?: boolean;
  followUpRequired?: boolean;
  followUpReason?: string;
  recommendedAction?: string;
  managerRiskFlags: string[];
  confidence?: number;
  voicemailDetected?: boolean;
  meaningfulConversation?: boolean;
  objectionCategory?: string;
  confidenceReason?: string;
  isExternalClientCall?: boolean;
  isOutboundSalesCall?: boolean;
  isOutboundAnswered?: boolean;
  isOutboundVoicemail?: boolean;
  isInboundHotCall?: boolean;
  isPossibleHotCall?: boolean;
  outboundAttemptNumber?: number;
  outboundAttemptBucket?: string;
  anyObjection?: boolean;
  hasPositiveSignal?: boolean;
  isOfficialInstruction?: boolean;
  totalCount: number;
}

export interface CallAnalysisExportRow {
  callId: string;
  leadId?: string;
  leadName?: string;
  phone?: string;
  agent?: string;
  leadOwner?: string;
  callTime?: string;
  direction?: string;
  durationSeconds?: number;
  status?: string;
  transcriptStatus?: string;
  aiStatus?: string;
  matchStatus?: string;
  reviewStatus?: string;
  reviewNote?: string;
  manualLinkedAt?: string;
  manualLinkedByName?: string;
  manualLinkReason?: string;
  cdrCallType?: string;
  cdrSummary?: string;
  recordingReference?: string;
  callType?: string;
  outcome?: string;
  summary?: string;
  objections?: string;
  tags?: string;
  knockBackReason?: string;
  rejectionReason?: string;
  positiveSignals?: string;
  uspMentioned?: boolean;
  priceConcern?: boolean;
  followUpNeeded?: boolean;
  followUpReason?: string;
  recommendedAction?: string;
  instructionIntent?: boolean;
  confidence?: number;
  confidenceReason?: string;
  voicemailFlag?: boolean;
  meaningfulConversation?: boolean;
  objectionCategory?: string;
  anyObjection?: boolean;
  externalClientCall?: boolean;
  outboundSalesCall?: boolean;
  outboundAnswered?: boolean;
  outboundAttemptNumber?: number;
  outboundAttemptBucket?: string;
  inboundHotCall?: boolean;
  possibleHotCall?: boolean;
  uniqueContactClassification?: string;
  officialInstruction?: boolean;
  reviewedAt?: string;
  totalCount: number;
  exportLimit: number;
}

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  return [];
};

const normalizeExtension = (extension: string) => extension.trim();

const blankToNull = <T,>(value: T | null | undefined) => {
  if (typeof value === 'string') return value.trim() === '' || value === 'all' ? null : value;
  return value ?? null;
};

const toRpcCallAnalysisFilters = (filters: CallAnalysisFilters) => ({
  p_start_date: filters.startDate,
  p_end_date: filters.endDate,
  p_agent_user_id: blankToNull(filters.agentUserId),
  p_direction: blankToNull(filters.direction),
  p_call_status: blankToNull(filters.callStatus),
  p_transcript_status: blankToNull(filters.transcriptStatus),
  p_ai_status: blankToNull(filters.aiStatus),
  p_match_status: blankToNull(filters.matchStatus),
  p_call_type: blankToNull(filters.callType),
  p_follow_up_needed: filters.followUpNeeded ?? null,
  p_review_status: blankToNull(filters.reviewStatus),
});

function transformExtensionMapping(row: any): ThreeCxExtensionMapping {
  return {
    id: row.id,
    extension: row.extension,
    userId: row.user_id || undefined,
    userName: row.user_name || undefined,
    isActive: !!row.is_active,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function transformCallRecord(row: any): CrmCallRecord {
  return {
    id: row.id,
    threecxCallId: row.threecx_call_id,
    leadId: row.lead_id || undefined,
    direction: row.direction || undefined,
    callerNumber: row.caller_number || undefined,
    calledNumber: row.called_number || undefined,
    agentExtension: row.agent_extension || undefined,
    agentUserId: row.agent_user_id || undefined,
    agentName: row.agent_name || undefined,
    queueName: row.queue_name || undefined,
    startedAt: row.started_at || undefined,
    answeredAt: row.answered_at || undefined,
    endedAt: row.ended_at || undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    callStatus: row.call_status || undefined,
    transcript: row.transcript || undefined,
    transcriptAvailable: !!row.transcript_available,
    cdrSummary: row.cdr_summary || undefined,
    cdrCallType: row.cdr_call_type || undefined,
    recordingReference: row.recording_reference || undefined,
    matchStatus: row.match_status || 'unmatched',
    matchConfidence: row.match_confidence || 0,
    matchReason: row.match_reason || undefined,
    aiAnalysisStatus: row.ai_analysis_status || 'not_analyzed',
    latestAiAnalysisId: row.latest_ai_analysis_id || undefined,
    reviewStatus: row.review_status || 'reviewed',
    reviewNote: row.review_note || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedByName: row.reviewed_by_name || undefined,
    manualLinkedAt: row.manual_linked_at || undefined,
    manualLinkedByName: row.manual_linked_by_name || undefined,
    manualLinkReason: row.manual_link_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformAnalysis(row: any): CrmCallAiAnalysis {
  return {
    id: row.id,
    callRecordId: row.call_record_id,
    leadId: row.lead_id || undefined,
    analysisStatus: row.analysis_status || 'completed',
    summary: row.summary || undefined,
    callType: row.call_type || undefined,
    outcome: row.outcome || undefined,
    clientPosition: row.client_position || undefined,
    objections: toArray(row.objections),
    tags: toArray(row.tags),
    knockBackReason: row.knock_back_reason || undefined,
    rejectionReason: row.rejection_reason || undefined,
    positiveSignals: toArray(row.positive_signals),
    uspMentioned: row.usp_mentioned ?? undefined,
    priceConcern: row.price_concern ?? undefined,
    instructionIntent: row.instruction_intent ?? undefined,
    followUpRequired: row.follow_up_required ?? undefined,
    followUpReason: row.follow_up_reason || undefined,
    recommendedAction: row.recommended_action || undefined,
    agentNotes: row.agent_notes || undefined,
    managerRiskFlags: toArray(row.manager_risk_flags),
    confidence: row.confidence == null ? undefined : Number(row.confidence),
    voicemailDetected: row.voicemail_detected ?? undefined,
    meaningfulConversation: row.meaningful_conversation ?? undefined,
    objectionCategory: row.objection_category || undefined,
    confidenceReason: row.confidence_reason || undefined,
    promptVersion: row.prompt_version || undefined,
    model: row.model || undefined,
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    createdAt: row.created_at,
  };
}

function transformCallAnalysisRow(row: any): CallAnalysisRow {
  return {
    id: row.id,
    threecxCallId: row.threecx_call_id,
    leadId: row.lead_id || undefined,
    leadName: row.lead_name || undefined,
    leadEmail: row.lead_email || undefined,
    leadPhone: row.lead_phone || undefined,
    leadOwnerId: row.lead_owner_id || undefined,
    leadOwnerName: row.lead_owner_name || undefined,
    direction: row.direction || undefined,
    callerNumber: row.caller_number || undefined,
    calledNumber: row.called_number || undefined,
    normalizedPhone: row.normalized_phone || undefined,
    agentExtension: row.agent_extension || undefined,
    agentUserId: row.agent_user_id || undefined,
    agentName: row.agent_name || undefined,
    startedAt: row.started_at || undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    callStatus: row.call_status || undefined,
    transcriptAvailable: !!row.transcript_available,
    transcript: row.transcript || undefined,
    cdrSummary: row.cdr_summary || undefined,
    cdrCallType: row.cdr_call_type || undefined,
    recordingReference: row.recording_reference || undefined,
    matchStatus: row.match_status || 'unmatched',
    matchReason: row.match_reason || undefined,
    aiAnalysisStatus: row.ai_analysis_status || 'not_analyzed',
    reviewStatus: row.review_status || 'reviewed',
    reviewNote: row.review_note || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewedByName: row.reviewed_by_name || undefined,
    manualLinkedAt: row.manual_linked_at || undefined,
    manualLinkedByName: row.manual_linked_by_name || undefined,
    manualLinkReason: row.manual_link_reason || undefined,
    analysisId: row.analysis_id || undefined,
    summary: row.summary || undefined,
    callType: row.call_type || undefined,
    outcome: row.outcome || undefined,
    objections: toArray(row.objections),
    tags: toArray(row.tags),
    knockBackReason: row.knock_back_reason || undefined,
    rejectionReason: row.rejection_reason || undefined,
    positiveSignals: toArray(row.positive_signals),
    uspMentioned: row.usp_mentioned ?? undefined,
    priceConcern: row.price_concern ?? undefined,
    instructionIntent: row.instruction_intent ?? undefined,
    followUpRequired: row.follow_up_required ?? undefined,
    followUpReason: row.follow_up_reason || undefined,
    recommendedAction: row.recommended_action || undefined,
    managerRiskFlags: toArray(row.manager_risk_flags),
    confidence: row.confidence == null ? undefined : Number(row.confidence),
    voicemailDetected: row.voicemail_detected ?? undefined,
    meaningfulConversation: row.meaningful_conversation ?? undefined,
    objectionCategory: row.objection_category || undefined,
    confidenceReason: row.confidence_reason || undefined,
    isExternalClientCall: row.is_external_client_call ?? undefined,
    isOutboundSalesCall: row.is_outbound_sales_call ?? undefined,
    isOutboundAnswered: row.is_outbound_answered ?? undefined,
    isOutboundVoicemail: row.is_outbound_voicemail ?? undefined,
    isInboundHotCall: row.is_inbound_hot_call ?? undefined,
    isPossibleHotCall: row.is_possible_hot_call ?? undefined,
    outboundAttemptNumber: row.outbound_attempt_number ?? undefined,
    outboundAttemptBucket: row.outbound_attempt_bucket || undefined,
    anyObjection: row.any_objection ?? undefined,
    hasPositiveSignal: row.has_positive_signal ?? undefined,
    isOfficialInstruction: row.is_official_instruction ?? undefined,
    totalCount: Number(row.total_count || 0),
  };
}

export async function fetchLeadCallRecords(leadId: string): Promise<CrmCallRecord[]> {
  const { data, error } = await supabase
    .from('crm_call_records')
    .select('*')
    .eq('lead_id', leadId)
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching 3CX call records:', error);
    throw error;
  }

  return (data || []).map(transformCallRecord);
}

export async function fetchCallAnalyses(callRecordIds: string[]): Promise<CrmCallAiAnalysis[]> {
  const ids = Array.from(new Set(callRecordIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('crm_call_ai_analysis')
    .select('*')
    .in('call_record_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching 3CX call analysis:', error);
    throw error;
  }

  return (data || []).map(transformAnalysis);
}

export async function fetchCallAnalysisSummary(filters: CallAnalysisFilters): Promise<CallAnalysisSummary> {
  const { data, error } = await supabase.rpc('get_call_analysis_summary', toRpcCallAnalysisFilters(filters));

  if (error) {
    console.error('Call analysis summary RPC error:', error);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalCalls: Number(row?.total_calls || 0),
    transcriptsReceived: Number(row?.transcripts_received || 0),
    aiAnalysed: Number(row?.ai_analysed || 0),
    pendingAi: Number(row?.pending_ai || 0),
    failedAi: Number(row?.failed_ai || 0),
    matchedLeads: Number(row?.matched_leads || 0),
    needsReview: Number(row?.needs_review || 0),
    voicemails: Number(row?.voicemails || 0),
    followUpNeeded: Number(row?.follow_up_needed || 0),
    instructionIntent: Number(row?.instruction_intent || 0),
    outboundCalls: Number(row?.outbound_calls || 0),
    outboundAnswered: Number(row?.outbound_answered || row?.outbound_answered_calls || 0),
    outboundVoicemail: Number(row?.outbound_voicemail || row?.outbound_voicemail_calls || 0),
    inboundHotCalls: Number(row?.inbound_hot_calls || 0),
    possibleHotCalls: Number(row?.possible_hot_calls || 0),
    anyObjection: Number(row?.any_objection || 0),
    officialInstructions: Number(row?.official_instructions || 0),
  };
}

export async function fetchCallAnalysisRows(
  filters: CallAnalysisFilters,
  page: number,
  pageSize: number
): Promise<{ rows: CallAnalysisRow[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('get_call_analysis_rows', {
    ...toRpcCallAnalysisFilters(filters),
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error('Call analysis rows RPC error:', error);
    throw error;
  }

  const rows = (data || []).map(transformCallAnalysisRow);
  return {
    rows,
    totalCount: rows[0]?.totalCount || 0,
  };
}

export async function fetchCallAnalysisExportRows(
  filters: CallAnalysisFilters,
  limit = 10000
): Promise<{ rows: CallAnalysisExportRow[]; totalCount: number; exportLimit: number; isCapped: boolean }> {
  const requestedLimit = Math.min(Math.max(limit, 1), 10000);
  const { data, error } = await supabase.rpc('get_call_analysis_export', {
    ...toRpcCallAnalysisFilters(filters),
    p_limit: requestedLimit,
  });

  if (error) {
    console.error('Call analysis export RPC error:', error);
    throw error;
  }

  const rows = (data || []).map((row: any): CallAnalysisExportRow => ({
    callId: row.call_id,
    leadId: row.lead_id || undefined,
    leadName: row.lead_name || undefined,
    phone: row.phone || undefined,
    agent: row.agent || undefined,
    leadOwner: row.lead_owner || undefined,
    callTime: row.call_time || undefined,
    direction: row.direction || undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status || undefined,
    transcriptStatus: row.transcript_status || undefined,
    aiStatus: row.ai_status || undefined,
    matchStatus: row.match_status || undefined,
    reviewStatus: row.review_status || undefined,
    reviewNote: row.review_note || undefined,
    manualLinkedAt: row.manual_linked_at || undefined,
    manualLinkedByName: row.manual_linked_by_name || undefined,
    manualLinkReason: row.manual_link_reason || undefined,
    cdrCallType: row.cdr_call_type || undefined,
    cdrSummary: row.cdr_summary || undefined,
    recordingReference: row.recording_reference || undefined,
    callType: row.call_type || undefined,
    outcome: row.outcome || undefined,
    summary: row.summary || undefined,
    objections: row.objections || undefined,
    tags: row.tags || undefined,
    knockBackReason: row.knock_back_reason || undefined,
    rejectionReason: row.rejection_reason || undefined,
    positiveSignals: row.positive_signals || undefined,
    uspMentioned: row.usp_mentioned ?? undefined,
    priceConcern: row.price_concern ?? undefined,
    followUpNeeded: row.follow_up_needed ?? undefined,
    followUpReason: row.follow_up_reason || undefined,
    recommendedAction: row.recommended_action || undefined,
    instructionIntent: row.instruction_intent ?? undefined,
    confidence: row.confidence == null ? undefined : Number(row.confidence),
    confidenceReason: row.confidence_reason || undefined,
    voicemailFlag: row.voicemail_flag ?? undefined,
    meaningfulConversation: row.meaningful_conversation ?? undefined,
    objectionCategory: row.objection_category || undefined,
    anyObjection: row.any_objection ?? undefined,
    externalClientCall: row.external_client_call ?? undefined,
    outboundSalesCall: row.outbound_sales_call ?? undefined,
    outboundAnswered: row.outbound_answered ?? undefined,
    outboundAttemptNumber: row.outbound_attempt_number ?? undefined,
    outboundAttemptBucket: row.outbound_attempt_bucket || undefined,
    inboundHotCall: row.inbound_hot_call ?? undefined,
    possibleHotCall: row.possible_hot_call ?? undefined,
    uniqueContactClassification: row.unique_contact_classification || undefined,
    officialInstruction: row.official_instruction ?? undefined,
    reviewedAt: row.reviewed_at || undefined,
    totalCount: Number(row.total_count || 0),
    exportLimit: Number(row.export_limit || requestedLimit),
  }));

  const totalCount = rows[0]?.totalCount || 0;
  const exportLimit = rows[0]?.exportLimit || requestedLimit;
  return {
    rows,
    totalCount,
    exportLimit,
    isCapped: totalCount > exportLimit,
  };
}

const mapDailyOverview = (row: any): CallDailyOverview => ({
  totalCalls: Number(row?.total_calls || 0),
  answeredCalls: Number(row?.answered_calls || 0),
  voicemailCalls: Number(row?.voicemail_calls || 0),
  missedAbandonedCalls: Number(row?.missed_abandoned_calls || 0),
  outboundCalls: Number(row?.outbound_calls ?? row?.total_calls ?? 0),
  outboundAnsweredCalls: Number(row?.outbound_answered_calls ?? row?.answered_calls ?? 0),
  outboundVoicemailCalls: Number(row?.outbound_voicemail_calls ?? row?.voicemail_calls ?? 0),
  outboundAnswerRate: Number(row?.outbound_answer_rate || 0),
  uniqueLeadsAttempted: Number(row?.unique_leads_attempted || 0),
  uniqueLeadsContacted: Number(row?.unique_leads_contacted || 0),
  contactRate: Number(row?.contact_rate || 0),
  officialInstructions: Number(row?.official_instructions || 0),
  contactToInstructionRate: Number(row?.contact_to_instruction_rate || 0),
  outboundAttempt1Calls: Number(row?.outbound_attempt_1_calls || row?.op1_calls || 0),
  outboundAttempt2Calls: Number(row?.outbound_attempt_2_calls || 0),
  outboundAttempt3PlusCalls: Number(row?.outbound_attempt_3_plus_calls || 0),
  inboundHotCalls: Number(row?.inbound_hot_calls || 0),
  possibleHotCalls: Number(row?.possible_hot_calls || 0),
  outboundAttemptsPerLead: Number(row?.outbound_attempts_per_lead || 0),
  averageFirstOutboundDelaySeconds: Number(row?.average_first_outbound_delay_seconds || 0),
  averageDurationSeconds: Number(row?.average_duration_seconds || 0),
  transcriptsReceived: Number(row?.transcripts_received || 0),
  aiAnalysed: Number(row?.ai_analysed || 0),
  pendingAi: Number(row?.pending_ai || 0),
  matchedLeads: Number(row?.matched_leads || 0),
  unmatchedOrAmbiguous: Number(row?.unmatched_or_ambiguous || 0),
  followUpNeeded: Number(row?.follow_up_needed || 0),
  instructionIntent: Number(row?.instruction_intent || 0),
  anyObjection: Number(row?.any_objection || 0),
  hasPositiveSignal: Number(row?.has_positive_signal || 0),
  priceConcerns: Number(row?.price_concerns || 0),
  uspMentions: Number(row?.usp_mentions || 0),
  op1Calls: Number(row?.op1_calls || 0),
});

export async function fetchCallDailyOverview(filters: CallAnalysisFilters): Promise<CallDailyOverview> {
  const { data, error } = await supabase.rpc('get_call_daily_overview', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_agent_user_id: blankToNull(filters.agentUserId),
  });

  if (error) {
    console.error('Call daily overview RPC error:', error);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapDailyOverview(row);
}

export async function fetchCallAgentDailyBreakdown(filters: CallAnalysisFilters): Promise<CallAgentDailyBreakdown[]> {
  const { data, error } = await supabase.rpc('get_call_agent_daily_breakdown', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
  });

  if (error) {
    console.error('Call agent daily breakdown RPC error:', error);
    throw error;
  }

  const agentFilter = blankToNull(filters.agentUserId);
  return (data || [])
    .filter((row: any) => !agentFilter || row.agent_user_id === agentFilter)
    .map((row: any): CallAgentDailyBreakdown => ({
      agentUserId: row.agent_user_id || undefined,
      agentName: row.agent_name || row.agent_extension || 'Unmapped',
      agentExtension: row.agent_extension || undefined,
      totalCalls: Number(row.total_calls || 0),
      answeredCalls: Number(row.answered_calls || 0),
      voicemailCalls: Number(row.voicemail_calls || 0),
      missedAbandonedCalls: Number(row.missed_abandoned_calls || 0),
      outboundCalls: Number(row.outbound_calls ?? row.total_calls ?? 0),
      outboundAnsweredCalls: Number(row.outbound_answered_calls ?? row.answered_calls ?? 0),
      outboundVoicemailCalls: Number(row.outbound_voicemail_calls ?? row.voicemail_calls ?? 0),
      outboundAnswerRate: Number(row.outbound_answer_rate || 0),
      uniqueLeadsAttempted: Number(row.unique_leads_attempted || 0),
      uniqueLeadsContacted: Number(row.unique_leads_contacted || 0),
      contactRate: Number(row.contact_rate || 0),
      officialInstructions: Number(row.official_instructions || row.crm_instructions || 0),
      contactToInstructionRate: Number(row.contact_to_instruction_rate || row.call_to_instruction_rate || 0),
      inboundHotCalls: Number(row.inbound_hot_calls || 0),
      outboundAttempt1Calls: Number(row.outbound_attempt_1_calls || row.op1_calls || 0),
      outboundAttempt2Calls: Number(row.outbound_attempt_2_calls || 0),
      outboundAttempt3PlusCalls: Number(row.outbound_attempt_3_plus_calls || 0),
      outboundAttemptsPerLead: Number(row.outbound_attempts_per_lead || 0),
      averageFirstOutboundDelaySeconds: Number(row.average_first_outbound_delay_seconds || 0),
      op1Calls: Number(row.op1_calls || 0),
      followUpNeeded: Number(row.follow_up_needed || 0),
      instructionIntent: Number(row.instruction_intent || 0),
      anyObjection: Number(row.any_objection || 0),
      positiveSignals: Number(row.positive_signals || 0),
      crmInstructions: Number(row.crm_instructions || 0),
      callToInstructionRate: Number(row.call_to_instruction_rate || 0),
    }));
}

export async function fetchCallSignalBreakdowns(filters: CallAnalysisFilters): Promise<CallSignalBreakdown[]> {
  const { data, error } = await supabase.rpc('get_call_signal_breakdowns', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_agent_user_id: blankToNull(filters.agentUserId),
  });

  if (error) {
    console.error('Call signal breakdown RPC error:', error);
    throw error;
  }

  return (data || []).map((row: any): CallSignalBreakdown => ({
    signalType: row.signal_type || 'Signal',
    signalValue: row.signal_value || 'Not specified',
    callsCount: Number(row.calls_count || 0),
  }));
}

// --- Call Analysis visibility extras (per-rep quality/sentiment, hourly volume,
// callback load, objection handling). AI-derived in production; same RPC contracts. ---

export interface CallRepQuality {
  agentUserId?: string;
  agentName: string;
  excellent: number;
  good: number;
  meetsFloor: number;
  belowFloor: number;
  sentimentScore: number;
  conversionRate: number;
  coachingTrend: number[];
}

export interface CallHourlyVolume {
  hour: number;
  inbound: number;
  outbound: number;
}

export interface CallScheduleLoadDay {
  label: string;
  count: number;
  tone?: 'good' | 'warn' | 'bad';
}

export type ObjectionHandlingQuality = 'STRONG' | 'ADEQUATE' | 'WEAK';
export type ClientReaction = 'positive' | 'neutral' | 'pushed_back';

export interface CallObjectionInstance {
  rep: string;
  client: string;
  quality: ObjectionHandlingQuality;
  clientSaid: string;
  repReplied: string;
  reaction: ClientReaction;
  date?: string;
}

export interface CallObjectionCategory {
  category: string;
  count: number;
  strong: number;
  adequate: number;
  weak: number;
  quote?: string;
  instances: CallObjectionInstance[];
}

export async function fetchCallRepQuality(filters: CallAnalysisFilters): Promise<CallRepQuality[]> {
  const { data, error } = await supabase.rpc('get_call_rep_quality', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
  });
  if (error) {
    console.error('Call rep quality RPC error:', error);
    throw error;
  }
  return (data || []).map((row: any): CallRepQuality => ({
    agentUserId: row.agent_user_id || undefined,
    agentName: row.agent_name || row.agent_extension || 'Unmapped',
    excellent: Number(row.excellent || 0),
    good: Number(row.good || 0),
    meetsFloor: Number(row.meets_floor || 0),
    belowFloor: Number(row.below_floor || 0),
    sentimentScore: Number(row.sentiment_score || 0),
    conversionRate: Number(row.conversion_rate || 0),
    coachingTrend: Array.isArray(row.coaching_trend) ? row.coaching_trend.map((v: any) => Number(v)) : [],
  }));
}

export async function fetchCallHourlyVolume(filters: CallAnalysisFilters): Promise<CallHourlyVolume[]> {
  const { data, error } = await supabase.rpc('get_call_hourly_volume', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_agent_user_id: blankToNull(filters.agentUserId),
  });
  if (error) {
    console.error('Call hourly volume RPC error:', error);
    throw error;
  }
  return (data || []).map((row: any): CallHourlyVolume => ({
    hour: Number(row.hour || 0),
    inbound: Number(row.inbound || 0),
    outbound: Number(row.outbound || 0),
  }));
}

export async function fetchCallScheduleLoad(filters: CallAnalysisFilters): Promise<CallScheduleLoadDay[]> {
  const { data, error } = await supabase.rpc('get_call_schedule_load', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
  });
  if (error) {
    console.error('Call schedule load RPC error:', error);
    throw error;
  }
  return (data || []).map((row: any): CallScheduleLoadDay => ({
    label: row.label || '',
    count: Number(row.count || 0),
    tone: row.tone || undefined,
  }));
}

export async function fetchCallObjectionHandling(filters: CallAnalysisFilters): Promise<CallObjectionCategory[]> {
  const { data, error } = await supabase.rpc('get_call_objection_handling', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_agent_user_id: blankToNull(filters.agentUserId),
  });
  if (error) {
    console.error('Call objection handling RPC error:', error);
    throw error;
  }
  return (data || []).map((row: any): CallObjectionCategory => ({
    category: row.category || 'Other',
    count: Number(row.count || 0),
    strong: Number(row.strong || 0),
    adequate: Number(row.adequate || 0),
    weak: Number(row.weak || 0),
    quote: row.quote || undefined,
    instances: Array.isArray(row.instances)
      ? row.instances.map((x: any): CallObjectionInstance => ({
          rep: x.rep || 'Unknown',
          client: x.client || '',
          quality: x.quality || 'ADEQUATE',
          clientSaid: x.client_said || x.clientSaid || '',
          repReplied: x.rep_replied || x.repReplied || '',
          reaction: x.reaction || 'neutral',
          date: x.date || undefined,
        }))
      : [],
  }));
}

export async function markCallRecordReviewed(callRecordId: string, reviewedBy: { id: string; name: string }): Promise<void> {
  const { error } = await supabase.rpc('set_call_record_review_status', {
    p_call_record_id: callRecordId,
    p_review_status: 'reviewed',
    p_reviewed_by: reviewedBy.id,
    p_reviewed_by_name: reviewedBy.name,
    p_review_note: null,
  });

  if (error) {
    console.error('Error marking call record reviewed:', error);
    throw error;
  }
}

export async function setCallRecordReviewStatus(
  callRecordId: string,
  status: 'pending_review' | 'reviewed' | 'ignored',
  reviewedBy: { id: string; name: string },
  note?: string
): Promise<void> {
  const { error } = await supabase.rpc('set_call_record_review_status', {
    p_call_record_id: callRecordId,
    p_review_status: status,
    p_reviewed_by: reviewedBy.id,
    p_reviewed_by_name: reviewedBy.name,
    p_review_note: note || null,
  });

  if (error) {
    console.error('Error updating call review status:', error);
    throw error;
  }
}

export async function linkCallRecordToLead(params: {
  callRecordId: string;
  leadId: string;
  linkedBy: { id: string; name: string };
  reason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('link_call_record_to_lead', {
    p_call_record_id: params.callRecordId,
    p_lead_id: params.leadId,
    p_linked_by: params.linkedBy.id,
    p_linked_by_name: params.linkedBy.name,
    p_reason: params.reason || null,
  });

  if (error) {
    console.error('Error linking call record to lead:', error);
    throw error;
  }
}

export async function fetchThreeCxExtensionMappings(): Promise<ThreeCxExtensionMapping[]> {
  const { data, error } = await supabase
    .from('threecx_extension_mappings')
    .select('*')
    .eq('is_active', true)
    .order('extension', { ascending: true });

  if (error) {
    console.error('Error fetching 3CX extension mappings:', error);
    throw error;
  }

  return (data || []).map(transformExtensionMapping);
}

export async function saveUserThreeCxExtension(userId: string, userName: string, extension: string): Promise<void> {
  const normalizedExtension = normalizeExtension(extension);

  if (normalizedExtension && !/^\d{1,10}$/.test(normalizedExtension)) {
    throw new Error('3CX extension must be numeric and up to 10 digits.');
  }

  const { data: existingUserMappings, error: existingUserError } = await supabase
    .from('threecx_extension_mappings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (existingUserError) {
    console.error('Error checking current 3CX extension mapping:', existingUserError);
    throw existingUserError;
  }

  if (!normalizedExtension) {
    if ((existingUserMappings || []).length > 0) {
      const { error: clearError } = await supabase
        .from('threecx_extension_mappings')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (clearError) {
        console.error('Error clearing 3CX extension mapping:', clearError);
        throw clearError;
      }
    }
    return;
  }

  const { data: existingExtension, error: existingExtensionError } = await supabase
    .from('threecx_extension_mappings')
    .select('*')
    .eq('extension', normalizedExtension)
    .maybeSingle();

  if (existingExtensionError) {
    console.error('Error checking 3CX extension uniqueness:', existingExtensionError);
    throw existingExtensionError;
  }

  if (existingExtension?.is_active && existingExtension?.user_id && existingExtension.user_id !== userId) {
    throw new Error(`3CX extension ${normalizedExtension} is already assigned to ${existingExtension.user_name || 'another user'}.`);
  }

  const staleMappings = (existingUserMappings || []).filter(mapping => mapping.extension !== normalizedExtension);
  if (staleMappings.length > 0) {
    const { error: deactivateError } = await supabase
      .from('threecx_extension_mappings')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('extension', normalizedExtension);

    if (deactivateError) {
      console.error('Error deactivating old 3CX extension mapping:', deactivateError);
      throw deactivateError;
    }
  }

  const payload = {
    extension: normalizedExtension,
    user_id: userId,
    user_name: userName,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existingExtension?.id) {
    const { error: updateError } = await supabase
      .from('threecx_extension_mappings')
      .update(payload)
      .eq('id', existingExtension.id);

    if (updateError) {
      console.error('Error updating 3CX extension mapping:', updateError);
      throw updateError;
    }
    return;
  }

  const { error: insertError } = await supabase
    .from('threecx_extension_mappings')
    .insert(payload);

  if (insertError) {
    console.error('Error creating 3CX extension mapping:', insertError);
    throw insertError;
  }
}

export async function analyzeThreeCxCall(callRecordId: string): Promise<CrmCallAiAnalysis> {
  const { data, error } = await supabase.functions.invoke('threecx-analyze-call', {
    body: { callRecordId },
  });

  if (error) {
    console.error('3CX call analysis function error:', error);
    throw new Error(error.message || 'Failed to analyze call');
  }

  if (!data?.success || !data.analysis) {
    throw new Error(data?.error || 'Failed to analyze call');
  }

  return transformAnalysis(data.analysis);
}

export async function fetchThreeCxCallSettings(): Promise<ThreeCxCallSettings> {
  const { data, error } = await supabase
    .from('threecx_call_settings')
    .select('auto_analyze_enabled, auto_analyze_limit, auto_analyze_min_duration_seconds, updated_at, updated_by_name')
    .eq('id', true)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return DEFAULT_THREECX_CALL_SETTINGS;
    }
    throw error;
  }

  if (!data) {
    return DEFAULT_THREECX_CALL_SETTINGS;
  }

  return {
    autoAnalyzeEnabled: data.auto_analyze_enabled !== false,
    autoAnalyzeLimit: Math.min(Math.max(Number(data.auto_analyze_limit || 300), 1), 300),
    autoAnalyzeMinDurationSeconds: Math.min(Math.max(Number(data.auto_analyze_min_duration_seconds ?? 20), 0), 600),
    updatedAt: data.updated_at || undefined,
    updatedByName: data.updated_by_name || undefined,
  };
}

export async function updateThreeCxCallSettings(settings: {
  autoAnalyzeEnabled: boolean;
  autoAnalyzeLimit: number;
  autoAnalyzeMinDurationSeconds?: number;
  updatedBy?: string;
  updatedByName?: string;
}): Promise<ThreeCxCallSettings> {
  const sanitizedLimit = Math.min(Math.max(Number(settings.autoAnalyzeLimit || 300), 1), 300);
  const sanitizedMinDuration = Math.min(Math.max(Number(settings.autoAnalyzeMinDurationSeconds ?? 20), 0), 600);
  const { data, error } = await supabase
    .from('threecx_call_settings')
    .upsert({
      id: true,
      auto_analyze_enabled: settings.autoAnalyzeEnabled,
      auto_analyze_limit: sanitizedLimit,
      auto_analyze_min_duration_seconds: sanitizedMinDuration,
      updated_by: settings.updatedBy || null,
      updated_by_name: settings.updatedByName || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('auto_analyze_enabled, auto_analyze_limit, auto_analyze_min_duration_seconds, updated_at, updated_by_name')
    .single();

  if (error) throw error;

  return {
    autoAnalyzeEnabled: data.auto_analyze_enabled !== false,
    autoAnalyzeLimit: Math.min(Math.max(Number(data.auto_analyze_limit || 300), 1), 300),
    autoAnalyzeMinDurationSeconds: Math.min(Math.max(Number(data.auto_analyze_min_duration_seconds ?? 20), 0), 600),
    updatedAt: data.updated_at || undefined,
    updatedByName: data.updated_by_name || undefined,
  };
}

export async function runThreeCxCdrProcessor(params: {
  limit?: number;
  offset?: number;
  retryFailed?: boolean;
  reprocess?: boolean;
  source?: 'auto' | 'cdroutput' | 'custom' | 'recordings';
  autoAnalyze?: boolean;
  autoAnalyzeLimit?: number;
  analysisOnly?: boolean;
  forceAutoAnalyze?: boolean;
  startedFrom?: string;
  startedTo?: string;
} = {}) {
  const { data, error } = await supabase.functions.invoke('threecx-process-cdr', {
    body: {
      limit: params.limit || 100,
      offset: params.offset || 0,
      retryFailed: !!params.retryFailed,
      reprocess: !!params.reprocess,
      source: params.source || 'auto',
      autoAnalyze: params.autoAnalyze,
      autoAnalyzeLimit: params.autoAnalyzeLimit,
      analysisOnly: !!params.analysisOnly,
      forceAutoAnalyze: !!params.forceAutoAnalyze,
      startedFrom: params.startedFrom,
      startedTo: params.startedTo,
    },
  });

  if (error) throw new Error(error.message || 'Failed to process 3CX CDR rows');
  if (!data?.success) throw new Error(data?.error || 'Failed to process 3CX CDR rows');
  return data as {
    success: true;
    source?: string;
    processed: number;
    failed: number;
    unmatched: number;
    offset?: number;
    startedWindow?: {
      startedFrom?: string | null;
      startedTo?: string | null;
    };
    autoAnalysis?: {
      processed?: number;
      failed?: number;
      skipped?: number;
      limit?: number;
      configuredLimit?: number;
      enabled?: boolean;
      error?: string;
    };
    results: Array<Record<string, unknown>>;
  };
}

export async function sendThreeCxTestWebhook(secret: string) {
  const { data, error } = await supabase.functions.invoke('threecx-call-start', {
    headers: { 'x-threecx-secret': secret },
    body: {
      testMode: true,
      callId: `TEST-${Date.now()}`,
      callerNumber: '07000000000',
      calledNumber: '02000000000',
      direction: 'inbound',
      agentExtension: '100',
      agentName: '3CX Test',
      startedAt: new Date().toISOString(),
    },
  });

  if (error) throw new Error(error.message || '3CX test webhook failed');
  if (!data?.success) throw new Error(data?.error || '3CX test webhook failed');
  return data;
}

export interface ThreeCxStatus {
  latestWebhookAt?: string;
  latestCdrImportAt?: string;
  latestProcessAt?: string;
  pendingCdrRows: number;
  failedCdrRows: number;
  unmatchedCalls: number;
  ambiguousCalls: number;
  reviewQueueCalls: number;
  totalCalls: number;
  aiBacklog: number;
  aiBacklogTotal: number;
  aiBelowMinDurationCalls: number;
  aiMinDurationSeconds: number;
  failedAiCalls: number;
  failedAiTotal: number;
  failedAiBelowMinDurationCalls: number;
  latestAiSync?: {
    status: string;
    rowsReceived: number;
    rowsProcessed: number;
    rowsFailed: number;
    errorMessage?: string;
    createdAt: string;
  };
  latestSync?: {
    syncType: string;
    status: string;
    rowsReceived: number;
    rowsProcessed: number;
    rowsFailed: number;
    rowsUnmatched: number;
    errorMessage?: string;
    createdAt: string;
  };
}

function latestIso(...values: Array<string | undefined | null>) {
  const timestamps = values
    .map((value) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? { value, time } : null;
    })
    .filter((item): item is { value: string; time: number } => Boolean(item))
    .sort((a, b) => b.time - a.time);

  return timestamps[0]?.value;
}

const MISSING_TABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);

async function latestTableTimestamp(table: string, column: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .order(column, { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!MISSING_TABLE_ERROR_CODES.has(error.code)) {
      console.warn(`3CX status ${table}.${column} lookup failed:`, error);
    }
    return undefined;
  }

  return (data as Record<string, string | null> | null)?.[column] || undefined;
}

export async function fetchThreeCxStatus(): Promise<ThreeCxStatus> {
  const callSettings = await fetchThreeCxCallSettings().catch(() => DEFAULT_THREECX_CALL_SETTINGS);
  const minDurationSeconds = callSettings.autoAnalyzeMinDurationSeconds;
  const countAiCandidates = async (
    statuses: Array<'not_analyzed' | 'failed'>,
    durationMode: 'all' | 'eligible' | 'below_min' = 'eligible'
  ) => {
    if (durationMode === 'below_min' && minDurationSeconds <= 0) {
      return { count: 0, error: null };
    }

    let query = supabase
      .from('crm_call_records')
      .select('id', { count: 'exact', head: true })
      .eq('transcript_available', true)
      .in('ai_analysis_status', statuses);

    if (durationMode === 'eligible' && minDurationSeconds > 0) {
      query = query.gte('duration_seconds', minDurationSeconds);
    } else if (durationMode === 'below_min') {
      query = query.or(`duration_seconds.lt.${minDurationSeconds},duration_seconds.is.null`);
    }

    return query;
  };

  const [
    latestWebhook,
    latestCdr,
    latestSync,
    pendingCount,
    failedCount,
    unmatchedCount,
    ambiguousCount,
    reviewQueueCount,
    totalCallsCount,
    aiBacklogCount,
    aiBacklogTotalCount,
    aiBelowMinDurationCount,
    failedAiCount,
    failedAiTotalCount,
    failedAiBelowMinDurationCount,
    latestAiSync,
    latestCallRecordCreated,
    latestCdrOutputStarted,
    latestRecordingStarted,
  ] = await Promise.all([
    supabase.from('threecx_call_events').select('received_at').order('received_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('threecx_cdr_imports').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('threecx_sync_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('threecx_cdr_imports').select('id', { count: 'exact', head: true }).eq('processing_status', 'pending'),
    supabase.from('threecx_cdr_imports').select('id', { count: 'exact', head: true }).eq('processing_status', 'failed'),
    supabase.from('crm_call_records').select('id', { count: 'exact', head: true }).eq('match_status', 'unmatched'),
    supabase.from('crm_call_records').select('id', { count: 'exact', head: true }).eq('match_status', 'ambiguous'),
    supabase.from('crm_call_records').select('id', { count: 'exact', head: true }).or('review_status.eq.pending_review,match_status.in.(unmatched,ambiguous),ai_analysis_status.eq.failed').neq('review_status', 'ignored'),
    supabase.from('crm_call_records').select('id', { count: 'exact', head: true }),
    countAiCandidates(['not_analyzed', 'failed'], 'eligible'),
    countAiCandidates(['not_analyzed', 'failed'], 'all'),
    countAiCandidates(['not_analyzed', 'failed'], 'below_min'),
    countAiCandidates(['failed'], 'eligible'),
    countAiCandidates(['failed'], 'all'),
    countAiCandidates(['failed'], 'below_min'),
    supabase.from('threecx_sync_runs').select('*').eq('sync_type', 'ai_analysis').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    latestTableTimestamp('crm_call_records', 'created_at'),
    latestTableTimestamp('cdroutput', 'cdr_started_at'),
    latestTableTimestamp('recordings', 'start_time'),
  ]);

  const firstError = [
    latestWebhook.error,
    latestCdr.error,
    latestSync.error,
    pendingCount.error,
    failedCount.error,
    unmatchedCount.error,
    ambiguousCount.error,
    reviewQueueCount.error,
    totalCallsCount.error,
    aiBacklogCount.error,
    aiBacklogTotalCount.error,
    aiBelowMinDurationCount.error,
    failedAiCount.error,
    failedAiTotalCount.error,
    failedAiBelowMinDurationCount.error,
    latestAiSync.error,
  ].find(Boolean);

  if (firstError) {
    console.error('Error fetching 3CX status:', firstError);
    throw firstError;
  }

  return {
    latestWebhookAt: latestWebhook.data?.received_at || undefined,
    latestCdrImportAt: latestIso(
      latestCdr.data?.created_at,
      latestCallRecordCreated,
      latestCdrOutputStarted,
      latestRecordingStarted,
      latestSync.data?.rows_received > 0 ? (latestSync.data?.completed_at || latestSync.data?.created_at) : undefined
    ),
    latestProcessAt: latestSync.data?.completed_at || latestSync.data?.created_at || undefined,
    pendingCdrRows: pendingCount.count || 0,
    failedCdrRows: failedCount.count || 0,
    unmatchedCalls: unmatchedCount.count || 0,
    ambiguousCalls: ambiguousCount.count || 0,
    reviewQueueCalls: reviewQueueCount.count || 0,
    totalCalls: totalCallsCount.count || 0,
    aiBacklog: aiBacklogCount.count || 0,
    aiBacklogTotal: aiBacklogTotalCount.count || 0,
    aiBelowMinDurationCalls: aiBelowMinDurationCount.count || 0,
    aiMinDurationSeconds: minDurationSeconds,
    failedAiCalls: failedAiCount.count || 0,
    failedAiTotal: failedAiTotalCount.count || 0,
    failedAiBelowMinDurationCalls: failedAiBelowMinDurationCount.count || 0,
    latestAiSync: latestAiSync.data
      ? {
          status: latestAiSync.data.status,
          rowsReceived: latestAiSync.data.rows_received || 0,
          rowsProcessed: latestAiSync.data.rows_processed || 0,
          rowsFailed: latestAiSync.data.rows_failed || 0,
          errorMessage: latestAiSync.data.error_message || undefined,
          createdAt: latestAiSync.data.created_at,
        }
      : undefined,
    latestSync: latestSync.data
      ? {
          syncType: latestSync.data.sync_type,
          status: latestSync.data.status,
          rowsReceived: latestSync.data.rows_received || 0,
          rowsProcessed: latestSync.data.rows_processed || 0,
          rowsFailed: latestSync.data.rows_failed || 0,
          rowsUnmatched: latestSync.data.rows_unmatched || 0,
          errorMessage: latestSync.data.error_message || undefined,
          createdAt: latestSync.data.created_at,
        }
      : undefined,
  };
}
