import React from "react";

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

export const PeakHoursChart: React.FC<Props> = ({ peak }) => {
  const hours = peak?.hours ?? [];
  const leads = peak?.leads ?? [];
  const instructions = peak?.instructions ?? [];
  const calls = peak?.calls ?? [];

  const max = Math.max(
    0,
    ...leads,
    ...instructions,
    ...calls,
  );

  const hasData = hours.length > 0 && max > 0;

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Peak hours</div>
          <div className="text-xs text-gray-500">
            When leads come in vs when they instruct
          </div>
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
              Leads {peak.leadPeak}
            </span>
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              Instructions {peak.instructionPeak}
            </span>
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
              Calls {peak.callPeak}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
