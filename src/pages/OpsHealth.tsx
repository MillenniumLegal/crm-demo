// Integrations & ops health — are the feeds fresh, the data clean, and the automations
// firing, before any of it quietly corrupts the numbers every other view depends on.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchOpsHealth, OpsHealth as OH } from '@/services/opsHealthService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { IntegrationsBoard } from '@/components/ops/IntegrationsBoard';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const OpsHealth: React.FC = () => {
  const [data, setData] = useState<OH | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchOpsHealth()
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
          Ops <span className="font-serif italic text-navy-700">health.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Are the feeds fresh, the data clean, and the automations firing — before any of it corrupts the numbers.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <IntegrationsBoard integrations={data.integrations} />

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendLineChart
          title="CRM-vs-3CX match rate"
          caption="Last 14 days (%)"
          area
          height={200}
          series={[{ key: 'm', label: 'Match %', color: '#16a34a', points: data.reconTrend.labels.map((x, i) => ({ x, y: data.reconTrend.values[i] })) }]}
        />
        <TrendLineChart
          title="Errors per day"
          caption="Last 14 days"
          area
          height={200}
          series={[{ key: 'e', label: 'Errors', color: '#ef4444', points: data.errorTrend.labels.map((x, i) => ({ x, y: data.errorTrend.values[i] })) }]}
        />
      </div>

      <RankedBarList title="Data gaps to fix" caption="Records missing fields or duplicated" items={data.dataGaps} defaultTone="warn" />
    </div>
  );
};

export default OpsHealth;
