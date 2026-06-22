// Conversations — the ManyChat-style unified inbox: chat with leads across WhatsApp, SMS,
// email and web from one place, with the full per-lead history, plus "how enquiries enter"
// (channel mix). Demo: sending a message appends locally.

import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchConversations, Conversations as Conv } from '@/services/conversationsService';
import { ConversationsInbox } from '@/components/conversations/ConversationsInbox';
import { ConversationStats } from '@/components/conversations/ConversationStats';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const Conversations: React.FC = () => {
  const navigate = useNavigate();
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

  const recoveryThreads = data.threads.filter((thread) => /recovery|wrong number|referral|quote rescue/i.test(`${thread.intent} ${thread.last}`));
  const unreadRecovery = recoveryThreads.reduce((sum, thread) => sum + thread.unread, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Conversations<span className="font-serif italic text-navy-700">.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Chat with leads across WhatsApp, SMS, email and web from one place — and see how enquiries enter.</p>
      </div>

      <ConversationStats kpis={data.stats.kpis} byAgent={data.stats.byAgent} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-navy-700" />
              <h2 className="text-sm font-semibold text-gray-900">Recovery replies are routed here</h2>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">{recoveryThreads.length} threads</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              AI drips, reconstructed-contact emails and won-client referral asks become normal inbox conversations,
              with agent handover when a lead replies or shows intent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/recovery-engine')}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300"
          >
            Open Recovery Engine <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Unread recovery replies', value: unreadRecovery.toLocaleString('en-GB'), icon: MessageSquare, color: '#f59e0b' },
            { label: 'Won-client asks', value: String(recoveryThreads.filter((thread) => /referral/i.test(thread.intent)).length), icon: Sparkles, color: '#16a34a' },
            { label: 'Contact repair replies', value: String(recoveryThreads.filter((thread) => /wrong number|repair/i.test(thread.intent)).length), icon: Sparkles, color: '#4338ca' },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => navigate('/recovery-engine')}
                className="rounded-lg bg-gray-50 p-3 text-left hover:bg-gray-100"
              >
                <Icon className="h-4 w-4" style={{ color: metric.color }} />
                <div className="mt-2 text-[11px] font-semibold uppercase text-gray-500">{metric.label}</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-gray-900">{metric.value}</div>
              </button>
            );
          })}
        </div>
      </div>

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
