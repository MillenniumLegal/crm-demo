import React from "react";
import { AlertCircle } from "lucide-react";

interface VAgent {
  agent: string;
  marked: number;
  verified: number;
  markedNoMatch: number;
  foundNotMarked: number;
  mismatch: number;
  verificationRate: number;
}

interface Props {
  data: {
    range: string;
    agents: VAgent[];
    note: string;
  };
}

const LEGEND: { label: string; color: string }[] = [
  { label: "Verified", color: "#16a34a" },
  { label: "Marked no match", color: "#ef4444" },
  { label: "Found not marked", color: "#f59e0b" },
  { label: "Mismatch", color: "#94a3b8" },
];

export const CallVerificationPanel: React.FC<Props> = ({ data }) => {
  const { range, agents, note } = data;

  const rateColor = (rate: number): string =>
    rate >= 85 ? "#16a34a" : rate >= 75 ? "#f59e0b" : "#ef4444";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-gray-900">
          Call verification vs 3CX
        </h3>
        <p className="text-xs text-gray-500">
          What agents marked vs what 3CX recorded · {range}
        </p>
      </div>

      <div className="mb-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {agents.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">
          No verification data for this range
        </p>
      ) : (
        <div className="space-y-2">
          {agents.map((a) => {
            const segments: { value: number; color: string }[] = [
              { value: a.verified, color: "#16a34a" },
              { value: a.markedNoMatch, color: "#ef4444" },
              { value: a.foundNotMarked, color: "#f59e0b" },
              { value: a.mismatch, color: "#94a3b8" },
            ];
            const total = segments.reduce((sum, s) => sum + s.value, 0);
            const denom = Math.max(total, 1);
            return (
              <div key={a.agent} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm text-gray-700">
                  {a.agent}
                </span>
                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                  {segments.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        width: Math.round((s.value / denom) * 100) + "%",
                        backgroundColor: s.color,
                      }}
                    />
                  ))}
                </div>
                <span
                  className="w-14 text-right text-sm font-semibold tabular-nums"
                  style={{ color: rateColor(a.verificationRate) }}
                >
                  {a.verificationRate}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
};
