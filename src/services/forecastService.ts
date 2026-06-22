// Forecast — lead-volume, instruction and pre-instruction value projections with confidence bands
// (trailing run-rate × seasonal index). In ty this fits a simple seasonal model over the
// trailing series; here, the mock. Each series has actual (history) + forecast + a
// lower/upper band, overlapping by one point at the last actual.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface ForecastSeries {
  labels: string[];
  actual: (number | null)[];
  forecast: (number | null)[];
  lower: (number | null)[];
  upper: (number | null)[];
}

export interface ForecastBridgeStage {
  label: string;
  current: number;
  forecast: number;
  conversion: number;
  risk: 'low' | 'medium' | 'high';
  note: string;
}

export interface ForecastRegion {
  key: string;
  label: string;
  area: string;
  x: number;
  y: number;
  leads: number;
  forecastLeads: number;
  forecastInstructions: number;
  capacity: number;
  conversion: number;
  avgFee: number;
  topSource: string;
  marketSignal: string;
  confidence: number;
  action: string;
}

export interface ForecastSource {
  source: string;
  currentLeads: number;
  forecastLeads: number;
  expectedInstructions: number;
  conversion: number;
  costPerInstruction: number;
  confidence: number;
  action: string;
}

export interface ForecastCapacity {
  team: string;
  owner: string;
  currentCases: number;
  forecastCases: number;
  capacity: number;
  risk: 'low' | 'medium' | 'high';
  action: string;
}

export interface ForecastExternalSignal {
  label: string;
  value: string;
  source: string;
  impact: string;
  action: string;
  tone: 'good' | 'warn' | 'bad' | 'info';
}

export interface ForecastScenario {
  label: string;
  leadDelta: number;
  instructions: number;
  revenue: number;
  completionRisk: number;
  capacityGap: number;
  note: string;
}

export interface ForecastMatterMix {
  type: string;
  forecastLeads: number;
  expectedInstructions: number;
  avgFee: number;
  capacityRisk: 'low' | 'medium' | 'high';
}

export interface ForecastAction {
  title: string;
  detail: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Forecast {
  kpis: MktKpi[];
  instructions: ForecastSeries;
  revenue: ForecastSeries;
  leadVolume: ForecastSeries;
  bridge: ForecastBridgeStage[];
  regions: ForecastRegion[];
  sources: ForecastSource[];
  capacity: ForecastCapacity[];
  externalSignals: ForecastExternalSignal[];
  scenarios: ForecastScenario[];
  matterMix: ForecastMatterMix[];
  actions: ForecastAction[];
  note: string;
}

export async function fetchForecast(): Promise<Forecast> {
  const { data, error } = await supabase.rpc('get_forecast', {});
  if (error) { console.error('Forecast RPC error:', error); throw error; }
  return data as Forecast;
}
