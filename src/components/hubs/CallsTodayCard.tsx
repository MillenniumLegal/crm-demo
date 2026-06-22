import React from "react";
import { ArrowRight } from "lucide-react";

interface CallsToday {
  made: number;
  answered: number;
  answerRate: number;
  instructionIntent: number;
  byHour: { hour: string; calls: number }[];
}

interface Props {
  calls: CallsToday;
  onOpen?: () => void;
}

export const CallsTodayCard: React.FC<Props> = ({ calls, onOpen }) => {
  const { made, answered, answerRate, instructionIntent, byHour } = calls;
  const scaleMax = byHour.length ? Math.max(...byHour.map((h) => h.calls), 1) : 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Calls today</h3>
        <button
          type="button"
          onClick={() => onOpen && onOpen()}
          className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900"
        >
          Open Call Analysis
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-[11px] text-gray-500">Made</div>
          <div className="text-lg font-bold tabular-nums">{made}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Answered</div>
          <div className="text-lg font-bold tabular-nums">{answered}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Answer rate</div>
          <div className="text-lg font-bold tabular-nums">{answerRate}%</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Instruction-intent</div>
          <div className="text-lg font-bold tabular-nums" style={{ color: "#16a34a" }}>
            {instructionIntent}
          </div>
        </div>
      </div>

      {byHour.length > 0 && (
        <div className="mt-4 flex items-end gap-1.5" style={{ height: "84px" }}>
          {byHour.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full max-w-[18px] rounded-t"
                style={{
                  height: Math.max(4, (h.calls / scaleMax) * 72) + "px",
                  backgroundColor: "#1e3a8a",
                }}
                title={h.calls + " calls"}
              />
              <div className="text-[10px] text-gray-400">{h.hour}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
