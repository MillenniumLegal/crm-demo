import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LeadSidebar } from '@/components/Layout/LeadSidebar';
import { AttentionStatCard } from '@/components/AttentionStatCard';
import { CrmCallAiAnalysis, CrmCallRecord, Lead } from '@/types';
import {
  fetchLeadsPage,
  fetchLeadById,
  createLead,
  updateLead,
  assignLeads,
  archiveLeadsForFunnel,
  deleteLeads,
  fetchLeadSummary,
  markLeadInstructed,
  unmarkLeadInstructed,
  updateCallbackStatus,
  updateInstructionRequestStatus,
  fetchLatestInstructionMarkedEvent,
  fetchInstructionTrackerLeads,
  fetchClaimedTodayLeadIds,
  restoreFunnelArchivedLeads,
  fetchFunnelArchivePreview,
  FunnelArchivePreviewRow,
} from '@/services/leadsService';
import { supabase } from '@/lib/supabase';
import { logActivity, fetchContactAttempts, ActivityLog } from '@/services/activityService';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate, CommunicationTemplate } from '@/services/templatesService';
import { canAgentClaimLead, canAgentReceiveLead, getAgentQuotaStatus } from '@/services/quotaService';
import { fetchQuotes, fetchQuotesForLeadIds, ensureQuoteAcceptanceToken, updateQuote } from '@/services/quotesService';
import { createTask } from '@/services/tasksService';
import { buildQuotePdf } from '@/utils/quotePdf';
import { generateQuoteEmailHTML, generateQuoteEmailText } from '@/utils/quoteEmailTemplate';
import { buildInstructionPdf } from '@/utils/instructionPdf';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};
import { processOutcomeCode } from '@/services/outcomeCodeService';
import { sendOutlookEmail, fetchOutlookStatus, scheduleOutlookEmail } from '@/services/outlookService';
import { sendSMS, fetchTwilioStatus } from '@/services/smsService';
import { SolicitorInstructionModal } from '@/components/SolicitorInstructionModal';
import { AssignLeadModal } from '@/components/AssignLeadModal';
import { QuoteNotificationPopup, QuoteNotification } from '@/components/QuoteNotificationPopup';
import { fetchQuoteNotifications, markNotificationRead } from '@/services/quoteNotificationsService';
import { analyzeThreeCxCall, fetchCallAnalyses, fetchLeadCallRecords } from '@/services/threecxService';
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  UserMinus,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit,
  Calendar,
  Target,
  TrendingUp,
  X,
  FileText,
  CreditCard,
  History,
  Send,
  Save,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Loader2,
  Trash2,
  Building2,
  Copy,
  Link as LinkIcon,
  Download,
  RotateCcw,
  RefreshCw,
  Archive
} from 'lucide-react';

const LEAD_SOURCE_OPTIONS = [
  'Comparison - The Move Exchange',
  'Comparison - Cheap Conveyancing',
  'Comparison - Compare Conveyancing Prices',
  'Comparison Site',
  'Hoowla',
  'Direct',
  'Referral',
];

const LEAD_STATUS_OPTIONS = [
  'New',
  'Assigned',
  'Contacted',
  'Interested',
  'Quote Sent',
  'Sold',
  'Closed',
  'Archived',
];

const AGENT_INACTIVE_STATUSES = [
  'Sold',
  'Closed',
  'Archived',
  'Cancelled',
  'Canceled',
  'Dead',
  'Lost',
  'Gone Elsewhere',
  'Not Proceeding',
  'Completed',
  'Instructed',
];

const parseStatusQueryParam = (value: string | null) =>
  value
    ? value
        .split(',')
        .map(status => status.trim())
        .filter(Boolean)
    : [];

