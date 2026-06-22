// Finance insights — revenue trend, breakdown, KPIs vs prior, and the APCM AI finance
// coach (monthly target → pace-to-target + pushy advice). In ty this aggregates paid +
// billed fees by month and matter type and reads the firm's monthly target; here it reads
// the FINANCE_INSIGHTS mock. Reuses the Marketing MktKpi shape for the KPI strip.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface FinanceCoachData {
  mtdRevenue: number;
  workingDaysElapsed: number;
  workingDaysTotal: number;
  lastMonthRevenue: number;
  defaultTarget: number;
  acceptedNotInstructed: { count: number; value: number };
  watching: string[];
}

export interface FinanceInsights {
  month: string;
  kpis: MktKpi[];
  revenue6mo: { labels: string[]; values: number[] };
  byType: { label: string; count: number }[];
  coach: FinanceCoachData;
}

export async function fetchFinanceInsights(): Promise<FinanceInsights> {
  const { data, error } = await supabase.rpc('get_finance_insights', {});
  if (error) {
    console.error('Finance insights RPC error:', error);
    throw error;
  }
  return data as FinanceInsights;
}
