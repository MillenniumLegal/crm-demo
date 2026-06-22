// Companion recovery views: pre-instruction growth, contact intelligence, AI outreach,
// dormant lead mining and second-chance instruction value. All are demo-only and read the
// same Recovery Engine mock so the story stays connected.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { fetchRecoveryEngine, RecoveryEngineData, RecoveryTone } from '@/services/recoveryEngineService';
import { RangeFilter, rangeLabel, scaleRangeCount, scaleRangeMoney } from '@/components/analytics/RangeFilter';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const TONE_HEX: Record<RecoveryTone, string> = {
  good: '#16a34a',
  warn: '#f59e0b',
  bad: '#ef4444',
  info: '#1e3a8a',
};

const fmt = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${fmt(Math.round(n))}`;
const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 1) : '0'}%`;

function useRecoveryData() {
  const [data, setData] = useState<RecoveryEngineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchRecoveryEngine()
      .then((result) => { if (active) setData(result); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { data, loading };
}

const LoadingState = () => (
  <div className="flex h-64 items-center justify-center text-gray-400">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);

const PageShell: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  range: string;
  setRange: (range: string) => void;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, range, setRange, children }) => (
  <div className="space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950 text-white">{icon}</span>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <RangeFilter value={range} onChange={setRange} />
    </div>
    {children}
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
    <div className="text-xs text-gray-500">{sub}</div>
  </div>
);

const OpenEngineButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/recovery-engine')}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300"
    >
      Open Recovery Engine <ArrowRight className="h-4 w-4" />
    </button>
  );
};

