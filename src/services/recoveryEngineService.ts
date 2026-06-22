// Recovery Engine — old-lead revival, won-client referral outreach, contact
// reconstruction, AI drip/call telemetry and agent task allocation. In ty this
// will compose outcome-code cohorts, provider message logs, 3CX/AI call-agent
// events, tasks, suppression rules and lead history; here it reads the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export type RecoveryTone = 'good' | 'warn' | 'bad' | 'info';
export type RecoveryChannel = 'email' | 'sms' | 'call' | 'mixed';

export interface RecoveryLeadSample {
  leadId: string;
  lead: string;
  agent: string;
  date: string;
  trigger: string;
  outcome: string;
  aiDraft: string;
  nextAction: string;
  note: string;
  value: number;
}

export interface RecoveryCohort {
  key: string;
  label: string;
  reason: string;
  eligible: number;
  value: number;
  avgAgeDays: number;
  aiTouches: number;
  replyRate: number;
  conversionRate: number;
  risk: string;
  suppression: number;
  channel: RecoveryChannel;
  confidence: number;
  trend: number[];
  leads: RecoveryLeadSample[];
}

export interface RecoveryCampaign {
  key: string;
  name: string;
  channel: RecoveryChannel;
  status: 'approval' | 'running' | 'paused' | 'learning';
  sent: number;
  opened: number;
  replied: number;
  recovered: number;
  value: number;
  openRate: number;
  replyRate: number;
  conversionRate: number;
  cost: number;
  spark: number[];
}

export interface RecoveryReconstructionItem {
  key: string;
  leadId: string;
  lead: string;
  issue: string;
  original: string;
  proposal: string;
  signals: string[];
  confidence: number;
  status: 'needs approval' | 'agent notified' | 'queued' | 'suppressed';
  action: string;
  value: number;
  agent: string;
  trend: number[];
  note: string;
}

export interface RecoveryAgentQueue {
  agent: string;
  freeSlots: number;
  tasks: number;
  value: number;
  focus: string;
  channels: string;
  expectedRecovery: number;
  oldest: string;
}

export interface RecoveryAiCallMetric {
  label: string;
  count: number;
  rate: number;
  tone: RecoveryTone;
}

export interface RecoveryWonClient {
  leadId: string;
  client: string;
  completedAgo: string;
  opportunity: string;
  confidence: number;
  referralAsk: string;
  expectedValue: number;
  stage: string;
  agent: string;
}

export interface RecoveryScoreLead {
  leadId: string;
  lead: string;
  score: number;
  value: number;
  reason: string;
  lastSignal: string;
  contactConfidence: number;
  risk: 'low' | 'medium' | 'high';
  agent: string;
  nextBestAction: string;
  channel: RecoveryChannel;
  badges: string[];
  trend: number[];
}

export interface RecoveryLostReason {
  reason: string;
  count: number;
  value: number;
  replyRate: number;
  recoveredRate: number;
  topAction: string;
  trend: number[];
}

export interface RecoveryJourneyStep {
  label: string;
  at: string;
  status: 'done' | 'current' | 'blocked';
  note: string;
}

export interface RecoveryJourney {
  leadId: string;
  lead: string;
  stage: string;
  value: number;
  agent: string;
  steps: RecoveryJourneyStep[];
}

export interface RecoveryOutreachDraft {
  key: string;
  leadId: string;
  lead: string;
  channel: RecoveryChannel;
  campaign: string;
  variant: string;
  tone: string;
  risk: 'low' | 'medium' | 'high';
  expectedReplyRate: number;
  approvalStatus: 'ready' | 'needs review' | 'blocked' | 'running';
  subject?: string;
  body: string;
  guardrails: string[];
  value: number;
}

export interface RecoveryRiskSignal {
  key: string;
  label: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  detail: string;
  action: string;
}

export interface RecoveryForecastScenario {
  label: string;
  approvals: number;
  aiTouches: number;
  replies: number;
  recovered: number;
  value: number;
  confidence: number;
}

export interface RecoveryAgentPerformance {
  agent: string;
  recovered: number;
  value: number;
  approvalRate: number;
  handoverMins: number;
  missed: number;
  bestCohort: string;
  trend: number[];
}

export interface LifecycleOpportunity {
  key: string;
  label: string;
  stage: string;
  count: number;
  value: number;
  conversionRate: number;
  owner: string;
  nextAction: string;
  tone: RecoveryTone;
}

export interface ContactIntelligenceSignal {
  key: string;
  label: string;
  count: number;
  repaired: number;
  confidence: number;
  region: string;
  note: string;
}

export interface ContactIntelligenceRule {
  label: string;
  impact: string;
  action: string;
  tone: RecoveryTone;
}

export interface DormantLead {
  leadId: string;
  lead: string;
  bucket: string;
  ageDays: number;
  value: number;
  source: string;
  location: string;
  score: number;
  lastSignal: string;
  risk: 'low' | 'medium' | 'high';
  nextAction: string;
  agent: string;
}

export interface RecoveryFunnelStage {
  label: string;
  count: number;
}

export interface RecoveryAdvice {
  severity: 'high' | 'med' | 'low';
  title: string;
  text: string;
}

export interface RecoveryEngineData {
  range: string;
  kpis: MktKpi[];
  trendLabels: string[];
  trend: {
    eligible: number[];
    aiTouches: number[];
    replies: number[];
    recovered: number[];
  };
  funnel: RecoveryFunnelStage[];
  cohorts: RecoveryCohort[];
  campaigns: RecoveryCampaign[];
  reconstruction: RecoveryReconstructionItem[];
  agentQueue: RecoveryAgentQueue[];
  aiCalls: RecoveryAiCallMetric[];
  wonClients: RecoveryWonClient[];
  scores: RecoveryScoreLead[];
  lostReasons: RecoveryLostReason[];
  journeys: RecoveryJourney[];
  outreachDrafts: RecoveryOutreachDraft[];
  riskSignals: RecoveryRiskSignal[];
  forecastScenarios: RecoveryForecastScenario[];
  agentPerformance: RecoveryAgentPerformance[];
  lifecycle: LifecycleOpportunity[];
  contactIntelligence: {
    signals: ContactIntelligenceSignal[];
    rules: ContactIntelligenceRule[];
  };
  dormantVault: DormantLead[];
  advice: RecoveryAdvice[];
}

export async function fetchRecoveryEngine(): Promise<RecoveryEngineData> {
  const { data, error } = await supabase.rpc('get_recovery_engine', {});
  if (error) {
    console.error('Recovery engine RPC error:', error);
    throw error;
  }
  return data as RecoveryEngineData;
}
