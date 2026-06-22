// Recovery Engine — manager control room for old-lead revival, contact
// reconstruction, AI outreach/calls, won-client referrals and agent allocation.

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchRecoveryEngine,
  RecoveryAgentQueue,
  RecoveryCampaign,
  RecoveryCohort,
  RecoveryEngineData,
  RecoveryReconstructionItem,
  RecoveryTone,
  RecoveryWonClient,
} from '@/services/recoveryEngineService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RangeFilter, rangeLabel, scaleRangeCount, scaleRangeMoney } from '@/components/analytics/RangeFilter';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';

const TONE_HEX: Record<RecoveryTone, string> = {
  good: '#16a34a',
  warn: '#f59e0b',
  bad: '#ef4444',
  info: '#1e3a8a',
};

const STATUS_HEX: Record<RecoveryCampaign['status'], string> = {
  approval: '#f59e0b',
  running: '#16a34a',
  paused: '#ef4444',
  learning: '#4338ca',
};

const fmt = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${fmt(Math.round(n))}`;
const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 1) : '0'}%`;
const RANGE_KEYS = new Set(['today', '7d', '30d', '90d', 'year', 'all']);

const scaleArray = (values: number[], range: string) => values.map((value) => scaleRangeCount(value, range));

const channelLabel = (channel: string) => {
  if (channel === 'sms') return 'SMS';
  if (channel === 'email') return 'Email';
  if (channel === 'call') return 'AI call';
  return 'Mixed';
};

const signalFromCohort = (cohort: RecoveryCohort) => ({
  key: `cohort-${cohort.key}`,
  label: cohort.label,
  count: cohort.eligible,
  calls: cohort.aiTouches,
  sentiment: cohort.conversionRate >= 8 ? 0.54 : cohort.conversionRate >= 5 ? 0.18 : -0.12,
  conversion: { withPct: Math.round(cohort.conversionRate), otherPct: 4 },
  trend: cohort.trend,
  sample: cohort.leads.map((lead) => ({
    agent: lead.agent,
    lead: lead.lead,
    date: lead.date,
    clientSaid: lead.trigger,
    repReplied: lead.aiDraft,
    clientReaction: lead.outcome,
    note: `${lead.nextAction} ${lead.note}`,
  })),
});

const signalFromCampaign = (campaign: RecoveryCampaign) => ({
  key: `campaign-${campaign.key}`,
  label: campaign.name,
  count: campaign.sent,
  calls: campaign.replied,
  sentiment: campaign.conversionRate >= 4 ? 0.46 : 0.12,
  conversion: { withPct: Math.round(campaign.conversionRate), otherPct: 2 },
  trend: campaign.spark,
  sample: [
    {
      agent: 'APCM AI',
      lead: channelLabel(campaign.channel),
      date: 'This period',
      quote: `${fmt(campaign.sent)} sent, ${fmt(campaign.replied)} replies, ${fmt(campaign.recovered)} recovered.`,
      note: `${campaign.status} mode. Open rate ${pct(campaign.openRate)}, reply rate ${pct(campaign.replyRate)}, value ${money(campaign.value)}.`,
    },
  ],
});

const signalFromReconstruction = (item: RecoveryReconstructionItem) => ({
  key: `reconstruction-${item.key}`,
  label: `${item.lead} · ${item.issue}`,
  count: 1,
  calls: 1,
  sentiment: item.confidence >= 80 ? 0.48 : item.confidence >= 70 ? 0.18 : -0.16,
  conversion: { withPct: item.confidence, otherPct: 50 },
  trend: item.trend,
  sample: [
    {
      agent: item.agent,
      lead: item.lead,
      date: item.status,
      clientSaid: `Original: ${item.original}`,
      repReplied: `Proposed route: ${item.proposal}`,
      clientReaction: item.signals.join(' · '),
      note: `${item.action}. ${item.note}`,
    },
  ],
});

