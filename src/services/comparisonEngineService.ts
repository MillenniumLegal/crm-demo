// Comparison engine intelligence — per-site performance, the quote-engine funnel, and
// where users abandon (get stuck), with a this-period-vs-prior submissions trend. In ty
// this aggregates comparison_leads + engine step events by site; here it reads the
// COMPARISON_ENGINE mock.

import { supabase } from '@/lib/supabase';

export interface EngineSite {
  site: string; started: number; submitted: number; callbacks: number; instructions: number;
  conversion: number; avgQuote: number; deltaPct: number;
}
export interface EngineStuckStep { step: string; count: number; pct: number; }

export interface ComparisonEngine {
  range: string;
  topSite: string;
  sites: EngineSite[];
  funnel: { label: string; count: number }[];
  stuck: EngineStuckStep[];
  trend: { labels: string[]; current: number[]; prior: number[] };
  note: string;
}

export async function fetchComparisonEngine(): Promise<ComparisonEngine> {
  const { data, error } = await supabase.rpc('get_comparison_engine', {});
  if (error) {
    console.error('Comparison engine RPC error:', error);
    throw error;
  }
  return data as ComparisonEngine;
}
