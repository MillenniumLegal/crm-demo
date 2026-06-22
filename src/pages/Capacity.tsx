// Capacity & workload — is the firm over capacity, who is overloaded, and where work piles
// up: demand vs capacity trend, caseload by fee-earner (vs cap), and the bottleneck stage.

import React, { useEffect, useState } from 'react';
import { Loader2, Scale } from 'lucide-react';
import { fetchCapacity, Capacity as Cap } from '@/services/capacityService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const Capacity: React.FC = () => {
  const [data, setData] = useState<Cap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCapacity()
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
          Capacity &amp; <span className="font-serif italic text-navy-700">workload.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Demand vs capacity, caseload balance, and where work piles up.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <TrendLineChart
        title="Demand vs capacity"
        caption="New matters per week vs throughput capacity (last 8 weeks)"
        height={210}
        series={[
          { key: 'demand', label: 'Demand', color: '#1e3a8a', points: data.demandVsCapacity.labels.map((x, i) => ({ x, y: data.demandVsCapacity.demand[i] })) },
          { key: 'capacity', label: 'Capacity', color: '#94a3b8', points: data.demandVsCapacity.labels.map((x, i) => ({ x, y: data.demandVsCapacity.capacity[i] })) },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Caseload by fee-earner" caption="Open matters vs caseload cap" items={data.byFeeEarner} defaultTone="warn" />
        <RankedBarList title="Where matters pile up" caption="Open matters by stage (bottleneck)" items={data.bottlenecks} defaultTone="bad" />
      </div>

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Scale className="h-5 w-5 shrink-0 text-amber-600" />
        <span>{data.note}</span>
      </div>
    </div>
  );
};

export default Capacity;
