// Pipeline Pulse hero card: a headline total + labelled horizontal bars.
// Reused for Hot leads, Other active and Overdue. Pure flex-bar charts,
// no chart library — bars scale to the largest segment in the card.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

type SegmentTone = 'good' | 'warn' | 'bad';

interface PulseSegment {
  label: string;
  count: number;
  tone?: SegmentTone;
}

interface PulseBarsCardProps {
  title: string;
  total: number;
  totalSuffix?: string;
  segments: PulseSegment[];
}

const TONE_BAR: Record<SegmentTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

const TONE_DOT: Record<SegmentTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

const barClass = (tone?: SegmentTone) => (tone ? TONE_BAR[tone] : 'bg-navy-500');
const dotClass = (tone?: SegmentTone) => (tone ? TONE_DOT[tone] : 'bg-navy-500');

export const PulseBarsCard: React.FC<PulseBarsCardProps> = ({ title, total, totalSuffix, segments }) => {
  const max = segments.reduce((m, s) => Math.max(m, s.count || 0), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold leading-none text-gray-900 tabular-nums" title={`${formatNumber(total)}`}>
            {formatNumber(total)}
          </span>
          {totalSuffix && <span className="text-xs text-gray-400">{totalSuffix}</span>}
        </div>
      </div>

      {segments.length === 0 ? (
        <p className="mt-4 text-xs text-gray-400">No data yet</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {segments.map((s) => {
            const count = Math.max(0, s.count || 0);
            const width = max > 0 ? Math.round((count / max) * 100) : 0;
            return (
              <div
                key={s.label}
                className="flex items-center gap-2.5"
                title={`${s.label}: ${formatNumber(count)}`}
              >
                <span className="flex w-24 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(s.tone)}`} />
                  <span className="truncate text-xs text-gray-600">{s.label}</span>
                </span>
                <span className="h-2 flex-1 rounded-full bg-gray-100">
                  <span
                    className={`block h-2 rounded-full ${barClass(s.tone)}`}
                    style={{ width: `${count > 0 ? Math.max(width, 4) : 0}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-900 tabular-nums">
                  {formatNumber(count)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
