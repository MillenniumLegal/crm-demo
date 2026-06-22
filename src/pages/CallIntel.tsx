// Call Intelligence — the SOW Call-Analysis-integrity + Agent-Dashboard surfaces that the
// data model already supports but the UI didn't show: the per-agent "my day" dashboard,
// the inbound calls overview (IVR Option 1 vs Option 3), CRM-marking-vs-3CX verification,
// and the callback → conversion funnel.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchCallVerification, fetchInboundOverview, fetchCallbackFunnel, fetchAgentDay,
  CallVerification, InboundOverview as InboundData, CallbackFunnel, AgentDay,
} from '@/services/callIntelService';
import { AgentDayCard } from '@/components/callintel/AgentDayCard';
import { InboundOverview } from '@/components/callintel/InboundOverview';
import { CallVerificationPanel } from '@/components/callintel/CallVerificationPanel';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const CallIntel: React.FC = () => {
  const [verification, setVerification] = useState<CallVerification | null>(null);
  const [inbound, setInbound] = useState<InboundData | null>(null);
  const [callback, setCallback] = useState<CallbackFunnel | null>(null);
  const [agentDay, setAgentDay] = useState<AgentDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCallVerification(), fetchInboundOverview(), fetchCallbackFunnel(), fetchAgentDay()])
      .then(([v, i, c, a]) => {
        if (!active) return;
        setVerification(v); setInbound(i); setCallback(c); setAgentDay(a);
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Call <span className="font-serif italic text-navy-700">intelligence.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">The agent&rsquo;s day, inbound vs outbound, and what the CRM marks vs what 3CX actually recorded.</p>
      </div>

      {agentDay && <AgentDayCard data={agentDay} />}

      {inbound && (
        <>
          <MarketingKpiStrip kpis={inbound.kpis} />
          <InboundOverview data={inbound} />
        </>
      )}

      {verification && <CallVerificationPanel data={verification} />}

      {callback && (
        <RankedBarList
          title="Callbacks → conversion"
          caption={`Requested → contacted → completed → quote accepted → instructed · ${callback.winRate}% win rate · ${callback.range}`}
          items={callback.stages}
          defaultTone="info"
        />
      )}
    </div>
  );
};

export default CallIntel;
