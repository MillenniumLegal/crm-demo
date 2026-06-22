import React from "react";
import { Square } from "lucide-react";

interface Props {
  data: {
    agent: string;
    date: string;
    tiles: { label: string; value: string }[];
    coaching: { tone: "good" | "warn" | "bad"; text: string }[];
    actions: string[];
  };
}

const TONE_HEX: Record<"good" | "warn" | "bad", string> = {
  good: "#16a34a",
  warn: "#f59e0b",
  bad: "#ef4444",
};

export const AgentDayCard: React.FC<Props> = ({ data }) => {
  const tiles = data.tiles ?? [];
  const coaching = data.coaching ?? [];
  const actions = data.actions ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-1">
        <h3 className="text-base font-semibold text-gray-900">{data.agent}</h3>
        <span className="text-sm text-gray-500">· {data.date}</span>
      </div>
      <p className="text-xs text-gray-500">Your day at a glance</p>

      {tiles.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No stats for today yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-2.5">
              <div className="text-[11px] leading-tight text-gray-500">
                {tile.label}
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
                {tile.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Coaching
      </h4>
      {coaching.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400">No coaching notes today.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {coaching.map((item, i) => (
            <div key={i} className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_HEX[item.tone] }}
              />
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Action list for today
      </h4>
      {actions.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400">No actions queued.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <Square className="h-4 w-4 shrink-0 text-gray-300" />
              <p className="text-sm text-gray-700">{action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
