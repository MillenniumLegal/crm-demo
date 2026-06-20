import { supabase } from '@/lib/supabase';

export interface DailyQuota {
  agentId: string;
  date: string; // YYYY-MM-DD
  assignedToday: number;
  dailyQuota: number;
  assignedThisWeek?: number;
  weeklyQuota?: number;
  rawAssignedToday?: number;
  rawAssignedThisWeek?: number;
  dailyUsageAdjustment?: number;
  weeklyUsageAdjustment?: number;
  dailyAllowanceBonus?: number;
  weeklyAllowanceBonus?: number;
  dailyEffectiveQuota?: number;
  weeklyEffectiveQuota?: number;
  hasAdjustments?: boolean;
  remaining?: number;
  weeklyRemaining?: number;
  quotaReached?: boolean;
  weeklyQuotaReached?: boolean;
  resetTimezone?: string;
  rangeStart?: string;
  rangeEnd?: string;
  weekRangeStart?: string;
  weekRangeEnd?: string;
}

export interface AgentQuotaUsage {
  agentId: string;
  date: string;
  assignedToday: number;
  dailyQuota: number;
  assignedThisWeek: number;
  weeklyQuota?: number;
  rawAssignedToday: number;
  rawAssignedThisWeek: number;
  dailyUsageAdjustment: number;
  weeklyUsageAdjustment: number;
  dailyAllowanceBonus: number;
  weeklyAllowanceBonus: number;
  dailyEffectiveQuota: number;
  weeklyEffectiveQuota: number;
  hasAdjustments: boolean;
  remaining: number;
  weeklyRemaining: number;
  quotaReached: boolean;
  weeklyQuotaReached: boolean;
  resetTimezone: 'Europe/London';
  rangeStart: string;
  rangeEnd: string;
  weekRangeStart: string;
  weekRangeEnd: string;
}

export type QuotaAdjustmentScope = 'daily' | 'weekly';
export type QuotaAdjustmentActionType = 'reset_to_zero' | 'extra_allowance';

export interface AgentQuotaAdjustment {
  id: string;
  agentId: string;
  scope: QuotaAdjustmentScope;
  actionType: QuotaAdjustmentActionType;
  effectiveDate?: string | null;
  weekStartDate?: string | null;
  usageOffset: number;
  allowanceBonus: number;
  reason: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface AgentQuotaOverviewRow {
  agentId: string;
  agentName: string;
  agentEmail: string;
  dailyQuota: number;
  weeklyQuota: number;
  assignedTodayRaw: number;
  assignedWeekRaw: number;
  dailyAdjustmentTotal: number;
  weeklyAdjustmentTotal: number;
  dailyAllowanceBonus: number;
  weeklyAllowanceBonus: number;
  assignedTodayEffective: number;
  assignedWeekEffective: number;
  dailyEffectiveQuota: number;
  weeklyEffectiveQuota: number;
  remainingToday: number;
  remainingWeek: number;
  quotaReachedToday: boolean;
  quotaReachedWeek: boolean;
  activeLeadsCount: number;
  timezoneUsed: string;
  dayStart: string;
  dayEnd: string;
  weekStart: string;
  weekEnd: string;
}

const QUOTA_TIMEZONE = 'Europe/London' as const;
const DEFAULT_DAILY_QUOTA = 999;

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
};

const zonedTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstUtc = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstUtc, timeZone);
  return new Date(utcGuess.getTime() - secondOffset);
};

const getUkDayRange = (date = new Date()) => {
  const parts = getTimeZoneParts(date, QUOTA_TIMEZONE);
  const start = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, QUOTA_TIMEZONE);
  const nextLocal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0));
  const nextParts = getTimeZoneParts(nextLocal, 'UTC');
  const end = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0, QUOTA_TIMEZONE);

  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const getUkWeekRange = (date = new Date()) => {
  const parts = getTimeZoneParts(date, QUOTA_TIMEZONE);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfWeek = localDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(localDate);
  monday.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);

  const start = zonedTimeToUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    0,
    QUOTA_TIMEZONE
  );
  const end = zonedTimeToUtc(
    nextMonday.getUTCFullYear(),
    nextMonday.getUTCMonth() + 1,
    nextMonday.getUTCDate(),
    0,
    0,
    0,
    QUOTA_TIMEZONE
  );

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    weekStartDate: `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`,
  };
};

