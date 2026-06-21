// "Who's strongest right now" — horizontal coaching-score ranking bars.
// The headline competitor chart for the Call Analysis page: every rep ranked by
// their transparent coaching score (Connect 50% / Convert 30% / Quality 20%),
// with a faint team-average marker so the owner can see who is above/below the line.
//
// Pure SVG / flex bars, no chart library. Portable into ty unchanged — types only
// from the service, all maths from ./coaching.

import React from 'react';
import { Trophy } from 'lucide-react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { computeCoachingScore, scoreTone, scoreBandLabel, coachToneClasses } from './coaching';

interface CoachingScoreChartProps {
  agents: CallAgentDailyBreakdown[];
  onSelect?: (agentUserId?: string) => void;
}

// Below this dial volume a rep's rates are noisy: sink them to the bottom, muted.
const LOW_VOLUME_THRESHOLD = 20;

export const CoachingScoreChart: React.FC<CoachingScoreChartProps> = ({ agents, onSelect }) => {
  const rows = agents.map((a) => {
    const coaching = computeCoachingScore(a);
    return {
      a,
      coaching,
      lowVolume: a.outboundCalls < LOW_VOLUME_THRESHOLD,
    };
  });

  // Sort by score desc, but always sink low-volume reps beneath qualified ones.
  const ranked = [...rows].sort((x, y) => {
    if (x.lowVolume !== y.lowVolume) return x.lowVolume ? 1 : -1;
    return y.coaching.score - x.coaching.score;
  });

  // Team average is across ALL bars shown (matches the rendered set).
  const teamAvg =
    ranked.length > 0
      ? Math.round(ranked.reduce((sum, r) => sum + r.coaching.score, 0) / ranked.length)
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Trophy className="h-3.5 w-3.5 text-navy-600" />
          Coaching score — who&rsquo;s strongest right now
        </h3>
        {ranked.length > 0 && (
          <span className="shrink-0 text-xs text-gray-400 tabular-nums">
            Team avg {teamAvg}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-gray-400">Connect 50% · Convert 30% · Quality 20%</p>

      {ranked.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No data yet</p>
      ) : (
        <>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${coachToneClasses.good.dot}`} /> Strong (75+)
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${coachToneClasses.warn.dot}`} /> Solid (55–74)
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${coachToneClasses.bad.dot}`} /> Needs coaching
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-0 border-l border-dashed border-gray-400" /> Team avg
            </span>
          </div>

          <ul className="mt-3 space-y-2.5">
            {ranked.map(({ a, coaching, lowVolume }, i) => {
              const tone = scoreTone(coaching.score);
              const c = coachToneClasses[tone];
              const fillWidth = Math.max(coaching.score, 2);
              return (
                <li key={a.agentUserId || a.agentName}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(a.agentUserId)}
                    title={`Connect ${coaching.connect} · Convert ${coaching.convert} · Quality ${coaching.quality}`}
                    className={`group w-full rounded-md px-1.5 py-1 text-left transition hover:bg-gray-50 ${
                      lowVolume ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-semibold text-gray-400 tabular-nums">
                        #{i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium text-gray-900">
                        {a.agentName}
                      </span>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${c.text}`}>
                        {coaching.score}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.soft} ${c.text}`}
                      >
                        {scoreBandLabel(coaching.score)}
                      </span>
                    </div>

                    {/* Track + proportional fill, with the team-avg marker overlaid. */}
                    <div className="relative mt-1 ml-7 h-2.5 overflow-visible rounded-full bg-gray-100">
                      <div
                        className={`h-2.5 rounded-full bg-gradient-to-r from-white/30 to-transparent ${c.bar}`}
                        style={{ width: `${fillWidth}%` }}
                      />
                      {/* Team average marker (faint dashed vertical line). */}
                      <span
                        aria-hidden
                        title={`Team average ${teamAvg}`}
                        className="absolute -top-0.5 bottom-0 h-3.5 border-l border-dashed border-gray-400/70"
                        style={{ left: `${Math.max(0, Math.min(100, teamAvg))}%` }}
                      />
                    </div>

                    {lowVolume && (
                      <p className="mt-0.5 ml-7 text-[10px] text-gray-400">
                        Under {LOW_VOLUME_THRESHOLD} dials — indicative only
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
