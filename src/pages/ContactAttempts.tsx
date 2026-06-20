import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Search,
  Phone,
  Mail, 
  MessageSquare, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Calendar,
  Eye,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { fetchAllContactAttempts, ActivityLog, logActivity } from '@/services/activityService';
import { searchLeadOptions, LeadOption } from '@/services/leadsService';
import { Lead } from '@/types';
import { supabase } from '@/lib/supabase';
import { calculateContactAttemptsFromStage } from '@/services/activityService';
import { createTask } from '@/services/tasksService';

interface ContactAttempt {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  attemptType: 'Call' | 'SMS' | 'Email';
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Failed' | 'Cancelled';
  scheduledAt: string;
  completedAt?: string;
  outcome?: string;
  notes?: string;
  agentId: string;
  agentName: string;
  attemptNumber: number;
  maxAttempts: number;
  priority: 'High' | 'Medium' | 'Low';
  businessHours: boolean;
  activityLog: ActivityLog;
  sourceLabel?: string;
  callRecordId?: string;
  aiAnalysisId?: string;
  followUpReason?: string;
  recommendedAction?: string;
  callSummary?: string;
  callStartedAt?: string;
  callAgentName?: string;
}

type ContactDatePreset = 'today' | 'yesterday' | 'last7' | 'last30';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const computeContactRangePreset = (preset: ContactDatePreset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { start: formatDateInput(today), end: formatDateInput(today) };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: formatDateInput(yesterday), end: formatDateInput(yesterday) };
  }

  const start = new Date(today);
  start.setDate(start.getDate() - (preset === 'last7' ? 6 : 29));
  return { start: formatDateInput(start), end: formatDateInput(today) };
};

const datePresetLabel = (preset: ContactDatePreset) => {
  if (preset === 'today') return 'Today';
  if (preset === 'yesterday') return 'Yesterday';
  if (preset === 'last7') return 'Last 7 days';
  return 'Last 30 days';
};

const isWithinDateRange = (value: string, startDate: string, endDate: string) => {
  const attemptDate = new Date(value);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  return attemptDate >= start && attemptDate <= end;
};

