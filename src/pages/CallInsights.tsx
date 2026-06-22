// Call insights — the restructured call-analytics view: every analysed call grouped into
// clickable signals (topics, impact, objections, blockers, guidance). Click any signal to
// open the calls behind it from the right — which agent, which lead, the exact words, and
// an APCM AI note — with a trend and conversion impact.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchCallInsights, CallInsights as CI, SignalItem } from '@/services/callInsightsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalGroup } from '@/components/callinsights/SignalGroup';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';

const CallInsights: React.FC = () => {
  const [data, setData] = useState<CI | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SignalItem | null>(null);

  useEffect(() => {
    let active = true;
    fetchCallInsights()
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

  const group = (k: string) => {
    const g = data.groups.find((x) => x.key === k);
    if (!g) return null;
    return <SignalGroup title={g.title} caption={g.caption} items={g.items} tone={g.tone} onSelect={setSelected} />;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Call <span className="font-serif italic text-navy-700">insights.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Every analysed call grouped into signals — click any signal for the calls behind it (which agent, which lead, the exact words, an AI note).</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

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
