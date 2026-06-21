// Smart filter chips for the Pipeline Pulse leads-landing.
// One-click pills that deep-link into the lead list, with live counts.
// Pure presentation — no chart lib, no domain-type imports.

import React from 'react';
import { Bookmark } from 'lucide-react';
import { formatNumber } from '@/components/callAnalysis/format';

interface SmartLeadChip {
  key: string;
  label: string;
  count: number;
}

interface SmartLeadChipsProps {
  chips: SmartLeadChip[];
  activeKey?: string;
  onSelect?: (key: string) => void;
}

export const SmartLeadChips: React.FC<SmartLeadChipsProps> = ({ chips, activeKey, onSelect }) => {
  if (!chips || chips.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Smart filters</h3>
        <p className="mt-2 text-sm text-gray-400">No data yet — smart filters appear once leads land in this view.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Smart filters</h3>
        <span className="text-xs text-gray-400">One click to jump into the matching leads</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isActive = chip.key === activeKey;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect?.(chip.key)}
              title={`${chip.label} — ${formatNumber(Math.max(0, chip.count || 0))} lead${chip.count === 1 ? '' : 's'}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                isActive
                  ? 'border-navy-300 bg-navy-50 text-navy-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-navy-600" />}
              <span className="font-medium">{chip.label}</span>
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  isActive ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {formatNumber(Math.max(0, chip.count || 0))}
              </span>
            </button>
          );
        })}

        <span
          title="Save the current filter as a named view"
          className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-dashed border-gray-200 px-3 py-1.5 text-sm text-gray-400"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save view
        </span>
      </div>
    </div>
  );
};
