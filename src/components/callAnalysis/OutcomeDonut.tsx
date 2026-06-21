// Outcome-mix donut: how calls ended (connected / voicemail / missed).
// Pure SVG, no chart lib — over CallDailyOverview totals we already aggregate.

import React from 'react';
import { CallDailyOverview } from '@/services/threecxService';
import { formatNumber } from './format';

interface OutcomeDonutProps {
  overview: CallDailyOverview;
}

const SEGMENTS: { key: string; label: string; color: string; pick: (o: CallDailyOverview) => number }[] = [
  { key: 'connected', label: 'Connected', color: '#22c55e', pick: (o) => o.answeredCalls },
  { key: 'voicemail', label: 'Voicemail', color: '#f59e0b', pick: (o) => o.voicemailCalls },
  { key: 'missed', label: 'Missed / abandoned', color: '#ef4444', pick: (o) => o.missedAbandonedCalls },
];

export const OutcomeDonut: React.FC<OutcomeDonutProps> = ({ overview }) => {
  const parts = SEGMENTS.map((s) => ({ ...s, value: Math.max(0, s.pick(overview) || 0) }));
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const connectedPct = total > 0 ? Math.round((parts[0].value / total) * 100) : 0;
  let offset = 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">How calls ended</h3>
      <p className="mt-0.5 text-xs text-gray-400">Outcome mix across {formatNumber(total)} calls</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 140 140" className="h-32 w-32 -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="16" />
            {total > 0 &&
              parts.map((p) => {
                const dash = (p.value / total) * circumference;
                const seg = (
                  <circle
                    key={p.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="16"
                    strokeLinecap="butt"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return seg;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-900 tabular-nums">{connectedPct}%</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">connected</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {parts.map((p) => {
            const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
            return (
              <div key={p.key} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 text-gray-600">{p.label}</span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatNumber(p.value)}</span>
                <span className="w-9 text-right text-xs text-gray-400 tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