const signalFromWonClient = (client: RecoveryWonClient) => ({
  key: `won-${client.leadId}`,
  label: `${client.client} · ${client.opportunity}`,
  count: 1,
  calls: 1,
  sentiment: client.confidence >= 80 ? 0.64 : 0.28,
  conversion: { withPct: client.confidence, otherPct: 42 },
  trend: [2, 3, 4, 5, 7, 9],
  sample: [
    {
      agent: client.agent,
      lead: client.client,
      date: client.completedAgo,
      clientSaid: client.opportunity,
      repReplied: client.referralAsk,
      clientReaction: client.stage,
      note: `Expected value ${money(client.expectedValue)}. Keep this brand-safe and relationship-led.`,
    },
  ],
});

const scaleRecoveryData = (data: RecoveryEngineData, range: string): RecoveryEngineData => ({
  ...data,
  range: rangeLabel(range),
  kpis: data.kpis.map((kpi) => {
    if (kpi.label === 'Recoverable value') return { ...kpi, value: money(scaleRangeMoney(148600, range)) };
    if (kpi.label === 'Eligible leads') return { ...kpi, value: fmt(scaleRangeCount(486, range)) };
    if (kpi.label === 'AI touches') return { ...kpi, value: fmt(scaleRangeCount(1920, range)) };
    if (kpi.label === 'Recovered') return { ...kpi, value: fmt(scaleRangeCount(37, range)) };
    if (kpi.label === 'Needs approval') return { ...kpi, value: fmt(scaleRangeCount(42, range)) };
    return kpi;
  }),
  trend: {
    eligible: scaleArray(data.trend.eligible, range),
    aiTouches: scaleArray(data.trend.aiTouches, range),
    replies: scaleArray(data.trend.replies, range),
    recovered: scaleArray(data.trend.recovered, range),
  },
  funnel: data.funnel.map((stage) => ({ ...stage, count: scaleRangeCount(stage.count, range) })),
  cohorts: data.cohorts.map((cohort) => ({
    ...cohort,
    eligible: scaleRangeCount(cohort.eligible, range),
    value: scaleRangeMoney(cohort.value, range),
    aiTouches: scaleRangeCount(cohort.aiTouches, range),
    suppression: scaleRangeCount(cohort.suppression, range),
    trend: scaleArray(cohort.trend, range),
    leads: cohort.leads.map((lead) => ({ ...lead, value: scaleRangeMoney(lead.value, range) })),
  })),
  campaigns: data.campaigns.map((campaign) => ({
    ...campaign,
    sent: scaleRangeCount(campaign.sent, range),
    opened: scaleRangeCount(campaign.opened, range),
    replied: scaleRangeCount(campaign.replied, range),
    recovered: scaleRangeCount(campaign.recovered, range),
    value: scaleRangeMoney(campaign.value, range),
    cost: scaleRangeMoney(campaign.cost, range),
    spark: scaleArray(campaign.spark, range),
  })),
  reconstruction: data.reconstruction.map((item) => ({
    ...item,
    value: scaleRangeMoney(item.value, range),
    trend: scaleArray(item.trend, range),
  })),
  agentQueue: data.agentQueue.map((agent) => ({
    ...agent,
    tasks: scaleRangeCount(agent.tasks, range),
    value: scaleRangeMoney(agent.value, range),
    expectedRecovery: scaleRangeCount(agent.expectedRecovery, range),
  })),
  aiCalls: data.aiCalls.map((metric) => ({
    ...metric,
    count: scaleRangeCount(metric.count, range),
  })),
  wonClients: data.wonClients.map((client) => ({
    ...client,
    expectedValue: scaleRangeMoney(client.expectedValue, range),
  })),
});

