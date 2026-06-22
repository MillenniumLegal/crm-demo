// Matter progression — the post-instruction conveyancing pipeline: where every matter is
// (stage + time-in-stage vs benchmark), what is overdue or due soon, and the fall-through
// trend. The biggest net-new surface — the demo previously stopped at "instruction".

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMatterProgression, MatterProgression as MP } from '@/services/matterProgressionService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { StagePipeline } from '@/components/matters/StagePipeline';
import { MatterWatchBoard } from '@/components/matters/MatterWatchBoard';

const MatterProgression: React.FC = () => {
  const [data, setData] = useState<MP | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMatterProgression()
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
          Matter <span className="font-serif italic text-navy-700">progression.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">From instruction to completion — where every matter is, and what is at risk.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <StagePipeline stages={data.stages} />

      <MatterWatchBoard slaBreaches={data.slaBreaches} keyDates={data.keyDates} />

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendLineChart
          title="Fall-through rate"
          caption="Last 6 months (%)"
          area
          height={200}
          series={[{ key: 'ft', label: 'Fall-through %', color: '#ef4444', points: data.fallThroughTrend.labels.map((x, i) => ({ x, y: data.fallThroughTrend.values[i] })) }]}
        />
        <RankedBarList title="Fall-throughs by type" caption="This quarter" items={data.fallThroughByType} defaultTone="bad" />
      </div>
    </div>
  );
};

export default MatterProgression;