const getAssignedAgentFromActivity = (activity: any, agentIds: Set<string>) => {
  const metadata = activity?.metadata || {};
  const assignedTo = metadata.assignedTo || metadata.assigned_to || metadata.assignedUserId || metadata.assigned_user_id;

  if (assignedTo && agentIds.has(assignedTo)) {
    return assignedTo;
  }

  const description = String(activity?.action_description || '').toLowerCase();
  if (activity?.done_by_id && agentIds.has(activity.done_by_id) && description.includes('claimed')) {
    return activity.done_by_id;
  }

  return null;
};

const transformQuotaAdjustment = (row: any): AgentQuotaAdjustment => ({
  id: row.id,
  agentId: row.agent_id,
  scope: row.scope,
  actionType: row.action_type,
  effectiveDate: row.effective_date,
  weekStartDate: row.week_start_date,
  usageOffset: Number(row.usage_offset || 0),
  allowanceBonus: Number(row.allowance_bonus || 0),
  reason: row.reason || '',
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  metadata: row.metadata || {},
});

const isMissingAdjustmentsTable = (error: any) =>
  error?.code === '42P01' || String(error?.message || '').includes('agent_quota_adjustments');

const isAdjustmentsAccessBlocked = (error: any) =>
  error?.code === '42501' || String(error?.message || '').toLowerCase().includes('row-level security');

const quotaAdjustmentAccessError = () =>
  new Error('Quota reset access is blocked by database security policies. Please apply the agent quota adjustments RLS policy SQL and retry.');

const sumAdjustments = (rows: any[]) => rows.reduce(
  (acc, row) => {
    acc.usageOffset += Number(row.usage_offset || 0);
    acc.allowanceBonus += Number(row.allowance_bonus || 0);
    return acc;
  },
  { usageOffset: 0, allowanceBonus: 0 }
);

const transformQuotaOverviewRow = (row: any): AgentQuotaOverviewRow => ({
  agentId: row.agent_id,
  agentName: row.agent_name,
  agentEmail: row.agent_email,
  dailyQuota: Number(row.daily_quota || 0),
  weeklyQuota: Number(row.weekly_quota || 0),
  assignedTodayRaw: Number(row.assigned_today_raw || 0),
  assignedWeekRaw: Number(row.assigned_week_raw || 0),
  dailyAdjustmentTotal: Number(row.daily_adjustment_total || 0),
  weeklyAdjustmentTotal: Number(row.weekly_adjustment_total || 0),
  dailyAllowanceBonus: Number(row.daily_allowance_bonus || 0),
  weeklyAllowanceBonus: Number(row.weekly_allowance_bonus || 0),
  assignedTodayEffective: Number(row.assigned_today_effective || 0),
  assignedWeekEffective: Number(row.assigned_week_effective || 0),
  dailyEffectiveQuota: Number(row.daily_effective_quota || 0),
  weeklyEffectiveQuota: Number(row.weekly_effective_quota || 0),
  remainingToday: Number(row.remaining_today || 0),
  remainingWeek: Number(row.remaining_week || 0),
  quotaReachedToday: !!row.quota_reached_today,
  quotaReachedWeek: !!row.quota_reached_week,
  activeLeadsCount: Number(row.active_leads_count || 0),
  timezoneUsed: row.timezone_used || QUOTA_TIMEZONE,
  dayStart: row.day_start,
  dayEnd: row.day_end,
  weekStart: row.week_start,
  weekEnd: row.week_end,
});

