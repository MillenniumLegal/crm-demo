// Sales velocity — how fast deals move (stage durations, lead→instruction trend) and why
// they win or lose, plus conversion by lead age at first contact. In ty this aggregates
// stage-transition timestamps + win/loss outcome codes; here, the mock. Reuses MktKpi.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface SalesVelocity {
  kpis: MktKpi[];
  stageDays: { label: string; count: number }[];
  winReasons: { label: string; count: number }[];
  lossReasons: { label: string; count: number }[];
  conversionByAge: { label: string; count: number }[];
  velocityTrend: { labels: string[]; values: number[] };
}

export async function fetchSalesVelocity(): Promise<SalesVelocity> {
  const { data, error } = await supabase.rpc('get_sales_velocity', {});
  if (error) { console.error('Sales velocity RPC error:', error); throw error; }
  return data as SalesVelocity;
}
