// Lead resale — selling surplus / out-of-area / unconverted / declined leads to partner
// firms as a new revenue line: admin pipeline (available → offered → sold → delivered →
// paid), buyers, sellable inventory, sold-by-type, and resale revenue trend. In ty this
// reads consented-sellable leads + buyer accounts + resale deals; here, the mock.
// NOTE: only leads consented at capture to be shared with partners are sellable (GDPR).

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface ResaleBuyer { name: string; leadsBought: number; spend: number; avgPrice: number; rating: string; status: string; }

export interface LeadResale {
  kpis: MktKpi[];
  pipeline: { label: string; count: number }[];
  inventory: { label: string; count: number }[];
  buyers: ResaleBuyer[];
  byType: { label: string; count: number }[];
  revenueTrend: { labels: string[]; values: number[] };
  note: string;
}

export async function fetchLeadResale(): Promise<LeadResale> {
  const { data, error } = await supabase.rpc('get_lead_resale', {});
  if (error) { console.error('Lead resale RPC error:', error); throw error; }
  return data as LeadResale;
}

export interface ResaleQueueLead {
  id: string; ref: string; initials: string; reason: string; region: string; matter: string;
  value: number; freshnessHrs: number; quality: number; consent: boolean; price: number;
  exclusivity: string; matchedBuyers: string[];
}
export interface ResaleQueue {
  buckets: { key: string; label: string; count: number }[];
  leads: ResaleQueueLead[];
}

export async function fetchResaleQueue(): Promise<ResaleQueue> {
  const { data, error } = await supabase.rpc('get_resale_queue', {});
  if (error) { console.error('Resale queue RPC error:', error); throw error; }
  return data as ResaleQueue;
}