export async function fetchAgentQuotaOverview(date = new Date()): Promise<AgentQuotaOverviewRow[]> {
  const { data, error } = await supabase.rpc('get_agent_quota_overview', {
    p_date: date.toISOString(),
    p_timezone: QUOTA_TIMEZONE,
  });

  if (error) {
    console.error('Error fetching agent quota overview:', error);
    throw error;
  }

  return (data || []).map(transformQuotaOverviewRow);
}

async function fetchQuotaAdjustmentsForRanges(
  agentIds: string[],
  dayDate: string,
  weekStartDate: string
) {
  if (agentIds.length === 0) {
    return { daily: new Map<string, any[]>(), weekly: new Map<string, any[]>() };
  }

  const [dailyResult, weeklyResult] = await Promise.all([
    supabase
      .from('agent_quota_adjustments')
      .select('*')
      .in('agent_id', agentIds)
      .eq('scope', 'daily')
      .eq('effective_date', dayDate),
    supabase
      .from('agent_quota_adjustments')
      .select('*')
      .in('agent_id', agentIds)
      .eq('scope', 'weekly')
      .eq('week_start_date', weekStartDate),
  ]);

  if (dailyResult.error || weeklyResult.error) {
    const error = dailyResult.error || weeklyResult.error;
    if (isMissingAdjustmentsTable(error)) {
      console.warn('agent_quota_adjustments table is not available yet; quota resets/allowances will be ignored until the migration is applied.');
      return { daily: new Map<string, any[]>(), weekly: new Map<string, any[]>() };
    }
    if (isAdjustmentsAccessBlocked(error)) {
      console.warn('agent_quota_adjustments RLS policies are not available yet; quota resets/allowances will be ignored until the policy SQL is applied.');
      return { daily: new Map<string, any[]>(), weekly: new Map<string, any[]>() };
    }
    throw error;
  }

  const daily = new Map<string, any[]>();
  const weekly = new Map<string, any[]>();

  for (const row of dailyResult.data || []) {
    const rows = daily.get(row.agent_id) || [];
    rows.push(row);
    daily.set(row.agent_id, rows);
  }

  for (const row of weeklyResult.data || []) {
    const rows = weekly.get(row.agent_id) || [];
    rows.push(row);
    weekly.set(row.agent_id, rows);
  }

  return { daily, weekly };
}

