// A single 100%-stacked horizontal distribution bar with legend — built for the
// firm-wide Analytics hub to show how a population (e.g. lead lifecycle) splits
// across stages. No chart library: one flex track of proportional segments plus a
// wrap legend of coloured dots, counts and percentages. Pure SVG/flex aesthetic.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

interface DistributionSegment {
  label: string;
  count: number;
  color: string;
}

interface StackedDistributionBarProps {
  title: string;
  caption?: string;
  segments: DistributionSegment[];
}

export const StackedDistributionBar: React.FC<StackedDistributionBarProps> = ({
  title,
  caption,
  segments,
}) => {
  const visible = (segments ?? []).filter((segment) => segment.count > 0);
  const total = visible.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400 tabular-nums">
          {formatNumber(total)} total
        </span>
      </div>
      {caption && <p className="mt-0.5 text-xs text-gray-400">{caption}</p>}

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <>
          <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-gray-100">
            {visible.map((segment, index) => {
              const pct = (segment.count / total) * 100;
              return (
                <div
                  key={`${segment.label}-${index}`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${pct}%`, backgroundColor: segment.color }}
                  title={`${segment.label}: ${formatNumber(segment.count)} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {visible.map((segment, index) => {
              const pct = Math.round((segment.count / total) * 100);
              return (
                <li
                  key={`${segment.label}-${index}`}
                  className="flex items-center gap-1.5 text-xs text-gray-600"
                  title={`${segment.label}: ${formatNumber(segment.count)} (${pct}%)`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-gray-700">{segment.label}</span>
                  <span className="tabular-nums text-gray-900">{formatNumber(segment.count)}</span>
                  <span className="tabular-nums text-gray-400">({pct}%)</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
