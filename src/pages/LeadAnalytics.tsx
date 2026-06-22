// Lead analytics — the "Leads" analytics view: where leads sit, how they feel, what they
// push back on (worst-handled first, with handling quality), client questions and follow-up
// outcomes. Click any signal to open the calls behind it from the right — with the handling
// breakdown (Strong/Adequate/Weak/Missed) and client-said / rep-replied / client-reaction.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchLeadAnalytics, LeadAnalytics as LA, LASignalItem } from '@/services/leadAnalyticsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalGroup } from '@/components/callinsights/SignalGroup';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';

const LeadAnalytics: React.FC = () => {
  const [data, setData] = useState<LA | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LASignalItem | null>(null);

  useEffect(() => {
    let active = true;
    fetchLeadAnalytics()
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
    return <SignalGroup title={g.title} caption={g.caption} items={g.items as any} tone={g.tone} onSelect={setSelected as any} />;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Lead <span className="font-serif italic text-navy-700">analytics.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Where leads sit, how they feel, and what they push back on — click any signal for the calls behind it (with handling quality).</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Where leads sit now" caption="lifecycle distribution" items={data.lifecycle} defaultTone="info" />
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
