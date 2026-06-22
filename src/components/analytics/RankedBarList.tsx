// A reusable ranked category list with proportional bars + an optional
// representative quote. Sorted by count desc so the heaviest category surfaces
// at the top. Used across the Analytics hub for objections-raised,
// client-questions, lost-reasons, close-drivers and follow-up outcomes.
// No chart library — pure flex bars on a subtle gray track.

import React from 'react';
import { Quote } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

type Tone = 'good' | 'warn' | 'bad' | 'info';

interface RankedBarItem {
  label: string;
  count: number;
  quote?: string;
  tone?: Tone;
}

interface RankedBarListProps {
  title: string;
  caption?: string;
  items: RankedBarItem[];
  defaultTone?: Tone;
}

// Solid 500-weight fills keep the demo theme vivid; info defaults to navy.
const TONE_BAR: Record<Tone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-500',
};

const TONE_DOT: Record<Tone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-500',
};

export const RankedBarList: React.FC<RankedBarListProps> = ({
  title,
  caption,
  items,
  defaultTone = 'info',
}) => {
  const rows = [...(items ?? [])].sort((a, b) => b.count - a.count);
  const maxCount = rows.reduce((max, item) => Math.max(max, item.count), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {caption && <p className="mt-0.5 text-xs text-gray-400">{caption}</p>}

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((item, index) => {
            const tone = item.tone ?? defaultTone;
            const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <li key={`${item.label}-${index}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                    <span className="truncate text-sm font-medium text-gray-900">{item.label}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gray-700 tabular-nums">
                    {formatNumber(item.count)}
                  </span>
                </div>

                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <span
                    className={`block h-full rounded-full ${TONE_BAR[tone]}`}
                    style={{ width: `${width}%` }}
                    title={`${item.label}: ${formatNumber(item.count)}`}
                  />
                </div>

                {item.quote && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs italic text-gray-500">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" aria-hidden="true" />
                    <span className="line-clamp-1">&ldquo;{item.quote}&rdquo;</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
