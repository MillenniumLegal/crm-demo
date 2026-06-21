// Reps-tab hero: a premium team-coaching gauge + 7-day trend + supporting stats.
// Pure presentation over CallAgentDailyBreakdown + the transparent coaching score.

import React from 'react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { formatDelay, formatNumber } from './format';
import { computeCoachingScore } from './coaching';
import { RadialScoreGauge } from './RadialScoreGauge';
import { MiniTrend } from './MiniTrend';

interface TeamHeadlineStripProps {
  agents: CallAgentDailyBreakdown[];
  avgConversion?: number;
  repTrends?: number[][];
}

export const TeamHeadlineStrip: React.FC<TeamHeadlineStripProps> = ({ agents, avgConversion, repTrends }) => {
  const scored = agents.map((a) => ({ a, score: computeCoachingScore(a).score }));
  const qualifying = scored.filter((s) => s.a.outboundCalls >= 20);
  const pool = qualifying.length ? qualifying : scored;
  const avg = pool.length ? Math.round(pool.reduce((s, x) => s + x.score, 0) / pool.length) : 0;
  const top = pool.slice().sort((x, y) => y.score - x.score)[0];
  const needsCoaching = pool.filter((s) => s.score < 55).length;
  const totalInstr = agents.reduce((s, a) => s + a.officialInstructions, 0);
  const totalCalls = agents.reduce((s, a) => s + a.outboundCalls, 0);
  const weightedSpeed = totalCalls
    ? Math.round(agents.reduce((s, a) => s + a.averageFirstOutboundDelaySeconds * a.outboundCalls, 0) / totalCalls)
    : 0;

  // Team coaching trend = per-day average across rep trends.
  const trends = (repTrends || []).filter((t) => t && t.length > 1);
  const teamTrend = trends.length
    ? Array.from({ length: Math.min(...trends.map((t) => t.length)) }, (_, i) =>
        Math.round(trends.reduce((s, t) => s + t[i], 0) / trends.length))
    : [];

  const tiles: { label: string; value: string; sub: string; valueClass?: string }[] = [
    { label: 'Top performer', value: top ? top.a.agentName.split(' ')[0] : '—', sub: top ? `${top.score} pts` : '' },
    { label: 'Needs coaching', value: String(needsCoaching), sub: needsCoaching === 1 ? 'rep below bar' : 'reps below bar', valueClass: needsCoaching > 0 ? 'text-red-700' : 'text-green-700' },
    { label: 'Avg speed to lead', value: formatDelay(weightedSpeed), sub: 'to first dial' },
    { label: 'Instructions', value: formatNumber(totalInstr), sub: avgConversion != null ? `${avgConversion}% conversion` : 'won' },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3 shadow-sm">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">Team coaching</p>
        <RadialScoreGauge score={avg} />
        {teamTrend.length > 1 && <MiniTrend values={teamTrend} showDelta className="mt-1" />}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{t.label}</p>
            <p className={`mt-1 text-2xl font-bold leading-none tabular-nums ${t.valueClass || 'text-gray-900'}`}>{t.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
