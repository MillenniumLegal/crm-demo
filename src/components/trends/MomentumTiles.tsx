import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MomentumKpi {
  key: string;
  label: string;
  value: string;
  deltaPct: number;
  direction: "up" | "down" | "flat";
  good: boolean;
  spark: number[];
}

interface Props {
  kpis: MomentumKpi[];
}

const Sparkline: React.FC<{ spark: number[]; good: boolean }> = ({ spark, good }) => {
  const color = good ? "#16a34a" : "#1e3a8a";
  const W = 100;
  const H = 24;
  const PAD = 2;

  if (!spark || spark.length === 0) {
    const y = H / 2;
    return (
      <svg viewBox="0 0 100 24" className="mt-2 w-full h-6" preserveAspectRatio="none">
        <line x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={1.5} />
      </svg>
    );
  }

  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const range = max - min;
  const innerH = H - PAD * 2;

  const yFor = (v: number) => {
    if (range === 0) return H / 2;
    return PAD + innerH - ((v - min) / range) * innerH;
  };

  const xFor = (i: number) => {
    if (spark.length === 1) return W / 2;
    return (i / (spark.length - 1)) * W;
  };

  const points = spark.map((v, i) => ({ x: xFor(i), y: yFor(v) }));

  if (spark.length === 1) {
    const p = points[0];
    return (
      <svg viewBox="0 0 100 24" className="mt-2 w-full h-6" preserveAspectRatio="none">
        <circle cx={p.x} cy={p.y} r={2} fill={color} />
      </svg>
    );
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    `M${points[0].x.toFixed(2)},${H} ` +
    points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") +
    ` L${points[points.length - 1].x.toFixed(2)},${H} Z`;

  const last = points[points.length - 1];

  return (
    <svg viewBox="0 0 100 24" className="mt-2 w-full h-6" preserveAspectRatio="none">
      <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
};

export const MomentumTiles: React.FC<Props> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const chipColor =
          kpi.direction === "flat"
            ? "text-gray-400"
            : kpi.good
            ? "text-green-600"
            : "text-red-600";

        const Arrow =
          kpi.direction === "up"
            ? ArrowUpRight
            : kpi.direction === "down"
            ? ArrowDownRight
            : Minus;

        return (
          <div
            key={kpi.key}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="truncate text-xs text-gray-500">{kpi.label}</div>
            <div className="text-xl font-bold text-gray-900 tabular-nums">{kpi.value}</div>
            <div className={`flex items-center gap-0.5 ${chipColor}`}>
              <Arrow className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums">
                {kpi.deltaPct > 0 ? "+" : ""}
                {kpi.deltaPct}%
              </span>
            </div>
            <Sparkline spark={kpi.spark} good={kpi.good} />
          </div>
        );
      })}
    </div>
  );
};
