// Firm-wide objection handling, worst handled first — the headline coaching board.
// Each category is a clickable drill: a 100%-stacked quality bar (strong / adequate /
// weak) plus the representative client objection, sorted so the most poorly handled
// objections surface at the top where the firm owner can act on them.

import React from 'react';
import { ChevronRight, Quote } from 'lucide-react';
import { formatNumber, getRate } from './format';

export interface ObjectionCategory {
  category: string;
  count: number;
  strong: number;
  adequate: number;
  weak: number;
  quote?: string;
}

interface ObjectionBoardProps {
  categories: ObjectionCategory[];
  onDrill?: (category: string) => void;
}

const QUALITY_SEGMENTS: Array<{ key: 'strong' | 'adequate' | 'weak'; label: string; barClass: string; dotClass: string }> = [
  { key: 'strong', label: 'Strong', barClass: 'bg-green-500', dotClass: 'bg-green-500' },
  { key: 'adequate', label: 'Adequate', barClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
  { key: 'weak', label: 'Weak', barClass: 'bg-red-500', dotClass: 'bg-red-500' },
];

// Green when objections are mostly handled well, red when they collapse.
const handledWellTone = (share: number) =>
  share >= 0.6 ? 'text-green-700' : share >= 0.4 ? 'text-amber-600' : 'text-red-700';

export const ObjectionBoard: React.FC<ObjectionBoardProps> = ({ categories, onDrill }) => {
  const rows = [...categories]
    .map((cat) => {
      const graded = cat.strong + cat.adequate + cat.weak;
      const handledWell = graded > 0 ? cat.strong / graded : 0;
      return { cat, graded, handledWell };
    })
    .sort((a, b) => a.handledWell - b.handledWell);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Objection handling — worst handled first</h3>
        <div className="flex items-center gap-3">
          {QUALITY_SEGMENTS.map((segment) => (
            <span key={segment.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`h-2 w-2 rounded-full ${segment.dotClass}`} />
              {segment.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">Click a category to hear the exact exchanges</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ cat, graded, handledWell }) => {
            const urgent = handledWell < 0.4;
            const wellPct = Math.round(handledWell * 100);
            return (
              <li key={cat.category}>
                <button
                  type="button"
                  onClick={() => onDrill?.(cat.category)}
                  title={`${cat.category} — ${wellPct}% handled well across ${formatNumber(cat.count)} objections`}
                  className={`group w-full rounded-lg border p-3 text-left transition hover:shadow ${
                    urgent
                      ? 'border-red-200 bg-red-50 hover:border-red-300'
                      : 'border-gray-100 bg-white hover:border-navy-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-gray-900">{cat.category}</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums">
                      {formatNumber(cat.count)}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <span className={`text-sm font-semibold tabular-nums ${handledWellTone(handledWell)}`}>
                        {wellPct}%
                      </span>
                      <span className="text-[11px] text-gray-400">handled well</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-navy-600" />
                    </span>
                  </div>

                  <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    {QUALITY_SEGMENTS.map((segment) => {
                      const value = cat[segment.key];
                      if (graded <= 0 || value <= 0) return null;
                      return (
                        <span
                          key={segment.key}
                          className={`h-full bg-gradient-to-r ${segment.barClass} first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${(value / graded) * 100}%` }}
                          title={`${segment.label}: ${formatNumber(value)} (${getRate(value, graded)}%)`}
                        />
                      );
                    })}
                  </div>

                  {cat.quote && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs italic text-gray-500">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                      <span className="truncate">&ldquo;{cat.quote}&rdquo;</span>
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
