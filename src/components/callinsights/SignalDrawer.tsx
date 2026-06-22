import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Handling = "strong" | "adequate" | "weak" | "missed";

interface SignalCall {
  agent: string;
  lead: string;
  date: string;
  quote?: string;
  note?: string;
  clientSaid?: string;
  repReplied?: string;
  clientReaction?: string;
  handling?: Handling;
}

interface SignalItem {
  key: string;
  label: string;
  count: number;
  calls: number;
  sentiment?: number;
  conversion?: { withPct: number; otherPct: number };
  handling?: { strong: number; adequate: number; weak: number; missed: number };
  handledWellPct?: number;
  trend: number[];
  sample: SignalCall[];
}

interface Props {
  item: SignalItem | null;
  onClose: () => void;
}

const HHEX: Record<Handling, string> = {
  strong: "#16a34a",
  adequate: "#3b82f6",
  weak: "#f59e0b",
  missed: "#ef4444",
};

export const SignalDrawer: React.FC<Props> = ({ item, onClose }) => {
  const [askOpen, setAskOpen] = useState(false);
  // Lock the page scroll while the panel is open so only the panel scrolls internally.
  useEffect(() => {
    setAskOpen(false);
    if (!item) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  if (item === null) return null;

  const sample = item.sample ?? [];
  const trend = item.trend ?? [];

  const handlingEntries: Array<[Handling, string]> = [
    ["strong", "Strong"],
    ["adequate", "Adequate"],
    ["weak", "Weak"],
    ["missed", "Missed"],
  ];

  let trendPoints = "";
  if (trend.length >= 2) {
    const mn = Math.min(...trend);
    const mx = Math.max(...trend);
    const x = (i: number) => (i / Math.max(trend.length - 1, 1)) * 120;
    const y = (v: number) => 28 - ((v - mn) / Math.max(mx - mn, 1)) * 26;
    trendPoints = trend.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[55]"
        style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col bg-white shadow-2xl md:w-[42%] md:min-w-[720px] max-w-[1000px]">
        {/* HEADER */}
        <div className="shrink-0 p-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              SIGNAL
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {item.label}
            </div>
            <div className="text-xs text-gray-500">
              {item.count + " times · " + item.calls + " calls"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAskOpen((v) => !v)}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ backgroundColor: "#4338ca" }}
            >
              Ask APCM AI
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {askOpen && (
            <div className="border-b border-gray-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">APCM AI</div>
              <p className="mt-1">
                {"“" + item.label + "” appears on " + item.calls + " calls"}
                {item.handledWellPct != null ? " and is only " + item.handledWellPct + "% handled well — worth coaching the team here." : "."}
                {item.conversion ? " Leads where it appears convert at " + item.conversion.withPct + "% vs " + item.conversion.otherPct + "% elsewhere." : ""}
              </p>
            </div>
          )}

          {/* HANDLING BREAKDOWN */}
          {item.handling &&
            (() => {
              const h = item.handling;
              const safe = (n: number) => (Number.isFinite(n) ? n : 0);
              const total = Math.max(
                safe(h.strong) + safe(h.adequate) + safe(h.weak) + safe(h.missed),
                1
              );
              return (
                <div className="grid grid-cols-4 gap-2 p-4 border-b border-gray-200">
                  {handlingEntries.map(([key, label]) => {
                    const val = safe(h[key]);
                    const pct = Math.round((val / total) * 100);
                    return (
                      <div key={key} className="text-center">
                        <div className="text-sm font-bold text-gray-900">
                          {val}
                        </div>
                        <div className="mt-1 h-12 rounded bg-gray-100 flex items-end overflow-hidden">
                          <div
                            className="w-full rounded"
                            style={{
                              height: pct + "%",
                              backgroundColor: HHEX[key],
                            }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          {label}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {pct + "%"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          {/* STATS STRIP */}
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-start gap-x-8 gap-y-3 text-xs">
            {item.handledWellPct != null && (
              <div>
                <div className="text-gray-500">Handled well</div>
                <div
                  className="text-lg font-bold"
                  style={{
                    color: item.handledWellPct >= 50 ? "#16a34a" : "#ef4444",
                  }}
                >
                  {item.handledWellPct + "%"}
                </div>
              </div>
            )}

            <div className="w-28">
              <div className="text-gray-500">Trend</div>
              <svg viewBox="0 0 120 30" className="w-full mt-1">
                {trend.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke="#b45309"
                    strokeWidth={2}
                    points={trendPoints}
                  />
                )}
              </svg>
              {trend.length >= 2 && (
                <div className="text-[10px] text-gray-400">
                  {trend[0] + " → " + trend[trend.length - 1]}
                </div>
              )}
            </div>

            {item.sentiment != null && (
              <div>
                <div className="text-gray-500">Sentiment</div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: item.sentiment >= 0 ? "#16a34a" : "#ef4444" }}
                >
                  {(item.sentiment >= 0 ? "+" : "") + item.sentiment.toFixed(2)}
                </div>
              </div>
            )}

            {item.conversion && (
              <div>
                <div className="text-gray-500">Conversion impact</div>
                <div className="text-sm font-semibold text-gray-800">
                  {item.conversion.withPct +
                    "% vs " +
                    item.conversion.otherPct +
                    "%"}
                </div>
              </div>
            )}
          </div>

          {/* CALLS LIST */}
          <div className="p-4 space-y-3">
            {sample.length === 0 ? (
              <div className="text-sm text-gray-400">No calls captured.</div>
            ) : (
              sample.map((call, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-700">
                      {call.agent + " → " + (call.lead || "—")}
                    </div>
                    <div>
                      {call.handling ? (
                        <span
                          className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ color: HHEX[call.handling] }}
                        >
                          {call.handling}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {call.date}
                        </span>
                      )}
                    </div>
                  </div>

                  {call.handling && (
                    <div className="mt-0.5 text-[11px] text-gray-400">
                      {call.date}
                    </div>
                  )}

                {call.clientSaid ? (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        CLIENT SAID
                      </div>
                      <div className="italic text-sm text-gray-800">
                        {"“" + call.clientSaid + "”"}
                      </div>
                    </div>
                    {call.repReplied && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          REP REPLIED
                        </div>
                        <div className="text-sm text-gray-600">
                          {call.repReplied}
                        </div>
                      </div>
                    )}
                    {call.clientReaction && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          CLIENT REACTION
                        </div>
                        <div className="text-xs text-gray-500">
                          {call.clientReaction}
                        </div>
                      </div>
                    )}
                    {call.note && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          NOTE
                        </div>
                        <div className="text-xs text-gray-600">{call.note}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="italic text-sm text-gray-800">
                      {"“" + (call.quote || "") + "”"}
                    </div>
                    {call.note && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          NOTE
                        </div>
                        <div className="text-xs text-gray-600">{call.note}</div>
                      </div>
                    )}
                  </div>
                )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
