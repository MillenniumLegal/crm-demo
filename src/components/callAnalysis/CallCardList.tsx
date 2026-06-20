// Calls list for small screens (spec §7, <md alternative to CallsTable):
// one card per call — Row 1 lead + time, Row 2 direction + outcome + duration,
// Row 3 up to two priority flags, Row 4 View + kebab. Pure presentation; the
// row pieces (LeadCell, OutcomeChip, FlagChips, RowKebabMenu) are shared with
// CallsTable so the two views can never drift apart.

import React from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { CallCardListProps } from './types';
import { formatDuration, formatRelativeDayTime } from './format';
import {
  DirectionGlyph,
  FlagChips,
  getFlagChips,
  LeadCell,
  OutcomeChip,
  RowKebabMenu,
} from './CallsTable';

export const CallCardList: React.FC<CallCardListProps> = ({
  rows,
  selectedIds,
  onToggleSelected,
  analysingId,
  reviewingId,
  bookedMap,
  onOpenDrawer,
  onOpenLead,
  onLink,
  onSchedule,
  onAnalyse,
  onDone,
  onDismiss,
}) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No calls to show for this view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const analysing = analysingId === row.id;
        const reviewing = reviewingId === row.id;
        const hasFlags = getFlagChips(row, bookedMap).length > 0;

        return (
          <div
            key={row.id}
            onClick={() => onOpenDrawer(row)}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-navy-950"
          >
            {/* Row 1: select + lead + time */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="-m-2 inline-flex shrink-0 p-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer rounded border-gray-300 text-navy-950 focus:ring-navy-950 disabled:cursor-not-allowed disabled:opacity-40"
                    checked={selectedIds.has(row.id)}
                    disabled={!row.transcriptAvailable}
                    onChange={() => onToggleSelected(row)}
                    aria-label="Select call"
                    title={row.transcriptAvailable ? undefined : 'No transcript — cannot analyse'}
                  />
                </span>
                <span className="min-w-0 truncate text-sm">
                  <LeadCell row={row} />
                </span>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">
                {formatRelativeDayTime(row.startedAt)}
              </span>
            </div>

            {/* Row 2: direction + outcome + duration */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <DirectionGlyph direction={row.direction} />
              <OutcomeChip row={row} />
              <span className="text-xs text-gray-500 tabular-nums">
                {formatDuration(row.durationSeconds)}
              </span>
            </div>

            {/* Row 3: up to two priority flags */}
            {hasFlags && (
              <div className="mt-2">
                <FlagChips row={row} bookedMap={bookedMap} max={2} />
              </div>
            )}

            {/* Row 4: View + kebab */}
            <div
              className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onOpenDrawer(row)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-navy-950 transition-colors hover:border-navy-950 hover:bg-gray-50"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </button>
              <div className="flex items-center gap-1">
                {(analysing || reviewing) && (
                  <span title={analysing ? 'Analysing…' : 'Updating…'}>
                    <Loader2 className="h-4 w-4 animate-spin text-navy-950" />
                  </span>
                )}
                <RowKebabMenu
                  row={row}
                  analysing={analysing}
                  reviewing={reviewing}
                  onOpenLead={onOpenLead}
                  onLink={onLink}
                  onSchedule={onSchedule}
                  onAnalyse={onAnalyse}
                  onDone={onDone}
                  onDismiss={onDismiss}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
