// Recent quotes / invoices list for the Finance hub.
// Each row pairs an amount + party on the left with a status badge + timestamp
// on the right. Status colouring follows the conveyancing money lifecycle:
// Accepted/Paid = settled (green), Sent/Pending = in-flight (amber),
// Rejected/Overdue/Expired = problem (red), Draft = not-yet-sent (gray).

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

interface MoneyRow {
  name: string;
  amount: number;
  status: string;
  when: string;
}

interface MoneyListProps {
  title: string;
  rows: MoneyRow[];
}

type StatusTone = 'good' | 'warn' | 'bad' | 'muted';

const TONE_BADGE: Record<StatusTone, string> = {
  good: 'bg-green-50 text-green-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-red-50 text-red-700',
  muted: 'bg-gray-100 text-gray-600',
};

const TONE_DOT: Record<StatusTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  muted: 'bg-gray-400',
};

// Map a free-text status onto a tone. Case-insensitive so 'paid' and 'Paid' agree.
const toneForStatus = (status: string): StatusTone => {
  switch (status.trim().toLowerCase()) {
    case 'accepted':
    case 'paid':
      return 'good';
    case 'sent':
    case 'pending':
      return 'warn';
    case 'rejected':
    case 'overdue':
    case 'expired':
      return 'bad';
    case 'draft':
      return 'muted';
    default:
      return 'muted';
  }
};

export const MoneyList: React.FC<MoneyListProps> = ({ title, rows }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {rows.length > 0 && (
          <span className="text-xs text-gray-400 tabular-nums">{formatNumber(rows.length)}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {rows.map((row, index) => {
            const tone = toneForStatus(row.status);
            return (
              <li
                key={`${row.name}-${index}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                title={`${row.name} — £${formatNumber(row.amount)} · ${row.status} · ${row.when}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 tabular-nums leading-tight">
                      £{formatNumber(row.amount)}
                    </span>
                    <span className="block truncate text-xs text-gray-500 leading-tight">{row.name}</span>
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE[tone]}`}
                  >
                    {row.status}
                  </span>
                  <span className="text-xs text-gray-400">{row.when}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
