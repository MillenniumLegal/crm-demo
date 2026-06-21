// Transparent per-rep coaching score (0–100) for Call Analysis.
//
// Built ONLY from per-rep metrics we already capture (get_call_agent_daily_breakdown),
// so it is fully auditable — the UI shows the three sub-scores as their own bars
// rather than a black-box number. Weighting mirrors the industry floor/ceiling/quality
// model: half the score is "can they get people on the phone and reach leads", a third
// is "do reached leads turn into instructions", a fifth is "do calls leave a positive
// signal rather than an unhandled objection".

import { CallAgentDailyBreakdown } from '@/services/threecxService';

export interface CoachingScore {
  score: number;   // 0–100 weighted composite
  connect: number; // 0–100  (weight 50%) answer + lead-contact rate
  convert: number; // 0–100  (weight 30%) reach→instruction, scaled to a 35% ceiling
  quality: number; // 0–100  (weight 20%) positive signals vs objections raised
}

// A rep converting ~35% of reached leads into instructions reads as full marks.
const CONVERT_CEILING = 35;
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

export function computeCoachingScore(a: CallAgentDailyBreakdown): CoachingScore {
  const connect = clamp100((a.outboundAnswerRate + a.contactRate) / 2);
  const convert = clamp100((a.contactToInstructionRate / CONVERT_CEILING) * 100);
  const signalBase = a.positiveSignals + a.anyObjection;
  const quality = signalBase > 0 ? clamp100((a.positiveSignals / signalBase) * 100) : 50;
  const score = Math.round(connect * 0.5 + convert * 0.3 + quality * 0.2);
  return {
    score,
    connect: Math.round(connect),
    convert: Math.round(convert),
    quality: Math.round(quality),
  };
}

export type CoachTone = 'good' | 'warn' | 'bad';

export const coachToneClasses: Record<CoachTone, { bar: string; text: string; dot: string; soft: string; ring: string }> = {
  good: { bar: 'bg-green-500', text: 'text-green-700', dot: 'bg-green-500', soft: 'bg-green-50', ring: 'ring-green-200' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-700', dot: 'bg-amber-500', soft: 'bg-amber-50', ring: 'ring-amber-200' },
  bad: { bar: 'bg-red-500', text: 'text-red-700', dot: 'bg-red-500', soft: 'bg-red-50', ring: 'ring-red-200' },
};

export function scoreTone(score: number): CoachTone {
  if (score >= 75) return 'good';
  if (score >= 55) return 'warn';
  return 'bad';
}

export function scoreBandLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Solid';
  return 'Needs coaching';
}

// Speed-to-lead traffic light (creation → first dial). Conveyancing leads cool
// fast: ≤3h green, ≤8h amber, slower red.
export function speedTone(seconds: number): CoachTone {
  if (!seconds || seconds <= 0) return 'warn';
  const hours = seconds / 3600;
  if (hours <= 3) return 'good';
  if (hours <= 8) return 'warn';
  return 'bad';
}