export async function getAgentsDailyQuotaUsage(agentIds: string[], date = new Date()): Promise<Record<string, AgentQuotaUsage>> {
  const uniqueAgentIds = Array.from(new Set(agentIds.filter(Boolean)));
  const dayRange = getUkDayRange(date);
  const weekRange = getUkWeekRange(date);

  if (uniqueAgentIds.length === 0) {
    return {};
  }

  let { data: agents, error: agentError } = await supabase
    .from('users')
    .select('id, daily_quota, weekly_quota')
    .in('id', uniqueAgentIds);

  if (agentError && String(agentError.message || '').includes('weekly_quota')) {
    console.warn('weekly_quota column is not available yet; falling back to daily_quota * 7 until the migration is applied.');
    const retry = await supabase
      .from('users')
      .select('id, daily_quota')
      .in('id', uniqueAgentIds);
    agents = retry.data as typeof agents;
    agentError = retry.error;
  }

  if (agentError) {
    console.error('Error fetching agent quotas:', agentError);
    throw agentError;
  }

  const agentQuotaMap = new Map((agents || []).map((agent: any) => [agent.id, agent]));
  const agentIdSet = new Set(uniqueAgentIds);

  const { data: activities, error: activityError } = await supabase
    .from('activity_log')
    .select('lead_id, entity_id, done_by_id, metadata, action_description, created_at')
    .eq('activity_type', 'lead_assigned')
    .gte('created_at', weekRange.startIso)
    .lt('created_at', weekRange.endIso)
    .order('created_at', { ascending: true });

  if (activityError) {
    console.error('Error fetching quota assignment activity:', activityError);
    throw activityError;
  }

  const assignments: Array<{ leadId: string; agentId: string; createdAt: string }> = [];
  const candidateLeadIds = new Set<string>();

  for (const activity of activities || []) {
    const agentId = getAssignedAgentFromActivity(activity, agentIdSet);
    const leadId = activity.lead_id || activity.entity_id;
    if (!agentId || !leadId) continue;

    assignments.push({ leadId, agentId, createdAt: activity.created_at });
    candidateLeadIds.add(leadId);
  }

  const dailyLeadIdsByAgent = new Map(uniqueAgentIds.map(agentId => [agentId, new Set<string>()]));
  const weeklyLeadIdsByAgent = new Map(uniqueAgentIds.map(agentId => [agentId, new Set<string>()]));
  const candidateIds = Array.from(candidateLeadIds);

  if (candidateIds.length > 0) {
    const { data: currentLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, assigned_to')
      .in('id', candidateIds)
      .not('is_funnel_archived', 'is', true);

    if (leadsError) {
      console.error('Error fetching current lead assignments for quota:', leadsError);
      throw leadsError;
    }

    const currentAssignmentByLead = new Map((currentLeads || []).map((lead: any) => [lead.id, lead.assigned_to]));

    for (const assignment of assignments) {
      if (currentAssignmentByLead.get(assignment.leadId) !== assignment.agentId) continue;

      weeklyLeadIdsByAgent.get(assignment.agentId)?.add(assignment.leadId);
      if (assignment.createdAt >= dayRange.startIso && assignment.createdAt < dayRange.endIso) {
        dailyLeadIdsByAgent.get(assignment.agentId)?.add(assignment.leadId);
      }
    }
  }

  const adjustments = await fetchQuotaAdjustmentsForRanges(
    uniqueAgentIds,
    dayRange.date,
    weekRange.weekStartDate
  );

  return Object.fromEntries(uniqueAgentIds.map(agentId => {
    const agent = agentQuotaMap.get(agentId) as any;
    const dailyQuota = agent?.daily_quota ?? DEFAULT_DAILY_QUOTA;
    const weeklyQuota = agent?.weekly_quota ?? dailyQuota * 7;
    const rawAssignedToday = dailyLeadIdsByAgent.get(agentId)?.size || 0;
    const rawAssignedThisWeek = weeklyLeadIdsByAgent.get(agentId)?.size || 0;
    const dailyAdjustment = sumAdjustments(adjustments.daily.get(agentId) || []);
    const weeklyAdjustment = sumAdjustments(adjustments.weekly.get(agentId) || []);
    const dailyEffectiveQuota = Math.max(0, dailyQuota + dailyAdjustment.allowanceBonus);
    const weeklyEffectiveQuota = Math.max(0, weeklyQuota + weeklyAdjustment.allowanceBonus);
    const assignedToday = Math.max(0, rawAssignedToday + dailyAdjustment.usageOffset);
    const assignedThisWeek = Math.max(0, rawAssignedThisWeek + weeklyAdjustment.usageOffset);
    const hasAdjustments =
      dailyAdjustment.usageOffset !== 0 ||
      dailyAdjustment.allowanceBonus !== 0 ||
      weeklyAdjustment.usageOffset !== 0 ||
      weeklyAdjustment.allowanceBonus !== 0;
    return [agentId, {
      agentId,
      date: dayRange.date,
      assignedToday,
      dailyQuota,
      assignedThisWeek,
      weeklyQuota,
      rawAssignedToday,
      rawAssignedThisWeek,
      dailyUsageAdjustment: dailyAdjustment.usageOffset,
      weeklyUsageAdjustment: weeklyAdjustment.usageOffset,
      dailyAllowanceBonus: dailyAdjustment.allowanceBonus,
      weeklyAllowanceBonus: weeklyAdjustment.allowanceBonus,
      dailyEffectiveQuota,
      weeklyEffectiveQuota,
      hasAdjustments,
      remaining: Math.max(0, dailyEffectiveQuota - assignedToday),
      weeklyRemaining: Math.max(0, weeklyEffectiveQuota - assignedThisWeek),
      quotaReached: assignedToday >= dailyEffectiveQuota,
      weeklyQuotaReached: assignedThisWeek >= weeklyEffectiveQuota,
      resetTimezone: QUOTA_TIMEZONE,
      rangeStart: dayRange.startIso,
      rangeEnd: dayRange.endIso,
      weekRangeStart: weekRange.startIso,
      weekRangeEnd: weekRange.endIso,
    }];
  }));
}

export async function getAgentDailyQuotaUsage(agentId: string, date = new Date()): Promise<AgentQuotaUsage> {
  const usageByAgent = await getAgentsDailyQuotaUsage([agentId], date);
  return usageByAgent[agentId] || {
    agentId,
    date: getUkDayRange(date).date,
    assignedToday: 0,
    dailyQuota: DEFAULT_DAILY_QUOTA,
    assignedThisWeek: 0,
    weeklyQuota: DEFAULT_DAILY_QUOTA * 7,
    rawAssignedToday: 0,
    rawAssignedThisWeek: 0,
    dailyUsageAdjustment: 0,
    weeklyUsageAdjustment: 0,
    dailyAllowanceBonus: 0,
    weeklyAllowanceBonus: 0,
    dailyEffectiveQuota: DEFAULT_DAILY_QUOTA,
    weeklyEffectiveQuota: DEFAULT_DAILY_QUOTA * 7,
    hasAdjustments: false,
    remaining: DEFAULT_DAILY_QUOTA,
    weeklyRemaining: DEFAULT_DAILY_QUOTA * 7,
    quotaReached: false,
    weeklyQuotaReached: false,
    resetTimezone: QUOTA_TIMEZONE,
    rangeStart: getUkDayRange(date).startIso,
    rangeEnd: getUkDayRange(date).endIso,
    weekRangeStart: getUkWeekRange(date).startIso,
    weekRangeEnd: getUkWeekRange(date).endIso,
  };
}

/**
 * Check if agent can claim a lead (within daily quota)
 */
export async function canAgentClaimLead(agentId: string): Promise<{ canClaim: boolean; reason?: string; assignedToday: number; quota: number }> {
  try {
    const usage = await getAgentDailyQuotaUsage(agentId);
    const assignedToday = usage.assignedToday;
    const dailyQuota = usage.dailyEffectiveQuota ?? usage.dailyQuota;
    const assignedThisWeek = usage.assignedThisWeek;
    const weeklyQuota = usage.weeklyEffectiveQuota ?? usage.weeklyQuota ?? dailyQuota * 7;

    if (assignedToday >= dailyQuota) {
      return {
        canClaim: false,
        reason: `Daily quota reached: ${assignedToday}/${dailyQuota} leads assigned today. Resets at UK midnight.`,
        assignedToday,
        quota: dailyQuota
      };
    }

    if (assignedThisWeek >= weeklyQuota) {
      return {
        canClaim: false,
        reason: `Weekly quota reached: ${assignedThisWeek}/${weeklyQuota} leads assigned this week. Resets Monday UK time.`,
        assignedToday,
        quota: dailyQuota
      };
    }

    return {
      canClaim: true,
      assignedToday,
      quota: dailyQuota
    };
  } catch (error) {
    console.error('Error in canAgentClaimLead:', error);
    return { canClaim: false, reason: 'Unknown error', assignedToday: 0, quota: 0 };
  }
}

export async function canAgentReceiveLead(
  agentId: string,
  additionalLeadCount = 1
): Promise<{ canReceive: boolean; reason?: string; assignedToday: number; quota: number; remaining: number; assignedThisWeek?: number; weeklyQuota?: number; weeklyRemaining?: number }> {
  try {
    const usage = await getAgentDailyQuotaUsage(agentId);
    const incomingCount = Math.max(1, additionalLeadCount);
    const wouldBeAssignedToday = usage.assignedToday + incomingCount;
    const wouldBeAssignedThisWeek = usage.assignedThisWeek + incomingCount;
    const dailyQuota = usage.dailyEffectiveQuota ?? usage.dailyQuota;
    const weeklyQuota = usage.weeklyEffectiveQuota ?? usage.weeklyQuota ?? DEFAULT_DAILY_QUOTA * 7;

    if (wouldBeAssignedToday > dailyQuota) {
      return {
        canReceive: false,
        reason: `Daily quota would be exceeded: ${usage.assignedToday}/${dailyQuota} leads assigned today, ${usage.remaining} remaining. Resets at UK midnight.`,
        assignedToday: usage.assignedToday,
        quota: dailyQuota,
        remaining: usage.remaining,
        assignedThisWeek: usage.assignedThisWeek,
        weeklyQuota,
        weeklyRemaining: usage.weeklyRemaining,
      };
    }

    if (wouldBeAssignedThisWeek > weeklyQuota) {
      return {
        canReceive: false,
        reason: `Weekly quota would be exceeded: ${usage.assignedThisWeek}/${weeklyQuota} leads assigned this week, ${usage.weeklyRemaining} remaining. Resets Monday UK time.`,
        assignedToday: usage.assignedToday,
        quota: dailyQuota,
        remaining: usage.remaining,
        assignedThisWeek: usage.assignedThisWeek,
        weeklyQuota,
        weeklyRemaining: usage.weeklyRemaining,
      };
    }

    return {
      canReceive: true,
      assignedToday: usage.assignedToday,
      quota: dailyQuota,
      remaining: usage.remaining,
      assignedThisWeek: usage.assignedThisWeek,
      weeklyQuota,
      weeklyRemaining: usage.weeklyRemaining,
    };
  } catch (error) {
    console.error('Error in canAgentReceiveLead:', error);
    return {
      canReceive: false,
      reason: 'Unable to verify agent quota. Please try again.',
      assignedToday: 0,
      quota: 0,
      remaining: 0,
      assignedThisWeek: 0,
      weeklyQuota: 0,
      weeklyRemaining: 0,
    };
  }
}

export async function fetchAgentQuotaAdjustmentHistory(
  agentId: string,
  limit = 20
): Promise<AgentQuotaAdjustment[]> {
  const { data, error } = await supabase
    .from('agent_quota_adjustments')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingAdjustmentsTable(error)) {
      return [];
    }
    if (isAdjustmentsAccessBlocked(error)) {
      throw quotaAdjustmentAccessError();
    }
    throw error;
  }

  return (data || []).map(transformQuotaAdjustment);
}

