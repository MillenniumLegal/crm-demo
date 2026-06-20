// CallDrawer (spec §7): right-hand slide-over replacing the old Call Review and
// APCM AI Analysis modals. Content order: header → flag banner → AI summary →
// next action → signals → transcript → admin footer. Pure presentation — all
// data and callbacks arrive via props; internal state covers the transcript
// toggle, find-in-transcript query, dismiss-note popover and copy feedback only.

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarPlus,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { CallAnalysisRow } from '@/services/threecxService';
import { CallDrawerProps } from './types';
import {
  confidenceLabel,
  confidenceTone,
  formatDuration,
  formatNumber,
  formatRelativeDayTime,
  isLowConfidence,
  sentenceCase,
  statusChipClass,
} from './format';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const possibleHotChipClass =
  'inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700';

// Same outcome logic as the calls table — ONE chip per call.
const outcomeChipFor = (row: CallAnalysisRow): { label: string; className: string } | null => {
  if (row.isInboundHotCall) return { label: 'Hot inbound', className: statusChipClass('emerald') };
  if (row.isPossibleHotCall) return { label: 'Possible hot', className: possibleHotChipClass };
  if (row.isOutboundAnswered) return { label: 'Spoke to client', className: statusChipClass('green') };
  if (row.isOutboundVoicemail) return { label: 'Voicemail', className: statusChipClass('gray') };
  if (row.isOutboundSalesCall) return { label: 'No answer', className: statusChipClass('amber') };
  return null;
};

const attemptLabel = (attempt?: number) => {
  if (!attempt || attempt < 2) return null;
  return attempt === 2 ? '2nd try' : '3rd+ try';
};

const aiStatusLabel: Record<CallAnalysisRow['aiAnalysisStatus'], string> = {
  not_analyzed: 'Awaiting AI analysis',
  analyzing: 'Analysing',
  completed: 'Analysed by AI',
  failed: 'AI analysis failed',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countMatches = (text: string, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return 0;
  return (text.match(new RegExp(escapeRegExp(trimmed), 'gi')) ?? []).length;
};

// Simple find-in-transcript: split on the query, wrap hits in <mark>.
const renderHighlighted = (text: string, query: string): React.ReactNode => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={index} className="rounded-sm bg-amber-200 px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
);

