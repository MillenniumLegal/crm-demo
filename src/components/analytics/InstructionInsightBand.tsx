// "Instruction trends & comparison" band for the Instructions report — adds the
// compare-with-the-past layer the snapshot report lacked: KPIs with vs-prior deltas,
// instructions over time (this period vs prior), the Sale/Purchase/Both unit split
// (Sale + Purchase counts as 2 units), and source movers vs the prior period.
// Self-contained (fetches its own data) so it drops into the report with one line.

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchInstructionInsights, InstructionInsights } from '@/services/instructionInsightsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

export const InstructionInsightBand: React.FC = () => {
  const [data, setData] = useState<InstructionInsights | null>(null);

  useEffect(() => {
    let active = true;
    fetchInstructionInsights()
      .then((d) => { if (active) setData(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Instruction trends &amp; comparison</h2>
        <p className="mt-0.5 text-sm text-gray-500">How instructions are moving versus the previous period — {data.range}.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendLineChart
          title="Instructions over time"
          caption="This period vs the prior period"
          height={200}
          series={[
            { key: 'current', label: 'This period', color: '#1e3a8a', points: data.trend.labels.map((x, i) => ({ x, y: data.trend.current[i] })) },
            { key: 'prior', label: 'Prior period', color: '#94a3b8', points: data.trend.labels.map((x, i) => ({ x, y: data.trend.prior[i] })) },
          ]}
        />
        <RankedBarList
          title="Instruction units — Sale / Purchase / Both"
          caption="A Sale + Purchase instruction counts as 2 units"
          items={data.unitSplit}
          defaultTone="info"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Source movers</h3>
        <p className="text-xs text-gray-500">Instructions by source vs the prior period</p>
        <div className="mt-3 space-y-2">
          {data.sourceMovers.map((m) => {
            const up = m.deltaPct >= 0;
            return (
              <div key={m.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-700">{m.label}</span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-gray-500">{m.prev} → <span className="font-semibold text-gray-900">{m.now}</span></span>
                  <span className="inline-flex w-16 items-center justify-end gap-0.5 font-semibold" style={{ color: up ? '#16a34a' : '#ef4444' }}>
                    {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {up ? '+' : ''}{m.deltaPct}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
