// Reusable premium time-range filter chip bar (Today / 7d / 30d / 90d / Year / All).
// Pages hold the selected key and scale/refetch their data off it.

import React from 'react';

interface RangeOption { key: string; label: string; }
interface Props { value: string; onChange: (v: string) => void; options?: RangeOption[]; }

export const RANGE_SCALE: Record<string, number> = {
  today: 0.04, '7d': 0.25, '30d': 1, '90d': 3, year: 12, all: 18,
};

export const RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  year: 'Year',
  all: 'All time',
};

const DEFAULT_OPTIONS: RangeOption[] = [
  { key: 'today', label: RANGE_LABELS.today },
  { key: '7d', label: RANGE_LABELS['7d'] },
  { key: '30d', label: RANGE_LABELS['30d'] },
  { key: '90d', label: RANGE_LABELS['90d'] },
  { key: 'year', label: RANGE_LABELS.year },
  { key: 'all', label: RANGE_LABELS.all },
];

export const rangeLabel = (value: string): string => RANGE_LABELS[value] ?? value;

export const scaleRangeCount = (value: number, range: string): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.round(value * (RANGE_SCALE[range] ?? 1)));
};

export const scaleRangeMoney = (value: number, range: string): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.round(value * (RANGE_SCALE[range] ?? 1)));
};

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
