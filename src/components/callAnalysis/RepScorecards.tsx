// Per-rep scorecard grid (hpa-style "click a rep for their dashboard").
// Pure presentation over CallAgentDailyBreakdown — every metric already comes
// from get_call_agent_daily_breakdown, plus the transparent coaching score.

import React from 'react';
import { Phone, ChevronRight } from 'lucide-react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { formatNumber, formatDelay } from './format';
import { computeCoachingScore, scoreTone, scoreBandLabel, speedTone, coachToneClasses, CoachTone } from './coaching';
import { MiniTrend } from './MiniTrend';

interface RepScorecardsProps {
  agents: CallAgentDailyBreakdown[];
  onSelectAgent?: (agentUserId?: string) => void;
  trendByAgent?: Record<string, number[]>;
}

const LOW_VOLUME_THRESHOLD = 20;

const SubBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const tone: CoachTone = value >= 70 ? 'good' : value >= 45 ? 'warn' : 'bad';
  const c = coachToneClasses[tone];
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{label}</span>
        <span className={`font-semibold tabular-nums ${c.text}`}>{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${c.bar}`} style={{ width: `${Math.max(value, 3)}%` }} />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; dotTone?: CoachTone }> = ({ label, value, dotTone }) => (
  <div>
    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-400">
      {dotTone && <span className={`h-1.5 w-1.5 rounded-full ${coachToneClasses[dotTone].dot}`} />}
      {label}
    </div>
    <div className="mt-0.5 text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
  </div>
);

export const RepScorecards: React.FC<RepScorecardsProps> = ({ agents, onSelectAgent, trendByAgent }) => {
  const ranked = [...agents]
    .map((a) => ({ a, coaching: computeCoachingScore(a) }))
    .sort((x, y) => y.coaching.score - x.coaching.score);

  if (ranked.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">No agent activity yet</h3>
        <p className="mt-1 text-sm text-gray-500">Scorecards appear once calls are attributed to a handler in this range.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Rep scorecards</h3>
        <span className="text-xs text-gray-400">Coaching score = Connect 50% · Convert 30% · Quality 20%</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ranked.map(({ a, coaching }, i) => {
          const tone = scoreTone(coaching.score);
          const c = coachToneClasses[tone];
          const lowVolume = a.outboundCalls < LOW_VOLUME_THRESHOLD;
          const sTone = speedTone(a.averageFirstOutboundDelaySeconds);
          return (
            <button
              key={a.agentUserId || a.agentName}
              type="button"
              onClick={() => onSelectAgent?.(a.agentUserId)}
              className="group rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-navy-300 hover:shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 tabular-nums">#{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-900">{a.agentName}</span>
                  </div>
                  <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.soft} ${c.text}`}>
                    {scoreBandLabel(coaching.score)}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold leading-none tabular-nums ${c.text}`}>{coaching.score}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">/ 100</div>
                  {(trendByAgent?.[a.agentUserId || a.agentName]?.length || 0) > 1 && (
                    <MiniTrend values={trendByAgent![a.agentUserId || a.agentName]} showDelta className="mt-1 justify-end" />
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <SubBar label="Connect" value={coaching.connect} />
                <SubBar label="Convert" value={coaching.convert} />
                <SubBar label="Quality" value={coaching.quality} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-y-2 gap-x-2 border-t border-gray-100 pt-3">
                <Stat label="Calls" value={formatNumber(a.outboundCalls)} />
                <Stat label="Answer" value={`${Math.round(a.outboundAnswerRate)}%`} />
                <Stat label="Instr." value={formatNumber(a.officialInstructions)} />
                <Stat label="Speed" value={formatDelay(a.averageFirstOutboundDelaySeconds)} dotTone={sTone} />
                <Stat label="→Instruct" value={`${Math.round(a.contactToInstructionRate)}%`} />
                <Stat label="Per lead" value={`×${(a.outboundAttemptsPerLead || 0).toFixed(1)}`} />
              </div>

              {lowVolume && (
                <p className="mt-2 text-[11px] text-amber-600">Low volume — under {LOW_VOLUME_THRESHOLD} dials, rates indicative.</p>
              )}
              <div className="mt-2 flex items-center justify-end text-[11px] text-gray-400 group-hover:text-navy-600">
                <Phone className="mr-1 h-3 w-3" /> View calls <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
