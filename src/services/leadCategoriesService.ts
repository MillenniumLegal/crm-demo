// Lead categories — the in-depth "what category a lead is", derived from call voice (the
// call-voice taxonomy). Reuses the SignalGroup/SignalItem shapes from Lead Analytics; each
// category's drill-down shows the verbatim words that triggered it + the routing. In ty the
// categoriser tags each lead from its call transcripts; here, the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';
import { LASignalGroup } from '@/services/leadAnalyticsService';

export interface LeadCategories {
  kpis: MktKpi[];
  groups: LASignalGroup[];
}

export async function fetchLeadCategories(): Promise<LeadCategories> {
  const { data, error } = await supabase.rpc('get_lead_categories', {});
  if (error) { console.error('Lead categories RPC error:', error); throw error; }
  return data as LeadCategories;
}