const secondaryBtn =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CallDrawer: React.FC<CallDrawerProps> = ({
  row,
  onClose,
  queue,
  analysing,
  reviewing,
  bookedMap,
  onOpenLead,
  onLink,
  onSchedule,
  onAnalyse,
  onDone,
  onDismiss,
}) => {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissNote, setDismissNote] = useState('');
  const [copied, setCopied] = useState(false);

  const rowId = row?.id;

  // Reset transient UI state when stepping between calls (queue mode).
  useEffect(() => {
    setTranscriptOpen(false);
    setTranscriptQuery('');
    setDismissOpen(false);
    setDismissNote('');
    setCopied(false);
  }, [rowId]);

  // Keyboard triage: j/ArrowRight = next, k/ArrowLeft = previous, Escape = close.
  useEffect(() => {
    if (!row) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (!queue) return;
      if (event.key === 'j' || event.key === 'ArrowRight') {
        event.preventDefault();
        queue.onNext();
      } else if (event.key === 'k' || event.key === 'ArrowLeft') {
        event.preventDefault();
        queue.onPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [row, queue, onClose]);

  if (!row) return null;

  const phone = row.leadPhone || row.normalizedPhone || row.callerNumber || row.calledNumber;
  const title = row.leadName || phone || 'Unknown caller';
  const agentLabel =
    row.agentName || (row.agentExtension ? `Unmapped ext. ${row.agentExtension}` : 'Unknown agent');
  const outcome = outcomeChipFor(row);
  const attempt = attemptLabel(row.outboundAttemptNumber);
  const leadId = row.leadId;
  const booked = !!bookedMap[row.id];
  const reviewed = row.reviewStatus === 'reviewed';
  const recordingIsUrl = !!row.recordingReference && row.recordingReference.startsWith('http');

  const lowConf = isLowConfidence(row.confidence);
  const aiChipTitle = lowConf ? 'Low AI confidence — verify against transcript' : undefined;
  const aiChipOpacity = lowConf ? ' opacity-70' : '';

  const hasFlagBanner = row.managerRiskFlags.length > 0 || !!row.anyObjection || !!row.priceConcern;
  const hasSignals =
    row.objections.length > 0 ||
    row.positiveSignals.length > 0 ||
    row.tags.length > 0 ||
    !!row.objectionCategory ||
    !!row.knockBackReason ||
    !!row.rejectionReason ||
    !!row.uspMentioned;

  const aiPending = row.aiAnalysisStatus === 'analyzing' || analysing;
  const matchCount = row.transcript ? countMatches(row.transcript, transcriptQuery) : 0;

  const handleCopyRecording = () => {
    if (!row.recordingReference) return;
    void navigator.clipboard?.writeText(row.recordingReference).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const confirmDismiss = () => {
    onDismiss(row, dismissNote.trim());
    setDismissOpen(false);
    setDismissNote('');
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Call details — ${title}`}
        className="absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-w-2xl"
      >
        {/* 1. Header */}
        <div className="bg-gradient-to-r from-navy-950 to-navy-800 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{title}</h2>
              {row.leadName && phone && <p className="text-sm text-white/70 tabular-nums">{phone}</p>}
              {!leadId && (
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                  Not linked to a lead
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="shrink-0 cursor-pointer rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-2 text-sm text-white/70">
            {agentLabel} · {formatRelativeDayTime(row.startedAt)} ·{' '}
            <span className="tabular-nums">{formatDuration(row.durationSeconds)}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {outcome && <span className={outcome.className}>{outcome.label}</span>}
            {attempt && <span className="text-xs font-medium text-white/80">{attempt}</span>}
            <span className={statusChipClass(confidenceTone(row.confidence))}>
              {confidenceLabel(row.confidence)}
            </span>
          </div>

          {row.recordingReference && (
            <div className="mt-3 flex items-center gap-2">
              {recordingIsUrl ? (
                <a
                  href={row.recordingReference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Listen to recording
                </a>
              ) : (
                <>
                  <span className="break-all font-mono text-xs text-white/80">
                    {row.recordingReference}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRecording}
                    title={copied ? 'Copied' : 'Copy recording reference'}
                    className="shrink-0 cursor-pointer rounded-md border border-white/20 p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-300" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Queue chrome */}
        {queue && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-6 py-2.5">
            <p className="text-sm font-medium text-navy-950">
              <span className="tabular-nums">
                Call {formatNumber(queue.index + 1)} of {formatNumber(queue.total)}
              </span>{' '}
              — {queue.title}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={queue.onPrev}
                title="Previous call (k)"
                className="cursor-pointer rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={queue.onNext}
                title="Next call (j)"
                className="cursor-pointer rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={queue.onDoneAndNext}
                disabled={reviewing}
                className="btn-primary inline-flex cursor-pointer items-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Done & next
              </button>
            </div>
          </div>
        )}

        {/* 2. Flag banner */}
        {hasFlagBanner && (
          <div className="flex items-start gap-3 border-l-4 border-red-600 bg-red-50 px-6 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-700">Flagged for attention</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.managerRiskFlags.map((flag) => (
                  <span key={flag} className={statusChipClass('red')}>
                    {sentenceCase(flag)}
                  </span>
                ))}
                {row.anyObjection && (
                  <span className={statusChipClass('red')}>
                    {row.objectionCategory
                      ? `Objection: ${sentenceCase(row.objectionCategory)}`
                      : 'Objection raised'}
                  </span>
                )}
                {row.priceConcern && <span className={statusChipClass('red')}>Price concern</span>}
              </div>
            </div>
          </div>
        )}

        {/* 3. AI summary */}
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <SectionHeading>AI summary</SectionHeading>
          </div>
          {row.aiAnalysisStatus === 'completed' ? (
            <>
              <p className="mt-2 text-sm text-gray-800">
                {row.summary || 'No summary provided by the AI.'}
              </p>
              {(row.callType || row.outcome) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.callType && (
                    <span title={aiChipTitle} className={`${statusChipClass('navy')}${aiChipOpacity}`}>
                      {sentenceCase(row.callType)}
                    </span>
                  )}
                  {row.outcome && (
                    <span title={aiChipTitle} className={`${statusChipClass('gray')}${aiChipOpacity}`}>
                      {sentenceCase(row.outcome)}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : row.aiAnalysisStatus === 'failed' ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-700">AI analysis failed</p>
              <button
                type="button"
                onClick={() => onAnalyse(row)}
                disabled={analysing}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analysing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {analysing ? 'Analysing…' : 'Analyse'}
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              {aiPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {aiPending ? 'Analysing…' : 'Awaiting AI analysis'}
            </div>
          )}
        </div>

        {/* 4. Next action */}
        <div className="border-b border-gray-100 px-6 py-4">
          <SectionHeading>Next action</SectionHeading>
          <p className="mt-2 text-sm text-gray-800">
            {row.recommendedAction || 'No recommended action from the AI.'}
          </p>
          {booked && (
            <p className="mt-2">
              <span className={statusChipClass('green')}>
                <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" />
                Call-back booked
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSchedule(row)}
              disabled={!leadId}
              title={
                leadId
                  ? 'Book a call-back for this lead'
                  : 'Link this call to a lead to schedule a follow-up'
              }
              className="btn-primary inline-flex cursor-pointer items-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Book the call-back
            </button>
            <button type="button" onClick={() => onLink(row)} className={secondaryBtn}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Link to lead
            </button>
            {leadId && (
              <button type="button" onClick={() => onOpenLead(leadId)} className={secondaryBtn}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open lead
              </button>
            )}
            <button
              type="button"
              onClick={() => onDone(row)}
              disabled={reviewed || reviewing}
              title={reviewed ? 'Already marked as done' : 'Mark this call as done'}
              className={secondaryBtn}
            >
              {reviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Done
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDismissOpen((open) => !open)}
                disabled={reviewing}
                title="Dismiss this call with a note"
                className={secondaryBtn}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Dismiss
              </button>
              {dismissOpen && (
                <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <label
                    htmlFor={`dismiss-note-${row.id}`}
                    className="block text-xs font-medium text-gray-700"
                  >
                    Why is this call being dismissed?
                  </label>
                  <textarea
                    id={`dismiss-note-${row.id}`}
                    rows={3}
                    value={dismissNote}
                    onChange={(event) => setDismissNote(event.target.value)}
                    placeholder="e.g. Wrong number — not a sales call"
                    className="mt-1.5 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-navy-950 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDismissOpen(false);
                        setDismissNote('');
                      }}
                      className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDismiss}
                      className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    >
                      Dismiss call
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Signals */}
        <div className="border-b border-gray-100 px-6 py-4">
          <SectionHeading>Signals</SectionHeading>
          {hasSignals ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.objections.map((objection) => (
                <span
                  key={`objection-${objection}`}
                  title={aiChipTitle}
                  className={`${statusChipClass('red')}${aiChipOpacity}`}
                >
                  {sentenceCase(objection)}
                </span>
              ))}
              {row.objectionCategory && (
                <span title={aiChipTitle} className={`${statusChipClass('red')}${aiChipOpacity}`}>
                  Category: {sentenceCase(row.objectionCategory)}
                </span>
              )}
              {row.knockBackReason && (
                <span title={aiChipTitle} className={`${statusChipClass('red')}${aiChipOpacity}`}>
                  Knock-back: {sentenceCase(row.knockBackReason)}
                </span>
              )}
              {row.rejectionReason && (
                <span title={aiChipTitle} className={`${statusChipClass('red')}${aiChipOpacity}`}>
                  Rejection: {sentenceCase(row.rejectionReason)}
                </span>
              )}
              {row.positiveSignals.map((signal) => (
                <span
                  key={`signal-${signal}`}
                  title={aiChipTitle}
                  className={`${statusChipClass('green')}${aiChipOpacity}`}
                >
                  {sentenceCase(signal)}
                </span>
              ))}
              {row.uspMentioned && (
                <span title={aiChipTitle} className={`${statusChipClass('emerald')}${aiChipOpacity}`}>
                  Selling points mentioned
                </span>
              )}
              {row.tags.map((tag) => (
                <span
                  key={`tag-${tag}`}
                  title={aiChipTitle}
                  className={`${statusChipClass('gray')}${aiChipOpacity}`}
                >
                  {sentenceCase(tag)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No AI signals recorded for this call.</p>
          )}
        </div>

        {/* 6. Transcript */}
        <div className="border-b border-gray-100 px-6 py-4">
          {row.cdrSummary && (
            <div className="mb-3">
              <SectionHeading>Phone system summary</SectionHeading>
              <p className="mt-1 text-sm text-gray-600">{row.cdrSummary}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTranscriptOpen((open) => !open)}
            aria-expanded={transcriptOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
          >
            <SectionHeading>Transcript</SectionHeading>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${transcriptOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {transcriptOpen &&
            (row.transcript ? (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={transcriptQuery}
                    onChange={(event) => setTranscriptQuery(event.target.value)}
                    placeholder="Find in transcript"
                    className="w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-navy-950 focus:outline-none"
                  />
                </div>
                {transcriptQuery.trim() && (
                  <p className="text-xs text-gray-500 tabular-nums">
                    {formatNumber(matchCount)} {matchCount === 1 ? 'match' : 'matches'}
                  </p>
                )}
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800">
                  {renderHighlighted(row.transcript, transcriptQuery)}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No transcript available for this call.</p>
            ))}
        </div>

        {/* 7. Admin footer */}
        <div className="space-y-1 border-t border-gray-200 px-6 py-4 text-xs text-gray-500">
          <p>
            <span className="font-medium text-gray-600">Match:</span> {sentenceCase(row.matchStatus)}
            {row.matchReason ? ` — ${row.matchReason}` : ''}
          </p>
          <p>
            <span className="font-medium text-gray-600">Confidence:</span>{' '}
            {confidenceLabel(row.confidence)}
            {row.confidenceReason ? ` — ${row.confidenceReason}` : ''}
          </p>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>
              <span className="font-medium text-gray-600">AI status:</span>{' '}
              {aiStatusLabel[row.aiAnalysisStatus]}
            </span>
            <button
              type="button"
              onClick={() => onAnalyse(row)}
              disabled={analysing}
              title="Run APCM AI analysis again for this call"
              className="inline-flex cursor-pointer items-center gap-1 font-medium text-navy-950 underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analysing && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {analysing ? 'Analysing…' : 'Re-analyse'}
            </button>
          </p>
          {(row.reviewedByName || row.reviewedAt || row.reviewNote) && (
            <p>
              <span className="font-medium text-gray-600">Review:</span>{' '}
              {row.reviewStatus === 'ignored' ? 'Dismissed' : 'Done'} by{' '}
              {row.reviewedByName || 'unknown'}
              {row.reviewedAt ? ` — ${formatRelativeDayTime(row.reviewedAt)}` : ''}
              {row.reviewNote ? ` — “${row.reviewNote}”` : ''}
            </p>
          )}
          {(row.manualLinkedByName || row.manualLinkedAt) && (
            <p>
              <span className="font-medium text-gray-600">Manual link:</span> by{' '}
              {row.manualLinkedByName || 'unknown'}
              {row.manualLinkedAt ? ` — ${formatRelativeDayTime(row.manualLinkedAt)}` : ''}
              {row.manualLinkReason ? ` — ${row.manualLinkReason}` : ''}
            </p>
          )}
          <p>
            <span className="font-medium text-gray-600">3CX ID:</span>{' '}
            <span className="font-mono">{row.threecxCallId}</span>
          </p>
          {row.leadOwnerName && (
            <p>
              <span className="font-medium text-gray-600">Lead owner:</span> {row.leadOwnerName}
            </p>
          )}
          {row.leadEmail && (
            <p>
              <span className="font-medium text-gray-600">Lead email:</span> {row.leadEmail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
