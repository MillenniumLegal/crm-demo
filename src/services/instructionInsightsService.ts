// Instruction-report trends + period-over-period comparison — the "compare with the past"
// layer on top of the snapshot Instructions report: KPIs vs prior period, instructions
// over time (this period vs prior), the SOW Sale/Purchase/Both unit split, and source
// movers. In ty this aggregates instruction marks over the date range vs the preceding
// equal-length window; here it reads the INSTRUCTION_INSIGHTS mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface InstructionInsights {
  range: string;
  kpis: MktKpi[];
  trend: { labels: string[]; current: number[]; prior: number[] };
  unitSplit: { label: string; count: number }[];
  sourceMovers: { label: string; now: number; prev: number; deltaPct: number }[];
}

export async function fetchInstructionInsights(): Promise<InstructionInsights> {
  const { data, error } = await supabase.rpc('get_instruction_insights', {});
  if (error) {
    console.error('Instruction insights RPC error:', error);
    throw error;
  }
  return data as InstructionInsights;
}