export async function resetAgentQuotaUsage(params: {
  agentId: string;
  scopes: QuotaAdjustmentScope[];
  reason: string;
  actorId?: string;
  actorName?: string;
}): Promise<AgentQuotaAdjustment[]> {
  const reason = params.reason.trim();
  if (!reason) {
    throw new Error('A reset reason is required.');
  }

  const scopes = Array.from(new Set(params.scopes));
  if (scopes.length === 0) {
    throw new Error('Choose at least one quota period to reset.');
  }

  const usage = await getAgentDailyQuotaUsage(params.agentId);
  const weekRange = getUkWeekRange();
  const rows = scopes.map(scope => {
    const isDaily = scope === 'daily';
    const usageOffset = isDaily ? -Math.max(0, usage.assignedToday) : -Math.max(0, usage.assignedThisWeek || 0);
    return {
      agent_id: params.agentId,
      scope,
      action_type: 'reset_to_zero',
      effective_date: isDaily ? usage.date : null,
      week_start_date: isDaily ? null : weekRange.weekStartDate,
      usage_offset: usageOffset,
      allowance_bonus: 0,
      reason,
      created_by: params.actorId || null,
      created_by_name: params.actorName || null,
      metadata: {
        rawAssignedToday: usage.rawAssignedToday,
        rawAssignedThisWeek: usage.rawAssignedThisWeek,
        effectiveAssignedTodayBeforeReset: usage.assignedToday,
        effectiveAssignedThisWeekBeforeReset: usage.assignedThisWeek,
        dailyQuota: usage.dailyQuota,
        weeklyQuota: usage.weeklyQuota,
        dailyEffectiveQuota: usage.dailyEffectiveQuota,
        weeklyEffectiveQuota: usage.weeklyEffectiveQuota,
        resetTimezone: usage.resetTimezone,
      },
    };
  });

  const { data, error } = await supabase
    .from('agent_quota_adjustments')
    .insert(rows)
    .select('*');

  if (error) {
    if (isMissingAdjustmentsTable(error)) {
      throw new Error('Quota reset table is not available yet. Please apply the agent quota adjustments SQL migration and retry.');
    }
    if (isAdjustmentsAccessBlocked(error)) {
      throw quotaAdjustmentAccessError();
    }
    throw error;
  }

  return (data || []).map(transformQuotaAdjustment);
}

