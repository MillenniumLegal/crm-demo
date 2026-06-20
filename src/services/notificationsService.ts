import { supabase } from '@/lib/supabase';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}

const toISOUTC = (date: Date) => date.toISOString();
const hoursAgoIso = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return toISOUTC(d);
};
const daysAgoIso = (days: number) => hoursAgoIso(days * 24);
const ACTIVE_LEAD_STATUSES = '("Sold","Closed","Archived")';

export async function fetchNotificationsForUser(
  userId: string,
  role: 'Admin' | 'Manager' | 'Agent'
): Promise<NotificationItem[]> {
  try {
    const notifications: NotificationItem[] = [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Agent-specific notifications
    if (role === 'Agent') {
      // Overdue tasks
      const { data: overdueTasks, error: overdueError } = await supabase
        .from('diary_tasks')
        .select(
          `
            id,
            title,
            due_date,
            status,
            lead_id,
            leads:leads!diary_tasks_lead_id_fkey ( name )
          `
        )
        .eq('assigned_to', userId)
        .neq('status', 'Completed')
        .lt('due_date', toISOUTC(now))
        .order('due_date', { ascending: true })
        .limit(5);

      if (!overdueError && overdueTasks) {
        overdueTasks.forEach((task) => {
          notifications.push({
            id: `task-overdue-${task.id}`,
            title: 'Task overdue',
            severity: 'critical',
            createdAt: task.due_date || toISOUTC(now),
            message: `${task.title || 'Task'} for ${(Array.isArray(task.leads) ? task.leads[0]?.name : (task.leads as { name?: string } | null)?.name) || 'a lead'} is overdue. Please follow up.`,
            actionUrl: task.lead_id ? `/lead-management?leadId=${task.lead_id}` : undefined,
            actionLabel: 'View lead'
          });
        });
      }

      // Tasks due soon (next 2 hours)
      const soon = new Date(now);
      soon.setHours(soon.getHours() + 2);
      const { data: upcomingTasks, error: upcomingError } = await supabase
        .from('diary_tasks')
        .select(
          `
            id,
            title,
            due_date,
            status,
            lead_id,
            leads:leads!diary_tasks_lead_id_fkey ( name )
          `
        )
        .eq('assigned_to', userId)
        .neq('status', 'Completed')
        .gte('due_date', toISOUTC(now))
        .lte('due_date', toISOUTC(soon))
        .order('due_date', { ascending: true })
        .limit(5);

      if (!upcomingError && upcomingTasks) {
        upcomingTasks.forEach((task) => {
          notifications.push({
            id: `task-upcoming-${task.id}`,
            title: 'Task due soon',
            severity: 'warning',
            createdAt: task.due_date || toISOUTC(now),
            message: `${task.title || 'Task'} for ${(Array.isArray(task.leads) ? task.leads[0]?.name : (task.leads as { name?: string } | null)?.name) || 'a lead'} is due within the next 2 hours.`,
            actionUrl: task.lead_id ? `/lead-management?leadId=${task.lead_id}` : undefined,
            actionLabel: 'View lead'
          });
        });
      }

      // New lead assignments
      const { data: assignedLeads, error: assignedError } = await supabase
        .from('activity_log')
        .select('id, entity_id, lead_name, done_by_name, created_at')
        .eq('activity_type', 'lead_assigned')
        .contains('metadata', { assignedTo: userId })
        .gte('created_at', daysAgoIso(7))
        .order('created_at', { ascending: false })
        .limit(10);

      if (!assignedError && assignedLeads) {
        assignedLeads.forEach((entry) => {
          notifications.push({
            id: `lead-assigned-${entry.id}`,
            title: 'Lead assigned to you',
            severity: 'info',
            createdAt: entry.created_at,
            message: `${entry.done_by_name || 'System'} assigned ${entry.lead_name || 'a lead'} to you.`,
            actionUrl: entry.entity_id ? `/lead-management?leadId=${entry.entity_id}` : undefined,
            actionLabel: 'Open lead'
          });
        });
      }

      // Quote acceptances on the agent's OWN leads — read-derived from the single
      // quote_accepted activity row. Surfaces naturally once an agent claims a lead
      // that was accepted while unassigned (assigned_to now matches them). Tolerates
      // the quote_accepted_at column being absent (returns no rows pre-migration).
      const { data: myAcceptedLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', userId)
        .not('quote_accepted_at', 'is', null)
        .gte('quote_accepted_at', daysAgoIso(7));
      const myAcceptedLeadIds = (myAcceptedLeads || []).map((l: any) => l.id);
      if (myAcceptedLeadIds.length > 0) {
        const { data: myAcceptedActivity } = await supabase
          .from('activity_log')
          .select('id, lead_id, lead_name, created_at')
          .eq('activity_type', 'quote_accepted')
          .in('lead_id', myAcceptedLeadIds)
          .order('created_at', { ascending: false })
          .limit(10);
        (myAcceptedActivity || []).forEach((entry: any) => {
          notifications.push({
            id: `quote-accepted-${entry.id}`,
            title: 'Quote accepted',
            severity: 'info',
            createdAt: entry.created_at,
            message: `${entry.lead_name || 'Your lead'} accepted their quote — action it.`,
            actionUrl: entry.lead_id ? `/lead-management?leadId=${entry.lead_id}` : undefined,
            actionLabel: 'Open lead'
          });
        });
      }
    }

    // Manager/Admin notifications
    if (role === 'Manager' || role === 'Admin') {
      // Unassigned leads summary (count only, then fetch latest for timestamp)
      const { count: unassignedCount, error: unassignedError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .is('assigned_to', null)
        .gte('created_at', toISOUTC(startOfToday));

      if (!unassignedError && unassignedCount && unassignedCount > 0) {
        const { data: latestUnassigned } = await supabase
          .from('leads')
          .select('created_at')
          .is('assigned_to', null)
          .gte('created_at', toISOUTC(startOfToday))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        notifications.push({
          id: 'unassigned-leads',
          title: 'Unassigned leads waiting',
          severity: 'warning',
          createdAt: latestUnassigned?.created_at || toISOUTC(now),
          message: `There ${unassignedCount === 1 ? 'is' : 'are'} ${unassignedCount} new unassigned lead${unassignedCount === 1 ? '' : 's'} awaiting assignment.`,
          actionUrl: '/lead-management?filter=unassigned',
          actionLabel: 'Review leads'
        });
      }

      // Team overdue tasks summary
      const overdueWindowStart = daysAgoIso(30);
      const baseTeamOverdueQuery = supabase
        .from('diary_tasks')
        .select('id, leads!inner(status)', { count: 'exact', head: true })
        .neq('status', 'Completed')
        .lt('due_date', toISOUTC(now))
        .gte('due_date', overdueWindowStart)
        .not('leads.status', 'in', ACTIVE_LEAD_STATUSES);

      const { count: teamOverdueCount, error: teamOverdueError } = await baseTeamOverdueQuery;

      if (!teamOverdueError && teamOverdueCount && teamOverdueCount > 0) {
        const { data: oldestOverdue } = await supabase
          .from('diary_tasks')
          .select('due_date, leads!inner(status)')
          .neq('status', 'Completed')
          .lt('due_date', toISOUTC(now))
          .gte('due_date', overdueWindowStart)
          .not('leads.status', 'in', ACTIVE_LEAD_STATUSES)
          .order('due_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        notifications.push({
          id: 'team-overdue-tasks',
          title: 'Team tasks overdue',
          severity: 'critical',
          createdAt: oldestOverdue?.due_date || toISOUTC(now),
          message: `There ${teamOverdueCount === 1 ? 'is' : 'are'} ${teamOverdueCount} overdue task${teamOverdueCount === 1 ? '' : 's'} across the team that need attention.`,
          actionUrl: '/diary',
          actionLabel: 'View tasks'
        });
      }

      // Quote acceptances across the team (last 3 days) — managers/admins see ALL,
      // including leads accepted while still unassigned. Read-derived from the single
      // quote_accepted activity row, so one notification per accepted quote.
      const { data: acceptedQuotes } = await supabase
        .from('activity_log')
        .select('id, lead_id, lead_name, created_at')
        .eq('activity_type', 'quote_accepted')
        .gte('created_at', daysAgoIso(3))
        .order('created_at', { ascending: false })
        .limit(15);
      (acceptedQuotes || []).forEach((entry: any) => {
        notifications.push({
          id: `quote-accepted-${entry.id}`,
          title: 'Quote accepted',
          severity: 'info',
          createdAt: entry.created_at,
          message: `${entry.lead_name || 'A lead'} accepted their quote.`,
          actionUrl: entry.lead_id ? `/lead-management?leadId=${entry.lead_id}` : undefined,
          actionLabel: 'Open lead'
        });
      });
    }

    // Sort notifications by createdAt desc
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [
      {
        id: 'notifications-error',
        title: 'Unable to load notifications',
        message: 'We could not fetch notifications at this time.',
        severity: 'warning',
        createdAt: new Date().toISOString()
      }
    ];
  }
}

