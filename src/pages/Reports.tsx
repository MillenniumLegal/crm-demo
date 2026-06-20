import React, { useState, useEffect, useCallback } from 'react';
import { Download, BarChart3, TrendingUp, Users, PoundSterling, Calendar, Clock, CheckCircle, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchOverviewReportViaRpc, fetchLeadQualityBreakdown, fetchDisqualifiedBreakdown, type OverviewReportResponse, type LeadQualityBreakdown, type DisqualifiedBreakdownRow, type DisqualifiedDimension, type DisqualifiedDateBasis } from '@/services/reportsService';
import { fetchAllLeadsForReport } from '@/services/leadsService';
import { fetchQuotes } from '@/services/quotesService';
import { fetchUsers } from '@/services/usersService';
import { fetchPayments } from '@/services/paymentsService';
import { Quote } from '@/services/quotesService';
import { Lead } from '@/types';
import { supabase } from '@/lib/supabase';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalDayStartIso = (dateYmd: string) => new Date(`${dateYmd}T00:00:00`).toISOString();

const toLocalDayEndExclusiveIso = (dateYmd: string) => {
  const end = new Date(`${dateYmd}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
};

/** Build lead filters for report range so we only fetch leads in range (faster than fetching all). */
const reportRangeLeadFilters = (start: string, end: string) => {
  return {
    createdAfter: toLocalDayStartIso(start),
    createdBefore: toLocalDayEndExclusiveIso(end),
  };
};

const reportRangeInstructionFilters = (start: string, end: string) => ({
  isManuallyInstructed: true,
  manualInstructedAfter: toLocalDayStartIso(start),
  manualInstructedBefore: toLocalDayEndExclusiveIso(end),
});

const hasManualInstruction = (lead: Lead) =>
  Boolean(lead.isManuallyInstructed && lead.manualInstructedAt);

const getInstructionAgentKey = (lead: Lead) =>
  lead.instructionCreditUserId || 'uncredited';

const getInstructionAgentName = (lead: Lead) =>
  lead.instructionCreditUserName || 'Uncredited';

const getInstructionUnitWeight = (lead: Lead) => {
  const transactionType = (lead.transactionType || '').toLowerCase();
  const purchasePosition = String((lead as any).whereThingsUpTo || '').trim();
  const salePosition = String((lead as any).whereThingsUpToSale || '').trim();

  const transactionMentionsBoth =
    (transactionType.includes('sale') && transactionType.includes('purchase'))
    || transactionType.includes('sale and purchase')
    || transactionType.includes('purchase and sale');

  const comparisonHasBothSides = Boolean(salePosition && (purchasePosition || transactionType.includes('purchase')));

  return transactionMentionsBoth || comparisonHasBothSides ? 2 : 1;
};

export const Reports: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReport, setSelectedReport] = useState('overview');
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'custom'>('today');
  const [range, setRange] = useState(() => {
    const today = new Date();
    const formatted = formatDate(today);
    return { start: formatted, end: formatted };
  });
  const [rangeInitialized, setRangeInitialized] = useState(false);
  const [rangeVersion, setRangeVersion] = useState(0);
  const { user } = useAuth();
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewReportResponse | null>(null);
  const [leadQuality, setLeadQuality] = useState<LeadQualityBreakdown | null>(null);
  const [disqualifiedRows, setDisqualifiedRows] = useState<DisqualifiedBreakdownRow[]>([]);
  const [disqDimension, setDisqDimension] = useState<DisqualifiedDimension>('source');
  const [disqDateBasis, setDisqDateBasis] = useState<DisqualifiedDateBasis>('lead_created');
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    topAgents: [] as Array<{ name: string; leads: number; conversions: number; revenue: number }>,
    monthlyTrends: [] as Array<{ month: string; leads: number; revenue: number }>,
  });
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [pipelineData, setPipelineData] = useState({
    userPipelines: [] as Array<{
      userName: string;
      stages: Record<string, number>;
      transactionTypes: Record<string, number>;
    }>,
    mostCommonStage: { stage: 'None', count: 0 },
    topTransactionType: { type: 'None', count: 0 },
    readyToSolicit: 0,
  });
  const [agentTaskCompletion, setAgentTaskCompletion] = useState<Array<{
    agentId: string;
    agentName: string;
    callStageCounts: {
      'Call-1': number;
      'Call-2': number;
      'Call-3': number;
      'Call-4': number;
      'Call-5': number;
    };
    tasksCompleted: number;
    tasksTotal: number;
    completionRate: number;
    callTasksCompleted: number;
    callTasksTotal: number;
    callCompletionRate: number;
  }>>([]);
  const [isLoadingLeadAnalysis, setIsLoadingLeadAnalysis] = useState(false);
  const [leadAnalysisData, setLeadAnalysisData] = useState({
    sourceBreakdown: [] as Array<{ source: string; count: number; percentage: number; conversionRate: number }>,
    statusBreakdown: [] as Array<{ status: string; count: number; percentage: number }>,
    ageDistribution: [] as Array<{ range: string; count: number; percentage: number }>,
    conversionFunnel: [] as Array<{ stage: string; count: number; percentage: number }>,
    topSources: [] as Array<{ source: string; count: number; conversionRate: number; avgAge: number }>,
    leadQuality: {
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      overdue: 0,
      avgContactAttempts: 0,
    },
    dailyTrends: [] as Array<{ date: string; leads: number; conversions: number }>,
  });
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
  const [revenueData, setRevenueData] = useState({
    totalRevenue: 0,
    totalQuotes: 0,
    acceptedQuotes: 0,
    pendingQuotes: 0,
    rejectedQuotes: 0,
    avgDealSize: 0,
    revenueByType: [] as Array<{ type: string; revenue: number; count: number; avgDeal: number }>,
    revenueByAgent: [] as Array<{ agent: string; revenue: number; quotes: number; conversionRate: number }>,
    monthlyRevenue: [] as Array<{ month: string; revenue: number; quotes: number; avgDeal: number }>,
    paymentStatus: {
      pending: 0,
      completed: 0,
      failed: 0,
    },
    topQuotes: [] as Array<{ leadName: string; amount: number; type: string; agent: string; date: string }>,
  });

  const computePresetRange = useCallback((preset: 'today' | 'yesterday' | 'last7' | 'last30') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (preset === 'today') {
      const start = new Date(today);
      const end = new Date(today);
      return { start: formatDate(start), end: formatDate(end) };
    }
    
    const end = new Date(today);
    const start = new Date(end);

    if (preset === 'yesterday') {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (preset === 'last7') {
      start.setDate(end.getDate() - 6);
    } else if (preset === 'last30') {
      start.setDate(end.getDate() - 29);
    }

    return { start: formatDate(start), end: formatDate(end) };
  }, []);

  const applyPresetRange = useCallback((preset: 'today' | 'yesterday' | 'last7' | 'last30') => {
    const nextRange = computePresetRange(preset);
    setRange(nextRange);
    setRangePreset(preset);
    setRangeInitialized(true);
    setRangeVersion((prev) => prev + 1);
  }, [computePresetRange]);

  const handleCustomRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    if (!value) return;
    setRange((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'start' && value > next.end) {
        next.end = value;
      } else if (field === 'end' && value < next.start) {
        next.start = value;
      }
      if (next.start === prev.start && next.end === prev.end) {
        return prev;
      }
      setRangeVersion((prevVersion) => prevVersion + 1);
      return next;
    });
    setRangePreset('custom');
    setRangeInitialized(true);
  }, []);

  // Handle URL parameters for report type
  useEffect(() => {
    const type = searchParams.get('type');
    if (type) {
      setSelectedReport(type);
    }
  }, [searchParams]);

  const buildFallbackOverview = useCallback(async (start: string, end: string): Promise<OverviewReportResponse> => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    const rangeStartMs = new Date(toLocalDayStartIso(start)).getTime();
    const rangeEndMs = new Date(toLocalDayEndExclusiveIso(end)).getTime();

    const [leadsGeneratedRaw, instructedLeadsRaw, allQuotesRaw] = await Promise.all([
      fetchAllLeadsForReport(reportRangeLeadFilters(start, end)),
      fetchAllLeadsForReport(reportRangeInstructionFilters(start, end)),
      fetchQuotes(),
    ]);

    const leadsGenerated = user?.role === 'Agent' && user.id
      ? leadsGeneratedRaw.filter(lead => lead.assignedTo === user.id)
      : leadsGeneratedRaw;

    const instructedLeadsInRange = user?.role === 'Agent' && user.id
      ? instructedLeadsRaw.filter(lead => lead.instructionCreditUserId === user.id)
      : instructedLeadsRaw;

    const allQuotes = user?.role === 'Agent' && user.id
      ? allQuotesRaw.filter(quote => leadsGenerated.some(lead => lead.id === quote.leadId))
      : allQuotesRaw;

    const isWithinRange = (value?: string | null) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return time >= rangeStartMs && time < rangeEndMs;
    };

    const instructedUnitsInRange = instructedLeadsInRange.reduce((sum, lead) => sum + getInstructionUnitWeight(lead), 0);
    const conversionRate = leadsGenerated.length > 0 ? Math.round((instructedUnitsInRange / leadsGenerated.length) * 1000) / 10 : 0;

    const leadsByTransactionMap = new Map<string, number>();
    leadsGenerated.forEach(lead => {
      const type = lead.transactionType || 'Unspecified';
      leadsByTransactionMap.set(type, (leadsByTransactionMap.get(type) || 0) + 1);
    });

    const leadsBySourceMap = new Map<string, { count: number }>();
    leadsGenerated.forEach(lead => {
      const source = lead.source || 'Unknown';
      if (!leadsBySourceMap.has(source)) {
        leadsBySourceMap.set(source, { count: 0 });
      }
      leadsBySourceMap.get(source)!.count += 1;
    });

    const leadsByStatusMap = new Map<string, { count: number }>();
    leadsGenerated.forEach(lead => {
      const status = lead.status || 'Unknown';
      if (!leadsByStatusMap.has(status)) {
        leadsByStatusMap.set(status, { count: 0 });
      }
      leadsByStatusMap.get(status)!.count += 1;
    });

    const leadsByTransaction = Array.from(leadsByTransactionMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const leadsBySource = Array.from(leadsBySourceMap.entries()).map(([source, { count }]) => ({
      source,
      count,
      percentage: leadsGenerated.length > 0 ? Math.round((count / leadsGenerated.length) * 1000) / 10 : 0,
    })).sort((a, b) => b.count - a.count);
    const leadsByStatus = Array.from(leadsByStatusMap.entries()).map(([status, { count }]) => ({
      status,
      count,
      percentage: leadsGenerated.length > 0 ? Math.round((count / leadsGenerated.length) * 1000) / 10 : 0,
    })).sort((a, b) => b.count - a.count);

    const agentPerformance = new Map<string, {
      agentId: string | null;
      agentName: string;
      leadsCreated: number;
      sales: number;
    }>();

    leadsGenerated.forEach(lead => {
      const key = lead.assignedTo || 'unassigned';
      if (!agentPerformance.has(key)) {
        agentPerformance.set(key, {
          agentId: lead.assignedTo || null,
          agentName: lead.assignedToName || (lead.assignedTo ? 'Agent' : 'Unassigned'),
          leadsCreated: 0,
          sales: 0,
        });
      }
      agentPerformance.get(key)!.leadsCreated += 1;
    });

    instructedLeadsInRange.forEach(lead => {
      const key = getInstructionAgentKey(lead);
      if (!agentPerformance.has(key)) {
        agentPerformance.set(key, {
          agentId: lead.instructionCreditUserId || null,
          agentName: getInstructionAgentName(lead),
          leadsCreated: 0,
          sales: 0,
        });
      }
      agentPerformance.get(key)!.sales += getInstructionUnitWeight(lead);
    });

    const salesByAgent = Array.from(agentPerformance.values())
      .map(agent => ({
        ...agent,
        conversionRate: agent.leadsCreated > 0 ? Math.round((agent.sales / agent.leadsCreated) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    const salesByLeadAgeMap = new Map<string, number>();
    const getAgeBucket = (days: number) => {
      if (days <= 0) return 'Same Day';
      if (days === 1) return '1 Day';
      if (days <= 3) return '2-3 Days';
      if (days <= 7) return '4-7 Days';
      if (days <= 14) return '8-14 Days';
      return '15+ Days';
    };

    instructedLeadsInRange.forEach(lead => {
      const saleDate = new Date(lead.manualInstructedAt || lead.createdAt);
      const created = new Date(lead.createdAt);
      const ageDays = Math.max(0, Math.floor((saleDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      const bucket = getAgeBucket(ageDays);
      salesByLeadAgeMap.set(bucket, (salesByLeadAgeMap.get(bucket) || 0) + getInstructionUnitWeight(lead));
    });

    const salesByLeadAge = Array.from(salesByLeadAgeMap.entries()).map(([bucket, count]) => ({ bucket, count })).sort((a, b) => b.count - a.count);

    const acceptedQuotes = allQuotes.filter(quote => {
      const acceptedAt = quote.acceptedAt || quote.updatedAt || quote.createdAt;
      return quote.status === 'Accepted' && isWithinRange(acceptedAt);
    });

    return {
      range: {
        start,
        end,
        startExclusive: start,
        endExclusive: end,
        days: Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1),
        timezone: 'Europe/London',
      },
      totals: {
        leadsGenerated: leadsGenerated.length,
        leadsSold: instructedUnitsInRange,
        conversionRate,
        leadsDeleted: 0,
        quotesAccepted: acceptedQuotes.length,
        paymentsCreated: 0,
        paymentsCompleted: 0,
      },
      leadsByTransaction,
      leadsBySource,
      leadsByStatus,
      salesByAgent,
      salesByLeadAge,
      deletedBreakdown: {
        byActor: [],
        byReason: [],
      },
      paymentsByStatus: [],
    };
  }, [user]);

  const loadOverview = useCallback(async (start: string, end: string) => {
    setIsLoadingOverview(true);
    setOverviewError(null);

    // Lead-quality "true numbers" — agents see their own, managers see all.
    const qualityAgentId = user?.role === 'Agent' ? (user.id || null) : null;
    fetchLeadQualityBreakdown({ startDate: start, endDate: end, agentId: qualityAgentId })
      .then(setLeadQuality)
      .catch(() => setLeadQuality(null));

    try {
      // Try fast DB RPC first (aggregates in DB, one small response)
      const rpcData = await fetchOverviewReportViaRpc({ startDate: start, endDate: end });
      if (rpcData) {
        setOverviewMetrics(rpcData);
        return;
      }
      // Fallback: client-side from paginated leads (slower but full data, no 1000 cap)
      const data = await buildFallbackOverview(start, end);
      setOverviewMetrics(data);
    } catch (error: any) {
      console.error('Error loading overview data:', error);
      setOverviewMetrics(null);
      setOverviewError(error?.message || 'Failed to load overview metrics.');
    } finally {
      setIsLoadingOverview(false);
    }
  }, [buildFallbackOverview, user]);

  // Fake/duplicate by source/campaign — refetches on range, dimension, or date-basis change.
  useEffect(() => {
    if (!range.start || !range.end) return;
    const agentId = user?.role === 'Agent' ? (user.id || null) : null;
    fetchDisqualifiedBreakdown({ startDate: range.start, endDate: range.end, dimension: disqDimension, dateBasis: disqDateBasis, agentId })
      .then(setDisqualifiedRows)
      .catch(() => setDisqualifiedRows([]));
  }, [range.start, range.end, disqDimension, disqDateBasis, user]);

  useEffect(() => {
    const presetParam = searchParams.get('preset');
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    const isPreset = (value: string | null): value is 'today' | 'yesterday' | 'last7' | 'last30' =>
      value === 'today' || value === 'yesterday' || value === 'last7' || value === 'last30';

    // If a preset is specified, always recompute the range to ensure it's fresh
    if (isPreset(presetParam)) {
      const nextRange = computePresetRange(presetParam);
      setRange(nextRange);
      setRangePreset(presetParam);
      setRangeInitialized(true);
      setRangeVersion((prev) => prev + 1);
      return;
    }

    // Otherwise, use explicit start/end dates if provided
    if (startParam && endParam) {
      setRange({ start: startParam, end: endParam });
      setRangePreset('custom');
      setRangeInitialized(true);
      setRangeVersion((prev) => prev + 1);
      return;
    }

    // No query params provided, keep defaults but mark ready so data loads
    setRangeInitialized(true);
    setRangeVersion((prev) => prev + 1);
  }, [searchParams, computePresetRange]);

  useEffect(() => {
    if (!rangeInitialized) return;
    loadOverview(range.start, range.end);
  }, [loadOverview, range.start, range.end, rangeInitialized, rangeVersion]);

  // Fetch performance data when performance tab is selected
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (selectedReport !== 'performance') return;
      
      setIsLoadingPerformance(true);
      try {
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        const rangeDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const leadFilters = reportRangeLeadFilters(range.start, range.end);
        const instructionFilters = reportRangeInstructionFilters(range.start, range.end);
        const [users, allLeads, instructedLeads, allQuotes] = await Promise.all([
          fetchUsers(),
          fetchAllLeadsForReport(leadFilters),
          fetchAllLeadsForReport(instructionFilters),
          fetchQuotes(),
        ]);

        const filteredLeads = allLeads.filter(lead => {
          const leadDate = formatDate(new Date(lead.createdAt));
          return leadDate >= startDateStr && leadDate <= endDateStr;
        });

        const filteredInstructions = instructedLeads.filter(lead => {
          if (!lead.manualInstructedAt) return false;
          const instructionDate = formatDate(new Date(lead.manualInstructedAt));
          return instructionDate >= startDateStr && instructionDate <= endDateStr;
        });

        const filteredQuotes = allQuotes.filter(quote => {
          const quoteDate = formatDate(new Date(quote.createdAt));
          return quoteDate >= startDateStr && quoteDate <= endDateStr && quote.status === 'Accepted';
        });

        const agentMap = new Map<string, {
          name: string;
          leads: number;
          conversions: number;
          revenue: number;
        }>();

        users.filter(u => u.role === 'Agent' && u.status === 'Active').forEach(agent => {
          agentMap.set(agent.id, {
            name: agent.name,
            leads: 0,
            conversions: 0,
            revenue: 0,
          });
        });

        filteredLeads.forEach(lead => {
          if (lead.assignedTo && agentMap.has(lead.assignedTo)) {
            const agent = agentMap.get(lead.assignedTo)!;
            agent.leads++;
          }
        });

        filteredInstructions.forEach(lead => {
          const creditUserId = lead.instructionCreditUserId || lead.assignedTo;
          if (creditUserId && agentMap.has(creditUserId)) {
            agentMap.get(creditUserId)!.conversions += getInstructionUnitWeight(lead);
          }
        });

        filteredQuotes.forEach((quote: Quote) => {
          const lead = filteredLeads.find((l: Lead) => l.id === quote.leadId);
          if (lead && lead.assignedTo && agentMap.has(lead.assignedTo)) {
            const agent = agentMap.get(lead.assignedTo)!;
            const revenue = (quote.totalIncVat ?? quote.totalAmount) ?? 0;
            agent.revenue += typeof revenue === 'number' ? revenue : 0;
          }
        });

        const topAgents = Array.from(agentMap.values())
          .filter(agent => agent.leads > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const monthMap = new Map<string, { leads: number; revenue: number }>();
        const months: string[] = [];
        for (let i = 0; i < rangeDays; i++) {
          const date = new Date(endDate);
          date.setDate(date.getDate() - i);
          const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (!months.includes(monthKey)) {
            months.unshift(monthKey);
            monthMap.set(monthKey, { leads: 0, revenue: 0 });
          }
        }

        filteredLeads.forEach(lead => {
          const leadDate = new Date(lead.createdAt);
          const monthKey = leadDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (monthMap.has(monthKey)) {
            monthMap.get(monthKey)!.leads++;
          }
        });

        filteredQuotes.forEach((quote: Quote) => {
          const quoteDate = new Date(quote.createdAt);
          const monthKey = quoteDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (monthMap.has(monthKey)) {
            const revenue = (quote.totalIncVat ?? quote.totalAmount) ?? 0;
            monthMap.get(monthKey)!.revenue += typeof revenue === 'number' ? revenue : 0;
          }
        });

        const monthlyTrends = Array.from(monthMap.entries())
          .map(([month, data]) => ({
            month,
            leads: data.leads,
            revenue: Math.round(data.revenue),
          }))
          .slice(-12);

        setPerformanceData({
          topAgents,
          monthlyTrends,
        });
      } catch (error) {
        console.error('Error loading performance data:', error);
      } finally {
        setIsLoadingPerformance(false);
      }
    };

    loadPerformanceData();
  }, [selectedReport, range.start, range.end]);

  // Fetch pipeline data when pipeline tab is selected
  useEffect(() => {
    const loadPipelineData = async () => {
      if (selectedReport !== 'pipeline') return;
      
      setIsLoadingPipeline(true);
      try {
        const leadFilters = reportRangeLeadFilters(range.start, range.end);
        const [users, allLeads] = await Promise.all([
          fetchUsers(),
          fetchAllLeadsForReport(leadFilters),
        ]);

        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const filteredLeads = allLeads.filter(lead => {
          const leadDate = formatDate(new Date(lead.createdAt));
          return leadDate >= startDateStr && leadDate <= endDateStr;
        });

        const allStages = [
          'New',
          'Call-1',
          'Call-2',
          'Call-3',
          'Call-4',
          'Call-5',
          'Interested',
          'Ready to Solicit',
          'Quote Accepted - Awaiting Payment',
          'Payment Completed - Awaiting Client Information',
          'Completed'
        ];
        const allTransactionTypes = ['Purchase', 'Sale', 'Remortgage', 'Remortgage Cashback', 'Transfer of Equity', 'Equity Release'];

        const userPipelineMap = new Map<string, {
          userName: string;
          stages: Record<string, number>;
          transactionTypes: Record<string, number>;
        }>();

        users.forEach(user => {
          userPipelineMap.set(user.id, {
            userName: user.name,
            stages: Object.fromEntries(allStages.map(s => [s, 0])),
            transactionTypes: Object.fromEntries(allTransactionTypes.map(t => [t, 0])),
          });
        });

        filteredLeads.forEach(lead => {
          if (lead.assignedTo && userPipelineMap.has(lead.assignedTo)) {
            const userPipeline = userPipelineMap.get(lead.assignedTo)!;
            
            if (lead.stage && Object.prototype.hasOwnProperty.call(userPipeline.stages, lead.stage)) {
              userPipeline.stages[lead.stage]++;
            }
            
            if (lead.transactionType && Object.prototype.hasOwnProperty.call(userPipeline.transactionTypes, lead.transactionType)) {
              userPipeline.transactionTypes[lead.transactionType]++;
            }
          }
        });

        const userPipelines = Array.from(userPipelineMap.values())
          .filter(userPipeline => {
            const totalLeads = Object.values(userPipeline.stages).reduce((sum, val) => sum + val, 0);
            return totalLeads > 0;
          });

        const stageCounts = new Map<string, number>();
        const transactionTypeCounts = new Map<string, number>();
        let readyToSolicitCount = 0;

        filteredLeads.forEach(lead => {
          if (lead.stage) {
            stageCounts.set(lead.stage, (stageCounts.get(lead.stage) || 0) + 1);
          }
          
          if (lead.transactionType) {
            transactionTypeCounts.set(lead.transactionType, (transactionTypeCounts.get(lead.transactionType) || 0) + 1);
          }
          
          if (lead.stage === 'Ready to Solicit') {
            readyToSolicitCount++;
          }
        });

        let mostCommonStage = { stage: 'None', count: 0 };
        stageCounts.forEach((count, stage) => {
          if (count > mostCommonStage.count) {
            mostCommonStage = { stage, count };
          }
        });

        let topTransactionType = { type: 'None', count: 0 };
        transactionTypeCounts.forEach((count, type) => {
          if (count > topTransactionType.count) {
            topTransactionType = { type, count };
          }
        });

        setPipelineData({
          userPipelines,
          mostCommonStage,
          topTransactionType,
          readyToSolicit: readyToSolicitCount,
        });
      } catch (error) {
        console.error('Error loading pipeline data:', error);
      } finally {
        setIsLoadingPipeline(false);
      }
    };

    loadPipelineData();
  }, [selectedReport, range.start, range.end]);

  // Load lead analysis data when lead analysis tab is selected
  useEffect(() => {
    const loadLeadAnalysis = async () => {
      if (selectedReport !== 'leads' || !rangeInitialized) return;
      
      setIsLoadingLeadAnalysis(true);
      try {
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        endDate.setHours(23, 59, 59, 999);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const leadFilters = reportRangeLeadFilters(range.start, range.end);
        const allLeads = await fetchAllLeadsForReport(leadFilters);
        const filteredLeads = allLeads.filter(lead => {
          const leadDate = formatDate(new Date(lead.createdAt));
          return leadDate >= startDateStr && leadDate <= endDateStr;
        });

        // Source breakdown with conversion rates
        const sourceMap = new Map<string, { count: number; sold: number }>();
        filteredLeads.forEach(lead => {
          const source = lead.source || 'Unknown';
          if (!sourceMap.has(source)) {
            sourceMap.set(source, { count: 0, sold: 0 });
          }
          const data = sourceMap.get(source)!;
          data.count++;
          if (hasManualInstruction(lead)) {
            data.sold++;
          }
        });

        const sourceBreakdown = Array.from(sourceMap.entries())
          .map(([source, data]) => ({
            source,
            count: data.count,
            percentage: filteredLeads.length > 0 ? Math.round((data.count / filteredLeads.length) * 1000) / 10 : 0,
            conversionRate: data.count > 0 ? Math.round((data.sold / data.count) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count);

        // Status breakdown
        const statusMap = new Map<string, number>();
        filteredLeads.forEach(lead => {
          const status = lead.status || 'Unknown';
          statusMap.set(status, (statusMap.get(status) || 0) + 1);
        });

        const statusBreakdown = Array.from(statusMap.entries())
          .map(([status, count]) => ({
            status,
            count,
            percentage: filteredLeads.length > 0 ? Math.round((count / filteredLeads.length) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count);

        // Age distribution
        const ageRanges = [
          { label: '0-6 hours', min: 0, max: 6 },
          { label: '6-12 hours', min: 6, max: 12 },
          { label: '12-24 hours', min: 12, max: 24 },
          { label: '1-3 days', min: 24, max: 72 },
          { label: '3-7 days', min: 72, max: 168 },
          { label: '7+ days', min: 168, max: Infinity },
        ];

        const ageMap = new Map<string, number>();
        filteredLeads.forEach(lead => {
          const ageHours = lead.ageInHours || 0;
          const range = ageRanges.find(r => ageHours >= r.min && ageHours < r.max)?.label || '7+ days';
          ageMap.set(range, (ageMap.get(range) || 0) + 1);
        });

        const ageDistribution = ageRanges
          .map(range => ({
            range: range.label,
            count: ageMap.get(range.label) || 0,
            percentage: filteredLeads.length > 0 ? Math.round(((ageMap.get(range.label) || 0) / filteredLeads.length) * 1000) / 10 : 0,
          }))
          .filter(item => item.count > 0);

        // Conversion funnel (by stage)
        const stageOrder = ['New', 'Call-1', 'Call-2', 'Call-3', 'Call-4', 'Call-5', 'Interested', 'Ready to Solicit', 'Quote Accepted - Awaiting Payment', 'Payment Completed - Awaiting Client Information', 'Completed'];
        const stageMap = new Map<string, number>();
        filteredLeads.forEach(lead => {
          const stage = lead.stage || 'New';
          stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
        });

        const conversionFunnel = stageOrder
          .map(stage => ({
            stage,
            count: stageMap.get(stage) || 0,
            percentage: filteredLeads.length > 0 ? Math.round(((stageMap.get(stage) || 0) / filteredLeads.length) * 1000) / 10 : 0,
          }))
          .filter(item => item.count > 0);

        // Top sources with metrics
        const topSources = sourceBreakdown.slice(0, 5).map(source => {
          const sourceLeads = filteredLeads.filter(l => (l.source || 'Unknown') === source.source);
          const avgAge = sourceLeads.length > 0
            ? sourceLeads.reduce((sum, l) => sum + (l.ageInHours || 0), 0) / sourceLeads.length
            : 0;
          return {
            ...source,
            avgAge: Math.round(avgAge * 10) / 10,
          };
        });

        // Lead quality metrics
        const leadQuality = {
          highPriority: filteredLeads.filter(l => l.priority === 'High').length,
          mediumPriority: filteredLeads.filter(l => l.priority === 'Medium').length,
          lowPriority: filteredLeads.filter(l => l.priority === 'Low').length,
          overdue: filteredLeads.filter(l => l.isOverdue).length,
          avgContactAttempts: filteredLeads.length > 0
            ? Math.round((filteredLeads.reduce((sum, l) => sum + (l.contactAttempts || 0), 0) / filteredLeads.length) * 10) / 10
            : 0,
        };

        // Daily trends
        const dailyMap = new Map<string, { leads: number; conversions: number }>();
        filteredLeads.forEach(lead => {
          const date = formatDate(new Date(lead.createdAt));
          if (!dailyMap.has(date)) {
            dailyMap.set(date, { leads: 0, conversions: 0 });
          }
          const data = dailyMap.get(date)!;
          data.leads++;
          if (hasManualInstruction(lead)) {
            data.conversions++;
          }
        });

        const dailyTrends = Array.from(dailyMap.entries())
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setLeadAnalysisData({
          sourceBreakdown,
          statusBreakdown,
          ageDistribution,
          conversionFunnel,
          topSources,
          leadQuality,
          dailyTrends,
        });
      } catch (error) {
        console.error('Error loading lead analysis:', error);
      } finally {
        setIsLoadingLeadAnalysis(false);
      }
    };

    loadLeadAnalysis();
  }, [selectedReport, range.start, range.end, rangeInitialized]);

  // Load agent pipeline & completion data when agent-pipeline tab is selected
  useEffect(() => {
    const loadAgentPipelineData = async () => {
      if (selectedReport !== 'agent-pipeline' || !rangeInitialized) return;
      
      setIsLoadingPipeline(true);
      try {
        const startDateISO = toLocalDayStartIso(range.start);
        const endDateISOStr = toLocalDayEndExclusiveIso(range.end);

        const leadFilters = reportRangeLeadFilters(range.start, range.end);
        const [users, currentLeads] = await Promise.all([
          fetchUsers(),
          fetchAllLeadsForReport(leadFilters),
        ]);
        
        // Get completed tasks from tasks table
        const tasksData = await supabase
          .from('diary_tasks')
          .select('id, assigned_to, status, completed_at, task_type, title')
          .eq('status', 'Completed')
          .gte('completed_at', startDateISO)
          .lt('completed_at', endDateISOStr);

        // Get all tasks assigned to agents (for completion rate calculation)
        const allTasksData = await supabase
          .from('diary_tasks')
          .select('id, assigned_to, status, task_type, title, due_date, completed_at')
          .not('assigned_to', 'is', null);

        const tasks = tasksData.data || [];
        const allTasks = allTasksData.data || [];

        // Build agent task completion map
        const agentCompletionMap = new Map<string, {
          agentId: string;
          agentName: string;
          callStageCounts: { 'Call-1': number; 'Call-2': number; 'Call-3': number; 'Call-4': number; 'Call-5': number };
          tasksCompleted: number;
          tasksTotal: number;
          callTasksCompleted: number;
          callTasksTotal: number;
        }>();

        // Initialize with all agents
        users.forEach(user => {
          agentCompletionMap.set(user.id, {
            agentId: user.id,
            agentName: user.name,
            callStageCounts: { 'Call-1': 0, 'Call-2': 0, 'Call-3': 0, 'Call-4': 0, 'Call-5': 0 },
            tasksCompleted: 0,
            tasksTotal: 0,
            callTasksCompleted: 0,
            callTasksTotal: 0,
          });
        });

        // Count leads by stage for each agent (current pipeline status)
        currentLeads.forEach(lead => {
          if (lead.assignedTo && lead.stage && lead.stage.startsWith('Call-')) {
            const agent = agentCompletionMap.get(lead.assignedTo);
            if (agent && (lead.stage === 'Call-1' || lead.stage === 'Call-2' || lead.stage === 'Call-3' || lead.stage === 'Call-4' || lead.stage === 'Call-5')) {
              agent.callStageCounts[lead.stage as 'Call-1' | 'Call-2' | 'Call-3' | 'Call-4' | 'Call-5']++;
            }
          }
        });

        // Count completed tasks by agent
        tasks.forEach(task => {
          if (task.assigned_to) {
            const agent = agentCompletionMap.get(task.assigned_to);
            if (agent) {
              agent.tasksCompleted++;
              if (task.task_type === 'Call') {
                agent.callTasksCompleted++;
              }
            }
          }
        });

        // Count total tasks by agent (for completion rate)
        allTasks.forEach(task => {
          if (task.assigned_to) {
            const agent = agentCompletionMap.get(task.assigned_to);
            if (agent) {
              agent.tasksTotal++;
              if (task.task_type === 'Call') {
                agent.callTasksTotal++;
              }
            }
          }
        });

        // Calculate completion rates and format data
        const agentCompletionData = Array.from(agentCompletionMap.values())
          .map(agent => ({
            ...agent,
            completionRate: agent.tasksTotal > 0 ? Math.round((agent.tasksCompleted / agent.tasksTotal) * 1000) / 10 : 0,
            callCompletionRate: agent.callTasksTotal > 0 ? Math.round((agent.callTasksCompleted / agent.callTasksTotal) * 1000) / 10 : 0,
          }))
          .filter(agent => {
            // Only show agents with leads in pipeline or completed tasks
            const hasPipelineLeads = Object.values(agent.callStageCounts).some(count => count > 0);
            const hasCompletedTasks = agent.tasksCompleted > 0;
            return hasPipelineLeads || hasCompletedTasks;
          })
          .sort((a, b) => {
            // Sort by total pipeline leads (descending)
            const aTotal = Object.values(a.callStageCounts).reduce((sum, count) => sum + count, 0);
            const bTotal = Object.values(b.callStageCounts).reduce((sum, count) => sum + count, 0);
            return bTotal - aTotal;
          });

        setAgentTaskCompletion(agentCompletionData);
      } catch (error) {
        console.error('Error loading agent pipeline data:', error);
      } finally {
        setIsLoadingPipeline(false);
      }
    };

    loadAgentPipelineData();
  }, [selectedReport, range.start, range.end, rangeInitialized]);

  // Load revenue data when revenue tab is selected
  useEffect(() => {
    const loadRevenueData = async () => {
      if (selectedReport !== 'revenue' || !rangeInitialized) return;
      
      setIsLoadingRevenue(true);
      try {
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        endDate.setHours(23, 59, 59, 999);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        const startDateISO = toLocalDayStartIso(range.start);
        const endDateISO = toLocalDayEndExclusiveIso(range.end);

        const [allPayments, allQuotes, allLeads, users] = await Promise.all([
          fetchPayments({ fromDate: startDateISO, toDate: endDateISO }),
          fetchQuotes(),
          fetchAllLeadsForReport({}), // Revenue needs all leads for payment->lead lookup (payments can reference older leads)
          fetchUsers(),
        ]);

        // Filter payments by status = 'paid' and date range (using paidAt)
        const paidPayments = allPayments.filter(payment => {
          const status = payment.status?.toLowerCase();
          if (status !== 'paid') return false;
          
          // Filter by paidAt date if available, otherwise use issuedAt
          const paymentDate = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.issuedAt);
          const paymentDateStr = formatDate(paymentDate);
          return paymentDateStr >= startDateStr && paymentDateStr <= endDateStr;
        });

        // Calculate totals from paid payments
        const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Get quote counts for display (still useful for context)
        const filteredQuotes = allQuotes.filter(quote => {
          const quoteDate = formatDate(new Date(quote.createdAt));
          return quoteDate >= startDateStr && quoteDate <= endDateStr;
        });
        const acceptedQuotes = filteredQuotes.filter(q => q.status === 'Accepted');
        const pendingQuotes = filteredQuotes.filter(q => q.status === 'Sent' || q.status === 'Draft');
        const rejectedQuotes = filteredQuotes.filter(q => q.status === 'Rejected' || q.status === 'Expired');

        const avgDealSize = paidPayments.length > 0
          ? Math.round((totalRevenue / paidPayments.length) * 100) / 100
          : 0;

        // Revenue by transaction type (from paid payments)
        const typeMap = new Map<string, { revenue: number; count: number }>();
        paidPayments.forEach(payment => {
          const lead = allLeads.find(l => l.id === payment.leadId);
          const type = lead?.transactionType || 'Unknown';
          const amount = payment.amount || 0;
          if (!typeMap.has(type)) {
            typeMap.set(type, { revenue: 0, count: 0 });
          }
          const data = typeMap.get(type)!;
          data.revenue += amount;
          data.count++;
        });

        const revenueByType = Array.from(typeMap.entries())
          .map(([type, data]) => ({
            type,
            revenue: Math.round(data.revenue * 100) / 100,
            count: data.count,
            avgDeal: data.count > 0 ? Math.round((data.revenue / data.count) * 100) / 100 : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        // Revenue by agent (from paid payments)
        const agentMap = new Map<string, { revenue: number; payments: number; leads: number }>();
        const agentNameMap = new Map<string, string>();
        users.forEach(u => agentNameMap.set(u.id, u.name));

        paidPayments.forEach(payment => {
          const lead = allLeads.find(l => l.id === payment.leadId);
          if (lead?.assignedTo) {
            const agentId = lead.assignedTo;
            if (!agentMap.has(agentId)) {
              agentMap.set(agentId, { revenue: 0, payments: 0, leads: 0 });
            }
            const data = agentMap.get(agentId)!;
            data.revenue += payment.amount || 0;
            data.payments++;
            if (lead) data.leads++;
          }
        });

        const revenueByAgent = Array.from(agentMap.entries())
          .map(([agentId, data]) => ({
            agent: agentNameMap.get(agentId) || 'Unknown',
            revenue: Math.round(data.revenue * 100) / 100,
            quotes: data.payments, // Using payments count instead of quotes
            conversionRate: data.leads > 0 ? Math.round((data.payments / data.leads) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        // Monthly revenue trends (from paid payments)
        const monthMap = new Map<string, { revenue: number; payments: number }>();
        paidPayments.forEach(payment => {
          const date = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.issuedAt);
          const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { revenue: 0, payments: 0 });
          }
          const data = monthMap.get(monthKey)!;
          data.revenue += payment.amount || 0;
          data.payments++;
        });

        const monthlyRevenue = Array.from(monthMap.entries())
          .map(([month, data]) => ({
            month,
            revenue: Math.round(data.revenue * 100) / 100,
            quotes: data.payments, // Using payments count instead of quotes
            avgDeal: data.payments > 0 ? Math.round((data.revenue / data.payments) * 100) / 100 : 0,
          }))
          .sort((a, b) => {
            const dateA = new Date(a.month);
            const dateB = new Date(b.month);
            return dateA.getTime() - dateB.getTime();
          });

        // Payment status (from payment links)
        const allPaymentsInRange = allPayments.filter(payment => {
          const paymentDate = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.issuedAt);
          const paymentDateStr = formatDate(paymentDate);
          return paymentDateStr >= startDateStr && paymentDateStr <= endDateStr;
        });
        
        const paymentStatus = {
          pending: allPaymentsInRange.filter(p => p.status?.toLowerCase() === 'pending' || p.status?.toLowerCase() === 'sent').length,
          completed: paidPayments.length,
          failed: allPaymentsInRange.filter(p => p.status?.toLowerCase() === 'failed' || p.status?.toLowerCase() === 'cancelled').length,
        };

        // Top payments (by amount paid)
        const topQuotes = paidPayments
          .map(payment => {
            const lead = allLeads.find(l => l.id === payment.leadId);
            return {
              leadName: lead?.name || payment.leadName || 'Unknown',
              amount: payment.amount || 0,
              type: lead?.transactionType || 'Unknown',
              agent: lead?.assignedToName || 'Unassigned',
              date: formatDate(payment.paidAt ? new Date(payment.paidAt) : new Date(payment.issuedAt)),
            };
          })
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        setRevenueData({
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalQuotes: paidPayments.length, // Count of paid payments
          acceptedQuotes: acceptedQuotes.length,
          pendingQuotes: pendingQuotes.length,
          rejectedQuotes: rejectedQuotes.length,
          avgDealSize,
          revenueByType,
          revenueByAgent,
          monthlyRevenue,
          paymentStatus,
          topQuotes,
        });
      } catch (error) {
        console.error('Error loading revenue data:', error);
      } finally {
        setIsLoadingRevenue(false);
      }
    };

    loadRevenueData();
  }, [selectedReport, range.start, range.end, rangeInitialized]);

  // Mock data for other reports (to be implemented later)
  const reportTypes = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'performance', name: 'Performance', icon: TrendingUp },
    { id: 'leads', name: 'Lead Analysis', icon: Users },
    { id: 'pipeline', name: 'Pipeline & Transactions', icon: TrendingUp },
    { id: 'agent-pipeline', name: 'Agent Pipeline & Completion', icon: Users },
    { id: 'revenue', name: 'Revenue Report', icon: PoundSterling },
  ];

  useEffect(() => {
    if (!rangeInitialized) return;
    const currentStart = searchParams.get('startDate');
    const currentEnd = searchParams.get('endDate');
    const currentPreset = searchParams.get('preset');

    if (currentStart === range.start && currentEnd === range.end && currentPreset === rangePreset) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('startDate', range.start);
    nextParams.set('endDate', range.end);
    nextParams.set('preset', rangePreset);
    setSearchParams(nextParams, { replace: true });
  }, [rangeInitialized, range.start, range.end, rangePreset, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Reports</h1>
          <p className="text-gray-600">Pipeline and revenue reporting for your CRM</p>
        </div>
        <div className="flex space-x-2">
          <button 
            type="button"
            disabled
            title="Export coming in reporting update"
            className="btn-secondary flex items-center space-x-2 opacity-60 cursor-not-allowed"
          >
            <Download className="h-5 w-5" />
            <span>Export CSV</span>
          </button>
          <button 
            type="button"
            disabled
            title="Export coming in reporting update"
            className="btn-primary flex items-center space-x-2 opacity-60 cursor-not-allowed"
          >
            <Download className="h-5 w-5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Pipeline and revenue reporting. For instruction dates, credited agents, source, campaign, and keyword reporting, use{' '}
        <Link to="/reports/instructions" className="font-semibold underline">
          Instructions Report
        </Link>
        .
      </div>

      {/* Report Type Selector */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                  selectedReport === report.id
                    ? 'bg-navy-100 text-navy-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{report.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="font-medium">Reporting window:</span>
            <span className="text-gray-600">
              {range.start} to {range.end}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPresetRange('today')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                rangePreset === 'today'
                  ? 'bg-navy-600 text-white border-navy-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => applyPresetRange('yesterday')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                rangePreset === 'yesterday'
                  ? 'bg-navy-600 text-white border-navy-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => applyPresetRange('last7')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                rangePreset === 'last7'
                  ? 'bg-navy-600 text-white border-navy-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => applyPresetRange('last30')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                rangePreset === 'last30'
                  ? 'bg-navy-600 text-white border-navy-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Last 30 days
            </button>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="date"
                value={range.start}
                onChange={(e) => handleCustomRangeChange('start', e.target.value)}
                className="input-field"
              />
              <span>to</span>
              <input
                type="date"
                value={range.end}
                onChange={(e) => handleCustomRangeChange('end', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overview Report */}
      {selectedReport === 'overview' && (
        <div className="space-y-6">
          {isLoadingOverview ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading report data...</p>
            </div>
          ) : (
            <>
              {overviewError && (
                <div className="card border border-red-200 bg-red-50 text-red-700 text-sm">
                  {overviewError}
                </div>
              )}
              {overviewMetrics && (
            <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
                      <div className="text-3xl font-bold text-gray-900">
                        {overviewMetrics.totals.leadsGenerated.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Leads Generated</div>
            </div>
            <div className="card text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {overviewMetrics.totals.leadsSold.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Instructions</div>
            </div>
            <div className="card text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {overviewMetrics.totals.conversionRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Conversion Rate</div>
            </div>
            <div className="card text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {overviewMetrics.totals.quotesAccepted.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Quotes Accepted</div>
            </div>
          </div>

                  {/* Lead Quality — true numbers (total vs genuine vs junk) */}
                  {leadQuality && leadQuality.available && (
                    <div className="card">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Lead Quality</h3>
                          <p className="text-sm text-gray-500">
                            True numbers for this period — genuine leads after fake, duplicate and junk are removed.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                        <div className="rounded-lg bg-gray-50 p-4 text-center">
                          <div className="text-2xl font-bold tabular-nums text-gray-900">{leadQuality.totalLeads.toLocaleString()}</div>
                          <div className="mt-1 text-xs font-medium text-gray-600">Total leads</div>
                        </div>
                        <div className="rounded-lg bg-green-50 p-4 text-center">
                          <div className="text-2xl font-bold tabular-nums text-green-700">{leadQuality.genuine.toLocaleString()}</div>
                          <div className="mt-1 text-xs font-medium text-green-700">Genuine</div>
                        </div>
                        <div className="rounded-lg bg-red-50 p-4 text-center">
                          <div className="text-2xl font-bold tabular-nums text-red-700">{leadQuality.fake.toLocaleString()}</div>
                          <div className="mt-1 text-xs font-medium text-red-700">Fake</div>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-4 text-center">
                          <div className="text-2xl font-bold tabular-nums text-orange-700">{leadQuality.duplicate.toLocaleString()}</div>
                          <div className="mt-1 text-xs font-medium text-orange-700">Duplicate</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-4 text-center">
                          <div className="text-2xl font-bold tabular-nums text-amber-700">{(leadQuality.wrongNumber + leadQuality.test).toLocaleString()}</div>
                          <div className="mt-1 text-xs font-medium text-amber-700">Wrong no. / test</div>
                        </div>
                      </div>
                      {leadQuality.disqualified > 0 && (
                        <p className="mt-3 text-xs text-gray-500">
                          {leadQuality.disqualified.toLocaleString()} of {leadQuality.totalLeads.toLocaleString()} leads were marked as junk and removed from agent quotas.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Fake / duplicate by source or campaign */}
                  {disqualifiedRows.length > 0 && (
                    <div className="card">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Fake / duplicate by {disqDimension === 'campaign' ? 'campaign' : 'source'}</h3>
                          <p className="text-sm text-gray-500">Where the junk is coming from — for marketing quality.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="inline-flex rounded-md border border-gray-200 p-0.5">
                            {(['source', 'campaign'] as const).map((dim) => (
                              <button
                                key={dim}
                                type="button"
                                onClick={() => setDisqDimension(dim)}
                                className={`rounded px-2.5 py-1 text-xs font-medium ${disqDimension === dim ? 'bg-navy-950 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                              >
                                {dim === 'source' ? 'Source' : 'Campaign'}
                              </button>
                            ))}
                          </div>
                          <select
                            value={disqDateBasis}
                            onChange={(e) => setDisqDateBasis(e.target.value as DisqualifiedDateBasis)}
                            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs focus:border-navy-950 focus:outline-none focus:ring-1 focus:ring-navy-950"
                            title="Which date the report counts by"
                          >
                            <option value="lead_created">Leads created in period</option>
                            <option value="disqualified_date">Marked junk in period</option>
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                              <th className="py-2 pr-3 font-medium">{disqDimension === 'campaign' ? 'Campaign' : 'Source'}</th>
                              <th className="px-3 py-2 text-right font-medium">Total</th>
                              <th className="px-3 py-2 text-right font-medium">Fake</th>
                              <th className="px-3 py-2 text-right font-medium">Duplicate</th>
                              <th className="px-3 py-2 text-right font-medium">Wrong no.</th>
                              <th className="px-3 py-2 text-right font-medium">Test</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {disqualifiedRows.map((row, index) => (
                              <tr key={`${row.dimensionValue}-${index}`}>
                                <td className="py-2 pr-3 text-gray-900">
                                  {disqDimension === 'campaign' && row.campaignName
                                    ? <>{row.campaignName}{row.campaignId ? <span className="text-gray-400"> ({row.campaignId})</span> : null}</>
                                    : row.dimensionValue}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{row.total.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-red-700">{row.fake.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-orange-700">{row.duplicate.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-700">{row.wrongNumber.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{row.test.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Lead Acquisition Insights */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Mix</h3>
                      {overviewMetrics.leadsByTransaction.length > 0 ? (
              <div className="space-y-3">
                          {overviewMetrics.leadsByTransaction.map((item: { type: string; count: number }, index: number) => (
                            <div key={`${item.type}-${index}`} className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{item.type}</span>
                              <span className="text-sm text-gray-600">{item.count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No leads recorded for this period</p>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sources</h3>
                      {overviewMetrics.leadsBySource.length > 0 ? (
                        <div className="space-y-3">
                          {overviewMetrics.leadsBySource.map((item: { source: string; count: number; percentage: number }, index: number) => (
                            <div key={`${item.source}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                                <span className="inline-flex h-3 w-3 rounded-full bg-navy-500" />
                      <span className="text-sm font-medium text-gray-900">{item.source}</span>
                    </div>
                    <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">{item.count.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
                  ) : (
                        <p className="text-gray-500 text-sm">No lead sources recorded for this period</p>
                  )}
                    </div>
            </div>

                  {/* Instruction Performance */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructions by Credited Agent</h3>
                      {overviewMetrics.salesByAgent.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="table-header">Agent</th>
                                <th className="table-header">Leads Created</th>
                                <th className="table-header">Instructions</th>
                                <th className="table-header">Conversion</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {overviewMetrics.salesByAgent.map((agent: { agentId: string | null; agentName: string; leadsCreated: number; sales: number; conversionRate: number }, index: number) => (
                                <tr key={`${agent.agentId || 'unassigned'}-${index}`}>
                                  <td className="table-cell font-medium text-gray-900">{agent.agentName}</td>
                                  <td className="table-cell">{agent.leadsCreated.toLocaleString()}</td>
                                  <td className="table-cell">{agent.sales.toLocaleString()}</td>
                                  <td className="table-cell">{agent.conversionRate.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No agent instructions recorded for this period</p>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Instruction Velocity</h3>
                      {overviewMetrics.salesByLeadAge.length > 0 ? (
              <div className="space-y-3">
                          {overviewMetrics.salesByLeadAge.map((item: { bucket: string; count: number }) => (
                            <div key={item.bucket} className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{item.bucket}</span>
                              <span className="text-sm text-gray-600">{item.count.toLocaleString()}</span>
                    </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No manual instructions in this period</p>
                      )}
                    </div>
                  </div>

                  {/* Lead Status & Payments */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status Snapshot</h3>
                      {overviewMetrics.leadsByStatus.length > 0 ? (
                        <div className="space-y-3">
                          {overviewMetrics.leadsByStatus.map((item: { status: string; count: number; percentage: number }, index: number) => (
                            <div key={`${item.status}-${index}`} className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{item.status}</span>
                    <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">{item.count.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
                  ) : (
                        <p className="text-gray-500 text-sm">No status updates for this period</p>
                  )}
            </div>

                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Payments</h3>
                      {overviewMetrics.paymentsByStatus.length > 0 ? (
                        <div className="space-y-3">
                          {overviewMetrics.paymentsByStatus.map((item: { status: string; count: number }) => (
                            <div key={item.status} className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 capitalize">{item.status}</span>
                              <span className="text-sm text-gray-600">{item.count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No payment activity recorded</p>
                      )}
                    </div>
                  </div>

                  {/* Data Hygiene */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Hygiene (Lead Deletes)</h3>
                    {overviewMetrics.totals.leadsDeleted > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">By Team Member</h4>
                          <div className="space-y-2">
                            {overviewMetrics.deletedBreakdown.byActor.map((entry: { actor: string; count: number }) => (
                              <div key={entry.actor} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{entry.actor}</span>
                                <span className="font-medium text-gray-900">{entry.count.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">By Reason</h4>
                          <div className="space-y-2">
                            {overviewMetrics.deletedBreakdown.byReason.map((entry: { reason: string; count: number }) => (
                              <div key={entry.reason} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{entry.reason}</span>
                                <span className="font-medium text-gray-900">{entry.count.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No lead deletions during this period</p>
                    )}
          </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Performance Report */}
      {selectedReport === 'performance' && (
        <div className="space-y-6">
          {isLoadingPerformance ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading performance data...</p>
            </div>
          ) : (
            <>
          {/* Top Agents */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Agents</h3>
                {performanceData.topAgents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Agent</th>
                    <th className="table-header">Leads</th>
                    <th className="table-header">Instructions</th>
                    <th className="table-header">Revenue</th>
                    <th className="table-header">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                        {performanceData.topAgents.map((agent, index) => (
                    <tr key={index}>
                      <td className="table-cell font-medium text-gray-900">{agent.name}</td>
                      <td className="table-cell">{agent.leads}</td>
                      <td className="table-cell">{agent.conversions}</td>
                      <td className="table-cell">£{agent.revenue.toLocaleString()}</td>
                      <td className="table-cell">
                              {agent.leads > 0 ? Math.round((agent.conversions / agent.leads) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                ) : (
                  <p className="text-gray-500 text-sm py-4">No agent performance data available for the selected date range</p>
                )}
          </div>

          {/* Monthly Trends */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends</h3>
                {performanceData.monthlyTrends.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Month</th>
                    <th className="table-header">Leads</th>
                    <th className="table-header">Revenue</th>
                    <th className="table-header">Avg Deal Size</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                        {performanceData.monthlyTrends.map((month, index) => (
                    <tr key={index}>
                      <td className="table-cell font-medium text-gray-900">{month.month}</td>
                      <td className="table-cell">{month.leads}</td>
                      <td className="table-cell">£{month.revenue.toLocaleString()}</td>
                            <td className="table-cell">
                              £{month.leads > 0 ? Math.round(month.revenue / month.leads).toLocaleString() : '0'}
                            </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                ) : (
                  <p className="text-gray-500 text-sm py-4">No monthly trend data available for the selected date range</p>
                )}
          </div>
            </>
          )}
        </div>
      )}

      {/* Pipeline & Transactions Report */}
      {selectedReport === 'pipeline' && (
        <div className="space-y-6">
          {isLoadingPipeline ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading pipeline data...</p>
            </div>
          ) : (
            <>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Per-User Pipeline Breakdown</h3>
                <p className="text-sm text-gray-600 mb-6">View each user's lead pipeline stages and transaction types</p>

                {pipelineData.userPipelines.length > 0 ? (
                  pipelineData.userPipelines.map((userPipeline, userIndex) => (
              <div key={userIndex} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0">
                <h4 className="font-semibold text-gray-900 mb-4 text-lg">{userPipeline.userName}</h4>
                
                {/* Pipeline Stages */}
                <div className="mb-6">
                  <h5 className="font-medium text-gray-700 mb-3">Lead Pipeline Stages</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(userPipeline.stages).map(([stage, count]) => (
                      <div key={stage} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="text-xs text-gray-600 mb-1">{stage}</div>
                        <div className="text-2xl font-bold text-blue-900">{count}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    Total leads in pipeline: <strong>{Object.values(userPipeline.stages).reduce((sum, val) => sum + val, 0)}</strong>
                  </div>
                </div>

                {/* Transaction Types */}
                <div>
                  <h5 className="font-medium text-gray-700 mb-3">Transaction Type Breakdown</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(userPipeline.transactionTypes).map(([type, count]) => (
                      <div key={type} className={`rounded-lg p-3 border ${
                        type === 'Purchase' ? 'bg-green-50 border-green-200' :
                        type === 'Sale' ? 'bg-blue-50 border-blue-200' :
                        type === 'Remortgage' ? 'bg-purple-50 border-purple-200' :
                        type === 'Remortgage Cashback' ? 'bg-orange-50 border-orange-200' :
                        type === 'Transfer of Equity' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-pink-50 border-pink-200'
                      }`}>
                        <div className="text-xs text-gray-600 mb-1">{type}</div>
                        <div className={`text-2xl font-bold ${
                          type === 'Purchase' ? 'text-green-900' :
                          type === 'Sale' ? 'text-blue-900' :
                          type === 'Remortgage' ? 'text-purple-900' :
                          type === 'Remortgage Cashback' ? 'text-orange-900' :
                          type === 'Transfer of Equity' ? 'text-yellow-900' :
                          'text-pink-900'
                        }`}>{count}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    Total transactions: <strong>{Object.values(userPipeline.transactionTypes).reduce((sum, val) => sum + val, 0)}</strong>
                  </div>
                </div>
              </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm py-4">No pipeline data available for the selected date range</p>
                )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-blue-50">
              <h4 className="font-semibold text-gray-900 mb-3">Most Common Stage</h4>
                  <div className="text-3xl font-bold text-blue-600">{pipelineData.mostCommonStage.stage}</div>
                  <p className="text-sm text-gray-600 mt-2">{pipelineData.mostCommonStage.count} leads across all users</p>
            </div>

            <div className="card bg-green-50">
              <h4 className="font-semibold text-gray-900 mb-3">Top Transaction Type</h4>
                  <div className="text-3xl font-bold text-green-600">{pipelineData.topTransactionType.type}</div>
                  <p className="text-sm text-gray-600 mt-2">{pipelineData.topTransactionType.count} {pipelineData.topTransactionType.type.toLowerCase()}s across all users</p>
            </div>

            <div className="card bg-purple-50">
              <h4 className="font-semibold text-gray-900 mb-3">Ready to Solicit</h4>
                  <div className="text-3xl font-bold text-purple-600">{pipelineData.readyToSolicit}</div>
              <p className="text-sm text-gray-600 mt-2">Leads ready for instruction</p>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Lead Analysis Report */}
      {selectedReport === 'leads' && (
        <div className="space-y-6">
          {isLoadingLeadAnalysis ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading lead analysis data...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {leadAnalysisData.leadQuality.highPriority + leadAnalysisData.leadQuality.mediumPriority + leadAnalysisData.leadQuality.lowPriority}
                  </div>
                  <div className="text-sm text-gray-600">Total Leads</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {leadAnalysisData.leadQuality.overdue}
                  </div>
                  <div className="text-sm text-gray-600">Overdue Leads</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {leadAnalysisData.leadQuality.avgContactAttempts}
                  </div>
                  <div className="text-sm text-gray-600">Avg Contact Attempts</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {leadAnalysisData.sourceBreakdown.length}
                  </div>
                  <div className="text-sm text-gray-600">Active Sources</div>
                </div>
              </div>

              {/* Lead Quality Breakdown */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm font-medium text-gray-900">High Priority</span>
                      </div>
                      <span className="text-sm text-gray-600">{leadAnalysisData.leadQuality.highPriority}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm font-medium text-gray-900">Medium Priority</span>
                      </div>
                      <span className="text-sm text-gray-600">{leadAnalysisData.leadQuality.mediumPriority}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-gray-900">Low Priority</span>
                      </div>
                      <span className="text-sm text-gray-600">{leadAnalysisData.leadQuality.lowPriority}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Sources</h3>
                  {leadAnalysisData.topSources.length > 0 ? (
                    <div className="space-y-3">
                      {leadAnalysisData.topSources.map((source, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{source.source}</div>
                            <div className="text-xs text-gray-500">
                              {source.count} leads • {source.conversionRate}% conversion • Avg age: {source.avgAge}h
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {(() => {
                                const fullSource = leadAnalysisData.sourceBreakdown.find(s => s.source === source.source);
                                return fullSource ? `${fullSource.percentage.toFixed(1)}%` : '0%';
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No source data available</p>
                  )}
                </div>
              </div>

              {/* Source Breakdown */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Source Analysis</h3>
                {leadAnalysisData.sourceBreakdown.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Source</th>
                          <th className="table-header">Leads</th>
                          <th className="table-header">Percentage</th>
                          <th className="table-header">Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {leadAnalysisData.sourceBreakdown.map((source, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{source.source}</td>
                            <td className="table-cell">{source.count.toLocaleString()}</td>
                            <td className="table-cell">{source.percentage.toFixed(1)}%</td>
                            <td className="table-cell">
                              <span className={`font-medium ${
                                source.conversionRate >= 20 ? 'text-green-600' :
                                source.conversionRate >= 10 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {source.conversionRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No source data available for this period</p>
                )}
              </div>

              {/* Status Breakdown */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status Breakdown</h3>
                {leadAnalysisData.statusBreakdown.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leadAnalysisData.statusBreakdown.map((status, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{status.status}</span>
                          <span className="text-sm text-gray-600">{status.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{status.count.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No status data available for this period</p>
                )}
              </div>

              {/* Age Distribution */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Age Distribution</h3>
                {leadAnalysisData.ageDistribution.length > 0 ? (
                  <div className="space-y-3">
                    {leadAnalysisData.ageDistribution.map((age, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{age.range}</span>
                          <span className="text-sm text-gray-600">{age.count} leads ({age.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${age.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No age data available for this period</p>
                )}
              </div>

              {/* Conversion Funnel */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
                {leadAnalysisData.conversionFunnel.length > 0 ? (
                  <div className="space-y-2">
                    {leadAnalysisData.conversionFunnel.map((stage, index) => (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="w-32 text-sm font-medium text-gray-700">{stage.stage}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">{stage.count} leads</span>
                            <span className="text-sm text-gray-500">{stage.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${stage.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No funnel data available for this period</p>
                )}
              </div>

              {/* Daily Trends */}
              {leadAnalysisData.dailyTrends.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Lead Trends</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Date</th>
                          <th className="table-header">Leads Generated</th>
                          <th className="table-header">Instructions</th>
                          <th className="table-header">Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {leadAnalysisData.dailyTrends.map((day, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{day.date}</td>
                            <td className="table-cell">{day.leads.toLocaleString()}</td>
                            <td className="table-cell">{day.conversions.toLocaleString()}</td>
                            <td className="table-cell">
                              {day.leads > 0 ? ((day.conversions / day.leads) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Agent Pipeline & Completion Report */}
      {selectedReport === 'agent-pipeline' && (
        <div className="space-y-6">
          {isLoadingPipeline ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading agent pipeline data...</p>
            </div>
          ) : (
            <>
              {agentTaskCompletion.length > 0 ? (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Pipeline Status & Task Completion</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    View each agent's current pipeline (leads at each call stage) and task completion statistics for the selected date range
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Agent</th>
                          <th className="table-header text-center">Call-1</th>
                          <th className="table-header text-center">Call-2</th>
                          <th className="table-header text-center">Call-3</th>
                          <th className="table-header text-center">Call-4</th>
                          <th className="table-header text-center">Call-5</th>
                          <th className="table-header text-center">Tasks Completed</th>
                          <th className="table-header text-center">Call Tasks Completed</th>
                          <th className="table-header text-center">Completion Rate</th>
                          <th className="table-header text-center">Call Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {agentTaskCompletion.map((agent, index) => (
                          <tr key={agent.agentId || index} className="hover:bg-gray-50">
                            <td className="table-cell font-medium text-gray-900">{agent.agentName}</td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callStageCounts['Call-1'] > 0 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'
                              }`}>
                                {agent.callStageCounts['Call-1']}
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callStageCounts['Call-2'] > 0 ? 'bg-yellow-100 text-yellow-800' : 'text-gray-400'
                              }`}>
                                {agent.callStageCounts['Call-2']}
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callStageCounts['Call-3'] > 0 ? 'bg-amber-100 text-amber-800' : 'text-gray-400'
                              }`}>
                                {agent.callStageCounts['Call-3']}
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callStageCounts['Call-4'] > 0 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'
                              }`}>
                                {agent.callStageCounts['Call-4']}
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callStageCounts['Call-5'] > 0 ? 'bg-red-100 text-red-800' : 'text-gray-400'
                              }`}>
                                {agent.callStageCounts['Call-5']}
                              </span>
                            </td>
                            <td className="table-cell text-center font-medium">
                              {agent.tasksCompleted} / {agent.tasksTotal}
                            </td>
                            <td className="table-cell text-center font-medium">
                              {agent.callTasksCompleted} / {agent.callTasksTotal}
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.completionRate >= 80 ? 'bg-green-100 text-green-800' :
                                agent.completionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {agent.completionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                agent.callCompletionRate >= 80 ? 'bg-green-100 text-green-800' :
                                agent.callCompletionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {agent.callCompletionRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <p className="text-gray-500 text-sm">No agent pipeline data available for the selected date range</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Revenue Report */}
      {selectedReport === 'revenue' && (
        <div className="space-y-6">
          {isLoadingRevenue ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading revenue data...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card text-center">
                  <div className="text-3xl font-bold text-green-600">
                    £{revenueData.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    £{revenueData.avgDealSize.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-gray-600">Average Deal Size</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {revenueData.acceptedQuotes}
                  </div>
                  <div className="text-sm text-gray-600">Accepted Quotes</div>
                </div>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {revenueData.totalQuotes}
                  </div>
                  <div className="text-sm text-gray-600">Paid Payments</div>
                </div>
              </div>

              {/* Quote Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-green-500">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Accepted</p>
                      <p className="text-2xl font-bold text-gray-900">{revenueData.acceptedQuotes}</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-yellow-500">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">{revenueData.pendingQuotes}</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-red-500">
                      <X className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Rejected</p>
                      <p className="text-2xl font-bold text-gray-900">{revenueData.rejectedQuotes}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue by Transaction Type */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Transaction Type</h3>
                {revenueData.revenueByType.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Transaction Type</th>
                          <th className="table-header">Revenue</th>
                          <th className="table-header">Quotes</th>
                          <th className="table-header">Avg Deal Size</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {revenueData.revenueByType.map((type, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{type.type}</td>
                            <td className="table-cell font-semibold text-green-600">
                              £{type.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell">{type.count}</td>
                            <td className="table-cell">
                              £{type.avgDeal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No revenue data by transaction type available for this period</p>
                )}
              </div>

              {/* Revenue by Agent */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Agent</h3>
                {revenueData.revenueByAgent.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Agent</th>
                          <th className="table-header">Revenue</th>
                          <th className="table-header">Quotes</th>
                          <th className="table-header">Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {revenueData.revenueByAgent.map((agent, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{agent.agent}</td>
                            <td className="table-cell font-semibold text-green-600">
                              £{agent.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell">{agent.quotes}</td>
                            <td className="table-cell">{agent.conversionRate.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No revenue data by agent available for this period</p>
                )}
              </div>

              {/* Monthly Revenue Trends */}
              {revenueData.monthlyRevenue.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trends</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Month</th>
                          <th className="table-header">Revenue</th>
                          <th className="table-header">Quotes</th>
                          <th className="table-header">Avg Deal Size</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {revenueData.monthlyRevenue.map((month, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{month.month}</td>
                            <td className="table-cell font-semibold text-green-600">
                              £{month.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell">{month.quotes}</td>
                            <td className="table-cell">
                              £{month.avgDeal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Quotes */}
              {revenueData.topQuotes.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Quotes by Value</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Lead Name</th>
                          <th className="table-header">Amount</th>
                          <th className="table-header">Type</th>
                          <th className="table-header">Agent</th>
                          <th className="table-header">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {revenueData.topQuotes.map((quote, index) => (
                          <tr key={index}>
                            <td className="table-cell font-medium text-gray-900">{quote.leadName}</td>
                            <td className="table-cell font-semibold text-green-600">
                              £{quote.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="table-cell">{quote.type}</td>
                            <td className="table-cell">{quote.agent}</td>
                            <td className="table-cell">{quote.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Status */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Pending</div>
                    <div className="text-2xl font-bold text-gray-900">{revenueData.paymentStatus.pending}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Completed</div>
                    <div className="text-2xl font-bold text-gray-900">{revenueData.paymentStatus.completed}</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Failed</div>
                    <div className="text-2xl font-bold text-gray-900">{revenueData.paymentStatus.failed}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
