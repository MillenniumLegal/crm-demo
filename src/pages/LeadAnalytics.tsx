// Lead analytics — the "Leads" analytics view: where leads sit, how they feel, what they
// push back on (worst-handled first, with handling quality), client questions and follow-up
// outcomes. Click any signal to open the calls behind it from the right — with the handling
// breakdown (Strong/Adequate/Weak/Missed) and client-said / rep-replied / client-reaction.

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchLeadAnalytics, LeadAnalytics as LA, LASignalItem } from '@/services/leadAnalyticsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalGroup } from '@/components/callinsights/SignalGroup';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';
import { RangeFilter, rangeLabel, scaleRangeCount } from '@/components/analytics/RangeFilter';

const LeadAnalytics: React.FC = () => {
  const [data, setData] = useState<LA | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LASignalItem | null>(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchLeadAnalytics()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<LA | null>(() => {
    if (!data) return null;

    const scaleText = (text: string) =>
      text.replace(/\d[\d,]*/g, (match) => {
        const value = Number(match.replace(/,/g, ''));
        return Number.isFinite(value) ? scaleRangeCount(value, range).toLocaleString() : match;
      });

    const scaleHandling = (handling: LASignalItem['handling'], targetTotal: number) => {
      if (!handling || targetTotal <= 0) return handling;
      const keys: Array<keyof NonNullable<LASignalItem['handling']>> = ['strong', 'adequate', 'weak', 'missed'];
      const rawTotal = keys.reduce((sum, key) => sum + Math.max(0, handling[key] ?? 0), 0);
      if (rawTotal <= 0) return handling;

      const rows = keys.map((key) => {
        const exact = (Math.max(0, handling[key] ?? 0) / rawTotal) * targetTotal;
        return { key, value: Math.floor(exact), remainder: exact % 1 };
      });
      let allocated = rows.reduce((sum, row) => sum + row.value, 0);
      rows
        .sort((a, b) => b.remainder - a.remainder)
        .forEach((row) => {
          if (allocated < targetTotal) {
            row.value += 1;
            allocated += 1;
          }
        });

      return rows.reduce((next, row) => ({ ...next, [row.key]: row.value }), {
        strong: 0,
        adequate: 0,
        weak: 0,
        missed: 0,
      });
    };

    return {
      ...data,
      kpis: data.kpis.map((kpi) => (
        kpi.label === 'In range'
          ? { ...kpi, value: scaleText(kpi.value), sub: scaleText(kpi.sub) }
          : kpi
      )),
      lifecycle: data.lifecycle.map((item) => ({
        ...item,
        count: scaleRangeCount(item.count, range),
      })),
      groups: data.groups.map((group) => ({
        ...group,
        caption: `${group.caption} · ${rangeLabel(range)}`,
        items: group.items.map((item) => {
          const scaledCalls = scaleRangeCount(item.calls, range);
          return {
            ...item,
            count: scaleRangeCount(item.count, range),
            calls: scaledCalls,
            handling: scaleHandling(item.handling, scaledCalls),
            trend: item.trend.map((point) => scaleRangeCount(point, range)),
          };
        }),
      })),
    };
  }, [data, range]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const group = (k: string) => {
    const g = rangeData?.groups.find((x) => x.key === k);
    if (!g) return null;
    return <SignalGroup title={g.title} caption={g.caption} items={g.items as any} tone={g.tone} onSelect={setSelected as any} />;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Lead <span className="font-serif italic text-navy-700">analytics.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Where leads sit, how they feel, and what they push back on — click any signal for the calls behind it (with handling quality).</p>
        </div>
        <RangeFilter value={range} onChange={(value) => { setRange(value); setSelected(null); }} />
      </div>

      <MarketingKpiStrip kpis={rangeData?.kpis ?? data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Where leads sit now" caption={`lifecycle distribution · ${rangeLabel(range)}`} items={rangeData?.lifecycle ?? data.lifecycle} defaultTone="info" />
        <RankedBarList title="Info we actually extract" caption="qualification capture rate (%)" items={data.qualificationCapture} defaultTone="warn" />
      </div>

      {group('objections')}

      <div className="grid gap-5 xl:grid-cols-2">
        {group('sentiment')}
        {group('questions')}
      </div>

      {group('followup')}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Lines that landed</h3>
        <p className="text-xs italic text-gray-500">standout phrases from the calls</p>
        <div className="mt-3 space-y-2">
          {data.standoutPhrases.map((p, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm italic text-gray-800">&ldquo;{p.quote}&rdquo;</p>
              <p className="mt-1 text-[11px] text-gray-400">{p.agent} · {p.date}</p>
            </div>
          ))}
        </div>
      </div>

      <SignalDrawer item={selected as any} onClose={() => setSelected(null)} />
    </div>
  );
};

export default LeadAnalytics;
