import { supabase } from '@/lib/supabase';

export interface ActivityLog {
  id: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  lead_id?: string;
  lead_name?: string;
  action_description: string;
  done_by_type: 'user' | 'system' | 'webhook' | 'api';
  done_by_id?: string;
  done_by_name?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 
  | 'lead_created' 
  | 'lead_assigned' 
  | 'lead_archived'
  | 'lead_auto_archived'
  | 'lead_archive_restored'
  | 'lead_updated' 
  | 'lead_status_changed'
  | 'lead_deleted'
  | 'quote_sent' 
  | 'quote_created'
  | 'quote_accepted'
  | 'payment_received' 
  | 'payment_created'
  | 'task_completed' 
  | 'task_created'
  | 'contact_attempt'
  | 'email_sent'
  | 'sms_sent'
  | 'outcome_code_set'
  | 'manual_instruction_marked'
  | 'manual_instruction_reversed'
  | 'note_added'
  | 'webhook_received'
  | 'instruction_form_reset'
  | 'client_info_returned'
  | 'callback_requested'
  | 'callback_contacted'
  | 'callback_completed'
  | 'callback_cancelled'
  | 'callback_reopen'
  | 'callback_assigned'
  | 'instruction_requested'
  | 'instruction_request_contacted'
  | 'instruction_request_completed'
  | 'instruction_request_cancelled'
  | 'instruction_request_reopen';

/**
 * Log an activity to the activity_log table
 */
export async function logActivity(params: {
  activityType: ActivityType;
  entityType: 'lead' | 'quote' | 'payment' | 'task' | 'contact_attempt';
  entityId: string;
  leadId?: string;
  leadName?: string;
  actionDescription: string;
  doneByType: 'user' | 'system' | 'webhook' | 'api';
  doneById?: string;
  doneByName?: string;
  metadata?: any;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        activity_type: params.activityType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        lead_id: params.leadId,
        lead_name: params.leadName,
        action_description: params.actionDescription,
        done_by_type: params.doneByType,
        done_by_id: params.doneById,
        done_by_name: params.doneByName,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging activity:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in logActivity:', error);
    return false;
  }
}

/**
 * Fetch activities for today
 */
export async function fetchTodayActivities(userId?: string, userRole?: string): Promise<ActivityLog[]> {
  try {
    const TODAY_ACTIVITY_LIMIT = 500;
    const AGENT_LEAD_ID_LIMIT = 300;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTodayISO = startOfToday.toISOString();

    // Non-agent roles can read the global feed directly.
    if (userRole !== 'Agent' || !userId) {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', startOfTodayISO)
        .order('created_at', { ascending: false })
        .limit(TODAY_ACTIVITY_LIMIT);

      if (error) {
        console.error('Error fetching activities:', error);
        return [];
      }
      return data || [];
    }

    // Agent view: avoid huge `or(...lead_id.in(...))` query strings that can 400.
    const { data: ownActivities, error: ownError } = await supabase
      .from('activity_log')
      .select('*')
      .gte('created_at', startOfTodayISO)
      .eq('done_by_id', userId)
      .order('created_at', { ascending: false })
      .limit(TODAY_ACTIVITY_LIMIT);

    if (ownError) {
      console.error('Error fetching own activities:', ownError);
      return [];
    }

    const { data: agentLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .eq('assigned_to', userId)
      .order('updated_at', { ascending: false })
      .limit(AGENT_LEAD_ID_LIMIT);

    if (leadsError) {
      console.error('Error fetching agent leads:', leadsError);
      return ownActivities || [];
    }

    const leadIds = (agentLeads || []).map((l) => l.id).filter(Boolean);
    if (leadIds.length === 0) {
      return ownActivities || [];
    }

    const BATCH_SIZE = 100;
    const leadActivities: ActivityLog[] = [];

    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      const batch = leadIds.slice(i, i + BATCH_SIZE);
      const { data: batchData, error: batchError } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', startOfTodayISO)
        .in('lead_id', batch)
        .order('created_at', { ascending: false })
        .limit(TODAY_ACTIVITY_LIMIT);

      if (batchError) {
        console.error('Error fetching lead activities batch:', batchError);
        continue;
      }
      if (batchData) leadActivities.push(...batchData);
    }

    // Merge, dedupe by activity id, and cap to the latest records for dashboard/modal display.
    const merged = [...(ownActivities || []), ...leadActivities];
    const deduped = Array.from(new Map(merged.map((a) => [a.id, a])).values());
    deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return deduped.slice(0, TODAY_ACTIVITY_LIMIT);
  } catch (error) {
    console.error('Error in fetchTodayActivities:', error);
    return [];
  }
}

/**
 * Get the last call stage reached for a lead from activity log
 * Returns the highest call stage number found (e.g., 3 for Call-3)
 */
async function getLastCallStageFromActivityLog(leadId: string): Promise<number> {
  try {
    // Fetch activities that show stage changes
    const { data, error } = await supabase
      .from('activity_log')
      .select('metadata, action_description')
      .eq('lead_id', leadId)
      .or('activity_type.eq.lead_updated,activity_type.eq.outcome_code_selected,activity_type.eq.outcome_code_set,activity_type.eq.lead_status_changed')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching stage history:', error);
      return 0;
    }

    // Look through metadata for stage information
    let maxCallStage = 0;
    (data || []).forEach((activity) => {
      const metadata = activity.metadata;
      if (metadata && typeof metadata === 'object') {
        // Check if metadata contains stage information (new format from outcome code logging)
        const stage = metadata.stage || metadata.newStage || metadata.toStage;
        if (stage && typeof stage === 'string') {
          const match = stage.match(/Call-(\d)/);
          if (match) {
            const stageNum = parseInt(match[1], 10);
            maxCallStage = Math.max(maxCallStage, stageNum);
          }
        }
      }
      
      // Also check action_description for stage mentions (fallback)
      const actionDesc = activity.action_description || '';
      const descMatch = actionDesc.match(/Call-(\d)/i);
      if (descMatch) {
        const stageNum = parseInt(descMatch[1], 10);
        maxCallStage = Math.max(maxCallStage, stageNum);
      }
    });

    return maxCallStage;
  } catch (error) {
    console.error('Error in getLastCallStageFromActivityLog:', error);
    return 0;
  }
}

