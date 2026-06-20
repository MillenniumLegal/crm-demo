// Agent league table (spec §5). One row per CallAgentDailyBreakdown with
// rank movement, bar-in-cell rates, low-volume guarding, a pinned team-median
// row and an expandable per-agent detail inset. Pure presentation.

import React, { useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { AgentLeaderboardProps } from './types';
import { deltaTone, formatDelay, formatNumber, statusChipClass } from './format';

const LOW_VOLUME_THRESHOLD = 20;

const agentKey = (agent: CallAgentDailyBreakdown) =>
  agent.agentUserId || agent.agentExtension || agent.agentName;

const isLowVolume = (agent: CallAgentDailyBreakdown) => agent.outboundCalls < LOW_VOLUME_THRESHOLD;

// Instructions desc, then outbound calls desc; low-volume agents always rank
// below qualifying agents so 1-for-1 = 100% can never top the table.
const compareAgents = (a: CallAgentDailyBreakdown, b: CallAgentDailyBreakdown) => {
  const lowDiff = Number(isLowVolume(a)) - Number(isLowVolume(b));
  if (lowDiff !== 0) return lowDiff;
  if (b.officialInstructions !== a.officialInstructions) {
    return b.officialInstructions - a.officialInstructions;
  }
  return b.outboundCalls - a.outboundCalls;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

interface RankedAgent {
  agent: CallAgentDailyBreakdown;
  key: string;
  rank: number;
  /** Positions moved vs previous period; null = no previous data for this agent. */
  movement: number | null;
  lowVolume: boolean;
  previous?: CallAgentDailyBreakdown;
}

interface TeamMedians {
  calls: number;
  answerRate: number;
  leadsReached: number;
  reachRate: number;
  instructions: number;
  reachToInstruct: number;
  /** 0 = no usable speed-to-lead data. */
  speedSeconds: number;
  attemptsPerLead: number;
}

const RankMovement: React.FC<{ movement: number | null }> = ({ movement }) => {
  if (movement === null || movement === 0) {
    return <span className="text-xs text-gray-400" title="No rank change vs previous period">—</span>;
  }
  if (movement > 0) {
    return (
      <span className="text-xs font-medium text-green-700 tabular-nums" title={`Up ${movement} vs previous period`}>
        ▲{movement}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-red-700 tabular-nums" title={`Down ${Math.abs(movement)} vs previous period`}>
      ▼{Math.abs(movement)}
    </span>
  );
};

const RateBar: React.FC<{ rate: number; max: number; muted: boolean }> = ({ rate, max, muted }) => {
  const width = rate > 0 ? Math.min(100, Math.max(4, (rate / Math.max(max, 1)) * 100)) : 0;
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${muted ? 'bg-gray-300' : 'bg-navy-950'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

const DeltaPts: React.FC<{ current: number; previous?: number }> = ({ current, previous }) => {
  if (previous == null) return null;
  const delta = Math.round(current) - Math.round(previous);
  return (
    <span className={`text-xs tabular-nums ${deltaTone('good-up', delta)}`}>
      {delta > 0 ? '+' : ''}{delta} pts
    </span>
  );
};

const RateCell: React.FC<{ rate: number; max: number; muted: boolean; previousRate?: number }> = ({
  rate,
  max,
  muted,
  previousRate,
}) => (
  <div className="flex flex-col gap-1">
    <span className={`text-sm font-medium tabular-nums ${muted ? 'text-gray-400' : 'text-gray-900'}`}>
      {Math.round(rate)}%
    </span>
    <RateBar rate={rate} max={max} muted={muted} />
    {!muted && <DeltaPts current={rate} previous={previousRate} />}
  </div>
);

// Expanded gray-50 inset shared by the desktop row and the mobile card.
const AgentDetail: React.FC<{ agent: CallAgentDailyBreakdown }> = ({ agent }) => {
  const outcomeTotal = agent.answeredCalls + agent.voicemailCalls + agent.missedAbandonedCalls;
  const segments: { label: string; count: number; barClass: string; dotClass: string }[] = [
    { label: 'Answered', count: agent.answeredCalls, barClass: 'bg-green-500', dotClass: 'bg-green-500' },
    { label: 'Voicemail', count: agent.voicemailCalls, barClass: 'bg-gray-300', dotClass: 'bg-gray-300' },
    { label: 'Missed', count: agent.missedAbandonedCalls, barClass: 'bg-red-400', dotClass: 'bg-red-400' },
  ];
  const stats: { label: string; value: number; emphasis?: boolean }[] = [
    { label: 'Call-backs promised', value: agent.followUpNeeded },
    { label: 'Calls with objections', value: agent.anyObjection },
    { label: 'Positive signals', value: agent.positiveSignals },
    { label: 'Hot inbound', value: agent.inboundHotCalls },
    { label: 'Instructions', value: agent.officialInstructions, emphasis: true },
  ];

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Call outcomes</p>
        {outcomeTotal > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
              {segments.map((segment) =>
                segment.count > 0 ? (
                  <div
                    key={segment.label}
                    className={segment.barClass}
                    style={{ width: `${(segment.count / outcomeTotal) * 100}%` }}
                    title={`${segment.label}: ${formatNumber(segment.count)}`}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {segments.map((segment) => (
                <span key={segment.label} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <span className={`h-2 w-2 rounded-full ${segment.dotClass}`} />
                  {segment.label}
                  <span className="font-medium tabular-nums text-gray-900">{formatNumber(segment.count)}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500">No calls recorded for this agent in the period.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-gray-200 bg-white px-3 py-2">
            <p className={`text-lg tabular-nums ${stat.emphasis ? 'font-semibold text-navy-950' : 'font-medium text-gray-900'}`}>
              {formatNumber(stat.value)}
            </p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        <span className="tabular-nums">{formatNumber(agent.uniqueLeadsAttempted)}</span> leads called ·{' '}
        <span className="tabular-nums">{agent.outboundAttemptsPerLead.toFixed(1)}</span> avg calls per lead ·{' '}
        <span className="tabular-nums">{formatNumber(agent.outboundVoicemailCalls)}</span> voicemails left ·{' '}
        <span className="tabular-nums">{formatNumber(agent.instructionIntent)}</span> likely to instruct
      </p>
    </div>
  );
};

export const AgentLeaderboard: React.FC<AgentLeaderboardProps> = ({
  agents,
  previousAgents,
  onAgentClick,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const { ranked, medians, maxRates } = useMemo(() => {
    const previousByKey = new Map<string, CallAgentDailyBreakdown>();
    previousAgents.forEach((agent) => previousByKey.set(agentKey(agent), agent));

    const previousRankByKey = new Map<string, number>();
    [...previousAgents].sort(compareAgents).forEach((agent, index) => {
      previousRankByKey.set(agentKey(agent), index + 1);
    });

    const rankedAgents: RankedAgent[] = [...agents].sort(compareAgents).map((agent, index) => {
      const key = agentKey(agent);
      const previousRank = previousRankByKey.get(key);
      return {
        agent,
        key,
        rank: index + 1,
        movement: previousRank == null ? null : previousRank - (index + 1),
        lowVolume: isLowVolume(agent),
        previous: previousByKey.get(key),
      };
    });

    const qualifying = agents.filter((agent) => !isLowVolume(agent));
    const medianPool = qualifying.length > 0 ? qualifying : agents;
    const speedValues = medianPool
      .map((agent) => agent.averageFirstOutboundDelaySeconds)
      .filter((seconds) => seconds > 0);

    const teamMedians: TeamMedians = {
      calls: median(medianPool.map((agent) => agent.outboundCalls)),
      answerRate: median(medianPool.map((agent) => agent.outboundAnswerRate)),
      leadsReached: median(medianPool.map((agent) => agent.uniqueLeadsContacted)),
      reachRate: median(medianPool.map((agent) => agent.contactRate)),
      instructions: median(medianPool.map((agent) => agent.officialInstructions)),
      reachToInstruct: median(medianPool.map((agent) => agent.contactToInstructionRate)),
      speedSeconds: median(speedValues),
      attemptsPerLead: median(medianPool.map((agent) => agent.outboundAttemptsPerLead)),
    };

    return {
      ranked: rankedAgents,
      medians: teamMedians,
      maxRates: {
        answerRate: Math.max(...agents.map((agent) => agent.outboundAnswerRate), 1),
        reachRate: Math.max(...agents.map((agent) => agent.contactRate), 1),
        reachToInstruct: Math.max(...agents.map((agent) => agent.contactToInstructionRate), 1),
      },
    };
  }, [agents, previousAgents]);

  const speedClass = (seconds: number) =>
    seconds > 0 && medians.speedSeconds > 0 && seconds < medians.speedSeconds
      ? 'text-green-700'
      : 'text-gray-900';

  if (agents.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-navy-950">Agent league table</h2>
        <div className="flex flex-col items-center py-10 text-center">
          <Users className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No agent activity in this range</p>
          <p className="mt-1 text-xs text-gray-500">
            Agent stats appear once calls are imported for the selected period. Calls arrive overnight from the phone system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-navy-950">Agent league table</h2>

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200">
              {[
                'Agent',
                'Calls made',
                'Answer rate',
                'Leads reached',
                'Reach rate',
                'Instructions',
                'Reach → instruct',
                'Speed to lead',
                'Call mix',
                '',
              ].map((header, index) => (
                <th
                  key={header || `header-${index}`}
                  scope="col"
                  className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Pinned team median row */}
            <tr className="border-b border-gray-200 bg-navy-50/50">
              <td className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy-950">
                Team median
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-gray-500">
                {formatNumber(Math.round(medians.calls))}
              </td>
              <td className="px-3 py-2.5 text-sm font-medium tabular-nums text-gray-900">
                {Math.round(medians.answerRate)}%
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-gray-900">
                {formatNumber(Math.round(medians.leadsReached))}
              </td>
              <td className="px-3 py-2.5 text-sm font-medium tabular-nums text-gray-900">
                {Math.round(medians.reachRate)}%
              </td>
              <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-navy-950">
                {formatNumber(Math.round(medians.instructions))}
              </td>
              <td className="px-3 py-2.5 text-sm font-medium tabular-nums text-gray-900">
                {Math.round(medians.reachToInstruct)}%
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-gray-900">
                {medians.speedSeconds > 0 ? formatDelay(medians.speedSeconds) : '—'}
              </td>
              <td className="px-3 py-2.5 text-xs tabular-nums text-gray-500">
                {medians.attemptsPerLead.toFixed(1)}/lead
              </td>
              <td className="px-3 py-2.5" />
            </tr>

            {ranked.map(({ agent, key, rank, movement, lowVolume, previous }) => {
              const expanded = expandedKeys.has(key);
              const attemptTotal =
                agent.outboundAttempt1Calls + agent.outboundAttempt2Calls + agent.outboundAttempt3PlusCalls;

              return (
                <React.Fragment key={key}>
                  <tr
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                    onClick={() => toggleExpanded(key)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums text-gray-600">
                          {rank}
                        </span>
                        <RankMovement movement={movement} />
                        <button
                          type="button"
                          className="text-sm font-medium text-navy-950 hover:underline"
                          title={agent.agentExtension ? `Ext. ${agent.agentExtension} — view this agent's calls` : "View this agent's calls"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAgentClick(agent.agentUserId);
                          }}
                        >
                          {agent.agentName}
                        </button>
                        {lowVolume && <span className={statusChipClass('gray')}>Low volume</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm tabular-nums text-gray-500">
                      {formatNumber(agent.outboundCalls)}
                    </td>
                    <td className="px-3 py-3">
                      <RateCell
                        rate={agent.outboundAnswerRate}
                        max={maxRates.answerRate}
                        muted={lowVolume}
                        previousRate={previous?.outboundAnswerRate}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm tabular-nums text-gray-900">
                      {formatNumber(agent.uniqueLeadsContacted)}
                    </td>
                    <td className="px-3 py-3">
                      <RateCell
                        rate={agent.contactRate}
                        max={maxRates.reachRate}
                        muted={lowVolume}
                        previousRate={previous?.contactRate}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold tabular-nums text-navy-950">
                      {formatNumber(agent.officialInstructions)}
                    </td>
                    <td className="px-3 py-3">
                      <RateCell
                        rate={agent.contactToInstructionRate}
                        max={maxRates.reachToInstruct}
                        muted={lowVolume}
                        previousRate={previous?.contactToInstructionRate}
                      />
                    </td>
                    <td className={`px-3 py-3 text-sm tabular-nums ${speedClass(agent.averageFirstOutboundDelaySeconds)}`}>
                      {agent.averageFirstOutboundDelaySeconds > 0
                        ? formatDelay(agent.averageFirstOutboundDelaySeconds)
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-2 w-20 overflow-hidden rounded-full bg-gray-100"
                          title={`1st call ${formatNumber(agent.outboundAttempt1Calls)} · 2nd call ${formatNumber(agent.outboundAttempt2Calls)} · 3rd+ call ${formatNumber(agent.outboundAttempt3PlusCalls)}`}
                        >
                          {attemptTotal > 0 && (
                            <>
                              <div className="bg-navy-950" style={{ width: `${(agent.outboundAttempt1Calls / attemptTotal) * 100}%` }} />
                              <div className="bg-navy-400" style={{ width: `${(agent.outboundAttempt2Calls / attemptTotal) * 100}%` }} />
                              <div className="bg-gray-300" style={{ width: `${(agent.outboundAttempt3PlusCalls / attemptTotal) * 100}%` }} />
                            </>
                          )}
                        </div>
                        <span className="text-xs tabular-nums text-gray-500">
                          {agent.outboundAttemptsPerLead.toFixed(1)}/lead
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={expanded ? 'Hide agent detail' : 'Show agent detail'}
                        aria-expanded={expanded}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpanded(key);
                        }}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={10} className="bg-gray-50 px-6 py-4">
                        <AgentDetail agent={agent} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="mt-4 space-y-3 md:hidden">
        {ranked.map(({ agent, key, rank, movement, lowVolume }) => {
          const expanded = expandedKeys.has(key);
          return (
            <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums text-gray-600">
                  {rank}
                </span>
                <RankMovement movement={movement} />
                <button
                  type="button"
                  className="truncate text-sm font-medium text-navy-950 hover:underline"
                  title={agent.agentExtension ? `Ext. ${agent.agentExtension} — view this agent's calls` : "View this agent's calls"}
                  onClick={() => onAgentClick(agent.agentUserId)}
                >
                  {agent.agentName}
                </button>
                {lowVolume && <span className={statusChipClass('gray')}>Low volume</span>}
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title={expanded ? 'Hide agent detail' : 'Show agent detail'}
                  aria-expanded={expanded}
                  onClick={() => toggleExpanded(key)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className={`text-lg font-medium tabular-nums ${lowVolume ? 'text-gray-400' : 'text-gray-900'}`}>
                    {formatNumber(agent.outboundAnsweredCalls)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Conversations
                    <span className={`ml-1 tabular-nums ${lowVolume ? 'text-gray-400' : ''}`}>
                      ({Math.round(agent.outboundAnswerRate)}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-navy-950">
                    {formatNumber(agent.officialInstructions)}
                  </p>
                  <p className="text-xs text-gray-500">Instructions</p>
                </div>
                <div>
                  <p className={`text-lg font-medium tabular-nums ${speedClass(agent.averageFirstOutboundDelaySeconds)}`}>
                    {agent.averageFirstOutboundDelaySeconds > 0
                      ? formatDelay(agent.averageFirstOutboundDelaySeconds)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Speed to lead</p>
                </div>
              </div>

              {expanded && (
                <div className="mt-3 rounded-md bg-gray-50 p-3">
                  <AgentDetail agent={agent} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Rates attributed to the 3CX call handler, not the lead owner. Instructions credited via CRM
        instruction records. Rates hidden under {LOW_VOLUME_THRESHOLD} dials.
      </p>
    </div>
  );
};
