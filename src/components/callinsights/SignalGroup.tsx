import React from "react";

interface SignalCall {
  agent: string;
  lead: string;
  date: string;
  quote: string;
  note?: string;
}

interface SignalItem {
  key: string;
  label: string;
  count: number;
  calls: number;
  sentiment?: number;
  conversion?: { withPct: number; otherPct: number };
  trend: number[];
  sample: SignalCall[];
}

interface Props {
  title: string;
  caption: string;
  items: SignalItem[];
  onSelect: (item: SignalItem) => void;
  tone?: "good" | "warn" | "bad" | "navy";
}

export const SignalGroup: React.FC<Props> = ({ title, caption, items, onSelect, tone }) => {
  const map: Record<string, string> = {
    good: "#16a34a",
    warn: "#f59e0b",
    bad: "#ef4444",
    navy: "#1e3a8a",
  };
  const hex = map[tone || "navy"];

  const safeCount = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const maxCount = Math.max(1, ...items.map((i) => safeCount(i.count)));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="text-xs italic text-gray-500">{caption}</div>

      <div className="mt-3">
        {items.length === 0 ? (
          <div className="rounded bg-gray-50 px-2 py-6 text-center text-xs text-gray-400">
            No signals to show.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full text-left flex items-center gap-3 rounded px-1 py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50"
            >
              <span className="w-44 shrink-0 truncate text-sm text-gray-800">{item.label}</span>
              <span className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <span
                  className="block h-full"
                  style={{
                    width:
                      Math.min(
                        100,
                        Math.max(0, Math.round((safeCount(item.count) / maxCount) * 100)),
                      ) + "%",
                    backgroundColor: hex,
                  }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                {item.count}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