/**
 * Calculate contact attempts based on lead stage
 * - Call-1 = 1 attempt, Call-2 = 2 attempts, etc.
 * - For non-call stages, determine the last call stage reached
 */
export async function calculateContactAttemptsFromStage(leadStage: string, leadId: string): Promise<number> {
  // If stage is a Call-X stage, extract the number directly
  const callStageMatch = leadStage.match(/Call-(\d)/);
  if (callStageMatch) {
    return parseInt(callStageMatch[1], 10);
  }

  // For non-call stages (New, Interested, Completed, etc.), find the last call stage reached
  if (leadStage === 'New') {
    return 0;
  }

  // For other stages, check activity log to find the highest call stage reached
  const lastCallStage = await getLastCallStageFromActivityLog(leadId);
  
  // If we found a call stage in history, use it
  // Otherwise, if they're at a progressed stage (not New), assume at least 1 attempt
  if (lastCallStage > 0) {
    return lastCallStage;
  }

  // Fallback: if stage is progressed beyond New, assume at least 1 attempt
  const progressedStages = [
    'Interested',
    'Ready to Solicit',
    'Quote Accepted - Awaiting Payment',
    'Payment Completed - Awaiting Client Information',
    'Completed',
    'Sold',
    'Closed'
  ];
  if (progressedStages.includes(leadStage)) {
    return 1; // Default to 1 if we can't determine the exact number
  }

  return 0;
}

/**
 * Count contact attempts for a specific lead (legacy function - now uses stage-based calculation)
 * @deprecated Use calculateContactAttemptsFromStage instead
 */
export async function countContactAttempts(leadId: string): Promise<number> {
  try {
    // First, get the lead's current stage
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', leadId)
      .single();

    if (leadError || !leadData) {
      console.error('Error fetching lead stage:', leadError);
      return 0;
    }

    // Use stage-based calculation
    return await calculateContactAttemptsFromStage(leadData.stage || 'New', leadId);
  } catch (error) {
    console.error('Error in countContactAttempts:', error);
    return 0;
  }
}

/**
 * Count contact attempts for multiple leads (batch) - based on stage progression
 */
