import React from 'react';
import { KpiCardProps } from './types';
import { formatNumber, statusChipClass } from './format';
import { DeltaChip } from './DeltaChip';
import { Sparkline } from './Sparkline';

/**
 * Hero KPI card (spec §2). Layout rows:
 *  1. uppercase label + icon
 *  2. value + DeltaChip (or blue "New" chip when the previous period was 0)
 *  3. sparkline (omitted when no series / all-zero)
 *  4. footnote
 * Whole card is a button when onClick is provided, with a group-hover
 * "View calls →" affordance bottom-right.
 */
export const KpiCard: React.FC<KpiCardProps> = ({ spec }) => {
  const Icon = spec.icon;
  const interactive = Boolean(spec.onClick);

  // delta = current - previous, so previous = value - delta. Previous period
  // existed but was 0 while we now have data → blue "New" instead of a delta.
  const previous = spec.delta === null ? null : spec.value - spec.delta;
  const isNew = previous === 0 && spec.value > 0;

  const cardClass = [
    'card relative flex flex-col items-stretch text-left',
    spec.hero ? 'ring-1 ring-navy-950/20' : '',
    interactive
      ? 'group w-full cursor-pointer transition hover:border-navy-950 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-950'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {/* Row 1 — label + icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {spec.label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </div>

      {/* Row 2 — value + delta */}
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span
          className={`text-3xl font-semibold tabular-nums ${
            spec.hero ? 'text-navy-950' : 'text-gray-900'
          }`}
        >
          {spec.displayValue ?? formatNumber(spec.value)}
        </span>
        {isNew ? (
          <span className={statusChipClass('blue')} title="No activity in the previous period">
            New
          </span>
        ) : (
          <DeltaChip
            delta={spec.delta}
            deltaPercent={spec.deltaPercent}
            mode={spec.deltaMode}
            meaning={spec.meaning}
            formatValue={spec.formatDelta}
          />
        )}
      </div>

      {/* Row 3 — sparkline (Sparkline renders null for empty/all-zero) */}
      {spec.spark && <Sparkline values={spec.spark} className="mt-2 h-7 w-full text-navy-400" />}

      {/* Row 4 — footnote */}
      <p className="mt-1 text-xs text-gray-500">{spec.footnote}</p>
    </>
  );

  if (!interactive) {
    return <div className={cardClass}>{content}</div>;
  }

  return (
    <button type="button" onClick={spec.onClick} className={cardClass}>
      {content}
      <span
        className="pointer-events-none absolute bottom-2 right-3 text-xs font-medium text-navy-950 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      >
        View calls →
      </span>
    </button>
  );
};
