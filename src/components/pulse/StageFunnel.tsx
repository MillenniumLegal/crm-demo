// Pipeline Pulse — horizontal lead funnel across lifecycle stages, with
// movement-today under each stage. Pure flex/SVG, no chart library.

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

interface StageFunnelProps {
  stages: { stage: string; count: number; movement: number }[];
}

// Subtle navy → cooler accents so the eye reads the funnel left-to-right.
const ACCENTS = ['bg-navy-600', 'bg-navy-500', 'bg-sky-500', 'bg-teal-500', 'bg-emerald-500', 'bg-amber-500'];

export const StageFunnel: React.FC<StageFunnelProps> = ({ stages }) => {
  const hasData = stages.length > 0 && stages.some((s) => s.count > 0 || s.movement !== 0);
  const peak = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Where the leads are</h3>
        <span className="text-xs text-gray-400">Live count per stage · movement today</span>
      </div>

      {!hasData ? (
        <div className="mt-6 rounded-md bg-gray-50 py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No data yet</p>
          <p className="mt-1 text-xs text-gray-400">Stage counts appear once leads enter the pipeline.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-max items-stretch">
            {stages.map((s, i) => {
              const idx = String(i + 1).padStart(2, '0');
              const accent = ACCENTS[i % ACCENTS.length];
              // Underline width is proportional to the funnel peak (always visible).
              const width = Math.round((Math.max(0, s.count) / peak) * 100);
              const moved = s.movement > 0;
              const movementLabel = moved
                ? `▲${formatNumber(s.movement)} today`
                : s.count === 0
                  ? 'stage empty'
                  : 'no movement';
              return (
                <React.Fragment key={`${s.stage}-${i}`}>
                  <div
                    className="flex min-w-[7.5rem] flex-1 flex-col px-3"
                    title={`${s.stage}: ${formatNumber(s.count)} lead${s.count === 1 ? '' : 's'}${
                      moved ? ` · ${formatNumber(s.movement)} moved in today` : ''
                    }`}
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      <span className="tabular-nums">{idx}</span> {s.stage}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
                      {formatNumber(s.count)}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${accent}`}
                        style={{ width: `${Math.max(width, 6)}%` }}
                      />
                    </div>
                    <div
                      className={`mt-2 text-xs font-medium tabular-nums ${
                        moved ? 'text-green-700' : 'text-gray-400'
                      }`}
                    >
                      {movementLabel}
                    </div>
                  </div>

                  {i < stages.length - 1 && (
                    <div className="flex shrink-0 items-center" aria-hidden="true">
                      <ChevronRight className="h-5 w-5 text-gray-300" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
