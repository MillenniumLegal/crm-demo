// Min-max-scaled sparkline that amplifies variation (unlike Sparkline which is
// 0→max), coloured + signed by direction. For coaching-score momentum.

import React from 'react';

interface MiniTrendProps {
  values: number[];
  showDelta?: boolean;
  className?: string;
}

const W = 64;
const H = 20;
const PAD = 2;

export const MiniTrend: React.FC<MiniTrendProps> = ({ values, showDelta, className }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const delta = Math.round(values[values.length - 1] - values[0]);
  const tone = delta > 1 ? 'text-green-600' : delta < -1 ? 'text-red-600' : 'text-gray-400';

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`} title={`7-day trend (${delta > 0 ? '+' : ''}${delta})`}>
      <svg viewBox={`0 0 ${W} ${H}`} className={`h-4 w-16 ${tone}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showDelta && (
        <span className={`text-[10px] font-semibold tabular-nums ${tone}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  );
};
