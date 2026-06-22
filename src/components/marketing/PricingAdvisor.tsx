import React from "react";
import { Lightbulb } from "lucide-react";

interface MktPricing {
  bands: { band: string; sent: number; accepted: number; winRate: number }[];
  recommendation: string;
}

interface Props {
  pricing: MktPricing;
}

export const PricingAdvisor: React.FC<Props> = ({ pricing }) => {
  const bands = pricing?.bands ?? [];

  const bestWinRate = bands.length
    ? bands.reduce((m, b) => (b.winRate > m ? b.winRate : m), -Infinity)
    : -Infinity;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">Pricing advisor</div>
      <div className="text-xs text-gray-500">Win rate by quote value band</div>

      {bands.length === 0 ? (
        <div className="mt-3 text-xs text-gray-500">No pricing data available.</div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {bands.map((b, i) => {
            const fillColor =
              b.winRate >= 30 ? "#16a34a" : b.winRate >= 20 ? "#f59e0b" : "#ef4444";
            const width = Math.max(0, Math.min(100, b.winRate));
            const isBest = b.winRate === bestWinRate;
            return (
              <div key={`${b.band}-${i}`} className="flex items-center gap-3">
                <div className="flex w-28 items-center gap-1.5">
                  <span className="text-sm text-gray-700">{b.band}</span>
                  {isBest && (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      best
                    </span>
                  )}
                </div>
                <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-2.5 rounded-full"
                    style={{ width: `${width}%`, backgroundColor: fillColor }}
                  />
                </div>
                <div className="w-28 text-right text-xs tabular-nums text-gray-600">
                  {b.winRate}% ({b.accepted}/{b.sent})
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" />
          <div>
            <div className="text-sm font-semibold text-gray-900">Recommendation</div>
            <div className="text-sm text-gray-700">{pricing?.recommendation}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
