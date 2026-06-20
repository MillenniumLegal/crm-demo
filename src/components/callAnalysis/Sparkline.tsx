import React from 'react';
import { SparklineProps } from './types';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 28;
const PAD_X = 2;
const PAD_Y = 3;

/**
 * Tiny inline-SVG trend line for the hero KPI cards.
 * Line colour comes from `currentColor` (parent sets e.g. `text-navy-400`);
 * the end dot is always navy-950. Renders nothing for empty/all-zero series.
 */
export const Sparkline: React.FC<SparklineProps> = ({ values, className }) => {
  if (values.length === 0 || values.every((value) => value === 0)) return null;

  const max = Math.max(...values);
  const innerWidth = VIEW_WIDTH - PAD_X * 2;
  const innerHeight = VIEW_HEIGHT - PAD_Y * 2;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? VIEW_WIDTH - PAD_X
        : PAD_X + (index / (values.length - 1)) * innerWidth;
    const y = VIEW_HEIGHT - PAD_Y - (value / max) * innerHeight;
    return { x, y };
  });
  const endPoint = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={endPoint.x}
        cy={endPoint.y}
        r={2}
        fill="currentColor"
        className="text-navy-950"
      />
    </svg>
  );
};