export const LifecycleGrowthEngine: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useRecoveryData();
  const [range, setRange] = useState('30d');

  const stats = useMemo(() => {
    if (!data) return null;
    const value = data.lifecycle.reduce((sum, item) => sum + item.value, 0);
    const count = data.lifecycle.reduce((sum, item) => sum + item.count, 0);
    const avgConversion = data.lifecycle.reduce((sum, item) => sum + item.conversionRate, 0) / Math.max(data.lifecycle.length, 1);
    return { value, count, avgConversion };
  }, [data]);

  if (loading || !data || !stats) return <LoadingState />;

  return (
    <PageShell
      icon={<Sparkles className="h-4 w-4" />}
      title="Pre-Instruction Growth."
      subtitle="Old leads, stalled quotes, contact repairs and dormant enquiries before legal handoff."
      range={range}
      setRange={setRange}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Lifecycle value" value={money(scaleRangeMoney(stats.value, range))} sub={rangeLabel(range)} color="#16a34a" />
        <MetricCard label="Opportunities" value={fmt(scaleRangeCount(stats.count, range))} sub="old + stalled + dormant" color="#1e3a8a" />
        <MetricCard label="Avg conversion" value={pct(stats.avgConversion)} sub="across lifecycle plays" color="#4338ca" />
        <MetricCard label="Handoff-ready" value={fmt(scaleRangeCount(31, range))} sub="instruction packs to send" color="#f59e0b" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Lifecycle opportunity map</h2>
              <p className="mt-0.5 text-xs text-gray-500">Every bucket has an owner, value, conversion and next action.</p>
            </div>
            <OpenEngineButton />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.lifecycle.map((item) => (
              <button key={item.key} type="button" onClick={() => navigate('/recovery-engine')} className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.stage} · {item.owner}</div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: TONE_HEX[item.tone] }}>{money(scaleRangeMoney(item.value, range))}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(6, item.conversionRate * 8)}%`, backgroundColor: TONE_HEX[item.tone] }} />
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{item.nextAction}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-navy-700" />
            <h2 className="text-sm font-semibold text-gray-900">Not Connor-owned after instruction</h2>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { leadId: 'handoff-1', client: 'Legal team handoff', opportunity: 'Once instruction is confirmed, file progression leaves Connor queue.', expectedValue: 0 },
              { leadId: 'handoff-2', client: 'Relationship marketing', opportunity: 'Referral and repeat-matter ideas are parked for a separate owner, not daily lead ops.', expectedValue: 0 },
              { leadId: 'handoff-3', client: 'Post-completion activity', opportunity: 'Completion, reviews and client-care follow-up stay visible but should not drive Connor capacity.', expectedValue: 0 },
            ].map((client) => (
              <button key={client.leadId} type="button" onClick={() => navigate('/recovery-engine')} className="w-full rounded-lg bg-gray-50 p-3 text-left hover:bg-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{client.client}</div>
                    <div className="text-xs text-gray-500">{client.opportunity}</div>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">parked</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export const ContactIntelligenceCentre: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useRecoveryData();
  const [range, setRange] = useState('30d');
  if (loading || !data) return <LoadingState />;

  const totalSignals = data.contactIntelligence.signals.reduce((sum, signal) => sum + signal.count, 0);
  const repaired = data.contactIntelligence.signals.reduce((sum, signal) => sum + signal.repaired, 0);
  const avgConfidence = data.contactIntelligence.signals.reduce((sum, signal) => sum + signal.confidence, 0) / Math.max(data.contactIntelligence.signals.length, 1);

  return (
    <PageShell
      icon={<Search className="h-4 w-4" />}
      title="Contact Intelligence."
      subtitle="Phone area code, IP region, email quality and duplicate matching for safer lead location and contact repair."
      range={range}
      setRange={setRange}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Signals found" value={fmt(scaleRangeCount(totalSignals, range))} sub="phone/IP/email/duplicates" color="#1e3a8a" />
        <MetricCard label="Routes repaired" value={fmt(scaleRangeCount(repaired, range))} sub="approval-first" color="#16a34a" />
        <MetricCard label="Avg confidence" value={pct(avgConfidence)} sub="combined identity confidence" color="#4338ca" />
        <MetricCard label="Blocked risky calls" value={fmt(scaleRangeCount(11, range))} sub="human approval required" color="#ef4444" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Signal confidence</h2>
          <div className="mt-3 space-y-3">
            {data.contactIntelligence.signals.map((signal) => (
              <button key={signal.key} type="button" onClick={() => navigate('/recovery-engine')} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{signal.label}</div>
                    <div className="text-xs text-gray-500">{signal.region} · {signal.note}</div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">{pct(signal.confidence)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${signal.confidence}%`, backgroundColor: signal.confidence >= 85 ? '#16a34a' : '#4338ca' }} />
                </div>
                <div className="mt-2 text-xs text-gray-500">{fmt(scaleRangeCount(signal.repaired, range))} repaired from {fmt(scaleRangeCount(signal.count, range))} signals</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Repair rules</h2>
            <div className="mt-3 space-y-2">
              {data.contactIntelligence.rules.map((rule) => (
                <div key={rule.label} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_HEX[rule.tone] }} />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{rule.label}</div>
                      <p className="text-xs leading-5 text-gray-500">{rule.impact}. {rule.action}.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <RankedBarList title="Repair queue value" caption="Wrong-number items by expected value" items={data.reconstruction.map((item) => ({ label: item.lead, count: scaleRangeMoney(item.value, range), tone: item.confidence >= 80 ? 'good' : 'warn' }))} defaultTone="warn" />
        </div>
      </div>
    </PageShell>
  );
};

