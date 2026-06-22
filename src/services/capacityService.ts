// Capacity & workload — demand vs capacity over time, caseload per fee-earner vs their
// cap, and the bottleneck stage. In ty this composes open-matter counts per fee-earner +
// configured caps + weekly new-matter vs completion throughput; here, the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface Capacity {
  kpis: MktKpi[];
  byFeeEarner: { label: string; count: number }[];
  demandVsCapacity: { labels: string[]; demand: number[]; capacity: number[] };
  bottlenecks: { label: string; count: number }[];
  note: string;
}

export async function fetchCapacity(): Promise<Capacity> {
  const { data, error } = await supabase.rpc('get_capacity', {});
  if (error) { console.error('Capacity RPC error:', error); throw error; }
  return data as Capacity;
}
