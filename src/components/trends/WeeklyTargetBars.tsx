import React from "react";

interface WeeklyBar {
  label: string;
  value: number;
  target?: number;
}

interface Props {
  title: string;
  caption?: string;
  bars: WeeklyBar[];
  valueFormat?: "number" | "currency";
  barColor?: string;
  goodAboveTarget?: boolean;
}

const BAR_AREA_HEIGHT = 160;

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1000) return `${sign}£${(abs / 1000).toFixed(1)}k`;
  return `${sign}£${Math.round(abs)}`;
}

function formatValue(n: number, valueFormat: "number" | "currency"): string {
  if (valueFormat === "currency") return formatCurrency(n);
  return Math.round(n).toLocaleString();
}

export const WeeklyTargetBars: React.FC<Props> = ({
  title,
  caption,
  bars,
  valueFormat = "number",
  barColor = "#1e3a8a",
  goodAboveTarget = true,
}) => {
  const hasData = bars.length > 0;

  const values = bars.map((b) => b.value);
  const targets = bars
    .map((b) => b.target)
    .filter((t): t is number => t != null);

  const rawMax = Math.max(0, ...values, ...targets);
  const scaleMax = rawMax > 0 ? rawMax * 1.1 : 1;

  const heightFor = (n: number): number => {
    const h = (n / scaleMax) * BAR_AREA_HEIGHT;
    if (!isFinite(h) || h < 0) return 0;
    return h;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {caption && <p className="text-xs text-gray-500">{caption}</p>}
      </div>

      {!hasData ? (
        <div className="flex h-40 items-center justify-center text-xs text-gray-400">
          No data yet
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {bars.map((bar, i) => {
            const hasTarget = bar.target != null;
            const isGood =
              goodAboveTarget && hasTarget && bar.value >= (bar.target as number);
            const color = isGood ? "#16a34a" : barColor;
            const barHeight = Math.max(4, heightFor(bar.value));
            const targetHeight = hasTarget ? heightFor(bar.target as number) : 0;

            return (
              <div
                key={`${bar.label}-${i}`}
                className="flex flex-1 flex-col items-center"
              >
                <div
                  className="relative flex w-full flex-col items-center justify-end"
                  style={{ height: BAR_AREA_HEIGHT }}
                >
                  <div
                    className="font-semibold text-gray-700 tabular-nums"
                    style={{ fontSize: 11, lineHeight: 1.2 }}
                  >
                    {formatValue(bar.value, valueFormat)}
                  </div>

                  <div
                    className="rounded-t"
                    style={{
                      height: barHeight,
                      minHeight: 4,
                      width: "60%",
                      backgroundColor: color,
                    }}
                  />

                  {hasTarget && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: targetHeight,
                        borderTop: "1px dashed #9ca3af",
                      }}
                    />
                  )}
                </div>

                <div
                  className="mt-1 text-gray-500"
                  style={{ fontSize: 11 }}
                >
                  {bar.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
