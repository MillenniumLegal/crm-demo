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
