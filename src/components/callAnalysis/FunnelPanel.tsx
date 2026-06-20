// FunnelPanel — "From dial to instruction" (spec §3).
// Row-based funnel: each stage is a label + count + horizontal track holding a
// previous-period ghost bar under the current-period bar. Between rows a
// stage-conversion chip shows stageN/stageN-1 % with ±pts vs the previous period.

import React from 'react';
import { deltaTone, formatNumber, getRate } from './format';
import { FunnelPanelProps, FunnelStage } from './types';

const widthPercent = (value: number, scale: number) => {
  if (!scale || value <= 0) return 0;
  return Math.min(100, (value / scale) * 100);
};

const formatPts = (diff: number) => `${diff > 0 ? '+' : ''}${formatNumber(diff)} pts vs previous`;

interface StageRowProps {
  stage: FunnelStage;
  scale: number;
}

const StageRow: React.FC<StageRowProps> = ({ stage, scale }) => {
  const ghostWidth = widthPercent(stage.previous, scale);
  const rawCurrentWidth = widthPercent(stage.current, scale);
  const currentWidth = stage.current > 0 ? Math.max(4, rawCurrentWidth) : 0;

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-700">{stage.label}</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900">{formatNumber(stage.current)}</span>
      </div>
      <div
        className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
        title={`Previous period: ${formatNumber(stage.previous)}`}
      >
        {ghostWidth > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gray-300"
            style={{ width: `${ghostWidth}%` }}
          />
        )}
        {currentWidth > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-navy-950"
            style={{ width: `${currentWidth}%` }}
          />
        )}
      </div>
    </>
  );

  if (stage.onClick) {
    return (
      <button
        type="button"
        onClick={stage.onClick}
        className="-mx-2 block w-full cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-50"
        title={`View ${stage.label.toLowerCase()} calls`}
      >
        {content}
      </button>
    );
  }

  return <div className="-mx-2 px-2 py-1.5">{content}</div>;
};

interface ConversionLineProps {
  from: FunnelStage;
  to: FunnelStage;
}

const ConversionLine: React.FC<ConversionLineProps> = ({ from, to }) => {
  const conversion = getRate(to.current, from.current);
  const previousConversion = from.previous > 0 ? getRate(to.previous, from.previous) : null;
  const diff = previousConversion == null ? null : conversion - previousConversion;

  return (
    <div className="flex items-center gap-2 py-0.5 pl-2">
      <span
        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600"
        title={`${from.label} → ${to.label} conversion`}
      >
        {conversion}%
      </span>
      {diff != null && (
        <span className={`text-xs tabular-nums ${deltaTone('good-up', diff)}`}>{formatPts(diff)}</span>
      )}
    </div>
  );
};

export const FunnelPanel: React.FC<FunnelPanelProps> = ({ stages, caption }) => {
  const scale = stages[0]?.current ?? 0;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900">From dial to instruction</h3>

      {stages.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No call data for this period.</p>
      ) : (
        <div className="mt-3">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.key}>
              {index > 0 && <ConversionLine from={stages[index - 1]} to={stage} />}
              <StageRow stage={stage} scale={scale} />
            </React.Fragment>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">{caption}</p>
    </div>
  );
};
