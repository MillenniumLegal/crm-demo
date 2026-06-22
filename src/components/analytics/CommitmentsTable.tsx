// Firm-wide commitments ledger: promises made on calls (call-backs, replies,
// documents, deposits) measured against what was actually honoured. Each row
// carries a kept-rate track so the owner can see at a glance which commitment
// types the firm reliably delivers — and which ones leak. No chart library.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

interface CommitmentRow {
  action: string;
  total: number;
  kept: number;
  broken: number;
  active: number;
}

interface CommitmentsTableProps {
  title: string;
  caption?: string;
  rows: CommitmentRow[];
}

// Kept-rate tone: green when the firm honours most promises, amber mid, red poor.
const keptRateTone = (rate: number) =>
  rate >= 0.8 ? 'text-green-700' : rate >= 0.5 ? 'text-amber-700' : 'text-red-700';

export const CommitmentsTable: React.FC<CommitmentsTableProps> = ({ title, caption, rows }) => {
  const sorted = [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Commitments — promised vs honoured</h3>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Kept
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Broken
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Active
          </span>
        </div>
      </div>
      {caption && <p className="mt-0.5 text-xs text-gray-400">{caption}</p>}

      {sorted.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="mt-3">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Action</span>
            <span className="w-12 text-right">Total</span>
            <span className="w-12 text-right">Kept</span>
            <span className="w-14 text-right">Broken</span>
            <span className="w-12 text-right">Active</span>
          </div>

          <ul className="divide-y divide-gray-100">
            {sorted.map((row) => {
              const keptRate = row.total > 0 ? row.kept / row.total : 0;
              const keptPct = Math.round(keptRate * 100);
              return (
                <li key={row.action} className="py-2.5">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4">
                    <span className="truncate text-sm font-medium text-gray-900" title={row.action}>
                      {row.action}
                    </span>
                    <span className="w-12 text-right text-sm tabular-nums text-gray-700">
                      {formatNumber(row.total)}
                    </span>
                    <span
                      className="w-12 text-right text-sm font-medium tabular-nums text-green-700"
                      title={`${formatNumber(row.kept)} kept`}
                    >
                      {formatNumber(row.kept)}
                    </span>
                    <span
                      className={`w-14 text-right text-sm font-medium tabular-nums ${
                        row.broken > 0 ? 'text-red-700' : 'text-gray-300'
                      }`}
                      title={`${formatNumber(row.broken)} broken`}
                    >
                      {formatNumber(row.broken)}
                    </span>
                    <span
                      className={`w-12 text-right text-sm font-medium tabular-nums ${
                        row.active > 0 ? 'text-amber-700' : 'text-gray-300'
                      }`}
                      title={`${formatNumber(row.active)} still active`}
                    >
                      {formatNumber(row.active)}
                    </span>
                  </div>

                  {/* Kept-rate bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"
                      title={`${keptPct}% of ${formatNumber(row.total)} commitments kept`}
                    >
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${keptPct}%` }}
                      />
                    </div>
                    <span className={`w-9 text-right text-[11px] font-semibold tabular-nums ${keptRateTone(keptRate)}`}>
                      {keptPct}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
