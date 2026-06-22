import React from "react";

interface MatterStage {
  label: string;
  count: number;
  medianDays: number;
  benchmarkDays: number;
}

interface Props {
  stages: MatterStage[];
}

export const StagePipeline: React.FC<Props> = ({ stages }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Case pipeline</h3>
      <p className="text-xs text-gray-500">
        Matters in each stage, and time-in-stage vs benchmark
      </p>

      {stages.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400">
          No stages to display
        </div>
      ) : (
        <>
          <div className="mt-3">
            {stages.map((stage, i) => {
              const maxMedian = Math.max(...stages.map((s) => s.medianDays), 1);
              const over = stage.medianDays > stage.benchmarkDays;
              const width = Math.round((stage.medianDays / maxMedian) * 100);
              const isDone = stage.medianDays === 0;

              return (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0"
                >
                  <span className="w-44 shrink-0 truncate text-sm font-medium text-gray-800">
                    {stage.label}
                  </span>

                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums">
                    {stage.count}
                  </span>

                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    {!isDone && (
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: width + "%",
                          backgroundColor: over ? "#f59e0b" : "#16a34a",
                        }}
                      />
                    )}
                  </div>

                  <span className="w-28 text-right text-xs tabular-nums text-gray-600">
                    {isDone ? (
                      <span className="text-gray-400">done</span>
                    ) : (
                      <>
                        {stage.medianDays}d
                        <span className="text-gray-400">
                          {" / "}
                          {stage.benchmarkDays}d
                        </span>
                        {over && (
                          <span style={{ color: "#b45309" }}>
                            {" "}
                            +{stage.medianDays - stage.benchmarkDays}d
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Bar = median days in stage. Amber = over benchmark.
          </p>
        </>
      )}
    </div>
  );
};
