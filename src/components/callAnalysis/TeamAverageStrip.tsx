// Agents tab: team-average strip (spec §5) — five inline stats from the
// daily overview, shown above the agent leaderboard as the benchmark.

import React from 'react';
import { TeamAverageStripProps } from './types';
import { formatDelay } from './format';

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-lg font-semibold tabular-nums text-gray-900">{value}</p>
  </div>
);

export const TeamAverageStrip: React.FC<TeamAverageStripProps> = ({ overview }) => (
  <section className="card p-4">
    <div className="flex flex-wrap gap-6">
      <Stat label="Team answer rate" value={`${Math.round(overview.outboundAnswerRate)}%`} />
      <Stat label="Reach rate" value={`${Math.round(overview.contactRate)}%`} />
      <Stat
        label={'Reach → instruction'}
        value={`${Math.round(overview.contactToInstructionRate)}%`}
      />
      <Stat label="Speed to lead" value={formatDelay(overview.averageFirstOutboundDelaySeconds)} />
      <Stat label="Avg calls per lead" value={overview.outboundAttemptsPerLead.toFixed(2)} />
    </div>
  </section>
);
