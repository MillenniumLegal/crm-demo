// Revenue boost — money on the table: recovery opportunities (cash to pull in), revenue
// at risk (protect before it slips), upsell/repeat (grow existing clients), and WIP/lockup
// aging. The "what would boost financial stuffs" layer.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchRevenueOpportunities, RevenueOpportunities } from '@/services/revenueOpportunitiesService';
import { OpportunityList } from '@/components/finance/OpportunityList';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const fmtK = (n: number) => '£' + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));

const RevenueBoost: React.FC = () => {
  const [data, setData] = useState<RevenueOpportunities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchRevenueOpportunities()
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

  const overLockup = data.summary.lockupDays > data.summary.lockupTarget;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Revenue <span className="font-serif italic text-navy-700">boost.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Money on the table — recover it, protect it, grow it.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Recoverable now</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#16a34a' }}>{fmtK(data.summary.recoverable)}</p>
          <p className="text-xs text-gray-500">across recovery actions</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Revenue at risk</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#ef4444' }}>{fmtK(data.summary.atRisk)}</p>
          <p className="text-xs text-gray-500">if not actioned</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Lockup</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: overLockup ? '#f59e0b' : '#16a34a' }}>{data.summary.lockupDays}d</p>
          <p className="text-xs text-gray-500">target {data.summary.lockupTarget}d</p>
        </div>
      </div>

      <OpportunityList title="Recovery opportunities" caption="Cash you can pull in this week" items={data.recovery} accent="good" />

      <div className="grid gap-5 xl:grid-cols-2">
        <OpportunityList title="Revenue at risk" caption="Protect these before they slip" items={data.atRisk} accent="bad" />
        <OpportunityList title="Upsell & repeat" caption="Grow from clients you already have" items={data.upsell} accent="good" />
      </div>

      <RankedBarList
        title="Work in progress by age (£)"
        caption={`Lockup ${data.summary.lockupDays} days vs ${data.summary.lockupTarget}-day target — chase the 90d+ WIP`}
        items={data.wip.map((w) => ({ label: w.label, count: w.value }))}
        defaultTone="warn"
      />
    </div>
  );
};

export default RevenueBoost;
