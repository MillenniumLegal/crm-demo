// Call insights — the restructured call-analytics view: every analysed call grouped into
// clickable signals (topics, impact, objections, blockers, guidance). Click any signal to
// open the calls behind it from the right — which agent, which lead, the exact words, and
// an APCM AI note — with a trend and conversion impact.

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchCallInsights, CallInsights as CI, SignalItem } from '@/services/callInsightsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalGroup } from '@/components/callinsights/SignalGroup';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';
import { RangeFilter, rangeLabel, scaleRangeCount } from '@/components/analytics/RangeFilter';

const CallInsights: React.FC = () => {
  const [data, setData] = useState<CI | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SignalItem | null>(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchCallInsights()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<CI | null>(() => {
    if (!data) return null;

    const scaleText = (text: string) =>
      text.replace(/\d[\d,]*/g, (match) => {
        const value = Number(match.replace(/,/g, ''));
        return Number.isFinite(value) ? scaleRangeCount(value, range).toLocaleString() : match;
      });

    return {
      ...data,
      kpis: data.kpis.map((kpi) => ({
        ...kpi,
        value: kpi.value.includes('%') ? kpi.value : scaleText(kpi.value),
        sub: scaleText(kpi.sub),
      })),
      groups: data.groups.map((group) => ({
        ...group,
        caption: `${group.caption} · ${rangeLabel(range)}`,
        items: group.items.map((item) => ({
          ...item,
          count: scaleRangeCount(item.count, range),
          calls: scaleRangeCount(item.calls, range),
          trend: item.trend.map((point) => scaleRangeCount(point, range)),
        })),
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
    return <SignalGroup title={g.title} caption={g.caption} items={g.items} tone={g.tone} onSelect={setSelected} />;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Call <span className="font-serif italic text-navy-700">insights.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Every analysed call grouped into signals — click any signal for the calls behind it (which agent, which lead, the exact words, an AI note).</p>
        </div>
        <RangeFilter value={range} onChange={(value) => { setRange(value); setSelected(null); }} />
      </div>

      <MarketingKpiStrip kpis={rangeData?.kpis ?? data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Who the calls were with" caption="% of analysed calls" items={data.withWho} defaultTone="info" />
        <RankedBarList title="How the calls landed" caption="conversation quality" items={data.howLanded} defaultTone="info" />
      </div>

      {group('topics')}

      <div className="grid gap-5 xl:grid-cols-2">
        {group('objections')}
        {group('blockers')}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {group('impact')}
        {group('solutions')}
      </div>

      {group('guidance')}

      <SignalDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CallInsights;
