// AI Insights — signal rate tiles (spec §6.1).
// Four clickable tiles over the AI-analysed call set; clicks apply a theme filter.

import React from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  LucideIcon,
  PoundSterling,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { SignalSummaryRowProps } from './types';
import { DeltaMeaning, deltaTone, formatNumber, getRate } from './format';

interface TileSpec {
  key: string;
  label: string;
  icon: LucideIcon;
  value: number;
  previousValue: number;
  meaning: DeltaMeaning;
  signalValue: string;
}

const DeltaCount: React.FC<{ delta: number; meaning: DeltaMeaning }> = ({ delta, meaning }) => {
  const tone = deltaTone(meaning, delta);
  if (delta === 0) {
    return (
      <span className={`text-xs ${tone}`} title="No change vs previous period">
        No change
      </span>
    );
  }
  const Arrow = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${tone}`}
      title="vs previous period"
    >
      <Arrow className="h-3 w-3" />
      {delta > 0 ? '+' : ''}
      {formatNumber(delta)}
    </span>
  );
};

export const SignalSummaryRow: React.FC<SignalSummaryRowProps> = ({
  overview,
  previous,
  aiAnalysed,
  pendingAi,
  onTileClick,
}) => {
  const tiles: TileSpec[] = [
    {
      key: 'objections',
      label: 'Calls with objections',
      icon: AlertCircle,
      value: overview.anyObjection,
      previousValue: previous.anyObjection,
      meaning: 'bad-up',
      signalValue: 'any_objection',
    },
    {
      key: 'price',
      label: 'Price concerns',
      icon: PoundSterling,
      value: overview.priceConcerns,
      previousValue: previous.priceConcerns,
      meaning: 'bad-up',
      signalValue: 'price objection',
    },
    {
      key: 'usp',
      label: 'Selling points mentioned',
      icon: Star,
      value: overview.uspMentions,
      previousValue: previous.uspMentions,
      meaning: 'good-up',
      signalValue: 'usp',
    },
    {
      key: 'positive',
      label: 'Positive buying signals',
      icon: ThumbsUp,
      value: overview.hasPositiveSignal,
      previousValue: previous.hasPositiveSignal,
      meaning: 'good-up',
      signalValue: 'positive_signal',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const delta = tile.value - tile.previousValue;
        const footnote =
          aiAnalysed > 0
            ? `${getRate(tile.value, aiAnalysed)}% of analysed calls`
            : 'No calls analysed yet';
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onTileClick(tile.signalValue)}
            className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-navy-950 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {tile.label}
              </span>
              <Icon className="h-4 w-4 shrink-0 text-gray-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-gray-900">
                {formatNumber(tile.value)}
              </span>
              {pendingAi > 0 && (
                <span
                  className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-amber-400"
                  title="May rise as AI finishes analysing"
                />
              )}
              <DeltaCount delta={delta} meaning={tile.meaning} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{footnote}</p>
          </button>
        );
      })}
    </div>
  );
};
