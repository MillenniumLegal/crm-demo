// Conversations — the ManyChat-style unified inbox: chat with leads across WhatsApp, SMS,
// email and web from one place, with the full per-lead history, plus "how enquiries enter"
// (channel mix). Demo: sending a message appends locally.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchConversations, Conversations as Conv } from '@/services/conversationsService';
import { ConversationsInbox } from '@/components/conversations/ConversationsInbox';
import { ConversationStats } from '@/components/conversations/ConversationStats';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const Conversations: React.FC = () => {
  const [data, setData] = useState<Conv | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchConversations()
      .then((d) => { if (active) setData(d); })
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Conversations<span className="font-serif italic text-navy-700">.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Chat with leads across WhatsApp, SMS, email and web from one place — and see how enquiries enter.</p>
      </div>

      <ConversationStats kpis={data.stats.kpis} byAgent={data.stats.byAgent} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ConversationsInbox threads={data.threads} messages={data.messages} assignableAgents={data.assignableAgents} />
        </div>
        <RankedBarList title="How enquiries enter" caption="By channel, last 30 days" items={data.channelMix} defaultTone="info" />
      </div>
    </div>
  );
};

export default Conversations;
