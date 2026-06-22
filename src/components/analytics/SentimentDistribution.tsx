// Firm-wide client-sentiment distribution: one row per sentiment level
// (Very negative … Very positive), each a proportional track filled to the
// busiest level and coloured by tone. No chart library — pure flex bars.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

type SentimentTone = 'good' | 'warn' | 'bad' | 'info';

interface SentimentLevel {
  label: string;
  count: number;
  tone: SentimentTone;
}

interface SentimentDistributionProps {
  title: string;
  caption?: string;
  levels: SentimentLevel[];
}

// Solid 500-weight fills for the bars (info softens to navy-400 per spec).
const TONE_BAR: Record<SentimentTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-400',
};

// Coloured dot beside each label.
const TONE_DOT: Record<SentimentTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-400',
};

// Count colour echoes the tone, info stays neutral gray-900.
const TONE_COUNT: Record<SentimentTone, string> = {
  good: 'text-green-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
  info: 'text-gray-900',
};

export const SentimentDistribution: React.FC<SentimentDistributionProps> = ({ title, caption, levels }) => {
  const total = levels.reduce((sum, level) => sum + Math.max(0, level.count), 0);
  const maxCount = levels.reduce((max, level) => Math.max(max, level.count), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 tabular-nums">{formatNumber(total)} responses</p>
      </div>
      {caption && <p className="mt-0.5 text-xs text-gray-400">{caption}</p>}

      {levels.length === 0 || total === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {levels.map((level, index) => {
            const pct = total > 0 ? Math.round((level.count / total) * 100) : 0;
            const fill = maxCount > 0 ? (level.count / maxCount) * 100 : 0;
            return (
              <li
                key={`${level.label}-${index}`}
                className="flex items-center gap-3"
                title={`${level.label}: ${formatNumber(level.count)} (${pct}%)`}
              >
                <span className="flex w-28 shrink-0 items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[level.tone]}`} />
                  <span className="truncate text-sm text-gray-700">{level.label}</span>
                </span>

                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <span
                    className={`block h-full rounded-full ${TONE_BAR[level.tone]}`}
                    style={{ width: `${Math.max(fill, level.count > 0 ? 4 : 0)}%` }}
                  />
                </span>

                <span className="flex w-20 shrink-0 items-baseline justify-end gap-1.5">
                  <span className={`text-sm font-semibold tabular-nums ${TONE_COUNT[level.tone]}`}>
                    {formatNumber(level.count)}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
