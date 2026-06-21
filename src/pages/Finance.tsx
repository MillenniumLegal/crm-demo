// Finance hub — the money at a glance: quote/invoice/revenue KPIs, recent quotes
// and invoices, and outstanding-payment aging. Compiles quotes + payments data.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchFinanceOverview, FinanceOverview } from '@/services/hubsService';
import { FinanceKpiStrip } from '@/components/hubs/FinanceKpiStrip';
import { MoneyList } from '@/components/hubs/MoneyList';
import { AgingBars } from '@/components/hubs/AgingBars';

const Finance: React.FC = () => {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchFinanceOverview()
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
          Finance<span className="font-serif italic text-navy-700">.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Quotes, payments and revenue — the money at a glance.</p>
      </div>

      <FinanceKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-3">
        <MoneyList title="Recent quotes" rows={data.recentQuotes} />
        <MoneyList title="Recent invoices" rows={data.recentInvoices} />
        <AgingBars buckets={data.aging} />
      </div>
    </div>
  );
};

export default Finance;
