import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserCheck,
  TrendingUp,
  PoundSterling,
  CheckCircle,
  User,
  Loader2,
  Hand,
  Eye,
  UserPlus,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Headphones,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
// import { getDashboardStats } from '@/services/leadsService'; // Currently using fallback
import { supabase } from '@/lib/supabase';
import { ActivityModal } from '@/components/ActivityModal';
import { AssignLeadModal } from '@/components/AssignLeadModal';
import { AttentionStatCard } from '@/components/AttentionStatCard';
import { ApcmAiDigestCard } from '@/components/ApcmAiDigestCard';
import { DashboardTrends } from '@/components/trends/DashboardTrends';
import { APCM_AI_ENABLED } from '@/lib/featureFlags';
import { fetchTodayActivities, formatActivityForDisplay } from '@/services/activityService';
import { fetchLeadSummary } from '@/services/leadsService';
import { fetchPayments } from '@/services/paymentsService';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    activeLeads: 0,
    instructedLeads: 0,
    closedLeads: 0, // For agents
    assignedLeads: 0,
    unassignedLeads: 0,
    claimedToday: 0,
    overallLeads: 0,
    leadsCreatedLast7Days: 0,
    instructedFromLeadsCreatedLast7Days: 0,
    totalCallsToday: 0,
    totalCallsYesterday: 0,
  });
  const [previousStats, setPreviousStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    activeLeads: 0,
    instructedLeads: 0,
    closedLeads: 0, // For agents
    assignedLeads: 0,
    unassignedLeads: 0,
    claimedToday: 0,
    overallLeads: 0,
    leadsCreatedLast7Days: 0,
    instructedFromLeadsCreatedLast7Days: 0,
    totalCallsToday: 0,
    totalCallsYesterday: 0,
  });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [previousRevenue, setPreviousRevenue] = useState(0);
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    action: string;
    lead: string;
    time: string;
    type: 'assignment' | 'quote' | 'payment' | 'followup' | 'status';
    leadId?: string;
    timestamp?: number;
  }>>([]);
  const [showAllActivity] = useState(false); // Reserved for future use
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [allTodayActivity, setAllTodayActivity] = useState<Array<{
    id: string;
    action: string;
    lead: string;
    time: string;
    type: 'assignment' | 'quote' | 'payment' | 'followup' | 'status';
    doneBy?: string;
    doneByType?: 'user' | 'system' | 'webhook' | 'api';
    leadId?: string;
    timestamp?: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [leadsMap, setLeadsMap] = useState<Map<string, { assignedTo?: string; assignedToName?: string; source?: string }>>(new Map());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<{ id: string; name: string } | null>(null);
  const [assignFeedback, setAssignFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss assign feedback after 3 seconds
  useEffect(() => {
    if (!assignFeedback) return;
    const timeout = setTimeout(() => setAssignFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [assignFeedback]);

  // Helper function to calculate percentage change
  const calculateChange = (current: number, previous: number): { value: string; type: 'positive' | 'negative' | 'neutral' } => {
    if (previous === 0) {
      if (current > 0) return { value: 'New', type: 'positive' };
      return { value: 'No previous data', type: 'neutral' };
    }
    const change = current - previous;
    const percentage = ((change / previous) * 100).toFixed(1);
    if (Math.abs(change) < 1 && percentage === '0.0') {
      return { value: 'No change', type: 'neutral' };
    }
    return {
      value: `${change >= 0 ? '+' : ''}${percentage}%`,
      type: change >= 0 ? 'positive' : 'negative'
    };
  };

  // Helper function to calculate absolute change
  const calculateAbsoluteChange = (current: number, previous: number): { value: string; type: 'positive' | 'negative' | 'neutral' } => {
    if (previous === 0) {
      if (current > 0) return { value: 'New', type: 'positive' };
      return { value: 'No previous data', type: 'neutral' };
    }
    const change = current - previous;
    if (change === 0) return { value: 'No change', type: 'neutral' };
    return {
      value: `${change >= 0 ? '+' : ''}${change}`,
      type: change >= 0 ? 'positive' : 'negative'
    };
  };

  const currentSnapshot = (label = 'Live now') => ({ value: label, type: 'neutral' as const });

  // Fetch real stats from Supabase using optimized lightweight count queries
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        // Use fetchLeadSummary for all-time counts (fast, accurate, matches sidebar)
        const summary = await fetchLeadSummary(
          user?.role as 'Admin' | 'Manager' | 'Agent', 
          user?.id
        );

        // Get all-time current stats (matches sidebar) - count queries run in parallel
        const { supabase } = await import('@/lib/supabase');
        const isAgent = user?.role === 'Agent' && user?.id;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const nowIso = now.toISOString();
        const startOfTodayIso = startOfToday.toISOString();
        const startOfTomorrowIso = startOfTomorrow.toISOString();
        const startOfYesterdayIso = startOfYesterday.toISOString();
        const sevenDaysAgoIso = sevenDaysAgo.toISOString();
        const fourteenDaysAgoIso = fourteenDaysAgo.toISOString();
        const startOfMonthIso = startOfMonth.toISOString();
        const startOfPreviousMonthIso = startOfPreviousMonth.toISOString();
        
        // Management cards use daily operational counts and manual instruction source of truth.
        // For "Closed Leads": count all closed leads (only for agents)
        const [
          { count: overallLeadsCount },
          { count: newLeadsCount },
          { count: instructedCount },
          { count: closedCount },
          { count: leadsCreatedLast7DaysCount },
          { count: instructedFromLeadsCreatedLast7DaysCount },
          { count: totalCallsTodayCount },
          { count: totalCallsYesterdayCount }
        ] = await Promise.all([
          (async () => {
            if (isAgent) return { count: 0 };
            return await supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true);
          })(),
          (async () => {
            if (isAgent) {
              return { count: 0 }; // Agents don't see "New Leads"
            }
            let query = supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true)
              .gte('created_at', startOfTodayIso)
              .lt('created_at', startOfTomorrowIso);
            return await query;
          })(),
          (async () => {
            if (isAgent) {
              return { count: 0 }; // Agents don't see "Instructed Leads"
            }
            const { data, error } = await supabase.rpc('get_weighted_instruction_count', {
              p_start_date: startOfTodayIso,
              p_end_date: startOfTomorrowIso,
            });
            if (error) throw error;
            return { count: Number(data || 0) };
          })(),
          (async () => {
            if (!isAgent) {
              return { count: 0 }; // Manager/admin don't see "Closed Leads"
            }
            let query = supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true)
              .in('status', ['Sold', 'Closed'])
              .eq('assigned_to', user.id);
            return await query;
          })(),
          (async () => {
            if (isAgent) return { count: 0 };
            return await supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true)
              .gte('created_at', sevenDaysAgoIso);
          })(),
          (async () => {
            if (isAgent) return { count: 0 };
            const { data, error } = await supabase.rpc('get_weighted_instruction_count_for_created_leads', {
              p_start_date: sevenDaysAgoIso,
              p_end_date: nowIso,
            });
            if (error) throw error;
            return { count: Number(data || 0) };
          })(),
          (async () => {
            if (isAgent) return { count: 0 };
            return await supabase
              .from('crm_call_records')
              .select('id', { count: 'exact', head: true })
              .gte('started_at', startOfTodayIso)
              .lt('started_at', startOfTomorrowIso);
          })(),
          (async () => {
            if (isAgent) return { count: 0 };
            return await supabase
              .from('crm_call_records')
              .select('id', { count: 'exact', head: true })
              .gte('started_at', startOfYesterdayIso)
              .lt('started_at', startOfTodayIso);
          })()
        ]);

        // Get all-time current stats (matches sidebar)
            const currentStats = {
          totalLeads: summary.totalActive,
          newLeads: newLeadsCount ?? 0, // Leads created today
          activeLeads: user?.role === 'Agent' ? summary.totalActive : summary.assignedActive,
          instructedLeads: instructedCount ?? 0, // Manual instructions marked today
          closedLeads: closedCount ?? 0, // All closed leads (all-time, agents only)
          assignedLeads: user?.role === 'Agent' ? summary.totalActive : summary.assignedActive,
          unassignedLeads: summary.unassignedActive,
          claimedToday: summary.claimedToday ?? 0,
          overallLeads: overallLeadsCount ?? summary.totalActive,
          leadsCreatedLast7Days: leadsCreatedLast7DaysCount ?? 0,
          instructedFromLeadsCreatedLast7Days: instructedFromLeadsCreatedLast7DaysCount ?? 0,
          totalCallsToday: totalCallsTodayCount ?? 0,
          totalCallsYesterday: totalCallsYesterdayCount ?? 0,
            };

            setStats(currentStats);

        // Previous period stats (7-14 days ago) for comparison - run all count queries in parallel
        const activeStatuses = ['Assigned', 'Contacted', 'Interested', 'Quote Sent'];

        // Helper to build count query with filters
        const buildCountQuery = (filters: {
          status?: string;
          statusIn?: string[];
          closed?: boolean;
          stage?: string;
          manualInstructed?: boolean;
          dateFrom?: string;
          dateTo?: string;
        }) => {
          let query = supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .not('is_funnel_archived', 'is', true);

          if (isAgent) {
            query = query.eq('assigned_to', user.id);
          }

          const dateColumn = filters.manualInstructed ? 'manual_instructed_at' : 'created_at';
          if (filters.dateFrom) {
            query = query.gte(dateColumn, filters.dateFrom);
          }
          if (filters.dateTo) {
            query = query.lt(dateColumn, filters.dateTo);
          }
          if (filters.manualInstructed) {
            query = query.eq('is_manually_instructed', true);
          }
          if (filters.status) {
            query = query.eq('status', filters.status);
          }
          if (filters.statusIn) {
            query = query.in('status', filters.statusIn);
          }
          if (filters.closed !== undefined) {
            if (filters.closed) {
              query = query.in('status', ['Sold', 'Closed']);
            }
          }
          if (filters.stage) {
            query = query.eq('stage', filters.stage);
          }

          return query;
        };

        // Previous period stats (7-14 days ago) - run all count queries in parallel
        const [
          prevTotalLeadsRes,
          prevNewLeadsRes,
          prevActiveLeadsRes,
          prevInstructedLeadsRes,
          prevClosedLeadsRes,
          prevAssignedLeadsRes,
          prevUnassignedLeadsRes,
          prevLeadsCreatedLast7DaysRes,
          prevInstructedFromLeadsCreatedLast7DaysRes,
        ] = await Promise.all([
          buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }),
          isAgent ? Promise.resolve({ count: 0 }) : buildCountQuery({ dateFrom: startOfYesterdayIso, dateTo: startOfTodayIso }),
          buildCountQuery({ statusIn: activeStatuses, dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }),
          isAgent ? Promise.resolve({ count: 0 }) : (async () => {
            const { data, error } = await supabase.rpc('get_weighted_instruction_count', {
              p_start_date: startOfYesterdayIso,
              p_end_date: startOfTodayIso,
            });
            if (error) throw error;
            return { count: Number(data || 0) };
          })(),
          isAgent ? buildCountQuery({ closed: true, dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }) : Promise.resolve({ count: 0 }),
          isAgent ? buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }) : buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }).not('assigned_to', 'is', null),
          isAgent ? buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }).is('assigned_to', null) : buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }).is('assigned_to', null),
          isAgent ? Promise.resolve({ count: 0 }) : buildCountQuery({ dateFrom: fourteenDaysAgoIso, dateTo: sevenDaysAgoIso }),
          isAgent ? Promise.resolve({ count: 0 }) : (async () => {
            const { data, error } = await supabase.rpc('get_weighted_instruction_count_for_created_leads', {
              p_start_date: fourteenDaysAgoIso,
              p_end_date: sevenDaysAgoIso,
            });
            if (error) throw error;
            return { count: Number(data || 0) };
          })(),
        ]);

            const prevStats = {
          totalLeads: prevTotalLeadsRes.count ?? 0,
          newLeads: isAgent ? 0 : (prevNewLeadsRes.count ?? 0),
          activeLeads: prevActiveLeadsRes.count ?? 0,
          instructedLeads: isAgent ? 0 : (prevInstructedLeadsRes.count ?? 0),
          closedLeads: isAgent ? (prevClosedLeadsRes.count ?? 0) : 0,
          assignedLeads: prevAssignedLeadsRes.count ?? 0,
          unassignedLeads: prevUnassignedLeadsRes.count ?? 0,
          claimedToday: 0,
          overallLeads: prevTotalLeadsRes.count ?? 0,
          leadsCreatedLast7Days: prevLeadsCreatedLast7DaysRes.count ?? 0,
          instructedFromLeadsCreatedLast7Days: prevInstructedFromLeadsCreatedLast7DaysRes.count ?? 0,
          totalCallsToday: totalCallsYesterdayCount ?? 0,
          totalCallsYesterday: 0,
            };
            setPreviousStats(prevStats);

        // Revenue card is month-scoped so the label matches the value.
        const [monthlyPayments, previousMonthPayments] = await Promise.all([
          fetchPayments({ fromDate: startOfMonthIso, toDate: nowIso }),
          fetchPayments({ fromDate: startOfPreviousMonthIso, toDate: startOfMonthIso })
        ]);

        const currentRevenue = monthlyPayments
          .filter((p) => p.status.toLowerCase() === 'paid')
          .reduce((sum, p) => sum + p.amount, 0);
        setTotalRevenue(currentRevenue);

        const prevRevenue = previousMonthPayments
          .filter((p) => p.status.toLowerCase() === 'paid')
          .reduce((sum, p) => sum + p.amount, 0);
        setPreviousRevenue(prevRevenue);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      loadStats();
    } else {
      // If no user yet, still stop loading to avoid infinite spinner
      setIsLoading(false);
    }
  }, [user]);

  // Helper function to format time ago
  const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    
    try {
      // Parse date string - handle both ISO format and timestamps
      let date: Date;
      if (typeof dateString === 'string') {
        // If it's already an ISO string, parse it directly
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Unknown';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      // Future timestamps should never render as "Just now" (usually bad data).
      if (diffMs < 0) return 'Unknown';
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Show seconds for items less than 1 minute (prevents "stuck at Just now" feel)
      if (diffMs >= 0 && diffMs < 60000) {
        const diffSecs = Math.max(1, Math.floor(diffMs / 1000));
        return `${diffSecs} ${diffSecs === 1 ? 'second' : 'seconds'} ago`;
      }
      
      // Show minutes for items less than 1 hour (0-59 minutes)
      if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      }
      
      // Show hours for items less than 24 hours
      if (diffHours < 24) {
        // Also show minutes for partial hours (e.g., "1 hour 15 minutes ago")
        const remainingMins = diffMins % 60;
        if (remainingMins > 0 && diffHours < 2) {
          return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ${remainingMins} ${remainingMins === 1 ? 'minute' : 'minutes'} ago`;
        }
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      // Show days
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } catch (error) {
      console.error('Error formatting time ago:', error, dateString);
      return 'Unknown';
    }
  };

  const mapAndDeduplicateActivities = (formattedActivities: ReturnType<typeof formatActivityForDisplay>[]) => {
    const mapped = formattedActivities.map((act) => ({
      id: act.id,
      action: act.action,
      lead: act.lead,
      time: act.time,
      type: (act.type.includes('lead_assigned') || act.type.includes('assignment') ? 'assignment' :
        act.type.includes('lead_deleted') ? 'status' :
        act.type === 'sms_sent' || act.type === 'email_sent' || act.type.includes('quote') ? 'quote' :
        act.type.includes('payment') ? 'payment' :
        act.type.includes('task') ? 'followup' :
        act.type.includes('instruction') ? 'status' :
        act.type.includes('status') ? 'status' : 'assignment') as 'assignment' | 'quote' | 'payment' | 'followup' | 'status',
      doneBy: act.doneBy,
      doneByType: act.doneByType,
      leadId: act.leadId,
      timestamp: act.timestamp,
    }));

    const seen = new Set<string>();
    const deduped = mapped.filter((activity) => {
      const timeWindow = Math.floor((activity.timestamp || 0) / 120000) * 120000;
      const key = `${activity.action.toLowerCase()}|${activity.lead.toLowerCase()}|${timeWindow}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return deduped;
  };

  const buildPreviewActivities = (
    activities: ReturnType<typeof mapAndDeduplicateActivities>,
    showAll: boolean,
  ) => {
    const withoutNoisySystemUnknowns = activities.filter((activity) => {
      const action = (activity.action || '').toLowerCase();
      const isNoisySystemAutoComplete =
        activity.doneByType === 'system' &&
        (activity.lead === 'Unknown Lead' || activity.lead === 'Assigned') &&
        (action.includes('auto-completed') || action.includes('automatically completed'));
      return !isNoisySystemAutoComplete;
    });

    const list = withoutNoisySystemUnknowns.length >= 5 ? withoutNoisySystemUnknowns : activities;
    const displayCount = showAll ? list.length : 5;
    return list.slice(0, displayCount).map(({ doneBy, doneByType, ...rest }) => rest);
  };

  const removeNoisySystemUnknowns = (
    activities: ReturnType<typeof mapAndDeduplicateActivities>,
  ) => activities.filter((activity) => {
    const action = (activity.action || '').toLowerCase();
    return !(
      activity.doneByType === 'system' &&
      (activity.lead === 'Unknown Lead' || activity.lead === 'Assigned') &&
      (action.includes('auto-completed') || action.includes('automatically completed'))
    );
  });

  const getActivityDisplayAction = (action: string, leadSource?: string) => {
    if (!leadSource || leadSource === 'Hoowla') return action;
    if (!action.includes('from Hoowla')) return action;
    return action.replace('from Hoowla', `from ${leadSource}`);
  };

  const refreshActivityLeadMap = async (activities: Array<{ leadId?: string }>) => {
    const leadIds = Array.from(new Set(
      activities.map((activity) => activity.leadId).filter(Boolean)
    )) as string[];

    if (leadIds.length === 0) {
      setLeadsMap(new Map());
      return;
    }

    const { data, error } = await supabase
      .from('leads')
      .select('id, assigned_to, source')
      .in('id', leadIds)
      .not('is_funnel_archived', 'is', true);

    if (error) {
      console.warn('Unable to refresh dashboard activity lead assignment map:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return;
    }

    setLeadsMap(new Map((data || []).map((lead: any) => [
      lead.id,
      {
        assignedTo: lead.assigned_to || undefined,
        source: lead.source || undefined,
      },
    ])));
  };

  // Fetch recent activity from activity_log table
  useEffect(() => {
    const loadRecentActivity = async () => {
      if (!user) {
        setIsLoadingActivity(false);
        return;
      }

      setIsLoadingActivity(true);
      try {
        // Fetch from activity_log table
        const activities = await fetchTodayActivities(user.id, user.role);
        const formattedActivities = activities.map(formatActivityForDisplay);

        const uniqueActivities = mapAndDeduplicateActivities(formattedActivities);

        await refreshActivityLeadMap(uniqueActivities);
        
        setAllTodayActivity(removeNoisySystemUnknowns(uniqueActivities));

        // Show top preview activities, suppressing repetitive system-only noise.
        setRecentActivity(buildPreviewActivities(uniqueActivities, showAllActivity));

        if (import.meta.env.DEV) {
          console.log('Today\'s activities:', uniqueActivities.length, 'Show all:', showAllActivity);
        }
        setIsLoadingActivity(false);
      } catch (err) {
        console.error('Error loading recent activity:', err);
        
        // Fallback to old method if activity_log table doesn't exist yet
        await loadRecentActivityFallback();
      }
    };

    // Fallback method using old query logic
    const loadRecentActivityFallback = async () => {
      if (!user) {
        setIsLoadingActivity(false);
        return;
      }
      
      try {
        const activities: Array<{
          id: string;
          action: string;
          lead: string;
          time: string;
          timestamp: number;
          type: 'assignment' | 'quote' | 'payment' | 'followup' | 'status';
        }> = [];

        const now = new Date();
        // Get start of today (midnight)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTodayISO = startOfToday.toISOString();

        // 1. Recent lead assignments and new leads (from leads table)
        // Get new leads created today
        let newLeadsQuery = supabase
          .from('leads')
          .select('id, name, assigned_to, created_at, status')
          .not('is_funnel_archived', 'is', true)
          .gte('created_at', startOfTodayISO)
          .order('created_at', { ascending: false })
          .limit(50); // Get more for "View All"

        if (user.role === 'Agent') {
          newLeadsQuery = newLeadsQuery.eq('assigned_to', user.id);
        }

        const { data: newLeads } = await newLeadsQuery;

        if (newLeads) {
          newLeads.forEach((lead: any) => {
            activities.push({
              id: `new-lead-${lead.id}`,
              action: user.role === 'Agent' ? 'New lead assigned to you' : 'New lead created',
              lead: lead.name,
              time: formatTimeAgo(lead.created_at),
              timestamp: new Date(lead.created_at).getTime(),
              type: 'assignment'
            });
          });
        }

        // Get recent assignments (leads assigned today but created earlier)
        let assignmentsQuery = supabase
          .from('leads')
          .select('id, name, assigned_to, updated_at, created_at, status')
          .not('is_funnel_archived', 'is', true)
          .gte('updated_at', startOfTodayISO)
          .not('assigned_to', 'is', null)
          .lt('created_at', startOfTodayISO); // Created before today, but updated today

        if (user.role === 'Agent') {
          assignmentsQuery = assignmentsQuery.eq('assigned_to', user.id);
        }

        const { data: recentAssignments } = await assignmentsQuery
          .order('updated_at', { ascending: false })
          .limit(10);

        if (recentAssignments) {
          recentAssignments.forEach((lead: any) => {
            activities.push({
              id: `assignment-${lead.id}`,
              action: user.role === 'Agent' ? 'Lead assigned to you' : 'Lead assigned',
              lead: lead.name,
              time: formatTimeAgo(lead.updated_at),
              timestamp: new Date(lead.updated_at).getTime(),
              type: 'assignment'
            });
          });
        }

        // 2. Recent quotes sent today
        let quotesQuery = supabase
          .from('quotes')
          .select('id, lead_id, sent_at, created_at, status')
          .eq('status', 'Sent')
          .not('sent_at', 'is', null)
          .gte('sent_at', startOfTodayISO)
          .order('sent_at', { ascending: false })
          .limit(50); // Get more for "View All"

        if (user.role === 'Agent') {
          // For agents, get quotes for their assigned leads
          const { data: agentLeads } = await supabase
            .from('leads')
            .select('id')
            .not('is_funnel_archived', 'is', true)
            .eq('assigned_to', user.id);
          
          if (agentLeads && agentLeads.length > 0) {
            quotesQuery = quotesQuery.in('lead_id', agentLeads.map((l: any) => l.id));
          } else {
            quotesQuery = quotesQuery.eq('lead_id', 'no-leads'); // This will return empty
          }
        }

        const { data: recentQuotes } = await quotesQuery;

        if (recentQuotes && recentQuotes.length > 0) {
          // Fetch lead names separately
          const quoteLeadIds = [...new Set(recentQuotes.map((q: any) => q.lead_id).filter(Boolean))];
          const { data: quoteLeads } = await supabase
            .from('leads')
            .select('id, name')
            .in('id', quoteLeadIds)
            .not('is_funnel_archived', 'is', true);
          
          const quoteLeadMap = new Map(quoteLeads?.map((l: any) => [l.id, l.name]) || []);

          recentQuotes.forEach((quote: any) => {
            const leadName = String(quoteLeadMap.get(quote.lead_id) || 'Unknown Lead');
            // Use sent_at if available, otherwise use created_at
            const quoteDate = quote.sent_at || quote.created_at;
            activities.push({
              id: `quote-${quote.id}`,
              action: 'Quote sent',
              lead: leadName,
              time: formatTimeAgo(quoteDate),
              timestamp: new Date(quoteDate).getTime(),
              type: 'quote'
            });
          });
        }

        // 3. Recent payments today
        let paymentsQuery = supabase
          .from('payments')
          .select('id, lead_id, created_at, amount, status')
          .eq('status', 'Completed')
          .gte('created_at', startOfTodayISO)
          .order('created_at', { ascending: false })
          .limit(50); // Get more for "View All"

        if (user.role === 'Agent') {
          const { data: agentLeads } = await supabase
            .from('leads')
            .select('id')
            .not('is_funnel_archived', 'is', true)
            .eq('assigned_to', user.id);
          
          if (agentLeads && agentLeads.length > 0) {
            paymentsQuery = paymentsQuery.in('lead_id', agentLeads.map((l: any) => l.id));
          } else {
            paymentsQuery = paymentsQuery.eq('lead_id', 'no-leads');
          }
        }

        const { data: recentPayments } = await paymentsQuery;

        if (recentPayments && recentPayments.length > 0) {
          // Fetch lead names separately
          const paymentLeadIds = [...new Set(recentPayments.map((p: any) => p.lead_id).filter(Boolean))];
          const { data: paymentLeads } = await supabase
            .from('leads')
            .select('id, name')
            .in('id', paymentLeadIds)
            .not('is_funnel_archived', 'is', true);
          
          const paymentLeadMap = new Map(paymentLeads?.map((l: any) => [l.id, l.name]) || []);

          recentPayments.forEach((payment: any) => {
            const leadName = String(paymentLeadMap.get(payment.lead_id) || 'Unknown Lead');
            activities.push({
              id: `payment-${payment.id}`,
              action: user.role === 'Agent' ? 'Payment received' : 'Payment received',
              lead: leadName,
              time: formatTimeAgo(payment.created_at),
              timestamp: new Date(payment.created_at).getTime(),
              type: 'payment'
            });
          });
        }

        // 4. Recent task completions today
        let tasksQuery = supabase
          .from('diary_tasks')
          .select('id, lead_id, title, completed_at')
          .eq('status', 'Completed')
          .not('completed_at', 'is', null)
          .gte('completed_at', startOfTodayISO)
          .order('completed_at', { ascending: false })
          .limit(50); // Get more for "View All"

        if (user.role === 'Agent') {
          tasksQuery = tasksQuery.eq('assigned_to', user.id);
        }

        const { data: recentTasks } = await tasksQuery;

        if (recentTasks && recentTasks.length > 0) {
          // Fetch lead names separately
          const taskLeadIds = [...new Set(recentTasks.map((t: any) => t.lead_id).filter(Boolean))];
          const { data: taskLeads } = await supabase
            .from('leads')
            .select('id, name')
            .in('id', taskLeadIds)
            .not('is_funnel_archived', 'is', true);
          
          const taskLeadMap = new Map(taskLeads?.map((l: any) => [l.id, l.name]) || []);

          recentTasks.forEach((task: any) => {
            const leadName = String(taskLeadMap.get(task.lead_id) || 'Unknown Lead');
            activities.push({
              id: `task-${task.id}`,
              action: user.role === 'Agent' ? 'Task completed' : 'Follow-up completed',
              lead: leadName,
              time: formatTimeAgo(task.completed_at),
              timestamp: new Date(task.completed_at).getTime(),
              type: 'followup'
            });
          });
        }

        // 5. Recent status changes (leads moved to Sold/Closed)
        let statusQuery = supabase
          .from('leads')
          .select('id, name, status, updated_at')
          .not('is_funnel_archived', 'is', true)
          .in('status', ['Sold', 'Closed'])
          .gte('updated_at', startOfTodayISO)
          .order('updated_at', { ascending: false })
          .limit(50); // Get more for "View All"

        if (user.role === 'Agent') {
          statusQuery = statusQuery.eq('assigned_to', user.id);
        }

        const { data: statusChanges } = await statusQuery;

        if (statusChanges) {
          statusChanges.forEach((lead: any) => {
            activities.push({
              id: `status-${lead.id}`,
              action: lead.status === 'Sold' ? 'Lead sold!' : 'Lead closed',
              lead: lead.name,
              time: formatTimeAgo(lead.updated_at),
              timestamp: new Date(lead.updated_at).getTime(),
              type: 'status'
            });
          });
        }

        // Sort all activities by timestamp (most recent first)
        activities.sort((a, b) => b.timestamp - a.timestamp);
        
        // Remove duplicates where same lead has multiple events close together (within 2 minutes)
        // Prioritize "New lead created" over "Quote sent" for the same lead
        const uniqueActivities: typeof activities = [];
        const seenLeadTimePairs = new Set<string>();
        
        activities.forEach(activity => {
          // Create a key based on lead name and time window (round to 2-minute intervals)
          const timeWindow = Math.floor(activity.timestamp / 120000) * 120000; // 2-minute window
          const key = `${activity.lead.toLowerCase()}-${timeWindow}`;
          
          if (seenLeadTimePairs.has(key)) {
            // Check if we should replace existing activity
            const existingIndex = uniqueActivities.findIndex(a => {
              const existingTimeWindow = Math.floor(a.timestamp / 120000) * 120000;
              return a.lead.toLowerCase() === activity.lead.toLowerCase() && 
                     existingTimeWindow === timeWindow;
            });
            
            if (existingIndex >= 0) {
              const existing = uniqueActivities[existingIndex];
              // Replace if current is "New lead created" and existing is "Quote sent"
              if (activity.action.includes('New lead') && existing.action.includes('Quote sent')) {
                uniqueActivities[existingIndex] = activity;
              }
              // Otherwise, skip this duplicate
            }
          } else {
            seenLeadTimePairs.add(key);
            uniqueActivities.push(activity);
          }
        });
        
        // Sort again
        uniqueActivities.sort((a, b) => b.timestamp - a.timestamp);
        
        // Store all activities for "View All" - always store the full list
        const allActivities = uniqueActivities.map(({ timestamp, ...rest }) => rest);
        setAllTodayActivity(removeNoisySystemUnknowns(allActivities as any));
        
        // Debug: Log the count
        if (import.meta.env.DEV) {
          console.log('Today\'s activities:', uniqueActivities.length, 'Show all:', showAllActivity);
        }
        
        // Show top preview activities, suppressing repetitive system-only noise.
        setRecentActivity(buildPreviewActivities(allActivities as any, showAllActivity));
        setIsLoadingActivity(false);
      } catch (err) {
        console.error('Error loading recent activity fallback:', err);
        // If fallback also fails, set empty arrays
        setAllTodayActivity([]);
        setRecentActivity([]);
        setIsLoadingActivity(false);
      }
    };

    if (user) {
      loadRecentActivity();
      // Refresh every 2 min, only when tab is visible (reduces Supabase CPU load)
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') loadRecentActivity();
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [user, showAllActivity]);

  // Role-based dashboard cards
  const getStatCards = () => {
    if (user?.role === 'Agent') {
      // Agents see only queues they can work or review.
      const assignedChange = calculateAbsoluteChange(stats.assignedLeads, previousStats.assignedLeads);
      const unassignedChange = calculateAbsoluteChange(stats.unassignedLeads, previousStats.unassignedLeads);
      const closedChange = calculateAbsoluteChange(stats.closedLeads, previousStats.closedLeads);

      return [
        {
          title: 'My Active Leads',
          value: stats.assignedLeads.toLocaleString(),
          icon: User,
          color: 'bg-blue-500',
          change: assignedChange.value,
          changeType: assignedChange.type,
          onClick: () => navigate('/lead-management?filter=assigned'),
        },
        {
          title: 'Available Leads',
          value: stats.unassignedLeads.toLocaleString(),
          icon: Users,
          color: 'bg-yellow-500',
          change: unassignedChange.value,
          changeType: unassignedChange.type,
          onClick: () => navigate('/lead-management?filter=unassigned'),
        },
        {
          title: 'Claimed Today',
          value: stats.claimedToday.toLocaleString(),
          icon: UserCheck,
          color: 'bg-green-500',
          change: 'Today',
          changeType: 'neutral' as const,
          onClick: () => navigate('/lead-management?stage=claimed-today'),
        },
        {
          title: 'My Closed Leads',
          value: stats.closedLeads.toLocaleString(),
          icon: CheckCircle,
          color: 'bg-purple-500',
          change: closedChange.value,
          changeType: closedChange.type,
          onClick: () => navigate('/lead-management?status=Closed,Sold&filter=assigned'),
        }
      ];
    } else {
      // Management sees full overview
      const newChange = calculateAbsoluteChange(stats.newLeads, previousStats.newLeads);
      const instructedChange = calculateAbsoluteChange(stats.instructedLeads, previousStats.instructedLeads);
      const unassignedChange = currentSnapshot();
      const callsChange = calculateAbsoluteChange(stats.totalCallsToday, stats.totalCallsYesterday);
      
      // 7-day conversion = manual instructed leads from leads created in the last 7 days / leads created in the last 7 days.
      const currentConversion = stats.leadsCreatedLast7Days > 0
        ? (stats.instructedFromLeadsCreatedLast7Days / stats.leadsCreatedLast7Days) * 100
        : 0;
      const previousConversion = previousStats.leadsCreatedLast7Days > 0
        ? (previousStats.instructedFromLeadsCreatedLast7Days / previousStats.leadsCreatedLast7Days) * 100
        : 0;
      const conversionChange = calculateChange(currentConversion, previousConversion);
      
      // Calculate monthly revenue change as percentage.
      const revenueChange = calculateChange(totalRevenue, previousRevenue);

      return [
        {
          title: 'Total Calls Today',
          value: stats.totalCallsToday.toLocaleString(),
          icon: Headphones,
          color: 'bg-blue-500',
          change: callsChange.value,
          changeType: callsChange.type,
          onClick: () => navigate('/call-analysis?preset=today'),
        },
        {
          title: 'New Leads Today',
          value: stats.newLeads.toLocaleString(),
          icon: UserCheck,
          color: 'bg-green-500',
          change: newChange.value,
          changeType: newChange.type,
          onClick: () => navigate('/lead-management?filterAge=New'),
        },
        {
          title: 'Unassigned Leads',
          value: stats.unassignedLeads.toLocaleString(),
          icon: AlertCircle,
          color: 'bg-yellow-500',
          change: unassignedChange.value,
          changeType: unassignedChange.type,
          onClick: () => navigate('/lead-management?filter=unassigned'),
          variant: 'attention',
          note: 'Needs attention',
        },
        {
          title: 'Instructions Today',
          value: stats.instructedLeads.toLocaleString(),
          icon: CheckCircle,
          color: 'bg-purple-500',
          change: instructedChange.value,
          changeType: instructedChange.type,
          onClick: () => navigate('/reports/instructions?preset=today'),
        },
        {
          title: '7-Day Conversion Rate',
          value: `${currentConversion.toFixed(1)}%`,
          icon: TrendingUp,
          color: 'bg-teal-500',
          change: conversionChange.value,
          changeType: conversionChange.type,
          onClick: () => navigate('/reports/instructions?dateBasis=lead_created'),
        },
        {
          title: 'Revenue This Month',
          value: `£${totalRevenue.toLocaleString()}`,
          icon: PoundSterling,
          color: 'bg-green-500',
          change: revenueChange.value,
          changeType: revenueChange.type,
          onClick: () => navigate('/payments'),
        },
      ];
    }
  };

  const statCards = getStatCards();

  // Quick action handlers
  const handleViewMyLeads = () => {
    navigate('/lead-management?filter=assigned');
  };

  const handleScheduleFollowups = () => {
    navigate('/diary?action=schedule');
  };

  const handleCreateQuote = () => {
    navigate('/quotes?action=create');
  };

  const handleViewUnassignedLeads = () => {
    navigate('/lead-management?filter=unassigned');
  };

  const handleViewTodaysInstructions = () => {
    navigate('/reports/instructions?preset=today');
  };

  const handleOpenInstructionReport = () => {
    navigate('/reports/instructions');
  };

  const handlePickUnassignedLead = () => {
    // Navigate to Lead Management with unassigned filter
    navigate('/lead-management?stage=unassigned');
  };

  return (
    <div className="space-y-6">
      {/* Assignment Feedback Toast */}
      {assignFeedback &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg pointer-events-auto ${
              assignFeedback.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            <span>{assignFeedback.message}</span>
          </div>,
          document.body
        )}

      <div data-hero="greeting">
        {user?.role && <span data-hero-pill="role">{user.role}</span>}
        <h1 className="text-2xl font-bold text-gray-900">
          Hi {(user?.name || '').trim().split(' ')[0] || 'there'}.
        </h1>
        <p className="text-gray-600">
          {user?.role === 'Agent'
            ? 'Welcome back. Here is your personal lead overview.'
            : 'Welcome back. Here is what is happening with your conveyancing leads.'}
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      )}

      {/* Stats Grid */}
      {!isLoading && (
        <>
        <div className={`grid grid-cols-1 gap-6 ${user?.role === 'Agent' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            if (stat.variant === 'attention') {
              return (
                <AttentionStatCard
                  key={index}
                  title={stat.title}
                  value={stat.value}
                  note={stat.note}
                  onClick={stat.onClick}
                />
              );
            }
            return (
              <div
                key={index} 
                onClick={stat.onClick}
                className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-gray-300 active:scale-[0.98]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    stat.onClick?.();
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium leading-5 text-gray-600">{stat.title}</p>
                    <p className="break-words text-2xl font-bold leading-8 text-gray-900">{stat.value}</p>
                  </div>
                  <div className="flex max-w-[7rem] flex-shrink-0 items-center justify-end gap-1 text-right">
                    {stat.changeType === 'positive' ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : stat.changeType === 'negative' ? (
                      <ArrowDown className="h-4 w-4 text-red-600" />
                    ) : null}
                    <span className={`text-xs font-medium leading-tight ${
                      stat.changeType === 'positive' ? 'text-green-600' : stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {user?.role !== 'Agent' && <DashboardTrends />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        {/* Recent Activity - Today's Activity */}
        <div className="card min-h-[320px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {user?.role === 'Agent' ? 'My Today\'s Activity' : 'Today\'s Activity'}
            </h3>
            {allTodayActivity.length > 0 && (
              <button
                onClick={() => setShowActivityModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View All ({allTodayActivity.length})
              </button>
            )}
          </div>
          <div className="space-y-2">
            {isLoadingActivity ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Loading activities...</p>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No activity today</p>
                <p className="text-xs mt-2">All activity from today will appear here</p>
              </div>
            ) : (
              <>
                {recentActivity.map((activity) => {
                  const activityWithLeadId = allTodayActivity.find(a => a.id === activity.id);
                  const leadId = activityWithLeadId?.leadId;
                  const leadData = leadId ? leadsMap.get(leadId) : null;
                  const displayAction = getActivityDisplayAction(activity.action, leadData?.source);
                  const isAssignmentActivity =
                    activity.type.includes('assignment') ||
                    activity.action.toLowerCase().includes('assigned');
                  const isUnassignedActivity =
                    activity.action.toLowerCase().includes('unassigned') ||
                    activity.action.toLowerCase().includes('dropped');
                  const shouldShowAssignmentChip = isAssignmentActivity || isUnassignedActivity;
                  const isAssigned = !!leadData?.assignedTo || isAssignmentActivity;

                  return (
                  <div key={activity.id} className="flex flex-col gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activity.type === 'assignment' ? 'bg-blue-500' :
                      activity.type === 'quote' ? 'bg-green-500' :
                      activity.type === 'payment' ? 'bg-purple-500' :
                      activity.type === 'status' ? 'bg-green-600' :
                      'bg-yellow-500'
                    } mt-1.5 sm:mt-0`} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                      <p className="break-words text-sm font-medium leading-5 text-gray-900" title={displayAction}>{displayAction}</p>
                          {shouldShowAssignmentChip && (
                            <span className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                              isAssigned
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {isAssigned ? 'Assigned' : 'Unassigned'}
                            </span>
                          )}
                        </div>
                      <p className="break-words text-sm leading-5 text-gray-600">{activity.lead}</p>
                    </div>
                    </div>
                      <div className="flex items-center justify-between gap-2 pl-5 sm:justify-end sm:pl-0">
                        {leadId && (
                          <>
                            <button
                              onClick={() => navigate(`/lead-management?leadId=${leadId}`)}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Lead"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {user?.role !== 'Agent' && !isAssigned && (
                              <button
                                onClick={() => {
                                  setSelectedLeadForAssign({ id: leadId, name: activity.lead });
                                  setShowAssignModal(true);
                                }}
                                className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Assign Lead"
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                        <div className="text-xs text-gray-500 whitespace-nowrap sm:text-sm">{activity.time}</div>
                  </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Agents keep Quick Actions; managers get the APCM AI digest when the
            preview flag is on, otherwise their original Quick Actions. */}
        {user?.role !== 'Agent' && APCM_AI_ENABLED ? (
          <ApcmAiDigestCard />
        ) : (
          <div className="card h-fit">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              <p className="mt-1 text-sm text-gray-500">Fast paths for the most common daily workflows.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {user?.role === 'Agent' ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#011E41] px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-[#022a5c] sm:col-span-2"
                    onClick={handlePickUnassignedLead}
                  >
                    <Hand className="h-5 w-5" />
                    <span>Pick Unassigned Lead</span>
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
                    onClick={handleViewMyLeads}
                  >
                    <Users className="h-4 w-4 text-blue-600" />
                    View My Active Leads
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
                    onClick={handleScheduleFollowups}
                  >
                    <Calendar className="h-4 w-4 text-amber-600" />
                    Schedule Follow-ups
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#011E41] px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-[#022a5c] sm:col-span-2"
                    onClick={handleViewUnassignedLeads}
                  >
                    <UserPlus className="h-4 w-4" />
                    View Unassigned Leads
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
                    onClick={handleViewTodaysInstructions}
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    View Today&apos;s Instructions
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
                    onClick={handleOpenInstructionReport}
                  >
                    <TrendingUp className="h-4 w-4 text-teal-600" />
                    Open Instructions Report
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                    onClick={handleCreateQuote}
                  >
                    <FileText className="h-4 w-4" />
                    Create New Quote
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
                    onClick={() => navigate('/settings?tab=users')}
                  >
                    <Settings className="h-4 w-4 text-gray-600" />
                    Team Settings
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Modal */}
      <ActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        activities={allTodayActivity.map((act) => ({
          id: act.id,
          action: act.action,
          lead: act.lead,
          time: act.time,
          type: act.type,
          doneBy: act.doneBy || 'System',
          doneByType: act.doneByType || 'system',
          timestamp: act.timestamp || 0,
          leadId: act.leadId,
        }))}
        leadsMap={leadsMap}
        userRole={user?.role}
        onActivityUpdate={async () => {
          // Refresh activities
          const activities = await fetchTodayActivities(user?.id, user?.role);
          const formattedActivities = activities.map(formatActivityForDisplay);
          const allActivities = mapAndDeduplicateActivities(formattedActivities);
          setAllTodayActivity(removeNoisySystemUnknowns(allActivities));
          setRecentActivity(buildPreviewActivities(allActivities, false));
          
          await refreshActivityLeadMap(allActivities);
        }}
        onAssignSuccess={(leadName, agentName) => {
          // Show success message for manager/admin
          if (user?.role === 'Manager' || user?.role === 'Admin') {
            setAssignFeedback({
              type: 'success',
              message: `Lead "${leadName}" has been successfully assigned to ${agentName}.`
            });
          }
        }}
        onAssignError={(message) => {
          setAssignFeedback({
            type: 'error',
            message
          });
        }}
      />

      {/* Assign Lead Modal */}
      <AssignLeadModal
        isOpen={showAssignModal}
        lead={selectedLeadForAssign ? { id: selectedLeadForAssign.id, name: selectedLeadForAssign.name } : null}
        onClose={() => {
                  setShowAssignModal(false);
                  setSelectedLeadForAssign(null);
                }}
        onSuccess={async (leadName, agentName) => {
          // Show success message for manager/admin
          if (user?.role === 'Manager' || user?.role === 'Admin') {
            setAssignFeedback({
              type: 'success',
              message: `Lead "${leadName}" has been successfully assigned to ${agentName}.`
            });
          }
          
          // Refresh activities to show updated assignment
          try {
            const activities = await fetchTodayActivities(user?.id, user?.role);
            const formattedActivities = activities.map(formatActivityForDisplay);
            const allActivities = mapAndDeduplicateActivities(formattedActivities);
            setAllTodayActivity(removeNoisySystemUnknowns(allActivities));
            setRecentActivity(buildPreviewActivities(allActivities, false));
            
            await refreshActivityLeadMap(allActivities);
          } catch (error) {
            console.error('Error refreshing activities:', error);
          }
        }}
        onError={(message) => {
                        setAssignFeedback({
                          type: 'error',
            message
          });
        }}
        onActivityUpdate={async () => {
          // Refresh activities when assignment updates
          try {
            const activities = await fetchTodayActivities(user?.id, user?.role);
            const formattedActivities = activities.map(formatActivityForDisplay);
            const allActivities = mapAndDeduplicateActivities(formattedActivities);
            setAllTodayActivity(removeNoisySystemUnknowns(allActivities));
            setRecentActivity(buildPreviewActivities(allActivities, false));
            
            await refreshActivityLeadMap(allActivities);
          } catch (error) {
            console.error('Error refreshing activities:', error);
          }
        }}
      />

      {/* Lead Status Overview - Only for Management */}
      {user?.role !== 'Agent' && (
        <div className="card">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pipeline Snapshot</h3>
              <p className="text-sm text-gray-500">Current lead volume and daily intake at a glance.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-600">Total Leads</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{stats.overallLeads.toLocaleString()}</div>
                </div>
                <Users className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-blue-700">New Today</div>
                  <div className="mt-1 text-2xl font-bold text-blue-700">{stats.newLeads.toLocaleString()}</div>
                </div>
                <UserCheck className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-amber-700">Assigned Active</div>
                  <div className="mt-1 text-2xl font-bold text-amber-700">{stats.activeLeads.toLocaleString()}</div>
                </div>
                <User className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-600">Unassigned Active</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{stats.unassignedLeads.toLocaleString()}</div>
                </div>
                <AlertCircle className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
