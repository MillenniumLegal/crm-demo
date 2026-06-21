// Conversion by rep — the bottom line: assigned leads that went on to instruct.
// Generic rows so it ports unchanged; a dashed team-average marker for context.

import React from 'react';

interface ConversionByRepProps {
  rows: { name: string; rate: number }[]; // rate is a 0-100 percentage
}

const tone = (rate: number) => (rate >= 45 ? 'good' : rate >= 30 ? 'warn' : 'bad');
const toneBar: Record<string, string> = { good: 'bg-green-500', warn: 'bg-amber-500', bad: 'bg-red-500' };
const toneText: Record<string, string> = { good: 'text-green-700', warn: 'text-amber-700', bad: 'text-red-700' };

export const ConversionByRep: React.FC<ConversionByRepProps> = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Conversion by rep</h3>
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      </div>
    );
  }
  const sorted = [...rows].sort((a, b) => b.rate - a.rate);
  const max = Math.max(...sorted.map((r) => r.rate), 1);
  const teamAvg = Math.round(sorted.reduce((s, r) => s + r.rate, 0) / sorted.length);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Conversion by rep</h3>
        <span className="text-xs text-gray-400">Assigned leads that instructed · team avg {teamAvg}%</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((r) => {
          const t = tone(r.rate);
          return (
            <li key={r.name} className="flex items-center gap-3" title={`${r.name}: ${r.rate}% conversion`}>
              <span className="w-28 shrink-0 truncate text-sm text-gray-700">{r.name}</span>
              <div className="relative h-2.5 flex-1 rounded-full bg-gray-100">
                <div className={`h-2.5 rounded-full ${toneBar[t]}`} style={{ width: `${(r.rate / max) * 100}%` }} />
                <div
                  className="absolute inset-y-0 border-l border-dashed border-gray-400"
                  style={{ left: `${(teamAvg / max) * 100}%` }}
                  title={`Team avg ${teamAvg}%`}
                />
              </div>
              <span className={`w-10 text-right text-sm font-semibold tabular-nums ${toneText[t]}`}>{r.rate}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
