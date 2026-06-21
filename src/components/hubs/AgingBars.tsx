// Outstanding-payment aging buckets for the Finance hub.
// Pure flex-bar chart, no chart library — bars scale to the largest bucket.
// The 60d+ (bad-tone) total is called out separately as the at-risk balance.

import React from 'react';
import { formatNumber } from '@/components/callAnalysis/format';

type BucketTone = 'good' | 'warn' | 'bad';

interface AgingBucket {
  bucket: string;
  amount: number;
  tone: BucketTone;
}

interface AgingBarsProps {
  buckets: AgingBucket[];
}

const TONE_BAR: Record<BucketTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

const TONE_DOT: Record<BucketTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
};

export const AgingBars: React.FC<AgingBarsProps> = ({ buckets }) => {
  const rows = (buckets ?? []).map((b) => ({ ...b, amount: Math.max(0, b.amount || 0) }));
  const total = rows.reduce((sum, b) => sum + b.amount, 0);
  const atRisk = rows.filter((b) => b.tone === 'bad').reduce((sum, b) => sum + b.amount, 0);
  const maxAmount = rows.reduce((m, b) => Math.max(m, b.amount), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Outstanding by age</h3>
        <div className="flex items-baseline gap-1">
          <span
            className="text-2xl font-bold leading-none text-gray-900 tabular-nums"
            title={`Total outstanding: £${formatNumber(total)}`}
          >
            £{formatNumber(total)}
          </span>
        </div>
      </div>

      {atRisk > 0 ? (
        <p className="mt-0.5 text-xs text-gray-400">
          <span className="font-semibold text-red-700 tabular-nums" title="Balance aged 60 days or more">
            £{formatNumber(atRisk)}
          </span>{' '}
          aged 60d+
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-gray-400">Outstanding receivables by age</p>
      )}

      {rows.length === 0 || total === 0 ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {rows.length === 0 ? 'No data yet' : 'All clear — nothing outstanding'}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {rows.map((b) => {
            const width = maxAmount > 0 ? Math.round((b.amount / maxAmount) * 100) : 0;
            return (
              <div
                key={b.bucket}
                className="flex items-center gap-2.5"
                title={`${b.bucket}: £${formatNumber(b.amount)}`}
              >
                <span className="flex w-20 shrink-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[b.tone]}`} />
                  <span className="truncate text-xs text-gray-600">{b.bucket}</span>
                </span>
                <span className="h-2.5 flex-1 rounded-full bg-gray-100">
                  <span
                    className={`block h-2.5 rounded-full ${TONE_BAR[b.tone]}`}
                    style={{ width: `${b.amount > 0 ? Math.max(width, 4) : 0}%` }}
                  />
                </span>
                <span
                  className={`w-20 shrink-0 text-right text-xs font-semibold tabular-nums ${
                    b.tone === 'bad' ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  £{formatNumber(b.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
