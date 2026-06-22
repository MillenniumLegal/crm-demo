import React from "react";

interface Props {
  data: {
    optionSplit: { option1: number; option3: number };
    outcome: { label: string; count: number }[];
    byHour: { hour: string; calls: number }[];
  };
}

const chipClass = (label: string): string => {
  const l = label.toLowerCase();
  if (l.includes("answered")) return "bg-green-50 text-green-700";
  if (l.includes("missed")) return "bg-amber-50 text-amber-700";
  if (l.includes("abandoned")) return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-600";
};

export const InboundOverview: React.FC<Props> = ({ data }) => {
  const { optionSplit, outcome, byHour } = data;

  const ivrSum = optionSplit.option1 + optionSplit.option3;
  const opt1Pct = ivrSum > 0 ? (optionSplit.option1 / ivrSum) * 100 : 0;
  const opt3Pct = ivrSum > 0 ? (optionSplit.option3 / ivrSum) * 100 : 0;

  const maxCalls = byHour.reduce((m, h) => Math.max(m, h.calls), 0);

  const VB_W = 720;
  const VB_H = 140;
  const baseY = 118;
  const topY = 8;
  const chartH = baseY - topY;
  const n = byHour.length;
  const slot = n > 0 ? VB_W / n : VB_W;
  const barW = slot * 0.6;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">Inbound calls</div>
      <div className="text-xs text-gray-500">
        Sales line vs post-sale, and when they land
      </div>

      {/* IVR split */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Sales line (Opt 1): {optionSplit.option1}</span>
          <span>Post-sale (Opt 3): {optionSplit.option3}</span>
        </div>
        <div className="mt-1 flex h-4 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-4"
            style={{ width: `${opt1Pct}%`, backgroundColor: "#1e3a8a" }}
          />
          <div
            className="h-4"
            style={{ width: `${opt3Pct}%`, backgroundColor: "#94a3b8" }}
          />
        </div>
      </div>

      {/* Outcome chips */}
      {outcome.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {outcome.map((o, i) => (
            <span
              key={`${o.label}-${i}`}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipClass(
                o.label
              )}`}
            >
              {o.label} <span className="tabular-nums">{o.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* By-hour bar chart */}
      {byHour.length > 0 ? (
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mt-3 w-full"
          preserveAspectRatio="none"
        >
          {byHour.map((h, i) => {
            const barH = maxCalls > 0 ? (h.calls / maxCalls) * chartH : 0;
            const x = slot * i + (slot - barW) / 2;
            const y = baseY - barH;
            return (
              <g key={`${h.hour}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill="#1e3a8a"
                />
                <text
                  x={slot * i + slot / 2}
                  y={134}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  {h.hour}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="mt-3 text-xs text-gray-400">No hourly data</div>
      )}
    </div>
  );
};
