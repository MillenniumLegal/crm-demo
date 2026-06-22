import React from 'react';
import { Trophy, Target } from 'lucide-react';

interface Targets {
  instructions: { mtd: number; target: number };
  calls: { today: number; target: number };
  conversion: { value: number; target: number };
  rank: number;
  of: number;
  note: string;
}

interface Props {
  targets: Targets;
}

export const AgentTargetCard: React.FC<Props> = ({ targets }) => {
  const { instructions, calls, conversion, rank, of, note } = targets;

  const instructionsPct =
    Math.min((instructions.mtd / Math.max(instructions.target, 1)) * 100, 100);
  const callsPct =
    Math.min((calls.today / Math.max(calls.target, 1)) * 100, 100);
  const callsHit = calls.today >= calls.target;
  const conversionHit = conversion.value >= conversion.target;
  const conversionDelta = conversion.value - conversion.target;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Your targets</h3>
      <p className="text-xs text-gray-500">Where you are this month</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {/* Tile 1 — Instructions */}
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500">Instructions</p>
          <p className="text-lg font-bold tabular-nums">
            {instructions.mtd + ' / ' + instructions.target}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{ width: instructionsPct + '%', backgroundColor: '#1e3a8a' }}
            />
          </div>
        </div>

        {/* Tile 2 — Calls today */}
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500">Calls today</p>
          <p className="text-lg font-bold tabular-nums">
            {calls.today + ' / ' + calls.target}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: callsPct + '%',
                backgroundColor: callsHit ? '#16a34a' : '#1e3a8a',
              }}
            />
          </div>
        </div>

        {/* Tile 3 — Conversion */}
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500">Conversion</p>
          <p className="text-lg font-bold tabular-nums">{conversion.value + '%'}</p>
          <p className="text-[11px] text-gray-500">{'target ' + conversion.target + '%'}</p>
          <span
            className="text-xs font-semibold"
            style={{ color: conversionHit ? '#16a34a' : '#ef4444' }}
          >
            {(conversionHit ? '+' : '') + conversionDelta.toFixed(1) + 'pp'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
          {'Rank #' + rank + ' of ' + of}
        </span>
        <Trophy className="h-4 w-4 text-indigo-700" />
      </div>

      <div className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        <span>{note}</span>
      </div>
    </div>
  );
};
