// Lead enrichment — who leads really are: domain reverse-lookup → company + job + seniority,
// UK region spread, email-domain mix, decision-maker signals. In ty this calls an enrichment
// provider (Clearbit/Apollo-style) on the lead's email/domain + IP geolocation; here, the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface EnrichedLead {
  name: string; domain: string; company: string; jobTitle: string; seniority: string;
  region: string; propertyValue: number; signal: 'high' | 'med' | 'low';
}

export interface LeadEnrichment {
  kpis: MktKpi[];
  byRegion: { label: string; count: number }[];
  bySeniority: { label: string; count: number }[];
  byJob: { label: string; count: number }[];
  bySourceDomain: { label: string; count: number }[];
  matchTrend: { labels: string[]; values: number[] };
  leads: EnrichedLead[];
  note: string;
}

export async function fetchLeadEnrichment(): Promise<LeadEnrichment> {
  const { data, error } = await supabase.rpc('get_lead_enrichment', {});
  if (error) { console.error('Lead enrichment RPC error:', error); throw error; }
  return data as LeadEnrichment;
}
