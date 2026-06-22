import React from "react";

interface MktAdvice {
  severity: "high" | "med" | "low";
  title: string;
  text: string;
}

interface Props {
  advice: MktAdvice[];
}

const SEVERITY_COLOR: Record<MktAdvice["severity"], string> = {
  high: "#ef4444",
  med: "#f59e0b",
  low: "#16a34a",
};

export const MarketingAdvice: React.FC<Props> = ({ advice }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">What to do next</h3>
      <p className="text-xs text-gray-500">
        Recommendations from your acquisition data
      </p>

      {!advice || advice.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No recommendations</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {advice.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-gray-100 p-3"
            >
              <span
                className="w-1 self-stretch rounded"
                style={{ backgroundColor: SEVERITY_COLOR[item.severity] }}
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {item.title}
                </div>
                <div className="mt-0.5 text-xs leading-5 text-gray-600">
                  {item.text}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