export async function addAgentQuotaAllowance(params: {
  agentId: string;
  scope: QuotaAdjustmentScope;
  amount: number;
  reason: string;
  actorId?: string;
  actorName?: string;
}): Promise<AgentQuotaAdjustment> {
  const reason = params.reason.trim();
  const amount = Math.floor(Number(params.amount || 0));
  if (!reason) {
    throw new Error('An allowance reason is required.');
  }
  if (amount <= 0) {
    throw new Error('Allowance must be at least 1 lead.');
  }

  const dayRange = getUkDayRange();
  const weekRange = getUkWeekRange();
  const isDaily = params.scope === 'daily';

  const { data, error } = await supabase
    .from('agent_quota_adjustments')
    .insert({
      agent_id: params.agentId,
      scope: params.scope,
      action_type: 'extra_allowance',
      effective_date: isDaily ? dayRange.date : null,
      week_start_date: isDaily ? null : weekRange.weekStartDate,
      usage_offset: 0,
      allowance_bonus: amount,
      reason,
      created_by: params.actorId || null,
      created_by_name: params.actorName || null,
      metadata: {
        resetTimezone: QUOTA_TIMEZONE,
      },
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingAdjustmentsTable(error)) {
      throw new Error('Quota reset table is not available yet. Please apply the agent quota adjustments SQL migration and retry.');
    }
    if (isAdjustmentsAccessBlocked(error)) {
      throw quotaAdjustmentAccessError();
    }
    throw error;
  }

  return transformQuotaAdjustment(data);
}

