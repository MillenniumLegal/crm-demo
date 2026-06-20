// Overview side panel: "Clients who called us first" (spec §1.5, §9.7).
// Surfaces inbound-hot opportunity counts with click-throughs to the Calls tab.

import React from 'react';
import { FileCheck, Link2, PhoneIncoming } from 'lucide-react';
import { InboundPanelProps } from './types';
import { formatNumber } from './format';

export const InboundPanel: React.FC<InboundPanelProps> = ({
  hotCalls,
  possibleHotCalls,
  hotInstructed,
  onViewHot,
  onReviewPossibleHot,
}) => {
  const needsMatching = possibleHotCalls > 0;

  return (
    <section className="card">
      <h3 className="text-sm font-semibold text-gray-900">Clients who called us first</h3>
      <p className="mt-1 text-xs text-gray-500">
        Hot inbound = a known lead rang us before we ever reached them.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={onViewHot}
          title="View hot inbound calls"
          className="group cursor-pointer rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
        >
          <div className="flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Hot inbound</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {formatNumber(hotCalls)}
          </p>
          <p className="mt-1 text-xs text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
            View calls &rarr;
          </p>
        </button>

        <button
          type="button"
          onClick={onReviewPossibleHot}
          title="Review possible hot calls that need matching"
          className={`group cursor-pointer rounded-lg border p-4 text-left transition-colors ${
            needsMatching
              ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Link2 className={`h-4 w-4 ${needsMatching ? 'text-amber-600' : 'text-gray-400'}`} />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Possible hot &mdash; needs matching
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              needsMatching ? 'text-amber-700' : 'text-gray-400'
            }`}
          >
            {formatNumber(possibleHotCalls)}
          </p>
          {needsMatching ? (
            <p className="mt-1 text-xs font-medium text-amber-700">Match these first &rarr;</p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">None waiting</p>
          )}
        </button>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-navy-950" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Became instructions
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-950">
            {formatNumber(hotInstructed)}
          </p>
          <p className="mt-1 text-xs text-gray-500">of hot inbound in this range</p>
        </div>
      </div>
    </section>
  );
};
