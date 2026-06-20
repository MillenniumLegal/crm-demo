// Calls table 2.0 (spec §7): one outcome chip, an AI "What happened" sentence,
// max three priority flags and a kebab menu instead of the old chip soup.
// Pure presentation — rows, selection state and every callback arrive via props.
// Shared row pieces (OutcomeChip, FlagChips, LeadCell, RowKebabMenu) are exported
// for reuse by CallCardList (the <md alternative).

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  Eye,
  Link2,
  Loader2,
  MoreVertical,
  Sparkles,
  User,
} from 'lucide-react';
import { CallAnalysisRow } from '@/services/threecxService';
import { CallsTableProps } from './types';
import {
  ChipTone,
  formatDuration,
  formatRelativeDayTime,
  sentenceCase,
  statusChipClass,
} from './format';

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

const truncate = (text: string, max = 90) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const isInbound = (row: CallAnalysisRow) =>
  (row.direction || '').toLowerCase().startsWith('in');

const rowPhone = (row: CallAnalysisRow) =>
  row.normalizedPhone ||
  row.leadPhone ||
  (isInbound(row) ? row.callerNumber : row.calledNumber) ||
  row.callerNumber ||
  row.calledNumber ||
  'Unknown number';

export const DirectionGlyph: React.FC<{ direction?: string; className?: string }> = ({
  direction,
  className = 'h-3.5 w-3.5 text-gray-400',
}) => {
  const value = (direction || '').toLowerCase();
  if (value.startsWith('in')) {
    return (
      <span title="Inbound call" className="inline-flex shrink-0">
        <ArrowDownLeft className={className} aria-label="Inbound" />
      </span>
    );
  }
  if (value.startsWith('out')) {
    return (
      <span title="Outbound call" className="inline-flex shrink-0">
        <ArrowUpRight className={className} aria-label="Outbound" />
      </span>
    );
  }
  return null;
};

// ---------------------------------------------------------------------------
// Lead cell — bold name, or "Not linked · number" with the amber dot
// ---------------------------------------------------------------------------