export async function countContactAttemptsBatch(leadIds: string[]): Promise<Map<string, number>> {
  try {
    if (leadIds.length === 0) {
      return new Map();
    }

    // Supabase has limits on the number of items in an in() clause
    // Split into chunks of 100 to avoid query size limits
    const BATCH_SIZE = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      chunks.push(leadIds.slice(i, i + BATCH_SIZE));
    }

    // Fetch all leads with their stages in batches
    let allLeadsData: Array<{ id: string; stage: string | null }> = [];
    
    for (const chunk of chunks) {
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, stage')
        .in('id', chunk);

    if (leadsError) {
        console.error('Error fetching leads for batch count (chunk):', leadsError);
        // Continue with other chunks even if one fails
        continue;
      }

      if (leadsData) {
        allLeadsData = allLeadsData.concat(leadsData);
    }
    }

    const leadsData = allLeadsData;

    const counts = new Map<string, number>();
    const leadsNeedingHistoryCheck: Array<{ id: string; stage: string }> = [];

    // First pass: calculate attempts for Call-X stages directly
    (leadsData || []).forEach((lead) => {
      const stage = lead.stage || 'New';
      const callStageMatch = stage.match(/Call-(\d)/);
      
      if (callStageMatch) {
        // Direct mapping: Call-1 = 1, Call-2 = 2, etc.
        counts.set(lead.id, parseInt(callStageMatch[1], 10));
      } else if (stage === 'New') {
        counts.set(lead.id, 0);
      } else {
        // Need to check history for non-call stages
        leadsNeedingHistoryCheck.push({ id: lead.id, stage });
      }
    });

    // For leads with non-call stages, fetch activity logs to find last call stage
    if (leadsNeedingHistoryCheck.length > 0) {
      const nonCallLeadIds = leadsNeedingHistoryCheck.map(l => l.id);
      
      // Split non-call lead IDs into chunks to avoid query size limits
      const activityChunks: string[][] = [];
      for (let i = 0; i < nonCallLeadIds.length; i += BATCH_SIZE) {
        activityChunks.push(nonCallLeadIds.slice(i, i + BATCH_SIZE));
      }

      // Fetch activities that show stage changes for these leads (in batches)
      let allActivitiesData: Array<{ lead_id: string | null; metadata: any; action_description: string | null }> = [];
      
      for (const chunk of activityChunks) {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activity_log')
        .select('lead_id, metadata, action_description')
          .in('lead_id', chunk)
        .or('activity_type.eq.lead_updated,activity_type.eq.outcome_code_selected,activity_type.eq.outcome_code_set,activity_type.eq.lead_status_changed')
        .order('created_at', { ascending: false });

        if (activitiesError) {
          console.error('Error fetching activities for batch count (chunk):', activitiesError);
          // Continue with other chunks even if one fails
          continue;
        }

        if (activitiesData) {
          allActivitiesData = allActivitiesData.concat(activitiesData);
        }
      }

      const activitiesData = allActivitiesData;

      if (activitiesData && activitiesData.length > 0) {
        // Group activities by lead_id and find max call stage
        const leadMaxCallStages = new Map<string, number>();
        
        activitiesData.forEach((activity) => {
          const leadId = activity.lead_id;
          if (!leadId) return;
          
          const metadata = activity.metadata;
          if (metadata && typeof metadata === 'object') {
            // Check metadata for stage (new format from outcome code logging)
            const stage = metadata.stage || metadata.newStage || metadata.toStage;
            if (stage && typeof stage === 'string') {
              const match = stage.match(/Call-(\d)/);
              if (match) {
                const stageNum = parseInt(match[1], 10);
                const currentMax = leadMaxCallStages.get(leadId) || 0;
                leadMaxCallStages.set(leadId, Math.max(currentMax, stageNum));
              }
            }
          }
          
          // Also check action_description for stage mentions (fallback)
          const actionDesc = activity.action_description || '';
          const descMatch = actionDesc.match(/Call-(\d)/i);
          if (descMatch) {
            const stageNum = parseInt(descMatch[1], 10);
            const currentMax = leadMaxCallStages.get(leadId) || 0;
            leadMaxCallStages.set(leadId, Math.max(currentMax, stageNum));
          }
        });

        // Set counts for leads where we found call stage history
        leadMaxCallStages.forEach((maxStage, leadId) => {
          counts.set(leadId, maxStage);
        });

        // For leads without call stage history, use fallback logic
        leadsNeedingHistoryCheck.forEach((lead) => {
          if (!counts.has(lead.id)) {
            const progressedStages = [
              'Interested',
              'Ready to Solicit',
              'Quote Accepted - Awaiting Payment',
              'Payment Completed - Awaiting Client Information',
              'Completed',
              'Sold',
              'Closed'
            ];
            // If they're at a progressed stage, assume at least 1 attempt
            counts.set(lead.id, progressedStages.includes(lead.stage) ? 1 : 0);
          }
        });
      } else {
        // If we can't fetch activity history, use fallback
        leadsNeedingHistoryCheck.forEach((lead) => {
          const progressedStages = [
            'Interested',
            'Ready to Solicit',
            'Quote Accepted - Awaiting Payment',
            'Payment Completed - Awaiting Client Information',
            'Completed',
            'Sold',
            'Closed'
          ];
          counts.set(lead.id, progressedStages.includes(lead.stage) ? 1 : 0);
        });
      }
    }

    // Ensure all leadIds have an entry (even if 0)
    leadIds.forEach((leadId) => {
      if (!counts.has(leadId)) {
        counts.set(leadId, 0);
      }
    });

    return counts;
  } catch (error) {
    console.error('Error in countContactAttemptsBatch:', error);
    return new Map();
  }
}

