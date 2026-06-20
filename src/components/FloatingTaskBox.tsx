import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  UserCheck,
  X,
} from 'lucide-react';

import { AssignLeadModal } from '@/components/AssignLeadModal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchLeadsByIds } from '@/services/leadsService';
import { completeTask, updateTask } from '@/services/tasksService';
import { DiaryTask, Lead } from '@/types';

type ActionCenterTab = 'primary' | 'secondary' | 'attention';
type ActionItemType = 'task' | 'dropped_lead' | 'needs_schedule' | 'stale_lead' | 'callback' | 'instruction_request';

interface ActionItem {
  id: string;
  type: ActionItemType;
  lead: Lead;
  task?: DiaryTask;
  title: string;
  detail: string;
  assignedUser?: string;
  dueLabel?: string;
  chipLabel: string;
  chipClassName: string;
  priorityRank: number;
}

interface ActionCenterData {
  primary: ActionItem[];
  secondary: ActionItem[];
  needsAttention: ActionItem[];
}

const LIMIT_PER_SECTION = 20;
const FETCH_BUFFER = 80;
const STALE_HOURS = 24;
const ACTIVE_TASK_STATUSES = ['Pending', 'In Progress'];
const DB_INACTIVE_STATUS_LIST = '("Sold","Closed","Archived")';
const INACTIVE_LEAD_VALUES = new Set([
  'closed',
  'sold',
  'archived',
  'cancelled',
  'canceled',
  'dead',
  'lost',
  'not proceeding',
  'completed',
  'instructed',
]);
const FIRST_CONTACT_VALUES = new Set(['call-1', 'call 1', 'call1', 'first-call', 'first call']);
const EARLY_STAGE_VALUES = new Set(['new', 'assigned', ...FIRST_CONTACT_VALUES]);

const emitActionCenterUpdated = (detail: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('action-center:updated', { detail }));
  }
};

const getToday = () => new Date().toISOString().split('T')[0];
const getTimeNow = () => new Date().toTimeString().slice(0, 5);

const getDateKey = (value?: string | null) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

const normalizeTime = (value?: string | null) => (value ? value.slice(0, 5) : '');
const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

const hoursSince = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60));
};

const isInactiveLead = (lead: Pick<Lead, 'status' | 'stage'>) =>
  INACTIVE_LEAD_VALUES.has(normalizeText(lead.status)) ||
  INACTIVE_LEAD_VALUES.has(normalizeText(lead.stage));

const isFirstContactLead = (lead: Pick<Lead, 'status' | 'stage'>) =>
  FIRST_CONTACT_VALUES.has(normalizeText(lead.stage)) ||
  FIRST_CONTACT_VALUES.has(normalizeText(lead.status));

const isEarlyAssignedLead = (lead: Pick<Lead, 'status' | 'stage'>) =>
  EARLY_STAGE_VALUES.has(normalizeText(lead.stage)) ||
  EARLY_STAGE_VALUES.has(normalizeText(lead.status));

const isTaskPending = (task?: DiaryTask) => !!task && ACTIVE_TASK_STATUSES.includes(task.status);

const isTaskOverdue = (task: DiaryTask) => {
  if (!isTaskPending(task)) return false;
  const dueDate = getDateKey(task.dueDate);
  if (!dueDate) return false;
  const today = getToday();
  if (dueDate < today) return true;
  if (dueDate > today) return false;
  const dueTime = normalizeTime(task.dueTime);
  return !!dueTime && dueTime < getTimeNow();
};

const isTaskDueToday = (task: DiaryTask) => {
  if (!isTaskPending(task)) return false;
  if (getDateKey(task.dueDate) !== getToday()) return false;
  return !isTaskOverdue(task);
};

const isTaskUpcoming = (task: DiaryTask) => {
  if (!isTaskPending(task)) return false;
  const dueDate = getDateKey(task.dueDate);
  if (!dueDate) return false;
  if (dueDate > getToday()) return true;
  return dueDate === getToday() && !isTaskOverdue(task) && !isTaskDueToday(task);
};

const formatDueLabel = (task: DiaryTask) => {
  const dueDate = getDateKey(task.dueDate);
  const time = normalizeTime(task.dueTime);
  if (dueDate === getToday()) return time ? `Today ${time}` : 'Today';
  return time ? `${dueDate} ${time}` : dueDate;
};