const RecoveryFunnel: React.FC<{ stages: RecoveryEngineData['funnel'] }> = ({ stages }) => {
  const first = Math.max(stages[0]?.count ?? 0, 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-navy-700" />
        <h3 className="text-sm font-semibold text-gray-900">Recovery funnel</h3>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Eligible history → approved outreach → recovered value.</p>
      <div className="mt-4 grid gap-2">
        {stages.map((stage, index) => {
          const width = Math.max(8, (stage.count / first) * 100);
          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{stage.label}</span>
                <span className="tabular-nums text-gray-500">{fmt(stage.count)}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: index < 2 ? '#1e3a8a' : index < 4 ? '#4338ca' : '#16a34a',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CampaignCard: React.FC<{ campaign: RecoveryCampaign; onOpen: () => void }> = ({ campaign, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-gray-900">{campaign.name}</div>
        <div className="mt-0.5 text-xs text-gray-500">{channelLabel(campaign.channel)} · {campaign.status}</div>
      </div>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_HEX[campaign.status] }} />
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      <div>
        <div className="text-gray-500">Sent</div>
        <div className="font-semibold tabular-nums text-gray-900">{fmt(campaign.sent)}</div>
      </div>
      <div>
        <div className="text-gray-500">Replies</div>
        <div className="font-semibold tabular-nums text-gray-900">{fmt(campaign.replied)}</div>
      </div>
      <div>
        <div className="text-gray-500">Value</div>
        <div className="font-semibold tabular-nums text-gray-900">{money(campaign.value)}</div>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, campaign.replyRate * 4)}%`, backgroundColor: '#16a34a' }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-gray-600">{pct(campaign.replyRate)}</span>
    </div>
  </button>
);

const CohortTable: React.FC<{
  cohorts: RecoveryCohort[];
  onOpen: (cohort: RecoveryCohort) => void;
  onNavigate: (cohort: RecoveryCohort) => void;
}> = ({ cohorts, onOpen, onNavigate }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-navy-700" />
          <h3 className="text-sm font-semibold text-gray-900">Recoverable cohorts</h3>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">Click a cohort to inspect triggers, sample leads and AI draft logic.</p>
      </div>
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Approval-first</span>
    </div>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
            <th className="py-2 pr-3 text-left font-medium">Cohort</th>
            <th className="px-3 py-2 text-right font-medium">Eligible</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-right font-medium">Reply</th>
            <th className="px-3 py-2 text-right font-medium">Convert</th>
            <th className="px-3 py-2 text-left font-medium">Action</th>
            <th className="py-2 pl-3 text-right font-medium">Open</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr
              key={cohort.key}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(cohort)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(cohort);
                }
              }}
              className="cursor-pointer border-b border-gray-100 outline-none last:border-0 hover:bg-gray-50 focus:bg-indigo-50"
            >
              <td className="py-2 pr-3">
                <div className="font-semibold text-gray-900">{cohort.label}</div>
                <div className="max-w-[24rem] truncate text-xs text-gray-500">{cohort.reason}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(cohort.eligible)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{money(cohort.value)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{pct(cohort.replyRate)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{pct(cohort.conversionRate)}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{cohort.risk}</td>
              <td className="py-2 pl-3 text-right">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onNavigate(cohort);
                  }}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                >
                  Leads
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ReconstructionLab: React.FC<{
  items: RecoveryReconstructionItem[];
  onOpen: (item: RecoveryReconstructionItem) => void;
  onLead: (leadId: string) => void;
}> = ({ items, onOpen, onLead }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <Search className="h-4 w-4 text-navy-700" />
      <h3 className="text-sm font-semibold text-gray-900">AI contact reconstruction lab</h3>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">Phone, email, area-code, IP and name signals for wrong/invalid contact recovery.</p>
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onOpen(item)}
          className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900">{item.lead}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{item.issue}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">{item.original} → {item.proposal}</div>
              <div className="mt-1 text-xs text-gray-400">{item.signals.join(' · ')}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-gray-900">{item.confidence}%</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onLead(item.leadId);
                }}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
              >
                Lead
              </button>
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const AgentAllocation: React.FC<{ agents: RecoveryAgentQueue[] }> = ({ agents }) => {
  const maxValue = Math.max(1, ...agents.map((agent) => agent.value));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-navy-700" />
        <h3 className="text-sm font-semibold text-gray-900">Soft re-engagement task allocation</h3>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Routes approval-ready tasks to agents with capacity.</p>
      <div className="mt-3 space-y-3">
        {agents.map((agent) => (
          <div key={agent.agent}>
            <div className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold text-gray-900">{agent.agent}</div>
                <div className="text-xs text-gray-500">{agent.focus} · {agent.channels}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums text-gray-900">{money(agent.value)}</div>
                <div className="text-xs text-gray-500">{agent.freeSlots} free slots</div>
              </div>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${(agent.value / maxValue) * 100}%`, backgroundColor: '#1e3a8a' }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>{agent.tasks} tasks queued</span>
              <span>{agent.expectedRecovery} expected recoveries · oldest {agent.oldest}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AiCallPanel: React.FC<{ metrics: RecoveryEngineData['aiCalls'] }> = ({ metrics }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <Phone className="h-4 w-4 text-navy-700" />
      <h3 className="text-sm font-semibold text-gray-900">AI call agent readiness</h3>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">Trained from historic human calls, then transfers live interest to agents.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg bg-gray-50 p-3">
          <div className="text-[11px] font-semibold uppercase text-gray-500">{metric.label}</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-gray-900">{fmt(metric.count)}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, metric.rate))}%`, backgroundColor: TONE_HEX[metric.tone] }} />
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">
      Training loop: successful human calls become scripts, weak objection handling becomes a coaching guardrail, and any high-intent answer transfers straight to a human.
    </div>
  </div>
);

const WonClientPanel: React.FC<{
  clients: RecoveryWonClient[];
  onOpen: (client: RecoveryWonClient) => void;
  onLead: (leadId: string) => void;
}> = ({ clients, onOpen, onLead }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <ShieldCheck className="h-4 w-4 text-navy-700" />
      <h3 className="text-sm font-semibold text-gray-900">Won-client referral and repeat opportunity</h3>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">Completed matters become a relationship-led growth channel.</p>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {clients.map((client) => (
        <button
          key={client.leadId}
          type="button"
          onClick={() => onOpen(client)}
          className="rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-900">{client.client}</div>
              <div className="text-xs text-gray-500">{client.completedAgo} since completion</div>
            </div>
            <span className="text-sm font-semibold tabular-nums text-gray-900">{client.confidence}%</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-gray-600">{client.opportunity}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tabular-nums text-green-700">{money(client.expectedValue)}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLead(client.leadId);
              }}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
            >
              Lead
            </button>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const RecoveryEngine: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<RecoveryEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const initial = searchParams.get('range') || '30d';
    return RANGE_KEYS.has(initial) ? initial : '30d';
  });
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    fetchRecoveryEngine()
      .then((result) => { if (active) setData(result); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const nextRange = searchParams.get('range');
    if (nextRange && RANGE_KEYS.has(nextRange) && nextRange !== range) {
      setRange(nextRange);
    }
  }, [range, searchParams]);

  const activeData = useMemo(() => (data ? scaleRecoveryData(data, range) : null), [data, range]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!activeData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-500">
        <p>Couldn&apos;t load Recovery Engine data.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  const trendPoints = (values: number[]) => activeData.trendLabels.map((x, index) => ({ x, y: values[index] ?? 0 }));
  const cohortBars = activeData.cohorts.map((cohort) => ({
    label: cohort.label,
    count: cohort.eligible,
    tone: cohort.conversionRate >= 8 ? 'good' as const : cohort.conversionRate >= 5 ? 'warn' as const : 'info' as const,
    quote: cohort.reason,
  }));
  const channelBars = activeData.campaigns.map((campaign) => ({
    label: campaign.name,
    count: campaign.replied,
    tone: campaign.conversionRate >= 4 ? 'good' as const : 'info' as const,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950 text-white">
              <Brain className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-semibold text-gray-900">
              Recovery <span className="font-serif italic text-navy-700">Engine.</span>
            </h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">simulated + approval-first</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Re-engage old/lost leads, repair contact data, revive won-client referrals and route soft recovery tasks.
          </p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={activeData.kpis} />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Failed attempts', text: 'No-answer and wrong-number paths feed reconstruction.', href: '/contact-attempts', icon: Phone, color: '#ef4444' },
          { label: 'Recovery replies', text: 'AI outreach replies appear in the unified inbox.', href: '/conversations', icon: MessageSquare, color: '#16a34a' },
          { label: 'Approval workflows', text: 'Outcome-code triggers create drafts, waits and tasks.', href: '/automation', icon: Zap, color: '#f59e0b' },
          { label: 'APCM AI oversight', text: 'AI watches recovery value and risky outreach.', href: '/apcm-ai', icon: Brain, color: '#4338ca' },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.label}
              type="button"
              onClick={() => navigate(link.href)}
              className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className="h-4 w-4" style={{ color: link.color }} />
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{link.label}</div>
              <p className="mt-1 text-xs leading-5 text-gray-500">{link.text}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <RecoveryFunnel stages={activeData.funnel} />
        <TrendLineChart
          title="Recovery movement"
          caption={`AI touches, replies and recovered outcomes · ${rangeLabel(range)}`}
          series={[
            { key: 'touches', label: 'AI touches', color: '#1e3a8a', points: trendPoints(activeData.trend.aiTouches) },
            { key: 'replies', label: 'Replies', color: '#f59e0b', points: trendPoints(activeData.trend.replies) },
            { key: 'recovered', label: 'Recovered', color: '#16a34a', points: trendPoints(activeData.trend.recovered) },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <CohortTable
          cohorts={activeData.cohorts}
          onOpen={(cohort) => setSelected(signalFromCohort(cohort))}
          onNavigate={(cohort) => navigate(`/lead-management?pulse=recovery-${cohort.key}`)}
        />
        <div className="space-y-5">
          <RankedBarList title="Eligible by cohort" caption="Largest recovery pools first" items={cohortBars} defaultTone="info" />
          <RankedBarList title="Replies by campaign" caption="What is generating conversations" items={channelBars} defaultTone="good" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {activeData.campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.key}
            campaign={campaign}
            onOpen={() => setSelected(signalFromCampaign(campaign))}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <ReconstructionLab
          items={activeData.reconstruction}
          onOpen={(item) => setSelected(signalFromReconstruction(item))}
          onLead={(leadId) => navigate(`/lead-management?leadId=${leadId}`)}
        />
        <AiCallPanel metrics={activeData.aiCalls} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)]">
        <AgentAllocation agents={activeData.agentQueue} />
        <WonClientPanel
          clients={activeData.wonClients}
          onOpen={(client) => setSelected(signalFromWonClient(client))}
          onLead={(leadId) => navigate(`/lead-management?leadId=${leadId}`)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-navy-700" />
            <h3 className="text-sm font-semibold text-gray-900">Approval workflow</h3>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {[
              { icon: Mail, label: 'AI drafts', text: 'Email/SMS/call scripts generated from lead context.' },
              { icon: Eye, label: 'Agent review', text: 'Repaired contacts and sensitive cohorts need approval.' },
              { icon: MessageSquare, label: 'Soft outreach', text: 'Drips stop on reply, bounce, complaint or suppression.' },
              { icon: CheckCircle, label: 'Human handover', text: 'High-intent replies become tasks or live transfers.' },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="rounded-lg bg-gray-50 p-3">
                  <Icon className="h-4 w-4 text-navy-700" />
                  <div className="mt-2 text-sm font-semibold text-gray-900">{step.label}</div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-900">APCM AI says</h3>
          </div>
          <div className="mt-3 space-y-2">
            {activeData.advice.map((item) => (
              <div key={item.title} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.severity === 'high' ? '#ef4444' : item.severity === 'med' ? '#f59e0b' : '#1e3a8a' }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Port note for ty</h3>
        </div>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Demo is approval-first and mock-backed. Live wiring later should read outcome-code cohorts, provider delivery/open/reply logs,
          suppression lists, task capacity, 3CX call outcomes, AI call-agent telemetry and lead history before any message or call is sent.
        </p>
      </div>

      <SignalDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default RecoveryEngine;
