// Premium semicircular coaching-score gauge (0–100), tone-banded. Pure SVG.

import React from 'react';
import { scoreTone, scoreBandLabel } from './coaching';

interface RadialScoreGaugeProps {
  score: number;
  size?: number;
}

const TONE_HEX: Record<'good' | 'warn' | 'bad', string> = {
  good: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
};

export const RadialScoreGauge: React.FC<RadialScoreGaugeProps> = ({ score, size = 116 }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = TONE_HEX[scoreTone(clamped)];
  const r = 42;
  const cx = 50;
  const cy = 50;
  const arcLen = Math.PI * r;
  const fill = (clamped / 100) * arcLen;
  // Semicircle bulging upward (gauge), filled left→right.
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;

  return (
    <div className="relative" style={{ width: size, height: size * 0.6 }}>
      <svg viewBox="0 0 100 56" className="w-full" aria-hidden="true">
        <path d={d} fill="none" stroke="#eef0f2" strokeWidth={9} strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${fill} ${arcLen}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{clamped}</div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400">{scoreBandLabel(clamped)}</div>
      </div>
    </div>
  );
};
