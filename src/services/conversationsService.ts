// Conversations — the ManyChat-style unified inbox: WhatsApp/SMS/email/web chat history
// per lead + how inquiries enter (channel mix). In ty this composes the provider message
// logs (WhatsApp Cloud API, SMS, email, web chat) keyed by lead; here, the mock.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export type ChannelKind = 'whatsapp' | 'sms' | 'email' | 'web';

export interface ConvThread {
  id: string; name: string; channel: ChannelKind; intent: string;
  last: string; at: string; unread: number; status: 'open' | 'closed';
  agent: string; responseMins: number; converted: boolean;
}
export interface ConvMessage { from: 'lead' | 'agent'; text: string; at: string; }
export interface ConvAgentStat { agent: string; handled: number; avgResponseMins: number; conversion: number; }
export interface ConvStats { kpis: MktKpi[]; byAgent: ConvAgentStat[]; }

export interface Conversations {
  channelMix: { label: string; count: number }[];
  threads: ConvThread[];
  assignableAgents: string[];
  stats: ConvStats;
  messages: Record<string, ConvMessage[]>;
}

export async function fetchConversations(): Promise<Conversations> {
  const { data, error } = await supabase.rpc('get_conversations', {});
  if (error) { console.error('Conversations RPC error:', error); throw error; }
  return data as Conversations;
}
