// Worklist queue strip (spec §4): six action-first queue cards under the hero row.
// Pure presentation — counts and click-throughs arrive via props.

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { QueueCardSpec, QueueStripProps } from './types';
import { formatNumber } from './format';

const countToneClass: Record<QueueCardSpec['tone'], string> = {
  red: 'text-red-700',
  amber: 'text-amber-600',
  navy: 'text-navy-950',
};

const QueueCount: React.FC<{ queue: QueueCardSpec }> = ({ queue }) => {
  if (queue.count === null) {
    return (
      <span className="animate-pulse text-2xl font-semibold tabular-nums text-gray-300" aria-label="Loading count">
        –
      </span>
    );
  }

  if (queue.count === 0) {
    return (
      <span className="flex items-center gap-1.5 text-green-700">
        <CheckCircle className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-semibold">All clear</span>
      </span>
    );
  }

  return (
    <span className={`text-2xl font-semibold tabular-nums ${countToneClass[queue.tone]}`}>
      {queue.capped ? `${formatNumber(10000)}+` : formatNumber(queue.count)}
    </span>
  );
};

export const QueueStrip: React.FC<QueueStripProps> = ({ queues }) => {
  if (queues.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {queues.map((queue) => (
        <button
          key={queue.key}
          type="button"
          onClick={queue.onOpen}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-navy-950 hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-900">{queue.title}</p>
          <div className="mt-1 flex h-8 items-center">
            <QueueCount queue={queue} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{queue.description}</p>
          {queue.extra && <p className="mt-1 text-xs text-amber-600">{queue.extra}</p>}
        </button>
      ))}
    </div>
  );
};
