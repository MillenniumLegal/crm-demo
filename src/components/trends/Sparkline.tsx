import React from "react";

interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  points,
  color = "#1e3a8a",
  width = 100,
  height = 28,
  fill = true,
  strokeWidth = 1.75,
}) => {
  if (!points || points.length === 0) return null;

  const PAD = 3;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min;
  const innerH = height - PAD * 2;
  const baseline = height - PAD;

  // X position for index i. Single point => center horizontally.
  const xAt = (i: number): number => {
    if (points.length === 1) return width / 2;
    return (i / (points.length - 1)) * width;
  };

  // Y position for value v, inverted (max near top). Guard zero span => center.
  const yAt = (v: number): number => {
    if (span === 0) return height / 2;
    return PAD + (1 - (v - min) / span) * innerH;
  };

  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`)
    .join(" ");

  const firstX = xAt(0);
  const lastX = xAt(points.length - 1);
  const lastY = yAt(points[points.length - 1]);

  const areaPath = `${linePath} L${lastX.toFixed(2)} ${baseline.toFixed(2)} L${firstX.toFixed(
    2
  )} ${baseline.toFixed(2)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
    >
      {fill && (
        <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
};
