// Pipeline status strip (spec §1.2): plumbing lives here, never in KPIs.
// Collapsed one-liner from fetchThreeCxStatus; red-toned and auto-expanded when AI failures exist.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { PipelineStatusStripProps } from './types';
import { formatNumber, formatRelativeDayTime, sentenceCase } from './format';

export const PipelineStatusStrip: React.FC<PipelineStatusStripProps> = ({
  status,
  pendingAi,
  failedAi,
  canOpenSettings,
  onOpenSettings,
}) => {
  const broken = failedAi > 0;
  const [expanded, setExpanded] = useState(broken);

  // Auto-expand once when failures first appear (status often arrives async),
  // but never fight the user after they collapse it.
  const autoExpandedRef = useRef(broken);
  useEffect(() => {
    if (broken && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setExpanded(true);
    }
  }, [broken]);

  const toneClass = broken
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-gray-200 bg-gray-50 text-gray-500';

  const latestSync = status?.latestSync;
  const latestAiSync = status?.latestAiSync;

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${toneClass}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={expanded ? 'Hide pipeline details' : 'Show pipeline details'}
          className="flex flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
          <span>
            Last import {status ? formatRelativeDayTime(status.latestCdrImportAt) : 'loading…'}
            {' · '}
            <span className="tabular-nums">{formatNumber(pendingAi)}</span> awaiting AI analysis
            {' · '}
            <span className="tabular-nums">{formatNumber(failedAi)}</span> failed
          </span>
        </button>
        {canOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Open phone system settings"
            className={`flex shrink-0 cursor-pointer items-center gap-1 font-medium hover:underline ${
              broken ? 'text-red-700' : 'text-navy-950'
            }`}
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </button>
        )}
      </div>

      {expanded && (
        <div className={`mt-2 space-y-1 border-t pt-2 ${broken ? 'border-red-200' : 'border-gray-200'}`}>
          {latestSync ? (
            <p>
              Latest sync ({sentenceCase(latestSync.syncType)}): {sentenceCase(latestSync.status)}
              {' · '}
              <span className="tabular-nums">{formatNumber(latestSync.rowsProcessed)}</span> processed
              {' · '}
              <span className="tabular-nums">{formatNumber(latestSync.rowsFailed)}</span> failed
              {' · '}
              {formatRelativeDayTime(latestSync.createdAt)}
            </p>
          ) : (
            <p>No sync recorded yet.</p>
          )}
          <p>Latest webhook: {formatRelativeDayTime(status?.latestWebhookAt)}</p>
          {latestAiSync && (
            <p>
              AI sync {sentenceCase(latestAiSync.status)}
              {' · '}
              <span className="tabular-nums">{formatNumber(latestAiSync.rowsProcessed)}</span> processed
              {' · '}
              <span className="tabular-nums">{formatNumber(latestAiSync.rowsFailed)}</span> failed
              {latestAiSync.errorMessage ? ` — ${latestAiSync.errorMessage}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
