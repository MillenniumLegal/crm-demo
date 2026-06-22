import React from "react";

interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: { x: string; y: number }[];
}

interface Props {
  title: string;
  caption?: string;
  series: TrendSeries[];
  height?: number;
  yFormat?: "number" | "currency" | "percent";
  area?: boolean;
}

export const TrendLineChart: React.FC<Props> = ({
  title,
  caption,
  series,
  height = 220,
  yFormat = "number",
  area = false,
}) => {
  // ---- number formatting helpers ----
  const formatCurrency = (n: number): string => {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return sign + "£" + (abs / 1_000_000).toFixed(1) + "m";
    if (abs >= 1_000) return sign + "£" + (abs / 1_000).toFixed(1) + "k";
    return sign + "£" + Math.round(abs);
  };

  const format = (v: number): string => {
    if (!Number.isFinite(v)) return "";
    if (yFormat === "currency") return formatCurrency(v);
    if (yFormat === "percent") return v.toFixed(1) + "%";
    return Math.round(v).toLocaleString();
  };

  // ---- geometry constants ----
  const VB_W = 720;
  const VB_H = height;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = VB_W - padL - padR;
  const innerH = VB_H - padT - padB;

  // ---- empty-state detection ----
  const hasSeries = Array.isArray(series) && series.length > 0;
  const anyPoints =
    hasSeries && series.some((s) => Array.isArray(s.points) && s.points.length > 0);

  // shared point count (max across series, so dots align by index)
  const pointCount = hasSeries
    ? series.reduce((m, s) => Math.max(m, s.points?.length ?? 0), 0)
    : 0;

  // ---- y domain ----
  let dataMax = -Infinity;
  let dataMin = Infinity;
  if (anyPoints) {
    for (const s of series) {
      for (const p of s.points) {
        if (Number.isFinite(p.y)) {
          if (p.y > dataMax) dataMax = p.y;
          if (p.y < dataMin) dataMin = p.y;
        }
      }
    }
  }
  if (!Number.isFinite(dataMax)) dataMax = 0;
  if (!Number.isFinite(dataMin)) dataMin = 0;

  let yMax = dataMax * 1.1;
  let yMin = Math.min(0, dataMin);
  // guard: all-equal (and the 1.1 headroom collapsing) => create a band so divisor != 0
  if (yMax === yMin) {
    if (yMax === 0) {
      yMax = 1;
      yMin = 0;
    } else if (yMax > 0) {
      yMin = 0;
    } else {
      yMax = 0;
    }
  }
  const ySpan = yMax - yMin || 1; // final divisor guard

  // ---- mapping helpers ----
  const xAt = (i: number): number => {
    if (pointCount <= 1) return padL + innerW / 2; // single point -> center
    return padL + (i / (pointCount - 1)) * innerW;
  };
  const yAt = (v: number): number => {
    const t = (v - yMin) / ySpan; // 0..1 from bottom
    return padT + innerH - t * innerH;
  };

  // ---- gridlines (4) ----
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const t = i / (gridCount - 1); // 0..1
    const value = yMin + t * ySpan;
    const y = padT + innerH - t * innerH;
    return { y, value };
  });

  // ---- x labels (~6, include first + last) ----
  const xLabels: { label: string; x: number; anchor: "start" | "middle" | "end" }[] = [];
  if (pointCount > 0) {
    // use first series that has points for label strings, fall back to index
    const labelSource =
      series.find((s) => (s.points?.length ?? 0) === pointCount) ??
      series.find((s) => (s.points?.length ?? 0) > 0);
    const labelAt = (i: number): string => {
      const pt = labelSource?.points?.[i];
      return pt ? pt.x : String(i + 1);
    };
    if (pointCount === 1) {
      xLabels.push({ label: labelAt(0), x: xAt(0), anchor: "middle" });
    } else {
      const desired = Math.min(6, pointCount);
      const idxSet = new Set<number>();
      for (let k = 0; k < desired; k++) {
        const idx = Math.round((k / (desired - 1)) * (pointCount - 1));
        idxSet.add(idx);
      }
      idxSet.add(0);
      idxSet.add(pointCount - 1);
      const idxs = Array.from(idxSet).sort((a, b) => a - b);
      for (const idx of idxs) {
        const anchor: "start" | "middle" | "end" =
          idx === 0 ? "start" : idx === pointCount - 1 ? "end" : "middle";
        xLabels.push({ label: labelAt(idx), x: xAt(idx), anchor });
      }
    }
  }

  const showDots = pointCount <= 12;

  // ---- build per-series path data ----
  const buildSeries = (s: TrendSeries) => {
    const pts = (s.points ?? []).filter((p) => Number.isFinite(p.y));
    const coords = (s.points ?? []).map((p, i) => ({
      cx: xAt(i),
      cy: yAt(Number.isFinite(p.y) ? p.y : yMin),
      valid: Number.isFinite(p.y),
    }));
    const valid = coords.filter((c) => c.valid);
    const polyPoints = valid.map((c) => `${c.cx.toFixed(2)},${c.cy.toFixed(2)}`).join(" ");
    return { coords, valid, polyPoints, count: pts.length };
  };

  // area fill only when single series + area flag
  const baselineY = yAt(yMin);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {caption ? <p className="text-xs text-gray-500">{caption}</p> : null}
      </div>

      {hasSeries && series.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!anyPoints ? (
        <div
          className="mt-3 flex items-center justify-center text-gray-400"
          style={{ height }}
        >
          No data yet
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={title}
        >
          {/* gridlines + y labels */}
          {gridLines.map((g, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={padL}
                y1={g.y}
                x2={VB_W - padR}
                y2={g.y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={g.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#9ca3af"
                className="tabular-nums"
              >
                {format(g.value)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {xLabels.map((xl, i) => (
            <text
              key={`xl-${i}`}
              x={xl.x}
              y={VB_H - padB + 16}
              textAnchor={xl.anchor}
              fontSize={10}
              fill="#9ca3af"
            >
              {xl.label}
            </text>
          ))}

          {/* series */}
          {series.map((s, si) => {
            const { coords, valid, polyPoints, count } = buildSeries(s);
            if (count === 0) return null;

            const isFirstSeries = si === 0;
            const showArea = area && series.length === 1 && valid.length > 0;

            // area path: only when valid points exist
            let areaPath = "";
            if (showArea) {
              const top = valid
                .map((c) => `${c.cx.toFixed(2)},${c.cy.toFixed(2)}`)
                .join(" L ");
              const firstX = valid[0].cx.toFixed(2);
              const lastX = valid[valid.length - 1].cx.toFixed(2);
              areaPath = `M ${firstX},${baselineY.toFixed(2)} L ${top} L ${lastX},${baselineY.toFixed(
                2
              )} Z`;
            }

            const lastValid = valid.length > 0 ? valid[valid.length - 1] : null;

            return (
              <g key={s.key}>
                {showArea ? (
                  <path d={areaPath} fill={s.color} fillOpacity={0.1} stroke="none" />
                ) : null}

                {valid.length === 1 ? (
                  // single point -> just the dot (handled below), nothing to draw here
                  null
                ) : (
                  <polyline
                    points={polyPoints}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* per-point dots */}
                {showDots
                  ? coords.map((c, ci) =>
                      c.valid ? (
                        <circle
                          key={`dot-${si}-${ci}`}
                          cx={c.cx}
                          cy={c.cy}
                          r={2.5}
                          fill={s.color}
                        />
                      ) : null
                    )
                  : null}

                {/* emphasized last point */}
                {lastValid ? (
                  <circle cx={lastValid.cx} cy={lastValid.cy} r={3.5} fill={s.color} />
                ) : null}

                {/* last-point value label for first series only */}
                {isFirstSeries && lastValid ? (
                  <text
                    x={Math.min(lastValid.cx + 6, VB_W - padR)}
                    y={Math.max(lastValid.cy - 6, padT + 8)}
                    textAnchor={lastValid.cx + 6 > VB_W - padR - 20 ? "end" : "start"}
                    fontSize={10}
                    fill={s.color}
                    className="tabular-nums"
                  >
                    {format(
                      s.points[s.points.length - 1] &&
                        Number.isFinite(s.points[s.points.length - 1].y)
                        ? s.points[s.points.length - 1].y
                        : valid.length
                        ? yMin
                        : 0
                    )}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};
