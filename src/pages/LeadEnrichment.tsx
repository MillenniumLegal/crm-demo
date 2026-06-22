// Lead enrichment — who your leads really are: domain reverse-lookup → company, job title
// and seniority; where they come from (UK region); email-domain mix; and the decision-maker
// signal so the best leads go to your best closers.

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { fetchLeadEnrichment, LeadEnrichment as LE } from '@/services/leadEnrichmentService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { TrendLineChart } from '@/components/trends/TrendLineChart';

const SIG_HEX: Record<string, string> = { high: '#15803d', med: '#b45309', low: '#475569' };
const SIG_BG: Record<string, string> = { high: '#dcfce7', med: '#fef3c7', low: '#f1f5f9' };

const LeadEnrichment: React.FC = () => {
  const [data, setData] = useState<LE | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchLeadEnrichment()
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
          Lead <span className="font-serif italic text-navy-700">enrichment.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Who your leads really are — domain reverse-lookup, job &amp; seniority, and where they&rsquo;re coming from.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="flex gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
        <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
        <span>{data.note}</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Where leads come from (UK)" caption="by region — reverse-geocoded" items={data.byRegion} defaultTone="info" />
        <TrendLineChart
          title="Enrichment match rate"
          caption="Last 6 months (%)"
          area
          height={200}
          series={[{ key: 'm', label: 'Matched', color: '#16a34a', points: data.matchTrend.labels.map((x, i) => ({ x, y: data.matchTrend.values[i] })) }]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="By seniority" caption="decision-maker concentration" items={data.bySeniority} defaultTone="navy" />
        <RankedBarList title="By job / industry" caption="reverse-looked-up role" items={data.byJob} defaultTone="info" />
      </div>

      <RankedBarList title="By email domain" caption="personal vs company addresses" items={data.bySourceDomain} defaultTone="warn" />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Enriched leads</h3>
        <p className="text-xs text-gray-500">Domain reverse-lookup → company, role &amp; seniority</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2">Lead</th><th>Company</th><th>Role</th><th>Seniority</th><th>Region</th>
              <th className="text-right">Property</th><th className="text-right">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.leads.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 font-medium text-gray-900">{l.name}<div className="text-[11px] font-normal text-gray-400">{l.domain}</div></td>
                <td className="pr-3 text-gray-700">{l.company}</td>
                <td className="pr-3 text-gray-700">{l.jobTitle}</td>
                <td className="pr-3 text-gray-600">{l.seniority}</td>
                <td className="pr-3 text-gray-600">{l.region}</td>
                <td className="pr-3 text-right tabular-nums text-gray-700">£{Math.round(l.propertyValue / 1000)}k</td>
                <td className="text-right">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ backgroundColor: SIG_BG[l.signal] || '#f1f5f9', color: SIG_HEX[l.signal] || '#475569' }}>{l.signal}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadEnrichment;
