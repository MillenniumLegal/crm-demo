// Live Matters — "Where the matters are": distribution of live conveyancing
// cases across the lifecycle stages. Pure flex/SVG, no chart library.

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

interface MattersStageStripProps {
  stages: string[];
  distribution: { stage: string; count: number }[];
}

export const MattersStageStrip: React.FC<MattersStageStripProps> = ({ stages, distribution }) => {
  // Map distribution by stage so we can render strictly in the given `stages` order.
  const countFor = (stage: string) =>
    distribution.find((d) => d.stage === stage)?.count ?? 0;

  const counts = stages.map(countFor);
  const total = counts.reduce((sum, c) => sum + Math.max(0, c), 0);
  const maxCount = Math.max(1, ...counts);
  // Index of the busiest stage (first wins on ties) — gets the highlight ring.
  const peakIndex = total > 0 ? counts.indexOf(Math.max(...counts)) : -1;

  const hasData = stages.length > 0 && total > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Where the matters are</h3>
        <span className="text-xs text-gray-400">Live cases across the conveyancing lifecycle</span>
      </div>

      {!hasData ? (
        <div className="mt-6 rounded-md bg-gray-50 py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No matters</p>
          <p className="mt-1 text-xs text-gray-400">
            Stage counts appear once cases are instructed.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max items-stretch">
              {stages.map((stage, i) => {
                const idx = String(i + 1).padStart(2, '0');
                const count = counts[i];
                const width = Math.round((Math.max(0, count) / maxCount) * 100);
                const isPeak = i === peakIndex;
                const share = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <React.Fragment key={`${stage}-${i}`}>
                    <div
                      className={`flex min-w-[7.5rem] flex-1 flex-col rounded-lg px-3 py-2 transition-colors ${
                        isPeak ? 'bg-navy-50 ring-1 ring-navy-200' : ''
                      }`}
                      title={`${stage}: ${formatNumber(count)} matter${
                        count === 1 ? '' : 's'
                      } · ${share}% of live cases`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        <span className="tabular-nums">{idx}</span>
                        <span className={isPeak ? 'text-navy-700' : ''}>{stage}</span>
                        {isPeak && (
                          <span
                            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-navy-500"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div
                        className={`mt-1 text-2xl font-bold tabular-nums ${
                          isPeak ? 'text-navy-700' : 'text-gray-900'
                        }`}
                      >
                        {formatNumber(count)}
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full ${isPeak ? 'bg-navy-600' : 'bg-navy-500'}`}
                          style={{ width: `${Math.max(width, 6)}%` }}
                        />
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

          <p className="mt-3 text-xs text-gray-400">
            <span className="font-medium text-gray-500 tabular-nums">{formatNumber(total)}</span>{' '}
            live matter{total === 1 ? '' : 's'} across {formatNumber(stages.length)} stage
            {stages.length === 1 ? '' : 's'}
          </p>
        </>
      )}
    </div>
  );
};
