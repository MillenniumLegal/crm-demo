// Lead categories — what category each lead is, derived from what they SAY on calls.
// Categories are grouped (buyer readiness, price sensitivity, urgency, communication/risk);
// clicking one opens the verbatim words that triggered it + the routing. The time-range
// filter rescales the counts live (premium dynamic filtering).

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchLeadCategories, LeadCategories as LC } from '@/services/leadCategoriesService';
import { LASignalItem } from '@/services/leadAnalyticsService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { SignalGroup } from '@/components/callinsights/SignalGroup';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';
import { RangeFilter, RANGE_SCALE } from '@/components/analytics/RangeFilter';

const LeadCategories: React.FC = () => {
  const [data, setData] = useState<LC | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LASignalItem | null>(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchLeadCategories()
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

  const scale = RANGE_SCALE[range] ?? 1;
  const scaled = (it: LASignalItem) => ({ ...it, count: Math.max(1, Math.round(it.count * scale)) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Lead <span className="font-serif italic text-navy-700">categories.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">What category each lead is — from what they say. Click a category for the words that triggered it.</p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      {data.groups.map((g) => (
        <SignalGroup
          key={g.key}
          title={g.title}
          caption={g.caption}
          items={g.items.map(scaled) as any}
          tone={g.tone}
          onSelect={setSelected as any}
        />
      ))}

      <SignalDrawer item={selected as any} onClose={() => setSelected(null)} />
    </div>
  );
};

export default LeadCategories;
