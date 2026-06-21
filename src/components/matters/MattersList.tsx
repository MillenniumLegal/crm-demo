// Live matters — the post-instruction case list. One row per matter with a
// milestone progress bar across conveyancing stages. Pure flex/SVG, no chart
// library. Most urgent (stalled, then needs-action) float to the top.

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

type MatterStatus = 'on_track' | 'needs_action' | 'stalled';

interface Matter {
  client: string;
  ref: string;
  txn: string;
  value: number;
  stage: number;
  status: MatterStatus;
  days: number;
  next: string;
  firm: string;
}

interface MattersListProps {
  stages: string[];
  matters: Matter[];
}

// Urgency order: stalled first, then needs-action, on-track last.
const STATUS_RANK: Record<MatterStatus, number> = {
  stalled: 0,
  needs_action: 1,
  on_track: 2,
};

const STATUS_META: Record<
  MatterStatus,
  { label: string; badge: string; current: string; dot: string }
> = {
  on_track: {
    label: 'On track',
    badge: 'bg-green-50 text-green-700',
    current: 'bg-green-500',
    dot: 'bg-green-500',
  },
  needs_action: {
    label: 'Needs action',
    badge: 'bg-amber-50 text-amber-700',
    current: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  stalled: {
    label: 'Stalled',
    badge: 'bg-red-50 text-red-700',
    current: 'bg-red-500',
    dot: 'bg-red-500',
  },
};

export const MattersList: React.FC<MattersListProps> = ({ stages, matters }) => {
  const hasData = matters.length > 0;

  // Sort a copy so the caller's array is never mutated.
  const sorted = [...matters].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Live matters</h3>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums">
            {formatNumber(matters.length)}
          </span>
        </div>
        <span className="text-xs text-gray-400">Most urgent first</span>
      </div>

      {!hasData ? (
        <div className="mt-6 rounded-md bg-gray-50 py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No matters</p>
          <p className="mt-1 text-xs text-gray-400">
            Cases appear here once a client is instructed.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {sorted.map((m, i) => {
            const meta = STATUS_META[m.status];
            // Clamp the current stage into range so progress is always valid.
            const current = Math.min(Math.max(m.stage, 0), Math.max(stages.length - 1, 0));
            const stageName = stages[current] ?? 'Unknown stage';
            const overdue = m.days > 14;

            return (
              <li key={`${m.ref}-${i}`} className="py-3">
                {/* Top line: client · ref · txn chip · value · status badge */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-gray-900">{m.client}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{m.ref}</span>
                  <span
                    className="rounded-full bg-navy-50 px-2 text-[11px] font-medium text-navy-700"
                    title={`Transaction type: ${m.txn}`}
                  >
                    {m.txn}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    £{formatNumber(m.value)}
                  </span>
                  <span
                    className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                    title={`Status: ${meta.label}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Milestone progress bar — one segment per stage */}
                <div className="mt-2.5 flex gap-1" title={`Stage ${current + 1} of ${stages.length}: ${stageName}`}>
                  {stages.map((s, idx) => {
                    const tone =
                      idx < current
                        ? 'bg-green-500'
                        : idx === current
                          ? meta.current
                          : 'bg-gray-200';
                    return (
                      <div
                        key={`${m.ref}-stage-${idx}`}
                        className={`h-1.5 flex-1 rounded-full ${tone}`}
                        title={s}
                      />
                    );
                  })}
                </div>

                {/* Current stage + time-in-stage */}
                <div className="mt-1.5 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{stageName}</span>
                  <span className="text-gray-300"> · </span>
                  <span className={`tabular-nums ${overdue ? 'font-medium text-red-600' : ''}`}>
                    {formatNumber(m.days)}d in stage
                  </span>
                </div>

                {/* Next action */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <ArrowRight className={`h-3 w-3 shrink-0 ${meta.dot.replace('bg-', 'text-')}`} aria-hidden="true" />
                  <span className="line-clamp-1" title={m.next}>{m.next}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
