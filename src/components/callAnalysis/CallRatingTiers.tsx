// Per-rep call-quality tier mix — a competitor-style 100%-stacked rating bar
// per handler (excellent / good / meets-floor / below-floor). Pure flex/div,
// no chart lib: each tier's width is its share of that rep's total scored calls.
// Reps ranked by combined (excellent + good) share so the strongest sit on top.

import React from 'react';
import { formatNumber, getRate } from './format';

export interface CallRatingTierRow {
  name: string;
  excellent: number;
  good: number;
  meetsFloor: number;
  belowFloor: number;
}

interface CallRatingTiersProps {
  rows: CallRatingTierRow[];
}

// Tier palette: high → low quality. Hex mirrors the Tailwind classes so the
// proportional bar segments and the legend dots stay perfectly in sync.
const TIERS: Array<{
  key: keyof Omit<CallRatingTierRow, 'name'>;
  label: string;
  color: string;
}> = [
  { key: 'excellent', label: 'Excellent', color: '#059669' }, // emerald-600
  { key: 'good', label: 'Good', color: '#4ade80' }, // green-400
  { key: 'meetsFloor', label: 'Meets floor', color: '#fbbf24' }, // amber-400
  { key: 'belowFloor', label: 'Below floor', color: '#f87171' }, // red-400
];

const rowTotal = (r: CallRatingTierRow) =>
  Math.max(0, r.excellent) + Math.max(0, r.good) + Math.max(0, r.meetsFloor) + Math.max(0, r.belowFloor);

export const CallRatingTiers: React.FC<CallRatingTiersProps> = ({ rows }) => {
  const ranked = [...rows]
    .map((r) => {
      const total = rowTotal(r);
      const passShare = total > 0 ? (Math.max(0, r.excellent) + Math.max(0, r.good)) / total : 0;
      return { r, total, passShare };
    })
    .sort((a, b) => b.passShare - a.passShare || b.total - a.total);

  const hasData = ranked.some((x) => x.total > 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Call quality tiers by rep</h3>
      <p className="mt-0.5 text-xs text-gray-400">Share of calls by AI quality rating</p>

      {!hasData ? (
        <p className="mt-4 text-sm text-gray-400">No data yet</p>
      ) : (
        <>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {TIERS.map((t) => (
              <span key={t.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
              </span>
            ))}
          </div>

          {/* Per-rep stacked bars */}
          <ul className="mt-4 space-y-3">
            {ranked.map(({ r, total }) => {
              const empty = total === 0;
              return (
                <li key={r.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-gray-700">{r.name}</span>
                    <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                      {formatNumber(total)} {total === 1 ? 'call' : 'calls'}
                    </span>
                  </div>

                  {empty ? (
                    <div className="mt-1.5 flex h-3 w-full items-center rounded-full bg-gray-100 px-2">
                      <span className="text-[10px] text-gray-400">No data yet</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      {TIERS.map((t) => {
                        const value = Math.max(0, r[t.key]);
                        if (value <= 0) return null;
                        const pct = (value / total) * 100;
                        return (
                          <div
                            key={t.key}
                            title={`${t.label} — ${formatNumber(value)} (${getRate(value, total)}%)`}
                            className="h-full transition-opacity hover:opacity-80"
                            style={{ width: `${pct}%`, backgroundColor: t.color }}
                          />
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
