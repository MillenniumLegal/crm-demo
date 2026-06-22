// Revenue boost — money on the table: recovery opportunities (cash to pull in), revenue
// at risk (protect before it slips), upsell/repeat (grow existing clients), and WIP/lockup
// aging. The "what would boost financial stuffs" layer.

import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchRevenueOpportunities, RevenueOpportunities } from '@/services/revenueOpportunitiesService';
import { OpportunityList } from '@/components/finance/OpportunityList';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const fmtK = (n: number) => '£' + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));

const RevenueBoost: React.FC = () => {
  const navigate = useNavigate();
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

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-navy-700" />
              <h2 className="text-sm font-semibold text-gray-900">Recovery Engine connected</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              The cash recovery list now feeds the approval-first engine: old non-interested leads, quoted-no-touch,
              wrong-number repairs and won-client referral opportunities are grouped with AI draft logic and agent capacity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/recovery-engine')}
            className="inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: '#1e3a8a' }}
          >
            Open engine <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { label: 'Recoverable cash', value: fmtK(data.summary.recoverable), color: '#16a34a' },
            { label: 'Approval queue', value: '42', color: '#f59e0b' },
            { label: 'Contact repairs', value: '53', color: '#4338ca' },
            { label: 'AI touches', value: '1.9k', color: '#1e3a8a' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-gray-500">{metric.label}</div>
              <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: metric.color }}>{metric.value}</div>
            </div>
          ))}
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