export const ContactAttempts: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const canViewCallIntelligence = user?.role === 'Admin' || user?.role === 'Manager';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [datePreset, setDatePreset] = useState<ContactDatePreset>('last7');
  const [selectedAttempts, setSelectedAttempts] = useState<string[]>([]);
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<ContactAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contactAttempts, setContactAttempts] = useState<ContactAttempt[]>([]);
  const [, setLeads] = useState<Map<string, Lead>>(new Map());
  const [, setAgents] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [currentPage, setCurrentPage] = useState(1);
  const attemptsPerPage = 8;
  const [showNewAttemptModal, setShowNewAttemptModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<LeadOption[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadOptionSearchTerm, setLeadOptionSearchTerm] = useState('');
  const [selectedLeadOptions, setSelectedLeadOptions] = useState<Map<string, LeadOption>>(new Map());
  const [newAttempt, setNewAttempt] = useState({
    leadId: '',
    attemptType: 'Call' as 'Call' | 'SMS' | 'Email',
    scheduledDate: '',
    scheduledTime: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    notes: ''
  });
  const [selectedBatchLeads, setSelectedBatchLeads] = useState<string[]>([]);
  const [batchSettings, setBatchSettings] = useState({
    attemptType: 'Call' as 'Call' | 'SMS' | 'Email',
    startDate: '',
    startTime: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    intervalDays: 1
  });

  const rememberLeadOption = (lead?: LeadOption | null) => {
    if (!lead) return;
    setSelectedLeadOptions(prev => {
      const next = new Map(prev);
      next.set(lead.id, lead);
      return next;
    });
  };

  const getLeadOption = (leadId: string) =>
    availableLeads.find(l => l.id === leadId) || selectedLeadOptions.get(leadId);

  // Load contact attempts and related data
  useEffect(() => {
    const loadData = async () => {
      if (authLoading || !user) return;
      
      setIsLoading(true);
      try {
        // Fetch all contact attempts
        const activities = await fetchAllContactAttempts(user.id, user.role, 500);
        
        // Get unique lead IDs
        const leadIds = [...new Set(activities.map(a => a.lead_id).filter(Boolean))];
        
        // Fetch leads
        const leadsMap = new Map<string, Lead>();
        if (leadIds.length > 0) {
          const { data: leadsData, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .in('id', leadIds);
          
          if (!leadsError && leadsData) {
            leadsData.forEach(lead => {
              leadsMap.set(lead.id, lead as Lead);
            });
          }
        }
        setLeads(leadsMap);

        // Fetch agents - initialize agentsMap first
        const agentsMap = new Map<string, { id: string; name: string }>();
        const { data: agentsData, error: agentsError } = await supabase
          .from('users')
          .select('id, name')
          .in('role', ['Agent', 'Manager', 'Admin']);
        
        if (!agentsError && agentsData) {
          agentsData.forEach(agent => {
            agentsMap.set(agent.id, { id: agent.id, name: agent.name });
          });
        }
        setAgents(agentsMap);

        // Calculate attempt numbers for all leads (batch)
        const leadIdsList = Array.from(leadsMap.keys());
        const attemptNumbersMap = new Map<string, number>();
        
        // Calculate attempt numbers in parallel
        const attemptPromises = leadIdsList.map(async (leadId) => {
          const lead = leadsMap.get(leadId);
          if (!lead) return [leadId, 0] as [string, number];
          const count = await calculateContactAttemptsFromStage(lead.stage || 'New', lead.id);
          return [leadId, count] as [string, number];
        });
        
        const attemptResults = await Promise.all(attemptPromises);
        attemptResults.forEach(([leadId, count]) => {
          attemptNumbersMap.set(leadId, count);
        });

        // Transform activities to ContactAttempt format
        const attempts: ContactAttempt[] = [];
        for (const activity of activities) {
          const lead = activity.lead_id ? leadsMap.get(activity.lead_id) : null;
          const agent = activity.done_by_id ? agentsMap.get(activity.done_by_id) : null;
          const metadata = activity.metadata || {};
          
          if (!lead) continue; // Skip if no lead found

          // Determine attempt type from activity
          let attemptType: 'Call' | 'SMS' | 'Email' = 'Call';
          const actionDesc = activity.action_description?.toLowerCase() || '';
          if (actionDesc.includes('sms') || actionDesc.includes('text')) {
            attemptType = 'SMS';
          } else if (actionDesc.includes('email') || actionDesc.includes('mail')) {
            attemptType = 'Email';
          } else if (actionDesc.includes('call') || actionDesc.includes('phone')) {
            attemptType = 'Call';
          }

          // Determine status from activity
          let status: 'Scheduled' | 'In Progress' | 'Completed' | 'Failed' | 'Cancelled' = 'Completed';
          if (actionDesc.includes('scheduled') || metadata.scheduledFor) {
            status = 'Scheduled';
          } else if (actionDesc.includes('cancelled') || actionDesc.includes('canceled')) {
            status = 'Cancelled';
          } else if (actionDesc.includes('failed')) {
            status = 'Failed';
          } else if (activity.activity_type === 'contact_attempt') {
            status = 'In Progress';
          } else if (activity.activity_type === 'outcome_code_set') {
            status = 'Completed';
          } else if (activity.activity_type === 'task_completed') {
            status = 'Completed';
          }

          // Get attempt number from cached map
          const attemptNumber = attemptNumbersMap.get(lead.id) || 0;

          attempts.push({
            id: activity.id,
            leadId: activity.lead_id || '',
            leadName: lead.name || 'Unknown Lead',
            leadPhone: lead.phone || 'N/A',
            leadEmail: lead.email || 'N/A',
            attemptType,
            status,
            scheduledAt: metadata.scheduledFor || metadata.rescheduledTo || activity.created_at,
            completedAt: status === 'Completed' ? activity.created_at : undefined,
            outcome: metadata.outcome || metadata.outcomeCode || '',
            notes: metadata.notes || activity.action_description || '',
            agentId: activity.done_by_id || '',
            agentName: agent?.name || activity.done_by_name || 'System',
            attemptNumber,
            maxAttempts: 5,
            priority: lead.priority === 'High' ? 'High' : lead.priority === 'Low' ? 'Low' : 'Medium',
            businessHours: true,
            activityLog: activity,
            sourceLabel: canViewCallIntelligence && (metadata.source === 'call_analysis' || metadata.callRecordId) ? 'From call analysis' : undefined,
            callRecordId: canViewCallIntelligence ? metadata.callRecordId : undefined,
            aiAnalysisId: canViewCallIntelligence ? metadata.aiAnalysisId : undefined,
            followUpReason: canViewCallIntelligence ? metadata.followUpReason : undefined,
            recommendedAction: canViewCallIntelligence ? metadata.recommendedAction : undefined,
            callSummary: canViewCallIntelligence ? metadata.callSummary || metadata.cdrSummary || metadata.aiSummary : undefined,
            callStartedAt: canViewCallIntelligence ? metadata.callStartedAt : undefined,
            callAgentName: canViewCallIntelligence ? metadata.callAgentName : undefined,
          });
        }

        setContactAttempts(attempts);
      } catch (err) {
        console.error('Error loading contact attempts:', err);
        showNotificationMessage('Failed to load contact attempts', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [authLoading, canViewCallIntelligence, user]);

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const selectedDateRange = useMemo(() => computeContactRangePreset(datePreset), [datePreset]);

  const baseFilteredAttempts = useMemo(() => {
    return contactAttempts.filter(attempt => {
      const matchesSearch = 
        attempt.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attempt.leadPhone.includes(searchTerm) ||
        attempt.leadEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attempt.agentName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = isWithinDateRange(attempt.scheduledAt, selectedDateRange.start, selectedDateRange.end);
      
      return matchesSearch && matchesDate;
    });
  }, [contactAttempts, searchTerm, selectedDateRange.end, selectedDateRange.start]);

  const filteredAttempts = useMemo(() => {
    return baseFilteredAttempts.filter(attempt => {
      const matchesType = filterType === 'All' || attempt.attemptType === filterType;
      const matchesStatus = filterStatus === 'All' || attempt.status === filterStatus;
      return matchesType && matchesStatus;
    });
  }, [baseFilteredAttempts, filterType, filterStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAttempts.length / attemptsPerPage);
  const startIndex = (currentPage - 1) * attemptsPerPage;
  const endIndex = startIndex + attemptsPerPage;
  const paginatedAttempts = filteredAttempts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, filterStatus, filterType, searchTerm]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Near the beginning
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near the end
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const stats = useMemo(() => {
    return {
      scheduled: baseFilteredAttempts.filter(a => a.status === 'Scheduled').length,
      inProgress: baseFilteredAttempts.filter(a => a.status === 'In Progress').length,
      completed: baseFilteredAttempts.filter(a => a.status === 'Completed').length,
      failed: baseFilteredAttempts.filter(a => a.status === 'Failed').length,
      calls: baseFilteredAttempts.filter(a => a.attemptType === 'Call').length,
      sms: baseFilteredAttempts.filter(a => a.attemptType === 'SMS').length,
      email: baseFilteredAttempts.filter(a => a.attemptType === 'Email').length,
    };
  }, [baseFilteredAttempts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Call': return <Phone className="h-4 w-4" />;
      case 'SMS': return <MessageSquare className="h-4 w-4" />;
      case 'Email': return <Mail className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleSelectAttempt = (attemptId: string) => {
    setSelectedAttempts(prev => 
      prev.includes(attemptId) 
        ? prev.filter(id => id !== attemptId)
        : [...prev, attemptId]
    );
  };

  const handleViewAttempt = (attempt: ContactAttempt) => {
    setSelectedAttempt(attempt);
    setShowAttemptModal(true);
  };

  const handleViewLead = (leadId: string) => {
    navigate(`/lead-management?leadId=${leadId}`);
  };

  const applyStatusFilter = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const applyTypeFilter = (type: string) => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('All');
    setFilterStatus('All');
    setDatePreset('last7');
    setSelectedAttempts([]);
    setCurrentPage(1);
  };

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [datePresetLabel(datePreset)];
    if (searchTerm.trim()) chips.push(`Search: ${searchTerm.trim()}`);
    if (filterType !== 'All') chips.push(`Type: ${filterType}`);
    if (filterStatus !== 'All') chips.push(`Status: ${filterStatus}`);
    return chips;
  }, [datePreset, filterStatus, filterType, searchTerm]);

  const handleStartAttempt = async (attempt: ContactAttempt) => {
    try {
      // Log activity for starting attempt
      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: attempt.id,
        leadId: attempt.leadId,
        leadName: attempt.leadName,
        actionDescription: `Started ${attempt.attemptType} attempt`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name,
      });

      showNotificationMessage(`${attempt.attemptType} attempt started`, 'success');
      // Reload data
      window.location.reload();
    } catch (err) {
      console.error('Error starting attempt:', err);
      showNotificationMessage('Failed to start attempt', 'error');
    }
  };

  const handleCompleteAttempt = async (attempt: ContactAttempt) => {
    try {
      await logActivity({
        activityType: 'task_completed',
        entityType: 'contact_attempt',
        entityId: attempt.id,
        leadId: attempt.leadId,
        leadName: attempt.leadName,
        actionDescription: `Completed ${attempt.attemptType} attempt`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name,
        metadata: { outcome: attempt.outcome || 'Completed' }
      });

      showNotificationMessage(`${attempt.attemptType} attempt completed`, 'success');
      window.location.reload();
    } catch (err) {
      console.error('Error completing attempt:', err);
      showNotificationMessage('Failed to complete attempt', 'error');
    }
  };

  const handleRescheduleAttempt = (attempt: ContactAttempt) => {
    setSelectedAttempt(attempt);
    const date = new Date(attempt.scheduledAt);
    setRescheduleDate(date.toISOString().split('T')[0]);
    setRescheduleTime(date.toTimeString().slice(0, 5));
    setShowRescheduleModal(true);
  };

  const handleSaveReschedule = async () => {
    if (!selectedAttempt || !rescheduleDate || !rescheduleTime) return;

    try {
      const scheduledDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
      
      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: selectedAttempt.id,
        leadId: selectedAttempt.leadId,
        leadName: selectedAttempt.leadName,
        actionDescription: `Rescheduled ${selectedAttempt.attemptType} attempt to ${scheduledDateTime.toLocaleString()}`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name,
        metadata: { rescheduledTo: scheduledDateTime.toISOString() }
      });

      showNotificationMessage('Attempt rescheduled successfully', 'success');
      setShowRescheduleModal(false);
      window.location.reload();
    } catch (err) {
      console.error('Error rescheduling attempt:', err);
      showNotificationMessage('Failed to reschedule attempt', 'error');
    }
  };

  const handleCancelAttempt = async (attempt: ContactAttempt) => {
    if (!window.confirm(`Are you sure you want to cancel this ${attempt.attemptType} attempt?`)) return;

    try {
      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: attempt.id,
        leadId: attempt.leadId,
        leadName: attempt.leadName,
        actionDescription: `Cancelled ${attempt.attemptType} attempt`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name,
      });

      showNotificationMessage(`${attempt.attemptType} attempt cancelled`, 'success');
      window.location.reload();
    } catch (err) {
      console.error('Error cancelling attempt:', err);
      showNotificationMessage('Failed to cancel attempt', 'error');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedAttempts.length === 0) return;

    try {
      const attemptsToProcess = contactAttempts.filter(a => selectedAttempts.includes(a.id));
      
      for (const attempt of attemptsToProcess) {
        if (action === 'execute') {
          await handleStartAttempt(attempt);
        } else if (action === 'cancel') {
          await handleCancelAttempt(attempt);
        }
      }

      showNotificationMessage(`Bulk ${action} completed for ${selectedAttempts.length} attempt(s)`, 'success');
    setSelectedAttempts([]);
      window.location.reload();
    } catch (err) {
      console.error('Error in bulk action:', err);
      showNotificationMessage('Failed to process bulk action', 'error');
    }
  };

  const loadLeadOptions = async (search = leadOptionSearchTerm) => {
    setIsLoadingLeads(true);
    try {
      const leads = await searchLeadOptions({
        search,
        limit: 50,
        activeOnly: true,
        userId: user?.role === 'Agent' ? user.id : undefined,
      });
      setAvailableLeads(leads);
    } catch (err) {
      console.error('Error searching lead options:', err);
      showNotificationMessage('Failed to load leads', 'error');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (!showNewAttemptModal && !showBatchModal) {
      setAvailableLeads([]);
      setLeadOptionSearchTerm('');
      setSelectedLeadOptions(new Map());
      return;
    }

    const timer = setTimeout(() => {
      loadLeadOptions(leadOptionSearchTerm);
    }, 450);

    return () => clearTimeout(timer);
  }, [showNewAttemptModal, showBatchModal, leadOptionSearchTerm, user?.id, user?.role]);

  const handleNewAttempt = async () => {
    setShowNewAttemptModal(true);
    setLeadOptionSearchTerm('');
  };

  const handleScheduleBatch = async () => {
    setShowBatchModal(true);
    setLeadOptionSearchTerm('');
  };

  const handleSaveNewAttempt = async () => {
    if (!newAttempt.leadId || !newAttempt.scheduledDate || !newAttempt.scheduledTime) {
      showNotificationMessage('Please fill in all required fields', 'error');
      return;
    }

    try {
      const selectedLead = getLeadOption(newAttempt.leadId);
      if (!selectedLead) {
        showNotificationMessage('Selected lead not found', 'error');
        return;
      }

      const scheduledDateTime = new Date(`${newAttempt.scheduledDate}T${newAttempt.scheduledTime}`);
      const dueDateStr = scheduledDateTime.toISOString().split('T')[0];
      const dueTimeStr = scheduledDateTime.toTimeString().slice(0, 5);

      const taskTitle = `${newAttempt.attemptType} - ${selectedLead.name}`;
      const taskDescription = `Contact attempt: ${newAttempt.attemptType}${newAttempt.notes ? `\nNotes: ${newAttempt.notes}` : ''}`;

      const taskData = {
        leadId: newAttempt.leadId,
        assignedTo: selectedLead.assignedTo || user?.id || '',
        taskType: newAttempt.attemptType,
        title: taskTitle,
        description: taskDescription,
        dueDate: dueDateStr,
        dueTime: dueTimeStr,
        priority: newAttempt.priority,
        status: 'Pending' as const
      };

      const created = await createTask(taskData);

      if (created) {
        // Log activity
        await logActivity({
          activityType: 'contact_attempt',
          entityType: 'contact_attempt',
          entityId: created.id,
          leadId: newAttempt.leadId,
          leadName: selectedLead.name,
          actionDescription: `Scheduled ${newAttempt.attemptType} attempt`,
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name,
          metadata: { notes: newAttempt.notes }
        });

        showNotificationMessage('Contact attempt scheduled successfully!', 'success');
        setShowNewAttemptModal(false);
        setNewAttempt({
          leadId: '',
          attemptType: 'Call',
          scheduledDate: '',
          scheduledTime: '',
          priority: 'Medium',
          notes: ''
        });
        // Reload data
        window.location.reload();
      } else {
        showNotificationMessage('Failed to schedule attempt', 'error');
      }
    } catch (err) {
      console.error('Error scheduling attempt:', err);
      showNotificationMessage('Failed to schedule attempt', 'error');
    }
  };

  const handleSaveBatchAttempts = async () => {
    if (selectedBatchLeads.length === 0) {
      showNotificationMessage('Please select at least one lead', 'error');
      return;
    }

    if (!batchSettings.startDate || !batchSettings.startTime) {
      showNotificationMessage('Please set the start date and time', 'error');
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedBatchLeads.length; i++) {
        const leadId = selectedBatchLeads[i];
        const selectedLead = getLeadOption(leadId);
        if (!selectedLead) {
          failCount++;
          continue;
        }

        // Calculate scheduled date for this lead (spread over intervalDays)
        const startDate = new Date(`${batchSettings.startDate}T${batchSettings.startTime}`);
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + (i * batchSettings.intervalDays));
        
        const dueDateStr = scheduledDate.toISOString().split('T')[0];
        const dueTimeStr = scheduledDate.toTimeString().slice(0, 5);

        const taskTitle = `${batchSettings.attemptType} - ${selectedLead.name}`;
        const taskDescription = `Batch scheduled ${batchSettings.attemptType} attempt`;

        const taskData = {
          leadId: leadId,
          assignedTo: selectedLead.assignedTo || user?.id || '',
          taskType: batchSettings.attemptType,
          title: taskTitle,
          description: taskDescription,
          dueDate: dueDateStr,
          dueTime: dueTimeStr,
          priority: batchSettings.priority,
          status: 'Pending' as const
        };

        const created = await createTask(taskData);

        if (created) {
          await logActivity({
            activityType: 'contact_attempt',
            entityType: 'contact_attempt',
            entityId: created.id,
            leadId: leadId,
            leadName: selectedLead.name,
            actionDescription: `Batch scheduled ${batchSettings.attemptType} attempt`,
            doneByType: 'user',
            doneById: user?.id,
            doneByName: user?.name,
          });
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        showNotificationMessage(`Successfully scheduled ${successCount} attempt(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        setShowBatchModal(false);
        setSelectedBatchLeads([]);
        setBatchSettings({
          attemptType: 'Call',
          startDate: '',
          startTime: '',
          priority: 'Medium',
          intervalDays: 1
        });
        // Reload data
        window.location.reload();
      } else {
        showNotificationMessage('Failed to schedule batch attempts', 'error');
      }
    } catch (err) {
      console.error('Error scheduling batch attempts:', err);
      showNotificationMessage('Failed to schedule batch attempts', 'error');
    }
  };

  const handleToggleBatchLead = (leadId: string) => {
    const lead = availableLeads.find(l => l.id === leadId);
    if (lead && !selectedBatchLeads.includes(leadId)) {
      rememberLeadOption(lead);
    }
    setSelectedBatchLeads(prev => 
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAttempts.length === filteredAttempts.length) {
      setSelectedAttempts([]);
    } else {
      setSelectedAttempts(filteredAttempts.map(attempt => attempt.id));
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#011E41]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {showNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notificationType === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notificationMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Attempts</h1>
          <p className="text-gray-600">Track and manage lead contact attempts</p>
        </div>
        <div className="flex space-x-3">
          <button 
            className="btn-secondary flex items-center space-x-2"
            onClick={handleScheduleBatch}
          >
            <Calendar className="h-5 w-5" />
            <span>Schedule Batch</span>
          </button>
          <button 
            className="btn-primary flex items-center space-x-2"
            onClick={handleNewAttempt}
          >
            <Phone className="h-5 w-5" />
            <span>New Attempt</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, tone: 'bg-blue-500', onClick: () => applyStatusFilter('Scheduled') },
          { label: 'In Progress', value: stats.inProgress, icon: Play, tone: 'bg-yellow-500', onClick: () => applyStatusFilter('In Progress') },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, tone: 'bg-green-500', onClick: () => applyStatusFilter('Completed') },
          { label: 'Failed', value: stats.failed, icon: XCircle, tone: 'bg-red-500', onClick: () => applyStatusFilter('Failed') },
          { label: 'Calls', value: stats.calls, icon: Phone, tone: 'bg-[#011E41]', onClick: () => applyTypeFilter('Call') },
          { label: 'SMS', value: stats.sms, icon: MessageSquare, tone: 'bg-purple-500', onClick: () => applyTypeFilter('SMS') },
          { label: 'Email', value: stats.email, icon: Mail, tone: 'bg-sky-500', onClick: () => applyTypeFilter('Email') },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="card text-left transition hover:-translate-y-0.5 hover:border-[#011E41]/30 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['today', 'yesterday', 'last7', 'last30'] as ContactDatePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                datePreset === preset
                  ? 'bg-[#011E41] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {datePresetLabel(preset)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by lead name, phone, email, or agent..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select 
              className="input-field"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Call">Call</option>
              <option value="SMS">SMS</option>
              <option value="Email">Email</option>
            </select>
            <select 
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                {chip}
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-gray-500 hover:text-[#011E41]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedAttempts.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedAttempts.length} attempt(s) selected
            </span>
            <div className="flex space-x-2">
              <button 
                className="btn-primary text-sm"
                onClick={() => handleBulkAction('execute')}
              >
                Execute Selected
              </button>
              <button 
                className="btn-danger text-sm"
                onClick={() => handleBulkAction('cancel')}
              >
                Cancel Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Attempts Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header w-12">
                  <input
                    type="checkbox"
                    checked={selectedAttempts.length === filteredAttempts.length && filteredAttempts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                  />
                </th>
                <th className="table-header text-left">Lead</th>
                <th className="table-header text-left w-20">Type</th>
                <th className="table-header text-left w-32">Status</th>
                <th className="table-header text-left w-32">Agent</th>
                <th className="table-header text-left w-40">Date/Time</th>
                <th className="table-header text-left w-20">Attempt</th>
                <th className="table-header text-left w-24">Priority</th>
                <th className="table-header text-left w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAttempts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8 text-gray-500">
                    No contact attempts found
                  </td>
                </tr>
              ) : (
                paginatedAttempts.map((attempt) => (
                <tr key={attempt.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      checked={selectedAttempts.includes(attempt.id)}
                      onChange={() => handleSelectAttempt(attempt.id)}
                      className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                    />
                  </td>
                  <td className="table-cell py-2">
                    <div className="min-w-[160px] max-w-[260px]">
                        <button
                          onClick={() => handleViewLead(attempt.leadId)}
                          className="block text-left text-sm font-medium leading-5 text-gray-900 hover:text-[#011E41]"
                          title={attempt.leadName}
                        >
                          {attempt.leadName}
                        </button>
                      <div className="break-words text-xs leading-5 text-gray-500" title={attempt.leadPhone}>{attempt.leadPhone}</div>
                      <div className="break-all text-xs leading-5 text-gray-500" title={attempt.leadEmail}>{attempt.leadEmail}</div>
                      {attempt.sourceLabel && (
                        <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                          {attempt.sourceLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell py-2">
                    <div className="flex items-center space-x-1">
                      {getTypeIcon(attempt.attemptType)}
                      <span className="text-xs font-medium text-gray-900">{attempt.attemptType}</span>
                    </div>
                  </td>
                  <td className="table-cell py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(attempt.status)}`}>
                        {attempt.status}
                      </span>
                  </td>
                  <td className="table-cell py-2">
                    <div className="max-w-[180px] break-words text-xs leading-5 text-gray-900" title={attempt.agentName}>
                      {attempt.agentName}
                    </div>
                  </td>
                  <td className="table-cell py-2">
                    <div className="text-xs text-gray-900 whitespace-nowrap">
                      {new Date(attempt.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                      <br />
                      {new Date(attempt.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="table-cell py-2">
                    <div className="text-xs font-medium text-gray-900">
                      {attempt.attemptNumber}/{attempt.maxAttempts}
                    </div>
                    {attempt.attemptNumber >= attempt.maxAttempts && (
                      <div className="text-xs text-red-600">Max</div>
                    )}
                  </td>
                  <td className="table-cell py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(attempt.priority)}`}>
                      {attempt.priority}
                    </span>
                  </td>
                  <td className="table-cell py-2">
                    <div className="flex space-x-1 flex-wrap">
                      <button 
                        className="text-gray-400 hover:text-gray-600" 
                        title="View Details"
                        onClick={() => handleViewAttempt(attempt)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {attempt.callRecordId && (
                        <button
                          className="text-indigo-400 hover:text-indigo-600"
                          title="View call"
                          onClick={() => navigate(`/call-analysis?callId=${attempt.callRecordId}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {attempt.status === 'Scheduled' && (
                        <>
                          <button 
                            className="text-green-400 hover:text-green-600" 
                            title="Start Now"
                            onClick={() => handleStartAttempt(attempt)}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            className="text-blue-400 hover:text-blue-600" 
                            title="Reschedule"
                            onClick={() => handleRescheduleAttempt(attempt)}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            className="text-red-400 hover:text-red-600" 
                            title="Cancel"
                            onClick={() => handleCancelAttempt(attempt)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {attempt.status === 'In Progress' && (
                      <button 
                          className="text-green-400 hover:text-green-600" 
                          title="Complete"
                          onClick={() => handleCompleteAttempt(attempt)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredAttempts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, filteredAttempts.length)}</span> of{' '}
            <span className="font-medium">{filteredAttempts.length}</span> results
                  </div>
          <div className="flex items-center space-x-2">
            <button
              className="btn-secondary text-sm flex items-center space-x-1"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            <div className="flex space-x-1">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-[#011E41] text-white font-medium'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setCurrentPage(page as number)}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>
            <button
              className="btn-secondary text-sm flex items-center space-x-1"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Attempt Details Modal */}
      {showAttemptModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Contact Attempt Details</h3>
                <button
                  onClick={() => setShowAttemptModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
                </div>
              </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead</label>
                  <button
                    onClick={() => {
                      setShowAttemptModal(false);
                      handleViewLead(selectedAttempt.leadId);
                    }}
                    className="text-[#011E41] hover:underline"
                  >
                    {selectedAttempt.leadName}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex items-center space-x-2">
                    {getTypeIcon(selectedAttempt.attemptType)}
                    <span>{selectedAttempt.attemptType}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAttempt.status)}`}>
                    {selectedAttempt.status}
                </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                  <span>{selectedAttempt.agentName}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled</label>
                  <span>{formatDateTime(selectedAttempt.scheduledAt)}</span>
                </div>
                {selectedAttempt.completedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Completed</label>
                    <span>{formatDateTime(selectedAttempt.completedAt)}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attempt Number</label>
                  <span>{selectedAttempt.attemptNumber}/{selectedAttempt.maxAttempts}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedAttempt.priority)}`}>
                    {selectedAttempt.priority}
                </span>
              </div>
            </div>
              {selectedAttempt.outcome && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                  <p className="text-gray-900">{selectedAttempt.outcome}</p>
        </div>
              )}
              {selectedAttempt.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <p className="text-gray-900">{selectedAttempt.notes}</p>
      </div>
              )}
              {selectedAttempt.sourceLabel && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {selectedAttempt.sourceLabel}
                      </span>
                      <h4 className="mt-2 font-semibold text-gray-900">Linked call context</h4>
                    </div>
                    {selectedAttempt.callRecordId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/call-analysis?callId=${selectedAttempt.callRecordId}`)}
                        className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Call
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-800">
                    {selectedAttempt.callStartedAt && (
                      <p><span className="font-semibold">Call time:</span> {formatDateTime(selectedAttempt.callStartedAt)}</p>
                    )}
                    {selectedAttempt.callAgentName && (
                      <p><span className="font-semibold">Call agent:</span> {selectedAttempt.callAgentName}</p>
                    )}
                    {selectedAttempt.callSummary && (
                      <p><span className="font-semibold">Call summary:</span> {selectedAttempt.callSummary}</p>
                    )}
                    {selectedAttempt.followUpReason && (
                      <p><span className="font-semibold">Follow-up reason:</span> {selectedAttempt.followUpReason}</p>
                    )}
                    {selectedAttempt.recommendedAction && (
                      <p><span className="font-semibold">Recommended action:</span> {selectedAttempt.recommendedAction}</p>
                    )}
                  </div>
                </div>
              )}
    </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={() => setShowAttemptModal(false)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowAttemptModal(false);
                  handleViewLead(selectedAttempt.leadId);
                }}
              >
                View Lead
              </button>
              {selectedAttempt.callRecordId && (
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/call-analysis?callId=${selectedAttempt.callRecordId}`)}
                >
                  View Call
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Reschedule Attempt</h3>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={() => setShowRescheduleModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveReschedule}
                disabled={!rescheduleDate || !rescheduleTime}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Attempt Modal */}
      {showNewAttemptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Schedule New Contact Attempt</h3>
                <button
                  onClick={() => {
                    setShowNewAttemptModal(false);
                    setNewAttempt({
                      leadId: '',
                      attemptType: 'Call',
                      scheduledDate: '',
                      scheduledTime: '',
                      priority: 'Medium',
                      notes: ''
                    });
                    setLeadOptionSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Lead *</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    className="input-field"
                    value={leadOptionSearchTerm}
                    onChange={(e) => setLeadOptionSearchTerm(e.target.value)}
                    placeholder="Search leads by name, email, phone, or reference..."
                  />
                  {isLoadingLeads ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Searching leads...</span>
                    </div>
                  ) : (
                    <>
                  <select
                    className="input-field"
                    value={newAttempt.leadId}
                    onChange={(e) => {
                      const lead = availableLeads.find(l => l.id === e.target.value);
                      rememberLeadOption(lead);
                      setNewAttempt({...newAttempt, leadId: e.target.value});
                    }}
                    required
                  >
                    <option value="">Select a lead...</option>
                    {availableLeads.map(lead => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name} {lead.email ? `(${lead.email})` : ''} {lead.shortCode ? `- ${lead.shortCode}` : ''} - Owner: {lead.assignedToName || (lead.assignedTo ? 'Assigned' : 'Unassigned')}
                      </option>
                    ))}
                  </select>
                      {availableLeads.length === 0 && (
                        <p className="text-sm text-gray-500">
                          {leadOptionSearchTerm.trim() ? 'No leads found. Try a different search.' : 'Type to search leads, or choose from the most recent active leads.'}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {newAttempt.leadId && (() => {
                  const selectedLead = getLeadOption(newAttempt.leadId);
                  if (!selectedLead) return null;
                  return (
                    <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
                      <div className="font-medium text-gray-900">{selectedLead.name}</div>
                      <div className="text-gray-600">
                        {[selectedLead.email, selectedLead.phone, selectedLead.shortCode].filter(Boolean).join(' • ')}
                      </div>
                      <div className="mt-1 text-xs font-medium text-blue-800">
                        Owner: {selectedLead.assignedToName || (selectedLead.assignedTo ? 'Assigned' : 'Unassigned')}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attempt Type *</label>
                <select
                  className="input-field"
                  value={newAttempt.attemptType}
                  onChange={(e) => setNewAttempt({...newAttempt, attemptType: e.target.value as 'Call' | 'SMS' | 'Email'})}
                >
                  <option value="Call">Call</option>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={newAttempt.scheduledDate}
                    onChange={(e) => setNewAttempt({...newAttempt, scheduledDate: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time *</label>
                  <input
                    type="time"
                    className="input-field"
                    value={newAttempt.scheduledTime}
                    onChange={(e) => setNewAttempt({...newAttempt, scheduledTime: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  className="input-field"
                  value={newAttempt.priority}
                  onChange={(e) => setNewAttempt({...newAttempt, priority: e.target.value as 'High' | 'Medium' | 'Low'})}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={newAttempt.notes}
                  onChange={(e) => setNewAttempt({...newAttempt, notes: e.target.value})}
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowNewAttemptModal(false);
                  setNewAttempt({
                    leadId: '',
                    attemptType: 'Call',
                    scheduledDate: '',
                    scheduledTime: '',
                    priority: 'Medium',
                    notes: ''
                  });
                  setLeadOptionSearchTerm('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveNewAttempt}
                disabled={!newAttempt.leadId || !newAttempt.scheduledDate || !newAttempt.scheduledTime}
              >
                Schedule Attempt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Schedule Batch Contact Attempts</h3>
                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    setSelectedBatchLeads([]);
                    setLeadOptionSearchTerm('');
                    setBatchSettings({
                      attemptType: 'Call',
                      startDate: '',
                      startTime: '',
                      priority: 'Medium',
                      intervalDays: 1
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Batch Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Batch Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attempt Type *</label>
                    <select
                      className="input-field"
                      value={batchSettings.attemptType}
                      onChange={(e) => setBatchSettings({...batchSettings, attemptType: e.target.value as 'Call' | 'SMS' | 'Email'})}
                    >
                      <option value="Call">Call</option>
                      <option value="SMS">SMS</option>
                      <option value="Email">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      className="input-field"
                      value={batchSettings.priority}
                      onChange={(e) => setBatchSettings({...batchSettings, priority: e.target.value as 'High' | 'Medium' | 'Low'})}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={batchSettings.startDate}
                      onChange={(e) => setBatchSettings({...batchSettings, startDate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                    <input
                      type="time"
                      className="input-field"
                      value={batchSettings.startTime}
                      onChange={(e) => setBatchSettings({...batchSettings, startTime: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Interval (Days)</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={batchSettings.intervalDays}
                      onChange={(e) => setBatchSettings({...batchSettings, intervalDays: parseInt(e.target.value) || 0})}
                    />
                    <p className="text-xs text-gray-500 mt-1">Days between each attempt (0 = all on same day)</p>
                  </div>
                </div>
              </div>

              {/* Select Leads */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Select Leads ({selectedBatchLeads.length} selected)</h4>
                <input
                  type="text"
                  className="input-field mb-3"
                  value={leadOptionSearchTerm}
                  onChange={(e) => setLeadOptionSearchTerm(e.target.value)}
                  placeholder="Search leads by name, email, phone, or reference..."
                />
                {isLoadingLeads ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching leads...</span>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <button
                        type="button"
                        className="text-sm text-[#011E41] hover:underline"
                        onClick={() => {
                          if (selectedBatchLeads.length === availableLeads.length) {
                            setSelectedBatchLeads([]);
                          } else {
                            availableLeads.forEach(rememberLeadOption);
                            setSelectedBatchLeads(availableLeads.map(l => l.id));
                          }
                        }}
                      >
                        {selectedBatchLeads.length === availableLeads.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="ml-3 text-xs text-gray-500">Showing up to 50 matching active leads</span>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {availableLeads.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">
                          {leadOptionSearchTerm.trim() ? 'No leads found. Try a different search.' : 'Type to search leads, or choose from the most recent active leads.'}
                        </div>
                      )}
                      {availableLeads.map(lead => (
                        <label
                          key={lead.id}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBatchLeads.includes(lead.id)}
                            onChange={() => handleToggleBatchLead(lead.id)}
                            className="rounded border-gray-300 text-[#011E41] focus:ring-[#011E41]"
                          />
                          <div className="ml-3 flex-1">
                            <div className="font-medium text-gray-900">{lead.name}</div>
                            <div className="text-sm text-gray-500">{lead.email} • {lead.phone}</div>
                            <div className="text-xs text-gray-500">
                              Owner: {lead.assignedToName || (lead.assignedTo ? 'Assigned' : 'Unassigned')}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowBatchModal(false);
                  setSelectedBatchLeads([]);
                  setLeadOptionSearchTerm('');
                  setBatchSettings({
                    attemptType: 'Call',
                    startDate: '',
                    startTime: '',
                    priority: 'Medium',
                    intervalDays: 1
                  });
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveBatchAttempts}
                disabled={selectedBatchLeads.length === 0 || !batchSettings.startDate || !batchSettings.startTime}
              >
                Schedule {selectedBatchLeads.length} Attempt(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
