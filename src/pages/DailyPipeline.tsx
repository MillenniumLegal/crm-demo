// Daily Pipeline — the agent's "today" home: hero worklist counts + today's tasks,
// callbacks due, and quotes awaiting response. Compiles existing task/lead/quota data.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Loader2, ListTodo, PhoneCall, ShieldCheck, Sparkles } from 'lucide-react';
import { fetchDailyPipeline, DailyPipeline as DailyPipelineData } from '@/services/hubsService';
import { fetchRecoveryEngine, RecoveryEngineData } from '@/services/recoveryEngineService';
import { HubHeroCards } from '@/components/hubs/HubHeroCards';
import { DaySignalsTrend } from '@/components/hubs/DaySignalsTrend';
import { LeadOriginMap } from '@/components/hubs/LeadOriginMap';
import { PeakHoursChart } from '@/components/hubs/PeakHoursChart';
import { CallsTodayCard } from '@/components/hubs/CallsTodayCard';
import { WorklistCard } from '@/components/hubs/WorklistCard';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { scaleRangeCount, scaleRangeMoney } from '@/components/analytics/RangeFilter';

const fmt = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${fmt(Math.round(n))}`;
const readMetric = (value: string | number | undefined, fallback: number) => {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const RecoveryTodayCard: React.FC<{
  recovery: RecoveryEngineData | null;
  onOpen: () => void;
  onAsk: () => void;
}> = ({ recovery, onOpen, onAsk }) => {
  const cohorts = recovery?.cohorts ?? [];
  const totalEligible = cohorts.reduce((sum, cohort) => sum + cohort.eligible, 0) || 486;
  const totalValue = cohorts.reduce((sum, cohort) => sum + cohort.value, 0) || 148600;
  const approvalKpi = recovery?.kpis.find((kpi) => kpi.label === 'Needs approval');
  const approvals = readMetric(approvalKpi?.value, 42);
  const todayEligible = scaleRangeCount(totalEligible, 'today');
  const todayValue = scaleRangeMoney(totalValue, 'today');
  const todayApprovals = scaleRangeCount(approvals, 'today');
  const topCohorts = [...cohorts]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const maxValue = Math.max(1, ...topCohorts.map((cohort) => cohort.value));
  const bestAgent = [...(recovery?.agentQueue ?? [])].sort((a, b) => b.freeSlots - a.freeSlots)[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-navy-700" />
            <h2 className="text-sm font-semibold text-gray-900">Recovery Engine today</h2>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">approval-first</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Old no-interest leads, quote shoppers, bad-number repairs and quote-to-instruction rescues Connor can safely revive today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAsk}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-navy-300"
          >
            Ask APCM AI <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: '#1e3a8a' }}
          >
            Open today queue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Eligible today', value: fmt(todayEligible), tone: '#1e3a8a' },
          { label: 'Value to revive', value: money(todayValue), tone: '#16a34a' },
          { label: 'Needs approval', value: fmt(todayApprovals), tone: '#f59e0b' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-gray-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-gray-500">{stat.label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: stat.tone }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="space-y-2">
          {topCohorts.map((cohort) => (
            <button
              key={cohort.key}
              type="button"
              onClick={onOpen}
              className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-900">{cohort.label}</span>
                <span className="tabular-nums text-gray-500">{money(scaleRangeMoney(cohort.value, 'today'))}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(6, (cohort.value / maxValue) * 100)}%`, backgroundColor: cohort.conversionRate >= 8 ? '#16a34a' : '#4338ca' }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{cohort.reason}</p>
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-indigo-50 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-700" />
            <h3 className="text-sm font-semibold text-indigo-950">Recommended handoff</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-indigo-950">
            Start with quoted-no-touch and contact repairs, then assign soft re-engagement to {bestAgent?.agent ?? 'the freest agent'}
            {bestAgent ? ` (${bestAgent.freeSlots} free slots).` : '.'}
          </p>
          <p className="mt-2 text-xs leading-5 text-indigo-900">
            AI drafts stay held until an agent approves the message, repaired contact, suppression check and next task.
          </p>
        </div>
      </div>
    </div>
  );
};

const DailyPipeline: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DailyPipelineData | null>(null);
  const [recovery, setRecovery] = useState<RecoveryEngineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchDailyPipeline(),
      fetchRecoveryEngine().catch(() => null),
    ])
      .then(([d, recoveryData]) => {
        if (active) {
          setData(d);
          setRecovery(recoveryData);
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-500">
        <p>Couldn&rsquo;t load today&rsquo;s pipeline.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Daily <span className="font-serif italic text-navy-700">pipeline.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Your day at a glance — who to call, what to chase, what's waiting.</p>
      </div>

      <HubHeroCards stats={data.hero} onSelect={(href) => { if (href) navigate(href); }} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Today&rsquo;s actions</h2>
        <DaySignalsTrend signals={data.signals} onSelect={(href) => navigate(href)} />
      </div>

      <TrendLineChart
        title="How the day is flowing"
        caption="Leads, instructions &amp; accepted quotes — last 14 days"
        height={200}
        series={[
          { key: 'leads', label: 'Leads', color: '#1e3a8a', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.leads[i] })) },
          { key: 'instructions', label: 'Instructions', color: '#16a34a', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.instructions[i] })) },
          { key: 'quotesAccepted', label: 'Quotes accepted', color: '#0ea5e9', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.quotesAccepted[i] })) },
        ]}
      />

      <LeadOriginMap
        data={data.leadOrigins}
        onOpenRegion={(region) => navigate(`/lead-management?origin=${encodeURIComponent(region.key)}`)}
      />

      <RecoveryTodayCard
        recovery={recovery}
        onOpen={() => navigate('/recovery-engine?range=today')}
        onAsk={() => navigate(`/apcm-ai?ask=${encodeURIComponent('What should Connor recover today?')}`)}
      />

      <PeakHoursChart peak={data.peakHours} />

      <CallsTodayCard calls={data.calls} onOpen={() => navigate('/call-analysis?preset=today')} />

      <div className="grid gap-5 xl:grid-cols-3">
        <WorklistCard title="Today's tasks" items={data.tasks} icon={<ListTodo className="h-4 w-4 text-navy-600" />} emptyText="No tasks due today" />
        <WorklistCard title="Callbacks due" items={data.callbacks} icon={<PhoneCall className="h-4 w-4 text-navy-600" />} emptyText="No callbacks due" />
        <WorklistCard title="Awaiting quote response" items={data.quoteResponses} icon={<FileText className="h-4 w-4 text-navy-600" />} emptyText="No open quotes" />
      </div>
    </div>
  );
};

export default DailyPipeline;
