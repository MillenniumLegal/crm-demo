// Firm-wide live activity strip: recent calls (with AI summaries) alongside
// recent deposits (with status badges). Pure presentation — no chart lib.

import React from 'react';
import { Phone } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

interface CallActivity {
  party: string;
  summary: string;
  outcome: string;
  when: string;
}

interface DepositActivity {
  name: string;
  ref: string;
  amount: number;
  status: string;
  when: string;
}

interface LiveActivityStripProps {
  calls: CallActivity[];
  deposits: DepositActivity[];
}

// Phone-icon tone by call outcome.
const callOutcomeTone = (outcome: string): string => {
  const key = (outcome || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'connected') return 'text-green-600';
  if (key === 'voicemail') return 'text-amber-500';
  if (key === 'missed') return 'text-red-500';
  // no_answer and anything else
  return 'text-gray-400';
};

// Deposit status badge styling.
const depositBadgeClass = (status: string): string => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';
  const key = (status || '').toLowerCase();
  if (key === 'instructed') return `${base} bg-green-100 text-green-700`;
  if (key === 'deposit made') return `${base} bg-navy-100 text-navy-700`;
  if (key === 'onboarding sent') return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-gray-100 text-gray-600`;
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center rounded-md bg-gray-50 py-8 text-sm text-gray-400">
    {label}
  </div>
);

export const LiveActivityStrip: React.FC<LiveActivityStripProps> = ({ calls, deposits }) => {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* Recent calls */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-x-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent calls</h3>
          <span className="text-xs text-gray-400 tabular-nums">{formatNumber(calls.length)} logged</span>
        </div>
        {calls.length === 0 ? (
          <div className="mt-3">
            <EmptyState label="No data yet" />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {calls.map((c, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <Phone
                  className={`mt-0.5 h-4 w-4 shrink-0 ${callOutcomeTone(c.outcome)}`}
                  title={c.outcome}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{c.party}</p>
                  <p
                    className="mt-0.5 text-xs italic text-gray-500"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={c.summary}
                  >
                    {c.summary}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{c.when}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent deposits */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-x-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent deposits</h3>
          <span className="text-xs text-gray-400 tabular-nums">{formatNumber(deposits.length)} logged</span>
        </div>
        {deposits.length === 0 ? (
          <div className="mt-3">
            <EmptyState label="No data yet" />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {deposits.map((d, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold tabular-nums">£{formatNumber(d.amount)}</span>
                    <span className="ml-1.5 text-gray-700">{d.name}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-400 tabular-nums" title={d.ref}>
                    {d.ref}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={depositBadgeClass(d.status)} title={d.status}>
                    {d.status}
                  </span>
                  <span className="whitespace-nowrap text-xs text-gray-400">{d.when}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
