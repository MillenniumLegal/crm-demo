// AI coverage footer (spec §6.6): gray strip with transcript-analysis coverage
// and a thin progress bar; amber pulse while calls are still analysing.

import React from 'react';
import { AiCoverageFooterProps } from './types';
import { formatNumber, getRate } from './format';

export const AiCoverageFooter: React.FC<AiCoverageFooterProps> = ({
  aiAnalysed,
  transcriptsReceived,
  pendingAi,
}) => {
  const percent = Math.min(100, getRate(aiAnalysed, transcriptsReceived));

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-gray-600">
          APCM AI has analysed{' '}
          <span className="font-medium tabular-nums text-gray-900">{formatNumber(aiAnalysed)}</span> of{' '}
          <span className="font-medium tabular-nums text-gray-900">{formatNumber(transcriptsReceived)}</span>{' '}
          transcript-ready calls
        </p>
        {pendingAi > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
            <span className="tabular-nums">{formatNumber(pendingAi)}</span> analysing now
          </span>
        )}
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI analysis coverage"
      >
        <div className="h-full rounded-full bg-navy-950 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
