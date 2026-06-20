import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Plus,
  User,
  Play,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from 'lucide-react';
import { DiaryTask, Lead } from '@/types';
import { fetchTasks, completeTask, updateTask, createTask } from '@/services/tasksService';
import { fetchLeadsByIds, fetchLeadsPage, type PaginatedLeadsResponse } from '@/services/leadsService';
import { supabase } from '@/lib/supabase';

interface LeadWithTasks {
  lead: Lead;
  tasks: DiaryTask[];
  overdueTasks: DiaryTask[];
  todayTasks: DiaryTask[];
  upcomingTasks: DiaryTask[];
  completedTasks: DiaryTask[];
}

interface TaskFormState {
  leadId: string;
  taskType: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: 'High' | 'Medium' | 'Low';
  assignedTo: string;
}

export function DiaryNew() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DiaryTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    today: true,
    overdue: true,
    completed: false,
  });
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [leadsWithTasks, setLeadsWithTasks] = useState<LeadWithTasks[]>([]);
  const [allLeadsWithTasks, setAllLeadsWithTasks] = useState<LeadWithTasks[]>([]); // Unfiltered leads for count calculations
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState<string>('All');
  const [filterTaskStatus, setFilterTaskStatus] = useState<string>('Today'); // All, Overdue, Today, Upcoming, Completed, None
  const [showTodayOnly, setShowTodayOnly] = useState<boolean>(true); // Default: show only today's tasks
  const leadsPerPage = 18;
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [totalTodayTasks, setTotalTodayTasks] = useState(0); // Total across all pages
  const [totalOverdueTasks, setTotalOverdueTasks] = useState(0); // Total across all pages
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0); // Total across all pages
  const [totalUpcomingTasks, setTotalUpcomingTasks] = useState(0); // Total across all pages
  const [searchParams, setSearchParams] = useSearchParams();
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [debouncedLeadSearchTerm, setDebouncedLeadSearchTerm] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // Debounce lead search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLeadSearchTerm(leadSearchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [leadSearchTerm]);

  // Memoize filtered leads for search dropdown to prevent re-filtering on every render
  const filteredSearchLeads = useMemo(() => {
    if (!debouncedLeadSearchTerm || debouncedLeadSearchTerm.trim() === '') {
      return availableLeads; // Show all leads when search is empty
    }
    const searchLower = debouncedLeadSearchTerm.toLowerCase().trim();
    return availableLeads.filter(lead =>
      (lead.name && lead.name.toLowerCase().includes(searchLower)) ||
      (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
      (lead.phone && lead.phone.toLowerCase().includes(searchLower)) ||
      (lead.assignedToName && lead.assignedToName.toLowerCase().includes(searchLower))
    );
  }, [availableLeads, debouncedLeadSearchTerm]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
const [taskForm, setTaskForm] = useState<TaskFormState>({
    leadId: '',
    taskType: 'Call',
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '',
    priority: 'Medium',
    assignedTo: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [pendingScheduleLeadId, setPendingScheduleLeadId] = useState<string | null>(null);

const getToday = () => new Date().toISOString().split('T')[0];

const ACTIVE_TASK_STATUSES = ['Pending', 'In Progress'];
const CLOSED_LEAD_STATUSES = new Set(['Sold', 'Closed', 'Archived']);

const isTaskStatusScopedView = (status: string, todayOnly: boolean) =>
  todayOnly || ['Today', 'Overdue', 'Upcoming', 'Completed'].includes(status);

const buildTaskStatusBuckets = () => {
  const today = getToday();
  const currentTime = new Date().toTimeString().slice(0, 5);
  const normalizeTime = (time?: string | null) => (time ? time.slice(0, 5) : null);
  const isPending = (task: DiaryTask) => task.status === 'Pending' || task.status === 'In Progress';
  const isOverdue = (task: DiaryTask) => {
    if (!isPending(task)) return false;
    if (!task.dueDate) return false;
    if (task.dueDate < today) return true;
    if (task.dueDate > today) return false;
    const dueTime = normalizeTime(task.dueTime);
    return !!dueTime && dueTime < currentTime;
  };
  const isTodayTask = (task: DiaryTask) => {
    if (!isPending(task)) return false;
    if (!task.dueDate) return false;
    if (task.dueDate !== today) return false;
    const dueTime = normalizeTime(task.dueTime);
    return !dueTime || dueTime >= currentTime;
  };
  const isUpcoming = (task: DiaryTask) => isPending(task) && task.dueDate > today;

  return {
    today,
    isOverdue,
    isTodayTask,
    isUpcoming,
    isCompletedToday: (task: DiaryTask) => task.status === 'Completed' && task.completedAt?.startsWith(today),
  };
};

const getTaskStatusFilter = (status: string) => {
  switch (status) {
    case 'Overdue':
      return { overdue: true };
    case 'Upcoming':
      return { upcoming: true };
    case 'Completed':
      return { completedToday: true };
    case 'Today':
    default:
      return { today: true };
  }
};

const resetTaskForm = (lead?: Lead) => {
  const today = getToday();
  setTaskForm({
    leadId: lead?.id || '',
    taskType: 'Call',
    title: lead ? `Follow up with ${lead.name}` : '',
    description: '',
    dueDate: today,
    dueTime: '',
    priority: 'Medium',
    assignedTo: lead?.assignedTo || user?.id || '',
  });
  setFormError(null);
  // Set lead search term to lead name if provided
  if (lead) {
    setLeadSearchTerm(lead.name);
  } else {
    setLeadSearchTerm('');
  }
  setShowLeadDropdown(false);
};

const openNewTaskModal = (lead?: Lead) => {
  resetTaskForm(lead);
  setShowNewTaskModal(true);
};

useEffect(() => {
  const action = searchParams.get('action');
  const leadIdParam = searchParams.get('leadId');
  if (action === 'schedule') {
    if (leadIdParam) {
      setPendingScheduleLeadId(leadIdParam);
    }
    setShowNewTaskModal(true);
  }
}, [searchParams]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch leads and their tasks. Task-focused views start from tasks so page 1 never hides today's work.
  const loadLeadsWithTasks = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const taskFilters: any = {};
      if (user.role === 'Agent' && user.id) {
        taskFilters.userId = user.id;
      }

      const [todayTasksCount, overdueTasksCount, completedTasksCount, upcomingTasksCount] = await Promise.all([
        (async () => {
          let query = supabase
            .from('diary_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('due_date', getToday())
            .in('status', ACTIVE_TASK_STATUSES);
          if (user.role === 'Agent' && user.id) query = query.eq('assigned_to', user.id);
          const { count } = await query;
          return count || 0;
        })(),
        (async () => {
          let query = supabase
            .from('diary_tasks')
            .select('id', { count: 'exact', head: true })
            .lt('due_date', getToday())
            .in('status', ACTIVE_TASK_STATUSES);
          if (user.role === 'Agent' && user.id) query = query.eq('assigned_to', user.id);
          const { count } = await query;
          return count || 0;
        })(),
        (async () => {
          let query = supabase
            .from('diary_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Completed')
            .gte('completed_at', `${getToday()}T00:00:00.000Z`)
            .lt('completed_at', `${getToday()}T23:59:59.999Z`);
          if (user.role === 'Agent' && user.id) query = query.eq('assigned_to', user.id);
          const { count } = await query;
          return count || 0;
        })(),
        (async () => {
          let query = supabase
            .from('diary_tasks')
            .select('id', { count: 'exact', head: true })
            .gt('due_date', getToday())
            .in('status', ACTIVE_TASK_STATUSES);
          if (user.role === 'Agent' && user.id) query = query.eq('assigned_to', user.id);
          const { count } = await query;
          return count || 0;
        })(),
      ]);

      setTotalTodayTasks(todayTasksCount);
      setTotalOverdueTasks(overdueTasksCount);
      setTotalCompletedTasks(completedTasksCount);
      setTotalUpcomingTasks(upcomingTasksCount);

      const buckets = buildTaskStatusBuckets();
      const buildLeadRows = (displayLeads: Lead[], tasks: DiaryTask[]) => displayLeads.map(lead => {
        const leadTasks = tasks.filter(t => t.leadId === lead.id);
        return {
          lead,
          tasks: leadTasks,
          overdueTasks: leadTasks.filter(buckets.isOverdue),
          todayTasks: leadTasks.filter(buckets.isTodayTask),
          upcomingTasks: leadTasks.filter(buckets.isUpcoming),
          completedTasks: leadTasks.filter(buckets.isCompletedToday),
        };
      });

      const sortLeadRows = (rows: LeadWithTasks[]) => rows.sort((a, b) => {
        const rank = (leadWithTask: LeadWithTasks) => {
          if (leadWithTask.overdueTasks.length > 0) return 0;
          if (leadWithTask.todayTasks.length > 0) return 1;
          if (leadWithTask.upcomingTasks.length > 0) return 2;
          return 3;
        };
        const aRank = rank(a);
        const bRank = rank(b);
        if (aRank !== bRank) return aRank - bRank;
        const aTasks = Math.max(a.overdueTasks.length, a.todayTasks.length, a.upcomingTasks.length, a.completedTasks.length);
        const bTasks = Math.max(b.overdueTasks.length, b.todayTasks.length, b.upcomingTasks.length, b.completedTasks.length);
        return bTasks - aTasks;
      });

      if (isTaskStatusScopedView(filterTaskStatus, showTodayOnly)) {
        const scopedStatus = ['Today', 'Overdue', 'Upcoming', 'Completed'].includes(filterTaskStatus)
          ? filterTaskStatus
          : 'Today';
        const scopedTasks = await fetchTasks({ ...taskFilters, ...getTaskStatusFilter(scopedStatus) });
        const leadIds = Array.from(new Set(scopedTasks.map(task => task.leadId).filter(Boolean)));
        const scopedLeads = await fetchLeadsByIds(leadIds);

        const searchLower = debouncedSearchTerm.trim().toLowerCase();
        const filteredLeads = scopedLeads.filter(lead => {
          if (!lead.assignedTo) return false;
          if (CLOSED_LEAD_STATUSES.has(lead.status)) return false;
          if (filterStage !== 'All' && lead.stage !== filterStage) return false;
          if (!searchLower) return true;
          return (
            lead.name?.toLowerCase().includes(searchLower) ||
            lead.email?.toLowerCase().includes(searchLower) ||
            lead.phone?.toLowerCase().includes(searchLower) ||
            lead.assignedToName?.toLowerCase().includes(searchLower)
          );
        });

        const pageStart = (currentPage - 1) * leadsPerPage;
        const pageLeads = filteredLeads.slice(pageStart, pageStart + leadsPerPage);
        const pageLeadIds = new Set(pageLeads.map(lead => lead.id));
        const pageTasks = scopedTasks.filter(task => pageLeadIds.has(task.leadId));
        const rows = sortLeadRows(buildLeadRows(pageLeads, pageTasks));

        setTotalLeadsCount(filteredLeads.length);
        setAllLeadsWithTasks(rows);
        setLeadsWithTasks(rows);
        setExpandedLeads(new Set(rows.filter(lwt => lwt.overdueTasks.length > 0).map(lwt => lwt.lead.id)));
        return;
      }

      // General lead-centric view: fetch current assigned lead page, then only tasks for those visible leads.
      const leadFilters: any = {
        activeOnly: true, // Only active leads (exclude sold, closed, archived, etc.)
        assignedOnly: true, // Only show assigned leads (exclude unassigned)
      };

      if (user.role === 'Agent' && user.id) {
        leadFilters.userId = user.id; // Only leads assigned to this agent
      }
      // For Admin/Manager: assignedOnly filter ensures we only see assigned leads

      // Add search filter
      if (debouncedSearchTerm) {
        leadFilters.searchTerm = debouncedSearchTerm;
      }

      // Add stage filter
      if (filterStage !== 'All') {
        leadFilters.stage = filterStage;
      }

      const offset = (currentPage - 1) * leadsPerPage;
      const result: PaginatedLeadsResponse = await fetchLeadsPage(leadFilters, {
        limit: leadsPerPage,
        offset,
        activeOnly: true,
      });

      const assignedLeads = result.leads;
      setTotalLeadsCount(result.total);

      if (assignedLeads.length === 0) {
        setLeadsWithTasks([]);
        setAllLeadsWithTasks([]);
        return;
      }

      const leadIds = assignedLeads.map(l => l.id);
      const [todayTasksResult, overdueTasksResult, upcomingTasksResult, completedTasksResult] = await Promise.all([
        fetchTasks({ ...taskFilters, leadIds, today: true }),
        fetchTasks({ ...taskFilters, leadIds, overdue: true }),
        fetchTasks({ ...taskFilters, leadIds, upcoming: true }),
        fetchTasks({ ...taskFilters, leadIds, completedToday: true }),
      ]);

      const leadsWithTasksData = buildLeadRows(
        assignedLeads,
        [...todayTasksResult, ...overdueTasksResult, ...upcomingTasksResult, ...completedTasksResult]
      );

      // Filter by task status if needed (client-side, as it depends on task data)
      let filteredLeadsWithTasks = leadsWithTasksData;
      
      // First, apply showTodayOnly filter (if enabled, only show leads with today's tasks)
      if (showTodayOnly) {
        filteredLeadsWithTasks = filteredLeadsWithTasks.filter(lwt => 
          lwt.todayTasks.length > 0 || lwt.completedTasks.length > 0
        );
      }
      
      // Then apply task status filter
      if (filterTaskStatus !== 'All') {
        filteredLeadsWithTasks = filteredLeadsWithTasks.filter(lwt => {
          switch (filterTaskStatus) {
            case 'Today':
              return lwt.todayTasks.length > 0;
            case 'Overdue':
              return lwt.overdueTasks.length > 0;
            case 'Upcoming':
              return lwt.upcomingTasks.length > 0;
            case 'Completed':
              return lwt.completedTasks.length > 0;
            case 'None':
              return lwt.overdueTasks.length === 0 && lwt.todayTasks.length === 0 && lwt.upcomingTasks.length === 0;
            default:
              return true;
          }
        });
      }

      sortLeadRows(filteredLeadsWithTasks);

      // Store unfiltered leads for count calculations
      setAllLeadsWithTasks(leadsWithTasksData);
      // Store filtered leads for display
      setLeadsWithTasks(filteredLeadsWithTasks);

      // Auto-expand leads with overdue tasks
      const overdueLeadIds = filteredLeadsWithTasks
        .filter(lwt => lwt.overdueTasks.length > 0)
        .map(lwt => lwt.lead.id);
      setExpandedLeads(new Set(overdueLeadIds));
      } catch (err) {
        console.error('Error loading leads with tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
  useEffect(() => {
    if (user) {
      loadLeadsWithTasks();
    }
  }, [user, currentPage, debouncedSearchTerm, filterStage, filterTaskStatus, showTodayOnly]);

  // Load available leads for task creation modal (limited to 50)
  useEffect(() => {
    const loadAvailableLeads = async () => {
      if (!user || !showNewTaskModal) {
        // Reset when modal closes
        setAvailableLeads([]);
        setLeadSearchTerm('');
        setShowLeadDropdown(false);
        return;
      }
      
      setIsLoadingLeads(true);
      try {
        const leadFilters: any = {
          activeOnly: true,
          assignedOnly: true, // Only show assigned leads for task creation
        };
        
        if (user.role === 'Agent' && user.id) {
          leadFilters.userId = user.id;
        }
        
        // Add search filter if search term exists
        if (debouncedLeadSearchTerm) {
          leadFilters.searchTerm = debouncedLeadSearchTerm;
        }
        
        const result = await fetchLeadsPage(leadFilters, {
          limit: 50,
          offset: 0,
          activeOnly: true,
        });
        
        setAvailableLeads(result.leads);
        // Auto-open dropdown if leads are available
        if (result.leads.length > 0 && !showLeadDropdown && !leadSearchTerm) {
          setShowLeadDropdown(true);
        }
      } catch (err) {
        console.error('Error loading available leads:', err);
        setAvailableLeads([]);
      } finally {
        setIsLoadingLeads(false);
      }
    };
    
    if (showNewTaskModal && user) {
      loadAvailableLeads();
    }
  }, [user, showNewTaskModal, debouncedLeadSearchTerm]);

  useEffect(() => {
    if (!pendingScheduleLeadId) return;
    if (isLoading || !showNewTaskModal) return; // Wait for modal to open

    const lead = availableLeads.find(l => l.id === pendingScheduleLeadId);
    if (lead) {
      resetTaskForm(lead);
      setPendingScheduleLeadId(null);
      const params = new URLSearchParams(searchParams);
      params.delete('action');
      params.delete('leadId');
      setSearchParams(params, { replace: true });
    }
  }, [pendingScheduleLeadId, availableLeads, isLoading, showNewTaskModal, searchParams, setSearchParams]);
  
  // Open modal when leadId is in URL
  useEffect(() => {
    const action = searchParams.get('action');
    const leadIdParam = searchParams.get('leadId');
    if (action === 'schedule') {
      if (leadIdParam) {
        setPendingScheduleLeadId(leadIdParam);
      }
      setShowNewTaskModal(true);
    }
  }, [searchParams]);

  // Leads are already filtered on the server and client (for task status)
  const filteredLeads = leadsWithTasks;
  const paginatedLeads = filteredLeads; // Already paginated from server

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStage, filterTaskStatus, showTodayOnly]);

  // Calculate totals - use state values for task counts (from server), leads count from server
  const totalFilteredLeads = totalLeadsCount; // Use server total
  const totalPages = Math.ceil(totalLeadsCount / leadsPerPage);
  
  // Calculate displayed task counts (from ALL leads on current page, before filtering)
  // This ensures counts show all available tasks, not just filtered ones
  // The counts reflect what's available on this page, matching what can be displayed
  const displayedTodayTasks = allLeadsWithTasks.reduce((sum, lwt) => sum + lwt.todayTasks.length, 0);
  const displayedOverdueTasks = allLeadsWithTasks.reduce((sum, lwt) => sum + lwt.overdueTasks.length, 0);
  const displayedUpcomingTasks = allLeadsWithTasks.reduce((sum, lwt) => sum + lwt.upcomingTasks.length, 0);
  const displayedCompletedTasks = allLeadsWithTasks.reduce((sum, lwt) => sum + lwt.completedTasks.length, 0);
  
  // Get stage display text
  const getStageDisplay = (stage: string) => {
    switch (stage) {
      case 'New': return 'Initial Contact';
      case 'Call-1': return 'First Contact';
      case 'Call-2': return 'Follow-up Call';
      case 'Call-3': return 'Third Attempt';
      case 'Call-4': return 'Fourth Attempt';
      case 'Call-5': return 'Final Attempt';
      case 'Interested': return 'Interested';
      case 'Ready to Solicit': return 'Ready to Solicit';
      case 'Awaiting Payment': return 'Awaiting Payment';
      case 'Awaiting Client Info': return 'Awaiting Client Info';
      default: return stage;
    }
  };
  
  const toggleLeadExpansion = (leadId: string) => {
    setExpandedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  // Show loading only if auth is still loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Helper function to reload leads with tasks
  const reloadTasks = async () => {
    // Use the main loadLeadsWithTasks function which handles pagination
    await loadLeadsWithTasks();
  };

const handleTaskFormFieldChange = (field: keyof TaskFormState, value: string) => {
  setTaskForm((prev) => ({
    ...prev,
    [field]: value,
  }));
};

const handleLeadSelectionChange = (lead: Lead) => {
  setTaskForm((prev) => ({
    ...prev,
    leadId: lead.id,
    assignedTo: lead.assignedTo || prev.assignedTo || user?.id || '',
    title:
      prev.title && !prev.title.startsWith('Follow up with')
        ? prev.title
        : `Follow up with ${lead.name}`,
  }));
  setLeadSearchTerm(lead.name);
  setShowLeadDropdown(false);
};

const handleCloseTaskModal = () => {
  setShowNewTaskModal(false);
  resetTaskForm();
};

const handleCreateTask = async () => {
  if (!taskForm.leadId) {
    setFormError('Please select a lead.');
    return;
  }

  if (!taskForm.dueDate) {
    setFormError('Please choose a due date.');
    return;
  }

  const selectedLead = availableLeads.find((lead) => lead.id === taskForm.leadId);
  if (!selectedLead) {
    setFormError('Selected lead is not available.');
    return;
  }

  const title = taskForm.title.trim() || `Follow up with ${selectedLead.name}`;
  const assignedTo = taskForm.assignedTo || selectedLead.assignedTo || user?.id || '';

  if (!assignedTo) {
    setFormError('Unable to determine the assignee for this task.');
    return;
  }

  setFormError(null);
  setIsSavingTask(true);
  try {
    const newTask = await createTask({
      leadId: taskForm.leadId,
      assignedTo,
      taskType: taskForm.taskType as DiaryTask['taskType'],
      title,
      description: taskForm.description,
      dueDate: taskForm.dueDate,
      dueTime: taskForm.dueTime || undefined,
      priority: taskForm.priority,
      status: 'Pending',
    });

    if (!newTask) {
      throw new Error('Task creation returned empty result');
    }

    await reloadTasks();
    setShowNewTaskModal(false);
    resetTaskForm();
  } catch (error) {
    console.error('Error creating task:', error);
    setFormError('Failed to create task. Please try again.');
  } finally {
    setIsSavingTask(false);
  }
};

  const handleCompleteTask = async (taskId: string) => {
    try {
      const success = await completeTask(taskId, user?.id, user?.name);
      if (success) {
        await reloadTasks();
      }
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  const handleStartTask = async (taskId: string, leadId: string) => {
    try {
      const updated = await updateTask(taskId, { status: 'In Progress' });
      if (updated) {
        await reloadTasks();
        // Navigate to lead management page
        navigate(`/lead-management?leadId=${leadId}`);
      }
    } catch (err) {
      console.error('Error starting task:', err);
    }
  };

  const handleTaskClick = (task: DiaryTask) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'Call': return <Phone className="h-4 w-4" />;
      case 'Email': return <Mail className="h-4 w-4" />;
      case 'SMS': return <MessageSquare className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-orange-600 bg-orange-100';
      case 'Low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderTaskCard = (task: DiaryTask, leadId: string) => (
    <div
      key={task.id}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => handleTaskClick(task)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            task.taskType === 'Call' ? 'bg-blue-100 text-blue-600' :
            task.taskType === 'Email' ? 'bg-green-100 text-green-600' :
            task.taskType === 'SMS' ? 'bg-purple-100 text-purple-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {getTaskIcon(task.taskType)}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 text-sm">{task.title}</h4>
            {task.description && (
              <p className="text-xs text-gray-600 mt-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {task.dueTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{task.dueTime}</span>
                </div>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {task.status === 'Pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartTask(task.id, leadId);
              }}
              className="text-[#401DBA] hover:text-[#6D52B0] p-1.5 hover:bg-[#6D52B0]/10 rounded transition-colors"
              title="Start Task"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {(task.status === 'Pending' || task.status === 'In Progress') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCompleteTask(task.id);
              }}
              className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-100 rounded transition-colors"
              title="Mark Complete"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          {task.status === 'In Progress' && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              In Progress
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks by Lead</h1>
          <p className="text-gray-600 mt-1">Tasks organized by assigned lead - {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, completed: !prev.completed }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              expandedSections.completed 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            <CheckCircle className="h-4 w-4 inline mr-2" />
            {expandedSections.completed ? 'Hide' : 'Show'} Completed
          </button>
        <button
          onClick={() => openNewTaskModal()}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Task
        </button>
        </div>
      </div>

      {/* Filters */}
      {!isLoading && (
        <div className="card bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Leads</label>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
              />
            </div>

            {/* Stage Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
              >
                <option value="All">All Stages</option>
                <option value="New">New - Initial Contact</option>
                <option value="Call-1">Call-1 - First Contact</option>
                <option value="Call-2">Call-2 - Follow-up</option>
                <option value="Call-3">Call-3 - Third Attempt</option>
                <option value="Call-4">Call-4 - Fourth Attempt</option>
                <option value="Call-5">Call-5 - Final Attempt</option>
                <option value="Interested">Interested</option>
                <option value="Ready to Solicit">Ready to Solicit</option>
                <option value="Awaiting Payment">Awaiting Payment</option>
                <option value="Awaiting Client Info">Awaiting Client Info</option>
              </select>
            </div>

            {/* Task Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Tasks</label>
              <select
                value={filterTaskStatus}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  setFilterTaskStatus(newFilter);
                  // Adjust showTodayOnly based on filter selection
                  if (newFilter === 'Today' || newFilter === 'Completed') {
                    setShowTodayOnly(true);
                  } else if (newFilter === 'Overdue' || newFilter === 'Upcoming' || newFilter === 'All') {
                    setShowTodayOnly(false);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
              >
                <option value="Today">Today's Tasks</option>
                <option value="Overdue">Overdue Tasks</option>
                <option value="Upcoming">Upcoming Tasks</option>
                <option value="Completed">Completed Today</option>
                <option value="All">All Tasks</option>
                <option value="None">No Active Tasks</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{paginatedLeads.length}</span> of <span className="font-semibold">{totalFilteredLeads.toLocaleString()}</span> leads
              {totalPages > 1 && (
                <span> (page {currentPage} of {totalPages})</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      )}

      {/* Summary Cards - Clickable filter cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          className={`card border-2 transition-all cursor-pointer ${
            filterTaskStatus === 'Today' 
              ? 'bg-blue-100 border-blue-400 shadow-md' 
              : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
          }`}
          onClick={() => {
            setFilterTaskStatus('Today');
            setShowTodayOnly(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Today's Tasks</p>
              <p className="text-3xl font-bold text-blue-900">{displayedTodayTasks.toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">
                {filterTaskStatus === 'Today' 
                  ? `✓ Showing ${displayedTodayTasks.toLocaleString()} of ${totalTodayTasks.toLocaleString()}`
                  : totalTodayTasks > displayedTodayTasks 
                    ? `${displayedTodayTasks.toLocaleString()} of ${totalTodayTasks.toLocaleString()} on this page`
                    : 'Click to filter'}
              </p>
            </div>
            <Calendar className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div 
          className={`card border-2 transition-all cursor-pointer ${
            filterTaskStatus === 'Overdue' 
              ? 'bg-red-100 border-red-400 shadow-md' 
              : 'bg-red-50 border-red-200 hover:bg-red-100'
          }`}
          onClick={() => {
            setFilterTaskStatus('Overdue');
            setShowTodayOnly(false);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Overdue</p>
              <p className="text-3xl font-bold text-red-900">{displayedOverdueTasks.toLocaleString()}</p>
              <p className="text-xs text-red-600 mt-1">
                {filterTaskStatus === 'Overdue' 
                  ? `✓ Showing ${displayedOverdueTasks.toLocaleString()} of ${totalOverdueTasks.toLocaleString()}`
                  : totalOverdueTasks > displayedOverdueTasks 
                    ? `${displayedOverdueTasks.toLocaleString()} of ${totalOverdueTasks.toLocaleString()} on this page`
                    : 'Click to filter'}
              </p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div 
          className={`card border-2 transition-all cursor-pointer ${
            filterTaskStatus === 'Upcoming' 
              ? 'bg-purple-100 border-purple-400 shadow-md' 
              : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
          }`}
          onClick={() => {
            setFilterTaskStatus('Upcoming');
            setShowTodayOnly(false);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Upcoming</p>
              <p className="text-3xl font-bold text-purple-900">
                {displayedUpcomingTasks.toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {filterTaskStatus === 'Upcoming' 
                  ? `✓ Showing ${displayedUpcomingTasks.toLocaleString()} of ${totalUpcomingTasks.toLocaleString()}`
                  : totalUpcomingTasks > displayedUpcomingTasks 
                    ? `${displayedUpcomingTasks.toLocaleString()} of ${totalUpcomingTasks.toLocaleString()} on this page`
                    : 'Click to filter'}
              </p>
            </div>
            <Clock className="h-10 w-10 text-purple-500" />
          </div>
        </div>

        <div 
          className={`card border-2 transition-all cursor-pointer ${
            filterTaskStatus === 'Completed' 
              ? 'bg-green-100 border-green-400 shadow-md' 
              : 'bg-green-50 border-green-200 hover:bg-green-100'
          }`}
          onClick={() => {
            setFilterTaskStatus('Completed');
            setShowTodayOnly(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Completed Today</p>
              <p className="text-3xl font-bold text-green-900">{displayedCompletedTasks.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">
                {filterTaskStatus === 'Completed' 
                  ? `✓ Showing ${displayedCompletedTasks.toLocaleString()} of ${totalCompletedTasks.toLocaleString()}`
                  : totalCompletedTasks > displayedCompletedTasks 
                    ? `${displayedCompletedTasks.toLocaleString()} of ${totalCompletedTasks.toLocaleString()} on this page`
                    : 'Click to filter'}
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>
      </div>
      )}

      {/* Leads with Tasks - Grouped by Lead */}
      {filteredLeads.length > 0 ? (
        <>
        <div className="space-y-4">
          {paginatedLeads.map((lwt) => {
            // When showTodayOnly is true, only check for today's tasks and completed today
            const hasTasks = showTodayOnly
              ? lwt.todayTasks.length > 0 || lwt.completedTasks.length > 0
              : lwt.overdueTasks.length > 0 || lwt.todayTasks.length > 0 || lwt.upcomingTasks.length > 0 || lwt.completedTasks.length > 0;
            const totalActiveTasks = showTodayOnly
              ? lwt.todayTasks.length
              : lwt.overdueTasks.length + lwt.todayTasks.length + lwt.upcomingTasks.length;
            const isExpanded = expandedLeads.has(lwt.lead.id);
            
            return (
              <div key={lwt.lead.id} className="card border-gray-200">
                {/* Lead Header */}
          <button
                  onClick={() => toggleLeadExpansion(lwt.lead.id)}
                  className="flex items-center justify-between w-full text-left p-4 hover:bg-gray-50 rounded-lg transition-colors"
          >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[#011E41] rounded-lg flex items-center justify-center text-white">
                        <User className="h-6 w-6" />
            </div>
            </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{lwt.lead.name}</h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#6D52B0]/10 text-[#401DBA]">
                          {getStageDisplay(lwt.lead.stage || 'New')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {lwt.overdueTasks.length > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {lwt.overdueTasks.length} overdue
                          </span>
                        )}
                        {lwt.todayTasks.length > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Calendar className="h-4 w-4" />
                            {lwt.todayTasks.length} today
                          </span>
                        )}
                        {lwt.completedTasks.length > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            {lwt.completedTasks.length} completed
                          </span>
                        )}
                        {!hasTasks && (
                          <span className="text-gray-400">No active tasks</span>
          )}
        </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalActiveTasks > 0 && (
                        <span className="bg-[#6D52B0] text-white text-xs rounded-full px-2 py-1 font-bold">
                          {totalActiveTasks}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </div>
                  </div>
        </button>
        
                {/* Tasks for this Lead - Only show tasks based on filter */}
                {isExpanded && hasTasks && (
                  <div className="mt-4 pl-16 pr-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
                    {/* Overdue Tasks */}
                    {(filterTaskStatus === 'All' || filterTaskStatus === 'Overdue') && lwt.overdueTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-red-600 mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Overdue ({lwt.overdueTasks.length})</span>
              </div>
                        {lwt.overdueTasks.map(task => renderTaskCard(task, lwt.lead.id))}
          </div>
        )}

                    {/* Today's Tasks */}
                    {(filterTaskStatus === 'All' || filterTaskStatus === 'Today') && lwt.todayTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-2">
                          <Calendar className="h-4 w-4" />
                          <span>Today ({lwt.todayTasks.length})</span>
          </div>
                        {lwt.todayTasks.map(task => renderTaskCard(task, lwt.lead.id))}
                      </div>
                    )}

                    {/* Upcoming Tasks */}
                    {(filterTaskStatus === 'All' || filterTaskStatus === 'Upcoming') && lwt.upcomingTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-purple-600 mb-2">
                          <Clock className="h-4 w-4" />
                          <span>Upcoming ({lwt.upcomingTasks.length})</span>
                        </div>
                        {lwt.upcomingTasks.map(task => renderTaskCard(task, lwt.lead.id))}
                      </div>
                    )}

                    {/* Completed Tasks - Show if filter is All, Completed, or if expanded sections completed is true */}
                    {(filterTaskStatus === 'All' || filterTaskStatus === 'Completed' || expandedSections.completed) && lwt.completedTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Completed Today ({lwt.completedTasks.length})</span>
                        </div>
                        {lwt.completedTasks.map(task => (
                <div key={task.id} className="card bg-green-50 opacity-75">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-green-100 text-green-600">
                        {getTaskIcon(task.taskType)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 line-through">{task.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                    {task.dueTime && (
                          <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{task.dueTime}</span>
                          </div>
                                    )}
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>Completed at {task.completedAt && new Date(task.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                        ))}
              </div>
            )}
          </div>
        )}

                {/* Quick Action: View Lead */}
                {isExpanded && (
                  <div className="pl-16 pr-4 pb-4 border-t border-gray-100 pt-4">
                    <button
                      onClick={() => navigate(`/lead-management?leadId=${lwt.lead.id}`)}
                      className="text-sm text-[#401DBA] hover:text-[#6D52B0] font-medium flex items-center gap-1"
                    >
                      View Lead Details →
                    </button>
      </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalLeadsCount > 0 && totalPages > 1 && (
          <div className="card bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#011E41] text-white border-[#011E41]'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      ) : !isLoading ? (
        <div className="card text-center py-12">
          <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600">
            {leadsWithTasks.length === 0 
              ? 'No assigned leads with tasks' 
              : 'No leads match your filters'}
          </p>
          {(searchTerm || filterStage !== 'All' || filterTaskStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStage('All');
                setFilterTaskStatus('All');
              }}
              className="mt-4 text-sm text-[#401DBA] hover:text-[#6D52B0] font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : null}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Schedule Task</h2>
              <button
                onClick={handleCloseTaskModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Lead <span className="text-red-500">*</span>
                </label>
                {isLoadingLeads ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading leads...</span>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                        placeholder="Search leads by name, email, or phone..."
                        value={leadSearchTerm}
                        onChange={(e) => {
                          setLeadSearchTerm(e.target.value);
                          setShowLeadDropdown(true);
                        }}
                        onFocus={() => setShowLeadDropdown(true)}
                        onClick={() => setShowLeadDropdown(true)}
                      />
                    </div>
                    {showLeadDropdown && availableLeads.length > 0 && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowLeadDropdown(false)}
                        />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredSearchLeads.length === 0 && debouncedLeadSearchTerm ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                              No leads found matching "{debouncedLeadSearchTerm}"
                                  <div className="text-xs text-gray-400 mt-1">
                                    Try a different search term
                                  </div>
                                </div>
                          ) : filteredSearchLeads.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                  No leads available
                                </div>
                          ) : (
                              <>
                              {debouncedLeadSearchTerm && (
                                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                                  Showing {filteredSearchLeads.length} of {availableLeads.length} lead(s)
                                  </div>
                                )}
                              {filteredSearchLeads.map(lead => (
                                  <button
                                    key={lead.id}
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                    onClick={() => handleLeadSelectionChange(lead)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                          {lead.name || 'Unnamed Lead'}
                                        </div>
                                        {lead.email && (
                                          <div className="text-sm text-gray-500 truncate">
                                            {lead.email}
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                                          {lead.phone && <span>{lead.phone}</span>}
                                          {lead.assignedTo && (
                                            <span>
                                              • Assigned to: {lead.assignedToName || lead.assignedTo}
                                            </span>
                                          )}
                                          {lead.stage && (
                                            <span>• Stage: {lead.stage}</span>
                                          )}
                                        </div>
                                      </div>
                                      {taskForm.leadId === lead.id && (
                                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 ml-2" />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                        </div>
                      </>
                    )}
                    {showLeadDropdown && availableLeads.length === 0 && !isLoadingLeads && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowLeadDropdown(false)}
                        />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                          <div className="text-center text-sm text-gray-500">
                            No leads available
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Type
                  </label>
                  <select
                    value={taskForm.taskType}
                    onChange={(e) => handleTaskFormFieldChange('taskType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Quote">Quote</option>
                    <option value="Payment">Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      handleTaskFormFieldChange(
                        'priority',
                        e.target.value as TaskFormState['priority']
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => handleTaskFormFieldChange('title', e.target.value)}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => handleTaskFormFieldChange('description', e.target.value)}
                  rows={3}
                  placeholder="Task description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    min={getToday()}
                    onChange={(e) => handleTaskFormFieldChange('dueDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={taskForm.dueTime}
                    onChange={(e) => handleTaskFormFieldChange('dueTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Agent
                </label>
                <input
                  type="text"
                  value={
                    taskForm.assignedTo === user?.id
                      ? user?.name
                        ? `${user.name} (You)`
                        : 'You'
                      : availableLeads.find((lead) => lead.id === taskForm.leadId)?.assignedToName || ''
                  }
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
              <button
                onClick={handleCloseTaskModal}
                className="btn-secondary"
                disabled={isSavingTask}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="btn-primary flex items-center gap-2"
                disabled={isSavingTask || !taskForm.leadId}
              >
                {isSavingTask && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSavingTask ? 'Saving...' : 'Schedule Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedTask.title}</h2>
              <button onClick={() => setShowTaskDetail(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedTask.priority)}`}>
                  {selectedTask.priority} Priority
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {selectedTask.taskType}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Lead Information</h3>
                <p className="text-gray-700">{selectedTask.leadName}</p>
                <p className="text-sm text-gray-500">Lead ID: {selectedTask.leadId}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Due Date</h3>
                  <p className="text-gray-700">{new Date(selectedTask.dueDate).toLocaleDateString('en-GB')}</p>
                </div>
                {selectedTask.dueTime && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Due Time</h3>
                    <p className="text-gray-700">{selectedTask.dueTime}</p>
                  </div>
                )}
              </div>

              {(selectedTask.status === 'Pending' || selectedTask.status === 'In Progress') && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleCompleteTask(selectedTask.id)}
                    className="btn-primary flex-1"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    Mark Complete
                  </button>
                  {selectedTask.status === 'Pending' && (
                  <button
                    onClick={() => handleStartTask(selectedTask.id, selectedTask.leadId)}
                    className="btn-secondary flex-1"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Start Task
                  </button>
                  )}
                  {selectedTask.status === 'In Progress' && (
                    <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center flex-1">
                      <Play className="h-5 w-5 mr-2" />
                      Task In Progress
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
