import React from "react";
import { MarketingKpiStrip } from "@/components/marketing/MarketingKpiStrip";
import { TrendLineChart } from "@/components/trends/TrendLineChart";
import { RankedBarList } from "@/components/analytics/RankedBarList";

interface MktKpi {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "info";
  deltaPct: number;
  good: boolean;
}

interface Props {
  kpis: MktKpi[];
  revenue6mo: { labels: string[]; values: number[] };
  byType: { label: string; count: number }[];
}

export const RevenueTrendBand: React.FC<Props> = ({ kpis, revenue6mo, byType }) => {
  const labels = revenue6mo?.labels ?? [];
  const values = revenue6mo?.values ?? [];
  const points = labels.map((x, i) => ({ x, y: values[i] ?? 0 }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Revenue</h2>
        <p className="text-xs text-gray-500">Last 6 months, and where it comes from</p>
      </div>

      <MarketingKpiStrip kpis={kpis} />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendLineChart
          title="Monthly revenue"
          caption="Last 6 months · Jun is month-to-date"
          area
          height={200}
          yFormat="currency"
          series={[
            {
              key: "rev",
              label: "Revenue",
              color: "#1e3a8a",
              points,
            },
          ]}
        />
        <RankedBarList
          title="Revenue by matter type"
          caption="This month (GBP)"
          items={byType}
          defaultTone="info"
        />
      </div>
    </div>
  );
};
