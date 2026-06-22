// Team Performance hub — a manager's per-agent view. Compiles the call breakdown,
// AI rep quality, instructions, and quotas into team momentum, a leaderboard, agent
// scorecards, and workload balance. Reuses the trend + analytics components.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchTeamPerformance, TeamPerformance as TeamPerf, TeamAgent } from '@/services/teamService';
import { MomentumTiles } from '@/components/trends/MomentumTiles';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { TeamLeaderboard } from '@/components/team/TeamLeaderboard';
import { AgentScorecard } from '@/components/team/AgentScorecard';
import { WorkloadBalance } from '@/components/team/WorkloadBalance';
import { AgentDetailPanel } from '@/components/team/AgentDetailPanel';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const AGENT_COLORS = ['#1e3a8a', '#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6'];

const TeamPerformance: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TeamPerf | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<TeamAgent | null>(null);

  useEffect(() => {
    let active = true;
    fetchTeamPerformance()
      .then((d) => { if (active) setData(d); })
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
        <p>Couldn&rsquo;t load team performance.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  const openAgent = (id: string) => setSelectedAgent(data.agents.find((a) => a.id === id) || null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          How is the <span className="font-serif italic text-navy-700">team doing.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Per-agent performance — {data.range}.</p>
      </div>

      <MomentumTiles kpis={data.teamMomentum} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <TeamLeaderboard agents={data.agents} onOpen={openAgent} />
        <WorkloadBalance agents={data.agents} />
      </div>

      <TrendLineChart
        title="Score trends by agent"
        caption="Performance-score trajectory, recent"
        height={220}
        series={data.agents.map((a, i) => ({
          key: a.id,
          label: a.name.split(' ')[0],
          color: AGENT_COLORS[i % AGENT_COLORS.length],
          points: a.scoreTrend.map((y, idx) => ({ x: String(idx + 1), y })),
        }))}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Agent scorecards</h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.agents.map((a) => (
            <AgentScorecard key={a.id} agent={a} onOpen={openAgent} />
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Conversion by agent" caption="Reached → instruction %" items={data.conversionByAgent} defaultTone="good" />
        <RankedBarList title="Coaching score by agent" caption="Connect / convert / quality blend" items={data.coachingByAgent} defaultTone="info" />
      </div>

      <AgentDetailPanel
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onOpenCalls={() => navigate('/call-analysis')}
      />
    </div>
  );
};

export default TeamPerformance;
