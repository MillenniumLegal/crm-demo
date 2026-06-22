// Reusable premium time-range filter chip bar (Today / 7d / 30d / 90d / Year / All).
// Pages hold the selected key and scale/refetch their data off it.

import React from 'react';

interface RangeOption { key: string; label: string; }
interface Props { value: string; onChange: (v: string) => void; options?: RangeOption[]; }

export const RANGE_SCALE: Record<string, number> = {
  today: 0.04, '7d': 0.25, '30d': 1, '90d': 3, year: 12, all: 18,
};

const DEFAULT_OPTIONS: RangeOption[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
];

export const RangeFilter: React.FC<Props> = ({ value, onChange, options }) => {
  const opts = options && options.length ? options : DEFAULT_OPTIONS;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? '' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={active ? { backgroundColor: '#1e3a8a', color: '#ffffff' } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
