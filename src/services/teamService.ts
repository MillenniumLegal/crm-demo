// Team performance aggregate — per-agent roll-up for the Team hub. In ty this RPC
// composes the call breakdown, AI rep quality (sentiment/coaching), instructions, and
// quotas into one per-agent object; here it hits the TEAM_PERFORMANCE mock.

import { supabase } from '@/lib/supabase';
import { TrendMomentum } from '@/services/hubsService';

export interface TeamAgent {
  id: string;
  name: string;
  initials: string;
  rank: number;
  score: number;
  scoreTrend: number[];
  scoreDelta: number;
  conversion: number;
  sentiment: number;
  callsMade: number;
  answerRate: number;
  instructions: number;
  coaching: number;
  quotaUsed: number;
  quotaTarget: number;
  status: 'top' | 'steady' | 'watch';
  highlight?: string;
  connect: number;
  convert: number;
  quality: number;
  speedToLeadH: number;
  coachingNote: string;
}

export interface TeamPerformance {
  range: string;
  teamMomentum: TrendMomentum[];
  agents: TeamAgent[];
  conversionByAgent: { label: string; count: number }[];
  coachingByAgent: { label: string; count: number }[];
}

export async function fetchTeamPerformance(): Promise<TeamPerformance> {
  const { data, error } = await supabase.rpc('get_team_performance', {});
  if (error) {
    console.error('Team performance RPC error:', error);
    throw error;
  }
  return data as TeamPerformance;
}