/**
 * Fetch contact attempts for a specific lead
 */
export async function fetchContactAttempts(leadId: string): Promise<ActivityLog[]> {
  try {
    // Fetch activities related to contact attempts for this lead
    // This includes: contact_attempt activities, outcome_code_set (which indicates contact was made),
    // and any activities that mention call, email, SMS, or contact in the description
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('lead_id', leadId)
      .or('activity_type.eq.contact_attempt,activity_type.eq.outcome_code_set,activity_type.eq.task_completed,action_description.ilike.%Call%,action_description.ilike.%Email%,action_description.ilike.%SMS%,action_description.ilike.%contact%,action_description.ilike.%Phone%')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching contact attempts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchContactAttempts:', error);
    return [];
  }
}

/**
 * Fetch all contact attempts across all leads
 */
export async function fetchAllContactAttempts(userId?: string, userRole?: string, limit: number = 500): Promise<ActivityLog[]> {
  try {
    let query = supabase
      .from('activity_log')
      .select('*')
      .or('activity_type.eq.contact_attempt,activity_type.eq.outcome_code_set,activity_type.eq.task_completed,action_description.ilike.%Call%,action_description.ilike.%Email%,action_description.ilike.%SMS%,action_description.ilike.%contact%,action_description.ilike.%Phone%')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all contact attempts:', error);
      return [];
    }

    // If agent, filter results to their own activities or activities on their leads
    if (userRole === 'Agent' && userId && data) {
      const { data: agentLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', userId);

      const agentLeadIds = new Set(agentLeads?.map(l => l.id) || []);
      
      return data.filter(activity => 
        activity.done_by_id === userId || 
        (activity.lead_id && agentLeadIds.has(activity.lead_id))
      ) || [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchAllContactAttempts:', error);
    return [];
  }
}

/**
 * Format activity for display
 */
export function formatActivityForDisplay(activity: ActivityLog): {
  id: string;
  action: string;
  lead: string;
  time: string;
  type: string;
  doneBy: string;
  doneByType: 'user' | 'system' | 'webhook' | 'api';
  timestamp: number;
  leadId?: string;
} {
  const createdTs = new Date(activity.created_at || '').getTime();
  const updatedTs = new Date(activity.updated_at || '').getTime();
  const nowTs = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;

  // Prefer created_at; fallback to updated_at. Reject future-dated values.
  const preferredTs = Number.isFinite(createdTs) && createdTs > 0 ? createdTs
    : (Number.isFinite(updatedTs) && updatedTs > 0 ? updatedTs : 0);
  const validTimestamp = preferredTs > 0 && preferredTs <= nowTs + fiveMinutesMs;
  const timestamp = validTimestamp ? preferredTs : 0;
  const now = new Date();
  const diffMs = validTimestamp ? now.getTime() - timestamp : NaN;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  let timeStr = 'Unknown';
  if (validTimestamp && diffMs >= 0 && diffMs < 60_000) {
    const secs = Math.max(1, Math.floor(diffMs / 1000));
    timeStr = `${secs} ${secs === 1 ? 'second' : 'seconds'} ago`;
  } else if (validTimestamp && diffMins >= 1 && diffMins < 60) {
    timeStr = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (validTimestamp && diffHours >= 1 && diffHours < 24) {
    timeStr = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (validTimestamp && diffHours >= 24) {
    const diffDays = Math.floor(diffHours / 24);
    timeStr = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  // Handle done_by_name which might be an object from join or a string
  let doneByName = '';
  if (typeof activity.done_by_name === 'object' && activity.done_by_name !== null) {
    doneByName = (activity.done_by_name as any).name || '';
  } else if (typeof activity.done_by_name === 'string') {
    doneByName = activity.done_by_name;
  } else {
    // Fallback to type-based name
    doneByName = activity.done_by_type === 'webhook' ? 'Hoowla Webhook' : 
                 activity.done_by_type === 'system' ? 'System' : 'Unknown';
  }

  // Handle lead_name which might be an object from join or a string
  let leadName = 'Unknown Lead';
  if (typeof activity.lead_name === 'object' && activity.lead_name !== null) {
    leadName = (activity.lead_name as any).name || 'Unknown Lead';
  } else if (typeof activity.lead_name === 'string') {
    leadName = activity.lead_name;
  }

  return {
    id: activity.id,
    action: activity.action_description,
    lead: leadName,
    time: timeStr,
    type: activity.activity_type,
    doneBy: doneByName,
    doneByType: activity.done_by_type,
    timestamp: validTimestamp ? timestamp : 0,
    leadId: activity.lead_id,
  };
}








