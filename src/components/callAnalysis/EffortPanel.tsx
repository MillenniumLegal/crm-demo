// Overview side panel: "Dialling effort" (spec §1.5, §3 stacked bars, §9.6).
// Attempt-mix stacked bar (1st / 2nd / 3rd+ call), effort stats, and the
// six busiest agents with their own attempt mix for context.

import React from 'react';
import { EffortPanelProps } from './types';
import { formatDelay, formatNumber, getRate } from './format';

// Sequence palette (not semantic): 1st = navy-950, 2nd = navy-400, 3rd+ = gray-300.
const ATTEMPT_SEGMENTS: Array<{ bucket: 1 | 2 | 3; label: string; barClass: string }> = [
  { bucket: 1, label: '1st call', barClass: 'bg-navy-950' },
  { bucket: 2, label: '2nd call', barClass: 'bg-navy-400' },
  { bucket: 3, label: '3rd+ call', barClass: 'bg-gray-300' },
];

const attemptCounts = (source: {
  outboundAttempt1Calls: number;
  outboundAttempt2Calls: number;
  outboundAttempt3PlusCalls: number;
}): [number, number, number] => [
  source.outboundAttempt1Calls,
  source.outboundAttempt2Calls,
  source.outboundAttempt3PlusCalls,
];

export const EffortPanel: React.FC<EffortPanelProps> = ({ overview, agents, onAttemptClick }) => {
  const counts = attemptCounts(overview);
  const totalAttempts = counts[0] + counts[1] + counts[2];

  const topAgents = [...agents]
    .filter((agent) => agent.outboundCalls > 0)
    .sort((a, b) => b.outboundCalls - a.outboundCalls)
    .slice(0, 6);

  return (
    <section className="card">
      <h3 className="text-sm font-semibold text-gray-900">Dialling effort</h3>
      <p className="mt-1 text-xs text-gray-500">How many tries it takes to get through.</p>

      {totalAttempts > 0 ? (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {ATTEMPT_SEGMENTS.map((segment, index) =>
              counts[index] > 0 ? (
                <button
                  key={segment.bucket}
                  type="button"
                  onClick={() => onAttemptClick(segment.bucket)}
                  title={`${segment.label} — ${formatNumber(counts[index])} calls (${getRate(counts[index], totalAttempts)}%)`}
                  className={`${segment.barClass} cursor-pointer transition-opacity hover:opacity-80`}
                  style={{ width: `${(counts[index] / totalAttempts) * 100}%` }}
                />
              ) : null
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {ATTEMPT_SEGMENTS.map((segment, index) => (
              <button
                key={segment.bucket}
                type="button"
                onClick={() => onAttemptClick(segment.bucket)}
                title={`Filter calls to ${segment.label.toLowerCase()} attempts`}
                className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 transition-colors hover:text-navy-950"
              >
                <span className={`h-2.5 w-2.5 rounded-sm ${segment.barClass}`} />
                <span>{segment.label}</span>
                <span className="tabular-nums text-gray-500">
                  {formatNumber(counts[index])} ({getRate(counts[index], totalAttempts)}%)
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">No outbound calls in this range.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 pt-4 text-sm text-gray-600">
        <span>
          Avg calls per lead{' '}
          <span className="font-semibold tabular-nums text-gray-900">
            {overview.outboundAttemptsPerLead.toFixed(2)}
          </span>
        </span>
        <span>
          Speed to lead{' '}
          <span className="font-semibold tabular-nums text-gray-900">
            {formatDelay(overview.averageFirstOutboundDelaySeconds)}
          </span>
        </span>
      </div>

      {topAgents.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Busiest agents</p>
          <ul className="mt-2 space-y-2">
            {topAgents.map((agent) => {
              const agentCounts = attemptCounts(agent);
              const agentTotal = agentCounts[0] + agentCounts[1] + agentCounts[2];
              return (
                <li
                  key={agent.agentUserId ?? agent.agentName}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-gray-700">{agent.agentName}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-gray-500">
                      {formatNumber(agent.outboundCalls)}
                    </span>
                    <span
                      className="flex h-2 w-20 overflow-hidden rounded-full bg-gray-100"
                      title={ATTEMPT_SEGMENTS.map(
                        (segment, index) => `${segment.label}: ${formatNumber(agentCounts[index])}`
                      ).join(' · ')}
                    >
                      {agentTotal > 0 &&
                        ATTEMPT_SEGMENTS.map((segment, index) =>
                          agentCounts[index] > 0 ? (
                            <span
                              key={segment.bucket}
                              className={segment.barClass}
                              style={{ width: `${(agentCounts[index] / agentTotal) * 100}%` }}
                            />
                          ) : null
                        )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
