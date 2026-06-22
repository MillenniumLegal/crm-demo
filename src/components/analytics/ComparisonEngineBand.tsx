// Self-contained comparison-engine intelligence band: which comparison site performs,
// the quote-engine funnel, where users get stuck (abandon), and submissions vs prior.
// Self-fetches via fetchComparisonEngine and renders nothing until data arrives.

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { fetchComparisonEngine, ComparisonEngine } from "@/services/comparisonEngineService";
import { RankedBarList } from "@/components/analytics/RankedBarList";
import { TrendLineChart } from "@/components/trends/TrendLineChart";

export const ComparisonEngineBand: React.FC = () => {
  const [data, setData] = useState<ComparisonEngine | null>(null);

  useEffect(() => {
    let active = true;
    fetchComparisonEngine().then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;

  const sites = data.sites ?? [];
  const stuck = data.stuck ?? [];
  const labels = data.trend?.labels ?? [];
  const current = data.trend?.current ?? [];
  const prior = data.trend?.prior ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Comparison engine</h2>
        <p className="text-xs text-gray-500">
          Which site performs, and where users drop off — {data.range}
        </p>
      </div>

      {sites.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {sites.map((s, i) => {
            const up = s.deltaPct >= 0;
            const deltaColor = up ? "#16a34a" : "#ef4444";
            const DeltaIcon = up ? TrendingUp : TrendingDown;
            return (
              <div
                key={`${s.site}-${i}`}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate font-semibold text-gray-900">{s.site}</span>
                  {s.site === data.topSite && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 text-[10px] text-indigo-700">
                      Top
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  <div className="text-gray-700">
                    <span className="tabular-nums">Submitted {s.submitted}</span>
                    <span className="text-gray-400"> of {s.started} started</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Conversion</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {s.conversion}%
                      </span>
                      <span
                        className="flex items-center gap-0.5 text-xs font-medium tabular-nums"
                        style={{ color: deltaColor }}
                      >
                        <DeltaIcon className="h-3 w-3" aria-hidden="true" />
                        {(up ? "+" : "") + s.deltaPct + "%"}
                      </span>
                    </span>
                  </div>

                  <div className="text-gray-700">
                    Avg quote <span className="tabular-nums">£{s.avgQuote}</span>
                  </div>
                  <div className="text-gray-700 tabular-nums">{s.instructions} instructed</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No site data yet</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <RankedBarList
          title="Quote engine funnel"
          caption="Started to instructed"
          items={data.funnel ?? []}
          defaultTone="info"
        />

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Where users get stuck</h3>
          <p className="text-xs text-gray-500">Abandonment by step</p>
          {stuck.length > 0 ? (
            <div className="mt-3">
              {stuck.map((row, i) => (
                <div
                  key={`${row.step}-${i}`}
                  className="flex items-center justify-between border-b py-1.5 last:border-0"
                >
                  <span className="text-sm text-gray-700">{row.step}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 tabular-nums">
                    {row.count} · {row.pct}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
          )}
        </div>
      </div>

      <TrendLineChart
        title="Submissions over time"
        caption="This period vs prior"
        height={180}
        series={[
          {
            key: "current",
            label: "This period",
            color: "#1e3a8a",
            points: labels.map((x, i) => ({ x, y: current[i] })),
          },
          {
            key: "prior",
            label: "Prior",
            color: "#94a3b8",
            points: labels.map((x, i) => ({ x, y: prior[i] })),
          },
        ]}
      />

      {data.note && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          <span>{data.note}</span>
        </div>
      )}
    </div>
  );
};
