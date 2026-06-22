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

export interface DaySignal {
  key: string;
  label: string;
  count: number;
  prev: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
  good: boolean;
  spark: number[];
  tone: HubTone;
  icon: 'clock' | 'alert' | 'phone' | 'userCheck' | 'fileText' | 'checkCircle';
  href: string;
}
export interface CallsToday {
  made: number;
  answered: number;
  answerRate: number;
  instructionIntent: number;
  byHour: { hour: string; calls: number }[];
}
export interface DayFlow {
  labels: string[];
  instructions: number[];
  leads: number[];
  quotesAccepted: number[];
}
export interface PeakHours {
  hours: string[];
  leads: number[];
  instructions: number[];
  calls: number[];
  leadPeak: string;
  instructionPeak: string;
  callPeak: string;
}
export interface LeadOriginLookup {
  lead: string;
  leadId: string;
  ip: string;
  city: string;
  source: string;
  transaction: string;
  status: string;
  createdAt: string;
}
export interface LeadOriginRegion {
  key: string;
  label: string;
  area: string;
  x: number;
  y: number;
  leads: number;
  quotes: number;
  instructions: number;
  hot: number;
  avgFee: number;
  source: string;
  transaction: string;
  confidence: number;
  bestWindow: string;
  sample: LeadOriginLookup[];
}
export interface LeadOriginAnalytics {
  updatedAt: string;
  mappedPct: number;
  note: string;
  regions: LeadOriginRegion[];
}
export interface DailyPipeline {
  hero: HeroStat[];
  signals: DaySignal[];
  calls: CallsToday;
  flow: DayFlow;
  peakHours: PeakHours;
  leadOrigins: LeadOriginAnalytics;
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

export interface FirmAnalytics {
  kpis: MoneyKpi[];
  lifecycle: { label: string; count: number; color: string }[];
  temperature: { total: number; segments: { label: string; count: number; color: string }[] };
  sentiment: { label: string; count: number; tone: HubTone }[];
  objections: { label: string; count: number; quote?: string }[];
  questions: { label: string; count: number; quote?: string }[];
  capture: { label: string; pct: number }[];
  commitments: { action: string; total: number; kept: number; broken: number; active: number }[];
  lostReasons: { label: string; count: number }[];
  closeDrivers: { label: string; count: number }[];
  followups: { label: string; count: number; tone: HubTone }[];
  phrases: { rep: string; text: string }[];
  leads: {
    bySource: { label: string; count: number }[];
    byTransaction: { total: number; segments: { label: string; count: number; color: string }[] };
    ageDistribution: { label: string; count: number }[];
    conversionBySource: { label: string; pct: number }[];
    disqualified: { label: string; count: number }[];
  };
}

// Firm-wide analytics aggregate. In ty this rolls up leads, calls (3CX + AI), quotes,
// instructions, and activity into the firm dashboard lenses.
export async function fetchFirmAnalytics(): Promise<FirmAnalytics> {
  const { data, error } = await supabase.rpc('get_firm_analytics', {});
  if (error) {
    console.error('Firm analytics RPC error:', error);
    throw error;
  }
  return data as FirmAnalytics;
}

export interface TrendMomentum {
  key: string;
  label: string;
  value: string;
  deltaPct: number;
  direction: 'up' | 'down' | 'flat';
  good: boolean;
  spark: number[];
}
export interface TrendWeeklyBar {
  label: string;
  value: number;
  target?: number;
}
export interface FirmTrends {
  range: string;
  labels: string[];
  series: {
    leads: number[];
    calls: number[];
    instructions: number[];
    revenue: number[];
    conversion: number[];
  };
  momentum: TrendMomentum[];
  weeklyInstructions: TrendWeeklyBar[];
  weeklyRevenue: TrendWeeklyBar[];
}

// Firm-wide momentum over time. In ty this rolls up daily history (leads, calls, 3CX,
// instructions, payments) into time series; here it hits the FIRM_TRENDS mock.
export async function fetchFirmTrends(): Promise<FirmTrends> {
  const { data, error } = await supabase.rpc('get_firm_trends', {});
  if (error) {
    console.error('Firm trends RPC error:', error);
    throw error;
  }
  return data as FirmTrends;
}