const getInitialLeadManagementUrlState = () => {
  if (typeof window === 'undefined') {
    return {
      selectedStage: 'all',
      filterStatus: 'All',
      filterAge: 'All',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  const stage = params.get('stage');
  const filterAge = params.get('filterAge');
  const statusValues = parseStatusQueryParam(params.get('status'));

  return {
    selectedStage: filter === 'archived' ? 'archived' : filter === 'unassigned' ? 'unassigned' : stage || 'all',
    filterStatus: statusValues.length === 1 && LEAD_STATUS_OPTIONS.includes(statusValues[0])
      ? statusValues[0]
      : filter === 'assigned'
        ? 'Assigned'
        : 'All',
    filterAge: filterAge && ['All', 'New', 'Old', 'Overdue'].includes(filterAge) ? filterAge : 'All',
    statusValues,
  };
};
export const LeadManagement: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const isAgent = user?.role === 'Agent';
  const isManager = user?.role === 'Manager';
  const canManageArchive = user?.role === 'Admin' || user?.role === 'Manager';
  const canViewCardAttribution = isAgent || isManager;
  const canViewFullAttribution = isManager;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialUrlState = useMemo(() => getInitialLeadManagementUrlState(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState(initialUrlState.filterStatus);
  const [urlStatusValues, setUrlStatusValues] = useState<string[]>(initialUrlState.statusValues ?? []);
  const [filterSource, setFilterSource] = useState('All');
  const [filterAge, setFilterAge] = useState(initialUrlState.filterAge);
  const [selectedStage, setSelectedStage] = useState(initialUrlState.selectedStage);
  // Advanced filters state - must be declared before loadLeads callback
  const [advancedFilters, setAdvancedFilters] = useState({
    dateRange: '',
    source: '',
    priority: '',
    status: '',
    assignedTo: '',
    ageRange: ''
  });

  // Pagination and search state - MUST be defined early for loadLeads (line 164)
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 18; // Optimized for faster loading
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  // Quote notifications state
  const [quoteNotifications, setQuoteNotifications] = useState<QuoteNotification[]>([]);
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [, setNotificationCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [showLeadSidebar, setShowLeadSidebar] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [selectedOutcomeCode, setSelectedOutcomeCode] = useState('');
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false);
  const [showSolicitorInstructionModal, setShowSolicitorInstructionModal] = useState(false);
  const [showCustomReasonModal, setShowCustomReasonModal] = useState(false);
  const [customOutcomeReason, setCustomOutcomeReason] = useState('');
  const [showPaymentExplanationModal, setShowPaymentExplanationModal] = useState(false);
  const [paymentExplanation, setPaymentExplanation] = useState('');
  const [isProcessingOutcome, setIsProcessingOutcome] = useState(false);
  const [showInstructionPdfWarningModal, setShowInstructionPdfWarningModal] = useState(false);
  const [showResetInstructionModal, setShowResetInstructionModal] = useState(false);
  const [isResettingInstruction, setIsResettingInstruction] = useState(false);
  const [showOutcomeResultModal, setShowOutcomeResultModal] = useState(false);
  const [outcomeResult, setOutcomeResult] = useState<{ success: boolean; message: string; outcomeCode?: string } | null>(null);
  const [contactAttempts, setContactAttempts] = useState<ActivityLog[]>([]);
  const [showAttributionDetails, setShowAttributionDetails] = useState(false);
  const [activeLeadManagementView, setActiveLeadManagementView] = useState<'leads' | 'instructions'>('leads');
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [instructionLead, setInstructionLead] = useState<Lead | null>(null);
  const [instructionNote, setInstructionNote] = useState('');
  const [instructionEffectiveDate, setInstructionEffectiveDate] = useState('');
  const [isSavingInstructionMark, setIsSavingInstructionMark] = useState(false);
  const [instructionStartDate, setInstructionStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [instructionEndDate, setInstructionEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [instructionAgentFilter, setInstructionAgentFilter] = useState('all');
  const [instructionTrackerLeads, setInstructionTrackerLeads] = useState<Lead[]>([]);
  const [todayInstructionLeads, setTodayInstructionLeads] = useState<Lead[]>([]);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
  const [latestInstructionMarkedAt, setLatestInstructionMarkedAt] = useState<string | null>(null);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [editDetailsForm, setEditDetailsForm] = useState({
    name: '',
    email: '',
    phone: '',
    source: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High'
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isLoadingContactAttempts, setIsLoadingContactAttempts] = useState(false);
  const [contactAttemptsPage, setContactAttemptsPage] = useState(1);
  const CONTACT_ATTEMPTS_PER_PAGE = 4;
  const [showScheduleTaskModal, setShowScheduleTaskModal] = useState(false);
  const [scheduleTaskForm, setScheduleTaskForm] = useState<{
    taskType: string;
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    priority: 'High' | 'Medium' | 'Low';
  }>({
    taskType: 'Call',
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '',
    priority: 'Medium',
  });
  const [scheduleTaskError, setScheduleTaskError] = useState<string | null>(null);
  const [isSchedulingTask, setIsSchedulingTask] = useState(false);
  const [taskToast, setTaskToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const loadLeadsRequestRef = useRef(0);
  const getToday = () => new Date().toISOString().split('T')[0];

  const buildLeadQuotesMap = useCallback((quotes: Awaited<ReturnType<typeof fetchQuotesForLeadIds>>) => {
    const quotesMap = new Map<string, any[]>();

    quotes.forEach((quote) => {
      if (!quote.leadId) return;
      if (!quotesMap.has(quote.leadId)) {
        quotesMap.set(quote.leadId, []);
      }
      quotesMap.get(quote.leadId)!.push(quote);
    });

    quotesMap.forEach((leadQuotes) => {
      leadQuotes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return quotesMap;
  }, []);

  const handleOpenScheduleTaskModal = useCallback(() => {
    if (!selectedLead) return;
    setScheduleTaskForm({
      taskType: 'Call',
      title: selectedLead.name ? `Follow up with ${selectedLead.name}` : 'Follow up task',
      description: '',
      dueDate: getToday(),
      dueTime: '',
      priority: 'Medium',
    });
    setScheduleTaskError(null);
    setShowScheduleTaskModal(true);
  }, [selectedLead]);

  const handleCloseScheduleTaskModal = useCallback(() => {
    setShowScheduleTaskModal(false);
    setScheduleTaskError(null);
  }, []);

  const handleScheduleTaskFieldChange = useCallback(
    <K extends keyof typeof scheduleTaskForm>(field: K, value: (typeof scheduleTaskForm)[K]) => {
      setScheduleTaskForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  useEffect(() => {
    if (!taskToast) return;
    const timeout = setTimeout(() => setTaskToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [taskToast]);

  useEffect(() => {
    setShowAttributionDetails(false);
  }, [selectedLead?.id]);

  // Fetch leads from Supabase - optimized with server-side pagination
  // MUST be defined BEFORE any callbacks that use it (e.g., handleCreateFollowUpTask at line 164)
  const loadLeads = useCallback(async () => {
    // Don't fetch if auth is still loading or user is not available
    if (authLoading || !user) {
      return;
    }

    const requestId = ++loadLeadsRequestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const urlFilterParam = searchParams.get('filter');
      const isAssignedFilter = filterStatus === 'Assigned' || urlFilterParam === 'assigned';
      const filters: any = {
        status: filterStatus !== 'All' ? filterStatus : undefined,
        statusIn: urlStatusValues.length > 0 ? urlStatusValues : undefined,
        stage: selectedStage !== 'all' ? selectedStage : undefined,
        source: filterSource !== 'All' ? filterSource : undefined,
        searchTerm: debouncedSearchTerm || undefined,
        // Add priority filter from advanced filters if set
        priority: advancedFilters.priority || undefined,
      };

      const ageThresholdIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      if (filterAge === 'New') {
        filters.createdAfter = ageThresholdIso;
        filters.excludeInactive = true;
      } else if (filterAge === 'Old') {
        filters.createdBefore = ageThresholdIso;
        filters.excludeInactive = true;
      } else if (filterAge === 'Overdue') {
        filters.isOverdue = true;
        filters.excludeInactive = true;
      }

      if (selectedStage === 'archived' || selectedStage.startsWith('archived:')) {
        if (canManageArchive) {
          filters.archivedLeadsOnly = true;
          filters.includeArchivedLeads = true;
          // "archived:<category>" narrows to one disqualify reason (fake/duplicate/etc).
          // "archived:all" (and bare "archived") show every archived lead.
          const archivedCategory = selectedStage.includes(':') ? selectedStage.split(':')[1] : undefined;
          if (archivedCategory && archivedCategory !== 'all') filters.archivedCategory = archivedCategory;
          delete filters.stage;
          delete filters.status;
          delete filters.statusIn;
          delete filters.assignedOnly;
          delete filters.isOverdue;
        } else {
          filters.leadIds = [];
          delete filters.stage;
        }
      }

      // Handle "Assigned" filter - use assignedOnly instead of status='Assigned'
      // This matches the count which uses assignedActive (leads with assigned_to not null)
      if (isAssignedFilter) {
        filters.assignedOnly = true;
        // Remove status filter when using assignedOnly (they might have different statuses)
        delete filters.status;
      }

      // For agents:
      // - Default/assigned/claimed views are scoped to the logged-in agent.
      // - Unassigned shows active available leads they can claim.
      // - Claimed Today is driven by assignment activity and then intersected with leads still assigned to them.
      if (user?.role === 'Agent' && user?.id) {
        const hasExplicitStatusFilter = urlStatusValues.length > 0 || filterStatus !== 'All';

        if (selectedStage === 'unassigned') {
          filters.stage = 'unassigned';
          filters.excludeInactive = true;
        } else if (selectedStage === 'claimed-today') {
          const claimedTodayIds = await fetchClaimedTodayLeadIds(user.id);
          filters.leadIds = claimedTodayIds;
          filters.userId = user.id;
          filters.excludeInactive = true;
          delete filters.stage;
          delete filters.status;
          delete filters.statusIn;
          delete filters.assignedOnly;
        } else if (selectedStage === 'my-closed') {
          filters.userId = user.id;
          filters.statusIn = AGENT_INACTIVE_STATUSES.filter(status => status !== 'Instructed');
          delete filters.status;
          delete filters.stage;
          delete filters.assignedOnly;
        } else if (selectedStage === 'team-progress') {
          filters.assignedOnly = true;
          filters.assignedNot = user.id;
          // Team Progress is active-only by default, but agents also use search as
          // an owner lookup for call transfers. When searching, include older/closed
          // assigned leads while keeping the result read-only and contact-safe.
          filters.excludeInactive = !debouncedSearchTerm.trim();
          filters.includeContactSearch = true;
          filters.includeAttributionSearch = false;
          filters.includeLifecycleSearch = true;
          delete filters.stage;
          delete filters.status;
          delete filters.statusIn;
          delete filters.userId;
        } else if (selectedStage === 'instructedToday') {
          filters.instructedToday = true;
          filters.instructionCreditUserId = user.id;
          delete filters.stage;
          delete filters.status;
          delete filters.statusIn;
          delete filters.assignedOnly;
          delete filters.userId;
          delete filters.excludeInactive;
        } else if (selectedStage === 'claimed' || selectedStage === 'my-assigned' || selectedStage === 'all') {
          filters.userId = user.id;
          filters.excludeInactive = !hasExplicitStatusFilter;
          delete filters.stage;
          delete filters.assignedOnly;
        } else if (selectedStage.startsWith('Call-') ||
                   ['New', 'Interested', 'Quote Accepted - Awaiting Payment',
                    'Payment Completed - Awaiting Client Information', 'Ready to Solicit', 'Instructed'].includes(selectedStage)) {
          filters.userId = user.id;
          filters.excludeInactive = !hasExplicitStatusFilter;
        } else if (selectedStage === 'overdue' || selectedStage === 'highPriority') {
          filters.userId = user.id;
          filters.excludeInactive = true;
        } else if (isAssignedFilter) {
          filters.userId = user.id;
          filters.excludeInactive = !hasExplicitStatusFilter;
          delete filters.assignedOnly;
        }
      }

      // Handle special filters (for Admin/Manager)
      if (selectedStage === 'unassigned' && user?.role !== 'Agent') {
        filters.stage = 'unassigned';
      }

      // Handle cancelled stage filter
      if (selectedStage === 'cancelled') {
        filters.stage = 'Cancelled';
        // Don't exclude by status for cancelled leads (they may have status "Closed")
        if (!filters.statusIn) {
          delete filters.status;
        }
      }

      // Handle high priority filter
      if (selectedStage === 'highPriority') {
        filters.priority = 'High';
        // Don't set stage filter for high priority - it's a priority filter, not a stage filter
        delete filters.stage;
        // Active-only: once a lead is instructed/sold/closed/archived it drops out of
        // the High Priority queue (matches the sidebar count + the agent view, and the
        // same way archived leads are excluded). ACTIVE_*_EXCLUDE covers Instructed/Sold.
        filters.excludeInactive = true;
      }

      // Handle milestone filters (filter by outcome code)
      if (selectedStage === 'milestone-incorrect-number') {
        // Include "Incorrect Number", "Wrong Number", and "Number Invalid" for this milestone
        filters.outcomeCode = ['Incorrect Number', 'Wrong Number', 'Number Invalid'];
        delete filters.stage;
      } else if (selectedStage === 'milestone-fake-lead') {
        filters.outcomeCode = 'Fake/Duplicate Quote';
        delete filters.stage;
      } else if (selectedStage === 'milestone-getting-prices') {
        // Database stores "Getting prices" but UI displays as "Just Getting prices"
        filters.outcomeCode = 'Getting prices';
        delete filters.stage;
      } else if (selectedStage === 'milestone-custom-reason') {
        filters.outcomeCode = 'Custom Reason';
        delete filters.stage;
      } else if (selectedStage === 'milestone-gone-elsewhere') {
        filters.outcomeCode = 'Gone Elsewhere';
        delete filters.stage;
      } else if (selectedStage === 'milestone-not-interested') {
        filters.outcomeCode = 'Not Interested';
        delete filters.stage;
      } else if (selectedStage === 'milestone-call-attempts-exceeded') {
        filters.customOutcomeReason = 'Call Attempts Exceeded';
        filters.stage = 'Cancelled';
        filters.status = 'Closed';
      }

      // Handle callback requests queue (comparison-site callbacks requested today).
      // Open callbacks only; managers/admins see all, agents see only their own.
      if (selectedStage === 'callback-requests') {
        filters.callbackOpenOnly = true;
        filters.callbackToday = true;
        delete filters.stage;
        delete filters.status;
        delete filters.statusIn;
        delete filters.assignedOnly;
        delete filters.excludeInactive;
        delete filters.isOverdue;
        if (user?.role === 'Agent' && user?.id) {
          filters.callbackAssignee = user.id;
          delete filters.userId;
        }
      }

      // Handle instruction-request queue (comparison-site "Instruct This Solicitor").
      // Open requests only; managers/admins see all, agents see their own.
      if (selectedStage === 'instruction-requests') {
        filters.instructionRequestOpenOnly = true;
        filters.instructionRequestToday = true;
        delete filters.stage;
        delete filters.status;
        delete filters.statusIn;
        delete filters.assignedOnly;
        delete filters.excludeInactive;
        delete filters.isOverdue;
        if (user?.role === 'Agent' && user?.id) {
          filters.instructionRequestAssignee = user.id;
          delete filters.userId;
        }
      }

      // Handle quote-accepted milestone queue. Managers/admins see ALL accepted
      // leads (including unassigned ones accepted before an agent claimed them);
      // agents see their own.
      if (selectedStage === 'quote-accepted') {
        filters.quoteAcceptedOnly = true;
        delete filters.stage;
        delete filters.status;
        delete filters.statusIn;
        delete filters.assignedOnly;
        delete filters.excludeInactive;
        delete filters.isOverdue;
        if (user?.role === 'Agent' && user?.id) {
          filters.userId = user.id;
        }
      }

      // Handle assignedTo filter from advanced filters
      if (user?.role !== 'Agent' && advancedFilters.assignedTo && advancedFilters.assignedTo !== 'unassigned') {
        filters.assignedTo = advancedFilters.assignedTo;
      }

      // Use server-side pagination for performance (only load current page)
      const offset = (currentPage - 1) * leadsPerPage;
      // For cancelled leads, don't exclude any statuses (they may have "Closed" status)
      // activeOnly: false ensures we don't exclude "Closed" status for cancelled leads
      const result = await fetchLeadsPage(filters, {
        limit: leadsPerPage,
        offset,
        activeOnly: false
      });

      if (requestId !== loadLeadsRequestRef.current) {
        return;
      }

      setLeads(result.leads);
      setTotalLeadsCount(result.total);

      // Fetch quotes in parallel with leads to prevent "No quotes" flash
      if (result.leads.length > 0 && selectedStage !== 'team-progress') {
        try {
          const leadIds = result.leads.map(lead => lead.id);
          const visibleQuotes = await fetchQuotesForLeadIds(leadIds);
          const quotesMap = buildLeadQuotesMap(visibleQuotes);

          if (requestId === loadLeadsRequestRef.current) {
            setLeadQuotesMap(quotesMap);
            lastProcessedKeyRef.current = [...leadIds].sort().join(',');
            loadedLeadIdsRef.current = new Set(leadIds);
          }
        } catch (quoteErr) {
          console.error('Error loading quotes for leads (non-blocking):', quoteErr);
          // Don't block lead loading if quotes fail
          if (requestId === loadLeadsRequestRef.current) {
            setLeadQuotesMap(new Map());
          }
        }
      } else {
        setLeadQuotesMap(new Map());
        lastProcessedKeyRef.current = '';
        loadedLeadIdsRef.current.clear();
      }

      // Adjust current page if offset was corrected (e.g., if we were on page 10 but only 5 pages exist)
      if (result.total > 0) {
        const maxPage = Math.ceil(result.total / leadsPerPage);
        if (currentPage > maxPage && maxPage > 0) {
          // If current page is beyond max, navigate to last valid page
          console.warn(`Page ${currentPage} out of bounds. Adjusting to page ${maxPage}`);
          setCurrentPage(maxPage);
          // Don't reload here - the page adjustment will trigger a re-render
          // and the useEffect will call loadLeads again with the corrected page
        }
      }

      if (requestId === loadLeadsRequestRef.current) {
        setSidebarRefreshKey(prev => prev + 1);
      }
    } catch (err: any) {
      if (requestId !== loadLeadsRequestRef.current) {
        return;
      }
      console.error('Error loading leads:', err);
      // Extract a readable error message
      let errorMessage = 'Failed to load leads. Please try again.';
      if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (err?.details) {
        errorMessage = err.details;
      }
      setError(errorMessage);
      // Still set leads to empty array so component can render
      setLeads([]);
      setTotalLeadsCount(0);
    } finally {
      if (requestId === loadLeadsRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [authLoading, user, searchParams, filterStatus, urlStatusValues, selectedStage, filterSource, filterAge, debouncedSearchTerm, currentPage, leadsPerPage, advancedFilters, buildLeadQuotesMap, canManageArchive]);

  // Fetch quote notifications periodically
  useEffect(() => {
    if (!user || authLoading) return;

    const fetchNotifications = async () => {
      try {
        const notifications = await fetchQuoteNotifications(user.id, user.role);
        // Only show notifications from the last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        const recentNotifications = notifications.filter(n =>
          new Date(n.createdAt) > oneDayAgo
        );
        setQuoteNotifications(recentNotifications);
        if (recentNotifications.length > 0 && currentNotificationIndex === 0) {
          setCurrentNotificationIndex(0);
        }
      } catch (error) {
        console.error('Error fetching quote notifications:', error);
      }
    };

    // Fetch immediately
    fetchNotifications();

    // Then fetch every 2 min, only when tab visible (reduces Supabase load)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, 120000);
    setNotificationCheckInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, authLoading, currentNotificationIndex]);

  const handleNotificationClose = () => {
    if (quoteNotifications.length > 0) {
      const currentNotif = quoteNotifications[currentNotificationIndex];
      if (currentNotif) {
        markNotificationRead(currentNotif.id);
      }

      if (currentNotificationIndex < quoteNotifications.length - 1) {
        setCurrentNotificationIndex(prev => prev + 1);
      } else {
        // All notifications shown, reset
        setQuoteNotifications([]);
        setCurrentNotificationIndex(0);
      }
    }
  };

  const handleNotificationMarkRead = async (id: string) => {
    await markNotificationRead(id);
  };

  const handleCreateFollowUpTask = useCallback(async () => {
    if (!selectedLead) {
      setScheduleTaskError('Select a lead before scheduling a task.');
      return;
    }
    if (!scheduleTaskForm.dueDate) {
      setScheduleTaskError('Please choose a due date.');
      return;
    }

    const assignedTo = selectedLead.assignedTo || user?.id || '';
    if (!assignedTo) {
      setScheduleTaskError('Unable to determine who should own this task.');
      return;
    }

    const title =
      scheduleTaskForm.title.trim() || (selectedLead.name ? `Follow up with ${selectedLead.name}` : 'Follow up task');

    setScheduleTaskError(null);
    setIsSchedulingTask(true);
    try {
      const newTask = await createTask({
        leadId: selectedLead.id,
        assignedTo,
        taskType: scheduleTaskForm.taskType as 'Call' | 'SMS' | 'Email' | 'Follow-up' | 'Quote' | 'Payment',
        title,
        description: scheduleTaskForm.description,
        dueDate: scheduleTaskForm.dueDate,
        dueTime: scheduleTaskForm.dueTime || undefined,
        priority: scheduleTaskForm.priority,
        status: 'Pending',
      });

      if (!newTask) {
        throw new Error('Task creation returned no data');
      }

      if (!selectedLead.assignedTo || selectedLead.assignedTo !== assignedTo) {
        try {
          await updateLead(selectedLead.id, { assignedTo }, user?.role, user?.id);
        } catch (updateError) {
          console.error('Error assigning lead to scheduler:', updateError);
        }
      }

      setShowScheduleTaskModal(false);
      setTaskToast({ type: 'success', message: 'Follow-up task scheduled successfully.' });
      await loadLeads();
    } catch (error) {
      console.error('Error scheduling follow-up task:', error);
      setScheduleTaskError('Failed to schedule the task. Please try again.');
      setTaskToast({ type: 'error', message: 'Failed to schedule the task. Please try again.' });
    } finally {
      setIsSchedulingTask(false);
    }
  }, [selectedLead, scheduleTaskForm, user?.id, loadLeads]);

  const [linkNotification, setLinkNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCopyingPaymentLink, setIsCopyingPaymentLink] = useState(false);
  const [isCopyingInstructionLink, setIsCopyingInstructionLink] = useState(false);

  const handleGetPaymentLink = useCallback(async () => {
    if (!selectedLead) return;
    setIsCopyingPaymentLink(true);

    try {
      // Call Supabase Edge Function instead of Vercel API route
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not configured');
      }
      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const functionUrl = `${baseUrl}/functions/v1/payment-link/${selectedLead.id}`;
      const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        // Try to parse error response, but handle empty responses
        let errorData: any = { error: 'Request failed' };
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const text = await response.text();
            if (text) {
              errorData = JSON.parse(text);
            }
          } catch (parseError) {
            // Response was empty or invalid JSON
            errorData = { error: `Server error: ${response.status} ${response.statusText}` };
          }
        } else {
          errorData = { error: `Server error: ${response.status} ${response.statusText}` };
        }

        const errorMessage = errorData.details ? `${errorData.error || errorData.message || 'Failed to get payment link'}: ${errorData.details}` : (errorData.error || errorData.message || 'Failed to get payment link');
        setLinkNotification({
          type: 'error',
          message: errorMessage
        });
        setTimeout(() => setLinkNotification(null), 5000);
        return;
      }

      // Parse JSON response, handling empty responses
      const text = await response.text();
      if (!text) {
        setLinkNotification({
          type: 'error',
          message: 'Server returned an empty response. Please check server logs.'
        });
        setTimeout(() => setLinkNotification(null), 5000);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError, 'Response text:', text);
        setLinkNotification({
          type: 'error',
          message: 'Server returned invalid response. Please check server logs.'
        });
        setTimeout(() => setLinkNotification(null), 5000);
        return;
      }

      if (data.success && data.data?.paymentLink) {
        await navigator.clipboard.writeText(data.data.paymentLink);
        setLinkNotification({ type: 'success', message: 'Payment link copied to clipboard!' });
        setTimeout(() => setLinkNotification(null), 3000);
      } else {
        // Extract error message from response, including details if available
        const errorMessage = data.details ? `${data.error || data.message || 'Failed to get payment link'}: ${data.details}` : (data.error || data.message || 'Failed to get payment link');
        setLinkNotification({
          type: 'error',
          message: errorMessage
        });
        setTimeout(() => setLinkNotification(null), 5000); // Show longer for helpful error messages
      }
    } catch (error) {
      console.error('Error getting payment link:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get payment link';

      // Check if it's a network/404 error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('404') || errorMessage.includes('Unexpected end of JSON')) {
      setLinkNotification({
        type: 'error',
          message: 'Unable to connect to payment service. The payment link function may be unavailable. Please try again or contact support.'
        });
      } else {
        setLinkNotification({
          type: 'error',
          message: errorMessage
        });
      }
      setTimeout(() => setLinkNotification(null), 5000);
    } finally {
      setIsCopyingPaymentLink(false);
    }
  }, [selectedLead]);

  const handleGetInstructionLink = useCallback(async () => {
    if (!selectedLead) return;
    setIsCopyingInstructionLink(true);

    try {
      // Call Supabase Edge Function instead of Vercel API route
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not configured');
      }
      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const functionUrl = `${baseUrl}/functions/v1/instruction-link/${selectedLead.id}`;
      const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const data = await response.json();

      if (response.ok && data.success && data.data?.instructionLink) {
        const baseUrl = window.location.origin;
        const fullLink = data.data.instructionLink.startsWith('http')
          ? data.data.instructionLink
          : `${baseUrl}${data.data.instructionLink}`;
        await navigator.clipboard.writeText(fullLink);
        setLinkNotification({ type: 'success', message: 'Instruction form link copied to clipboard!' });
        setTimeout(() => setLinkNotification(null), 3000);
      } else {
        // Use the error message from the server, which includes context about why it's not available
        const errorMessage = data.error || 'Instruction link not available';
        setLinkNotification({
          type: 'error',
          message: errorMessage
        });
        setTimeout(() => setLinkNotification(null), 5000); // Show longer for helpful messages
      }
    } catch (error) {
      console.error('Error getting instruction link:', error);
      setLinkNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to get instruction link'
      });
      setTimeout(() => setLinkNotification(null), 5000); // Show longer for helpful messages
    } finally {
      setIsCopyingInstructionLink(false);
    }
  }, [selectedLead]);

  const [leadQuote, setLeadQuote] = useState<any>(null);
  const [leadQuotes, setLeadQuotes] = useState<any[]>([]); // All quotes for selected lead
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [leadQuotesMap, setLeadQuotesMap] = useState<Map<string, any[]>>(new Map()); // Map of leadId -> quotes[] for card view
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isGeneratingQuoteAttachment, setIsGeneratingQuoteAttachment] = useState(false);
  const [quoteAttachment, setQuoteAttachment] = useState<{
    fileName: string;
    contentType: string;
    contentBytes: string;
  } | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [isOutlookReady, setIsOutlookReady] = useState(false);
  const [isCheckingOutlook, setIsCheckingOutlook] = useState(true);
  const [outlookMailboxEmail, setOutlookMailboxEmail] = useState<string | null>(null);
  const [isTwilioReady, setIsTwilioReady] = useState(false);
  const [isCheckingTwilio, setIsCheckingTwilio] = useState(true);
  const [, setTwilioPhoneNumber] = useState<string | null>(null);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingQuoteEmail, setIsSendingQuoteEmail] = useState(false);
  const [showScheduleEmailModal, setShowScheduleEmailModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSchedulingEmail, setIsSchedulingEmail] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [templateContent, setTemplateContent] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [smsTemplates, setSmsTemplates] = useState<CommunicationTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<CommunicationTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateType, setNewTemplateType] = useState<'SMS' | 'Email'>('SMS');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showTemplateNotificationModal, setShowTemplateNotificationModal] = useState(false);
  const [templateNotificationMessage, setTemplateNotificationMessage] = useState('');
  const [templateNotificationType, setTemplateNotificationType] = useState<'success' | 'error' | 'warning'>('success');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [showLeadNotificationModal, setShowLeadNotificationModal] = useState(false);
  const [leadNotificationMessage, setLeadNotificationMessage] = useState('');
  const [leadNotificationType, setLeadNotificationType] = useState<'success' | 'error'>('success');
  const [showTemplateDeleteConfirmModal, setShowTemplateDeleteConfirmModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<CommunicationTemplate | null>(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [showArchiveByDateModal, setShowArchiveByDateModal] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [bulkArchiveReason, setBulkArchiveReason] = useState('Aged funnel cleanup');
  const [isDeletingLeads, setIsDeletingLeads] = useState(false);
  const [isArchivingLeads, setIsArchivingLeads] = useState(false);
  const [archiveDateFrom, setArchiveDateFrom] = useState('');
  const [archiveDateTo, setArchiveDateTo] = useState('');
  const [archiveStageMode, setArchiveStageMode] = useState<'call-2-5' | 'all'>('call-2-5');
  const [archiveRecentDays, setArchiveRecentDays] = useState(14);
  const [archivePreviewRows, setArchivePreviewRows] = useState<FunnelArchivePreviewRow[]>([]);
  const [archivePreviewTotal, setArchivePreviewTotal] = useState(0);
  const [archivePreviewTruncated, setArchivePreviewTruncated] = useState(false);
  const [archivePreviewSelectedIds, setArchivePreviewSelectedIds] = useState<string[]>([]);
  const [isLoadingArchivePreview, setIsLoadingArchivePreview] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Refs for scrolling
  const modalScrollContainerRef = useRef<HTMLDivElement>(null);
  const communicationCenterRef = useRef<HTMLDivElement>(null);

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'Direct' as const,
    priority: 'Medium' as const,
    status: 'New' as const,
    stage: 'New' as const,
    assignedTo: '',
    transactionType: '' as any,
    notes: '',
    // Property fields
    propertyAddress: '',
    propertyValue: '',
    propertyTenure: '',
    propertyTitleNumber: '',
    propertyRegion: '',
    // Quote-related fields
    legalFees: '',
    sdtlVersion: '',
    numberOfPeople: '1',
    customMessage: '',
    // Client info
    clientAddress: '',
    clientDob: '',
    clientNi: '',
    // Property flags
    isMortgaged: false,
    isUnregistered: false,
    isFirstTimeBuyer: false,
    isNewBuild: false,
    isSharedOwnership: false,
    isBuyToLet: false,
  });
  // Supplements and Disbursements for quote
  const [supplements, setSupplements] = useState<Array<{ id: string; name: string; amount: number }>>([]);
  const [disbursements, setDisbursements] = useState<Array<{ id: string; name: string; amount: number }>>([]);
  const [showAddSupplementModal, setShowAddSupplementModal] = useState(false);
  const [showAddDisbursementModal, setShowAddDisbursementModal] = useState(false);
  const [newSupplementName, setNewSupplementName] = useState('');
  const [newSupplementAmount, setNewSupplementAmount] = useState('');
  const [newDisbursementName, setNewDisbursementName] = useState('');
  const [newDisbursementAmount, setNewDisbursementAmount] = useState('');

  // State for leads and loading
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [leadCallRecords, setLeadCallRecords] = useState<CrmCallRecord[]>([]);
  const [callAnalyses, setCallAnalyses] = useState<CrmCallAiAnalysis[]>([]);
  const [isLoadingLeadCalls, setIsLoadingLeadCalls] = useState(false);
  const [callAiError, setCallAiError] = useState<string | null>(null);
  const [analyzingCallId, setAnalyzingCallId] = useState<string | null>(null);

  // Quota status for agents
  const [quotaStatus, setQuotaStatus] = useState<{
    assignedToday: number;
    quota: number;
    assignedThisWeek?: number;
    weeklyQuota?: number;
    weeklyRemaining?: number;
  } | null>(null);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  const [quotaWarningMessage, setQuotaWarningMessage] = useState('');
  const [showDropModal, setShowDropModal] = useState(false);
  const [leadToDrop, setLeadToDrop] = useState<Lead | null>(null);

  const getQuotaReachedMessage = useCallback(() => {
    if (!quotaStatus) {
      return 'Your lead quota has been reached. Please speak to a manager if you need more capacity.';
    }

    const dailyReached = quotaStatus.assignedToday >= quotaStatus.quota;
    const hasWeeklyQuota = typeof quotaStatus.weeklyQuota === 'number';
    const assignedThisWeek = quotaStatus.assignedThisWeek ?? 0;
    const weeklyReached = hasWeeklyQuota && assignedThisWeek >= (quotaStatus.weeklyQuota ?? 0);

    if (dailyReached && weeklyReached) {
      return `Daily and weekly quotas reached: ${quotaStatus.assignedToday}/${quotaStatus.quota} today and ${assignedThisWeek}/${quotaStatus.weeklyQuota ?? 0} this week.`;
    }

    if (weeklyReached) {
      return `Weekly quota reached: ${assignedThisWeek}/${quotaStatus.weeklyQuota ?? 0} leads assigned this week. Resets Monday UK time.`;
    }

    return `Daily quota reached: ${quotaStatus.assignedToday}/${quotaStatus.quota} leads assigned today. Resets at UK midnight.`;
  }, [quotaStatus]);

  const showQuotaReachedModal = useCallback((message?: string) => {
    setQuotaWarningMessage(message || getQuotaReachedMessage());
    setShowQuotaWarning(true);
    setError(null);
    setSuccessMessage(null);
  }, [getQuotaReachedMessage]);

  const clearLeadDetailUrlParams = useCallback(() => {
    const currentParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : searchParams.toString()
    );

    if (!currentParams.has('leadId') && !currentParams.has('action')) {
      return;
    }

    currentParams.delete('leadId');
    currentParams.delete('action');
    setSearchParams(currentParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeLeadDetail = useCallback(() => {
    clearLeadDetailUrlParams();
    setShowLeadDetail(false);
    setShowCommunicationPanel(false);
    setShowAttributionDetails(false);
    setCallAiError(null);
    setLeadCallRecords([]);
    setCallAnalyses([]);
    setAnalyzingCallId(null);
    setSelectedLead(null);
  }, [clearLeadDetailUrlParams]);

  // Handle URL parameters for filtering and lead selection
  useEffect(() => {
    const filter = searchParams.get('filter');
    const stage = searchParams.get('stage');
    const view = searchParams.get('view');
    const filterAgeParam = searchParams.get('filterAge');
    const statusValues = parseStatusQueryParam(searchParams.get('status'));
    setUrlStatusValues(statusValues);

    const statusSelectValue = statusValues.length === 1 && LEAD_STATUS_OPTIONS.includes(statusValues[0])
      ? statusValues[0]
      : undefined;

    if (view === 'team-progress' && user?.role === 'Agent') {
      setSelectedStage('team-progress');
      setFilterStatus(statusSelectValue || 'All');
      setFilterAge('All');
      return;
    }

    if (view === 'instructions') {
      navigate('/reports/instructions?preset=today', { replace: true });
      return;
    } else if (view === 'leads') {
      setActiveLeadManagementView('leads');
    }

    if (filter === 'team-progress' && user?.role === 'Agent') {
      setSelectedStage('team-progress');
      setFilterStatus(statusSelectValue || 'All');
      setFilterAge('All');
    } else if (filter === 'assigned') {
      setFilterStatus(statusSelectValue || 'Assigned');
      setSelectedStage(user?.role === 'Agent' ? 'my-assigned' : 'all'); // Agent assigned links mean their own active leads
      setFilterAge('All'); // Reset age filter when viewing assigned
    } else if (filter === 'unassigned' || stage === 'unassigned') {
      setSelectedStage('unassigned');
      setFilterStatus(statusSelectValue || 'All'); // Show all statuses for unassigned view unless URL status is explicit
      setFilterAge('All'); // Reset age filter when viewing unassigned
    } else if (!filter && !stage) {
      // Reset to default if no params
      setSelectedStage(user?.role === 'Agent' ? 'my-assigned' : 'all');
      setFilterStatus(statusSelectValue || 'All');
      // Only reset filterAge if filterAgeParam is not explicitly set
      if (!filterAgeParam) {
        setFilterAge('All');
      }
    } else if (statusSelectValue) {
      setFilterStatus(statusSelectValue);
    }

    // Handle filterAge parameter (only if explicitly set in URL)
    if (filterAgeParam && ['All', 'New', 'Old', 'Overdue'].includes(filterAgeParam)) {
      setFilterAge(filterAgeParam);
    } else if (!filterAgeParam && filter !== 'assigned' && stage !== 'unassigned') {
      // Only reset if not already reset above and no explicit filterAge in URL
      // (This prevents unnecessary resets)
    }

  }, [navigate, searchParams, user?.role]);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle leadId parameter to open specific lead
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    const action = searchParams.get('action');

    if (!leadId || isLoading) return;

    const canAgentOpenLead = (leadToOpen: Lead) => {
      if (user?.role !== 'Agent' || !user?.id) return true;
      return !leadToOpen.assignedTo || leadToOpen.assignedTo === user.id;
    };

    // First, try to find the lead in the current leads array
    const lead = leads.find(l => l.id === leadId);

    if (lead) {
      if (!canAgentOpenLead(lead)) {
        setError('This lead is assigned to another agent.');
        clearLeadDetailUrlParams();
        return;
      }
      setSelectedLead(lead);
      setShowLeadDetail(true);
      if (action === 'assign' && user?.role !== 'Agent') {
        setShowAssignModal(true);
      }
      // Clear the deep-link immediately so browser back/navigation cannot reopen this lead.
      clearLeadDetailUrlParams();
    } else {
      // Lead not found in current array - fetch it directly
      const fetchAndOpenLead = async () => {
        try {
          const { fetchLeadById } = await import('@/services/leadsService');
          const fetchedLead = await fetchLeadById(leadId);
          if (fetchedLead) {
            if (!canAgentOpenLead(fetchedLead)) {
              setError('This lead is assigned to another agent.');
              clearLeadDetailUrlParams();
              return;
            }
            setSelectedLead(fetchedLead);
            setShowLeadDetail(true);
            if (action === 'assign' && user?.role !== 'Agent') {
              setShowAssignModal(true);
            }
            clearLeadDetailUrlParams();
          }
        } catch (error) {
          console.error('Error fetching lead by ID:', error);
          clearLeadDetailUrlParams();
        }
      };
      fetchAndOpenLead();
    }
  }, [searchParams, leads, isLoading, user?.role, user?.id, clearLeadDetailUrlParams]);

  useEffect(() => {
    setQuoteAttachment(null);
  }, [selectedLead?.id]);

  useEffect(() => {
    let cancelled = false;

    const checkOutlookStatus = async () => {
      try {
        const status = await fetchOutlookStatus();
        if (!cancelled) {
          setIsOutlookReady(status.connected);
          setOutlookMailboxEmail(status.email || null);
        }
      } catch (error) {
        console.error('Failed to check Outlook status:', error);
        if (!cancelled) {
          setIsOutlookReady(false);
          setOutlookMailboxEmail(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingOutlook(false);
        }
      }
    };

    const checkTwilioStatus = async () => {
      try {
        const status = await fetchTwilioStatus();
        if (!cancelled) {
          setIsTwilioReady(status.connected);
          setTwilioPhoneNumber(status.phoneNumber || null);
        }
      } catch (error) {
        console.error('Failed to check Twilio status:', error);
        if (!cancelled) {
          setIsTwilioReady(false);
          setTwilioPhoneNumber(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingTwilio(false);
        }
      }
    };

    checkOutlookStatus();
    checkTwilioStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCommunicationPanel) {
      return;
    }

    let cancelled = false;

    const refreshStatus = async () => {
      setIsCheckingOutlook(true);
      setIsCheckingTwilio(true);
      try {
        const [outlookStatus, twilioStatus] = await Promise.all([
          fetchOutlookStatus(),
          fetchTwilioStatus()
        ]);
        if (!cancelled) {
          setIsOutlookReady(outlookStatus.connected);
          setOutlookMailboxEmail(outlookStatus.email || null);
          setIsTwilioReady(twilioStatus.connected);
          setTwilioPhoneNumber(twilioStatus.phoneNumber || null);
        }
      } catch (error) {
        console.error('Failed to refresh status:', error);
        if (!cancelled) {
          setIsOutlookReady(false);
          setOutlookMailboxEmail(null);
          setIsTwilioReady(false);
          setTwilioPhoneNumber(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingOutlook(false);
          setIsCheckingTwilio(false);
        }
      }
    };

    refreshStatus();

    return () => {
      cancelled = true;
    };
  }, [showCommunicationPanel]);

  // Fetch contact attempts when a lead is selected
  useEffect(() => {
  const loadContactAttempts = async () => {
      if (!selectedLead || !showLeadDetail) {
        setContactAttempts([]);
      setContactAttemptsPage(1);
        return;
      }

      setIsLoadingContactAttempts(true);
      try {
        const attempts = await fetchContactAttempts(selectedLead.id);
        setContactAttempts(attempts);
      setContactAttemptsPage(1);
      } catch (err) {
        console.error('Error loading contact attempts:', err);
        setContactAttempts([]);
      } finally {
        setIsLoadingContactAttempts(false);
      }
    };

    loadContactAttempts();
  }, [selectedLead?.id, showLeadDetail]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(contactAttempts.length / CONTACT_ATTEMPTS_PER_PAGE));
    setContactAttemptsPage((prev) => Math.min(prev, totalPages));
  }, [contactAttempts]);

  // Auto-scroll to communication center when it opens
  useEffect(() => {
    if (showCommunicationPanel && showLeadDetail) {
      // Use multiple attempts with increasing delays to ensure the element is rendered and visible
      const scrollToCommunicationCenter = () => {
        if (communicationCenterRef.current && modalScrollContainerRef.current) {
          const container = modalScrollContainerRef.current;
          const target = communicationCenterRef.current;

          // Calculate the position relative to the scrollable container
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();

          // Check if the element is already fully visible in the viewport
          const isVisible = (
            targetRect.top >= containerRect.top &&
            targetRect.bottom <= containerRect.bottom &&
            targetRect.top >= containerRect.top + 20 // 20px offset from top
          );

          // Only scroll if not already visible
          if (!isVisible) {
            // Scroll within the modal container with 20px offset from top
            const scrollTop = container.scrollTop + (targetRect.top - containerRect.top) - 20;

            container.scrollTo({
              top: Math.max(0, scrollTop), // Ensure scrollTop is not negative
              behavior: 'smooth'
            });
          }
        }
      };

      // Try scrolling at multiple intervals to handle async rendering
      const timeouts = [
        setTimeout(scrollToCommunicationCenter, 100),
        setTimeout(scrollToCommunicationCenter, 300),
        setTimeout(scrollToCommunicationCenter, 500)
      ];

      // Cleanup timeouts on unmount or when dependencies change
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [showCommunicationPanel, showLeadDetail]);

  // Generate invoice handler
  const handleGenerateInvoice = useCallback(async () => {
    if (!selectedLead || !leadQuote) {
      setLinkNotification({
        type: 'error',
        message: 'No quote available. Please select a lead with an accepted quote.'
      });
      setTimeout(() => setLinkNotification(null), 3000);
      return;
    }

    try {
      // Create payment/invoice record in the database
      const invoiceAmount = leadQuote.totalIncVat || leadQuote.totalAmount || 0;

      const { data, error } = await supabase
        .from('payments')
        .insert({
          lead_id: selectedLead.id,
          quote_id: leadQuote.id,
          amount: invoiceAmount,
          currency: 'GBP',
          status: 'Pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invoice:', error);
        setLinkNotification({
          type: 'error',
          message: `Failed to generate invoice: ${error.message || 'Unknown error'}`
        });
        setTimeout(() => setLinkNotification(null), 5000);
        return;
      }

      // Log activity
      try {
        await logActivity({
          activityType: 'payment_created',
          entityType: 'payment',
          entityId: data.id,
          leadId: selectedLead.id,
          leadName: selectedLead.name,
          actionDescription: `Invoice generated for quote ${leadQuote.shortCode || leadQuote.id} - £${invoiceAmount.toFixed(2)}`,
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name || 'User',
        });
      } catch (activityError) {
        console.error('Error logging invoice creation activity:', activityError);
      }

      setLinkNotification({
        type: 'success',
        message: `Invoice generated successfully! Amount: £${invoiceAmount.toFixed(2)}`
      });
      setTimeout(() => setLinkNotification(null), 5000);

      // Optionally navigate to payments page
      // navigate('/payments');
    } catch (error) {
      console.error('Error generating invoice:', error);
      setLinkNotification({
        type: 'error',
        message: `Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setTimeout(() => setLinkNotification(null), 5000);
    }
  }, [selectedLead, leadQuote, user]);

  // Quick send quote email handler
  const handleQuickSendQuoteEmail = useCallback(async () => {
    if (!selectedLead || !leadQuote) {
      setLinkNotification({
        type: 'error',
        message: 'No quote available. Please select a lead with a quote.'
      });
      setTimeout(() => setLinkNotification(null), 3000);
      return;
    }

    if (!isOutlookReady) {
      setLinkNotification({
        type: 'error',
        message: 'Outlook not connected. Please connect Outlook in Settings → Notifications.'
      });
      setTimeout(() => setLinkNotification(null), 3000);
      return;
    }

    if (!selectedLead.email) {
      setLinkNotification({
        type: 'error',
        message: 'Lead email address is missing. Please update the lead details first.'
      });
      setTimeout(() => setLinkNotification(null), 3000);
      return;
    }

    setIsSendingQuoteEmail(true);
    setLinkNotification(null);

    try {
      // Generate acceptance URL
      let acceptanceUrl: string | null = null;
      try {
        acceptanceUrl = await ensureQuoteAcceptanceToken(leadQuote.id);
        console.log('✅ Acceptance URL generated:', acceptanceUrl);
      } catch (error) {
        console.error('❌ Could not generate acceptance URL:', error);
        // Show notification but continue - email will be sent without accept button
        setLinkNotification({
          type: 'error',
          message: 'Warning: Could not generate acceptance link. Email will be sent without accept button.'
        });
        setTimeout(() => setLinkNotification(null), 5000);
      }

      // Generate email HTML and text using the template
      const emailHTML = generateQuoteEmailHTML({
        quote: leadQuote,
        acceptanceUrl: acceptanceUrl || undefined,
        clientName: selectedLead.name,
        clientEmail: selectedLead.email,
        propertyAddress: leadQuote.propertyAddress || selectedLead.propertyAddress,
        transactionType: leadQuote.quoteType || leadQuote.transactionType || 'Conveyancing',
        expiryDate: leadQuote.expiryDate || leadQuote.validUntil
      });

      const emailText = generateQuoteEmailText({
        quote: leadQuote,
        acceptanceUrl: acceptanceUrl || undefined,
        clientName: selectedLead.name,
        clientEmail: selectedLead.email,
        propertyAddress: leadQuote.propertyAddress || selectedLead.propertyAddress,
        transactionType: leadQuote.quoteType || leadQuote.transactionType || 'Conveyancing',
        expiryDate: leadQuote.expiryDate || leadQuote.validUntil
      });

      // Generate PDF attachment
      let quoteAttachment: { fileName: string; contentType: string; contentBytes: string } | undefined = undefined;
      try {
        console.log('Starting PDF generation for quick send...');
        const { doc, fileName } = await buildQuotePdf(leadQuote);
        console.log('PDF generated successfully, fileName:', fileName);

        const arrayBuffer = doc.output('arraybuffer');
        console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

        const base64 = arrayBufferToBase64(arrayBuffer);
        console.log('Base64 size:', base64.length, 'characters');
        console.log('Base64 valid format:', /^[A-Za-z0-9+/]*={0,2}$/.test(base64));

        quoteAttachment = {
          fileName,
          contentType: 'application/pdf',
          contentBytes: base64
        };
        console.log('Quote attachment prepared successfully');
      } catch (error) {
        console.error('Error generating quote PDF:', error);
        console.error('Error details:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
        // Continue without PDF attachment
      }

      // Send email via Outlook
      const transactionType = leadQuote.quoteType || leadQuote.transactionType || 'Conveyancing';
      const subject = `Your ${transactionType} Quote - Millennium Legal`;

      await sendOutlookEmail({
        to: selectedLead.email,
        subject,
        htmlBody: emailHTML,
        textBody: emailText,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        metadata: {
          templateType: 'quote',
          quoteId: leadQuote.id,
          sentBy: user?.id || null,
          sentByName: user?.name || null
        },
        attachments: quoteAttachment ? [quoteAttachment] : undefined,
        saveToSentItems: true
      });

      // Update quote status to "Sent" and set sentAt timestamp
      try {
        await updateQuote(leadQuote.id, {
          status: 'Sent' as const,
          sentAt: new Date().toISOString()
        }, user?.id, user?.name);

        // Refresh lead quote
        const quotes = await fetchQuotes({ leadId: selectedLead.id });
        if (quotes && quotes.length > 0) {
          const sortedQuotes = quotes.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLeadQuote(sortedQuotes[0]);
        }
      } catch (error) {
        console.warn('Could not update quote status:', error);
        // Continue anyway - email was sent
      }

      // Log activity
      try {
        // Generate a UUID for the contact attempt entity
        const contactAttemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });

        await logActivity({
          activityType: 'contact_attempt',
          entityType: 'contact_attempt',
          entityId: contactAttemptId,
          leadId: selectedLead.id,
          leadName: selectedLead.name,
          actionDescription: `Quote email sent to ${selectedLead.email}`,
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name || 'Unknown',
          metadata: {
            channel: 'email',
            subject,
            templateType: 'quote',
            quoteId: leadQuote.id
          }
        });

        // Refresh contact attempts
        try {
          const attempts = await fetchContactAttempts(selectedLead.id);
          setContactAttempts(attempts);
        } catch (err) {
          console.warn('Failed to refresh contact attempts:', err);
        }
      } catch (error) {
        console.warn('Could not log activity:', error);
        // Continue anyway
      }

      setLinkNotification({
        type: 'success',
        message: `Quote email sent successfully to ${selectedLead.email}!`
      });
      setTimeout(() => setLinkNotification(null), 5000);

    } catch (error) {
      console.error('Error sending quote email:', error);
      setLinkNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send quote email. Please try again.'
      });
      setTimeout(() => setLinkNotification(null), 5000);
    } finally {
      setIsSendingQuoteEmail(false);
    }
  }, [selectedLead, leadQuote, isOutlookReady, user]);

  // Fetch quote data when a lead is selected
  useEffect(() => {
    const loadQuote = async () => {
      if (!selectedLead || !showLeadDetail) {
        setLeadQuote(null);
        setLeadQuotes([]);
        return;
      }

      setIsLoadingQuote(true);
      try {
        // Fetch ALL quotes for this lead
        const quotes = await fetchQuotes({ leadId: selectedLead.id });
        if (quotes && quotes.length > 0) {
          // Sort by created date (most recent first)
          const sortedQuotes = quotes.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLeadQuotes(sortedQuotes); // Store all quotes
          setLeadQuote(sortedQuotes[0]); // Set first quote as default for backward compatibility
        } else {
          setLeadQuotes([]);
          setLeadQuote(null);
        }
      } catch (err) {
        console.error('Error loading quotes:', err);
        setLeadQuotes([]);
        setLeadQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    loadQuote();
  }, [selectedLead?.id, showLeadDetail]);

  // Fetch templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const [sms, email] = await Promise.all([
          fetchTemplates('SMS'),
          fetchTemplates('Email')
        ]);
        setSmsTemplates(sms);
        setEmailTemplates(email);
      } catch (err) {
        console.error('Error loading templates:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  // Clear leads when URL parameters change (to prevent showing stale data)
  useEffect(() => {
    const stage = searchParams.get('stage');
    const filter = searchParams.get('filter');

    // Clear leads when navigating to a different view
    if (stage || filter) {
      setLeads([]);
      setIsLoading(true);
    }
  }, [searchParams]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Load quota status for agents
  useEffect(() => {
    const loadQuotaStatus = async () => {
      if (user?.role === 'Agent' && user?.id) {
        try {
          const status = await getAgentQuotaStatus(user.id);
          // Map dailyQuota to quota for consistency
          setQuotaStatus({
            assignedToday: status.assignedToday || 0,
            quota: status.dailyQuota ?? 999,
            assignedThisWeek: status.assignedThisWeek || 0,
            weeklyQuota: status.weeklyQuota ?? (status.dailyQuota ?? 999) * 7,
            weeklyRemaining: status.weeklyRemaining || 0
          });
        } catch (err) {
          console.error('Error loading quota status:', err);
          setQuotaStatus({ assignedToday: 0, quota: 999 }); // Default fallback
        }
      } else {
        setQuotaStatus(null); // Not an agent, no quota needed
      }
    };

    if (!authLoading && user) {
      loadQuotaStatus();
    }
  }, [user?.id, user?.role, authLoading]);

  // Timeout fallback - ensure loading doesn't hang forever
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('Lead loading timeout - setting isLoading to false');
        setIsLoading(false);
        if (leads.length === 0) {
          setError('Loading took too long. Please refresh the page.');
        }
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading, leads.length]);

  // Filter leads based on current filters (search is handled server-side, but we keep client-side for stage-specific filters)

  // Minimal client-side filtering (only for computed fields like age)
  // Overdue is now handled server-side, so no need to filter it again here
  // Most filtering is done server-side for performance
  const filteredLeads = leads.filter(lead => {
    // Only filter by age (computed field) - Overdue is handled server-side
    if (filterAge === 'All') return true;
    if (filterAge === 'Overdue') return true; // Already filtered server-side
    if (filterAge === 'New') return (lead.ageInHours || 0) < 24;
    if (filterAge === 'Old') return (lead.ageInHours || 0) >= 24;
    return true;
  });

  // Pagination uses server-side total count (much faster for 900+ leads)
  const totalPages = Math.ceil(totalLeadsCount / leadsPerPage);
  // No need to slice - server already returns only current page
  const paginatedLeads = filteredLeads;
  const paginatedLeadIdsKey = useMemo(
    () => paginatedLeads.map(lead => lead.id).sort().join(','),
    [paginatedLeads]
  );

  // Quotes are now fetched in parallel with leads in loadLeads function
  // This useEffect is kept as a fallback to update quotes when paginatedLeads changes
  // (e.g., when filters change but leads are already loaded)
  // Note: We use refs to track loaded lead IDs and last processed key to avoid infinite loops
  const loadedLeadIdsRef = useRef<Set<string>>(new Set());
  const lastProcessedKeyRef = useRef<string>('');

  useEffect(() => {
    const leadIds = paginatedLeadIdsKey ? paginatedLeadIdsKey.split(',').filter(Boolean) : [];

    // Only update if leads are already loaded and quotes map is empty or needs refresh
    if (leadIds.length === 0) {
      setLeadQuotesMap(new Map());
      loadedLeadIdsRef.current.clear();
      lastProcessedKeyRef.current = '';
      return;
    }

    // Create a stable key from current lead IDs
    const currentKey = paginatedLeadIdsKey;

    // Skip if we've already processed these exact leads
    if (lastProcessedKeyRef.current === currentKey) return;
    lastProcessedKeyRef.current = currentKey;

    const currentLeadIds = new Set(leadIds);

    const loadQuotesForLeads = async () => {
      try {
        const visibleQuotes = await fetchQuotesForLeadIds(leadIds);
        const quotesMap = buildLeadQuotesMap(visibleQuotes);

        setLeadQuotesMap(quotesMap);
        // Mark these leads as loaded
        currentLeadIds.forEach(id => loadedLeadIdsRef.current.add(id));
      } catch (err) {
        console.error('Error loading quotes for leads:', err);
      }
    };

    loadQuotesForLeads();
  }, [buildLeadQuotesMap, paginatedLeadIdsKey]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStage, filterStatus, urlStatusValues, filterSource, filterAge, searchTerm]);

  // Fetch agents for assignment modal
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string; status?: string }>>([]);
  const [activeUsers, setActiveUsers] = useState<Array<{ id: string; name: string; role: string; status?: string }>>([]);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState('');
  const [bulkAssignPriority, setBulkAssignPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [bulkAssignNotes, setBulkAssignNotes] = useState('');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role, status')
          .eq('status', 'Active');

        if (!error && data) {
          const active = data.map(u => ({ id: u.id, name: u.name, role: u.role, status: u.status }));
          setActiveUsers(active);
          setAgents(active.filter(u => ['Agent', 'Manager'].includes(u.role)));
        }
      } catch (err) {
        console.error('Error loading agents:', err);
      }
    };
    loadAgents();
  }, []);

  // Helper function to get agent name from ID
  const getAgentName = (agentId: string | null | undefined): string => {
    if (!agentId) return '';
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || agentId; // Fallback to ID if agent not found
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Assigned': return 'bg-yellow-100 text-yellow-800';
      case 'Contacted': return 'bg-purple-100 text-purple-800';
      case 'Interested': return 'bg-green-100 text-green-800';
      case 'Quote Sent': return 'bg-indigo-100 text-indigo-800';
      case 'Sold': return 'bg-emerald-100 text-emerald-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      case 'Archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

const formatStatusLabel = (status: string) => {
  if (status === 'Archived') return 'Deleted';
  return status;
  };

  const getAgeColor = (ageInHours: number, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600';
    if (ageInHours >= 24) return 'text-orange-600';
    if (ageInHours >= 12) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatAge = (ageInHours: number) => {
    if (ageInHours < 1) return `${Math.round(ageInHours * 60)}m`;
    if (ageInHours < 24) return `${Math.round(ageInHours)}h`;
    return `${Math.round(ageInHours / 24)}d ${Math.round(ageInHours % 24)}h`;
  };

  const getProgressLabel = (lead: Lead) => {
    if (lead.stage && lead.stage !== 'New') return lead.stage;
    return lead.status || 'In progress';
  };

  const formatComparisonPosition = (value?: string): string => {
    const map: Record<string, string> = {
      sale_not_on_market: "Haven't put house on market",
      sale_on_market_no_offer: 'On market, no offer yet',
      sale_offer_accepted: 'Offer accepted (sale)',
      purchase_not_searching: 'Not searching yet',
      purchase_searching: 'Looking for property',
      purchase_offer_accepted: 'Offer accepted (purchase)',
    };
    if (!value) return '';
    return map[value] || value;
  };

  const getClientPositionLabel = (lead: Lead): string => {
    if (!lead.whereThingsUpTo) return '';
    if (lead.whereThingsUpToSale) {
      return `Sale: ${formatComparisonPosition(lead.whereThingsUpToSale)} / Purchase: ${formatComparisonPosition(lead.whereThingsUpTo)}`;
    }
    return formatComparisonPosition(lead.whereThingsUpTo);
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

  const getLocalDateInputValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCallDuration = (seconds?: number) => {
    if (!seconds || seconds < 0) return 'Not captured';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  };

  const formatCallStatus = (status?: string) => {
    if (!status) return 'Unknown';
    return status
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const formatNativeCallType = (value?: string) => {
    const normalized = (value || '').trim();
    if (!normalized || /^\d+$/.test(normalized)) return null;
    return normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const getCallStatusColor = (status?: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('answer') || normalized.includes('completed') || normalized.includes('connected')) {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (normalized.includes('miss') || normalized.includes('abandon') || normalized.includes('no answer')) {
      return 'bg-red-100 text-red-800';
    }
    if (normalized.includes('voicemail')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getAiStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'analyzing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getAgentInstructionMinDate = () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 7);
    return getLocalDateInputValue(minDate);
  };

  const instructionDateToEffectiveIso = (dateYmd: string) => {
    if (!dateYmd) return null;
    return new Date(`${dateYmd}T00:00:00`).toISOString();
  };

  const getInstructionDateError = (dateYmd: string) => {
    if (!dateYmd) return 'Choose an instruction date.';
    const today = getLocalDateInputValue();
    if (dateYmd > today) return 'Instruction date cannot be in the future.';
    if (user?.role === 'Agent' && dateYmd < getAgentInstructionMinDate()) {
      return 'Agents can only select an instruction date from the last 7 days.';
    }
    return '';
  };

  const hasTrackingValue = (value?: string | null): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
  };

  const formatTrackingDateTime = (value?: string) => {
    if (!value) return 'Not captured';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyTrackingValue = async (label: string, value?: string | null) => {
    if (!hasTrackingValue(value)) return;
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(`${label} copied to clipboard.`);
      setError(null);
    } catch (err) {
      console.error(`Failed to copy ${label}:`, err);
      setError(`Could not copy ${label}.`);
      setSuccessMessage(null);
    }
  };

  const renderTrackingField = (label: string, value?: string | null, options: { long?: boolean; date?: boolean } = {}) => {
    const displayValue = options.date ? formatTrackingDateTime(value || undefined) : (hasTrackingValue(value) ? value.trim() : 'Not captured');
    const canCopy = !options.date && hasTrackingValue(value);

    return (
      <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
        <span className="text-sm text-gray-600 flex-shrink-0">{label}:</span>
        <div className="flex items-start gap-2 min-w-0 text-right">
          <span
            className={`text-sm font-medium ${hasTrackingValue(value) || options.date ? 'text-gray-900' : 'text-gray-400'} ${options.long ? 'break-all' : 'truncate'} max-w-[28rem]`}
            title={displayValue}
          >
            {displayValue}
          </span>
          {canCopy && (
            <button
              type="button"
              onClick={() => copyTrackingValue(label, value)}
              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
              title={`Copy ${label}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const getAttributionCapturedCount = (lead: Lead) => {
    return [
      lead.utmSource,
      lead.utmMedium,
      lead.utmCampaign,
      lead.utmTerm,
      lead.utmContent,
      lead.gadSource,
      lead.gadCampaignId,
      lead.gclid,
      lead.gbraid,
      lead.wbraid,
      lead.msclkid,
      lead.landingPage,
      lead.referrer,
      lead.attributionCapturedAt,
      lead.comparisonLeadId,
    ].filter(hasTrackingValue).length;
  };

  const canManageInstruction = (lead: Lead) => {
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'Manager') return true;
    return user.role === 'Agent' && lead.assignedTo === user.id;
  };

  const canReverseInstruction = user?.role === 'Admin' || user?.role === 'Manager';

  const getCreditUserOptions = () => {
    const options = activeUsers.map((agent) => ({ id: agent.id, name: agent.name, role: agent.role }));
    if (user && !options.some((option) => option.id === user.id)) {
      options.unshift({ id: user.id, name: user.name, role: user.role });
    }
    return options;
  };

  const getLockedInstructionCredit = (lead: Lead) => {
    if (lead.assignedTo) {
      return {
        id: lead.assignedTo,
        name: lead.assignedToName || getAgentName(lead.assignedTo) || 'Assigned user',
      };
    }

    return {
      id: user?.id || '',
      name: user?.name || 'Current user',
    };
  };

  const getInstructionAgentName = (lead: Lead) => {
    return lead.instructionCreditUserName || getAgentName(lead.instructionCreditUserId) || 'Uncredited';
  };

  const refreshSelectedLead = async (leadId?: string) => {
    if (!leadId) return null;

    const refreshed = await fetchLeadById(leadId);
    if (refreshed) {
      setSelectedLead(refreshed);
      setLeads((prev) => prev.map((lead) => (lead.id === refreshed.id ? refreshed : lead)));
    }
    return refreshed;
  };

  const openInstructionModal = (lead: Lead) => {
    setInstructionLead(lead);
    setInstructionNote('');
    setInstructionEffectiveDate(getLocalDateInputValue());
    setShowInstructionModal(true);
  };

  const loadInstructionTracker = useCallback(async () => {
    setIsLoadingInstructions(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [rangeLeads, todaysLeads] = await Promise.all([
        fetchInstructionTrackerLeads({
          startDate: instructionStartDate,
          endDate: instructionEndDate,
          creditUserId: instructionAgentFilter,
        }),
        fetchInstructionTrackerLeads({
          startDate: today,
          endDate: today,
        }),
      ]);
      setInstructionTrackerLeads(rangeLeads);
      setTodayInstructionLeads(todaysLeads);
    } catch (err) {
      console.error('Error loading instruction tracker:', err);
      setError('Failed to load instruction tracker.');
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [instructionStartDate, instructionEndDate, instructionAgentFilter]);

  const handleConfirmMarkInstructed = async () => {
    if (!instructionLead || !user || isSavingInstructionMark) return;
    const lockedCredit = getLockedInstructionCredit(instructionLead);
    const dateError = getInstructionDateError(instructionEffectiveDate);

    if (dateError) {
      setError(dateError);
      setSuccessMessage(null);
      return;
    }

    setIsSavingInstructionMark(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await markLeadInstructed({
        leadId: instructionLead.id,
        markedByUserId: user.id,
        markedByName: user.name,
        markedByRole: user.role,
        creditedUserId: lockedCredit.id,
        creditedUserName: lockedCredit.name,
        notes: instructionNote.trim() || null,
        instructionEffectiveAt: instructionDateToEffectiveIso(instructionEffectiveDate),
      });

      if (!updated) {
        throw new Error('Instruction mark failed.');
      }

      setSelectedLead((current) => (current?.id === updated.id ? updated : current));
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      setSuccessMessage(`Lead "${updated.name}" marked as instructed.`);
      setShowInstructionModal(false);
      setInstructionLead(null);
      await loadInstructionTracker();
    } catch (err) {
      console.error('Error marking instructed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark lead as instructed.');
    } finally {
      setIsSavingInstructionMark(false);
    }
  };

  const handleReverseInstruction = async (lead: Lead) => {
    if (!user || !canReverseInstruction || isSavingInstructionMark) return;
    const note = window.prompt('Optional reversal note:', '');
    setIsSavingInstructionMark(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await unmarkLeadInstructed({
        leadId: lead.id,
        markedByUserId: user.id,
        markedByName: user.name,
        markedByRole: user.role,
        notes: note?.trim() || null,
      });

      if (!updated) {
        throw new Error('Instruction reversal failed.');
      }

      setSelectedLead((current) => (current?.id === updated.id ? updated : current));
      setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Instruction marker reversed for "${updated.name}".`);
      await loadInstructionTracker();
    } catch (err) {
      console.error('Error reversing instruction:', err);
      setError(err instanceof Error ? err.message : 'Failed to reverse instruction marker.');
    } finally {
      setIsSavingInstructionMark(false);
    }
  };

  const [callbackBusyId, setCallbackBusyId] = useState<string | null>(null);

  const handleCallbackTransition = async (
    lead: Lead,
    transition: 'contacted' | 'completed' | 'cancelled',
    resolution?: string
  ) => {
    if (!user || callbackBusyId) return;
    setCallbackBusyId(lead.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateCallbackStatus({
        leadId: lead.id,
        transition,
        actorUserId: user.id,
        actorName: user.name,
        resolution: resolution || null,
      });
      if (!updated) {
        throw new Error('Callback update failed.');
      }
      setSelectedLead((current) => (current?.id === updated.id ? updated : current));
      // In the open-callbacks queue, resolved callbacks drop out of the list.
      if (selectedStage === 'callback-requests' && transition !== 'contacted') {
        setLeads((prev) => prev.filter((item) => item.id !== updated.id));
      } else {
        setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      const label = transition === 'contacted' ? 'marked contacted' : transition === 'completed' ? 'completed' : 'cancelled';
      setSuccessMessage(`Callback for "${updated.name}" ${label}.`);
    } catch (err) {
      console.error('Error updating callback:', err);
      setError(err instanceof Error ? err.message : 'Failed to update callback.');
    } finally {
      setCallbackBusyId(null);
    }
  };

  const [instructionRequestBusyId, setInstructionRequestBusyId] = useState<string | null>(null);

  const handleInstructionRequestTransition = async (
    lead: Lead,
    transition: 'contacted' | 'completed' | 'cancelled',
    resolution?: string
  ) => {
    if (!user || instructionRequestBusyId) return;
    setInstructionRequestBusyId(lead.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateInstructionRequestStatus({
        leadId: lead.id,
        transition,
        actorUserId: user.id,
        actorName: user.name,
        resolution: resolution || null,
      });
      if (!updated) {
        throw new Error('Instruction request update failed.');
      }
      setSelectedLead((current) => (current?.id === updated.id ? updated : current));
      // In the open instruction-requests queue, resolved ones drop out of the list.
      if (selectedStage === 'instruction-requests' && transition !== 'contacted') {
        setLeads((prev) => prev.filter((item) => item.id !== updated.id));
      } else {
        setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      const label = transition === 'contacted' ? 'marked contacted' : transition === 'completed' ? 'completed' : 'cancelled';
      setSuccessMessage(`Instruction request for "${updated.name}" ${label}.`);
    } catch (err) {
      console.error('Error updating instruction request:', err);
      setError(err instanceof Error ? err.message : 'Failed to update instruction request.');
    } finally {
      setInstructionRequestBusyId(null);
    }
  };

  useEffect(() => {
    if (activeLeadManagementView !== 'instructions' || authLoading || !user) return;
    loadInstructionTracker();
  }, [activeLeadManagementView, authLoading, user?.id, loadInstructionTracker]);

  useEffect(() => {
    let isCurrent = true;

    const loadLatestInstructionAudit = async () => {
      if (!selectedLead?.id || !selectedLead.isManuallyInstructed) {
        setLatestInstructionMarkedAt(null);
        return;
      }

      const event = await fetchLatestInstructionMarkedEvent(selectedLead.id);
      if (isCurrent) {
        setLatestInstructionMarkedAt(event?.markedAt || null);
      }
    };

    loadLatestInstructionAudit();

    return () => {
      isCurrent = false;
    };
  }, [selectedLead?.id, selectedLead?.isManuallyInstructed, selectedLead?.manualInstructedAt]);

  const canViewSelectedLeadCalls = useMemo(() => {
    if (user?.role === 'Admin' || user?.role === 'Manager') return true;
    return false;
  }, [user?.role]);

  const callAnalysesByCallId = useMemo(() => {
    const map = new Map<string, CrmCallAiAnalysis>();
    callAnalyses.forEach((analysis) => {
      if (!map.has(analysis.callRecordId)) {
        map.set(analysis.callRecordId, analysis);
      }
    });
    return map;
  }, [callAnalyses]);

  const hasCallTranscript = useCallback((call: CrmCallRecord) => (
    Boolean(call.transcriptAvailable && String(call.transcript || '').trim())
  ), []);

  const transcriptCallSummary = useMemo(() => {
    const available = leadCallRecords.filter(hasCallTranscript).length;
    return {
      available,
      pending: Math.max(0, leadCallRecords.length - available),
    };
  }, [leadCallRecords, hasCallTranscript]);

  const sortedLeadCallRecords = useMemo(() => (
    [...leadCallRecords].sort((a, b) => {
      const aHasTranscript = hasCallTranscript(a);
      const bHasTranscript = hasCallTranscript(b);

      if (aHasTranscript !== bHasTranscript) {
        return aHasTranscript ? -1 : 1;
      }

      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    })
  ), [leadCallRecords, hasCallTranscript]);

  const loadLeadCalls = useCallback(async (leadId: string) => {
    setIsLoadingLeadCalls(true);
    setCallAiError(null);
    try {
      const calls = await fetchLeadCallRecords(leadId);
      setLeadCallRecords(calls);
      const analyses = await fetchCallAnalyses(calls.map(call => call.id));
      setCallAnalyses(analyses);
    } catch (err) {
      console.error('Error loading 3CX calls:', err);
      setCallAiError(err instanceof Error ? err.message : 'Failed to load 3CX calls.');
      setLeadCallRecords([]);
      setCallAnalyses([]);
    } finally {
      setIsLoadingLeadCalls(false);
    }
  }, []);

  useEffect(() => {
    if (!showLeadDetail || !selectedLead?.id || !canViewSelectedLeadCalls) {
      setLeadCallRecords([]);
      setCallAnalyses([]);
      setCallAiError(null);
      return;
    }

    loadLeadCalls(selectedLead.id);
  }, [showLeadDetail, selectedLead?.id, canViewSelectedLeadCalls, loadLeadCalls]);

  const handleAnalyzeThreeCxCall = async (call: CrmCallRecord) => {
    if (!selectedLead) return;
    if (!canViewSelectedLeadCalls) {
      setCallAiError('Call intelligence is only available to managers and admins.');
      return;
    }
    setAnalyzingCallId(call.id);
    setCallAiError(null);
    try {
      const analysis = await analyzeThreeCxCall(call.id);
      setCallAnalyses(prev => [analysis, ...prev.filter(item => item.id !== analysis.id)]);
      setLeadCallRecords(prev =>
        prev.map(item =>
          item.id === call.id
            ? { ...item, aiAnalysisStatus: 'completed', latestAiAnalysisId: analysis.id }
            : item
        )
      );
      setSuccessMessage('APCM AI analysis completed for this call.');
      window.setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error analyzing 3CX call:', err);
      setCallAiError(err instanceof Error ? err.message : 'Failed to analyze call.');
      setLeadCallRecords(prev =>
        prev.map(item => (item.id === call.id ? { ...item, aiAnalysisStatus: 'failed' } : item))
      );
    } finally {
      setAnalyzingCallId(null);
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };


  const handleAssignLead = (lead: Lead) => {
    setSelectedLead(lead);
    setShowAssignModal(true);
  };

  // Handle agent claiming a lead (assigning to themselves)
  const handleClaimLead = async (lead: Lead) => {
    if (!user || user.role !== 'Agent') {
      setError('Only agents can claim leads');
      setSuccessMessage(null);
      return;
    }

    if (!lead.id || !user.id) {
      setError('Missing lead or user information');
      setSuccessMessage(null);
      return;
    }

    // Clear previous messages
    setError(null);
    setSuccessMessage(null);

    try {
      // Check if agent can claim (quota check)
      const quotaCheck = await canAgentClaimLead(user.id);

      if (!quotaCheck.canClaim && quotaCheck.reason) {
        // Only show error if there's a specific reason (like quota reached)
        // Don't block if it's just a fetch error
        if (quotaCheck.reason.includes('quota reached')) {
          showQuotaReachedModal(quotaCheck.reason);
          setError(null);
          setSuccessMessage(null);
          return;
        }
        // If it's an error fetching quota, log it but allow the claim to proceed
        console.warn('Quota check failed but allowing claim:', quotaCheck.reason);
      }

      // Update lead to assign to agent - automatically move to "Call-1" stage
      const updated = await updateLead(lead.id, {
        assignedTo: user.id,
        status: 'Assigned',
        stage: 'Call-1', // Automatically move to Call-1 when agent picks the lead
        priority: lead.priority || 'Medium'
      }, user?.role, user?.id);

      if (!updated) {
        setError('Failed to claim lead. Please try again.');
        setSuccessMessage(null);
        return;
      }

      // Lead assignment successful - continue with supporting operations
      // (These failures shouldn't block the claim)

      // Create initial task: "Call client" (non-blocking)
      try {
        const task = await createTask({
          leadId: lead.id,
          leadName: lead.name,
          assignedTo: user.id,
          taskType: 'Call',
          title: `Call ${lead.name}`,
          description: `Initial contact call for ${lead.name}`,
          dueDate: new Date().toISOString().split('T')[0], // Today
          dueTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          priority: lead.priority || 'Medium',
          status: 'Pending'
        });

        if (task && import.meta.env.DEV) {
          console.log('✅ Task created:', task.id);
        }
      } catch (taskError) {
        console.warn('Failed to create task (non-blocking):', taskError);
      }

      // Log activity (non-blocking)
      try {
        await logActivity({
          activityType: 'lead_assigned',
          entityType: 'lead',
          entityId: lead.id,
          leadId: lead.id,
          leadName: lead.name,
          actionDescription: `Lead claimed by ${user.name || 'Agent'}`,
          doneByType: 'user',
          doneById: user.id,
          doneByName: user.name || 'Unknown',
        });
      } catch (logError) {
        console.warn('Failed to log activity (non-blocking):', logError);
      }

      // Update quota status (non-blocking)
      try {
        const newQuotaStatus = await getAgentQuotaStatus(user.id);
        setQuotaStatus({
          assignedToday: newQuotaStatus.assignedToday || 0,
          quota: newQuotaStatus.dailyQuota ?? 999,
          assignedThisWeek: newQuotaStatus.assignedThisWeek || 0,
          weeklyQuota: newQuotaStatus.weeklyQuota ?? (newQuotaStatus.dailyQuota ?? 999) * 7,
          weeklyRemaining: newQuotaStatus.weeklyRemaining || 0
        });
      } catch (quotaError) {
        console.warn('Failed to update quota status (non-blocking):', quotaError);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-center:updated', {
          detail: { type: 'lead_claimed', leadId: lead.id, userId: user.id }
        }));
      }

      // Show success message immediately
      setSuccessMessage(`Lead "${lead.name}" claimed successfully!`);
      setError(null);

      // Reload leads to reflect changes (this will remove it from unassigned list)
      try {
        await loadLeads();
      } catch (reloadError) {
        console.warn('Failed to reload leads (non-critical):', reloadError);
        // Even if reload fails, the lead is still claimed, so clear the error
        setError(null);
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

      if (import.meta.env.DEV) {
        console.log('✅ Lead claimed successfully:', lead.name);
      }
    } catch (err) {
      console.error('Error claiming lead:', err);
      setError('Failed to claim lead. Please try again.');
      setSuccessMessage(null);
    }
  };

  // Handle agent dropping a lead (unassigning it)
  const handleDropLead = (lead: Lead) => {
    if (!user || user.role !== 'Agent') {
      setError('Only agents can drop leads');
      return;
    }

    // Check if lead is assigned to this agent
    if (lead.assignedTo !== user.id) {
      setError('You can only drop leads assigned to you');
      return;
    }

    setLeadToDrop(lead);
    setShowDropModal(true);
  };

  const handleConfirmDropLead = async () => {
    if (!leadToDrop || !user) return;

    try {
      setError(null);
      setSuccessMessage(null);

      // Unassign the lead but keep current status and stage
      const updated = await updateLead(leadToDrop.id, {
        assignedTo: undefined, // Remove assignment - use undefined to properly clear the field
        // Keep current status and stage - don't reset them
      }, user?.role, user?.id);

      if (!updated) {
        setError('Failed to drop lead. Please try again.');
        return;
      }

      try {
        const now = new Date().toISOString();
        const { error: taskCancelError } = await supabase
          .from('diary_tasks')
          .update({
            status: 'Cancelled',
            updated_at: now,
          })
          .eq('lead_id', leadToDrop.id)
          .eq('assigned_to', user.id)
          .in('status', ['Pending', 'In Progress']);

        if (taskCancelError) {
          console.warn('Failed to cancel dropped lead tasks (non-blocking):', taskCancelError);
        } else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasks:updated', {
            detail: { type: 'lead_dropped_tasks_cancelled', leadId: leadToDrop.id, userId: user.id }
          }));
        }
      } catch (taskCancelError) {
        console.warn('Failed to cancel dropped lead tasks (non-blocking):', taskCancelError);
      }

      // Log activity
      try {
        await logActivity({
          activityType: 'note_added',
          entityType: 'lead',
          entityId: leadToDrop.id,
          leadId: leadToDrop.id,
          leadName: leadToDrop.name,
          actionDescription: `Lead dropped by ${user.name || 'Agent'} - returned to unassigned`,
          doneByType: 'user',
          doneById: user.id,
          doneByName: user.name || 'Unknown',
          metadata: {
            previousStatus: leadToDrop.status,
            previousStage: leadToDrop.stage,
          }
        });
      } catch (logError) {
        console.warn('Failed to log activity (non-blocking):', logError);
      }

      // Update quota status
      try {
        const newQuotaStatus = await getAgentQuotaStatus(user.id);
        setQuotaStatus({
          assignedToday: newQuotaStatus.assignedToday || 0,
          quota: newQuotaStatus.dailyQuota ?? 999,
          assignedThisWeek: newQuotaStatus.assignedThisWeek || 0,
          weeklyQuota: newQuotaStatus.weeklyQuota ?? (newQuotaStatus.dailyQuota ?? 999) * 7,
          weeklyRemaining: newQuotaStatus.weeklyRemaining || 0
        });
      } catch (quotaError) {
        console.warn('Failed to update quota status (non-blocking):', quotaError);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-center:updated', {
          detail: { type: 'lead_dropped', leadId: leadToDrop.id, userId: user.id }
        }));
      }

      // Show success message
      setSuccessMessage(`Lead "${leadToDrop.name}" has been dropped and returned to unassigned.`);

      // Close modal
      setShowDropModal(false);
      setLeadToDrop(null);

      // Reload leads
      await loadLeads();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

      if (import.meta.env.DEV) {
        console.log('✅ Lead dropped successfully:', leadToDrop.name);
      }
    } catch (err) {
      console.error('Error dropping lead:', err);
      setError('Failed to drop lead. Please try again.');
    }
  };

  const handleSaveEditDetails = async () => {
    if (!selectedLead || isSavingDetails) return;

    // Basic validation
    if (!editDetailsForm.name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSavingDetails(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await updateLead(selectedLead.id, {
        name: editDetailsForm.name.trim(),
        email: editDetailsForm.email.trim() || undefined,
        phone: editDetailsForm.phone.trim() || undefined,
        source: (editDetailsForm.source || 'Direct') as 'Hoowla' | 'Comparison Site' | 'Direct' | 'Referral',
        priority: editDetailsForm.priority
      }, user?.role, user?.id);

      if (!updated) {
        setError('Failed to update client details. Please try again.');
        return;
      }

      // Log activity
      try {
        await logActivity({
          activityType: 'note_added',
          entityType: 'lead',
          entityId: selectedLead.id,
          leadId: selectedLead.id,
          leadName: selectedLead.name,
          actionDescription: `Client details updated by ${user?.name || 'User'}`,
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name || 'Unknown',
          metadata: {
            updatedFields: {
              name: editDetailsForm.name,
              email: editDetailsForm.email,
              phone: editDetailsForm.phone,
              source: editDetailsForm.source,
              priority: editDetailsForm.priority
            }
          }
        });
      } catch (logError) {
        console.warn('Failed to log activity (non-blocking):', logError);
      }

      // Update selected lead to reflect changes
      setSelectedLead(updated);

      // Reload leads to update the list
      await loadLeads();

      // Show success message
      setSuccessMessage('Client details updated successfully.');

      // Close modal
      setShowEditDetailsModal(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

      console.log('✅ Client details updated successfully');
    } catch (err) {
      console.error('Error updating client details:', err);
      setError('Failed to update client details. Please try again.');
    } finally {
      setIsSavingDetails(false);
    }
  };


  const handleBulkAssignConfirm = async () => {
    if (!bulkAssignAgentId || selectedLeads.length === 0) return;

    try {
      const selectedAgent = agents.find(a => a.id === bulkAssignAgentId);
      const agentName = selectedAgent?.name || 'agent';
      const quotaCheck = await canAgentReceiveLead(bulkAssignAgentId, selectedLeads.length);

      if (!quotaCheck.canReceive) {
        setError(quotaCheck.reason || `${agentName} has reached their daily lead quota.`);
        return;
      }

      const result = await assignLeads(selectedLeads, bulkAssignAgentId, {
        priority: bulkAssignPriority,
        notes: bulkAssignNotes.trim() || undefined,
        assignedById: user?.id || undefined,
        assignedByName: user?.name || undefined
      });

      if (result && (result as any).updatedCount ? (result as any).updatedCount > 0 : !!result) {
        // Show success message for manager/admin
        if (user?.role === 'Manager' || user?.role === 'Admin') {
          setTaskToast({
            type: 'success',
            message: `Successfully assigned ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''} to ${agentName}.`
          });
        }

        await loadLeads();

        setShowBulkAssignModal(false);
        setSelectedLeads([]);
        setBulkAssignAgentId('');
        setBulkAssignPriority('Medium');
        setBulkAssignNotes('');
      }
    } catch (err) {
      console.error('Error bulk assigning leads:', err);
      setError('Failed to assign leads. Please try again.');
    }
  };

  const handleContactLead = (lead: Lead, _method: 'call' | 'email' | 'sms') => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
    // The useEffect will handle scrolling when showCommunicationPanel becomes true
    setShowCommunicationPanel(true);
  };

  const getNextAction = (outcomeCode: string) => {
    const actionMap: { [key: string]: string } = {
      'Called - No Answer': 'Advance to next call stage',
      'Called - Voicemail': 'Advance to next call stage',
      'Called - Busy': 'Advance to next call stage',
      'Number Invalid': 'Mark as Cancelled',
      'Interested - Call Back': 'Move to Interested stage',
      'Interested - Reviewing': 'Move to Interested stage',
      'Not Interested': 'Mark as Cancelled',
      'Sold!': 'Mark as Instructed',
      'Wrong Number': 'Mark as Cancelled',
      'Gone Elsewhere': 'Mark as Cancelled',
      'Callback Scheduled': 'Advance to next call stage',
      'Ready to Solicit': 'Move to Ready to Solicit stage',
      'Quote Accepted - Awaiting Payment': 'Move to Quote Accepted - Awaiting Payment stage',
      'Payment Completed - Awaiting Client Information': 'Move to Payment Completed - Awaiting client information stage',
      'Incorrect Number': 'Mark as Cancelled',
      'Fake/Duplicate Quote': 'Mark as Cancelled',
      'Just Getting prices': 'Move to Cancelled Stage',
      'Custom Reason': 'Custom action based on reason',
      'Recalled': 'Stay at current call stage'
    };
    return actionMap[outcomeCode] || 'No action defined';
  };

  // Replace template variables with actual lead data
  const replaceTemplateVariables = (template: string, lead: Lead | null): string => {
    if (!lead) return template;

    // Get first name from full name
    const firstName = lead.name ? lead.name.split(' ')[0] : lead.name || '';

    // Replace variables
    let replaced = template;

    // Replace {name} with first name
    replaced = replaced.replace(/\{name\}/g, firstName);

    // Replace {full_name} with full name
    replaced = replaced.replace(/\{full_name\}/g, lead.name || '');

    // Replace {amount} with quote amount if available
    const amount = leadQuote?.totalIncVat || lead.quoteAmount || 0;
    replaced = replaced.replace(/\{amount\}/g, `£${amount.toFixed(2)}`);

    // Replace {time} with current time (formatted)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    replaced = replaced.replace(/\{time\}/g, timeStr);

    // Replace {expiry_date} with quote expiry date if available, or default to 7 days from now
    let expiryDate = '';
    if (leadQuote?.validUntil) {
      expiryDate = new Date(leadQuote.validUntil).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } else {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      expiryDate = expiry.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    replaced = replaced.replace(/\{expiry_date\}/g, expiryDate);

    return replaced;
  };

  // Template management handlers
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !templateContent.trim()) {
      showNotification('Please fill in template content.', 'warning');
      return;
    }

    try {
      const updates: Partial<CommunicationTemplate> = {
        content: templateContent.trim()
      };

      if (editingTemplate.type === 'Email' && templateSubject.trim()) {
        updates.subject = templateSubject.trim();
      }

      const updated = await updateTemplate(editingTemplate.id, updates);
      if (updated) {
        // Reload templates
        const [sms, email] = await Promise.all([
          fetchTemplates('SMS'),
          fetchTemplates('Email')
        ]);
        setSmsTemplates(sms);
        setEmailTemplates(email);

        setEditingTemplate(null);
        setTemplateContent('');
        setTemplateSubject('');
        showNotification('Template updated successfully!', 'success');
      } else {
        showNotification('Failed to update template.', 'error');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      showNotification('Failed to save template. Please try again.', 'error');
    }
  };

  const handleDeleteTemplate = (template: CommunicationTemplate) => {
    setTemplateToDelete(template);
    setShowTemplateDeleteConfirmModal(true);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const success = await deleteTemplate(templateToDelete.id);
      if (success) {
        // Reload templates
        const [sms, email] = await Promise.all([
          fetchTemplates('SMS'),
          fetchTemplates('Email')
        ]);
        setSmsTemplates(sms);
        setEmailTemplates(email);
        showNotification('Template deleted successfully!', 'success');
      } else {
        showNotification('Failed to delete template.', 'error');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      showNotification('Failed to delete template. Please try again.', 'error');
    } finally {
      setShowTemplateDeleteConfirmModal(false);
      setTemplateToDelete(null);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplateName.trim() || !templateContent.trim()) {
      showNotification('Please fill in template name and content.', 'warning');
      return;
    }

    try {
      const newTemplate: Partial<CommunicationTemplate> = {
        name: newTemplateName.trim(),
        type: newTemplateType,
        content: templateContent.trim(),
        subject: newTemplateType === 'Email' && templateSubject.trim() ? templateSubject.trim() : undefined,
        variables: []
      };

      const created = await createTemplate(newTemplate);
      if (created) {
        // Reload templates
        const [sms, email] = await Promise.all([
          fetchTemplates('SMS'),
          fetchTemplates('Email')
        ]);
        setSmsTemplates(sms);
        setEmailTemplates(email);

        setShowAddTemplateModal(false);
        setNewTemplateName('');
        setTemplateContent('');
        setTemplateSubject('');
        showNotification('Template created successfully!', 'success');
      } else {
        showNotification('Failed to create template.', 'error');
      }
    } catch (err) {
      console.error('Error creating template:', err);
      showNotification('Failed to create template. Please try again.', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setTemplateNotificationMessage(message);
    setTemplateNotificationType(type);
    setShowTemplateNotificationModal(true);
  };

  const handleBulkAssign = () => {
    setBulkAssignAgentId('');
    setBulkAssignPriority('Medium');
    setBulkAssignNotes('');
    setShowBulkAssignModal(true);
  };

  const handleBulkExport = () => {
    setShowBulkExportModal(true);
  };

  const handleBulkDelete = () => {
    setBulkDeleteReason('');
    setShowBulkDeleteModal(true);
  };

  const openArchiveByDateModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setArchiveDateFrom('');
    setArchiveDateTo(today);
    setArchiveStageMode('call-2-5');
    setArchiveRecentDays(14);
    setArchivePreviewRows([]);
    setArchivePreviewTotal(0);
    setArchivePreviewTruncated(false);
    setArchivePreviewSelectedIds([]);
    setBulkArchiveReason('Aged funnel cleanup');
    setShowArchiveByDateModal(true);
  };

  const buildArchiveDateTime = (dateValue: string, endOfDay = false) => {
    if (!dateValue) return '';
    return `${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`;
  };

  const loadArchiveByDatePreview = async () => {
    if (!archiveDateFrom || !archiveDateTo) {
      setError('Choose both archive date fields before previewing.');
      return;
    }

    setIsLoadingArchivePreview(true);
    setError(null);

    try {
      const preview = await fetchFunnelArchivePreview({
        createdFrom: buildArchiveDateTime(archiveDateFrom),
        createdTo: buildArchiveDateTime(archiveDateTo, true),
        stageMode: archiveStageMode,
        recentActivityDays: archiveRecentDays,
        limit: 1000,
      });
      const recommendedIds = preview.rows
        .filter(row => row.recommended)
        .map(row => row.lead.id);

      setArchivePreviewRows(preview.rows);
      setArchivePreviewTotal(preview.totalMatched);
      setArchivePreviewTruncated(preview.truncated);
      setArchivePreviewSelectedIds(recommendedIds);
    } catch (err) {
      console.error('Error loading archive preview:', err);
      setError('Failed to load archive preview. Please try again.');
    } finally {
      setIsLoadingArchivePreview(false);
    }
  };

  const toggleArchivePreviewLead = (leadId: string) => {
    setArchivePreviewSelectedIds(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectRecommendedArchivePreviewLeads = () => {
    setArchivePreviewSelectedIds(archivePreviewRows.filter(row => row.recommended).map(row => row.lead.id));
  };

  const selectAllArchivePreviewLeads = () => {
    setArchivePreviewSelectedIds(archivePreviewRows.map(row => row.lead.id));
  };

  const clearArchivePreviewSelection = () => {
    setArchivePreviewSelectedIds([]);
  };

  const handleConfirmArchiveByDate = async () => {
    if (archivePreviewSelectedIds.length === 0 || !canManageArchive) {
      return;
    }

    setIsArchivingLeads(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const affected = await archiveLeadsForFunnel(archivePreviewSelectedIds, {
        reason: bulkArchiveReason.trim() || 'Aged funnel cleanup',
        archivedById: user?.id,
        archivedByName: user?.name || undefined,
        auto: false
      });

      await loadLeads();
      setSelectedLeads([]);
      setShowArchiveByDateModal(false);
      setArchivePreviewRows([]);
      setArchivePreviewSelectedIds([]);
      setSidebarRefreshKey(prev => prev + 1);
      setSuccessMessage(`${affected} lead${affected === 1 ? '' : 's'} archived from the selected date range.`);
    } catch (err) {
      console.error('Error archiving preview leads:', err);
      setError('Failed to archive selected preview leads. Please try again.');
    } finally {
      setIsArchivingLeads(false);
    }
  };

  const handleBulkArchive = () => {
    setBulkArchiveReason('Aged funnel cleanup');
    setShowBulkArchiveModal(true);
  };

  const handleConfirmBulkArchive = async () => {
    if (selectedLeads.length === 0 || !canManageArchive) {
      return;
    }

    setIsArchivingLeads(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const affected = await archiveLeadsForFunnel(selectedLeads, {
        reason: bulkArchiveReason.trim() || 'Aged funnel cleanup',
        archivedById: user?.id,
        archivedByName: user?.name || undefined,
        auto: false
      });

      await loadLeads();
      if (selectedLead && selectedLead.id && selectedLeads.includes(selectedLead.id)) {
        closeLeadDetail();
      }
      setSelectedLeads([]);
      setShowBulkArchiveModal(false);
      setBulkArchiveReason('Aged funnel cleanup');
      setSidebarRefreshKey(prev => prev + 1);
      setSuccessMessage(`${affected} lead${affected === 1 ? '' : 's'} archived from active funnels.`);
    } catch (err) {
      console.error('Error archiving leads:', err);
      setError('Failed to archive leads. Please try again.');
    } finally {
      setIsArchivingLeads(false);
    }
  };

  const handleRestoreSelectedArchivedLeads = async () => {
    if (selectedLeads.length === 0 || !canManageArchive) {
      return;
    }

    setIsArchivingLeads(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const affected = await restoreFunnelArchivedLeads(selectedLeads, {
        restoredById: user?.id,
        restoredByName: user?.name || undefined,
        reason: 'Manager restored from archive'
      });

      await loadLeads();
      setSelectedLeads([]);
      setSidebarRefreshKey(prev => prev + 1);
      setSuccessMessage(`${affected} lead${affected === 1 ? '' : 's'} restored to active funnels.`);
    } catch (err) {
      console.error('Error restoring archived leads:', err);
      setError('Failed to restore archived leads. Please try again.');
    } finally {
      setIsArchivingLeads(false);
    }
  };

  const handleRestoreSelectedLead = async () => {
    if (!selectedLead?.id || !canManageArchive) {
      return;
    }

    setIsArchivingLeads(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const affected = await restoreFunnelArchivedLeads([selectedLead.id], {
        restoredById: user?.id,
        restoredByName: user?.name || undefined,
        reason: 'Manager restored from archive'
      });

      const refreshed = await fetchLeadById(selectedLead.id);
      if (refreshed) {
        setSelectedLead(refreshed);
      }
      await loadLeads();
      setSidebarRefreshKey(prev => prev + 1);
      setSuccessMessage(`${affected || 1} lead restored to active funnels.`);
    } catch (err) {
      console.error('Error restoring archived lead:', err);
      setError('Failed to restore archived lead. Please try again.');
    } finally {
      setIsArchivingLeads(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      return;
    }

    setIsDeletingLeads(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const success = await deleteLeads(selectedLeads, {
        reason: bulkDeleteReason,
        deletedById: user?.id,
        deletedByName: user?.name || undefined
      });

      if (!success) {
        throw new Error('Failed to delete leads');
      }

      await loadLeads();
      if (selectedLead && selectedLead.id && selectedLeads.includes(selectedLead.id)) {
        closeLeadDetail();
      }
      setSelectedLeads([]);
      setShowBulkDeleteModal(false);
      setBulkDeleteReason('');
      setSuccessMessage('Selected leads have been deleted from the CRM.');
    } catch (err) {
      console.error('Error deleting leads:', err);
      setError('Failed to delete leads. Please try again.');
    } finally {
      setIsDeletingLeads(false);
    }
  };

  const handleAddLead = () => {
    setShowAddLeadModal(true);
  };

  const handleOpenScheduleEmailModal = () => {
    if (!selectedLead) {
      setEmailFeedback({
        type: 'error',
        title: 'Select a lead',
        message: 'Choose a lead before scheduling an email.'
      });
      return;
    }

    if (!isOutlookReady) {
      setEmailFeedback({
        type: 'error',
        title: 'Outlook not connected',
        message: 'Connect the shared Outlook mailbox in Settings → Notifications before scheduling emails.'
      });
      return;
    }

    const defaultDate = new Date();
    defaultDate.setMinutes(defaultDate.getMinutes() + 30);
    setScheduleDate(defaultDate.toISOString().split('T')[0]);
    setScheduleTime(defaultDate.toTimeString().slice(0, 5));
    setScheduleError(null);
    setShowScheduleEmailModal(true);
  };

  const handleAttachQuote = useCallback(async () => {
    if (quoteAttachment) {
      setQuoteAttachment(null);
      setEmailFeedback({
        type: 'success',
        title: 'Attachment removed',
        message: 'Quote PDF will no longer be attached to the email.'
      });
      return;
    }

    if (!leadQuote) {
      setEmailFeedback({
        type: 'error',
        title: 'No quote available',
        message: 'Generate a quote before attaching the PDF.'
      });
      return;
    }

    try {
      setIsGeneratingQuoteAttachment(true);
      const { doc, fileName } = await buildQuotePdf(leadQuote);
      const arrayBuffer = doc.output('arraybuffer');
      const base64 = arrayBufferToBase64(arrayBuffer);
      setQuoteAttachment({
        fileName,
        contentType: 'application/pdf',
        contentBytes: base64
      });
      setEmailFeedback({
        type: 'success',
        title: 'Quote attached',
        message: `${fileName} will be sent with the email.`
      });
    } catch (error) {
      console.error('Error generating quote attachment:', error);
      setEmailFeedback({
        type: 'error',
        title: 'Attachment failed',
        message: 'Unable to generate the quote PDF. Please try again.'
      });
    } finally {
      setIsGeneratingQuoteAttachment(false);
    }
  }, [leadQuote, quoteAttachment]);

  const handleSendSMS = async () => {
    if (!selectedLead) {
      setEmailFeedback({
        type: 'error',
        title: 'Select a lead',
        message: 'Choose a lead before sending an SMS.'
      });
      return;
    }

    if (!isTwilioReady) {
      setEmailFeedback({
        type: 'error',
        title: 'Twilio not connected',
        message: 'Twilio is not configured. Please ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set in the server .env file.'
      });
      return;
    }

    if (!selectedLead.phone) {
      setEmailFeedback({
        type: 'error',
        title: 'Missing phone number',
        message: 'This lead does not have a phone number yet. Update the lead details first.'
      });
      return;
    }

    if (!customMessage.trim()) {
      setEmailFeedback({
        type: 'error',
        title: 'Message required',
        message: 'Enter an SMS message before sending.'
      });
      return;
    }

    setIsSendingSMS(true);
    try {
      const result = await sendSMS({
        to: selectedLead.phone,
        message: customMessage.trim(),
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        metadata: {
          templateId: selectedTemplate || null,
          sentBy: user?.id || null,
          sentByName: user?.name || null
        }
      });

      // Log activity
      // Generate a UUID for the contact attempt entity (Twilio SID is not a UUID)
      const smsAttemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: smsAttemptId,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        actionDescription: `SMS sent to ${selectedLead.phone}`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name || 'Unknown',
        metadata: {
          channel: 'sms',
          message: customMessage.trim(),
          templateId: selectedTemplate || null,
          twilioSid: result.sid
        }
      });

      try {
        const attempts = await fetchContactAttempts(selectedLead.id);
        setContactAttempts(attempts);
      } catch (err) {
        console.error('Failed to refresh contact attempts after sending SMS:', err);
      }

      setEmailFeedback({
        type: 'success',
        title: 'SMS sent',
        message: `SMS sent to ${selectedLead.name || selectedLead.phone}.`
      });

      // Don't clear message - keep it like email does
      // setCustomMessage('');
      setSelectedTemplate('');
    } catch (error: any) {
      const message = error?.message || 'Unable to send SMS via Twilio.';
      console.error('Twilio SMS send failed:', error);
      if (message.toLowerCase().includes('not connected') || message.toLowerCase().includes('configure')) {
        setIsTwilioReady(false);
        setTwilioPhoneNumber(null);
      }
      setEmailFeedback({
        type: 'error',
        title: 'Failed to send',
        message
      });
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedLead) {
      setEmailFeedback({
        type: 'error',
        title: 'Select a lead',
        message: 'Choose a lead before sending an email.'
      });
      return;
    }

    if (!isOutlookReady) {
      setEmailFeedback({
        type: 'error',
        title: 'Outlook not connected',
        message: 'Connect the shared Outlook mailbox in Settings → Notifications to enable sending.'
      });
      return;
    }

    if (!selectedLead.email) {
      setEmailFeedback({
        type: 'error',
        title: 'Missing email address',
        message: 'This lead does not have an email address yet. Update the lead details first.'
      });
      return;
    }

    if (!emailSubject.trim()) {
      setEmailFeedback({
        type: 'error',
        title: 'Subject required',
        message: 'Add an email subject before sending.'
      });
      return;
    }

    if (!emailContent.trim()) {
      setEmailFeedback({
        type: 'error',
        title: 'Content required',
        message: 'Compose the email content before sending.'
      });
      return;
    }

    setIsEmailSending(true);

    const htmlBody = emailContent
      .split('\n')
      .map((line) => (line.trim().length > 0 ? line : '&nbsp;'))
      .join('<br />');

    try {
      console.log('=== SENDING EMAIL (handleSendEmail) ===');
      console.log('Has attachment:', !!quoteAttachment);
      if (quoteAttachment) {
        console.log('Attachment details:', {
          fileName: quoteAttachment.fileName,
          contentType: quoteAttachment.contentType,
          contentBytesLength: quoteAttachment.contentBytes?.length || 0,
          firstChar: quoteAttachment.contentBytes?.[0],
          lastChar: quoteAttachment.contentBytes?.[quoteAttachment.contentBytes.length - 1],
          isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(quoteAttachment.contentBytes || '')
        });
      }

      await sendOutlookEmail({
        to: selectedLead.email,
        subject: emailSubject.trim(),
        htmlBody,
        textBody: emailContent,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        metadata: {
          templateId: selectedTemplate || null,
          sentBy: user?.id || null,
          sentByName: user?.name || null
        },
        attachments: quoteAttachment ? [quoteAttachment] : undefined
      });
      console.log('=== EMAIL SENT SUCCESSFULLY ===');

      const contactAttemptId =
        typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: contactAttemptId,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        actionDescription: `Email sent to ${selectedLead.email}`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name || 'Unknown',
        metadata: {
          channel: 'email',
          subject: emailSubject.trim(),
          templateId: selectedTemplate || null
        }
      });

      try {
        const attempts = await fetchContactAttempts(selectedLead.id);
        setContactAttempts(attempts);
      } catch (err) {
        console.error('Failed to refresh contact attempts after sending email:', err);
      }

      setEmailFeedback({
        type: 'success',
        title: 'Email sent',
        message: `Email sent to ${selectedLead.name || selectedLead.email}.`
      });
      setQuoteAttachment(null);
    } catch (error: any) {
      const message = error?.message || 'Unable to send email via Outlook.';
      console.error('Outlook email send failed:', error);
      if (message.toLowerCase().includes('not connected') || message.toLowerCase().includes('connect')) {
        setIsOutlookReady(false);
        setOutlookMailboxEmail(null);
      }
      setEmailFeedback({
        type: 'error',
        title: 'Failed to send',
        message
      });
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleScheduleEmail = async () => {
    if (!selectedLead) {
      setScheduleError('Select a lead before scheduling an email.');
      return;
    }

    if (quoteAttachment) {
      setScheduleError('Attachments are not supported for scheduled emails. Send immediately or remove the quote attachment.');
      return;
    }

    if (!selectedLead.email) {
      setScheduleError('This lead does not have an email address yet.');
      return;
    }

    if (!isOutlookReady) {
      setScheduleError('Connect the Outlook shared mailbox in Settings before scheduling emails.');
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Select both a date and time to schedule the email.');
      return;
    }

    if (!emailSubject.trim()) {
      setScheduleError('Add an email subject before scheduling.');
      return;
    }

    if (!emailContent.trim()) {
      setScheduleError('Compose the email content before scheduling.');
      return;
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(scheduledDateTime.getTime())) {
      setScheduleError('Invalid date or time selected.');
      return;
    }

    if (scheduledDateTime.getTime() < Date.now() + 60_000) {
      setScheduleError('Scheduled time must be at least 1 minute in the future.');
      return;
    }

    setIsSchedulingEmail(true);

    const htmlBody = emailContent
      .split('\n')
      .map((line) => (line.trim().length > 0 ? line : '&nbsp;'))
      .join('<br />');

    try {
      await scheduleOutlookEmail({
        to: selectedLead.email,
        subject: emailSubject.trim(),
        htmlBody,
        textBody: emailContent,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        metadata: {
          templateId: selectedTemplate || null,
          scheduled: true,
          scheduledBy: user?.id || null
        },
        sendAt: scheduledDateTime.toISOString(),
        scheduledBy: user?.id || undefined,
        scheduledByName: user?.name || undefined
      });

      const scheduledAttemptId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: scheduledAttemptId,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        actionDescription: `Email scheduled for ${scheduledDateTime.toLocaleString('en-GB')} to ${selectedLead.email}`,
        doneByType: 'user',
        doneById: user?.id,
        doneByName: user?.name || 'Unknown',
        metadata: {
          channel: 'email',
          subject: emailSubject.trim(),
          sendAt: scheduledDateTime.toISOString(),
          scheduled: true,
          templateId: selectedTemplate || null
        }
      });

      setEmailFeedback({
        type: 'success',
        title: 'Email scheduled',
        message: `Email to ${selectedLead.name || selectedLead.email} will send at ${scheduledDateTime.toLocaleString('en-GB')}.`
      });

      setScheduleError(null);
      setShowScheduleEmailModal(false);
    } catch (error: any) {
      const message = error?.message || 'Unable to schedule email.';
      console.error('Schedule email failed:', error);
      setScheduleError(message);
    } finally {
      setIsSchedulingEmail(false);
    }
  };

  const handleSaveNewLead = async () => {
    if (isSavingLead) return; // Prevent double submission

    setIsSavingLead(true);
    try {
      // Include supplements and disbursements in the lead data
      // Ensure duplicate leads are assigned to current agent
      const leadDataWithQuote = {
        ...newLead,
        assignedTo: user?.id || newLead.assignedTo, // Always assign to current agent if creating manually
        quoteSupplements: supplements,
        quoteDisbursements: disbursements,
        propertyValue: typeof newLead.propertyValue === 'string'
          ? (newLead.propertyValue ? parseFloat(newLead.propertyValue) : undefined)
          : newLead.propertyValue
      };
      const created = await createLead(leadDataWithQuote);
      if (created && created.id) {
        // Log activity
        await logActivity({
          activityType: 'lead_created',
          entityType: 'lead',
          entityId: created.id,
          leadId: created.id,
          leadName: created.name,
          actionDescription: 'New lead created',
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name || 'Unknown',
        });

        await loadLeads();

        // Reset form
        setSupplements([]);
        setDisbursements([]);
        setNewLead({
          name: '',
          email: '',
          phone: '',
          source: 'Direct' as const,
          priority: 'Medium' as const,
          status: 'New' as const,
          stage: 'New' as const,
          assignedTo: '',
          transactionType: '' as any,
          notes: '',
          // Property fields
          propertyAddress: '',
          propertyValue: '',
          propertyTenure: '',
          propertyTitleNumber: '',
          propertyRegion: '',
          // Quote-related fields
          legalFees: '',
          sdtlVersion: '',
          numberOfPeople: '1',
          customMessage: '',
          // Client info
          clientAddress: '',
          clientDob: '',
          clientNi: '',
          // Property flags
          isMortgaged: false,
          isUnregistered: false,
          isFirstTimeBuyer: false,
          isNewBuild: false,
          isSharedOwnership: false,
          isBuyToLet: false,
        });

        // Close modal and show success notification
        setShowAddLeadModal(false);
        setLeadNotificationMessage(`Lead "${created.name}" has been created successfully!`);
        setLeadNotificationType('success');
        setShowLeadNotificationModal(true);
      } else {
        throw new Error('Failed to create lead. No lead ID returned.');
      }
    } catch (err: any) {
      console.error('Error creating lead:', err);
      const errorMessage = err?.message || 'Failed to create lead. Please try again.';
      setLeadNotificationMessage(errorMessage);
      setLeadNotificationType('error');
      setShowLeadNotificationModal(true);
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleAdvancedFilters = () => {
    setShowAdvancedFilters(!showAdvancedFilters);
  };

  const handleApplyFilters = () => {
    console.log('Apply advanced filters:', advancedFilters);

    // Map advanced filter values to existing filter state variables
    if (advancedFilters.status) {
      setUrlStatusValues([]);
      setFilterStatus(advancedFilters.status);
    } else {
      setUrlStatusValues([]);
      setFilterStatus('All');
    }

    if (advancedFilters.source) {
      setFilterSource(advancedFilters.source);
    } else {
      setFilterSource('All');
    }

    // Map ageRange values (advanced filter uses lowercase, regular filter uses capitalized)
    if (advancedFilters.ageRange) {
      const ageMap: { [key: string]: string } = {
        'new': 'New',
        'old': 'Old',
        'overdue': 'Overdue',
        'veryOld': 'Old' // Very old is still "Old" category
      };
      setFilterAge(ageMap[advancedFilters.ageRange] || 'All');
    } else {
      setFilterAge('All');
    }

    // Handle priority filter - set selectedStage to trigger priority filtering
    // Note: This will override the current stage view, but priority filtering takes precedence
    if (advancedFilters.priority) {
      // We'll need to add priority to the filters in loadLeads
      // For now, we can store it in a separate state or add it to the filters object
      // Since loadLeads already handles priority when selectedStage === 'highPriority',
      // we can use a similar approach or add priority as a direct filter
      // For simplicity, we'll add it to the filters object in loadLeads
    }

    // Handle assignedTo filter
    if (advancedFilters.assignedTo === 'unassigned') {
      setSelectedStage('unassigned');
    } else if (advancedFilters.assignedTo) {
      // For specific agent assignment, we'll add it to the filters in loadLeads
      // Reset stage to 'all' to show all leads for that agent
      setSelectedStage('all');
    }

    // Date range filtering can be added later if needed

    // Close the modal and reload leads
    setShowAdvancedFilters(false);
    // The useEffect will automatically call loadLeads when filterStatus, filterSource, or filterAge changes
  };

  const handleClearFilters = () => {
    setUrlStatusValues([]);
    setAdvancedFilters({
      dateRange: '',
      source: '',
      priority: '',
      status: '',
      assignedTo: '',
      ageRange: ''
    });
  };

  const handleStageSelect = (stage: string) => {
    setSelectedStage(stage);
    const nextParams = new URLSearchParams();
    if (stage === 'unassigned') {
      nextParams.set('filter', 'unassigned');
    } else if (stage === 'archived') {
      nextParams.set('filter', 'archived');
    } else if (stage !== 'all') {
      nextParams.set('stage', stage);
    }
    setSearchParams(nextParams, { replace: true });

    // Quick action shortcuts should always show fresh, unfiltered data
    // so reset the basic filters when changing stage.
    setFilterStatus('All');
    setUrlStatusValues([]);
    setFilterSource('All');
    setFilterAge('All');
    setSearchTerm('');

    // Reset any lead-specific UI so the new stage starts clean
    closeLeadDetail();
    setSelectedLeads([]);
  };

  const handleViewLead = (lead: Lead) => {
    if (user?.role === 'Agent' && selectedStage === 'team-progress') {
      return;
    }
    setSelectedLead(lead);
    setShowLeadDetail(true);
  };

  // Stats state - using fetchLeadSummary for accurate, fast counts (same as sidebar)
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    unassignedLeads: 0,
    overdueLeads: 0,
    avgAge: 0,
    oldestAge: 0,
    oldestLead: 'N/A'
  });

  // Fetch stats using fetchLeadSummary (same as sidebar - ensures consistency and fast performance)
  useEffect(() => {
    const loadStats = async () => {
      if (authLoading || !user) return;

      try {
        // Use fetchLeadSummary for fast, accurate counts (same logic as sidebar)
        const summary = await fetchLeadSummary(user.role as 'Admin' | 'Manager' | 'Agent', user.id);

        // For "Assigned" count: use assignedActive from summary (all assigned active leads)
        const assignedCount = summary.assignedActive;

        // For "Unassigned" count: use unassignedActive from summary
        const unassignedCount = summary.unassignedActive;

        // For "Overdue" count: use overdue from summary
        const overdueCount = summary.overdue;

        // For "Avg Age": we need to calculate from active leads (fetch a sample for age calculation)
        // Note: Avg Age calculation requires fetching some leads, so we'll use a simplified approach
        let avgAge = 0;
        if (summary.totalActive > 0) {
          // Fetch a small sample of active leads to calculate avg age
          // We'll fetch just enough to get a representative sample (limit to 50 for performance)
          const sampleSize = Math.min(50, summary.totalActive);
          const { supabase } = await import('@/lib/supabase');
          const ACTIVE_STATUSES_EXCLUDE = '("Sold","Closed","Archived")';
          let ageQuery = supabase
            .from('leads')
            .select('created_at')
            .not('is_funnel_archived', 'is', true)
            .not('status', 'in', ACTIVE_STATUSES_EXCLUDE);

        if (user.role === 'Agent' && user.id) {
            ageQuery = ageQuery.eq('assigned_to', user.id);
          }

          const { data: sampleLeads } = await ageQuery
            .order('created_at', { ascending: false })
            .limit(sampleSize);

          if (sampleLeads && sampleLeads.length > 0) {
            const now = Date.now();
            const totalAgeHours = sampleLeads.reduce((sum, lead: any) => {
              const createdAt = new Date(lead.created_at).getTime();
              const ageHours = (now - createdAt) / (1000 * 60 * 60);
              return sum + ageHours;
            }, 0);
            avgAge = totalAgeHours / sampleLeads.length;
          }
        }

        // For Agents: "Assigned" count shows their assigned active leads
        // For Admin/Manager: "Assigned" count shows all assigned active leads
        const assignedDisplayCount = user.role === 'Agent'
          ? summary.totalActive // For agents, totalActive is their assigned leads
          : assignedCount; // For admin/manager, use assignedActive

        setStats({
          totalLeads: summary.totalActive,
          newLeads: assignedDisplayCount, // "Assigned" count shows assigned active leads
          unassignedLeads: unassignedCount,
          overdueLeads: overdueCount,
          avgAge: Math.round(avgAge * 10) / 10,
          oldestAge: 0, // Not critical for stats cards
          oldestLead: 'N/A'
        });
      } catch (err) {
        console.error('Error loading stats:', err);
        setStats({
        totalLeads: 0,
        newLeads: 0,
        unassignedLeads: 0,
        overdueLeads: 0,
        avgAge: 0,
        oldestAge: 0,
        oldestLead: 'N/A'
        });
      }
    };

    loadStats();
  }, [user?.id, user?.role, authLoading]);
  const totalContactAttemptPages = Math.max(1, Math.ceil(contactAttempts.length / CONTACT_ATTEMPTS_PER_PAGE));
  const currentContactAttemptPage = Math.min(contactAttemptsPage, totalContactAttemptPages);
  const contactAttemptStartIndex = (currentContactAttemptPage - 1) * CONTACT_ATTEMPTS_PER_PAGE;
  const paginatedContactAttempts = contactAttempts.slice(
    contactAttemptStartIndex,
    contactAttemptStartIndex + CONTACT_ATTEMPTS_PER_PAGE
  );
  const instructionCountsByAgent = instructionTrackerLeads.reduce<Record<string, number>>((acc, lead) => {
    const key = getInstructionAgentName(lead);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

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

  const handleDownloadInstructionPdf = useCallback(async () => {
    if (!selectedLead) return;
    try {
      const pdfUrl = (selectedLead as any)?.instruction_pdf_url || (selectedLead as any)?.instructionPdfUrl;
      if (pdfUrl) {
        // Fetch PDF as blob and download directly (hides Supabase URL)
        const res = await fetch(pdfUrl, { credentials: 'omit' });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `Instruction_${selectedLead.shortCode || selectedLead.id}_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        // Fallback: regenerate from lead data
        const { doc, fileName } = await buildInstructionPdf(selectedLead as any);
        doc.save(fileName);
      }
    } catch (e) {
      console.error('Failed to download instruction PDF:', e);
      setLinkNotification({ type: 'error', message: 'Failed to download instruction PDF' });
      setTimeout(() => setLinkNotification(null), 4000);
    }
  }, [selectedLead]);

  const handleResetInstructionForm = useCallback(async () => {
    if (!selectedLead) return;

    setIsResettingInstruction(true);
    try {
      // Clear instruction form fields - use camelCase to match Lead interface
      const updates: any = {
        instructionFormStatus: null,
        instructionPdfUrl: null,
        instructionFormSubmittedAt: null,
        instructionPdfGeneratedAt: null,
        instructionFormToken: null, // Clear token so old link becomes invalid
        instructionFormLink: null // Clear link
      };

      const updatedLead = await updateLead(selectedLead.id, updates, user?.role, user?.id);

      if (updatedLead) {
        // Update local state
        setSelectedLead(updatedLead);

        // Reload the lead to ensure we have the latest data
        const { fetchLeadById } = await import('@/services/leadsService');
        const refreshedLead = await fetchLeadById(selectedLead.id);
        if (refreshedLead) {
          setSelectedLead(refreshedLead);
        }

        // Log activity - ensure doneByType is always provided
        try {
          await logActivity({
            entityType: 'lead',
            entityId: selectedLead.id,
            activityType: 'instruction_form_reset',
            actionDescription: `Instruction form reset by ${user?.name || 'User'}`,
            doneByType: 'user', // Required field
            doneById: user?.id || undefined,
            doneByName: user?.name || undefined,
            leadId: selectedLead.id,
            leadName: selectedLead.name,
            metadata: {
              resetBy: user?.id,
              resetAt: new Date().toISOString()
            }
          });
        } catch (activityError) {
          console.warn('Could not log instruction form reset activity:', activityError);
        }

        setLinkNotification({
          type: 'success',
          message: 'Instruction form has been reset. The client can now fill it again.'
        });
        setTimeout(() => setLinkNotification(null), 4000);
        setShowResetInstructionModal(false);
      } else {
        throw new Error('Failed to reset instruction form');
      }
    } catch (error) {
      console.error('Error resetting instruction form:', error);
      setLinkNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset instruction form. Please try again.'
      });
      setTimeout(() => setLinkNotification(null), 4000);
    } finally {
      setIsResettingInstruction(false);
    }
  }, [selectedLead, user]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {taskToast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg pointer-events-auto ${
              taskToast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            <span>{taskToast.message}</span>
          </div>,
          document.body
        )}
      {linkNotification &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed top-20 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg pointer-events-auto ${
              linkNotification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            <Copy className="h-4 w-4" />
            <span>{linkNotification.message}</span>
          </div>,
          document.body
        )}
      {/* Hierarchical Lead Sidebar */}
      {showLeadSidebar && (
        <LeadSidebar
          onStageSelect={handleStageSelect}
          selectedStage={selectedStage}
          userRole={user?.role || 'Agent'}
          refreshKey={sidebarRefreshKey}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6 md:p-5 xl:p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                onClick={() => setShowLeadSidebar(!showLeadSidebar)}
                title={showLeadSidebar ? 'Hide Lead Pipeline' : 'Show Lead Pipeline'}
              >
                <User className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
                <p className="text-gray-600">Manage leads, assignments, and contact attempts</p>
              </div>
            </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {(user?.role === 'Admin' || user?.role === 'Manager') && (
            <button
              className="btn-secondary flex items-center space-x-2"
              onClick={() => navigate('/reports/instructions?preset=today')}
            >
              <CheckCircle className="h-5 w-5" />
              <span>View Instructions Report</span>
            </button>
          )}
          <button
            className="btn-secondary flex items-center space-x-2"
            onClick={handleAdvancedFilters}
          >
            <Filter className="h-5 w-5" />
            <span>Advanced Filters</span>
          </button>
          {canManageArchive && (
            <button
              className="btn-secondary flex items-center space-x-2"
              onClick={openArchiveByDateModal}
            >
              <Archive className="h-5 w-5" />
              <span>Archive by Date</span>
            </button>
          )}
          <button
            className="btn-primary flex items-center space-x-2"
            onClick={handleAddLead}
          >
            <UserPlus className="h-5 w-5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 gap-4 ${user?.role === 'Agent' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {/* Only show "Assigned Leads" for Admin/Manager */}
        {user?.role !== 'Agent' && (
          <AttentionStatCard
            title="High Priority"
            value={leads.filter((l) => l.priority === 'High').length}
            note=""
            onClick={() => setSelectedStage('highPriority')}
          />
        )}
        {/* For agents, show "My Assigned Leads" instead */}
        {user?.role === 'Agent' && (
          <div
            className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-gray-300 active:scale-[0.98]"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/lead-management?filter=assigned')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/lead-management?filter=assigned');
              }
            }}
          >
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-500">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Assigned</p>
                <p className="text-2xl font-bold text-gray-900">{stats.newLeads.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
        <div
          className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-gray-300 active:scale-[0.98]"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/lead-management?filter=unassigned')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/lead-management?filter=unassigned');
            }
          }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">{stats.unassignedLeads.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div
          className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-gray-300 active:scale-[0.98]"
          role="button"
          tabIndex={0}
          onClick={() => {
            setFilterAge('Overdue');
            navigate('/lead-management?filterAge=Overdue');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFilterAge('Overdue');
              navigate('/lead-management?filterAge=Overdue');
            }
          }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-500">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdueLeads.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div
          className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-gray-300 active:scale-[0.98]"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/lead-management')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/lead-management');
            }
          }}
        >
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Age</p>
              <p className="text-2xl font-bold text-gray-900">{formatAge(stats.avgAge)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quota Status for Agents */}
      {user?.role === 'Agent' && quotaStatus && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Daily Lead Quota: {quotaStatus.assignedToday} / {quotaStatus.quota ?? 0}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {Math.max(0, (quotaStatus.quota ?? 0) - quotaStatus.assignedToday)} remaining today · {quotaStatus.assignedThisWeek ?? 0}/{quotaStatus.weeklyQuota ?? 0} this week
              </p>
            </div>
            {(quotaStatus.assignedToday >= quotaStatus.quota || (
              typeof quotaStatus.weeklyQuota === 'number' && (quotaStatus.assignedThisWeek ?? 0) >= quotaStatus.weeklyQuota
            )) && (
              <button
                type="button"
                className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100"
                onClick={() => showQuotaReachedModal()}
              >
                Quota Reached
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads by name, email, phone, campaign, keyword, or click ID..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => {
                setUrlStatusValues([]);
                setFilterStatus(e.target.value);
              }}
            >
              <option value="All">All Status</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Quote Sent">Quote Sent</option>
              <option value="Sold">Sold</option>
              <option value="Closed">Closed</option>
              <option value="Archived">Deleted</option>
            </select>
            <select
              className="input-field"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="All">All Sources</option>
              {LEAD_SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            <select
              className="input-field"
              value={filterAge}
              onChange={(e) => setFilterAge(e.target.value)}
            >
              <option value="All">All Ages</option>
              <option value="New">New (&lt; 24h)</option>
              <option value="Old">Old (≥ 24h)</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-blue-800">
              {selectedLeads.length} lead(s) selected
            </span>
              <button
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 transition-colors"
                onClick={() => setSelectedLeads([])}
                title="Clear Selection"
              >
                <X className="h-4 w-4" />
                <span>Clear Selection</span>
              </button>
            </div>
            <div className="flex space-x-2">
              {(selectedStage === 'archived' || selectedStage.startsWith('archived:')) && canManageArchive ? (
                <button
                  className="btn-primary text-sm"
                  onClick={handleRestoreSelectedArchivedLeads}
                  disabled={isArchivingLeads}
                >
                  {isArchivingLeads ? 'Restoring...' : 'Restore Selected'}
                </button>
              ) : (
                <>
                  <button
                    className="btn-primary text-sm"
                    onClick={handleBulkAssign}
                  >
                    Assign Selected
                  </button>
                  {canManageArchive && (
                    <button
                      className="btn-secondary text-sm flex items-center gap-2"
                      onClick={handleBulkArchive}
                    >
                      <Archive className="h-4 w-4" />
                      Archive Selected
                    </button>
                  )}
                </>
              )}
              <button
                className="btn-secondary text-sm"
                onClick={handleBulkExport}
              >
                Export Selected
              </button>
              <button
                className="btn-danger text-sm"
                onClick={handleBulkDelete}
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading leads...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="card bg-red-50 border border-red-200 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
            <button
              className="ml-auto text-red-600 hover:text-red-800"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="card bg-green-50 border border-green-200 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-green-800">{successMessage}</p>
            <button
              className="ml-auto text-green-600 hover:text-green-800"
              onClick={() => setSuccessMessage(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quote Notifications */}
      {quoteNotifications.length > 0 && currentNotificationIndex < quoteNotifications.length && (
        <QuoteNotificationPopup
          notification={quoteNotifications[currentNotificationIndex]}
          onClose={handleNotificationClose}
          onMarkRead={handleNotificationMarkRead}
          autoCloseDelay={10000}
        />
      )}

      {activeLeadManagementView === 'instructions' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-emerald-600" />
                  Instructions Tracker
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Operational view of manually marked instructions by date and credited user.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[42rem]">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Start</label>
                  <input
                    type="date"
                    className="input-field"
                    value={instructionStartDate}
                    onChange={(e) => setInstructionStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">End</label>
                  <input
                    type="date"
                    className="input-field"
                    value={instructionEndDate}
                    onChange={(e) => setInstructionEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Credited User</label>
                  <select
                    className="input-field"
                    value={instructionAgentFilter}
                    onChange={(e) => setInstructionAgentFilter(e.target.value)}
                  >
                    <option value="all">All credited users</option>
                    {getCreditUserOptions().map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} ({option.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Instructions in Range</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{instructionTrackerLeads.length}</p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{todayInstructionLeads.length}</p>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-600">By Credited User</p>
              <div className="mt-2 space-y-1">
                {Object.keys(instructionCountsByAgent).length === 0 ? (
                  <p className="text-sm text-gray-500">No instructions in range</p>
                ) : (
                  Object.entries(instructionCountsByAgent).map(([agentName, count]) => (
                    <div key={agentName} className="flex items-start justify-between gap-3 text-sm">
                      <span className="break-words leading-5 text-gray-700" title={agentName}>{agentName}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-semibold text-gray-900">Instructed Leads</h3>
              {isLoadingInstructions && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
            {instructionTrackerLeads.length === 0 && !isLoadingInstructions ? (
              <div className="py-10 text-center">
                <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No manual instructions found for this date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Lead</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Contact</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Instructed</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Credited</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Marked By</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Source</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Ad</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Stage / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {instructionTrackerLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="cursor-pointer hover:bg-emerald-50/60"
                        onClick={async () => {
                          const refreshed = await refreshSelectedLead(lead.id);
                          setSelectedLead(refreshed || lead);
                          setShowLeadDetail(true);
                        }}
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.shortCode || lead.id}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="max-w-[18rem] break-all text-gray-900" title={lead.email}>{lead.email || 'No email'}</div>
                          <div className="text-xs text-gray-500">{lead.phone || 'No phone'}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-900">
                          {lead.manualInstructedAt ? formatDateTime(lead.manualInstructedAt) : 'Not captured'}
                        </td>
                        <td className="px-3 py-3 text-gray-900">{getInstructionAgentName(lead)}</td>
                        <td className="px-3 py-3 text-gray-700">{lead.manualInstructedByName || 'Unknown'}</td>
                        <td className="px-3 py-3 text-gray-700">{lead.source || 'Not captured'}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-[20rem] break-words text-gray-900" title={[lead.utmSource, lead.gadCampaignId, lead.utmTerm].filter(Boolean).join(' · ')}>
                            {[lead.utmSource, lead.gadCampaignId && `ID ${lead.gadCampaignId}`, lead.utmTerm].filter(Boolean).join(' · ') || 'Not captured'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-gray-900">{lead.stage}</div>
                          <div className="text-xs text-gray-500">{lead.status}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leads Display - Card Layout */}
      {activeLeadManagementView === 'leads' && (
      !isLoading && !error && filteredLeads.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-400 mb-4">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
          <p className="text-gray-600 mb-4">
            {user?.role === 'Agent' && selectedStage === 'team-progress'
              ? (searchTerm.trim()
                ? 'No assigned team lead matched that name, email, or phone.'
                : 'No active team leads are currently being worked by other agents.')
              : (selectedStage === 'archived' || selectedStage.startsWith('archived:'))
              ? 'No archived leads match the current filters'
              : selectedStage === 'all'
              ? 'No leads match the current filters'
              : `No leads found in the "${selectedStage}" stage`}
          </p>
          <div className="text-sm text-gray-500">
            <p>Total leads in system: {leads.length}</p>
            <p>Selected stage: {selectedStage}</p>
            <p>Search term: "{searchTerm}"</p>
            <p>Status filter: {filterStatus}</p>
            <p>Source filter: {filterSource}</p>
            <p>Age filter: {filterAge}</p>
            {selectedStage === 'unassigned' && (
              <div className="mt-2 p-2 bg-yellow-50 rounded">
                <p className="font-medium">Unassigned leads debug:</p>
                <p>Leads without assignedTo: {leads.filter(l => !l.assignedTo).length}</p>
                <p>Unassigned lead names: {leads.filter(l => !l.assignedTo).map(l => l.name).join(', ')}</p>
              </div>
            )}
            {selectedStage === 'overdue' && (
              <div className="mt-2 p-2 bg-red-50 rounded">
                <p className="font-medium">Overdue leads debug:</p>
                <p>Overdue leads count: {leads.filter(l => l.isOverdue).length}</p>
                <p>Overdue lead names: {leads.filter(l => l.isOverdue).map(l => l.name).join(', ')}</p>
              </div>
            )}
            {selectedStage === 'highPriority' && (
              <div className="mt-2 p-2 bg-orange-50 rounded">
                <p className="font-medium">High Priority leads debug:</p>
                <p>High priority leads count: {leads.filter(l => l.priority === 'High').length}</p>
                <p>High priority lead names: {leads.filter(l => l.priority === 'High').map(l => l.name).join(', ')}</p>
              </div>
            )}
            {selectedStage === 'completedToday' && (
              <div className="mt-2 p-2 bg-green-50 rounded">
                <p className="font-medium">Completed Today debug:</p>
                <p>Sold leads count: {leads.filter(l => l.status === 'Sold').length}</p>
                <p>Sold lead names: {leads.filter(l => l.status === 'Sold').map(l => l.name).join(', ')}</p>
                <p>Today's date: {new Date().toDateString()}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
        {user?.role === 'Agent' && selectedStage === 'team-progress' && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Team Progress</p>
            <p className="mt-1">
              {searchTerm.trim()
                ? 'Read-only owner lookup. Search can find assigned team leads by name, email, or phone without exposing contact details.'
                : 'Read-only view of active leads being worked by the team.'}
            </p>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {paginatedLeads.map((lead) => {
            const quotesForLead = leadQuotesMap.get(lead.id) || [];
            const primaryQuote = quotesForLead[0];
            const sourceLabel = (lead.source || 'Unknown').replace(/^Comparison - /, '');
            const clientPosition = getClientPositionLabel(lead);
            const assignmentLabel = lead.assignedTo
              ? lead.assignedToName || getAgentName(lead.assignedTo) || 'Unknown Agent'
              : 'Unassigned';
            const canUseContactActions = !!lead.assignedTo || user?.role !== 'Agent';
            const quoteTransaction = primaryQuote?.quoteType || primaryQuote?.transactionType || lead.transactionType || 'Quote';
            const quoteAmount = primaryQuote
              ? (primaryQuote.totalIncVat ?? primaryQuote.totalAmount ?? 0)
              : null;
            const formattedQuoteAmount = typeof quoteAmount === 'number'
              ? quoteAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : quoteAmount;
            const isSaleQuote = quoteTransaction === 'Sale';
            const isPurchaseQuote = quoteTransaction === 'Purchase';
            const isAcceptedQuote = primaryQuote?.status === 'Accepted' || primaryQuote?.acceptedAt != null;
            const hasAdCue = !!lead.utmSource || (isManager && !!lead.gadCampaignId) || !!lead.utmTerm;
            const agentQuotaReached = user?.role === 'Agent' && !!quotaStatus && (
              quotaStatus.assignedToday >= quotaStatus.quota ||
              (typeof quotaStatus.weeklyQuota === 'number' && (quotaStatus.assignedThisWeek ?? 0) >= quotaStatus.weeklyQuota)
            );

            if (user?.role === 'Agent' && selectedStage === 'team-progress') {
              const progressLabel = getProgressLabel(lead);
              return (
                <div key={lead.id} className="card border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="break-words text-base font-semibold leading-6 text-gray-900" title={lead.name || 'Client'}>
                          {lead.name || 'Client'}
                        </h3>
                        <span className={`flex-shrink-0 text-xs font-medium ${getAgeColor(lead.ageInHours || 0, lead.isOverdue || false)}`}>
                          {formatAge(lead.ageInHours || 0)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Team visibility only</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      Read-only
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="inline-flex max-w-full items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 ring-1 ring-gray-200" title={assignmentLabel}>
                      Agent: {assignmentLabel}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {formatStatusLabel(lead.status)}
                    </span>
                    {lead.stage && (
                      <span className="inline-flex max-w-full items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800" title={lead.stage}>
                        {lead.stage}
                      </span>
                    )}
                    {sourceLabel && (
                      <span className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700" title={lead.source}>
                        {sourceLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Progress</span>
                      <span className="min-w-0 break-words rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-5 text-emerald-800" title={progressLabel}>
                        {progressLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Contact details, quotes, actions, and attribution are hidden in this awareness view.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={lead.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="break-words text-base font-semibold leading-6 text-gray-900" title={lead.name}>{lead.name}</h3>
                      <span className={`flex-shrink-0 text-xs font-medium ${getAgeColor(lead.ageInHours || 0, lead.isOverdue || false)}`}>
                        {formatAge(lead.ageInHours || 0)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                      <span className="max-w-full break-all leading-5 sm:max-w-[18rem]" title={lead.email}>{lead.email || 'No email'}</span>
                      <span className="hidden sm:inline text-gray-300">·</span>
                      <span className="break-words leading-5" title={lead.phone}>{lead.phone || 'No phone'}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(lead.id)}
                    onChange={() => handleSelectLead(lead.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500 cursor-pointer"
                    title="Select lead"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="inline-flex max-w-full items-center break-words px-2.5 py-1 rounded-full text-xs font-medium leading-5 bg-gray-100 text-gray-800" title={lead.source}>
                    {sourceLabel}
                  </span>
                  {lead.transactionType && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {lead.transactionType}
                    </span>
                  )}
                  {clientPosition && (
                    <span className="inline-flex max-w-full items-center break-words px-2.5 py-1 rounded-full text-xs font-medium leading-5 bg-indigo-100 text-indigo-800" title={clientPosition}>
                      {clientPosition}
                    </span>
                  )}
                  {lead.status !== 'Assigned' && (
                    <span
                      {...(lead.status === 'Interested' ? { 'data-signal': 'intent-interested' } : {})}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}
                    >
                      {lead.status === 'Interested' && <span data-signal-dot />}
                      {formatStatusLabel(lead.status)}
                    </span>
                  )}
                  <span
                    {...(lead.priority === 'High' ? { 'data-signal': 'priority-high' } : {})}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(lead.priority)}`}
                  >
                    {lead.priority === 'High' && <span data-signal-dot />}
                    {lead.priority}
                  </span>
                  {lead.isManuallyInstructed && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      Instructed
                    </span>
                  )}
                  {lead.quoteAcceptedAt && (
                    <span
                      data-signal="milestone-quote-accepted"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white"
                      title={`Quote accepted from email ${formatDateTime(lead.quoteAcceptedAt)}`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Quote accepted from Email
                    </span>
                  )}
                  {lead.callbackStatus === 'requested' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      <Phone className="h-3.5 w-3.5" />
                      Callback requested
                    </span>
                  )}
                  {lead.callbackStatus === 'contacted' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Phone className="h-3.5 w-3.5" />
                      Callback: contacted
                    </span>
                  )}
                  {lead.callbackStatus === 'completed' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Phone className="h-3.5 w-3.5" />
                      Callback done
                    </span>
                  )}
                  {lead.instructionRequestStatus === 'requested' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                      Instruction requested
                    </span>
                  )}
                  {lead.instructionRequestStatus === 'contacted' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Instruction: contacted
                    </span>
                  )}
                  {lead.instructionRequestStatus === 'completed' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Instruction request done
                    </span>
                  )}
                  {lead.isFunnelArchived && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      <Archive className="h-3.5 w-3.5" />
                      Archived
                    </span>
                  )}
                  {lead.outcomeCode && (
                    <span className="inline-flex max-w-full items-center break-words px-2.5 py-1 rounded-full text-xs font-medium leading-5 bg-gray-50 text-gray-700 border border-gray-200" title={lead.outcomeCode}>
                      {lead.outcomeCode}
                    </span>
                  )}
                </div>

                {(lead.callbackStatus === 'requested' || lead.callbackStatus === 'contacted') && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-medium text-amber-900">
                      <Phone className="h-3.5 w-3.5" />
                      Callback requested
                      {lead.callbackFirmName ? ` — ${lead.callbackFirmName}` : ''}
                    </div>
                    {lead.callbackRequestedAt && (
                      <div className="mt-0.5 text-amber-700">
                        {formatDateTime(lead.callbackRequestedAt)}
                        {lead.callbackStatus === 'contacted' && lead.callbackContactedAt
                          ? ` · contacted ${formatDateTime(lead.callbackContactedAt)}`
                          : ''}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {lead.callbackStatus === 'requested' && (
                        <button
                          type="button"
                          disabled={callbackBusyId === lead.id}
                          onClick={(e) => { e.stopPropagation(); handleCallbackTransition(lead, 'contacted'); }}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-amber-800 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Mark contacted
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={callbackBusyId === lead.id}
                        onClick={(e) => { e.stopPropagation(); handleCallbackTransition(lead, 'completed'); }}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-emerald-800 border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Mark completed
                      </button>
                      <button
                        type="button"
                        disabled={callbackBusyId === lead.id}
                        onClick={(e) => { e.stopPropagation(); handleCallbackTransition(lead, 'cancelled'); }}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(lead.instructionRequestStatus === 'requested' || lead.instructionRequestStatus === 'contacted') && (
                  <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-900">
                    <div className="font-medium text-indigo-900">
                      Instruction requested
                      {lead.instructionRequestFirmName ? ` — ${lead.instructionRequestFirmName}` : ''}
                    </div>
                    {lead.instructionRequestedAt && (
                      <div className="mt-0.5 text-indigo-700">
                        {formatDateTime(lead.instructionRequestedAt)}
                        {lead.instructionRequestStatus === 'contacted' && lead.instructionRequestContactedAt
                          ? ` · contacted ${formatDateTime(lead.instructionRequestContactedAt)}`
                          : ''}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {lead.instructionRequestStatus === 'requested' && (
                        <button
                          type="button"
                          disabled={instructionRequestBusyId === lead.id}
                          onClick={(e) => { e.stopPropagation(); handleInstructionRequestTransition(lead, 'contacted'); }}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-800 border border-indigo-300 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          Mark contacted
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={instructionRequestBusyId === lead.id}
                        onClick={(e) => { e.stopPropagation(); handleInstructionRequestTransition(lead, 'completed'); }}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-emerald-800 border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Mark completed
                      </button>
                      <button
                        type="button"
                        disabled={instructionRequestBusyId === lead.id}
                        onClick={(e) => { e.stopPropagation(); handleInstructionRequestTransition(lead, 'cancelled'); }}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {lead.isFunnelArchived && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                    <div className="font-medium text-slate-900">
                      {lead.funnelArchivedAuto ? 'Auto archived' : 'Archived'}
                      {lead.funnelArchivedAt ? ` ${formatDateTime(lead.funnelArchivedAt)}` : ''}
                    </div>
                    <div className="mt-1 break-words">
                      {lead.funnelArchivedReason || 'No reason recorded'}
                    </div>
                  </div>
                )}

                {canViewCardAttribution && hasAdCue && (
                  <div className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                    <div className="flex min-w-0 items-center gap-2">
                      {lead.utmSource && (
                        <span className="shrink-0 rounded bg-white px-2 py-0.5 shadow-sm" title={`UTM Source: ${lead.utmSource}`}>
                          Ad: {lead.utmSource}
                        </span>
                      )}
                      {isManager && lead.gadCampaignId && (
                        <span className="min-w-0 break-words rounded bg-white px-2 py-0.5 shadow-sm" title={`Campaign ID: ${lead.gadCampaignId}`}>
                          ID {lead.gadCampaignId}
                        </span>
                      )}
                    </div>
                    {lead.utmTerm && (
                      <div className="mt-1.5 min-w-0 break-words rounded bg-white px-2 py-0.5 shadow-sm" title={`Keyword: ${lead.utmTerm}`}>
                        Keyword: {lead.utmTerm}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Owner</span>
                    <span
                      className={`min-w-0 break-words text-right font-semibold leading-5 ${lead.assignedTo ? 'text-gray-900' : 'text-red-700'}`}
                      title={assignmentLabel}
                    >
                      {assignmentLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>Attempts {lead.contactAttempts}/{lead.maxAttempts}</span>
                    {lead.contactAttempts >= lead.maxAttempts && <span className="text-red-600">Max reached</span>}
                  </div>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left transition-colors ${
                      primaryQuote
                        ? isSaleQuote
                          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                          : isPurchaseQuote
                          ? 'bg-green-50 border-green-200 hover:bg-green-100'
                          : 'bg-white border-gray-200 hover:bg-gray-100'
                        : 'bg-white border-dashed border-gray-200'
                    }`}
                    onClick={(e) => {
                      if (!primaryQuote) return;
                      e.stopPropagation();
                      handleViewLead(lead);
                      setTimeout(() => setLeadQuote(primaryQuote), 100);
                    }}
                    title={primaryQuote ? `${quoteTransaction} - £${formattedQuoteAmount}${isAcceptedQuote ? ' (Accepted)' : ''}` : 'No quotes'}
                  >
                    <span className={`min-w-0 break-words text-xs font-medium leading-5 ${
                      primaryQuote
                        ? isSaleQuote
                          ? 'text-blue-700'
                          : isPurchaseQuote
                          ? 'text-green-700'
                          : 'text-gray-700'
                        : 'text-gray-500'
                    }`}>
                      {primaryQuote ? quoteTransaction : 'No quotes'}
                      {quotesForLead.length > 1 && <span className="ml-1 text-gray-500">+{quotesForLead.length - 1} more</span>}
                    </span>
                    {primaryQuote && (
                      <span className={`whitespace-nowrap text-base font-bold ${
                        isSaleQuote ? 'text-blue-900' : isPurchaseQuote ? 'text-green-900' : 'text-gray-900'
                      }`}>
                        £{formattedQuoteAmount}
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                  <button
                    className="btn-primary flex h-10 min-w-[88px] flex-1 items-center justify-center gap-2 px-3 text-sm min-[460px]:flex-none"
                    title="View Details"
                    onClick={() => handleViewLead(lead)}
                  >
                    <Eye className="h-4 w-4" />
                    <span>View</span>
                  </button>

                  {canUseContactActions && (
                    <div className="flex items-center gap-1.5">
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                        title="Call"
                        onClick={() => handleContactLead(lead, 'call')}
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-green-100 text-green-500 hover:bg-green-50 hover:text-green-700"
                        title="Email"
                        onClick={() => handleContactLead(lead, 'email')}
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-100 text-purple-500 hover:bg-purple-50 hover:text-purple-700"
                        title="SMS"
                        onClick={() => handleContactLead(lead, 'sms')}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {!lead.assignedTo ? (
                    user?.role === 'Agent' ? (
                      <button
                        className={`btn-secondary flex min-h-[40px] items-center gap-1.5 px-3 py-2 text-xs ${
                          agentQuotaReached
                            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'text-navy-900'
                        }`}
                        title={agentQuotaReached ? 'Quota reached' : 'Claim Lead'}
                        onClick={() => {
                          if (agentQuotaReached) {
                            showQuotaReachedModal();
                            return;
                          }
                          handleClaimLead(lead);
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Claim</span>
                      </button>
                    ) : (
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-yellow-100 text-yellow-500 hover:bg-yellow-50 hover:text-yellow-700"
                        title="Assign"
                        onClick={() => handleAssignLead(lead)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )
                  ) : (
                    <>
                      {user?.role === 'Agent' && lead.assignedTo === user.id && (
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700"
                          title="Drop Lead"
                          onClick={() => handleDropLead(lead)}
                        >
                          <UserMinus className="h-4 w-4" />
                          <span className="sr-only">Drop</span>
                        </button>
                      )}
                      {(user?.role === 'Admin' || user?.role === 'Manager') && (
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-yellow-100 text-yellow-500 hover:bg-yellow-50 hover:text-yellow-700"
                          title="Reassign"
                          onClick={() => handleAssignLead(lead)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalLeadsCount > 0 && totalPages > 1 && (
          <div className="card mt-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * leadsPerPage + 1} to {Math.min(currentPage * leadsPerPage, totalLeadsCount)} of {totalLeadsCount} leads
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-1">
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
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === pageNum
                            ? 'bg-navy-950 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      ))}

      {/* Mark as Instructed Modal */}
      {showInstructionModal && instructionLead && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2 text-emerald-600" />
                    Mark as Instructed
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Confirm instruction tracking for <span className="font-medium text-gray-900">{instructionLead.name}</span>.
                  </p>
                </div>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setShowInstructionModal(false)}
                  disabled={isSavingInstructionMark}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Current assigned user</span>
                    <span className="font-medium text-gray-900 text-right">
                      {instructionLead.assignedToName || getAgentName(instructionLead.assignedTo) || 'Unassigned'}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-gray-500">Marked by</span>
                    <span className="font-medium text-gray-900 text-right">{user?.name || 'Current user'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credited user
                  </label>
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                    {getLockedInstructionCredit(instructionLead).name}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Credit is locked to the assigned user at confirmation time. If unassigned, it is credited to the user marking the instruction.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instruction Date
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      className="input-field pl-10"
                      value={instructionEffectiveDate}
                      max={getLocalDateInputValue()}
                      min={user?.role === 'Agent' ? getAgentInstructionMinDate() : undefined}
                      onChange={(e) => setInstructionEffectiveDate(e.target.value)}
                      disabled={isSavingInstructionMark}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose the date this lead actually instructed. This controls which day it appears in instruction reports.
                  </p>
                  {getInstructionDateError(instructionEffectiveDate) && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {getInstructionDateError(instructionEffectiveDate)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    className="input-field min-h-[96px]"
                    value={instructionNote}
                    onChange={(e) => setInstructionNote(e.target.value)}
                    placeholder="Add any context for the instruction audit trail..."
                    disabled={isSavingInstructionMark}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowInstructionModal(false)}
                  disabled={isSavingInstructionMark}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleConfirmMarkInstructed}
                  disabled={!getLockedInstructionCredit(instructionLead).id || Boolean(getInstructionDateError(instructionEffectiveDate)) || isSavingInstructionMark}
                >
                  {isSavingInstructionMark ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Confirm Instructed</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {/* Assign Lead Modal */}
      <AssignLeadModal
        isOpen={showAssignModal}
        lead={selectedLead ? { id: selectedLead.id, name: selectedLead.name } : null}
        onClose={() => {
          setShowAssignModal(false);
          // Don't clear selectedLead - reload it instead to show updated assignment
        }}
        onSuccess={async (leadName, agentName) => {
          // Show success message for manager/admin
          if (user?.role === 'Manager' || user?.role === 'Admin') {
            setTaskToast({
              type: 'success',
              message: `Lead "${leadName}" has been successfully assigned to ${agentName}.`
            });
          }

          await loadLeads();

          // Reload the selected lead to show updated assignment information
          await refreshSelectedLead(selectedLead?.id);
          // Stats will be recalculated automatically from the updated leads state
        }}
        refreshData={async () => {
          await loadLeads();
        }}
      />

      {/* Quota Reached Modal */}
      {showQuotaWarning && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Quota Reached</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        You cannot claim another lead until capacity is available.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      onClick={() => setShowQuotaWarning(false)}
                      aria-label="Close quota warning"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {quotaWarningMessage || getQuotaReachedMessage()}
                  </div>

                  {quotaStatus && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Today</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {quotaStatus.assignedToday}/{quotaStatus.quota ?? 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.max(0, (quotaStatus.quota ?? 0) - quotaStatus.assignedToday)} remaining
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">This Week</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {quotaStatus.assignedThisWeek ?? 0}/{quotaStatus.weeklyQuota ?? 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          Resets Monday UK time
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-sm text-gray-600">
                    Ask a Manager or Admin to reset usage, add allowance, or increase your quota.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowQuotaWarning(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Lead Confirmation Modal */}
      {showDropModal && leadToDrop && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Drop Lead</h3>
                  <p className="text-sm text-gray-600 mt-1">Are you sure you want to drop this lead?</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Performance Impact Warning
                    </p>
                    <p className="text-sm text-yellow-700">
                      Dropping leads can affect your performance metrics. This action will return the lead to unassigned status, but the lead's current status and progress will be preserved.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Lead Details:</p>
                <p className="text-sm text-gray-600">
                  <strong>Name:</strong> {leadToDrop.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Current Status:</strong> {leadToDrop.status}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Current Stage:</strong> {leadToDrop.stage}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Note: The lead will be returned to unassigned with these status and stage values preserved.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowDropModal(false);
                    setLeadToDrop(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleConfirmDropLead}
                >
                  Yes, Drop Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Details Modal */}
      {showEditDetailsModal && selectedLead && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Edit className="h-5 w-5 mr-2" />
                  Edit Client Details
                </h3>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setShowEditDetailsModal(false)}
                  disabled={isSavingDetails}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDetailsForm.name}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, name: e.target.value })}
                    disabled={isSavingDetails}
                    placeholder="Client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDetailsForm.email}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, email: e.target.value })}
                    disabled={isSavingDetails}
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDetailsForm.phone}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, phone: e.target.value })}
                    disabled={isSavingDetails}
                    placeholder="+44 123 456 7890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDetailsForm.source}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, source: e.target.value })}
                    disabled={isSavingDetails}
                  >
                    <option value="Direct">Direct</option>
                    <option value="Hoowla">Hoowla</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDetailsForm.priority}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, priority: e.target.value as 'Low' | 'Medium' | 'High' })}
                    disabled={isSavingDetails}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  className="btn-secondary"
                  onClick={() => setShowEditDetailsModal(false)}
                  disabled={isSavingDetails}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex items-center space-x-2"
                  onClick={handleSaveEditDetails}
                  disabled={isSavingDetails || !editDetailsForm.name.trim()}
                >
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Lead Detail Modal */}
      {showLeadDetail && selectedLead && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeLeadDetail}
        >
          <div
            ref={modalScrollContainerRef}
            className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={closeLeadDetail}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{selectedLead.shortCode || selectedLead.id}</p>
                  <h2 className="text-xl font-semibold text-gray-900 leading-tight">{selectedLead.name}</h2>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {selectedLead.quoteAmount ? `£${selectedLead.quoteAmount.toLocaleString()}` : 'No quote'} · {selectedLead.status}
                  </p>
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={closeLeadDetail}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* View Only Mode Banner */}
            {user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id && (
              <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900 mb-1">View Only Mode</p>
                    <p className="text-sm text-yellow-800">
                      This lead is assigned to another agent. You can view details but cannot edit, send emails/SMS, or modify any information. Claim this lead to take ownership.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedLead.isFunnelArchived && (
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Archive className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">Archived from active funnels</p>
                      <p className="text-sm text-slate-700">
                        This lead is hidden from active dashboards, agent funnels, and quota usage.
                        {selectedLead.funnelArchivedAt ? ` Archived ${formatDateTime(selectedLead.funnelArchivedAt)}.` : ''}
                        {selectedLead.funnelArchivedReason ? ` Reason: ${selectedLead.funnelArchivedReason}` : ''}
                      </p>
                    </div>
                  </div>
                  {canManageArchive && (
                    <button
                      type="button"
                      className="btn-primary flex items-center gap-2 text-sm"
                      onClick={handleRestoreSelectedLead}
                      disabled={isArchivingLeads}
                    >
                      {isArchivingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      <span>{isArchivingLeads ? 'Restoring...' : 'Restore to Active'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="p-6 space-y-6">
                {/* Manual Instruction Tracking */}
                <div className={`card ${selectedLead.isManuallyInstructed ? 'border-emerald-100 bg-emerald-50/40' : ''}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <CheckCircle className={`h-5 w-5 mr-2 ${selectedLead.isManuallyInstructed ? 'text-emerald-600' : 'text-gray-400'}`} />
                          Instruction Tracking
                        </h3>
                        {selectedLead.isManuallyInstructed ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                            Instructed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            Not instructed
                          </span>
                        )}
                      </div>
                      {selectedLead.isManuallyInstructed ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                          <div>
                            <span className="text-gray-500">Instruction date:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {selectedLead.manualInstructedAt ? formatDateOnly(selectedLead.manualInstructedAt) : 'Date not captured'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Credited:</span>{' '}
                            <span className="font-medium text-gray-900">{getInstructionAgentName(selectedLead)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Marked by:</span>{' '}
                            <span className="font-medium text-gray-900">{selectedLead.manualInstructedByName || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Marked at:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {latestInstructionMarkedAt ? formatDateTime(latestInstructionMarkedAt) : 'Not available'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Assigned snapshot:</span>{' '}
                            <span className="font-medium text-gray-900">{selectedLead.assignedToNameAtInstruction || 'Unassigned'}</span>
                          </div>
                          {selectedLead.instructionMarkNotes && (
                            <div className="md:col-span-2">
                              <span className="text-gray-500">Note:</span>{' '}
                              <span className="font-medium text-gray-900">{selectedLead.instructionMarkNotes}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-600">
                          Instruction tracking currently uses the manual instruction marker as the source of truth.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {!selectedLead.isManuallyInstructed && canManageInstruction(selectedLead) && (
                        <button
                          type="button"
                          className="btn-primary flex items-center gap-2 text-sm"
                          onClick={() => openInstructionModal(selectedLead)}
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Mark as Instructed</span>
                        </button>
                      )}
                      {selectedLead.isManuallyInstructed && canReverseInstruction && (
                        <button
                          type="button"
                          className="btn-secondary flex items-center gap-2 text-sm text-orange-700 hover:bg-orange-50"
                          onClick={() => handleReverseInstruction(selectedLead)}
                          disabled={isSavingInstructionMark}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Client Details */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Client Details
                    </h3>
                    {user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id ? (
                      <span className="text-sm text-gray-500 flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>View Only</span>
                      </span>
                    ) : (
                      <button
                        className="btn-secondary text-sm flex items-center space-x-1"
                        onClick={() => {
                          setEditDetailsForm({
                            name: selectedLead.name || '',
                            email: selectedLead.email || '',
                            phone: selectedLead.phone || '',
                            source: selectedLead.source || 'Direct',
                            priority: selectedLead.priority || 'Medium'
                          });
                          setShowEditDetailsModal(true);
                        }}
                        title="Edit client details"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedLead.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Phone:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedLead.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedLead.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Source:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedLead.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedLead.priority)}`}>
                        {selectedLead.priority}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Assigned:</span>
                      <span className="text-sm font-medium text-gray-900">
                      {selectedLead.assignedTo ? (
                        getAgentName(selectedLead.assignedTo) || selectedLead.assignedTo
                      ) : (
                        <span className="text-red-600">Unassigned</span>
                      )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quote Information */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Quote Information
                  </h3>
                  {isLoadingQuote ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-600">Loading quote...</span>
                    </div>
                  ) : !leadQuote ? (
                    <div className="text-center py-6">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 mb-4">No quote has been created for this lead yet</p>
                      <button
                        className="btn-primary text-sm flex items-center space-x-1 mx-auto"
                        onClick={() => {
                          navigate(`/quotes?action=create&leadId=${selectedLead.id}`);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        <span>Create Quote</span>
                      </button>
                    </div>
                  ) : (
                  <div className="space-y-3">
                    {/* All Quotes Section - Horizontal Scrollable */}
                    {leadQuotes.length > 1 && (
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">All Quotes ({leadQuotes.length}):</span>
                          <span className="text-xs text-gray-500">Scroll to view all</span>
                        </div>
                        <div className="overflow-x-auto -mx-2 px-2">
                          <div className="flex gap-3 min-w-max pb-2">
                            {leadQuotes.map((quote, idx) => {
                              const amount = quote.totalIncVat || quote.totalAmount || 0;
                              const formattedAmount = typeof amount === 'number'
                                ? amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : String(amount);
                              const isSelected = leadQuote?.id === quote.id;
                              const transactionType = quote.quoteType || quote.transactionType || '';
                              const isAccepted = quote.status === 'Accepted' || quote.acceptedAt !== null;

                              return (
                                <div
                                  key={quote.id}
                                  className={`flex-shrink-0 border-2 rounded-lg p-3 min-w-[180px] cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                  onClick={() => setLeadQuote(quote)}
                                  title={`${transactionType ? transactionType + ' - ' : ''}£${formattedAmount}${isAccepted ? ' (Accepted)' : ''} - Click to view details`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-600">
                                      {transactionType || `Quote ${idx + 1}`}
                                    </span>
                                    {isSelected && (
                                      <span className="text-xs text-blue-600 font-semibold">Active</span>
                                    )}
                                  </div>
                                  <div className="text-lg font-bold text-gray-900 mb-1">
                                    £{formattedAmount}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    {isAccepted ? (
                                      <span className="text-xs text-green-600 font-medium">Accepted</span>
                                    ) : (
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        quote.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                                        quote.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        quote.status === 'Expired' ? 'bg-gray-100 text-gray-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {quote.status || 'Draft'}
                                      </span>
                                    )}
                                    {quote.version && quote.version > 1 && (
                                      <span className="text-xs text-gray-500">v{quote.version}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(quote.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Current Quote Details */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {leadQuotes.length > 1 ? 'Selected Quote Details:' : 'Quote Details:'}
                      </span>
                      {leadQuotes.length > 1 && (
                        <span className="text-xs text-gray-500">
                          {leadQuotes.findIndex(q => q.id === leadQuote?.id) + 1} of {leadQuotes.length}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Quote ID:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {leadQuote.shortCode || leadQuote.id}
                      </span>
                    </div>
                    {leadQuote.hoowlaQuoteId && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Hoowla Quote ID:</span>
                        <span className="text-sm font-medium text-gray-900">{leadQuote.hoowlaQuoteId}</span>
                      </div>
                    )}
                    {leadQuote.totalIncVat !== undefined ? (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Amount (incl. VAT):</span>
                        <span className="text-sm font-semibold text-[#011E41]">
                          £{leadQuote.totalIncVat.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Amount:</span>
                      <span className="text-sm font-medium text-gray-900">
                          £{leadQuote.totalAmount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    )}
                    {leadQuote.totalExVat !== undefined && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total (excl. VAT):</span>
                      <span className="text-sm font-medium text-gray-900">
                          £{leadQuote.totalExVat.toFixed(2)}
                      </span>
                    </div>
                    )}
                    {leadQuote.netAmount !== undefined && leadQuote.totalExVat === undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Net Amount (excl. VAT):</span>
                        <span className="text-sm font-medium text-gray-900">
                          £{leadQuote.netAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {leadQuote.vatAmount !== undefined && leadQuote.vatAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">VAT:</span>
                        <span className="text-sm font-medium text-gray-900">
                          £{leadQuote.vatAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          leadQuote.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                          leadQuote.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                          leadQuote.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          leadQuote.status === 'Expired' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {leadQuote.status}
                      </span>
                    </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Version:</span>
                        <span className="text-sm font-medium text-gray-900">{leadQuote.version || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {leadQuote.createdAt ? new Date(leadQuote.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </span>
                      </div>
                      {leadQuote.validUntil && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Valid Until:</span>
                          <span className={`text-sm font-medium ${
                            new Date(leadQuote.validUntil) < new Date() ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {new Date(leadQuote.validUntil).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                            {new Date(leadQuote.validUntil) < new Date() && ' (Expired)'}
                          </span>
                        </div>
                      )}
                      {leadQuote.sentAt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Sent:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(leadQuote.sentAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {leadQuote.acceptedAt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Accepted:</span>
                          <span className="text-sm font-medium text-green-600">
                            {new Date(leadQuote.acceptedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {leadQuote.rejectedAt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Rejected:</span>
                          <span className="text-sm font-medium text-red-600">
                            {new Date(leadQuote.rejectedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {leadQuote.notes && (
                        <div className="pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600 block mb-1">Notes:</span>
                          <p className="text-sm text-gray-900">{leadQuote.notes}</p>
                        </div>
                      )}
                      {/* Legal Fees */}
                      {(leadQuote.legalFeeExVat !== undefined || leadQuote.legalFeeIncVat !== undefined) && (
                        <div className="pt-2 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Legal Fees</h4>
                          {leadQuote.legalFeeExVat !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Legal Fee (excl. VAT):</span>
                              <span className="font-medium text-gray-900">£{leadQuote.legalFeeExVat.toFixed(2)}</span>
                            </div>
                          )}
                          {leadQuote.legalFeeIncVat !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Legal Fee (incl. VAT):</span>
                              <span className="font-medium text-gray-900">£{leadQuote.legalFeeIncVat.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Totals */}
                      {(leadQuote.totalExVat !== undefined || leadQuote.totalIncVat !== undefined) && (
                        <div className="pt-2 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Totals</h4>
                          {leadQuote.totalExVat !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total (excl. VAT):</span>
                              <span className="font-medium text-gray-900">£{leadQuote.totalExVat.toFixed(2)}</span>
                            </div>
                          )}
                          {leadQuote.totalIncVat !== undefined && (
                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-gray-900">Total (incl. VAT):</span>
                              <span className="text-[#011E41]">£{leadQuote.totalIncVat.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Supplements */}
                      {leadQuote.supplements && leadQuote.supplements.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Supplements ({leadQuote.supplements.length})</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {leadQuote.supplements.map((supplement: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-gray-700 bg-blue-50 p-2 rounded border border-blue-100">
                                <span className="font-medium">{supplement.name || `Supplement ${idx + 1}`}</span>
                                <span className="font-semibold text-gray-900">
                                  £{typeof supplement.fee === 'string' ? parseFloat(supplement.fee).toFixed(2) : supplement.fee?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            ))}
                            <div className="text-xs text-gray-500 mt-1 italic">VAT at 20%: Auto</div>
                          </div>
                        </div>
                      )}

                      {/* Disbursements */}
                      {leadQuote.disbursements && leadQuote.disbursements.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Disbursements ({leadQuote.disbursements.length})</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {leadQuote.disbursements.map((disbursement: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-gray-700 bg-green-50 p-2 rounded border border-green-100">
                                <span className="font-medium">{disbursement.name || `Disbursement ${idx + 1}`}</span>
                                <span className="font-semibold text-gray-900">
                                  £{typeof disbursement.fee === 'string' ? parseFloat(disbursement.fee).toFixed(2) : disbursement.fee?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            ))}
                            <div className="text-xs text-gray-500 mt-1 italic">Land Registry Fees: Auto</div>
                          </div>
                        </div>
                      )}

                      {/* Quote Items (fallback for old format) */}
                      {leadQuote.items && leadQuote.items.length > 0 && (!leadQuote.supplements || leadQuote.supplements.length === 0) && (!leadQuote.disbursements || leadQuote.disbursements.length === 0) && (
                        <div className="pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600 block mb-2">Items ({leadQuote.items.length}):</span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {leadQuote.items.map((item: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                                <div className="font-medium">{item.description || item.name || 'Item'}</div>
                                {item.quantity && item.unitPrice && (
                                  <div className="text-gray-500">
                                    {item.quantity} × £{item.unitPrice.toLocaleString()} = £{((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Property Information */}
                      {(leadQuote.propertyAddress || leadQuote.propertyValue || leadQuote.propertyRegion || leadQuote.quoteType || leadQuote.transactionType || selectedLead.transactionType) && (
                        <div className="pt-2 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Property Information</h4>
                          {(leadQuote.quoteType || leadQuote.transactionType || selectedLead.transactionType) && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Transaction Type:</span>
                              <span className="font-medium text-gray-900 text-right">
                                {leadQuote.quoteType || leadQuote.transactionType || selectedLead.transactionType}
                              </span>
                            </div>
                          )}
                          {leadQuote.propertyAddress && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Address:</span>
                              <span className="font-medium text-gray-900 text-right">{leadQuote.propertyAddress}</span>
                            </div>
                          )}
                          {leadQuote.propertyCity && leadQuote.propertyPostcode && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Location:</span>
                              <span className="font-medium text-gray-900 text-right">
                                {leadQuote.propertyCity}{leadQuote.propertyPostcode ? `, ${leadQuote.propertyPostcode}` : ''}
                              </span>
                            </div>
                          )}
                          {leadQuote.propertyValue && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Property Value:</span>
                              <span className="font-medium text-gray-900">£{leadQuote.propertyValue.toLocaleString()}</span>
                            </div>
                          )}
                          {leadQuote.propertyTenure && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Tenure:</span>
                              <span className="font-medium text-gray-900">{leadQuote.propertyTenure}</span>
                            </div>
                          )}
                          {leadQuote.propertyRegion && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Region:</span>
                              <span className="font-medium text-gray-900 capitalize">{leadQuote.propertyRegion}</span>
                            </div>
                          )}
                          {leadQuote.peopleCount && leadQuote.peopleCount > 1 && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">People in Quote:</span>
                              <span className="font-medium text-gray-900">{leadQuote.peopleCount}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                        {!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) && (
                          <button
                            className="btn-secondary text-sm flex items-center space-x-1"
                            onClick={() => navigate(`/quotes?quoteShort=${leadQuote.shortCode || leadQuote.id}&leadId=${selectedLead.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                            <span>View/Edit Quote</span>
                          </button>
                        )}
                        {leadQuote.status !== 'Accepted' && !(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) && (
                          <button
                            className={`btn-secondary text-sm flex items-center space-x-1 ${isSendingQuoteEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                            onClick={handleQuickSendQuoteEmail}
                            disabled={isSendingQuoteEmail || !isOutlookReady}
                            title={!isOutlookReady ? 'Connect Outlook in Settings to send emails' : 'Resend quote email to client'}
                          >
                            {isSendingQuoteEmail ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                <span>Resend Quote Email</span>
                              </>
                            )}
                          </button>
                        )}
                        {leadQuote.status === 'Accepted' && (
                          <button
                            className="btn-primary text-sm flex items-center space-x-1"
                            onClick={handleGenerateInvoice}
                            disabled={!selectedLead || !leadQuote}
                          >
                            <CreditCard className="h-4 w-4" />
                            <span>Generate Invoice</span>
                          </button>
                        )}
                        {/* Payment Link Button */}
                        {selectedLead && !(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) && (
                          <button
                            className={`btn-secondary text-sm flex items-center space-x-1 ${isCopyingPaymentLink ? 'opacity-70 cursor-not-allowed' : ''}`}
                            onClick={handleGetPaymentLink}
                            title="Copy payment link to clipboard"
                            disabled={isCopyingPaymentLink}
                          >
                            <LinkIcon className={`h-4 w-4 ${isCopyingPaymentLink ? 'animate-spin' : ''}`} />
                            <span>{isCopyingPaymentLink ? 'Copying...' : 'Copy Payment Link'}</span>
                          </button>
                        )}
                    </div>
                  </div>
                  )}

              {/* Show Instruct Solicitor button when lead is in "Ready to Solicit" stage (after client info submitted) - Outside quote section so it shows even without quote */}
              {selectedLead && selectedLead.stage === 'Ready to Solicit' && (
                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Solicitor Instruction</h3>
                      {selectedLead.instructionPdfUrl ? (
                        <p className="text-sm text-gray-600 mt-1">The client has completed their instruction form. Ready to instruct a solicitor.</p>
                      ) : selectedLead.instructionFormStatus === 'submitted' && (selectedLead.clientAddress || selectedLead.clientDob || selectedLead.clientNi || selectedLead.propertyAddress || selectedLead.propertyValue || selectedLead.transactionType) ? (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-1">Instruction Form Data Available</p>
                          <p className="text-sm text-blue-700">
                            The instruction form has been submitted. You can instruct the solicitor using the submitted form data. The PDF is still being generated.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm font-medium text-yellow-800 mb-1">Instruction PDF Not Available</p>
                          <p className="text-sm text-yellow-700">
                            Please send the instruction form to the client or fill it with their instructions before instructing the solicitor. The instruction PDF must be available before proceeding.
                          </p>
                        </div>
                      )}
                    </div>
                              <button
                      className="btn-primary text-sm flex items-center space-x-1 ml-4"
                      onClick={() => {
                        // Allow instructing if PDF is available OR if form data is submitted
                        const hasFormData = selectedLead.instructionFormStatus === 'submitted' && (selectedLead.clientAddress || selectedLead.clientDob || selectedLead.clientNi || selectedLead.propertyAddress || selectedLead.propertyValue || selectedLead.transactionType);
                        if (!selectedLead.instructionPdfUrl && !hasFormData) {
                          // Show custom modal if neither PDF nor form data is available
                          setShowInstructionPdfWarningModal(true);
                          return;
                        }
                        setShowSolicitorInstructionModal(true);
                      }}
                      disabled={!selectedLead.instructionPdfUrl && !(selectedLead.instructionFormStatus === 'submitted' && (selectedLead.clientAddress || selectedLead.clientDob || selectedLead.clientNi || selectedLead.propertyAddress || selectedLead.propertyValue || selectedLead.transactionType))}
                      title={!selectedLead.instructionPdfUrl && !(selectedLead.instructionFormStatus === 'submitted' && (selectedLead.clientAddress || selectedLead.clientDob || selectedLead.clientNi || selectedLead.propertyAddress || selectedLead.propertyValue || selectedLead.transactionType)) ? 'Instruction form data or PDF must be available before instructing solicitor' : 'Instruct Solicitor'}
                    >
                      <Building2 className="h-4 w-4" />
                      <span>Instruct Solicitor</span>
                              </button>
                    </div>
                  </div>
                  )}
              </div>

              {/* Instruction PDF Section */}
              {selectedLead && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Instruction PDF
                  </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        className={`btn-secondary text-sm flex items-center space-x-1 ${isCopyingInstructionLink ? 'opacity-70 cursor-not-allowed' : ''}`}
                        onClick={handleGetInstructionLink}
                        title="Copy instruction form link to clipboard"
                        disabled={isCopyingInstructionLink}
                      >
                        <LinkIcon className={`h-4 w-4 ${isCopyingInstructionLink ? 'animate-spin' : ''}`} />
                        <span>{isCopyingInstructionLink ? 'Copying...' : 'Copy Instruction Form Link'}</span>
                      </button>
                      {(selectedLead as any)?.instruction_pdf_url || (selectedLead as any)?.instructionPdfUrl ? (
                        <button
                          className="btn-primary text-sm flex items-center space-x-1"
                          onClick={handleDownloadInstructionPdf}
                          title="Download instruction PDF"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Download Instruction PDF</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {selectedLead.instructionFormStatus === 'submitted' && selectedLead.instructionPdfUrl ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-800">Instruction Form Submitted</span>
                        </div>
                        {selectedLead.instructionFormSubmittedAt && (
                          <p className="text-sm text-green-700">
                            Submitted on:{' '}
                            {new Date(selectedLead.instructionFormSubmittedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handleDownloadInstructionPdf}
                          className="btn-primary flex items-center space-x-2"
                          title="Download instruction PDF"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Instruction PDF</span>
                        </button>
                        {(user?.role === 'Admin' || user?.role === 'Manager') && (
                          <button
                            onClick={() => setShowResetInstructionModal(true)}
                            className="btn-secondary flex items-center space-x-2 text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                            title="Reset instruction form to allow refilling"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Reset Instruction Form</span>
                          </button>
                        )}
                        {selectedLead.instructionPdfGeneratedAt && (
                          <span className="text-sm text-gray-500">
                            Generated:{' '}
                            {new Date(selectedLead.instructionPdfGeneratedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : ((selectedLead as any)?.instruction_pdf_url || (selectedLead as any)?.instructionPdfUrl) ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-800">Instruction Form Submitted</span>
                        </div>
                        {selectedLead.instructionFormSubmittedAt && (
                          <p className="text-sm text-green-700">
                            Submitted on{' '}
                            {new Date(selectedLead.instructionFormSubmittedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handleDownloadInstructionPdf}
                          className="btn-primary flex items-center space-x-2"
                          title="Download instruction PDF"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Instruction PDF</span>
                        </button>
                        {(user?.role === 'Admin' || user?.role === 'Manager') && (
                          <button
                            onClick={() => setShowResetInstructionModal(true)}
                            className="btn-secondary flex items-center space-x-2 text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                            title="Reset instruction form to allow refilling"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Reset Instruction Form</span>
                          </button>
                        )}
                        {selectedLead.instructionPdfGeneratedAt && (
                          <span className="text-sm text-gray-500">
                            Generated{' '}
                            {new Date(selectedLead.instructionPdfGeneratedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : selectedLead.instructionFormStatus === 'submitted' ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                          <span className="font-semibold text-yellow-800">PDF Generation Pending</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          The instruction form has been submitted, but the PDF is still being generated. Please check back shortly.
                        </p>
                      </div>

                      {/* Show Submitted Instruction Form Data */}
                      {(selectedLead.instructionFormStatus === 'submitted' && (selectedLead.clientAddress || selectedLead.clientDob || selectedLead.clientNi || selectedLead.propertyAddress || selectedLead.propertyValue || selectedLead.transactionType || selectedLead.propertyTenure || selectedLead.isMortgaged !== undefined)) && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-900 mb-3">Submitted Instruction Form Data</h4>
                          <div className="space-y-2 text-sm">
                            {selectedLead.name && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Name:</span>
                                <span className="text-blue-900 text-right">{selectedLead.name}</span>
                              </div>
                            )}
                            {selectedLead.email && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Email:</span>
                                <span className="text-blue-900 text-right">{selectedLead.email}</span>
                              </div>
                            )}
                            {selectedLead.phone && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Phone:</span>
                                <span className="text-blue-900 text-right">{selectedLead.phone}</span>
                              </div>
                            )}
                            {selectedLead.clientAddress && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Correspondence Address:</span>
                                <span className="text-blue-900 text-right">{selectedLead.clientAddress}</span>
                              </div>
                            )}
                            {selectedLead.clientDob && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Date of Birth:</span>
                                <span className="text-blue-900">{selectedLead.clientDob}</span>
                              </div>
                            )}
                            {selectedLead.clientNi && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">National Insurance:</span>
                                <span className="text-blue-900">{selectedLead.clientNi}</span>
                              </div>
                            )}
                            {selectedLead.propertyAddress && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Property Address:</span>
                                <span className="text-blue-900 text-right">{selectedLead.propertyAddress}</span>
                              </div>
                            )}
                            {selectedLead.propertyValue && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Property Value:</span>
                                <span className="text-blue-900">£{selectedLead.propertyValue.toLocaleString()}</span>
                              </div>
                            )}
                            {selectedLead.transactionType && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Transaction Type:</span>
                                <span className="text-blue-900">{selectedLead.transactionType}</span>
                              </div>
                            )}
                            {selectedLead.propertyTenure && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Tenure:</span>
                                <span className="text-blue-900">{selectedLead.propertyTenure}</span>
                              </div>
                            )}
                            {selectedLead.isMortgaged !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Mortgaged:</span>
                                <span className="text-blue-900">{selectedLead.isMortgaged ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.isUnregistered !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Unregistered:</span>
                                <span className="text-blue-900">{selectedLead.isUnregistered ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.isFirstTimeBuyer !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">First Time Buyer:</span>
                                <span className="text-blue-900">{selectedLead.isFirstTimeBuyer ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.isNewBuild !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">New Build:</span>
                                <span className="text-blue-900">{selectedLead.isNewBuild ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.isSharedOwnership !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Shared Ownership:</span>
                                <span className="text-blue-900">{selectedLead.isSharedOwnership ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.isBuyToLet !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Buy to Let:</span>
                                <span className="text-blue-900">{selectedLead.isBuyToLet ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {selectedLead.propertyTitleNumber && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Title Number:</span>
                                <span className="text-blue-900">{selectedLead.propertyTitleNumber}</span>
                              </div>
                            )}
                            {selectedLead.propertyRegion && (
                              <div className="flex justify-between">
                                <span className="text-blue-700 font-medium">Region:</span>
                                <span className="text-blue-900 capitalize">{selectedLead.propertyRegion}</span>
                              </div>
                            )}
                            {selectedLead.notes && selectedLead.notes.includes('Instruction Form Submitted:') && (
                              <div className="flex flex-col pt-2 border-t border-blue-300">
                                <span className="text-blue-700 font-medium mb-1">Additional Notes:</span>
                                <span className="text-blue-900 text-sm">{selectedLead.notes.split('Instruction Form Submitted:')[1]?.trim() || selectedLead.notes}</span>
                              </div>
                            )}
                          </div>
                          {(user?.role === 'Admin' || user?.role === 'Manager') && (
                            <div className="mt-3 pt-3 border-t border-blue-300">
                              <button
                                onClick={() => setShowResetInstructionModal(true)}
                                className="btn-secondary text-sm flex items-center space-x-1 text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                                title="Reset instruction form to allow refilling"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset Instruction Form</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : selectedLead.stage === 'Payment Completed - Awaiting Client Information' ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">Awaiting Instruction Form Submission</span>
                      </div>
                      <p className="text-sm text-blue-700 mb-3">
                        The client has completed payment and should submit the instruction form. Once submitted, the PDF will be available here.
                      </p>
                        <button
                          className="btn-secondary text-sm flex items-center space-x-1"
                          onClick={handleGetInstructionLink}
                        title="Copy instruction form link to clipboard"
                        >
                          <LinkIcon className="h-4 w-4" />
                          <span>Copy Instruction Form Link</span>
                        </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span className="font-semibold text-gray-600">No Instruction Form Submitted</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        The instruction form has not been submitted yet. It will become available after payment is completed and the client submits the form.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Outcome Code Selection */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Outcome Code Selection
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    'Called - No Answer',
                    'Called - Voicemail',
                    'Called - Busy',
                    'Number Invalid',
                    'Interested - Call Back',
                    'Interested - Reviewing',
                    'Not Interested',
                    'Sold!',
                    'Wrong Number',
                    'Callback Scheduled',
                    'Ready to Solicit',
                    'Quote Accepted - Awaiting Payment',
                    'Payment Completed - Awaiting Client Information',
                    'Gone Elsewhere',
                    'Custom Reason',
                    'Incorrect Number',
                    'Fake Lead',
                    'Duplicate Lead',
                    'Test Lead',
                    'Fake/Duplicate Quote',
                    'Just Getting prices',
                    'Recalled'
                  ].map((outcome) => (
                    <button
                      key={outcome}
                      className={`p-2 text-sm rounded-lg border transition-colors ${
                        selectedOutcomeCode === outcome
                          ? outcome === 'Ready to Solicit' ? 'bg-green-600 text-white border-green-600' :
                            outcome === 'Quote Accepted - Awaiting Payment' ? 'bg-yellow-600 text-white border-yellow-600' :
                            outcome === 'Payment Completed - Awaiting Client Information' ? 'bg-blue-600 text-white border-blue-600' :
                            outcome === 'Gone Elsewhere' ? 'bg-orange-600 text-white border-orange-600' :
                            outcome === 'Custom Reason' ? 'bg-purple-600 text-white border-purple-600' :
                            outcome === 'Incorrect Number' ? 'bg-red-600 text-white border-red-600' :
                            outcome === 'Fake Lead' ? 'bg-red-700 text-white border-red-700' :
                            outcome === 'Duplicate Lead' ? 'bg-red-700 text-white border-red-700' :
                            outcome === 'Test Lead' ? 'bg-gray-600 text-white border-gray-600' :
                            outcome === 'Fake/Duplicate Quote' ? 'bg-red-700 text-white border-red-700' :
                            outcome === 'Just Getting prices' ? 'bg-blue-500 text-white border-blue-500' :
                            outcome === 'Recalled' ? 'bg-amber-600 text-white border-amber-600' :
                            'bg-navy-950 text-white border-navy-950'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      } ${(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                      onClick={async () => {
                        // Prevent action in view-only mode
                        if (user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) {
                          return;
                        }
                        // Validate outcome codes that require payment completion
                        // Show override modal if payment not completed
                        if ((outcome === 'Ready to Solicit' || outcome === 'Payment Completed - Awaiting Client Information') && selectedLead) {
                          // Check if lead has an accepted quote
                          const hasAcceptedQuote = leadQuote?.status === 'Accepted';

                          // Check if payment has been completed
                          // Payment is completed if:
                          // 1. payment_link_status is 'paid' (includes manual override)
                          // 2. Quote status is "Accepted" (payment completed via Stripe)
                          // 3. Stage is "Payment Completed - Awaiting Client Information" or beyond
                          const hasCompletedPayment =
                            (selectedLead as any).paymentLinkStatus === 'paid' || // Includes manual override
                            hasAcceptedQuote ||
                            selectedLead.stage === 'Payment Completed - Awaiting Client Information' ||
                            selectedLead.stage === 'Ready to Solicit' ||
                            selectedLead.stage === 'Instructed';

                          if (!hasCompletedPayment) {
                            // Show payment explanation modal for manual override
                            setSelectedOutcomeCode(outcome); // Set outcome code first so modal knows which one
                            setPaymentExplanation('');
                            setShowPaymentExplanationModal(true);
                            return; // Don't proceed with normal flow, wait for explanation
                          }

                          // For "Ready to Solicit", also check instruction form
                          if (outcome === 'Ready to Solicit') {
                            // Instruction form validation - must be accurate and strict:
                            // 1. If already in 'Ready to Solicit' or 'Instructed' stage, allow
                            // 2. If instructionFormStatus is 'submitted', allow (form was submitted)
                            // 3. Otherwise, require BOTH instruction PDF AND instruction form data
                            // Error if EITHER is missing - prevents saving the outcome code

                            // Check PDF - check both camelCase and snake_case
                            const hasInstructionPdf = !!(
                              selectedLead.instructionPdfUrl ||
                              (selectedLead as any).instruction_pdf_url ||
                              (selectedLead as any).instructionPdfUrl
                            );

                            // Check form data - check both camelCase and snake_case
                            const hasInstructionFormData = !!(
                              selectedLead.clientAddress ||
                              (selectedLead as any).client_address ||
                              selectedLead.clientDob ||
                              (selectedLead as any).client_dob ||
                              selectedLead.clientNi ||
                              (selectedLead as any).client_ni ||
                              selectedLead.propertyAddress ||
                              (selectedLead as any).property_address ||
                              selectedLead.propertyValue ||
                              (selectedLead as any).property_value ||
                              selectedLead.transactionType ||
                              (selectedLead as any).transaction_type
                            );

                            // Check instruction form status - check both camelCase and snake_case
                            const instructionFormStatus = (selectedLead as any).instructionFormStatus ||
                                                          (selectedLead as any).instruction_form_status ||
                                                          '';
                            const isFormSubmitted = instructionFormStatus === 'submitted';

                            // Allow if already in Ready to Solicit or Instructed stage
                            const isAlreadyInCorrectStage = selectedLead.stage === 'Ready to Solicit' ||
                                                           selectedLead.stage === 'Instructed';

                            // Debug logging
                            console.log('Ready to Solicit validation:', {
                              stage: selectedLead.stage,
                              isAlreadyInCorrectStage,
                              isFormSubmitted,
                              hasInstructionPdf,
                              hasInstructionFormData,
                              instructionFormStatus
                            });

                            if (isAlreadyInCorrectStage) {
                              // Already in the correct stage, allow - continue processing
                              console.log('✅ Validation passed: Already in correct stage');
                            } else if (isFormSubmitted) {
                              // Form status is submitted, allow (form was submitted even if PDF is still generating) - continue processing
                              console.log('✅ Validation passed: Form status is submitted');
                            } else {
                              // Must have BOTH instruction form data AND PDF available
                              // Error if EITHER is missing - this prevents saving the outcome code
                              if (!hasInstructionPdf || !hasInstructionFormData) {
                                console.error('❌ Validation failed:', {
                                  hasInstructionPdf,
                                  hasInstructionFormData,
                                  missing: {
                                    pdf: !hasInstructionPdf,
                                    formData: !hasInstructionFormData
                                  }
                                });
                                setOutcomeResult({
                                  success: false,
                                  message: 'Cannot move to "Ready to Solicit" stage. The instruction form must be submitted first. Please ensure the instruction form is submitted before proceeding.'
                                });
                                setShowOutcomeResultModal(true);
                                return; // Stop processing - cannot save outcome code
                              }
                              console.log('✅ Validation passed: Both PDF and form data available');
                            }
                          }
                        }

                        // Validation for "Sold!" outcome code
                        if (outcome === 'Sold!') {
                          // Check payment
                          let hasAcceptedQuote = false;
                          if (selectedLead.quoteId) {
                            try {
                              const quoteResponse = await supabase
                                .from('quotes')
                                .select('status')
                                .eq('id', selectedLead.quoteId)
                                .single();

                              if (!quoteResponse.error && quoteResponse.data && quoteResponse.data.status === 'Accepted') {
                                hasAcceptedQuote = true;
                              }
                            } catch (error) {
                              console.warn('Could not check quote status:', error);
                            }
                          }

                          const hasCompletedPayment =
                            hasAcceptedQuote ||
                            selectedLead.stage === 'Payment Completed - Awaiting Client Information' ||
                            selectedLead.stage === 'Ready to Solicit' ||
                            selectedLead.stage === 'Instructed' ||
                            (selectedLead as any).instructionFormStatus === 'submitted' ||
                            (selectedLead as any).paymentLinkStatus === 'paid';

                          const hasSubmittedInstructionForm =
                            (selectedLead as any).instructionFormStatus === 'submitted' ||
                            selectedLead.stage === 'Ready to Solicit' ||
                            selectedLead.stage === 'Instructed';

                          // Build error message based on what's missing
                          if (!hasCompletedPayment && !hasSubmittedInstructionForm) {
                            setOutcomeResult({
                              success: false,
                              message: 'Cannot mark lead as "Sold". The client must complete payment (£230 deposit) and submit the instruction form first. Please ensure both payment and instruction form submission are completed before proceeding.'
                            });
                            setShowOutcomeResultModal(true);
                            return;
                          }

                          if (!hasCompletedPayment) {
                            const currentStage = selectedLead.stage || 'Unknown';
                            if (currentStage === 'Quote Accepted - Awaiting Payment' || currentStage.startsWith('Call-')) {
                              setOutcomeResult({
                                success: false,
                                message: `Cannot mark lead as "Sold". The client must complete payment (£230 deposit) first. Current stage: "${currentStage}". Please ensure payment is completed before proceeding.`
                              });
                            } else {
                              setOutcomeResult({
                                success: false,
                                message: `Cannot mark lead as "Sold". Payment (£230 deposit) has not been completed. Current stage: "${currentStage}". Please ensure payment is completed before proceeding.`
                              });
                            }
                            setShowOutcomeResultModal(true);
                            return;
                          }

                          if (!hasSubmittedInstructionForm) {
                            const currentStage = selectedLead.stage || 'Unknown';
                            if (currentStage === 'Payment Completed - Awaiting Client Information') {
                              setOutcomeResult({
                                success: false,
                                message: 'Cannot mark lead as "Sold". The instruction form must be submitted first. Current stage: "Payment Completed - Awaiting Client Information". Please send the instruction form to the client and wait for submission before proceeding.'
                              });
                            } else {
                              setOutcomeResult({
                                success: false,
                                message: `Cannot mark lead as "Sold". The instruction form has not been submitted yet. Current stage: "${currentStage}". Please ensure the instruction form is submitted before proceeding.`
                              });
                            }
                            setShowOutcomeResultModal(true);
                            return;
                          }

                          // Check if lead is at least in "Ready to Solicit" stage
                          if (selectedLead.stage !== 'Ready to Solicit' && selectedLead.stage !== 'Instructed') {
                            setOutcomeResult({
                              success: false,
                              message: `Cannot mark lead as "Sold". The lead must be in "Ready to Solicit" stage first. Current stage: "${selectedLead.stage}". Please select "Ready to Solicit" outcome code first, then instruct the solicitor before marking as "Sold".`
                            });
                            setShowOutcomeResultModal(true);
                            return;
                          }
                        }

                        // Set selectedOutcomeCode and proceed with normal flow
                        // (payment validation above will intercept if needed)
                        setSelectedOutcomeCode(outcome);
                        // "Ready to Solicit" will be processed normally via "Save Outcome" button
                        // The success modal will show an option to open solicitor instruction modal
                        if (outcome === 'Quote Accepted - Awaiting Payment') {
                          // Can be saved directly
                        } else if (outcome === 'Gone Elsewhere' || outcome === 'Custom Reason') {
                          setShowCustomReasonModal(true);
                        }
                      }}
                    >
                      {outcome}
                    </button>
                  ))}
                </div>
                {selectedOutcomeCode && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Selected:</strong> {selectedOutcomeCode} → Next: {getNextAction(selectedOutcomeCode)}
                    </p>
                    {!['Gone Elsewhere', 'Custom Reason'].includes(selectedOutcomeCode) && (
                      <button
                        onClick={async () => {
                          if (!selectedLead || !selectedOutcomeCode || isProcessingOutcome) return;
                          // Prevent action in view-only mode
                          if (user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) {
                            return;
                          }

                          // Additional validation for "Ready to Solicit" before processing
                          if (selectedOutcomeCode === 'Ready to Solicit') {
                            // Check both camelCase and snake_case
                            const hasInstructionPdf = !!(
                              selectedLead.instructionPdfUrl ||
                              (selectedLead as any).instruction_pdf_url
                            );

                            const hasInstructionFormData = !!(
                              selectedLead.clientAddress ||
                              (selectedLead as any).client_address ||
                              selectedLead.clientDob ||
                              (selectedLead as any).client_dob ||
                              selectedLead.clientNi ||
                              (selectedLead as any).client_ni ||
                              selectedLead.propertyAddress ||
                              (selectedLead as any).property_address ||
                              selectedLead.propertyValue ||
                              (selectedLead as any).property_value ||
                              selectedLead.transactionType ||
                              (selectedLead as any).transaction_type
                            );

                            const instructionFormStatus = (selectedLead as any).instructionFormStatus ||
                                                          (selectedLead as any).instruction_form_status ||
                                                          '';
                            const isFormSubmitted = instructionFormStatus === 'submitted';
                            const isAlreadyInCorrectStage = selectedLead.stage === 'Ready to Solicit' ||
                                                           selectedLead.stage === 'Instructed';

                            // If not already in correct stage and form not submitted, require BOTH PDF AND form data
                            if (!isAlreadyInCorrectStage && !isFormSubmitted) {
                              if (!hasInstructionPdf || !hasInstructionFormData) {
                                setOutcomeResult({
                                  success: false,
                                  message: 'Cannot move to "Ready to Solicit" stage. The instruction form must be submitted first. Please ensure the instruction form is submitted before proceeding.',
                                  outcomeCode: selectedOutcomeCode
                                });
                                setShowOutcomeResultModal(true);
                                setIsProcessingOutcome(false);
                                return; // Stop processing
                              }
                            }
                          }

                          setIsProcessingOutcome(true);
                          try {
                            const result = await processOutcomeCode(
                              selectedLead.id,
                              selectedLead.name,
                              selectedLead.email,
                              selectedLead.phone,
                              selectedOutcomeCode,
                              selectedLead.assignedTo || user?.id || '',
                              undefined,
                              selectedLead.stage,
                              selectedLead as any // Pass lead data to avoid extra fetch
                            );

                            if (result.success) {
                              // Reload leads first to get updated data
                              await loadLeads();

                              await refreshSelectedLead(selectedLead?.id);

                              // Include the outcome code in the result for conditional UI
                              setOutcomeResult({ ...result, outcomeCode: selectedOutcomeCode });
                              setShowOutcomeResultModal(true);
                              setSelectedOutcomeCode('');
                              // Don't close modal immediately - let user see the updated stage
                              // setShowLeadDetail(false);
                            } else {
                              setOutcomeResult({ ...result, outcomeCode: selectedOutcomeCode });
                              setShowOutcomeResultModal(true);
                            }
                          } catch (err) {
                            console.error('Error saving outcome:', err);
                            setOutcomeResult({ success: false, message: 'Failed to save outcome. Please try again.', outcomeCode: selectedOutcomeCode });
                            setShowOutcomeResultModal(true);
                          } finally {
                            setIsProcessingOutcome(false);
                          }
                        }}
                        className="btn-primary text-sm mt-2 flex items-center justify-center gap-2"
                        disabled={isProcessingOutcome || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                      >
                        {isProcessingOutcome ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          'Save Outcome'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Attempt History */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Contact Attempt History
                </h3>
                {isLoadingContactAttempts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600">Loading contact attempts...</span>
                    </div>
                ) : contactAttempts.length === 0 ? (
                  <div className="text-center py-8">
                    <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No contact attempts recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedContactAttempts.map((attempt) => {
                      const attemptDate = new Date(attempt.created_at);
                      const formattedDate = attemptDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                      const formattedTime = attemptDate.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      // Determine attempt type and icon
                      const actionDesc = attempt.action_description || '';
                      let attemptType = 'Contact';
                      let icon = <Phone className="h-4 w-4 text-gray-500" />;
                      let bgColor = 'bg-gray-50';

                      if (actionDesc.toLowerCase().includes('call') || actionDesc.toLowerCase().includes('phone')) {
                        attemptType = 'Call';
                        icon = <Phone className="h-4 w-4 text-gray-500" />;
                        bgColor = 'bg-gray-50';
                      } else if (actionDesc.toLowerCase().includes('email') || actionDesc.toLowerCase().includes('mail')) {
                        attemptType = 'Email';
                        icon = <Mail className="h-4 w-4 text-blue-500" />;
                        bgColor = 'bg-blue-50';
                      } else if (actionDesc.toLowerCase().includes('sms') || actionDesc.toLowerCase().includes('text')) {
                        attemptType = 'SMS';
                        icon = <MessageSquare className="h-4 w-4 text-green-500" />;
                        bgColor = 'bg-green-50';
                      } else if (attempt.activity_type === 'outcome_code_set') {
                        attemptType = 'Outcome';
                        icon = <Target className="h-4 w-4 text-purple-500" />;
                        bgColor = 'bg-purple-50';
                      } else if (attempt.activity_type === 'task_completed') {
                        attemptType = 'Task';
                        icon = <CheckCircle className="h-4 w-4 text-green-500" />;
                        bgColor = 'bg-green-50';
                      }

                      // Get outcome code from metadata if available
                      const outcomeCode = attempt.metadata?.outcomeCode || attempt.metadata?.outcome_code;
                      const outcomeNote = outcomeCode ? ` | Outcome: ${outcomeCode}` : '';

                      return (
                        <div key={attempt.id} className={`flex items-start space-x-3 p-3 ${bgColor} rounded-lg`}>
                          {icon}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {attemptType}: {actionDesc}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                              <span>{formattedDate} at {formattedTime}</span>
                              {attempt.done_by_name && (
                                <>
                                  <span>•</span>
                                  <span>By: {attempt.done_by_name}</span>
                                </>
                              )}
                              {outcomeNote && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-600 font-medium">{outcomeCode}</span>
                                </>
                              )}
                    </div>
                            {attempt.metadata?.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">{attempt.metadata.notes}</p>
                            )}
                  </div>
                    </div>
                      );
                    })}
                    {totalContactAttemptPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Showing {contactAttemptStartIndex + 1}-
                          {Math.min(contactAttemptStartIndex + CONTACT_ATTEMPTS_PER_PAGE, contactAttempts.length)} of{' '}
                          {contactAttempts.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary text-xs px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => setContactAttemptsPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentContactAttemptPage <= 1}
                          >
                            Prev
                          </button>
                          <span className="text-xs text-gray-600">
                            Page {currentContactAttemptPage} / {totalContactAttemptPages}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary text-xs px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() =>
                              setContactAttemptsPage((prev) => Math.min(totalContactAttemptPages, prev + 1))
                            }
                            disabled={currentContactAttemptPage >= totalContactAttemptPages}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      className="btn-secondary text-sm flex items-center space-x-1"
                      onClick={() => {
                        // Log manual call activity
                        if (selectedLead) {
                          logActivity({
                            activityType: 'contact_attempt',
                            entityType: 'contact_attempt',
                            entityId: selectedLead.id,
                            leadId: selectedLead.id,
                            leadName: selectedLead.name,
                            actionDescription: `Manual call logged for ${selectedLead.name}`,
                            doneByType: 'user',
                            doneById: user?.id,
                            doneByName: user?.name || 'Unknown',
                            metadata: { method: 'call', manual: true }
                          }).then(() => {
                            // Reload contact attempts
                            fetchContactAttempts(selectedLead.id).then(setContactAttempts);
                          });
                        }
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      <span>Log Manual Call</span>
                    </button>
                    <button
                      className="btn-secondary text-sm flex items-center space-x-1"
                      onClick={() => {
                        // The useEffect will handle scrolling when showCommunicationPanel becomes true
                        setShowCommunicationPanel(true);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Send SMS</span>
                    </button>
                    <button
                      className="btn-secondary text-sm flex items-center space-x-1"
                      onClick={() => {
                        // The useEffect will handle scrolling when showCommunicationPanel becomes true
                        setShowCommunicationPanel(true);
                      }}
                    >
                      <Mail className="h-4 w-4" />
                      <span>Send Email</span>
                    </button>
                    <button
                      className="btn-primary text-sm flex items-center space-x-1"
                      onClick={handleOpenScheduleTaskModal}
                      disabled={!selectedLead}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule Follow-up</span>
                    </button>
                  </div>
                )}
                {selectedLead && (
                  <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-800 font-medium">Contact Attempts:</span>
                      <span className="text-yellow-900 font-semibold">
                        {selectedLead.contactAttempts || 0}/{selectedLead.maxAttempts || 5}
                        {selectedLead.contactAttempts && selectedLead.contactAttempts >= (selectedLead.maxAttempts || 5) && (
                          <span className="text-red-600 ml-1">(Max reached)</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3CX Calls & AI */}
              {canViewSelectedLeadCalls && (
                <div className="card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                        <Phone className="h-5 w-5 mr-2 text-navy-700" />
                        Calls & AI
                      </h3>
                      <p className="text-xs text-gray-500">
                        Some recent calls may still be waiting for the daily 3CX transcript transfer.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary text-sm flex items-center gap-2"
                      onClick={() => selectedLead?.id && loadLeadCalls(selectedLead.id)}
                      disabled={isLoadingLeadCalls}
                    >
                      {isLoadingLeadCalls ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span>Refresh Calls</span>
                    </button>
                  </div>

                  {callAiError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {callAiError}
                    </div>
                  )}

                  {isLoadingLeadCalls ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-600">Loading 3CX calls...</span>
                    </div>
                  ) : leadCallRecords.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                      <Phone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-800">No 3CX calls linked yet</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Calls will appear here after the live call signal or daily call transfer links them to this lead.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <span className="font-medium text-gray-900">
                          {transcriptCallSummary.available} transcript{transcriptCallSummary.available === 1 ? '' : 's'} available
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                          {transcriptCallSummary.pending} pending
                        </span>
                      </div>

                      {sortedLeadCallRecords.map((call) => {
                        const analysis = callAnalysesByCallId.get(call.id);
                        const isAnalyzing = analyzingCallId === call.id || call.aiAnalysisStatus === 'analyzing';
                        const transcriptReady = hasCallTranscript(call);
                        const readableNativeType = formatNativeCallType(call.cdrCallType);
                        const tags = analysis?.tags || [];
                        const riskFlags = analysis?.managerRiskFlags || [];

                        return (
                          <div key={call.id} className="rounded-lg border border-gray-200 bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {call.startedAt ? formatDateTime(call.startedAt) : 'Time not captured'}
                                  </span>
                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                                    {call.direction || 'Direction unknown'}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getCallStatusColor(call.callStatus)}`}>
                                    {formatCallStatus(call.callStatus)}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getAiStatusColor(call.aiAnalysisStatus)}`}>
                                    AI: {call.aiAnalysisStatus.replace(/_/g, ' ')}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${transcriptReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                                    {transcriptReady ? 'Transcript ready' : 'Waiting for transcript'}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <span>Duration: {formatCallDuration(call.durationSeconds)}</span>
                                  <span>Agent: {call.agentName || call.agentExtension || 'Not captured'}</span>
                                  <span>Call ID: {call.threecxCallId}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn-primary text-sm flex items-center gap-2"
                                  onClick={() => handleAnalyzeThreeCxCall(call)}
                                  disabled={!transcriptReady || isAnalyzing}
                                  title={!transcriptReady ? 'Transcript not available until the daily call transfer arrives' : 'Analyze this call with APCM AI'}
                                >
                                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                                  <span>{analysis ? 'Re-analyze' : 'Analyze with APCM AI'}</span>
                                </button>
                              </div>
                            </div>

                            {tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {call.cdrSummary && (
                              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">3CX Summary</p>
                                  {readableNativeType && (
                                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700">
                                      {readableNativeType}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm leading-5 text-blue-950">{call.cdrSummary}</p>
                              </div>
                            )}

                            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <details className="rounded-lg bg-gray-50 px-3 py-2">
                                <summary className="cursor-pointer text-sm font-medium text-gray-900">
                                  View Transcript
                                </summary>
                                <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white p-3 text-sm text-gray-700">
                                  {call.transcript || 'Transcript not available yet.'}
                                </div>
                              </details>

                              <details className="rounded-lg bg-gray-50 px-3 py-2" open={!!analysis}>
                                <summary className="cursor-pointer text-sm font-medium text-gray-900">
                                  View APCM AI Analysis
                                </summary>
                                {analysis ? (
                                  <div className="mt-2 space-y-2 text-sm text-gray-700">
                                    <p><span className="font-medium text-gray-900">Summary:</span> {analysis.summary || 'No summary captured.'}</p>
                                    <p><span className="font-medium text-gray-900">Call type:</span> {analysis.callType || 'Not classified'}</p>
                                    <p><span className="font-medium text-gray-900">Recommended action:</span> {analysis.recommendedAction || 'No recommendation captured.'}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {analysis.followUpRequired && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Follow-up needed</span>}
                                      {isManager && analysis.instructionIntent && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Instruction intent</span>}
                                      {analysis.priceConcern && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Price concern</span>}
                                      {analysis.uspMentioned && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">USP mentioned</span>}
                                    </div>
                                    {analysis.objections.length > 0 && (
                                      <p><span className="font-medium text-gray-900">Objections:</span> {analysis.objections.join(', ')}</p>
                                    )}
                                    {riskFlags.length > 0 && (
                                      <p><span className="font-medium text-gray-900">Manager flags:</span> {riskFlags.join(', ')}</p>
                                    )}
                                    {analysis.agentNotes && (
                                      <p><span className="font-medium text-gray-900">Agent notes:</span> {analysis.agentNotes}</p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      Analyzed by {analysis.createdByName || 'CRM user'} on {formatDateTime(analysis.createdAt)}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">No AI analysis has been run for this call yet.</p>
                                )}
                              </details>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Attribution / Tracking */}
              {canViewFullAttribution && (
              <div className="card">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 text-left"
                  onClick={() => setShowAttributionDetails((prev) => !prev)}
                  aria-expanded={showAttributionDetails}
                >
                  <div className="flex items-center min-w-0">
                    <Target className="h-5 w-5 mr-2 text-gray-700 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">Attribution</h3>
                      <p className="break-words text-xs leading-5 text-gray-500">
                        CRM Source: {selectedLead.source || 'Not captured'} · UTM Source: {selectedLead.utmSource || 'Not captured'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {getAttributionCapturedCount(selectedLead)} captured
                    </span>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${showAttributionDetails ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showAttributionDetails && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-4">
                      Source is the acquisition source. Hoowla is treated as the integration transport.
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                      <div>
                        {renderTrackingField('CRM Source', selectedLead.source)}
                        {renderTrackingField('UTM Source', selectedLead.utmSource)}
                        {renderTrackingField('UTM Medium', selectedLead.utmMedium)}
                        {renderTrackingField('UTM Campaign', selectedLead.utmCampaign)}
                        {renderTrackingField('UTM Term / Keyword', selectedLead.utmTerm)}
                        {renderTrackingField('UTM Content', selectedLead.utmContent)}
                        {renderTrackingField('Google Campaign ID', selectedLead.gadCampaignId)}
                        {renderTrackingField('Google Ads Source', selectedLead.gadSource)}
                      </div>
                      <div>
                        {renderTrackingField('GCLID', selectedLead.gclid, { long: true })}
                        {renderTrackingField('GBRAID', selectedLead.gbraid, { long: true })}
                        {renderTrackingField('WBRAID', selectedLead.wbraid, { long: true })}
                        {renderTrackingField('MSCLKID', selectedLead.msclkid, { long: true })}
                        {renderTrackingField('Landing Page', selectedLead.landingPage, { long: true })}
                        {renderTrackingField('Referrer', selectedLead.referrer, { long: true })}
                        {renderTrackingField('Attribution Captured At', selectedLead.attributionCapturedAt, { date: true })}
                        {renderTrackingField('Linked Comparison Lead ID', selectedLead.comparisonLeadId, { long: true })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Communication Panel Toggle */}
              <div className="flex justify-center">
                <button
                  className="btn-primary flex items-center space-x-2"
                  onClick={() => setShowCommunicationPanel(!showCommunicationPanel)}
                >
                  <MessageSquare className="h-5 w-5" />
                  <span>Open Communication Center</span>
                </button>
              </div>

              {/* Communication Center */}
              {showCommunicationPanel && (
                <div
                  ref={communicationCenterRef}
                  className="card border-2 border-blue-200"
                  data-communication-center
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">COMMUNICATION CENTER - Lead: {selectedLead.shortCode || selectedLead.id}</h3>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setShowCommunicationPanel(false)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Quick Call Panel */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Quick Call Panel</h4>
                      <a
                        href={selectedLead.phone ? `tel:${selectedLead.phone}` : '#'}
                        className={`w-full btn-primary flex items-center justify-center space-x-2 ${
                          selectedLead.phone ? '' : 'pointer-events-none opacity-60'
                        }`}
                      >
                        <Phone className="h-5 w-5" />
                        <span>
                          {selectedLead.phone ? `Call Now - ${selectedLead.phone}` : 'No phone number available'}
                        </span>
                      </a>
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => window.open('https://www.3cx.com/', '_blank', 'noopener,noreferrer')}
                      >
                        Open 3CX Panel
                      </button>
                    </div>

                    {/* SMS Templates */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">SMS Templates</h4>
                        {isCheckingTwilio ? (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Checking connection...</span>
                          </div>
                        ) : isTwilioReady ? (
                          <div className="flex items-center space-x-1 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            <span>Twilio Connected</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>Twilio Not Connected</span>
                          </div>
                        )}
                      </div>
                      {!isTwilioReady && !isCheckingTwilio && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs text-yellow-800">
                            Twilio is not configured. Please ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set in the server .env file.
                          </p>
                        </div>
                      )}
                      {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
                        </div>
                      ) : (
                        <>
                      <div className="space-y-2">
                            {smsTemplates.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">No SMS templates available</p>
                            ) : (
                              smsTemplates.map((template) => (
                          <button
                                  key={template.id}
                            className={`w-full p-2 text-sm rounded-lg border transition-colors ${
                                    selectedTemplate === template.id
                                      ? 'bg-[#011E41] text-white border-[#011E41]'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                                  onClick={() => {
                                    setSelectedTemplate(template.id);
                                    const replacedContent = replaceTemplateVariables(template.content, selectedLead);
                                    setCustomMessage(replacedContent);
                                  }}
                                >
                                  📱 {template.name}
                          </button>
                              ))
                            )}
                      </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Message:</label>
                          <textarea
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            rows={3}
                            placeholder="Hi John, just following up on your quote..."
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            disabled={!isTwilioReady || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                          />
                            <button
                              className="btn-primary text-sm w-full flex items-center justify-center space-x-2"
                              onClick={handleSendSMS}
                              disabled={!isTwilioReady || !customMessage.trim() || !selectedLead?.phone || isSendingSMS || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                            >
                              {isSendingSMS ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <span>Send SMS</span>
                              )}
                            </button>
                        </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Email Templates */}
                  <div className="mt-6 space-y-4">
                    <h4 className="font-medium text-gray-900">Email Templates & History</h4>
                    {isLoadingTemplates ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
                      </div>
                    ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {emailTemplates.length === 0 ? (
                          <p className="text-sm text-gray-500 col-span-full text-center py-4">No email templates available</p>
                        ) : (
                          emailTemplates.map((template) => (
                        <button
                              key={template.id}
                          className="p-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                              onClick={() => {
                                setSelectedTemplate(template.id);
                                const replacedContent = replaceTemplateVariables(template.content, selectedLead);
                                const replacedSubject = template.subject
                                  ? replaceTemplateVariables(template.subject, selectedLead)
                                  : '';
                                setEmailContent(replacedContent);
                                setEmailSubject(replacedSubject);
                              }}
                            >
                              ✉️ {template.name}
                        </button>
                          ))
                        )}
                    </div>
                    )}
                    <div className="space-y-3">
                      {isCheckingOutlook ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Checking Outlook connection…</span>
                        </div>
                      ) : isOutlookReady ? (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>
                            Connected to {outlookMailboxEmail || 'shared mailbox'} for sending.
                          </span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                          Outlook shared mailbox is not connected. Visit Settings → Notifications to enable email sending.
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Subject:</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Email subject line..."
                          disabled={!!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Email Content:</label>
                      <textarea
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                          rows={6}
                          value={emailContent}
                          onChange={(e) => setEmailContent(e.target.value)}
                        placeholder="Hi John,

Just following up on the £1,200 quote we sent..."
                        disabled={!!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                      />
                      </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            type="button"
                            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={handleAttachQuote}
                            disabled={isGeneratingQuoteAttachment || !leadQuote || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                          >
                            {isGeneratingQuoteAttachment ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            <span>{quoteAttachment ? 'Remove Quote Attachment' : 'Attach Quote'}</span>
                          </button>
                          {quoteAttachment && (
                            <span className="text-xs text-gray-600">
                              Attached: {quoteAttachment.fileName}
                            </span>
                          )}
                          {!leadQuote && (
                            <span className="text-xs text-gray-500">
                              No quote available to attach.
                            </span>
                          )}
                        </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={handleSendEmail}
                          disabled={isEmailSending || !isOutlookReady || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                        >
                          {isEmailSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          <span>{isEmailSending ? 'Sending…' : 'Send Email'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={handleOpenScheduleEmailModal}
                          disabled={!isOutlookReady || isEmailSending || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                        >
                          <Clock className="h-4 w-4" />
                          Schedule Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Template Management - Only for Admin/Manager */}
              {user?.role !== 'Agent' && (
                <div className="card border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Template Management
                    </h3>
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => setShowTemplateManager(!showTemplateManager)}
                    >
                      {showTemplateManager ? 'Hide Templates' : 'Manage Templates'}
                    </button>
                  </div>

                  {showTemplateManager && (
                    <div className="space-y-6">
                      {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
                        </div>
                      ) : (
                        <>
                      {/* SMS Templates */}
                      <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-900">SMS Templates</h4>
                              <button
                                className="btn-primary text-sm flex items-center space-x-1"
                                onClick={() => {
                                  setNewTemplateType('SMS');
                                  setNewTemplateName('');
                                  setTemplateContent('');
                                  setTemplateSubject('');
                                  setShowAddTemplateModal(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                <span>Add SMS Template</span>
                              </button>
                            </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {smsTemplates.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-gray-500">
                                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                  <p>No SMS templates found. Click "Sync Templates" to add default templates.</p>
                                </div>
                              ) : (
                                smsTemplates.map((template) => (
                                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">{template.name}</h5>
                                      <div className="flex items-center gap-2">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                  onClick={() => {
                                            setEditingTemplate(template);
                                    setTemplateContent(template.content);
                                            setTemplateSubject('');
                                          }}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                          className="text-sm text-red-600 hover:text-red-800"
                                          onClick={() => handleDeleteTemplate(template)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                                    <p className="text-sm text-gray-600">{template.content}</p>
                                    {template.variables && template.variables.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {template.variables.map((variable) => (
                                          <span key={variable} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {'{'}{variable}{'}'}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                        </div>
                      </div>

                      {/* Email Templates */}
                      <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-900">Email Templates</h4>
                              <button
                                className="btn-primary text-sm flex items-center space-x-1"
                                onClick={() => {
                                  setNewTemplateType('Email');
                                  setNewTemplateName('');
                                  setTemplateContent('');
                                  setTemplateSubject('');
                                  setShowAddTemplateModal(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                <span>Add Email Template</span>
                              </button>
                            </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {emailTemplates.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-gray-500">
                                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                  <p>No email templates found. Click "Sync Templates" to add default templates.</p>
                                </div>
                              ) : (
                                emailTemplates.map((template) => (
                                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">{template.name}</h5>
                                      <div className="flex items-center gap-2">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                  onClick={() => {
                                            setEditingTemplate(template);
                                    setTemplateContent(template.content);
                                            setTemplateSubject(template.subject || '');
                                          }}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                          className="text-sm text-red-600 hover:text-red-800"
                                          onClick={() => handleDeleteTemplate(template)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                                    {template.subject && (
                                      <p className="text-xs text-gray-500 mb-1">Subject: {template.subject}</p>
                                    )}
                                    <p className="text-sm text-gray-600 whitespace-pre-line">{template.content}</p>
                                    {template.variables && template.variables.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {template.variables.map((variable) => (
                                          <span key={variable} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {'{'}{variable}{'}'}
                                          </span>
                          ))}
                        </div>
                                    )}
                      </div>
                                ))
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Template Editor Modal */}
                      {editingTemplate && (
                        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-lg w-full max-w-2xl">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900">Edit Template: {editingTemplate.name}</h3>
                              <button
                                className="text-gray-400 hover:text-gray-600"
                                onClick={() => {
                                  setEditingTemplate(null);
                                  setTemplateContent('');
                                  setTemplateSubject('');
                                }}
                              >
                                <X className="h-6 w-6" />
                              </button>
                            </div>
                            <div className="p-6">
                              <div className="space-y-4">
                                {editingTemplate.type === 'Email' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Subject *
                                    </label>
                                    <input
                                      type="text"
                                      className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                      value={templateSubject}
                                      onChange={(e) => setTemplateSubject(e.target.value)}
                                      placeholder="Email subject line..."
                                    />
                                  </div>
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Content *
                                  </label>
                                  <textarea
                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                    rows={8}
                                    value={templateContent}
                                    onChange={(e) => setTemplateContent(e.target.value)}
                                    placeholder="Enter template content..."
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Use variables like {'{name}'}, {'{amount}'}, {'{time}'}, {'{expiry_date}'} for personalization
                                  </p>
                                </div>
                                <div className="flex justify-end space-x-3">
                                  <button
                                    className="btn-secondary"
                                    onClick={() => {
                                      setEditingTemplate(null);
                                      setTemplateContent('');
                                      setTemplateSubject('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn-primary"
                                    onClick={handleSaveTemplate}
                                  >
                                    Save Template
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Add Template Modal */}
                      {showAddTemplateModal && (
                        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-lg w-full max-w-2xl">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900">Add New {newTemplateType} Template</h3>
                              <button
                                className="text-gray-400 hover:text-gray-600"
                                    onClick={() => {
                                  setShowAddTemplateModal(false);
                                  setNewTemplateName('');
                                      setTemplateContent('');
                                  setTemplateSubject('');
                                    }}
                                  >
                                <X className="h-6 w-6" />
                                  </button>
                                </div>
                            <div className="p-6">
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Name *
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="e.g., Welcome Message"
                                  />
                              </div>
                                {newTemplateType === 'Email' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Subject *
                                    </label>
                                    <input
                                      type="text"
                                      className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                      value={templateSubject}
                                      onChange={(e) => setTemplateSubject(e.target.value)}
                                      placeholder="Email subject line..."
                                    />
                            </div>
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Content *
                                  </label>
                                  <textarea
                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                    rows={8}
                                    value={templateContent}
                                    onChange={(e) => setTemplateContent(e.target.value)}
                                    placeholder="Enter template content..."
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Use variables like {'{name}'}, {'{amount}'}, {'{time}'}, {'{expiry_date}'} for personalization
                                  </p>
                                </div>
                                <div className="flex justify-end space-x-3">
                                  <button
                                    className="btn-secondary"
                                    onClick={() => {
                                      setShowAddTemplateModal(false);
                                      setNewTemplateName('');
                                      setTemplateContent('');
                                      setTemplateSubject('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn-primary"
                                    onClick={handleAddTemplate}
                                  >
                                    Create Template
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-900">Assign Selected Leads</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowBulkAssignModal(false);
                  setBulkAssignAgentId('');
                  setBulkAssignPriority('Medium');
                  setBulkAssignNotes('');
                }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Assign <span className="font-medium text-gray-900">{selectedLeads.length}</span> selected lead(s) to:
              </p>

              <div className="space-y-4">
                {/* Agent Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Agent <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={bulkAssignAgentId}
                    onChange={(e) => setBulkAssignAgentId(e.target.value)}
                  >
                    <option value="">Choose an agent...</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={bulkAssignPriority}
                    onChange={(e) => setBulkAssignPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes <span className="text-gray-500 text-xs">(for notification to assigned agent)</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={4}
                    placeholder="Add any notes or instructions for the assigned agent..."
                    value={bulkAssignNotes}
                    onChange={(e) => setBulkAssignNotes(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This note will be added to all selected leads and visible to the assigned agent.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => {
                    setShowBulkAssignModal(false);
                    setBulkAssignAgentId('');
                    setBulkAssignPriority('Medium');
                    setBulkAssignNotes('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-[#011E41] hover:bg-[#011633] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleBulkAssignConfirm}
                  disabled={!bulkAssignAgentId || selectedLeads.length === 0}
                >
                  Assign {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Export Modal */}
      {showBulkExportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Export Selected Leads</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowBulkExportModal(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Export {selectedLeads.length} selected lead(s) in:
              </p>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="radio" name="exportFormat" value="csv" className="mr-2" defaultChecked />
                  <span className="text-sm text-gray-700">CSV Format</span>
                </label>
                <label className="flex items-center">
                  <input type="radio" name="exportFormat" value="excel" className="mr-2" />
                  <span className="text-sm text-gray-700">Excel Format</span>
                </label>
                <label className="flex items-center">
                  <input type="radio" name="exportFormat" value="pdf" className="mr-2" />
                  <span className="text-sm text-gray-700">PDF Report</span>
                </label>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowBulkExportModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    console.log('Bulk export leads:', selectedLeads);
                    setShowBulkExportModal(false);
                  }}
                >
                  Export Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive by Date Modal */}
      {showArchiveByDateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Archive Leads by Date</h3>
                <p className="text-sm text-gray-600">Preview matching leads before they leave active funnels.</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowArchiveByDateModal(false)}
                disabled={isArchivingLeads}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Created Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={archiveDateFrom}
                    onChange={(e) => setArchiveDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Created Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={archiveDateTo}
                    onChange={(e) => setArchiveDateTo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stage Scope</label>
                  <select
                    className="input-field"
                    value={archiveStageMode}
                    onChange={(e) => setArchiveStageMode(e.target.value as 'call-2-5' | 'all')}
                  >
                    <option value="call-2-5">Call-2 to Call-5</option>
                    <option value="all">All active stages</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recent Activity</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="input-field"
                    value={archiveRecentDays}
                    onChange={(e) => setArchiveRecentDays(Math.max(1, Number(e.target.value) || 14))}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    onClick={loadArchiveByDatePreview}
                    disabled={isLoadingArchivePreview || !archiveDateFrom || !archiveDateTo}
                  >
                    {isLoadingArchivePreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Preview
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Archive Reason</label>
                <input
                  className="input-field"
                  value={bulkArchiveReason}
                  onChange={(e) => setBulkArchiveReason(e.target.value)}
                  placeholder="Aged funnel cleanup"
                />
              </div>

              {archivePreviewRows.length > 0 && (
                <div className="rounded-lg border border-gray-200">
                  <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">{archivePreviewSelectedIds.length}</span> selected from{' '}
                      <span className="font-semibold text-gray-900">{archivePreviewRows.length}</span> previewed
                      {archivePreviewTotal > archivePreviewRows.length ? ` (${archivePreviewTotal} matched)` : ''}
                      {archivePreviewTruncated ? ' - preview limited to first 1,000' : ''}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary text-sm" onClick={selectRecommendedArchivePreviewLeads}>
                        Recommended Only
                      </button>
                      <button className="btn-secondary text-sm" onClick={selectAllArchivePreviewLeads}>
                        Select All Previewed
                      </button>
                      <button className="btn-secondary text-sm" onClick={clearArchivePreviewSelection}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                    {archivePreviewRows.map((row) => {
                      const isSelected = archivePreviewSelectedIds.includes(row.lead.id);
                      const warningText = row.protectedReason || (row.hasRecentActivity ? 'Recent activity' : '');
                      return (
                        <label
                          key={row.lead.id}
                          className={`flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50 ${isSelected ? 'bg-blue-50/60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                            checked={isSelected}
                            onChange={() => toggleArchivePreviewLead(row.lead.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">{row.lead.name || 'Unnamed Lead'}</span>
                              {row.recommended ? (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Recommended</span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{warningText}</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                              <span>{row.lead.shortCode || row.lead.id}</span>
                              <span>{row.lead.stage}</span>
                              <span>{row.lead.status}</span>
                              <span>{row.lead.assignedToName || (row.lead.assignedTo ? 'Assigned' : 'Unassigned')}</span>
                              <span>Created {formatDateOnly(row.lead.createdAt)}</span>
                              {row.latestActivityAt && <span>Latest activity {formatDateTime(row.latestActivityAt)}</span>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {archivePreviewRows.length === 0 && !isLoadingArchivePreview && (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Choose a date range and preview matching leads.
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  Recent or progressed leads are unchecked by default. Tick them only when the manager intentionally wants them archived.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowArchiveByDateModal(false)}
                    disabled={isArchivingLeads}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={handleConfirmArchiveByDate}
                    disabled={isArchivingLeads || archivePreviewSelectedIds.length === 0}
                  >
                    {isArchivingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Archive {archivePreviewSelectedIds.length}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Archive Modal */}
      {showBulkArchiveModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Archive Selected Leads</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowBulkArchiveModal(false)}
                disabled={isArchivingLeads}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Archive className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-900">This does not delete data</h4>
                    <p className="mt-1 text-sm text-amber-800">
                      {selectedLeads.length} selected lead{selectedLeads.length === 1 ? '' : 's'} will be hidden from active funnels, dashboard counts, agent views, and quota usage. Managers can restore them later.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Archive Reason</label>
                <textarea
                  className="input-field min-h-[90px]"
                  value={bulkArchiveReason}
                  onChange={(e) => setBulkArchiveReason(e.target.value)}
                  placeholder="Aged funnel cleanup"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowBulkArchiveModal(false)}
                  disabled={isArchivingLeads}
                >
                  Cancel
                </button>
                <button
                  className={`btn-primary flex items-center ${isArchivingLeads ? 'opacity-70 cursor-not-allowed' : ''}`}
                  onClick={handleConfirmBulkArchive}
                  disabled={isArchivingLeads}
                >
                  {isArchivingLeads ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    `Archive ${selectedLeads.length} Lead${selectedLeads.length === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Selected Leads</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Warning</h4>
                    <p className="text-sm text-red-700 mt-1">
                      This will permanently delete {selectedLeads.length} selected lead(s). Deleted leads cannot be recovered and will be removed from the main lead list.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delete Reason:</label>
                <select
                  className="input-field"
                  value={bulkDeleteReason}
                  onChange={(e) => setBulkDeleteReason(e.target.value)}
                >
                  <option value="">Select Reason</option>
                  <option value="completed">Lead Completed</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="invalid_contact">Invalid Contact Information</option>
                  <option value="duplicate">Duplicate Lead</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowBulkDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={`btn-danger flex items-center ${isDeletingLeads ? 'opacity-70 cursor-not-allowed' : ''}`}
                  onClick={handleConfirmBulkDelete}
                  disabled={isDeletingLeads}
                >
                  {isDeletingLeads ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Leads'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Modal */}
      {showAdvancedFilters && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowAdvancedFilters(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                className="input-field"
                value={advancedFilters.dateRange}
                onChange={(e) => setAdvancedFilters({...advancedFilters, dateRange: e.target.value})}
              >
                <option value="">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
              <select
                className="input-field"
                value={advancedFilters.source}
                onChange={(e) => setAdvancedFilters({...advancedFilters, source: e.target.value})}
              >
                <option value="">All Sources</option>
                {LEAD_SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                className="input-field"
                value={advancedFilters.priority}
                onChange={(e) => setAdvancedFilters({...advancedFilters, priority: e.target.value})}
              >
                <option value="">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                className="input-field"
                value={advancedFilters.status}
                onChange={(e) => setAdvancedFilters({...advancedFilters, status: e.target.value})}
              >
                <option value="">All Status</option>
                <option value="New">New</option>
                <option value="Assigned">Assigned</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Quote Sent">Quote Sent</option>
                <option value="Sold">Sold</option>
                <option value="Closed">Closed</option>
                <option value="Archived">Deleted</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
              <select
                className="input-field"
                value={advancedFilters.assignedTo}
                onChange={(e) => setAdvancedFilters({...advancedFilters, assignedTo: e.target.value})}
              >
                <option value="">All Agents</option>
                <option value="unassigned">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lead Age</label>
              <select
                className="input-field"
                value={advancedFilters.ageRange}
                onChange={(e) => setAdvancedFilters({...advancedFilters, ageRange: e.target.value})}
              >
                <option value="">All Ages</option>
                <option value="new">New (&lt; 24h)</option>
                <option value="old">Old (≥ 24h)</option>
                <option value="overdue">Overdue</option>
                <option value="veryOld">Very Old (≥ 72h)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pb-4">
            <button
              className="btn-secondary"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                handleApplyFilters();
                setShowAdvancedFilters(false);
              }}
            >
              Apply Filters
            </button>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add New Lead</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  if (!isSavingLead) {
                    setShowAddLeadModal(false);
                  }
                }}
                disabled={isSavingLead}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    className="input-field"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    className="input-field"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                  <select
                    className="input-field"
                    value={newLead.source}
                    onChange={(e) => setNewLead({...newLead, source: e.target.value as any})}
                  >
                    <option value="Direct">Direct</option>
                    <option value="Hoowla">Hoowla</option>
                    <option value="Comparison Site">Comparison Site</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    className="input-field"
                    value={newLead.priority}
                    onChange={(e) => setNewLead({...newLead, priority: e.target.value as any})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                  </div>
                  {(user?.role === 'Admin' || user?.role === 'Manager') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                      <select
                        className="input-field"
                        value={newLead.assignedTo}
                        onChange={(e) => setNewLead({...newLead, assignedTo: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {agents
                          .filter(a => a.role === 'Agent')
                          .map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {(user?.role === 'Admin' || user?.role === 'Manager') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        className="input-field"
                        value={newLead.status}
                        onChange={(e) => setNewLead({...newLead, status: e.target.value as any})}
                      >
                        <option value="New">New</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Interested">Interested</option>
                        <option value="Quote Sent">Quote Sent</option>
                        <option value="Sold">Sold</option>
                        <option value="Closed">Closed</option>
                        <option value="Archived">Deleted</option>
                      </select>
                    </div>
                  )}
                  {(user?.role === 'Admin' || user?.role === 'Manager') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                      <select
                        className="input-field"
                        value={newLead.stage}
                        onChange={(e) => setNewLead({...newLead, stage: e.target.value as any})}
                      >
                        <option value="New">New</option>
                        <option value="Call-1">Call-1</option>
                        <option value="Call-2">Call-2</option>
                        <option value="Call-3">Call-3</option>
                        <option value="Call-4">Call-4</option>
                        <option value="Call-5">Call-5</option>
                        <option value="Interested">Interested</option>
                        <option value="Ready to Solicit">Ready to Solicit</option>
                        <option value="Quote Accepted - Awaiting Payment">Quote Accepted - Awaiting Payment</option>
                        <option value="Payment Completed - Awaiting Client Information">
                          Payment Completed - Awaiting client information
                        </option>
                        <option value="Instructed">Instructed</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Transaction Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                    <select
                      className="input-field"
                      value={newLead.transactionType}
                      onChange={(e) => setNewLead({...newLead, transactionType: e.target.value as any})}
                    >
                      <option value="">Select transaction type...</option>
                      <option value="Purchase">Purchase</option>
                      <option value="Sale">Sale</option>
                      <option value="Remortgage">Remortgage</option>
                      <option value="Remortgage Cashback">Remortgage Cashback</option>
                      <option value="Transfer of Equity">Transfer of Equity</option>
                      <option value="Equity Release">Equity Release</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Property Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Property Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.propertyAddress}
                      onChange={(e) => setNewLead({...newLead, propertyAddress: e.target.value})}
                      placeholder="Enter property address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Value (£)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={newLead.propertyValue}
                      onChange={(e) => setNewLead({...newLead, propertyValue: e.target.value})}
                      placeholder="Enter property value"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Tenure</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.propertyTenure}
                      onChange={(e) => setNewLead({...newLead, propertyTenure: e.target.value})}
                      placeholder="e.g., Freehold, Leasehold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title Number</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.propertyTitleNumber}
                      onChange={(e) => setNewLead({...newLead, propertyTitleNumber: e.target.value})}
                      placeholder="Enter title number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Region</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.propertyRegion}
                      onChange={(e) => setNewLead({...newLead, propertyRegion: e.target.value})}
                      placeholder="Enter region"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Property Flags</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isMortgaged}
                        onChange={(e) => setNewLead({...newLead, isMortgaged: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">Mortgaged</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isUnregistered}
                        onChange={(e) => setNewLead({...newLead, isUnregistered: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">Unregistered</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isFirstTimeBuyer}
                        onChange={(e) => setNewLead({...newLead, isFirstTimeBuyer: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">First Time Buyer</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isNewBuild}
                        onChange={(e) => setNewLead({...newLead, isNewBuild: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">New Build</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isSharedOwnership}
                        onChange={(e) => setNewLead({...newLead, isSharedOwnership: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">Shared Ownership</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newLead.isBuyToLet}
                        onChange={(e) => setNewLead({...newLead, isBuyToLet: e.target.checked})}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                      <span className="text-sm text-gray-700">Buy to Let</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Client Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Client Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Address</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.clientAddress}
                      onChange={(e) => setNewLead({...newLead, clientAddress: e.target.value})}
                      placeholder="Enter client address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      className="input-field"
                      value={newLead.clientDob}
                      onChange={(e) => setNewLead({...newLead, clientDob: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">National Insurance Number</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newLead.clientNi}
                      onChange={(e) => setNewLead({...newLead, clientNi: e.target.value})}
                      placeholder="Enter NI number"
                    />
                  </div>
                </div>
              </div>

              {/* Quote Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Quote Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property Value (£)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        className="input-field flex-1"
                        value={newLead.propertyValue}
                        onChange={(e) => setNewLead({...newLead, propertyValue: e.target.value})}
                        placeholder="Enter property value"
                      />
                      <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Refresh"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Legal Fees (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={newLead.legalFees}
                      onChange={(e) => setNewLead({...newLead, legalFees: e.target.value})}
                      placeholder="Enter legal fees"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SDLT Version</label>
                    <select
                      className="input-field"
                      value={newLead.sdtlVersion}
                      onChange={(e) => setNewLead({...newLead, sdtlVersion: e.target.value})}
                    >
                      <option value="">Select SDLT Version...</option>
                      <option value="Standard Rate Oct 2022 and after (Wales)">Standard Rate Oct 2022 and after (Wales)</option>
                      <option value="Standard Rate Oct 2022 and after (England)">Standard Rate Oct 2022 and after (England)</option>
                      <option value="Standard Rate Oct 2022 and after (Scotland)">Standard Rate Oct 2022 and after (Scotland)</option>
                      <option value="Standard Rate Oct 2022 and after (Northern Ireland)">Standard Rate Oct 2022 and after (Northern Ireland)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of People in Quote</label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={newLead.numberOfPeople}
                      onChange={(e) => setNewLead({...newLead, numberOfPeople: e.target.value})}
                      placeholder="1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Message to Client</label>
                <textarea
                  className="input-field"
                  rows={3}
                      value={newLead.customMessage}
                      onChange={(e) => setNewLead({...newLead, customMessage: e.target.value})}
                      placeholder="Enter custom message for client..."
                    />
                  </div>
                </div>

                {/* Supplements Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Supplements</label>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplementModal(true)}
                      className="btn-primary text-sm flex items-center space-x-1 px-3 py-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>ADD SUPPLEMENT</span>
                    </button>
                  </div>
                  {supplements.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No supplements added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {supplements.map((supplement) => (
                        <div key={supplement.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{supplement.name}</span>
                            <span className="text-sm text-gray-600 ml-2">£{supplement.amount.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSupplements(supplements.filter(s => s.id !== supplement.id))}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove supplement"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="text-xs text-gray-500 mt-2">
                        VAT at 20%: Auto
                      </div>
                    </div>
                  )}
                </div>

                {/* Disbursements Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Disbursements</label>
                    <button
                      type="button"
                      onClick={() => setShowAddDisbursementModal(true)}
                      className="btn-primary text-sm flex items-center space-x-1 px-3 py-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>ADD DISBURSEMENTS</span>
                    </button>
                  </div>
                  {disbursements.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No disbursements added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {disbursements.map((disbursement) => (
                        <div key={disbursement.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{disbursement.name}</span>
                            <span className="text-sm text-gray-600 ml-2">£{disbursement.amount.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDisbursements(disbursements.filter(d => d.id !== disbursement.id))}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove disbursement"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="text-xs text-gray-500 mt-2">
                        Land Registry Fees: Auto
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 border-b pb-2">Additional Notes</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    className="input-field"
                    rows={4}
                  value={newLead.notes}
                  onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                  placeholder="Enter any additional notes about this lead"
                />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 border-t pt-4">
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!isSavingLead) {
                    setShowAddLeadModal(false);
                  }
                }}
                disabled={isSavingLead}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex items-center space-x-2"
                onClick={handleSaveNewLead}
                disabled={!newLead.name || !newLead.email || !newLead.phone || isSavingLead}
              >
                {isSavingLead ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Lead...</span>
                  </>
                ) : (
                  <span>Add Lead</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Explanation Modal */}
      {showPaymentExplanationModal && selectedOutcomeCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Payment Not Completed</h2>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Notice:</strong> The system indicates that payment (£230 deposit) has not been completed for this lead.
                </p>
                <p className="text-sm text-yellow-700">
                  To proceed with "{selectedOutcomeCode}", please explain how the client completed their payment. This will allow you to manually override the payment check.
                </p>
              </div>

                    <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How did the client complete their payment? *
                  </label>
                <textarea
                  className="input"
                  rows={5}
                  value={paymentExplanation}
                  onChange={(e) => setPaymentExplanation(e.target.value)}
                  placeholder="e.g., Payment completed via phone, Bank transfer received, Cash payment, Cheque received, Payment completed outside system..."
                  required
                />
                </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This explanation will be saved in the lead notes and activity log for audit purposes.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!selectedLead || !selectedOutcomeCode || !paymentExplanation.trim() || isProcessingOutcome) return;

                  setIsProcessingOutcome(true);
                  try {
                    // Add payment explanation to lead notes
                    const explanationNote = `[Manual Payment Override - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}]\nPayment Explanation: ${paymentExplanation}\nOverridden by: ${user?.name || 'User'}`;

                    const existingNotes = selectedLead.notes || '';
                    const updatedNotes = existingNotes ? `${existingNotes}\n\n${explanationNote}` : explanationNote;

                    // Update lead notes
                    await updateLead(selectedLead.id, {
                      notes: updatedNotes
                    }, user?.role, user?.id);

                    // Also update payment_link_status directly via Supabase (not in Lead interface)
                    const { supabase } = await import('@/lib/supabase');
                    await supabase
                      .from('leads')
                      .update({ payment_link_status: 'paid' })
                      .eq('id', selectedLead.id);

                    // Log activity for payment override
                    try {
                      await logActivity({
                        activityType: 'contact_attempt',
                        entityType: 'lead',
                        entityId: selectedLead.id,
                        leadId: selectedLead.id,
                        leadName: selectedLead.name,
                        actionDescription: `Manual payment override: ${paymentExplanation}`,
                        doneByType: 'user',
                        doneById: user?.id,
                        doneByName: user?.name || 'Unknown',
                        metadata: {
                          overrideType: 'payment',
                          explanation: paymentExplanation,
                          outcomeCode: selectedOutcomeCode
                        }
                      });
                    } catch (activityError) {
                      console.warn('Could not log payment override activity:', activityError);
                    }

                    // Now process the outcome code
                    const result = await processOutcomeCode(
                      selectedLead.id,
                      selectedLead.name,
                      selectedLead.email,
                      selectedLead.phone,
                      selectedOutcomeCode,
                      selectedLead.assignedTo || user?.id || '',
                      undefined,
                      selectedLead.stage,
                      { ...selectedLead, payment_link_status: 'paid', notes: updatedNotes } as any
                    );

                    if (result.success) {
                      // Reload leads first to get updated data
                      await loadLeads();

                      const refreshedLead = selectedLead?.id ? await fetchLeadById(selectedLead.id) : null;
                      if (refreshedLead) {
                        setSelectedLead(refreshedLead);
                      }

                      setOutcomeResult(result);
                      setShowOutcomeResultModal(true);
                      setShowPaymentExplanationModal(false);
                      setPaymentExplanation('');

                      // If "Ready to Solicit", show the solicitor instruction modal after payment override
                      if (selectedOutcomeCode === 'Ready to Solicit') {
                        // Validate instruction PDF exists before opening modal
                        const leadForInstruction = refreshedLead || (selectedLead?.id ? await fetchLeadById(selectedLead.id) : null);

                        if (!leadForInstruction?.instructionPdfUrl) {
                          setShowInstructionPdfWarningModal(true);
                          setSelectedOutcomeCode('');
                          return;
                        }

                        // Close payment modal first, then show solicitor instruction modal
                        setTimeout(() => {
                          setSelectedOutcomeCode('Ready to Solicit');
                          setShowSolicitorInstructionModal(true);
                        }, 100);
                      } else {
                      setSelectedOutcomeCode('');
                      }
                    } else {
                      setOutcomeResult(result);
                      setShowOutcomeResultModal(true);
                    }
                  } catch (err) {
                    console.error('Error processing payment override:', err);
                    setOutcomeResult({
                      success: false,
                      message: err instanceof Error ? err.message : 'Failed to process payment override. Please try again.'
                    });
                    setShowOutcomeResultModal(true);
                  } finally {
                    setIsProcessingOutcome(false);
                  }
                }}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={!paymentExplanation.trim() || isProcessingOutcome}
              >
                {isProcessingOutcome ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Proceed with Override'
                )}
              </button>
              <button
                onClick={() => {
                  setShowPaymentExplanationModal(false);
                  setPaymentExplanation('');
                  setSelectedOutcomeCode('');
                }}
                className="btn-secondary flex-1"
                disabled={isProcessingOutcome}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Reason Modal */}
      {showCustomReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">
              {selectedOutcomeCode === 'Gone Elsewhere' ? 'Gone Elsewhere - Reason' : 'Custom Reason'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedOutcomeCode === 'Gone Elsewhere'
                    ? 'Why did the client go elsewhere?'
                    : 'Enter custom outcome reason'}
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={customOutcomeReason}
                  onChange={(e) => setCustomOutcomeReason(e.target.value)}
                  placeholder={
                    selectedOutcomeCode === 'Gone Elsewhere'
                      ? 'e.g., Found cheaper quote, Used friend\'s recommendation, Already instructed another firm...'
                      : 'Enter the reason for this outcome...'
                  }
                  disabled={!!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
                />
              </div>

              {selectedOutcomeCode === 'Gone Elsewhere' && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Note:</strong> This information will help us improve our service and pricing strategy.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!selectedLead || !selectedOutcomeCode || !customOutcomeReason.trim() || isProcessingOutcome) return;
                  // Prevent action in view-only mode
                  if (user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id) {
                    return;
                  }

                  setIsProcessingOutcome(true);
                  try {
                    const result = await processOutcomeCode(
                      selectedLead.id,
                      selectedLead.name,
                      selectedLead.email,
                      selectedLead.phone,
                      selectedOutcomeCode,
                      selectedLead.assignedTo || user?.id || '',
                      customOutcomeReason,
                      selectedLead.stage
                    );

                    if (result.success) {
                      // Reload leads first to get updated data
                      await loadLeads();

                      await refreshSelectedLead(selectedLead?.id);

                      setOutcomeResult(result);
                      setShowOutcomeResultModal(true);
                      setShowCustomReasonModal(false);
                      setSelectedOutcomeCode('');
                      setCustomOutcomeReason('');
                      // Don't close modal immediately - let user see the updated stage
                      // setShowLeadDetail(false);
                    } else {
                      setOutcomeResult(result);
                      setShowOutcomeResultModal(true);
                    }
                  } catch (err) {
                    console.error('Error saving outcome:', err);
                    setOutcomeResult({ success: false, message: 'Failed to save outcome. Please try again.' });
                    setShowOutcomeResultModal(true);
                  } finally {
                    setIsProcessingOutcome(false);
                  }
                }}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={!customOutcomeReason.trim() || isProcessingOutcome || !!(user?.role === 'Agent' && selectedLead?.assignedTo && selectedLead.assignedTo !== user.id)}
              >
                {isProcessingOutcome ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Save Outcome'
                )}
              </button>
              <button
                onClick={() => {
                  setShowCustomReasonModal(false);
                  setSelectedOutcomeCode('');
                  setCustomOutcomeReason('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Result Modal */}
      {showOutcomeResultModal && outcomeResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  outcomeResult.success ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {outcomeResult.success ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
      )}
        </div>
                <div className="ml-4 flex-1">
                  <h2 className={`text-xl font-bold ${
                    outcomeResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {outcomeResult.success
                      ? (outcomeResult.outcomeCode === 'Ready to Solicit'
                          ? 'Lead Moved to Ready to Solicit Stage!'
                          : 'Outcome Saved Successfully!')
                      : 'Failed to Save Outcome'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {outcomeResult.success
                      ? (outcomeResult.outcomeCode === 'Ready to Solicit'
                          ? 'The lead has been moved to Ready to Solicit stage. You can now instruct a solicitor.'
                          : 'The outcome has been processed and saved.')
                      : 'Please try again or contact support.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowOutcomeResultModal(false);
                    setOutcomeResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`p-4 rounded-lg mb-6 border ${
                outcomeResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm leading-relaxed whitespace-pre-line ${
                  outcomeResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {outcomeResult.message}
                </p>
              </div>

              <div className="flex gap-3">
                {outcomeResult.success && outcomeResult.outcomeCode === 'Ready to Solicit' && selectedLead && (
                  <button
                    onClick={() => {
                      setShowOutcomeResultModal(false);
                      setOutcomeResult(null);
                      // Validate instruction PDF exists before opening modal
                      if (!selectedLead.instructionPdfUrl) {
                        setShowInstructionPdfWarningModal(true);
                        return;
                      }
                      setShowSolicitorInstructionModal(true);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors bg-[#9164CC] text-white hover:bg-[#7a4fb3] flex items-center justify-center gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Instruct Solicitor Now</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowOutcomeResultModal(false);
                    setOutcomeResult(null);
                    // Close lead detail modal if outcome was successful
                    if (outcomeResult.success) {
                      closeLeadDetail();
                    }
                  }}
                  className={`${outcomeResult.success && outcomeResult.outcomeCode === 'Ready to Solicit' ? 'flex-1' : 'flex-1'} px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    outcomeResult.success
                      ? 'bg-[#011E41] text-white hover:bg-[#011633]'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {outcomeResult.success ? (outcomeResult.outcomeCode === 'Ready to Solicit' ? 'Done' : 'Done') : 'Close'}
                </button>
                {!outcomeResult.success && (
                  <button
                    onClick={() => {
                      setShowOutcomeResultModal(false);
                      setOutcomeResult(null);
                    }}
                    className="px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplement Modal */}
      {showAddSupplementModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Supplement</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowAddSupplementModal(false);
                  setNewSupplementName('');
                  setNewSupplementAmount('');
                }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplement Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={newSupplementName}
                  onChange={(e) => setNewSupplementName(e.target.value)}
                  placeholder="e.g., Islamic Mortgage Fee, File Opening Fee"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (£) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={newSupplementAmount}
                  onChange={(e) => setNewSupplementAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddSupplementModal(false);
                  setNewSupplementName('');
                  setNewSupplementAmount('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (newSupplementName.trim() && newSupplementAmount) {
                    const newSupplement = {
                      id: `supplement-${Date.now()}`,
                      name: newSupplementName.trim(),
                      amount: parseFloat(newSupplementAmount) || 0
                    };
                    setSupplements([...supplements, newSupplement]);
                    setShowAddSupplementModal(false);
                    setNewSupplementName('');
                    setNewSupplementAmount('');
                  }
                }}
                disabled={!newSupplementName.trim() || !newSupplementAmount}
              >
                Add Supplement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Disbursement Modal */}
      {showAddDisbursementModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Disbursement</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowAddDisbursementModal(false);
                  setNewDisbursementName('');
                  setNewDisbursementAmount('');
                }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Disbursement Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={newDisbursementName}
                  onChange={(e) => setNewDisbursementName(e.target.value)}
                  placeholder="e.g., Bankruptcy Search, OS1 Search, Anti Money Laundering Search"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (£) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={newDisbursementAmount}
                  onChange={(e) => setNewDisbursementAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddDisbursementModal(false);
                  setNewDisbursementName('');
                  setNewDisbursementAmount('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (newDisbursementName.trim() && newDisbursementAmount) {
                    const newDisbursement = {
                      id: `disbursement-${Date.now()}`,
                      name: newDisbursementName.trim(),
                      amount: parseFloat(newDisbursementAmount) || 0
                    };
                    setDisbursements([...disbursements, newDisbursement]);
                    setShowAddDisbursementModal(false);
                    setNewDisbursementName('');
                    setNewDisbursementAmount('');
                  }
                }}
                disabled={!newDisbursementName.trim() || !newDisbursementAmount}
              >
                Add Disbursement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Delete Confirmation Modal */}
      {showTemplateDeleteConfirmModal && templateToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-orange-100">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    Confirm Deletion
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Please confirm this action
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTemplateDeleteConfirmModal(false);
                    setTemplateToDelete(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 rounded-lg mb-6 bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-800 leading-relaxed">
                  Are you sure you want to delete the template "{templateToDelete.name}"? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTemplateDeleteConfirmModal(false);
                    setTemplateToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteTemplate}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Creation Notification Modal */}
      {showLeadNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  leadNotificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {leadNotificationType === 'success' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h2 className={`text-xl font-bold ${
                    leadNotificationType === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {leadNotificationType === 'success' ? 'Lead Created Successfully!' : 'Error Creating Lead'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {leadNotificationType === 'success'
                      ? 'The lead has been added to your CRM'
                      : 'Please review the error and try again'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowLeadNotificationModal(false);
                    setLeadNotificationMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`p-4 rounded-lg mb-6 border ${
                leadNotificationType === 'success'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  leadNotificationType === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {leadNotificationMessage}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowLeadNotificationModal(false);
                  setLeadNotificationMessage('');
                }}
                className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  leadNotificationType === 'success'
                    ? 'bg-[#011E41] text-white hover:bg-[#011633]'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {leadNotificationType === 'success' ? 'Done' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Notification Modal */}
      {showTemplateNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  templateNotificationType === 'success' ? 'bg-green-100' :
                  templateNotificationType === 'error' ? 'bg-red-100' :
                  'bg-orange-100'
                }`}>
                  {templateNotificationType === 'success' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : templateNotificationType === 'error' ? (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h2 className={`text-xl font-bold ${
                    templateNotificationType === 'success' ? 'text-green-900' :
                    templateNotificationType === 'error' ? 'text-red-900' :
                    'text-orange-900'
                  }`}>
                    {templateNotificationType === 'success' ? 'Success!' :
                     templateNotificationType === 'error' ? 'Error' :
                     'Warning'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {templateNotificationType === 'success' ? 'Action completed successfully' :
                     templateNotificationType === 'error' ? 'An error occurred' :
                     'Please review the message'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTemplateNotificationModal(false);
                    setTemplateNotificationMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`p-4 rounded-lg mb-6 border ${
                templateNotificationType === 'success'
                  ? 'bg-green-50 border-green-200'
                  : templateNotificationType === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  templateNotificationType === 'success' ? 'text-green-800' :
                  templateNotificationType === 'error' ? 'text-red-800' :
                  'text-orange-800'
                }`}>
                  {templateNotificationMessage}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowTemplateNotificationModal(false);
                  setTemplateNotificationMessage('');
                }}
                className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  templateNotificationType === 'success'
                    ? 'bg-[#011E41] text-white hover:bg-[#011633]'
                    : templateNotificationType === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduleTaskModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Schedule Follow-up Task</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Create a reminder to follow up with {selectedLead.name || 'this lead'}.
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleCloseScheduleTaskModal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {scheduleTaskError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {scheduleTaskError}
                </div>
              )}

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1">
                <p className="font-semibold text-blue-900">{selectedLead.name}</p>
                {selectedLead.email && <p>{selectedLead.email}</p>}
                {selectedLead.phone && <p>{selectedLead.phone}</p>}
                <p className="text-xs text-blue-700">
                  Assigned to: {selectedLead.assignedToName || (user?.name ? `${user.name} (You)` : 'You')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
                  <select
                    value={scheduleTaskForm.taskType}
                    onChange={(e) => handleScheduleTaskFieldChange('taskType', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={scheduleTaskForm.priority}
                    onChange={(e) =>
                      handleScheduleTaskFieldChange(
                        'priority',
                        e.target.value as typeof scheduleTaskForm.priority
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
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
                  value={scheduleTaskForm.title}
                  onChange={(e) => handleScheduleTaskFieldChange('title', e.target.value)}
                  placeholder="Follow up with lead..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={scheduleTaskForm.description}
                  onChange={(e) => handleScheduleTaskFieldChange('description', e.target.value)}
                  placeholder="Add any additional context for this follow-up..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    min={getToday()}
                    value={scheduleTaskForm.dueDate}
                    onChange={(e) => handleScheduleTaskFieldChange('dueDate', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Time</label>
                  <input
                    type="time"
                    value={scheduleTaskForm.dueTime}
                    onChange={(e) => handleScheduleTaskFieldChange('dueTime', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#401DBA] focus:ring-[#401DBA]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional — leave blank for an all-day reminder.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseScheduleTaskModal}
                disabled={isSchedulingTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleCreateFollowUpTask}
                disabled={isSchedulingTask}
              >
                {isSchedulingTask && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isSchedulingTask ? 'Scheduling...' : 'Schedule Task'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduleEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Schedule Email Send</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Choose when this email should be sent. It will be delivered automatically via the shared Outlook mailbox.
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => {
                  setShowScheduleEmailModal(false);
                  setScheduleError(null);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Send Date</label>
                <input
                  type="date"
                  className="w-full input-field"
                  value={scheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Send Time</label>
                <input
                  type="time"
                  className="w-full input-field"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            {scheduleError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {scheduleError}
              </div>
            )}

            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-semibold">Recipient:</span> {selectedLead?.name || 'Lead'} (
                {selectedLead?.email || 'No email'})
              </p>
              <p>
                <span className="font-semibold">Subject:</span> {emailSubject || '(No subject yet)'}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowScheduleEmailModal(false);
                  setScheduleError(null);
                }}
                disabled={isSchedulingEmail}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleScheduleEmail}
                disabled={isSchedulingEmail}
              >
                {isSchedulingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <span>{isSchedulingEmail ? 'Scheduling…' : 'Schedule Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {emailFeedback && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  emailFeedback.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                {emailFeedback.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h3
                  className={`text-lg font-semibold ${
                    emailFeedback.type === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {emailFeedback.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{emailFeedback.message}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setEmailFeedback(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-end border-t border-gray-100 px-5 py-3">
              <button className="btn-primary text-sm" onClick={() => setEmailFeedback(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solicitor Instruction Modal */}
      {showSolicitorInstructionModal && selectedLead && (
        <SolicitorInstructionModal
          lead={selectedLead}
          quote={leadQuote}
          isOpen={showSolicitorInstructionModal}
          onClose={() => setShowSolicitorInstructionModal(false)}
          onSuccess={() => {
            loadLeads();
            // Reload lead details if selected
            if (selectedLead) {
              const loadQuote = async () => {
                try {
                  const quotes = await fetchQuotes({ leadId: selectedLead.id });
                  if (quotes && quotes.length > 0) {
                    const sortedQuotes = quotes.sort((a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    setLeadQuotes(sortedQuotes);
                    setLeadQuote(sortedQuotes[0]);
                  }
                } catch (err) {
                  console.error('Error loading quote:', err);
                }
              };
              loadQuote();
            }
          }}
        />
      )}

      {/* Instruction PDF Warning Modal */}
      {showInstructionPdfWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-yellow-900">Instruction PDF Not Available</h2>
                  <p className="text-sm text-gray-500 mt-1">Action Required</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-4">
                  Please send the instruction form to the client or fill it with their instructions before instructing the solicitor.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Important:</p>
                  <p className="text-sm text-yellow-700">
                    The instruction PDF must be available before proceeding with solicitor instruction.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowInstructionPdfWarningModal(false)}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Instruction Form Confirmation Modal */}
      {showResetInstructionModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <RotateCcw className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Reset Instruction Form</h2>
                  <p className="text-sm text-gray-500 mt-1">Confirm Action</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to reset the instruction form for <strong>{selectedLead.name}</strong>?
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-orange-800 mb-1">This will:</p>
                  <ul className="text-sm text-orange-700 list-disc list-inside space-y-1">
                    <li>Clear the instruction form submission status</li>
                    <li>Remove the instruction PDF URL</li>
                    <li>Clear submission and generation timestamps</li>
                    <li>Allow the client to fill the form again</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  <strong>Note:</strong> The existing instruction form data will be cleared. The client will need to submit a new instruction form.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowResetInstructionModal(false)}
                  className="btn-secondary"
                  disabled={isResettingInstruction}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetInstructionForm}
                  className="btn-primary bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isResettingInstruction}
                >
                  {isResettingInstruction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Instruction Form
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
