// Call insights — AI conversation analytics: analysed calls grouped into clickable signals
// (topic / impact / objection / blocker / guidance); each signal carries the calls behind
// it (agent, lead, date, the exact words, an AI note), a trend, and conversion impact.
// In ty this reads the call-transcript analysis tables; here, the mock. Reuses MktKpi.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface SignalCall { agent: string; lead: string; date: string; quote: string; note?: string; }
export interface SignalItem {
  key: string; label: string; count: number; calls: number;
  sentiment?: number; conversion?: { withPct: number; otherPct: number };
  trend: number[]; sample: SignalCall[];
}
export interface SignalGroupData {
  key: string; title: string; caption: string; tone?: 'good' | 'warn' | 'bad' | 'navy'; items: SignalItem[];
}
export interface CallInsights {
  kpis: MktKpi[];
  withWho: { label: string; count: number }[];
  howLanded: { label: string; count: number }[];
  groups: SignalGroupData[];
}

export async function fetchCallInsights(): Promise<CallInsights> {
  const { data, error } = await supabase.rpc('get_call_insights', {});
  if (error) { console.error('Call insights RPC error:', error); throw error; }
  return data as CallInsights;
}
