// Revenue boost — money on the table: recovery opportunities (accepted-not-instructed,
// aged invoices, abandoned/expired quotes), revenue at risk (fall-through, overdue
// completions), upsell/repeat, and WIP/lockup aging. In ty this composes quotes +
// instructions + invoices + matters; here it reads the REVENUE_OPPORTUNITIES mock.

import { supabase } from '@/lib/supabase';

export interface Opportunity {
  label: string; count: number; value: number; action?: string; note?: string; tone?: 'good' | 'warn' | 'bad';
}

export interface RevenueOpportunities {
  summary: { recoverable: number; atRisk: number; lockupDays: number; lockupTarget: number };
  recovery: Opportunity[];
  atRisk: Opportunity[];
  upsell: Opportunity[];
  wip: { label: string; value: number }[];
}

export async function fetchRevenueOpportunities(): Promise<RevenueOpportunities> {
  const { data, error } = await supabase.rpc('get_revenue_opportunities', {});
  if (error) { console.error('Revenue opportunities RPC error:', error); throw error; }
  return data as RevenueOpportunities;
}
