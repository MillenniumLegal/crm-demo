import React from "react";

interface RiskFlag {
  matter: string;
  flag: string;
  severity: "high" | "med" | "low";
  owner?: string;
}

interface Props {
  flags: RiskFlag[];
}

const SEVERITY_CHIP: Record<RiskFlag["severity"], string> = {
  high: "bg-red-50 text-red-700",
  med: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

export const RiskFlagBoard: React.FC<Props> = ({ flags }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Risk flags</h3>
        <p className="text-xs text-gray-500">Matters needing compliance review</p>
      </div>

      {flags.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-500">
          No open flags — all matters cleared.
        </p>
      ) : (
        <div>
          {flags.map((f, i) => (
            <div
              key={`${f.matter}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {f.matter}
                </p>
                <p className="text-xs text-gray-500">
                  {f.flag}
                  {f.owner ? ` · ${f.owner}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_CHIP[f.severity]}`}
              >
                {f.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
