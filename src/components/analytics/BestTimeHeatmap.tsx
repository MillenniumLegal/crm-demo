import React, { useEffect, useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { fetchTiming, Timing } from "@/services/timingService";

export const BestTimeHeatmap: React.FC = () => {
  const [data, setData] = useState<Timing | null>(null);
  const [range, setRange] = useState("30d");
  const [metric, setMetric] = useState("pickup");

  useEffect(() => {
    let active = true;
    fetchTiming().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm text-gray-500">
        Loading best-time data…
      </div>
    );
  }

  const R =
    data.byRange[range] ||
    data.byRange["30d"] ||
    Object.values(data.byRange)[0];
  if (!R) return null;

  const metricVal = (cell: { pickup: number; calls: number; connected: number }) =>
    metric === "pickup"
      ? cell.pickup
      : metric === "calls"
      ? cell.calls
      : cell.connected;

  const maxV = Math.max(1, ...R.grid.flatMap((g) => g.cells.map(metricVal)));
  const denom = metric === "pickup" ? 100 : maxV;
  const rowFor = (day: string) => R.grid.find((g) => g.day === day);

  const rangeChips: [string, string][] = [
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["3mo", "3 months"],
  ];
  const metricChips: [string, string][] = [
    ["pickup", "Pickup %"],
    ["calls", "Calls"],
    ["connected", "Connected"],
  ];

  const busy = R.busiestHour;
  const best = R.bestHour;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Best time to call</h3>
      <p className="text-xs text-gray-500">
        When leads actually pick up — filter the window, switch the metric.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Window</span>
        {rangeChips.map(([key, label]) => {
          const isActive = range === key;
          return (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium" +
                (isActive ? "" : " bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
              style={
                isActive
                  ? { backgroundColor: "#1e3a8a", color: "white" }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })}
        <span className="text-xs text-gray-500">Metric</span>
        {metricChips.map(([key, label]) => {
          const isActive = metric === key;
          return (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium" +
                (isActive ? "" : " bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
              style={
                isActive
                  ? { backgroundColor: "#1e3a8a", color: "white" }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex">
            <div className="w-10" />
            {R.hours.map((h, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[10px] text-gray-400"
              >
                {h}
              </div>
            ))}
          </div>
          {data.days.map((day) => {
            const row = rowFor(day);
            return (
              <div key={day} className="flex items-center gap-1 mt-1">
                <div className="w-10 text-xs text-gray-500">{day}</div>
                {(row?.cells ?? []).map((cell, i) => {
                  const v = metricVal(cell);
                  const a =
                    v <= 0 ? 0 : 0.12 + 0.82 * Math.min(1, v / Math.max(denom, 1));
                  return (
                    <div
                      key={i}
                      className="flex-1 h-8 rounded flex items-center justify-center text-[10px] tabular-nums"
                      style={{
                        backgroundColor:
                          v <= 0
                            ? "#f8fafc"
                            : "rgba(180,83,9," + a.toFixed(2) + ")",
                        color: a > 0.5 ? "#ffffff" : "#6b7280",
                      }}
                      title={
                        day +
                        " " +
                        R.hours[i] +
                        ": " +
                        cell.calls +
                        " calls · " +
                        cell.pickup +
                        "% pick up"
                      }
                    >
                      {v}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="text-[11px] text-gray-400">
            {"Cell = " +
              (metric === "pickup"
                ? "pickup %"
                : metric === "calls"
                ? "calls made"
                : "answered calls") +
              " · darker = higher"}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-900 flex gap-2">
        <Clock className="text-green-700 shrink-0" size={18} />
        <span>
          {"Best time to call — " +
            data.bestWindow +
            (best ? ". " + best.hour + " connects at " + best.pickup + "%." : ".")}
        </span>
      </div>

      {busy && best && busy.hour !== best.hour && (
        <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <TrendingUp className="text-amber-700 shrink-0" size={18} />
          <span>
            {"You dial most at " +
              busy.hour +
              " (" +
              busy.pickup +
              "% pick up) but leads answer most at " +
              best.hour +
              " (" +
              best.pickup +
              "%). Shift early-day dials into the " +
              best.hour +
              " window."}
          </span>
        </div>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pickup by hour
          </div>
          {R.pickupByHour.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs mt-1">
              <span className="w-8 text-gray-500">{p.hour}</span>
              <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-2"
                  style={{
                    width: p.pickup + "%",
                    backgroundColor: "#16a34a",
                  }}
                />
              </div>
              <span className="w-9 text-right tabular-nums text-gray-600">
                {p.pickup + "%"}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pickup by day
          </div>
          {R.pickupByDay.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs mt-1">
              <span className="w-8 text-gray-500">{p.day}</span>
              <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-2"
                  style={{
                    width: p.pickup + "%",
                    backgroundColor: "#16a34a",
                  }}
                />
              </div>
              <span className="w-9 text-right tabular-nums text-gray-600">
                {p.pickup + "%"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400">{data.note}</div>
    </div>
  );
};
