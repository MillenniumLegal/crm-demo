// Client experience — NPS/CSAT, update cadence vs promise, review funnel, referrals/repeat,
// and open complaints. In ty this composes survey responses + portal update logs + review
// requests + the complaints register; here, the mock. Reuses MktKpi.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface ClientComplaint { client: string; issue: string; age: string; severity: 'high' | 'med' | 'low'; }

export interface ClientExperience {
  kpis: MktKpi[];
  npsTrend: { labels: string[]; values: number[] };
  reviewFunnel: { label: string; count: number }[];
  cadence: { label: string; count: number }[];
  referrals: { label: string; count: number }[];
  complaints: ClientComplaint[];
}

export async function fetchClientExperience(): Promise<ClientExperience> {
  const { data, error } = await supabase.rpc('get_client_experience', {});
  if (error) { console.error('Client experience RPC error:', error); throw error; }
  return data as ClientExperience;
}
