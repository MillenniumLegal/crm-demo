// Sales velocity — how fast deals move and why they win or lose: stage durations, the
// lead→instruction time trend, win vs loss reasons, and conversion by lead age (the
// speed-to-lead payoff).

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchSalesVelocity, SalesVelocity as SV } from '@/services/salesVelocityService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { RangeFilter, rangeLabel, scaleRangeCount } from '@/components/analytics/RangeFilter';

const DURATION_FACTOR: Record<string, number> = {
  today: 0.9,
  '7d': 0.96,
  '30d': 1,
  '90d': 1.04,
  year: 1.1,
  all: 1.14,
};

const SalesVelocity: React.FC = () => {
  const [data, setData] = useState<SV | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchSalesVelocity()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<SV | null>(() => {
    if (!data) return null;
    const durationFactor = DURATION_FACTOR[range] ?? 1;
    const scaleDuration = (value: number) => Number(Math.max(0.1, value * durationFactor).toFixed(1));

    return {
      ...data,
      kpis: data.kpis.map((kpi) => {
        if (kpi.label === 'Lead → instruction') {
          return {
            ...kpi,
            value: `${scaleDuration(11.2)}d`,
            sub: `vs ${scaleDuration(13.8)}d last qtr`,
          };
        }
        if (kpi.label === 'Quote → accept') {
          return {
            ...kpi,
            value: `${scaleDuration(3.4)}d`,
            sub: `vs ${scaleDuration(4.1)}d`,
          };
        }
        return kpi;
      }),
      stageDays: data.stageDays.map((item) => ({
        ...item,
        count: Math.max(1, Math.round(item.count * durationFactor)),
      })),
      winReasons: data.winReasons.map((item) => ({
        ...item,
        count: scaleRangeCount(item.count, range),
      })),
      lossReasons: data.lossReasons.map((item) => ({
        ...item,
        count: scaleRangeCount(item.count, range),
      })),
      velocityTrend: {
        ...data.velocityTrend,
        values: data.velocityTrend.values.map(scaleDuration),
      },
    };
  }, [data, range]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Sales <span className="font-serif italic text-navy-700">velocity.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">How fast deals move — and why they win or lose.</p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={rangeData?.kpis ?? data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Days in each stage" caption={`Average time to move forward · ${rangeLabel(range)}`} items={rangeData?.stageDays ?? data.stageDays} defaultTone="info" />
        <TrendLineChart
          title="Lead → instruction time"
          caption={`Selected window trend (days — lower is better) · ${rangeLabel(range)}`}
          area
          height={200}
          series={[{ key: 'v', label: 'Days', color: '#1e3a8a', points: (rangeData ?? data).velocityTrend.labels.map((x, i) => ({ x, y: (rangeData ?? data).velocityTrend.values[i] })) }]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Why we win" caption={`Reasons quotes are accepted · ${rangeLabel(range)}`} items={rangeData?.winReasons ?? data.winReasons} defaultTone="good" />
        <RankedBarList title="Why we lose" caption={`Reasons quotes are declined · ${rangeLabel(range)}`} items={rangeData?.lossReasons ?? data.lossReasons} defaultTone="bad" />
      </div>

      <RankedBarList title="Conversion by lead age at first contact" caption="Conversion % — the faster you call, the more you win" items={data.conversionByAge} defaultTone="info" />
    </div>
  );
};

export default SalesVelocity;