export const AiOutreachCommandCentre: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useRecoveryData();
  const [range, setRange] = useState('30d');
  if (loading || !data) return <LoadingState />;

  const ready = data.outreachDrafts.filter((draft) => draft.approvalStatus === 'ready').length;
  const blocked = data.outreachDrafts.filter((draft) => draft.approvalStatus === 'blocked').length;
  const avgReply = data.outreachDrafts.reduce((sum, draft) => sum + draft.expectedReplyRate, 0) / Math.max(data.outreachDrafts.length, 1);
  const totalCost = data.campaigns.reduce((sum, campaign) => sum + campaign.cost, 0);
  const totalValue = data.campaigns.reduce((sum, campaign) => sum + campaign.value, 0);

  return (
    <PageShell
      icon={<Mail className="h-4 w-4" />}
      title="AI Outreach Command."
      subtitle="Every AI draft, drip, call loop and human handover in one approval queue."
      range={range}
      setRange={setRange}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Ready drafts" value={fmt(scaleRangeCount(ready, range))} sub="safe to approve" color="#16a34a" />
        <MetricCard label="Blocked drafts" value={fmt(scaleRangeCount(blocked, range))} sub="risk or suppression" color="#ef4444" />
        <MetricCard label="Expected reply" value={pct(avgReply)} sub="draft weighted" color="#4338ca" />
        <MetricCard label="Campaign ROI" value={`${Math.round(totalValue / Math.max(totalCost, 1))}x`} sub="value vs AI cost" color="#1e3a8a" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Draft approval queue</h2>
              <p className="mt-0.5 text-xs text-gray-500">Click a lead to review full CRM history before approving.</p>
            </div>
            <OpenEngineButton />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.outreachDrafts.map((draft) => (
              <button key={draft.key} type="button" onClick={() => navigate(`/lead-management?leadId=${draft.leadId}`)} className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{draft.lead}</div>
                    <div className="text-xs text-gray-500">{draft.campaign} · {draft.variant}</div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{draft.approvalStatus}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-600">{draft.body}</p>
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>{pct(draft.expectedReplyRate)} expected reply</span>
                  <span>{money(scaleRangeMoney(draft.value, range))}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <RankedBarList title="Replies by campaign" caption={rangeLabel(range)} items={data.campaigns.map((campaign) => ({ label: campaign.name, count: scaleRangeCount(campaign.replied, range), tone: campaign.conversionRate >= 4 ? 'good' : 'info' }))} defaultTone="good" />
          <RankedBarList title="AI call loop" caption="Call-agent telemetry" items={data.aiCalls.map((metric) => ({ label: metric.label, count: scaleRangeCount(metric.count, range), tone: metric.tone }))} defaultTone="info" />
        </div>
      </div>
    </PageShell>
  );
};

export const DormantLeadVault: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useRecoveryData();
  const [range, setRange] = useState('30d');
  if (loading || !data) return <LoadingState />;

  const sorted = [...data.dormantVault].sort((a, b) => b.score - a.score);
  const totalValue = sorted.reduce((sum, lead) => sum + lead.value, 0);
  const avgScore = sorted.reduce((sum, lead) => sum + lead.score, 0) / Math.max(sorted.length, 1);

  return (
    <PageShell
      icon={<Clock className="h-4 w-4" />}
      title="Dormant Lead Vault."
      subtitle="A searchable old-history mine for high-value, high-score leads that should not stay buried."
      range={range}
      setRange={setRange}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Vault rows" value={fmt(scaleRangeCount(612, range))} sub="demo history" color="#1e3a8a" />
        <MetricCard label="Visible value" value={money(scaleRangeMoney(totalValue, range))} sub="sampled queue" color="#16a34a" />
        <MetricCard label="Avg score" value={pct(avgScore)} sub="top dormant sample" color="#4338ca" />
        <MetricCard label="Saved views" value="5" sub="price, quote, repair, stale, accepted" color="#f59e0b" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">High-score dormant rows</h2>
            <p className="mt-0.5 text-xs text-gray-500">Sort by score, value, age, source, location, risk and next best action.</p>
          </div>
          <OpenEngineButton />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="py-2 pr-3 text-left font-medium">Lead</th>
                <th className="px-3 py-2 text-left font-medium">Bucket</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-left font-medium">Signal</th>
                <th className="py-2 pl-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => (
                <tr key={lead.leadId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-gray-900">{lead.lead}</div>
                    <div className="text-xs text-gray-500">{lead.location} · {lead.source} · {lead.ageDays}d</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{lead.bucket}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{lead.score}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{money(scaleRangeMoney(lead.value, range))}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{lead.lastSignal}</td>
                  <td className="py-2 pl-3 text-right">
                    <button type="button" onClick={() => navigate(`/lead-management?leadId=${lead.leadId}`)} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200">Lead</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
};

export const SecondChanceRevenueDashboard: React.FC = () => {
  const { data, loading } = useRecoveryData();
  const [range, setRange] = useState('30d');
  if (loading || !data) return <LoadingState />;

  const recoverable = data.cohorts.reduce((sum, cohort) => sum + cohort.value, 0);
  const forecast = data.forecastScenarios[1];
  const cost = data.campaigns.reduce((sum, campaign) => sum + campaign.cost, 0);
  const campaignValue = data.campaigns.reduce((sum, campaign) => sum + campaign.value, 0);
  const trendPoints = data.trendLabels.map((x, index) => ({ x, y: scaleRangeCount(data.trend.recovered[index] ?? 0, range) }));

  return (
    <PageShell
      icon={<Target className="h-4 w-4" />}
      title="Second-Chance Instruction."
      subtitle="Executive visibility for old-pipeline instruction value, recovery wins, AI ROI and forecasted recovered instructions."
      range={range}
      setRange={setRange}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Recoverable instruction value" value={money(scaleRangeMoney(recoverable, range))} sub="active pre-instruction cohorts" color="#16a34a" />
        <MetricCard label="Base forecast" value={money(scaleRangeMoney(forecast.value, range))} sub={`${fmt(scaleRangeCount(forecast.recovered, range))} recoveries`} color="#1e3a8a" />
        <MetricCard label="AI ROI" value={`${Math.round(campaignValue / Math.max(cost, 1))}x`} sub="campaign value vs cost" color="#4338ca" />
        <MetricCard label="Risk holds" value={fmt(scaleRangeCount(data.riskSignals.reduce((sum, risk) => sum + risk.count, 0), range))} sub="suppression and approval" color="#f59e0b" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <TrendLineChart
          title="Recovered outcomes"
          caption={`Recovered instructions · ${rangeLabel(range)}`}
          series={[{ key: 'recovered', label: 'Recovered', color: '#16a34a', points: trendPoints }]}
        />
        <RankedBarList title="Value by lost reason" caption="Largest second-chance value pools" items={data.lostReasons.map((reason) => ({ label: reason.reason, count: scaleRangeMoney(reason.value, range), tone: reason.recoveredRate >= 8 ? 'good' : reason.recoveredRate >= 5 ? 'warn' : 'info' }))} defaultTone="info" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {data.forecastScenarios.map((scenario) => (
          <div key={scenario.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">{scenario.label}</h2>
              <span className="text-xs font-semibold tabular-nums text-gray-500">{scenario.confidence}% confidence</span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums" style={{ color: scenario.label === 'Aggressive' ? '#f59e0b' : '#16a34a' }}>{money(scaleRangeMoney(scenario.value, range))}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <span>{fmt(scaleRangeCount(scenario.approvals, range))} approvals</span>
              <span>{fmt(scaleRangeCount(scenario.replies, range))} replies</span>
              <span>{fmt(scaleRangeCount(scenario.recovered, range))} recovered</span>
              <span>{fmt(scaleRangeCount(scenario.aiTouches, range))} touches</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-navy-700" />
          <h2 className="text-sm font-semibold text-gray-900">Recovery value by agent</h2>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {data.agentPerformance.map((agent) => (
            <div key={agent.agent} className="rounded-lg bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-900">{agent.agent}</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-green-700">{money(scaleRangeMoney(agent.value, range))}</div>
              <div className="mt-1 text-xs text-gray-500">{fmt(scaleRangeCount(agent.recovered, range))} recovered · {agent.handoverMins}m handover</div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
};