const formatAge = (createdAt?: string) => {
  if (!createdAt) return '';
  const hours = Math.floor(hoursSince(createdAt));
  if (hours < 24) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
};

const leadFromRow = (row: any): Lead => ({
  id: row.id,
  shortCode: row.short_code || undefined,
  name: row.name || 'Unnamed Lead',
  email: row.email || '',
  phone: row.phone || '',
  source: row.source || 'Direct',
  assignedTo: row.assigned_to || undefined,
  status: row.status || 'New',
  stage: row.stage || 'New',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  contactAttempts: 0,
  maxAttempts: 5,
  priority: row.priority || 'Medium',
});

const taskFromRow = (row: any): DiaryTask => ({
  id: row.id,
  leadId: row.lead_id,
  leadName: row.leads?.name || 'Unnamed Lead',
  assignedTo: row.assigned_to || undefined,
  taskType: row.task_type || 'Follow-up',
  title: row.title || row.task_type || 'Follow-up',
  description: row.description || undefined,
  dueDate: getDateKey(row.due_date),
  dueTime: normalizeTime(row.due_time) || undefined,
  priority: row.priority || 'Medium',
  status: row.status || 'Pending',
  completedAt: row.completed_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  leadStatus: row.leads?.status || undefined,
  leadStage: row.leads?.stage || undefined,
});

