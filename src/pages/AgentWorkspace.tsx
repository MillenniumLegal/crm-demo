// Agent workspace — the LIVE AGENT view (role-scoped to one agent): personal targets +
// pace, the agent's day (12 tiles + coaching + actions), their lead worklist, and their
// instructions this month. This is the agent-facing duplicate of the manager visibility.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchAgentWorkspace, AgentWorkspace as AW } from '@/services/agentWorkspaceService';
import { AgentDayCard } from '@/components/callintel/AgentDayCard';
import { AgentTargetCard } from '@/components/agent/AgentTargetCard';
import { MyWorklist } from '@/components/agent/MyWorklist';
import { ConversationsInbox } from '@/components/conversations/ConversationsInbox';
import { fetchConversations, Conversations } from '@/services/conversationsService';

const AgentWorkspace: React.FC = () => {
  const [data, setData] = useState<AW | null>(null);
  const [convo, setConvo] = useState<Conversations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAgentWorkspace(), fetchConversations()])
      .then(([d, c]) => { if (active) { setData(d); setConvo(c); } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const totalUnits = data.myInstructions.reduce((s, i) => s + i.units, 0);
  const totalFees = data.myInstructions.reduce((s, i) => s + i.fee, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          My <span className="font-serif italic text-navy-700">workspace.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Your day, your targets, your leads — {data.agent}.</p>
      </div>

      <AgentTargetCard targets={data.targets} />

      <AgentDayCard data={data.day} />

      <div className="grid gap-5 xl:grid-cols-2">
        <MyWorklist leads={data.myLeads} />

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Your instructions this month</h3>
          <p className="text-xs text-gray-500">{data.myInstructions.length} instructions · {totalUnits} units · £{totalFees.toLocaleString()}</p>
          <div className="mt-3 divide-y divide-gray-100">
            {data.myInstructions.map((ins, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{ins.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{ins.type} · {ins.at}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {ins.units > 1 && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">×{ins.units}</span>
                  )}
                  <span className="tabular-nums text-gray-700">£{ins.fee.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {convo && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your conversations</h2>
          <p className="mt-0.5 mb-3 text-sm text-gray-500">Chat with your leads without leaving your workspace.</p>
          <ConversationsInbox threads={convo.threads} messages={convo.messages} assignableAgents={convo.assignableAgents} />
        </div>
      )}
    </div>
  );
};

export default AgentWorkspace;
