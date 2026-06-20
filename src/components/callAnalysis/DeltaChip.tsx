import React from 'react';
import { DeltaChipProps } from './types';
import { deltaTone, formatNumber } from './format';

// U+2212 minus sign — visually balanced against "+" unlike the ASCII hyphen.
const MINUS = '−';

const signOf = (value: number) => (value > 0 ? '+' : value < 0 ? MINUS : '');

/**
 * Compact "vs previous period" delta indicator.
 *
 * - `delta` null (no previous data at all) → gray em-dash chip.
 * - mode 'percent'        → "+12%" (falls back to the count when deltaPercent
 *   is null; "New" presentation for prev = 0 is handled by the card).
 * - mode 'count'          → "+3"
 * - mode 'count+percent'  → "+3 (+12%)"
 *
 * Colour is by MEANING via deltaTone, never by sign.
 */
export const DeltaChip: React.FC<DeltaChipProps> = ({
  delta,
  deltaPercent,
  mode,
  meaning,
  formatValue,
}) => {
  if (delta === null) {
    return (
      <span
        className="inline-flex items-center text-xs font-medium tabular-nums text-gray-400"
        title="No data for the previous period"
      >
        —
      </span>
    );
  }

  const formatCount = formatValue ?? formatNumber;
  const countText = `${signOf(delta)}${formatCount(Math.abs(delta))}`;
  const percentText =
    deltaPercent === null
      ? null
      : `${signOf(deltaPercent)}${formatNumber(Math.round(Math.abs(deltaPercent)))}%`;

  let text: string;
  if (mode === 'count') {
    text = countText;
  } else if (mode === 'percent') {
    text = percentText ?? countText;
  } else {
    text = percentText === null ? countText : `${countText} (${percentText})`;
  }

  return (
    <span
      className={`inline-flex items-center text-xs font-medium tabular-nums ${deltaTone(meaning, delta)}`}
      title="vs previous period"
    >
      {text}
    </span>
  );
};
