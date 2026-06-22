import React, { useMemo, useState } from "react";

interface PeakHours {
  hours: string[];
  leads: number[];
  instructions: number[];
  calls: number[];
  leadPeak: string;
  instructionPeak: string;
  callPeak: string;
}

interface Props {
  peak: PeakHours;
}

const COL_LEADS = "#1e3a8a";
const COL_INSTR = "#16a34a";
const COL_CALLS = "#0ea5e9";

type WindowKey = "all" | "morning" | "afternoon" | "closing";

const WINDOWS: Array<{ key: WindowKey; label: string }> = [
  { key: "all", label: "All day" },
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "closing", label: "Closing" },
];

const hourNumber = (label: string) => {
  const match = label.match(/^(\d+)/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (label.toLowerCase().includes("p") && base !== 12) return base + 12;
  if (label.toLowerCase().includes("a") && base === 12) return 0;
  return base;
};

const inWindow = (label: string, window: WindowKey) => {
  const hour = hourNumber(label);
  if (window === "morning") return hour < 12;
  if (window === "afternoon") return hour >= 12 && hour < 16;
  if (window === "closing") return hour >= 16;
  return true;
};

const highest = (hours: string[], values: number[]) => {
  if (hours.length === 0) return { label: "—", value: 0 };
  return hours.reduce(
    (best, label, index) => {
      const value = values[index] ?? 0;
      return value > best.value ? { label, value } : best;
    },
    { label: hours[0] ?? "—", value: values[0] ?? 0 },
  );
};

export const PeakHoursChart: React.FC<Props> = ({ peak }) => {
  const [windowKey, setWindowKey] = useState<WindowKey>("all");
  const rawHours = peak?.hours ?? [];
  const rawLeads = peak?.leads ?? [];
  const rawInstructions = peak?.instructions ?? [];
  const rawCalls = peak?.calls ?? [];

  const visible = useMemo(() => {
    const rows = rawHours
      .map((label, index) => ({
        label,
        leads: rawLeads[index] ?? 0,
        instructions: rawInstructions[index] ?? 0,
        calls: rawCalls[index] ?? 0,
      }))
      .filter((row) => inWindow(row.label, windowKey));

    return {
      hours: rows.map((row) => row.label),
      leads: rows.map((row) => row.leads),
      instructions: rows.map((row) => row.instructions),
      calls: rows.map((row) => row.calls),
    };
  }, [rawHours, rawLeads, rawInstructions, rawCalls, windowKey]);

  const hours = visible.hours;
  const leads = visible.leads;
  const instructions = visible.instructions;
  const calls = visible.calls;

  const max = Math.max(
    0,
    ...leads,
    ...instructions,
    ...calls,
  );

  const hasData = hours.length > 0 && max > 0;
  const leadPeak = highest(hours, leads);
  const instructionPeak = highest(hours, instructions);
  const callPeak = highest(hours, calls);
  const windowLeads = leads.reduce((sum, value) => sum + value, 0);
  const windowInstructions = instructions.reduce((sum, value) => sum + value, 0);
  const windowCalls = calls.reduce((sum, value) => sum + value, 0);
  const conversion = Math.round((windowInstructions / Math.max(windowLeads, 1)) * 100);
  const callCoverage = Math.round((windowCalls / Math.max(windowLeads, 1)) * 100);
  const mismatch = callPeak.label !== instructionPeak.label;

  // Chart geometry
  const VW = 720;
  const VH = 200;
  const padL = 8;
  const padR = 8;
  const padTop = 12;
  const axisY = VH - 26; // baseline for bars; leave room for labels
  const plotH = axisY - padTop;
  const plotW = VW - padL - padR;

  const n = hours.length;
  const groupW = n > 0 ? plotW / n : plotW;
  const barGap = 2;
  const innerPad = Math.min(8, groupW * 0.18);
  const usableW = Math.max(0, groupW - innerPad * 2);
  const barW = Math.max(1.5, (usableW - barGap * 2) / 3);

  const yOf = (v: number) => {
    if (max <= 0) return axisY;
    const h = (Math.max(0, v) / max) * plotH;
    return axisY - h;
  };
  const hOf = (v: number) => {
    if (max <= 0) return 0;
    return (Math.max(0, v) / max) * plotH;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Peak hours</div>
          <div className="text-xs text-gray-500">
            When leads come in vs when they instruct
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            {WINDOWS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setWindowKey(option.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  windowKey === option.key ? "text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
                style={windowKey === option.key ? { backgroundColor: "#1e3a8a" } : undefined}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COL_LEADS }}
              />
              Leads
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COL_INSTR }}
              />
              Instructions
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COL_CALLS }}
              />
              Calls
            </span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-6 flex h-32 items-center justify-center text-xs text-gray-400">
          No data yet
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="mt-3 w-full"
            role="img"
            aria-label="Peak hours grouped column chart"
          >
            {/* baseline */}
            <line
              x1={padL}
              y1={axisY}
              x2={VW - padR}
              y2={axisY}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            {hours.map((label, i) => {
              const gx = padL + groupW * i + innerPad;
              const lv = leads[i] ?? 0;
              const iv = instructions[i] ?? 0;
              const cv = calls[i] ?? 0;
              const cx = padL + groupW * i + groupW / 2;
              return (
                <g key={i}>
                  <rect
                    x={gx}
                    y={yOf(lv)}
                    width={barW}
                    height={hOf(lv)}
                    rx={1}
                    fill={COL_LEADS}
                  />
                  <rect
                    x={gx + barW + barGap}
                    y={yOf(iv)}
                    width={barW}
                    height={hOf(iv)}
                    rx={1}
                    fill={COL_INSTR}
                  />
                  <rect
                    x={gx + (barW + barGap) * 2}
                    y={yOf(cv)}
                    width={barW}
                    height={hOf(cv)}
                    rx={1}
                    fill={COL_CALLS}
                  />
                  <text
                    x={cx}
                    y={VH - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#9ca3af"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              Leads {leadPeak.label}
            </span>
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              Instructions {instructionPeak.label}
            </span>
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
              Calls {callPeak.label}
            </span>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-gray-500">Best next call block</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{instructionPeak.label}</div>
              <div className="text-xs text-gray-500">
                {instructionPeak.value} instructions from {leadPeak.value} lead peak signals
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-gray-500">Call coverage</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-gray-900">{callCoverage}%</div>
              <div className="text-xs text-gray-500">
                {windowCalls} calls against {windowLeads} leads in this window
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-gray-500">Connor note</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {mismatch ? "Move cover toward instruction peak" : "Coverage matches the best window"}
              </div>
              <div className="text-xs text-gray-500">
                {conversion}% lead-to-instruction in the selected working window
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
