// Best time to call — day×hour timing intelligence keyed on pickup rate (connected/calls),
// filterable by window, with per-hour and per-day pickup aggregates plus the best and
// busiest hour. In ty this aggregates 3CX call attempts + answered legs by weekday/hour
// over the selected window; here, the mock.

import { supabase } from '@/lib/supabase';

export interface TimingCell { calls: number; connected: number; pickup: number; }
export interface TimingDayRow { day: string; cells: TimingCell[]; }
export interface TimingHourStat { hour: string; pickup: number; calls: number; }
export interface TimingDayStat { day: string; pickup: number; calls: number; }

export interface TimingRange {
  hours: string[];
  grid: TimingDayRow[];
  pickupByHour: TimingHourStat[];
  pickupByDay: TimingDayStat[];
  bestHour: TimingHourStat;
  busiestHour: TimingHourStat;
}

export interface Timing {
  days: string[];
  bestWindow: string;
  note: string;
  byRange: Record<string, TimingRange>;
}

export async function fetchTiming(): Promise<Timing> {
  const { data, error } = await supabase.rpc('get_timing', {});
  if (error) { console.error('Timing RPC error:', error); throw error; }
  return data as Timing;
}