/**
 * Get agent's quota status
 */
export async function getAgentQuotaStatus(agentId: string): Promise<DailyQuota> {
  try {
    return await getAgentDailyQuotaUsage(agentId);
  } catch (error) {
    console.error('Error in getAgentQuotaStatus:', error);
    return {
      agentId,
      date: getUkDayRange().date,
      assignedToday: 0,
      dailyQuota: DEFAULT_DAILY_QUOTA,
      assignedThisWeek: 0,
      weeklyQuota: DEFAULT_DAILY_QUOTA * 7,
      rawAssignedToday: 0,
      rawAssignedThisWeek: 0,
      dailyUsageAdjustment: 0,
      weeklyUsageAdjustment: 0,
      dailyAllowanceBonus: 0,
      weeklyAllowanceBonus: 0,
      dailyEffectiveQuota: DEFAULT_DAILY_QUOTA,
      weeklyEffectiveQuota: DEFAULT_DAILY_QUOTA * 7,
      hasAdjustments: false,
      remaining: DEFAULT_DAILY_QUOTA,
      weeklyRemaining: DEFAULT_DAILY_QUOTA * 7,
      quotaReached: false,
      weeklyQuotaReached: false,
      resetTimezone: QUOTA_TIMEZONE,
      rangeStart: getUkDayRange().startIso,
      rangeEnd: getUkDayRange().endIso,
      weekRangeStart: getUkWeekRange().startIso,
      weekRangeEnd: getUkWeekRange().endIso,
    };
  }
}
