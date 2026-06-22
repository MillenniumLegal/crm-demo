// Lead resale — the admin revenue line: sell surplus / out-of-area / unconverted / declined
// leads to partner firms. The deal pipeline, sellable inventory, buyers, sold-by-type and
// resale revenue trend. Gated on GDPR consent (only partner-consented leads are sellable).

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { fetchLeadResale, LeadResale as LR } from '@/services/leadResaleService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { BuyersTable } from '@/components/resale/BuyersTable';

const LeadResale: React.FC = () => {
  const [data, setData] = useState<LR | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchLeadResale()
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
          Lead <span className="font-serif italic text-navy-700">resale.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Sell surplus and out-of-area leads to partner firms — margin from leads you cannot service.</p>
      </div>

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>{data.note}</span>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Resale pipeline" caption="Available → offered → sold → delivered → paid" items={data.pipeline} defaultTone="info" />
        <RankedBarList title="Sellable inventory" caption="Why these leads are sellable" items={data.inventory} defaultTone="warn" />
      </div>

      <BuyersTable buyers={data.buyers} />

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendLineChart
          title="Resale revenue"
          caption="Last 6 months (£)"
          area
          height={200}
          series={[{ key: 'rev', label: 'Revenue', color: '#16a34a', points: data.revenueTrend.labels.map((x, i) => ({ x, y: data.revenueTrend.values[i] })) }]}
        />
        <RankedBarList title="Sold by matter type" caption="This month" items={data.byType} defaultTone="info" />
      </div>
    </div>
  );
};

export default LeadResale;
