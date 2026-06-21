// Hub aggregates — Daily Pipeline (agent worklist) + Finance overview. In ty these
// RPCs roll up tasks/callbacks/quotas and quotes/payments; here they hit mock data.

import { supabase } from '@/lib/supabase';

export type HubTone = 'good' | 'warn' | 'bad' | 'info';

export interface HeroStat {
  key: string;
  label: string;
  value: string;
  tone: HubTone;
  href?: string;
}

export interface WorklistItem {
  lead: string;
  meta: string;
  note?: string;
  tone?: HubTone;
}

export interface DailyPipeline {
  hero: HeroStat[];
  tasks: WorklistItem[];
  callbacks: WorklistItem[];
  quoteResponses: WorklistItem[];
}

export async function fetchDailyPipeline(): Promise<DailyPipeline> {
  const { data, error } = await supabase.rpc('get_daily_pipeline', {});
  if (error) {
    console.error('Daily pipeline RPC error:', error);
    throw error;
  }
  return data as DailyPipeline;
}

export interface MoneyKpi {
  label: string;
  value: string;
  sub: string;
  tone: HubTone;
}

export interface MoneyRow {
  name: string;
  amount: number;
  status: string;
  when: string;
}

export interface AgingBucket {
  bucket: string;
  amount: number;
  tone: 'good' | 'warn' | 'bad';
}

export interface FinanceOverview {
  kpis: MoneyKpi[];
  recentQuotes: MoneyRow[];
  recentInvoices: MoneyRow[];
  aging: AgingBucket[];
}

export async function fetchFinanceOverview(): Promise<FinanceOverview> {
  const { data, error } = await supabase.rpc('get_finance_overview', {});
  if (error) {
    console.error('Finance overview RPC error:', error);
    throw error;
  }
  return data as FinanceOverview;
}

export type MatterStatus = 'on_track' | 'needs_action' | 'stalled';
export interface Matter {
  client: string;
  ref: string;
  txn: string;
  value: number;
  stage: number; // index into stages
  status: MatterStatus;
  days: number;
  next: string;
  firm: string;
}
export interface MattersData {
  stats: HeroStat[];
  stages: string[];
  distribution: { stage: string; count: number }[];
  matters: Matter[];
}

// Post-instruction case tracking. In ty this is sourced from Hoowla (the conveyancing
// case system); the CRM only mirrors live status for visibility.
export async function fetchMatters(): Promise<MattersData> {
  const { data, error } = await supabase.rpc('get_matters', {});
  if (error) {
    console.error('Matters RPC error:', error);
    throw error;
  }
  return data as MattersData;
}
