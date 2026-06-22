import React from "react";

interface Opp {
  label: string;
  count: number;
  value: number;
  action?: string;
  note?: string;
  tone?: "good" | "warn" | "bad";
}

interface Props {
  title: string;
  caption?: string;
  items: Opp[];
  accent?: "good" | "warn" | "bad";
}

const fmt = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return (
    sign +
    "£" +
    (abs >= 1000 ? (abs / 1000).toFixed(1) + "k" : String(Math.round(abs)))
  );
};

const ACCENTS: Record<string, { bg: string; color: string }> = {
  good: { bg: "#dcfce7", color: "#15803d" },
  warn: { bg: "#fef3c7", color: "#b45309" },
  bad: { bg: "#fee2e2", color: "#b91c1c" },
  default: { bg: "#f1f5f9", color: "#334155" },
};

export const OpportunityList: React.FC<Props> = ({
  title,
  caption,
  items,
  accent,
}) => {
  const total = items.reduce(
    (s, i) => s + (Number.isFinite(i.value) ? i.value : 0),
    0,
  );
  const chip = ACCENTS[accent ?? "default"] ?? ACCENTS.default;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {caption ? (
            <div className="text-xs text-gray-500">{caption}</div>
          ) : null}
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
          style={{ backgroundColor: chip.bg, color: chip.color }}
        >
          {fmt(total)}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
          No opportunities to show
        </div>
      ) : (
        <div className="mt-2">
          {items.map((item, idx) => {
            const sub = item.action || item.note || "";
            return (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {item.label}
                    </span>
                    <span className="ml-2 rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600">
                      {item.count}
                    </span>
                  </div>
                  {sub ? (
                    <div className="text-xs text-gray-500">{sub}</div>
                  ) : null}
                </div>
                <div className="text-sm font-semibold tabular-nums text-gray-900">
                  {!item.value || !Number.isFinite(item.value)
                    ? "—"
                    : fmt(item.value)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
