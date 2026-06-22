// Lead analytics — the "Leads" analytics view: where leads sit, how they feel, what they
// push back on (worst-handled first, with handling quality), client questions, follow-up
// outcomes, qualification capture, standout phrases. Each signal opens a rich drill-down
// (handling breakdown + client-said / rep-replied / client-reaction). In ty this reads the
// lead + call-analysis tables; here, the mock. Shares the SignalItem shape with Call Insights.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export type Handling = 'strong' | 'adequate' | 'weak' | 'missed';
export interface LASignalCall {
  agent: string; lead: string; date: string;
  quote?: string; note?: string;
  clientSaid?: string; repReplied?: string; clientReaction?: string; handling?: Handling;
}
export interface LASignalItem {
  key: string; label: string; count: number; calls: number;
  sentiment?: number; conversion?: { withPct: number; otherPct: number };
  handling?: { strong: number; adequate: number; weak: number; missed: number };
  handledWellPct?: number;
  trend: number[]; sample: LASignalCall[];
}
export interface LASignalGroup {
  key: string; title: string; caption: string; tone?: 'good' | 'warn' | 'bad' | 'navy'; items: LASignalItem[];
}
export interface LeadAnalytics {
  kpis: MktKpi[];
  lifecycle: { label: string; count: number }[];
  qualificationCapture: { label: string; count: number }[];
  groups: LASignalGroup[];
  standoutPhrases: { agent: string; lead: string; date: string; quote: string }[];
}

export async function fetchLeadAnalytics(): Promise<LeadAnalytics> {
  const { data, error } = await supabase.rpc('get_lead_analytics', {});
  if (error) { console.error('Lead analytics RPC error:', error); throw error; }
  return data as LeadAnalytics;
}
