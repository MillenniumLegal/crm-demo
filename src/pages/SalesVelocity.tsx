// Sales velocity — how fast deals move and why they win or lose: stage durations, the
// lead→instruction time trend, win vs loss reasons, and conversion by lead age (the
// speed-to-lead payoff).

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchSalesVelocity, SalesVelocity as SV } from '@/services/salesVelocityService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const SalesVelocity: React.FC = () => {
  const [data, setData] = useState<SV | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSalesVelocity()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Sales <span className="font-serif italic text-navy-700">velocity.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">How fast deals move — and why they win or lose.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Days in each stage" caption="Average time to move forward" items={data.stageDays} defaultTone="info" />
        <TrendLineChart
          title="Lead → instruction time"
          caption="Last 6 months (days — lower is better)"
          area
          height={200}
          series={[{ key: 'v', label: 'Days', color: '#1e3a8a', points: data.velocityTrend.labels.map((x, i) => ({ x, y: data.velocityTrend.values[i] })) }]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Why we win" caption="Reasons quotes are accepted" items={data.winReasons} defaultTone="good" />
        <RankedBarList title="Why we lose" caption="Reasons quotes are declined" items={data.lossReasons} defaultTone="bad" />
      </div>

      <RankedBarList title="Conversion by lead age at first contact" caption="Conversion % — the faster you call, the more you win" items={data.conversionByAge} defaultTone="info" />
    </div>
  );
};

export default SalesVelocity;
