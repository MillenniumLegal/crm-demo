// Call-intelligence SOW gaps — CRM-vs-3CX call verification, inbound calls overview
// (IVR Option 1 vs Option 3), callback→conversion funnel, and the per-agent "my day"
// dashboard. In ty these compose 3CX call records + CRM marking + IVR option + callback
// lifecycle + per-agent breakdown; here they read mocks. Reuses Marketing MktKpi shape.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface VerificationAgent {
  agent: string; marked: number; verified: number; markedNoMatch: number; foundNotMarked: number; mismatch: number; verificationRate: number;
}
export interface CallVerification { range: string; agents: VerificationAgent[]; note: string; }
export interface InboundOverview {
  kpis: MktKpi[];
  optionSplit: { option1: number; option3: number };
  outcome: { label: string; count: number }[];
  byHour: { hour: string; calls: number }[];
}
export interface CallbackFunnel { range: string; stages: { label: string; count: number }[]; winRate: number; }
export interface AgentDay {
  agent: string; date: string;
  tiles: { label: string; value: string }[];
  coaching: { tone: 'good' | 'warn' | 'bad'; text: string }[];
  actions: string[];
}

async function rpc<T>(name: string): Promise<T> {
  const { data, error } = await supabase.rpc(name, {});
  if (error) { console.error(name + ' RPC error:', error); throw error; }
  return data as T;
}

export const fetchCallVerification = () => rpc<CallVerification>('get_call_verification');
export const fetchInboundOverview = () => rpc<InboundOverview>('get_inbound_overview');
export const fetchCallbackFunnel = () => rpc<CallbackFunnel>('get_callback_funnel');
export const fetchAgentDay = () => rpc<AgentDay>('get_agent_day');
