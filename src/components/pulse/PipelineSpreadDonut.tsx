// Pipeline-spread donut: where all active leads sit right now.
// Pure SVG, no chart lib — same arc technique as OutcomeDonut.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

interface PipelineSpreadDonutProps {
  total: number;
  segments: { label: string; count: number; color: string }[];
}

export const PipelineSpreadDonut: React.FC<PipelineSpreadDonutProps> = ({ total, segments }) => {
  const parts = (segments || []).map((s) => ({ ...s, count: Math.max(0, s.count || 0) }));
  const sum = parts.reduce((acc, p) => acc + p.count, 0);
  // Prefer the supplied total, but never divide by zero or by a stale total.
  const denom = total > 0 ? total : sum;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  if (denom <= 0 || parts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline spread</h3>
        <p className="mt-0.5 text-xs text-gray-400">Where your active leads sit</p>
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <div className="h-20 w-20 rounded-full border-[10px] border-gray-100" />
          <p className="mt-3 text-sm text-gray-400">No data yet</p>
        </div>
      </div>
    );
  }

  let offset = 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Pipeline spread</h3>
      <p className="mt-0.5 text-xs text-gray-400">Where {formatNumber(denom)} active leads sit</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 140 140" className="h-32 w-32 -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="16" />
            {parts.map((p, i) => {
              const dash = (p.count / denom) * circumference;
              const pct = Math.round((p.count / denom) * 100);
              const seg = (
                <circle
                  key={`${p.label}-${i}`}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="16"
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${p.label}: ${formatNumber(p.count)} (${pct}%)`}</title>
                </circle>
              );
              offset += dash;
              return seg;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{formatNumber(denom)}</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">leads</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {parts.map((p, i) => {
            const pct = Math.round((p.count / denom) * 100);
            return (
              <div
                key={`${p.label}-${i}`}
                className="flex items-center gap-2 text-sm"
                title={`${p.label}: ${formatNumber(p.count)} (${pct}%)`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate text-gray-600">{p.label}</span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatNumber(p.count)}</span>
                <span className="w-9 text-right text-xs text-gray-400 tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
