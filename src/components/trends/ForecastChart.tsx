import React from "react";

interface Props {
  title: string;
  caption?: string;
  labels: string[];
  actual: (number | null)[];
  forecast: (number | null)[];
  lower: (number | null)[];
  upper: (number | null)[];
  height?: number;
}

export const ForecastChart: React.FC<Props> = ({
  title,
  caption,
  labels,
  actual,
  forecast,
  lower,
  upper,
  height,
}) => {
  const isFiniteNum = (v: number | null): v is number =>
    typeof v === "number" && Number.isFinite(v);

  const allValues = ([] as (number | null)[]).concat(actual, forecast);
  const hasAnyValue = allValues.some(isFiniteNum);

  if (labels.length === 0 || !hasAnyValue) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {caption ? <div className="text-xs text-gray-500">{caption}</div> : null}
        <div className="mt-3 flex h-32 items-center justify-center text-xs text-gray-400">
          No forecast data
        </div>
      </div>
    );
  }

  const nums = ([] as (number | null)[])
    .concat(actual, forecast, lower, upper)
    .filter(isFiniteNum);
  const max = Math.max.apply(null, nums.concat([1]));
  const min = Math.min.apply(null, nums.concat([0]));

  const H = height || 220;
  const W = 720;
  const padX = 36;
  const padTop = 12;
  const padBottom = 24;
  const n = Math.max(labels.length - 1, 1);

  const x = (i: number) => padX + (i / n) * (W - padX * 2);
  const y = (v: number) =>
    padTop + (1 - (v - min) / Math.max(max - min, 1)) * (H - padTop - padBottom);

  // 1) Confidence band
  const bandIdx: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (isFiniteNum(lower[i]) && isFiniteNum(upper[i])) {
      bandIdx.push(i);
    }
  }
  let bandPoints = "";
  if (bandIdx.length >= 2) {
    const upperPts = bandIdx.map((i) => x(i) + "," + y(upper[i] as number));
    const lowerPts = bandIdx
      .slice()
      .reverse()
      .map((i) => x(i) + "," + y(lower[i] as number));
    bandPoints = upperPts.concat(lowerPts).join(" ");
  }

  // 2) Actual line
  const actualIdx: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (isFiniteNum(actual[i])) actualIdx.push(i);
  }
  const actualPoints = actualIdx
    .map((i) => x(i) + "," + y(actual[i] as number))
    .join(" ");

  // 3) Forecast line
  const forecastIdx: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (isFiniteNum(forecast[i])) forecastIdx.push(i);
  }
  const forecastPoints = forecastIdx
    .map((i) => x(i) + "," + y(forecast[i] as number))
    .join(" ");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      {caption ? <div className="text-xs text-gray-500">{caption}</div> : null}

      <svg
        viewBox={"0 0 " + W + " " + H}
        className="mt-3 w-full"
        role="img"
        aria-label={title}
      >
        {bandIdx.length >= 2 ? (
          <polygon
            points={bandPoints}
            fill="#1e3a8a"
            fillOpacity={0.08}
            stroke="none"
          />
        ) : null}

        {actualIdx.length >= 2 ? (
          <polyline
            points={actualPoints}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth={2}
          />
        ) : null}

        {forecastIdx.length >= 2 ? (
          <polyline
            points={forecastPoints}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        ) : null}

        {labels.map((label, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize={10}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: "#1e3a8a" }}
          />
          Actual
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-4 border-t border-dashed"
            style={{ borderColor: "#1e3a8a" }}
          />
          Forecast
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-4"
            style={{ backgroundColor: "#1e3a8a", opacity: 0.12 }}
          />
          Range
        </span>
      </div>
    </div>
  );
};
