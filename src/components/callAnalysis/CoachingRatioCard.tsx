// AI Insights — "Selling value or hearing price?" (spec §6.2).
// Two paired horizontal bars: selling-point mentions vs price concerns,
// scaled to whichever is larger, with a plain-English coaching sentence.

import React from 'react';
import { CoachingRatioCardProps } from './types';
import { formatNumber } from './format';

interface BarRowSpec {
  label: string;
  value: number;
  barClass: string;
}

export const CoachingRatioCard: React.FC<CoachingRatioCardProps> = ({
  uspMentions,
  priceConcerns,
}) => {
  const max = Math.max(uspMentions, priceConcerns, 1);
  const widthPercent = (value: number) =>
    value > 0 ? Math.max((value / max) * 100, 4) : 0;

  const rows: BarRowSpec[] = [
    { label: 'Selling points mentioned', value: uspMentions, barClass: 'bg-navy-950' },
    { label: 'Price concerns', value: priceConcerns, barClass: 'bg-amber-400' },
  ];

  const nothingToShow = uspMentions === 0 && priceConcerns === 0;
  const needsFlip = priceConcerns > uspMentions;

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900">Selling value or hearing price?</h3>

      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-600">{row.label}</span>
              <span className="font-medium tabular-nums text-gray-900">
                {formatNumber(row.value)}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-gray-100">
              <div
                className={`h-2.5 rounded-full ${row.barClass}`}
                style={{ width: `${widthPercent(row.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {nothingToShow ? (
        <p className="mt-4 text-sm text-gray-500">
          No analysed calls mention selling points or price yet.
        </p>
      ) : needsFlip ? (
        <p className="mt-4 text-sm font-medium tabular-nums text-amber-700">
          Selling points came up in {formatNumber(uspMentions)} calls vs{' '}
          {formatNumber(priceConcerns)} price concerns — flip this ratio.
        </p>
      ) : (
        <p className="mt-4 text-sm font-medium tabular-nums text-green-700">
          Healthy: selling points ({formatNumber(uspMentions)}) outweigh price concerns (
          {formatNumber(priceConcerns)}).
        </p>
      )}
    </div>
  );
};
