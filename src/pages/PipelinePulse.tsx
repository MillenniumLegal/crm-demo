// Pipeline Pulse — the leads cockpit landing. Compiles existing lead/pipeline data
// (spread, funnel, overdue buckets, hot/temperature, live activity, smart chips)
// into one glance. In ty this is backed by fetchPipelinePulse aggregating leads.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { fetchPipelinePulse, PipelinePulse as PipelinePulseData } from '@/services/leadsService';
import { PipelineSpreadDonut } from '@/components/pulse/PipelineSpreadDonut';
import { PulseBarsCard } from '@/components/pulse/PulseBarsCard';
import { StageFunnel } from '@/components/pulse/StageFunnel';
import { LiveActivityStrip } from '@/components/pulse/LiveActivityStrip';
import { SmartLeadChips } from '@/components/pulse/SmartLeadChips';

const PipelinePulse: React.FC = () => {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState<PipelinePulseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPipelinePulse()
      .then((data) => { if (active) setPulse(data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !pulse) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Leads, <span className="font-serif italic text-navy-700">pipeline pulse.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Firm-wide · {pulse.spread.total} active leads · live</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/lead-management')}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 shadow-sm hover:border-navy-300"
        >
          Open Lead Management <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <PipelineSpreadDonut
          total={pulse.spread.total}
          segments={pulse.spread.segments.map((s) => ({ label: s.label, count: s.count, color: s.color || '#94a3b8' }))}
        />
        <PulseBarsCard title={pulse.hot.title} total={pulse.hot.total} totalSuffix="active" segments={pulse.hot.segments} />
        <PulseBarsCard title={pulse.otherActive.title} total={pulse.otherActive.total} totalSuffix="active" segments={pulse.otherActive.segments} />
        <PulseBarsCard title={pulse.overdue.title} total={pulse.overdue.total} totalSuffix="late" segments={pulse.overdue.segments} />
      </div>

      <StageFunnel stages={pulse.funnel} />

      <LiveActivityStrip calls={pulse.recentCalls} deposits={pulse.recentDeposits} />

      <SmartLeadChips chips={pulse.chips} onSelect={(key) => navigate(`/lead-management?pulse=${key}`)} />
    </div>
  );
};

export default PipelinePulse;
