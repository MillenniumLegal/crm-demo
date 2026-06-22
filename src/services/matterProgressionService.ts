// Matter / case progression — the post-instruction conveyancing pipeline: stages with
// time-in-stage vs benchmark, SLA breaches, exchange/completion key dates, and the
// fall-through trend. In ty this reads matter milestones + key dates; here, the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface MatterStage { label: string; count: number; medianDays: number; benchmarkDays: number; }
export interface SlaBreach { matter: string; stage: string; overdueDays: number; owner: string; }
export interface KeyDate { matter: string; event: string; when: string; rag: 'good' | 'amber' | 'bad'; }

export interface MatterProgression {
  range: string;
  kpis: MktKpi[];
  stages: MatterStage[];
  slaBreaches: SlaBreach[];
  keyDates: KeyDate[];
  fallThroughTrend: { labels: string[]; values: number[] };
  fallThroughByType: { label: string; count: number }[];
}

export async function fetchMatterProgression(): Promise<MatterProgression> {
  const { data, error } = await supabase.rpc('get_matter_progression', {});
  if (error) { console.error('Matter progression RPC error:', error); throw error; }
  return data as MatterProgression;
}
