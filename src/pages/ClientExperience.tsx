// Client experience — are clients happy, kept informed, and recommending us: NPS trend,
// review funnel, update cadence vs promise, referrals/repeat, and the open-complaints list.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchClientExperience, ClientExperience as CX } from '@/services/clientExperienceService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const SEV_HEX: Record<string, string> = { high: '#ef4444', med: '#f59e0b', low: '#94a3b8' };

const ClientExperience: React.FC = () => {
  const [data, setData] = useState<CX | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchClientExperience()
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
          Client <span className="font-serif italic text-navy-700">experience.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Are clients happy, kept informed, and recommending you.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendLineChart
          title="Net Promoter Score"
          caption="Last 6 months"
          area
          height={200}
          series={[{ key: 'nps', label: 'NPS', color: '#16a34a', points: data.npsTrend.labels.map((x, i) => ({ x, y: data.npsTrend.values[i] })) }]}
        />
        <RankedBarList title="Review funnel" caption="Asked → 5-star" items={data.reviewFunnel} defaultTone="info" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Update cadence vs promise" caption="Keeping clients informed" items={data.cadence} defaultTone="warn" />
        <RankedBarList title="Referrals & repeat" caption="Growth from happy clients" items={data.referrals} defaultTone="good" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Open complaints</h3>
        <p className="text-xs text-gray-500">Resolve before they escalate</p>
        <div className="mt-3 divide-y divide-gray-100">
          {data.complaints.length === 0 ? (
            <p className="py-3 text-sm text-gray-400">No open complaints.</p>
          ) : data.complaints.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEV_HEX[c.severity] || '#94a3b8' }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{c.client}</p>
                <p className="text-xs text-gray-500 truncate">{c.issue}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-gray-500">{c.age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClientExperience;
