// Bulk action bar (spec §7): navy-50 strip shown by the parent when rows are
// selected. Inline confirm replaces window.confirm for "Analyse with AI", and
// Dismiss collects one shared note via a popover textarea (no window.prompt).

import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, Sparkles, X, XCircle } from 'lucide-react';
import { BulkActionBarProps } from './types';
import { formatNumber } from './format';

const secondaryBtn =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  count,
  analyseCap,
  analysing,
  progress,
  onAnalyse,
  onDone,
  onDismiss,
  onExportSelected,
  onClear,
}) => {
  const [confirmingAnalyse, setConfirmingAnalyse] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [note, setNote] = useState('');
  const dismissRef = useRef<HTMLDivElement>(null);

  // Close the dismiss popover on outside click.
  useEffect(() => {
    if (!dismissOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (dismissRef.current && !dismissRef.current.contains(event.target as Node)) {
        setDismissOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [dismissOpen]);

  if (count <= 0) return null;

  const analyseCount = Math.min(count, analyseCap);

  const confirmAnalyse = () => {
    setConfirmingAnalyse(false);
    onAnalyse();
  };

  const confirmDismiss = () => {
    setDismissOpen(false);
    onDismiss(note.trim());
    setNote('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-4 py-2 text-sm">
      <span className="font-medium text-navy-950">
        <span className="tabular-nums">{formatNumber(count)}</span> selected
      </span>

      {analysing ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-950">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {progress || 'Analysing…'}
        </span>
      ) : confirmingAnalyse ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-700">
            Analyse <span className="tabular-nums font-medium">{formatNumber(analyseCount)}</span>{' '}
            {analyseCount === 1 ? 'call' : 'calls'}? ~2 min
          </span>
          <button type="button" onClick={confirmAnalyse} className="btn-primary">
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirmingAnalyse(false)}
            className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDismissOpen(false);
            setConfirmingAnalyse(true);
          }}
          className={secondaryBtn}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Analyse with AI
        </button>
      )}

      <button type="button" onClick={onDone} disabled={analysing} className={secondaryBtn}>
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Mark done
      </button>

      <div ref={dismissRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setConfirmingAnalyse(false);
            setDismissOpen((value) => !value);
          }}
          disabled={analysing}
          aria-expanded={dismissOpen}
          className={secondaryBtn}
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Dismiss
        </button>

        {dismissOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <label htmlFor="bulk-dismiss-note" className="mb-1 block text-xs font-medium text-gray-700">
              Dismiss <span className="tabular-nums">{formatNumber(count)}</span>{' '}
              {count === 1 ? 'call' : 'calls'} with one note
            </label>
            <textarea
              id="bulk-dismiss-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setDismissOpen(false);
              }}
              rows={3}
              autoFocus
              placeholder="Why are these being dismissed? (optional)"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-navy-950 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDismissOpen(false)}
                className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmDismiss} className="btn-primary">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <button type="button" onClick={onExportSelected} disabled={analysing} className={secondaryBtn}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export selected
      </button>

      <button
        type="button"
        onClick={onClear}
        title="Clear selection"
        className="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear selection
      </button>
    </div>
  );
};