export const LeadCell: React.FC<{ row: CallAnalysisRow }> = ({ row }) => {
  if (row.leadName) {
    return <span className="font-semibold text-gray-900">{row.leadName}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-gray-600"
      title="Not linked to a lead"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
      <span className="whitespace-nowrap">Not linked · {rowPhone(row)}</span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Outcome — ONE chip (client-side mirror of uniqueContactClassification)
// plus the tiny "2nd try" / "3rd+ try" attempt note
// ---------------------------------------------------------------------------

const outcomeFor = (row: CallAnalysisRow): { label: string; tone: ChipTone | 'amber-outline' } => {
  if (row.isOutboundAnswered) return { label: 'Spoke to client', tone: 'green' };
  if (row.isOutboundVoicemail || row.voicemailDetected) return { label: 'Voicemail', tone: 'gray' };
  if (row.isInboundHotCall) return { label: 'Hot inbound', tone: 'emerald' };
  if (row.isPossibleHotCall) return { label: 'Possible hot', tone: 'amber-outline' };
  if (row.isOutboundSalesCall) return { label: 'No answer', tone: 'amber' };
  return { label: sentenceCase(row.callStatus), tone: 'gray' };
};

export const OutcomeChip: React.FC<{ row: CallAnalysisRow }> = ({ row }) => {
  const outcome = outcomeFor(row);
  const attempt = row.outboundAttemptNumber ?? 0;
  const attemptLabel = attempt >= 3 ? '3rd+ try' : attempt === 2 ? '2nd try' : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {outcome.tone === 'amber-outline' ? (
        <span className="inline-flex items-center rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-700">
          {outcome.label}
        </span>
      ) : (
        <span className={statusChipClass(outcome.tone)}>{outcome.label}</span>
      )}
      {attemptLabel && <span className="text-[11px] text-gray-500">{attemptLabel}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Flags — priority-ordered chips, capped with a "+N" overflow
// ---------------------------------------------------------------------------

export interface FlagChipSpec {
  key: string;
  label: string;
  tone: ChipTone;
}

export const getFlagChips = (
  row: CallAnalysisRow,
  bookedMap: Record<string, boolean>,
): FlagChipSpec[] => {
  const chips: FlagChipSpec[] = [];
  if (row.managerRiskFlags.length > 0) {
    chips.push({ key: 'manager', label: 'Flagged for a manager', tone: 'red' });
  }
  if (row.anyObjection) {
    chips.push({
      key: 'objection',
      label: `Objection: ${row.objectionCategory || 'general'}`,
      tone: 'red',
    });
  }
  if (row.instructionIntent) {
    chips.push({ key: 'intent', label: 'Likely to instruct', tone: 'emerald' });
  }
  if (row.followUpRequired && !bookedMap[row.id]) {
    chips.push({ key: 'callback', label: 'Call-back not booked', tone: 'amber' });
  }
  if (row.isOfficialInstruction) {
    chips.push({ key: 'instructed', label: 'Instructed', tone: 'green' });
  }
  return chips;
};

export const FlagChips: React.FC<{
  row: CallAnalysisRow;
  bookedMap: Record<string, boolean>;
  max: number;
}> = ({ row, bookedMap, max }) => {
  const chips = getFlagChips(row, bookedMap);
  if (chips.length === 0) return null;
  const visible = chips.slice(0, max);
  const overflow = chips.length - visible.length;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((chip) => (
        <span key={chip.key} className={statusChipClass(chip.tone)}>
          {chip.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-gray-500" title="Open the call to see all flags">
          +{overflow}
        </span>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Kebab menu — Open lead / Link / Book call-back / Analyse / Done / Dismiss
// ---------------------------------------------------------------------------

export interface RowKebabMenuProps {
  row: CallAnalysisRow;
  analysing: boolean;
  reviewing: boolean;
  onOpenLead: (leadId: string) => void;
  onLink: (row: CallAnalysisRow) => void;
  onSchedule: (row: CallAnalysisRow) => void;
  onAnalyse: (row: CallAnalysisRow) => void;
  onDone: (row: CallAnalysisRow) => void;
  onDismiss: (row: CallAnalysisRow, note: string) => void;
}

const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

export const RowKebabMenu: React.FC<RowKebabMenuProps> = ({
  row,
  analysing,
  reviewing,
  onOpenLead,
  onLink,
  onSchedule,
  onAnalyse,
  onDone,
  onDismiss,
}) => {
  const [open, setOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [note, setNote] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setDismissOpen(false);
        setNote('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setDismissOpen(false);
    setNote('');
  };

  const analyseLabel =
    row.aiAnalysisStatus === 'completed' || row.aiAnalysisStatus === 'failed'
      ? 'Re-analyse'
      : 'Analyse';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        title="More actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
          setDismissOpen(false);
          setNote('');
        }}
        className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-950"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {row.leadId && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                closeMenu();
                onOpenLead(row.leadId as string);
              }}
            >
              <User className="h-3.5 w-3.5 text-gray-400" />
              Open lead
            </button>
          )}
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              closeMenu();
              onLink(row);
            }}
          >
            <Link2 className="h-3.5 w-3.5 text-gray-400" />
            Link to lead
          </button>
          <button
            type="button"
            className={menuItemClass}
            disabled={!row.leadId}
            title={!row.leadId ? 'Link this call to a lead to schedule a follow-up' : undefined}
            onClick={() => {
              closeMenu();
              onSchedule(row);
            }}
          >
            <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
            Book call-back
          </button>
          <button
            type="button"
            className={menuItemClass}
            disabled={!row.transcriptAvailable || analysing}
            title={!row.transcriptAvailable ? 'Awaiting transcript' : undefined}
            onClick={() => {
              closeMenu();
              onAnalyse(row);
            }}
          >
            {analysing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-navy-950" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-gray-400" />
            )}
            {analysing ? 'Analysing…' : analyseLabel}
          </button>
          <button
            type="button"
            className={menuItemClass}
            disabled={row.reviewStatus === 'reviewed' || reviewing}
            title={row.reviewStatus === 'reviewed' ? 'Already marked as done' : undefined}
            onClick={() => {
              closeMenu();
              onDone(row);
            }}
          >
            {reviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-navy-950" />
            ) : (
              <Check className="h-3.5 w-3.5 text-gray-400" />
            )}
            Done
          </button>

          {dismissOpen ? (
            <div className="border-t border-gray-100 px-3 py-2">
              <label className="text-xs font-medium text-gray-700" htmlFor={`dismiss-note-${row.id}`}>
                Dismiss with a note
              </label>
              <input
                id={`dismiss-note-${row.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note (optional)"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-navy-950 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-navy-950 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-navy-800"
                  onClick={() => {
                    onDismiss(row, note.trim());
                    closeMenu();
                  }}
                >
                  Confirm dismiss
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  onClick={() => {
                    setDismissOpen(false);
                    setNote('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`${menuItemClass} border-t border-gray-100`}
              onClick={() => setDismissOpen(true)}
            >
              <Ban className="h-3.5 w-3.5 text-gray-400" />
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// "What happened" cell — AI summary with honest fallbacks
// ---------------------------------------------------------------------------

const WhatHappenedCell: React.FC<{
  row: CallAnalysisRow;
  analysing: boolean;
  onAnalyse: (row: CallAnalysisRow) => void;
}> = ({ row, analysing, onAnalyse }) => {
  if (row.summary) {
    return (
      <p className="text-sm text-gray-700" title={row.summary}>
        {truncate(row.summary)}
      </p>
    );
  }

  if (analysing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Analysing…
      </span>
    );
  }

  if (row.aiAnalysisStatus === 'failed') {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAnalyse(row);
        }}
        className="cursor-pointer text-left text-sm font-medium text-red-700 hover:underline"
        title="Run APCM AI analysis again"
      >
        AI analysis failed — retry
      </button>
    );
  }

  if (row.transcriptAvailable && row.aiAnalysisStatus !== 'completed') {
    return <span className="text-sm text-amber-600">Awaiting AI analysis</span>;
  }

  if (!row.transcriptAvailable) {
    return <span className="text-sm text-gray-500">Awaiting transcript</span>;
  }

  return (
    <span className="text-sm text-gray-400" title="No AI summary recorded for this call">
      —
    </span>
  );
};

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

const headerCellClass =
  'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';

export const CallsTable: React.FC<CallsTableProps> = ({
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5">
              <span className="sr-only">Select</span>
            </th>
            <th scope="col" className={headerCellClass}>
              When
            </th>
            <th scope="col" className={headerCellClass}>
              Lead
            </th>
            <th scope="col" className={headerCellClass}>
              Agent
            </th>
            <th scope="col" className={headerCellClass}>
              Outcome
            </th>
            <th scope="col" className={headerCellClass}>
              What happened
            </th>
            <th scope="col" className={headerCellClass}>
              Flags
            </th>
            <th scope="col" className={`${headerCellClass} text-right`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                No calls to show for this view.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const analysing = analysingId === row.id;
            const reviewing = reviewingId === row.id;

            return (
              <tr
                key={row.id}
                onClick={() => onOpenDrawer(row)}
                className="cursor-pointer transition-colors hover:bg-gray-50"
              >
                <td
                  className="px-3 py-3 align-top"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-navy-950 focus:ring-navy-950 disabled:cursor-not-allowed disabled:opacity-40"
                    checked={selectedIds.has(row.id)}
                    disabled={!row.transcriptAvailable}
                    onChange={() => onToggleSelected(row)}
                    aria-label={`Select call with ${row.leadName || rowPhone(row)}`}
                    title={row.transcriptAvailable ? undefined : 'No transcript — cannot analyse'}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top">
                  <p className="text-sm font-medium text-gray-900">
                    {formatRelativeDayTime(row.startedAt)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <DirectionGlyph direction={row.direction} />
                    <span className="tabular-nums">{formatDuration(row.durationSeconds)}</span>
                  </p>
                </td>
                <td className="px-3 py-3 align-top text-sm">
                  <LeadCell row={row} />
                </td>
                <td className="px-3 py-3 align-top text-sm">
                  {row.agentName ? (
                    <span className="text-gray-700">{row.agentName}</span>
                  ) : (
                    <span
                      className="whitespace-nowrap text-gray-500"
                      title="Extension not mapped to a user"
                    >
                      Unmapped ext. {row.agentExtension || '?'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <OutcomeChip row={row} />
                </td>
                <td className="max-w-[300px] px-3 py-3 align-top">
                  <WhatHappenedCell row={row} analysing={analysing} onAnalyse={onAnalyse} />
                </td>
                <td className="max-w-[240px] px-3 py-3 align-top">
                  <FlagChips row={row} bookedMap={bookedMap} max={3} />
                  {getFlagChips(row, bookedMap).length === 0 && (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </td>
                <td
                  className="px-3 py-3 align-top"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    {(analysing || reviewing) && (
                      <span title={analysing ? 'Analysing…' : 'Updating…'}>
                        <Loader2 className="h-4 w-4 animate-spin text-navy-950" />
                      </span>
                    )}
                    <button
                      type="button"
                      title="Open call details"
                      onClick={() => onOpenDrawer(row)}
                      className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-950"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
