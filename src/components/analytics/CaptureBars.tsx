// Qualification capture — for each data point we try to extract on a call, what
// share of analysed calls did we actually capture it? Sorted worst-captured at the
// bottom isn't useful for coaching, so we sort best→worst and flag the low-capture
// gaps (<10%) in amber/red so the firm owner can see exactly which questions agents
// keep forgetting to ask. No chart library — proportional flex tracks.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

interface CaptureField {
  label: string;
  pct: number;
}

interface CaptureBarsProps {
  title: string;
  caption?: string;
  fields: CaptureField[];
}

type CaptureTone = 'good' | 'warn' | 'bad';

// Fill colour by capture level: solid navy when healthy, amber/red to flag gaps.
const TONE_BAR: Record<CaptureTone, string> = {
  good: 'bg-navy-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

const TONE_DOT: Record<CaptureTone, string> = {
  good: 'bg-navy-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

const TONE_VALUE: Record<CaptureTone, string> = {
  good: 'text-navy-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
};

// Anything under 10% is a real capture gap worth flagging; under 4% is critical.
const toneFor = (pct: number): CaptureTone => (pct < 4 ? 'bad' : pct < 10 ? 'warn' : 'good');

export const CaptureBars: React.FC<CaptureBarsProps> = ({ title, caption, fields }) => {
  const rows = [...(fields ?? [])]
    .map((field) => {
      // Guard against bad inputs so a stray NaN/negative/over-100 never breaks a bar.
      const pct = Number.isFinite(field.pct) ? Math.min(100, Math.max(0, field.pct)) : 0;
      return { label: field.label, pct, tone: toneFor(pct) };
    })
    .sort((a, b) => b.pct - a.pct);

  const gaps = rows.filter((row) => row.pct < 10).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {gaps > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"
            title={`${formatNumber(gaps)} field${gaps === 1 ? '' : 's'} captured on fewer than 10% of calls`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {formatNumber(gaps)} capture gap{gaps === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        {caption ?? 'Share of analysed calls where this was captured'}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[row.tone]}`} />
                <span className="truncate text-sm text-gray-700" title={row.label}>
                  {row.label}
                </span>
              </span>

              <div
                className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-gray-100 sm:w-44"
                title={`${row.label}: captured on ${Math.round(row.pct)}% of analysed calls`}
              >
                <div
                  className={`h-full rounded-full transition-all ${TONE_BAR[row.tone]}`}
                  style={{ width: `${row.pct}%` }}
                />
              </div>

              <span
                className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${TONE_VALUE[row.tone]}`}
              >
                {Math.round(row.pct)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
