import React, { useState } from "react";
import { Sparkles, Flame, AlertTriangle } from "lucide-react";

interface Coach {
  mtdRevenue: number;
  workingDaysElapsed: number;
  workingDaysTotal: number;
  lastMonthRevenue: number;
  defaultTarget: number;
  acceptedNotInstructed: { count: number; value: number };
  watching: string[];
}

interface Props {
  coach: Coach;
}

export const FinanceCoach: React.FC<Props> = ({ coach }) => {
  const [target, setTarget] = useState<number>(coach.defaultTarget);

  const fmt = (n: number) =>
    "£" + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n)));

  const perDay = coach.mtdRevenue / Math.max(coach.workingDaysElapsed, 1);
  const projected = Math.round(perDay * coach.workingDaysTotal);
  const remainingDays = Math.max(coach.workingDaysTotal - coach.workingDaysElapsed, 0);
  const neededPerDay = Math.max(
    Math.ceil((target - coach.mtdRevenue) / Math.max(remainingDays, 1)),
    0
  );
  const gap = projected - target;
  const pctToTarget = Math.max(
    Math.min(Math.round((coach.mtdRevenue / Math.max(target, 1)) * 100), 100),
    0
  );

  const covers = coach.acceptedNotInstructed.value >= Math.abs(gap);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Brand header */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center rounded p-1.5 text-white"
          style={{ backgroundColor: "#4338ca" }}
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold text-gray-900">
            APCM AI · Finance coach
          </div>
          <div className="text-xs text-gray-500">
            Set your target — I will tell you what to do.
          </div>
        </div>
      </div>

      {/* Target setter */}
      <div className="mt-3">
        <label className="text-xs text-gray-500">Target this month</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-gray-500">£</span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
          />
          <button
            type="button"
            onClick={() => setTarget(coach.lastMonthRevenue)}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-50"
          >
            {fmt(coach.lastMonthRevenue)}
          </button>
          <button
            type="button"
            onClick={() => setTarget(coach.defaultTarget)}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-50"
          >
            {fmt(coach.defaultTarget)}
          </button>
          <button
            type="button"
            onClick={() => setTarget(Math.round(coach.defaultTarget * 1.25))}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-50"
          >
            {fmt(Math.round(coach.defaultTarget * 1.25))}
          </button>
        </div>
      </div>

      {/* Pace panel */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-600">
          <span className="tabular-nums">
            {fmt(coach.mtdRevenue)} of {fmt(target)}
          </span>
          <span className="tabular-nums">{pctToTarget}%</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full"
            style={{ width: pctToTarget + "%", backgroundColor: "#1e3a8a" }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] text-gray-500">Projected</div>
            <div className="text-sm font-semibold tabular-nums">{fmt(projected)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">Pace</div>
            <div className="text-sm font-semibold tabular-nums">
              {fmt(Math.round(perDay))}/day
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">Need</div>
            <div className="text-sm font-semibold tabular-nums">
              {fmt(neededPerDay)}/day
            </div>
          </div>
        </div>
      </div>

      {/* Pushy advice callout */}
      {gap >= 0 ? (
        <div className="mt-4 rounded-lg bg-green-50 p-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-green-700 shrink-0" />
            <div className="font-semibold text-green-900">
              On track — and you can do better.
            </div>
          </div>
          <p className="mt-1 text-sm text-green-900">
            At the current pace you will land {fmt(projected)},{" "}
            {fmt(Math.abs(gap))} past target. Do not coast: instruct the{" "}
            {coach.acceptedNotInstructed.count} accepted quotes (
            {fmt(coach.acceptedNotInstructed.value)}) and push for{" "}
            {fmt(Math.round(target * 1.1))}.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <div className="font-semibold text-amber-900">
              Behind pace — {fmt(Math.abs(gap))} short.
            </div>
          </div>
          <p className="mt-1 text-sm text-amber-900">
            At {fmt(Math.round(perDay))}/day you will land {fmt(projected)}. You
            need {fmt(neededPerDay)}/day for the last {remainingDays} working days.{" "}
            {covers
              ? `Quick win: the ${coach.acceptedNotInstructed.count} accepted quotes worth ${fmt(
                  coach.acceptedNotInstructed.value
                )} alone clear the gap — chase those signatures today.`
              : `Chase the ${coach.acceptedNotInstructed.count} accepted quotes (${fmt(
                  coach.acceptedNotInstructed.value
                )}) and line up more instructions this week.`}
          </p>
        </div>
      )}

      {/* What APCM is watching */}
      {coach.watching.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            What APCM is watching
          </div>
          <div className="mt-2 space-y-1.5">
            {coach.watching.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "#818cf8" }}
                />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
