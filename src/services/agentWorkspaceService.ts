// Agent workspace — the LIVE AGENT view, scoped to one agent: their day, personal
// targets/pace, lead worklist, and their instructions. In ty this is filtered to the
// signed-in agent; here it reads the AGENT_WORKSPACE mock.

import { supabase } from '@/lib/supabase';
import { AgentDay } from '@/services/callIntelService';

export interface AgentTargets {
  instructions: { mtd: number; target: number };
  calls: { today: number; target: number };
  conversion: { value: number; target: number };
  rank: number;
  of: number;
  note: string;
}
export interface AgentLead { name: string; stage: string; priority: 'high' | 'med' | 'low'; next: string; value: number; }
export interface AgentInstruction { name: string; type: string; units: number; fee: number; at: string; }

export interface AgentWorkspace {
  agent: string;
  day: AgentDay;
  targets: AgentTargets;
  myLeads: AgentLead[];
  myInstructions: AgentInstruction[];
}

export async function fetchAgentWorkspace(): Promise<AgentWorkspace> {
  const { data, error } = await supabase.rpc('get_agent_workspace', {});
  if (error) { console.error('Agent workspace RPC error:', error); throw error; }
  return data as AgentWorkspace;
}
