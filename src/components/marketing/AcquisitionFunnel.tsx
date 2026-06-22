import React from "react";

interface Stage {
  label: string;
  count: number;
}

interface Props {
  stages: Stage[];
}

const formatCount = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return String(n);
};

export const AcquisitionFunnel: React.FC<Props> = ({ stages }) => {
  const firstCount = stages.length > 0 ? stages[0].count : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">Acquisition funnel</div>
      <div className="text-xs text-gray-500">Impression to instruction</div>

      {stages.length === 0 || firstCount <= 0 ? (
        <div className="mt-4 text-xs text-gray-400">No data yet</div>
      ) : (
        <div className="mt-4 space-y-3">
          {stages.map((stage, i) => {
            const prevCount = i > 0 ? stages[i - 1].count : 0;
            const stepRate =
              i > 0 && prevCount > 0
                ? Math.round((stage.count / prevCount) * 100)
                : null;
            const fillWidth = (stage.count / firstCount) * 100 + "%";

            return (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{stage.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-gray-900">
                      {formatCount(stage.count)}
                    </span>
                    {stepRate !== null && (
                      <span className="text-[11px] text-gray-400 tabular-nums">
                        {stepRate}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-3 rounded bg-gray-100">
                  <div
                    className="h-3 rounded"
                    style={{ width: fillWidth, backgroundColor: "#1e3a8a" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
