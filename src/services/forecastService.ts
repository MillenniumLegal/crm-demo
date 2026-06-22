// Forecast — lead-volume, instruction and revenue projections with confidence bands
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

export interface Forecast {
  kpis: MktKpi[];
  instructions: ForecastSeries;
  revenue: ForecastSeries;
  leadVolume: ForecastSeries;
  note: string;
}

export async function fetchForecast(): Promise<Forecast> {
  const { data, error } = await supabase.rpc('get_forecast', {});
  if (error) { console.error('Forecast RPC error:', error); throw error; }
  return data as Forecast;
}