const getLeadProgressStatus = (lead: Lead, task?: DiaryTask) => {
  if (task && isTaskOverdue(task)) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-800' };
  }

  if (task && isTaskDueToday(task)) {
    return { label: task.status === 'In Progress' ? 'In Progress' : 'Due today', className: task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800' };
  }

  if (task && isTaskPending(task)) {
    return { label: task.status === 'In Progress' ? 'In Progress' : 'Scheduled', className: task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-sky-100 text-sky-800' };
  }

  const status = normalizeText(lead.status);

  if (isFirstContactLead(lead)) {
    return { label: 'Started', className: 'bg-yellow-100 text-yellow-800' };
  }

  if (status === 'assigned' || !!lead.assignedTo) {
    return { label: 'Assigned', className: 'bg-purple-100 text-purple-800' };
  }

  if (!lead.assignedTo) {
    return { label: 'Unassigned', className: 'bg-amber-100 text-amber-800' };
  }

  return { label: 'Needs task', className: 'bg-slate-100 text-slate-700' };
};

const getActionReason = (lead: Lead, task?: DiaryTask) => {
  if (task && isTaskOverdue(task)) return `${task.taskType} task is overdue`;
  if (task && isTaskDueToday(task)) return `${task.taskType} due today`;
  if (task && isTaskUpcoming(task)) return `${task.taskType} scheduled next`;
  if (!lead.assignedTo) return 'Unassigned lead needs ownership';
  if (isFirstContactLead(lead)) return 'Needs first contact';
  if (hoursSince(lead.updatedAt || lead.createdAt) >= STALE_HOURS) return 'Assigned lead has not moved recently';
  return 'Assigned lead needs a next task';
};

const getActionPriority = (lead: Lead, task?: DiaryTask) => {
  if (task && isTaskOverdue(task)) return 0;
  if (!lead.assignedTo) return 1;
  if (task && isTaskDueToday(task)) return 2;
  if (hoursSince(lead.updatedAt || lead.createdAt) >= STALE_HOURS) return 3;
  if (!task) return 4;
  return 5;
};

export function FloatingTaskBox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActionCenterTab>('primary');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ActionCenterData>({ primary: [], secondary: [], needsAttention: [] });
  const [agentsMap, setAgentsMap] = useState<Map<string, string>>(new Map());
  const [leadToAssign, setLeadToAssign] = useState<Lead | null>(null);
  const [assignToast, setAssignToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAgent = user?.role === 'Agent';
  const isManagerView = user?.role === 'Manager' || user?.role === 'Admin';
  const totalCount = data.primary.length + data.secondary.length + data.needsAttention.length;

  useEffect(() => {
    if (!assignToast) return;
    const timeout = setTimeout(() => setAssignToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [assignToast]);

  useEffect(() => {
    const loadAgents = async () => {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['Agent', 'Manager', 'Admin']);

      if (error) {
        console.error('Error loading Action Center agents:', error);
        return;
      }

      setAgentsMap(new Map((users || []).map((agent: any) => [agent.id, agent.name])));
    };

    if (user) loadAgents();
  }, [user]);

  useEffect(() => {
    setActiveTab('primary');
  }, [user?.role]);

  const getAssignedName = useCallback(
    (lead?: Lead, task?: DiaryTask) => {
      const assignedId = task?.assignedTo || lead?.assignedTo;
      if (!assignedId) return lead?.assignedToName || '';
      if (assignedId === user?.id) return user?.name ? `${user.name} (You)` : 'You';
      return agentsMap.get(assignedId) || lead?.assignedToName || assignedId;
    },
    [agentsMap, user?.id, user?.name]
  );

  const buildTaskItem = useCallback(
    (lead: Lead, task: DiaryTask, idPrefix: string): ActionItem => {
      const progress = getLeadProgressStatus(lead, task);
      return {
        id: `${idPrefix}-${task.id}`,
        type: 'task',
        lead,
        task,
        title: task.title || `${task.taskType} follow-up`,
        detail: getActionReason(lead, task),
        assignedUser: getAssignedName(lead, task),
        dueLabel: formatDueLabel(task),
        chipLabel: progress.label,
        chipClassName: progress.className,
        priorityRank: getActionPriority(lead, task),
      };
    },
    [getAssignedName]
  );

  const buildLeadItem = useCallback(
    (lead: Lead, type: ActionItemType, overrides?: Partial<ActionItem>): ActionItem => {
      const progress = getLeadProgressStatus(lead);
      return {
        id: `${type}-${lead.id}`,
        type,
        lead,
        title: type === 'dropped_lead' ? 'Lead needs reassignment' : type === 'stale_lead' ? 'Lead needs progress' : 'No next follow-up scheduled',
        detail: getActionReason(lead),
        assignedUser: getAssignedName(lead),
        dueLabel: formatAge(lead.updatedAt || lead.createdAt),
        chipLabel: type === 'stale_lead' ? 'Stale' : progress.label,
        chipClassName: type === 'stale_lead' ? 'bg-orange-100 text-orange-800' : progress.className,
        priorityRank: getActionPriority(lead),
        ...overrides,
      };
    },
    [getAssignedName]
  );

  const fetchTaskRows = useCallback(
    async (kind: 'overdue' | 'today' | 'upcoming') => {
      const today = getToday();
      let query = supabase
        .from('diary_tasks')
        .select(`
          id,
          lead_id,
          assigned_to,
          task_type,
          title,
          description,
          due_date,
          due_time,
          priority,
          status,
          completed_at,
          created_at,
          updated_at,
          leads!inner(id, short_code, name, email, phone, source, assigned_to, status, stage, priority, created_at, updated_at)
        `)
        .in('status', ACTIVE_TASK_STATUSES)
        .not('leads.status', 'in', DB_INACTIVE_STATUS_LIST)
        .limit(FETCH_BUFFER);

      if (isAgent && user?.id) {
        query = query.eq('assigned_to', user.id);
        query = query.eq('leads.assigned_to', user.id);
      }

      if (kind === 'today') {
        query = query.eq('due_date', today);
      } else if (kind === 'overdue') {
        query = query.lte('due_date', today);
      } else {
        query = query.gt('due_date', today);
      }

      const { data: rows, error } = await query
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true });

      if (error) {
        console.error(`Error loading ${kind} Action Center tasks:`, error);
        return [];
      }

      return (rows || [])
        .map((row: any) => {
          const lead = leadFromRow(row.leads);
          const task = taskFromRow(row);
          return { lead, task };
        })
        .filter(({ lead, task }) => {
          if (isInactiveLead(lead)) return false;
          if (isAgent && user?.id && lead.assignedTo !== user.id) return false;
          if (kind === 'today') return isTaskDueToday(task);
          if (kind === 'overdue') return isTaskOverdue(task);
          return isTaskUpcoming(task);
        })
        .slice(0, LIMIT_PER_SECTION);
    },
    [isAgent, user?.id]
  );

  const fetchRecentActiveLeads = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('id, short_code, name, email, phone, source, assigned_to, status, stage, priority, created_at, updated_at')
      .not('assigned_to', 'is', null)
      .not('status', 'in', DB_INACTIVE_STATUS_LIST)
      .order('updated_at', { ascending: false })
      .limit(FETCH_BUFFER);

    if (isAgent && user?.id) {
      query = query.eq('assigned_to', user.id);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('Error loading Action Center recent leads:', error);
      return [];
    }

    return ((rows as any[]) || []).map(leadFromRow).filter(lead => !isInactiveLead(lead));
  }, [isAgent, user?.id]);

  const fetchDroppedLeadItems = useCallback(async (): Promise<ActionItem[]> => {
    if (!isManagerView) return [];

    const { data: activities, error } = await supabase
      .from('activity_log')
      .select('lead_id, done_by_id, done_by_name, created_at')
      .ilike('action_description', '%dropped%')
      .order('created_at', { ascending: false })
      .limit(FETCH_BUFFER);

    if (error) {
      console.error('Error loading Action Center dropped leads:', error);
      return [];
    }

    const latestByLead = new Map<string, any>();
    (activities || []).forEach((activity: any) => {
      if (activity.lead_id && !latestByLead.has(activity.lead_id)) {
        latestByLead.set(activity.lead_id, activity);
      }
    });

    const leads = await fetchLeadsByIds(Array.from(latestByLead.keys()));
    return leads
      .filter(lead => !lead.assignedTo && !isInactiveLead(lead))
      .slice(0, LIMIT_PER_SECTION)
      .map(lead => {
        const activity = latestByLead.get(lead.id);
        return buildLeadItem(lead, 'dropped_lead', {
          detail: activity?.done_by_name ? `Dropped by ${activity.done_by_name}` : 'Unassigned after being dropped',
          dueLabel: formatAge(activity?.created_at || lead.updatedAt || lead.createdAt),
          chipLabel: 'Unassigned',
          chipClassName: 'bg-amber-100 text-amber-800',
          priorityRank: 1,
        });
      });
  }, [buildLeadItem, isManagerView]);

  const fetchNeedsAttentionItems = useCallback(async (blockedLeadIds: Set<string>): Promise<ActionItem[]> => {
    const recentLeads = await fetchRecentActiveLeads();
    const candidateLeads = recentLeads.filter(lead => !blockedLeadIds.has(lead.id));
    const leadIds = candidateLeads.map(lead => lead.id);
    if (leadIds.length === 0) return [];

    const { data: tasks, error } = await supabase
      .from('diary_tasks')
      .select('lead_id')
      .in('lead_id', leadIds)
      .in('status', ACTIVE_TASK_STATUSES)
      .gte('due_date', getToday());

    if (error) {
      console.error('Error loading Action Center scheduled-task check:', error);
      return [];
    }

    const leadsWithNextTask = new Set((tasks || []).map((task: any) => task.lead_id));
    return candidateLeads
      .filter(lead => !isFirstContactLead(lead) && (!leadsWithNextTask.has(lead.id) || hoursSince(lead.updatedAt || lead.createdAt) >= STALE_HOURS))
      .map(lead => {
        const isStale = hoursSince(lead.updatedAt || lead.createdAt) >= STALE_HOURS;
        const earlyStage = isEarlyAssignedLead(lead);
        const type: ActionItemType = isStale && !earlyStage ? 'stale_lead' : 'needs_schedule';

        return buildLeadItem(lead, type, {
          title: isStale ? 'Lead needs progress' : 'No next follow-up scheduled',
          detail: isStale ? 'Assigned lead has not moved recently' : 'Assigned lead needs a next task',
          chipLabel: isStale ? 'Stale' : 'Needs task',
          chipClassName: isStale ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700',
          priorityRank: isStale ? 3 : 4,
        });
      })
      .sort((a, b) => a.priorityRank - b.priorityRank)
      .slice(0, LIMIT_PER_SECTION);
  }, [buildLeadItem, fetchRecentActiveLeads]);

  const fetchAgentFirstContactItems = useCallback(async (blockedLeadIds: Set<string>): Promise<ActionItem[]> => {
    if (!isAgent) return [];

    const recentLeads = await fetchRecentActiveLeads();
    return recentLeads
      .filter(lead => !blockedLeadIds.has(lead.id) && isEarlyAssignedLead(lead))
      .map(lead => buildLeadItem(lead, 'needs_schedule', {
        title: isFirstContactLead(lead) ? 'Call 1' : 'Recently claimed lead',
        detail: isFirstContactLead(lead) ? 'Needs first contact' : 'Recently claimed lead needs first contact',
        chipLabel: isFirstContactLead(lead) ? 'Call 1' : 'Recently claimed',
        chipClassName: isFirstContactLead(lead) ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800',
        priorityRank: 3,
      }))
      .slice(0, LIMIT_PER_SECTION);
  }, [buildLeadItem, fetchRecentActiveLeads, isAgent]);

  // Outstanding callbacks (comparison-site) — ANY open date so an unanswered
  // callback never disappears at midnight. Managers/admins see all; agents see
  // only their own. Tolerant of the callback_* columns not existing yet.
  const fetchOpenCallbackItems = useCallback(async (blockedLeadIds: Set<string>): Promise<ActionItem[]> => {
    try {
      let query = supabase
        .from('leads')
        .select('id, short_code, name, email, phone, source, assigned_to, status, stage, priority, created_at, updated_at, callback_status, callback_requested_at, callback_contacted_at, callback_firm_name, callback_assigned_to')
        .in('callback_status', ['requested', 'contacted'])
        .not('is_funnel_archived', 'is', true)
        .order('callback_requested_at', { ascending: true })
        .limit(FETCH_BUFFER);

      if (isAgent && user?.id) {
        query = query.or(`callback_assigned_to.eq.${user.id},and(callback_assigned_to.is.null,assigned_to.eq.${user.id})`);
      }

      const { data: rows, error } = await query;
      if (error) return [];

      return ((rows as any[]) || [])
        .filter(row => !blockedLeadIds.has(row.id))
        .slice(0, LIMIT_PER_SECTION)
        .map(row => {
          const lead = leadFromRow(row);
          const contacted = row.callback_status === 'contacted';
          return {
            id: `callback-${row.id}`,
            type: 'callback' as ActionItemType,
            lead,
            title: 'Callback requested',
            detail: row.callback_firm_name ? `Comparison site — ${row.callback_firm_name}` : 'Requested via comparison site',
            assignedUser: getAssignedName(lead),
            dueLabel: formatAge(row.callback_requested_at || lead.updatedAt || lead.createdAt),
            chipLabel: contacted ? 'Contacted' : 'Callback',
            chipClassName: contacted ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800',
            priorityRank: 0,
          };
        });
    } catch {
      return [];
    }
  }, [getAssignedName, isAgent, user?.id]);

  // Outstanding instruction requests (comparison-site "Instruct This Solicitor") —
  // ANY open date. Mirrors callbacks. Managers/admins see all; agents see their own.
  const fetchOpenInstructionRequestItems = useCallback(async (blockedLeadIds: Set<string>): Promise<ActionItem[]> => {
    try {
      let query = supabase
        .from('leads')
        .select('id, short_code, name, email, phone, source, assigned_to, status, stage, priority, created_at, updated_at, instruction_request_status, instruction_requested_at, instruction_request_firm_name, instruction_request_assigned_to')
        .in('instruction_request_status', ['requested', 'contacted'])
        .not('is_funnel_archived', 'is', true)
        .order('instruction_requested_at', { ascending: true })
        .limit(FETCH_BUFFER);

      if (isAgent && user?.id) {
        query = query.or(`instruction_request_assigned_to.eq.${user.id},and(instruction_request_assigned_to.is.null,assigned_to.eq.${user.id})`);
      }

      const { data: rows, error } = await query;
      if (error) return [];

      return ((rows as any[]) || [])
        .filter(row => !blockedLeadIds.has(row.id))
        .slice(0, LIMIT_PER_SECTION)
        .map(row => {
          const lead = leadFromRow(row);
          const contacted = row.instruction_request_status === 'contacted';
          return {
            id: `instruction-request-${row.id}`,
            type: 'instruction_request' as ActionItemType,
            lead,
            title: 'Instruction requested',
            detail: row.instruction_request_firm_name ? `Wants to instruct — ${row.instruction_request_firm_name}` : 'Wants to instruct (comparison site)',
            assignedUser: getAssignedName(lead),
            dueLabel: formatAge(row.instruction_requested_at || lead.updatedAt || lead.createdAt),
            chipLabel: contacted ? 'Contacted' : 'Instruct',
            chipClassName: contacted ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800',
            priorityRank: 0,
          };
        });
    } catch {
      return [];
    }
  }, [getAssignedName, isAgent, user?.id]);

  const loadActionCenter = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [overdueRows, todayRows, upcomingRows, droppedItems] = await Promise.all([
        fetchTaskRows('overdue'),
        fetchTaskRows('today'),
        fetchTaskRows('upcoming'),
        fetchDroppedLeadItems(),
      ]);

      const overdue = overdueRows.map(({ lead, task }) => buildTaskItem(lead, task, 'overdue'));
      const today = todayRows.map(({ lead, task }) => buildTaskItem(lead, task, 'today'));
      const upcoming = upcomingRows.map(({ lead, task }) => buildTaskItem(lead, task, 'upcoming'));

      const alreadyActionedLeadIds = new Set([
        ...overdue.map(item => item.lead.id),
        ...today.map(item => item.lead.id),
        ...upcoming.map(item => item.lead.id),
      ]);
      const firstContactItems = await fetchAgentFirstContactItems(alreadyActionedLeadIds);
      firstContactItems.forEach(item => alreadyActionedLeadIds.add(item.lead.id));

      const callbackItems = await fetchOpenCallbackItems(alreadyActionedLeadIds);
      callbackItems.forEach(item => alreadyActionedLeadIds.add(item.lead.id));

      const instructionRequestItems = await fetchOpenInstructionRequestItems(alreadyActionedLeadIds);
      instructionRequestItems.forEach(item => alreadyActionedLeadIds.add(item.lead.id));

      const needsAttention = [
        ...callbackItems,
        ...instructionRequestItems,
        ...droppedItems,
        ...(await fetchNeedsAttentionItems(alreadyActionedLeadIds)),
      ]
        .sort((a, b) => a.priorityRank - b.priorityRank)
        .slice(0, LIMIT_PER_SECTION);

      setData({
        primary: isAgent ? [...overdue, ...today, ...firstContactItems].sort((a, b) => a.priorityRank - b.priorityRank).slice(0, LIMIT_PER_SECTION) : overdue,
        secondary: isAgent ? upcoming : today,
        needsAttention,
      });
    } catch (error) {
      console.error('Error loading Action Center:', error);
    } finally {
      setIsLoading(false);
    }
  }, [buildTaskItem, fetchAgentFirstContactItems, fetchDroppedLeadItems, fetchNeedsAttentionItems, fetchOpenCallbackItems, fetchOpenInstructionRequestItems, fetchTaskRows, isAgent, user]);

  useEffect(() => {
    loadActionCenter();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadActionCenter();
    }, 120000);

    const handleActionCenterUpdate = () => loadActionCenter();
    window.addEventListener('tasks:updated', handleActionCenterUpdate);
    window.addEventListener('action-center:updated', handleActionCenterUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tasks:updated', handleActionCenterUpdate);
      window.removeEventListener('action-center:updated', handleActionCenterUpdate);
    };
  }, [loadActionCenter]);

  const handleStartTask = async (item: ActionItem) => {
    if (!item.task) return;
    const updated = await updateTask(item.task.id, { status: 'In Progress' });
    if (updated) {
      emitActionCenterUpdated({ type: 'task_started', taskId: item.task.id, leadId: item.lead.id });
      await loadActionCenter();
    }
  };

  const handleCompleteTask = async (item: ActionItem) => {
    if (!item.task) return;
    const success = await completeTask(item.task.id, user?.id, user?.name);
    if (success) {
      emitActionCenterUpdated({ type: 'task_completed', taskId: item.task.id, leadId: item.lead.id });
      await loadActionCenter();
    }
  };

  const openLead = (leadId: string) => {
    navigate(`/lead-management?leadId=${leadId}`);
  };

  const scheduleTask = (leadId: string) => {
    navigate(`/diary?action=schedule&leadId=${leadId}`);
  };

  const tabs = useMemo(
    () => [
      { id: 'primary' as const, label: isAgent ? 'Now' : 'Overdue', count: data.primary.length },
      { id: 'secondary' as const, label: isAgent ? 'Next' : 'Today', count: data.secondary.length },
      { id: 'attention' as const, label: 'Attention', count: data.needsAttention.length },
    ],
    [data, isAgent]
  );

  const activeItems = activeTab === 'primary' ? data.primary : activeTab === 'secondary' ? data.secondary : data.needsAttention;
  const emptyText = activeTab === 'primary'
    ? isAgent ? 'No next actions' : 'No overdue tasks'
    : activeTab === 'secondary'
      ? isAgent ? 'No upcoming tasks' : 'No tasks due today'
      : 'No current exceptions';

  if (!user) return null;

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center gap-2 rounded-full bg-[#011E41] p-3 text-white shadow-lg transition-colors hover:bg-[#011633]"
          title="Show Action Center"
        >
          <Calendar className="h-5 w-5" />
          {totalCount > 0 && <span className="rounded-full bg-[#6D52B0] px-2 py-0.5 text-xs font-bold">{totalCount}</span>}
        </button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 rounded-full bg-[#011E41] p-3 text-white shadow-lg transition-colors hover:bg-[#011633]"
          title="Open Action Center"
        >
          <Calendar className="h-5 w-5" />
          <span className="rounded-full bg-[#6D52B0] px-2 py-0.5 text-xs font-bold">{totalCount}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`fixed bottom-4 right-4 z-50 flex flex-col rounded-lg border border-gray-200 bg-white shadow-2xl transition-all duration-300 ${isExpanded ? 'w-[430px] max-h-[660px]' : 'w-96 max-h-[500px]'}`}>
        <div className="rounded-t-lg bg-[#011E41] p-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Action Center</h3>
                <span className="rounded-full bg-[#6D52B0] px-2 py-0.5 text-xs font-bold">{totalCount}</span>
              </div>
              <p className="mt-1 text-xs text-white/75">Overdue tasks, today&apos;s follow-ups, and leads needing attention.</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsExpanded(!isExpanded)} className="rounded p-1 transition-colors hover:bg-[#011633]" title={isExpanded ? 'Collapse' : 'Expand'}>
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={() => setIsMinimized(true)} className="rounded p-1 transition-colors hover:bg-[#011633]" title="Minimize">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={() => setIsVisible(false)} className="rounded p-1 transition-colors hover:bg-[#011633]" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-2 text-xs font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-[#011E41]' : 'text-gray-600 hover:bg-white/70'}`}
            >
              {tab.label}
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ maxHeight: isExpanded ? '520px' : '360px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Action Center...
            </div>
          ) : activeItems.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle className="mx-auto mb-2 h-6 w-6 text-green-500" />
              <p className="text-sm font-medium text-gray-900">{emptyText}</p>
              <p className="mt-1 text-xs text-gray-500">You&apos;re clear for this section.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeItems.map(item => (
                <div key={item.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openLead(item.lead.id)}>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{item.lead.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.chipClassName}`}>{item.chipLabel}</span>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-gray-700">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{item.detail}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        {item.assignedUser && <span>Assigned: {item.assignedUser}</span>}
                        {item.dueLabel && (
                          <span className="inline-flex items-center gap-1">
                            {item.task ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {item.dueLabel}
                          </span>
                        )}
                        <span>{item.lead.stage || item.lead.status}</span>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button onClick={() => openLead(item.lead.id)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-[#011E41]" title="Open Lead">
                        <Eye className="h-4 w-4" />
                      </button>
                      {item.task?.status === 'Pending' && (
                        <button onClick={() => handleStartTask(item)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" title="Start Task">
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                      {item.task && (
                        <button onClick={() => handleCompleteTask(item)} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Complete Task">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => scheduleTask(item.lead.id)} className="rounded p-1.5 text-[#401DBA] hover:bg-[#6D52B0]/10" title="Schedule Task">
                        <Plus className="h-4 w-4" />
                      </button>
                      {isManagerView && (
                        <button onClick={() => setLeadToAssign(item.lead)} className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Assign Lead">
                          <UserCheck className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
          <button onClick={() => navigate('/diary')} className="text-xs font-medium text-[#401DBA] hover:underline">
            View all in Diary
          </button>
          <button onClick={() => navigate('/lead-management')} className="text-xs font-medium text-[#401DBA] hover:underline">
            View in Lead Management
          </button>
        </div>
      </div>

      <AssignLeadModal
        isOpen={!!leadToAssign}
        lead={leadToAssign ? { id: leadToAssign.id, name: leadToAssign.name } : null}
        onClose={() => setLeadToAssign(null)}
        refreshData={loadActionCenter}
        onSuccess={(leadName, agentName) => {
          setAssignToast({ type: 'success', message: `Lead "${leadName}" assigned to ${agentName}.` });
          setLeadToAssign(null);
          emitActionCenterUpdated({ type: 'lead_assigned', leadId: leadToAssign?.id });
        }}
        onError={(message) => setAssignToast({ type: 'error', message })}
      />

      {assignToast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={`pointer-events-auto fixed right-4 top-4 z-[9999] rounded-lg px-4 py-3 text-sm shadow-lg ${assignToast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {assignToast.message}
          </div>,
          document.body
        )}
    </>
  );
}
