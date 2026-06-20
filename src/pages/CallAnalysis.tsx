import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  CalendarPlus,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Loader2,
  Phone,
  RefreshCw,
  Target,
  Users as UsersIcon,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchUsers, User } from '@/services/usersService';
import { LeadOption, searchLeadOptions } from '@/services/leadsService';
import { logActivity } from '@/services/activityService';
import { createTask } from '@/services/tasksService';
import {
  analyzeThreeCxCall,
  CallAgentDailyBreakdown,
  CallAnalysisExportRow,
  CallAnalysisFilters,
  CallAnalysisRow,
  CallAnalysisSummary,
  CallDailyOverview,
  CallSignalBreakdown,
  fetchCallAgentDailyBreakdown,
  fetchCallAnalysisExportRows,
  fetchCallAnalysisRows,
  fetchCallAnalysisSummary,
  fetchCallDailyOverview,
  fetchCallSignalBreakdowns,
  fetchThreeCxStatus,
  linkCallRecordToLead,
  markCallRecordReviewed,
  setCallRecordReviewStatus,
  ThreeCxStatus,
} from '@/services/threecxService';
import {
  formatDateTime,
  formatDelay,
  formatNumber,
  getRate,
  sentenceCase,
  statusChipClass,
} from '@/components/callAnalysis/format';
import { useQueueCounts } from '@/components/callAnalysis/useQueueCounts';
import {
  FunnelStage,
  Highlight,
  KpiCardSpec,
  QueueCardSpec,
  TrendMetricKey,
  TrendPoint,
} from '@/components/callAnalysis/types';
import { KpiCard } from '@/components/callAnalysis/KpiCard';
import { FunnelPanel } from '@/components/callAnalysis/FunnelPanel';
import { TrendPanel } from '@/components/callAnalysis/TrendPanel';
import { QueueStrip } from '@/components/callAnalysis/QueueStrip';
import { HighlightsBar } from '@/components/callAnalysis/HighlightsBar';
import { PipelineStatusStrip } from '@/components/callAnalysis/PipelineStatusStrip';
import { AiCoverageFooter } from '@/components/callAnalysis/AiCoverageFooter';
import { InboundPanel } from '@/components/callAnalysis/InboundPanel';
import { EffortPanel } from '@/components/callAnalysis/EffortPanel';
import { TeamAverageStrip } from '@/components/callAnalysis/TeamAverageStrip';
import { AgentLeaderboard } from '@/components/callAnalysis/AgentLeaderboard';
import { SignalSummaryRow } from '@/components/callAnalysis/SignalSummaryRow';
import { CoachingRatioCard } from '@/components/callAnalysis/CoachingRatioCard';
import { ObjectionShiftStrip } from '@/components/callAnalysis/ObjectionShiftStrip';
import { RiskFlagsPanel } from '@/components/callAnalysis/RiskFlagsPanel';
import { CallsTable } from '@/components/callAnalysis/CallsTable';
import { CallCardList } from '@/components/callAnalysis/CallCardList';
import { CallDrawer } from '@/components/callAnalysis/CallDrawer';
import { BulkActionBar } from '@/components/callAnalysis/BulkActionBar';

const PAGE_SIZE = 50;
const SELECTED_ANALYSIS_BATCH_LIMIT = 10;

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayString = () => formatDateInput(new Date());

type CallRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

const computeCallRangePreset = (preset: Exclude<CallRangePreset, 'custom'>) => {
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

  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (preset === 'last7' ? 6 : 29));
  return { start: formatDateInput(start), end: formatDateInput(end) };
};

const toStartIso = (date: string) => new Date(`${date || todayString()}T00:00:00`).toISOString();

const toEndExclusiveIso = (date: string) => {
  const value = new Date(`${date || todayString()}T00:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString();
};

const getLocalDate = (value: string) => {
  const parsed = new Date(`${value || todayString()}T00:00:00`);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getInclusiveDayCount = (start: string, end: string) => {
  const startTime = getLocalDate(start).getTime();
  const endTime = getLocalDate(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || startTime > endTime) return 1;
  return Math.max(1, Math.round((endTime - startTime) / 86400000) + 1);
};

// Single-day ranges compare against the same weekday last week so Monday is
// never judged against Sunday. Longer ranges compare against the period
// immediately before.
const getPreviousDateRange = (start: string, end: string) => {
  const days = getInclusiveDayCount(start, end);
  if (days === 1) {
    const previous = addDays(getLocalDate(start), -7);
    return { start: formatDateInput(previous), end: formatDateInput(previous) };
  }
  const previousEnd = addDays(getLocalDate(start), -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return {
    start: formatDateInput(previousStart),
    end: formatDateInput(previousEnd),
  };
};

const getSeriesDates = (start: string, end: string, maxDays = 14) => {
  const startDate = getLocalDate(start);
  const endDate = getLocalDate(end);
  if (startDate > endDate) return [];

  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(formatDateInput(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates.slice(-maxDays);
};

const csvEscape = (value?: string | number | boolean | null) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const emptySummary: CallAnalysisSummary = {
  totalCalls: 0,
  transcriptsReceived: 0,
  aiAnalysed: 0,
  pendingAi: 0,
  failedAi: 0,
  matchedLeads: 0,
  needsReview: 0,
  voicemails: 0,
  followUpNeeded: 0,
  instructionIntent: 0,
  outboundCalls: 0,
  outboundAnswered: 0,
  outboundVoicemail: 0,
  inboundHotCalls: 0,
  possibleHotCalls: 0,
  anyObjection: 0,
  officialInstructions: 0,
};

const emptyDailyOverview: CallDailyOverview = {
  totalCalls: 0,
  answeredCalls: 0,
  voicemailCalls: 0,
  missedAbandonedCalls: 0,
  outboundCalls: 0,
  outboundAnsweredCalls: 0,
  outboundVoicemailCalls: 0,
  outboundAnswerRate: 0,
  uniqueLeadsAttempted: 0,
  uniqueLeadsContacted: 0,
  contactRate: 0,
  officialInstructions: 0,
  contactToInstructionRate: 0,
  outboundAttempt1Calls: 0,
  outboundAttempt2Calls: 0,
  outboundAttempt3PlusCalls: 0,
  inboundHotCalls: 0,
  possibleHotCalls: 0,
  outboundAttemptsPerLead: 0,
  averageFirstOutboundDelaySeconds: 0,
  averageDurationSeconds: 0,
  transcriptsReceived: 0,
  aiAnalysed: 0,
  pendingAi: 0,
  matchedLeads: 0,
  unmatchedOrAmbiguous: 0,
  followUpNeeded: 0,
  instructionIntent: 0,
  anyObjection: 0,
  hasPositiveSignal: 0,
  priceConcerns: 0,
  uspMentions: 0,
  op1Calls: 0,
};

type CallAnalysisTab = 'overview' | 'agents' | 'insights' | 'calls';

const matchLabel = (status?: string) => {
  if (status === 'matched') return 'Linked to a lead';
  if (status === 'ambiguous') return 'Ambiguous match';
  return 'Not linked to a lead';
};

const matchTone = (status?: string): 'green' | 'amber' | 'red' | 'gray' => {
  if (status === 'matched') return 'green';
  if (status === 'ambiguous') return 'amber';
  if (status === 'unmatched') return 'red';
  return 'gray';
};

const reviewLabel = (status?: string) => {
  if (status === 'ignored') return 'Dismissed';
  if (status === 'pending_review') return 'Needs review';
  return 'Done';
};

const reviewTone = (status?: string): 'green' | 'amber' | 'gray' => {
  if (status === 'pending_review') return 'amber';
  if (status === 'ignored') return 'gray';
  return 'green';
};

const getCallPhone = (row: CallAnalysisRow) =>
  row.leadPhone || row.normalizedPhone || row.callerNumber || row.calledNumber || 'No number';

const getLeadLabel = (row: CallAnalysisRow) => row.leadName || 'Unlinked call';

const buildDefaultScheduleDateTime = () => {
  const value = new Date();
  value.setMinutes(0, 0, 0);
  value.setHours(value.getHours() + 1);

  if (value.getHours() < 8) {
    value.setHours(9, 0, 0, 0);
  } else if (value.getHours() >= 18) {
    value.setDate(value.getDate() + 1);
    value.setHours(9, 0, 0, 0);
  }

  return {
    date: formatDateInput(value),
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
};

const inferFollowUpPriority = (row: CallAnalysisRow): 'High' | 'Medium' | 'Low' => {
  const confidence = row.confidence == null ? null : Math.round(row.confidence > 1 ? row.confidence : row.confidence * 100);
  if (row.instructionIntent || (confidence != null && confidence >= 80)) return 'High';
  if (row.followUpRequired || row.priceConcern || (confidence != null && confidence >= 55)) return 'Medium';
  return 'Low';
};

const buildFollowUpNotes = (row: CallAnalysisRow) => {
  const parts = [
    row.followUpReason ? `Follow-up reason: ${row.followUpReason}` : '',
    row.recommendedAction ? `Recommended action: ${row.recommendedAction}` : '',
    row.cdrSummary ? `Phone system summary: ${row.cdrSummary}` : '',
    row.summary ? `APCM AI summary: ${row.summary}` : '',
    `Call: ${formatDateTime(row.startedAt)}${row.agentName ? ` with ${row.agentName}` : ''}`,
  ].filter(Boolean);

  return parts.join('\n\n');
};

const mapExportRow = (row: CallAnalysisExportRow) => [
  row.callId,
  row.leadId,
  row.leadName,
  row.phone,
  row.agent,
  row.leadOwner,
  row.callTime,
  row.direction,
  row.durationSeconds,
  row.status,
  row.transcriptStatus,
  row.aiStatus,
  row.matchStatus,
  row.reviewStatus,
  row.reviewNote,
  row.manualLinkedAt,
  row.manualLinkedByName,
  row.manualLinkReason,
  row.cdrCallType,
  row.cdrSummary,
  row.recordingReference,
  row.callType,
  row.outcome,
  row.summary,
  row.objections,
  row.tags,
  row.knockBackReason,
  row.rejectionReason,
  row.positiveSignals,
  row.uspMentioned,
  row.priceConcern,
  row.followUpNeeded,
  row.followUpReason,
  row.recommendedAction,
  row.instructionIntent,
  row.confidence,
  row.confidenceReason,
  row.voicemailFlag,
  row.meaningfulConversation,
  row.objectionCategory,
  row.anyObjection,
  row.externalClientCall,
  row.outboundSalesCall,
  row.outboundAnswered,
  row.outboundAttemptNumber,
  row.outboundAttemptBucket,
  row.inboundHotCall,
  row.possibleHotCall,
  row.uniqueContactClassification,
  row.officialInstruction,
  row.reviewedAt,
];

const EXPORT_HEADERS = [
  'call_id', 'lead_id', 'lead_name', 'phone', 'agent', 'lead_owner', 'call_time', 'direction',
  'duration_seconds', 'status', 'transcript_status', 'ai_status', 'match_status', 'review_status',
  'review_note', 'manual_linked_at', 'manual_linked_by_name', 'manual_link_reason', '3cx_call_type',
  '3cx_summary', 'recording_reference', 'call_type', 'outcome', 'apcm_ai_summary', 'objections',
  'tags', 'knock_back_reason', 'rejection_reason', 'positive_signals', 'usp_mentioned',
  'price_concern', 'follow_up_needed', 'follow_up_reason', 'recommended_action', 'instruction_intent',
  'confidence', 'confidence_reason', 'voicemail_flag', 'meaningful_conversation', 'objection_category',
  'any_objection', 'external_client_call', 'outbound_sales_call', 'outbound_answered',
  'outbound_attempt_number', 'outbound_attempt_bucket', 'inbound_hot_call', 'possible_hot_call',
  'unique_contact_classification', 'official_instruction', 'reviewed_at',
];

// Theme breakdown card kept from 1.0 — used in the AI Insights tab.
const ThemeBreakdownCard: React.FC<{
  title: string;
  signals: CallSignalBreakdown[];
  tone?: string;
  onSignalClick?: (signal: CallSignalBreakdown) => void;
}> = ({ title, signals, tone = 'bg-navy-950', onSignalClick }) => {
  const maxValue = Math.max(...signals.map((signal) => signal.callsCount), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-6 text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">Click a theme to view matching calls.</p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {formatNumber(signals.reduce((total, signal) => total + signal.callsCount, 0))} calls
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {signals.slice(0, 8).map((signal) => (
          <button
            key={`${title}-${signal.signalValue}`}
            type="button"
            onClick={() => onSignalClick?.(signal)}
            className="block w-full rounded-lg bg-gray-50/70 p-3 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-navy-950/25"
          >
            <div className="mb-2 flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 break-words font-medium leading-5 text-gray-800">{signal.signalValue}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm">
                {formatNumber(signal.callsCount)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(5, (signal.callsCount / maxValue) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const CallAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const defaultRange = computeCallRangePreset('yesterday');

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [rangePreset, setRangePreset] = useState<CallRangePreset>('yesterday');
  const [agentUserId, setAgentUserId] = useState('all');
  const [direction, setDirection] = useState('all');
  const [callStatus, setCallStatus] = useState('all');
  const [transcriptStatus, setTranscriptStatus] = useState('all');
  const [aiStatus, setAiStatus] = useState('all');
  const [matchStatus, setMatchStatus] = useState('all');
  const [callType, setCallType] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState('all');
  const [reviewStatus, setReviewStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<CallAnalysisTab>('overview');
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>('outboundCalls');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<CallAnalysisSummary>(emptySummary);
  const [dailyOverview, setDailyOverview] = useState<CallDailyOverview>(emptyDailyOverview);
  const [previousDailyOverview, setPreviousDailyOverview] = useState<CallDailyOverview>(emptyDailyOverview);
  const [dailySeries, setDailySeries] = useState<TrendPoint[]>([]);
  const [agentBreakdown, setAgentBreakdown] = useState<CallAgentDailyBreakdown[]>([]);
  const [previousAgentBreakdown, setPreviousAgentBreakdown] = useState<CallAgentDailyBreakdown[]>([]);
  const [signalBreakdowns, setSignalBreakdowns] = useState<CallSignalBreakdown[]>([]);
  const [previousSignalBreakdowns, setPreviousSignalBreakdowns] = useState<CallSignalBreakdown[]>([]);
  const [inboundHotInstructed, setInboundHotInstructed] = useState(0);
  const [threeCxStatus, setThreeCxStatus] = useState<ThreeCxStatus | null>(null);
  const [rows, setRows] = useState<CallAnalysisRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [isAnalyzingSelected, setIsAnalyzingSelected] = useState(false);
  const [selectedAnalysisProgress, setSelectedAnalysisProgress] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [drawerRow, setDrawerRow] = useState<CallAnalysisRow | null>(null);
  const [drawerQueue, setDrawerQueue] = useState<{ title: string; rows: CallAnalysisRow[]; index: number } | null>(null);
  const [linkRow, setLinkRow] = useState<CallAnalysisRow | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLeadOption, setSelectedLeadOption] = useState<LeadOption | null>(null);
  const [manualLinkReason, setManualLinkReason] = useState('');
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [isLinkingCall, setIsLinkingCall] = useState(false);
  const [bookedOverrides, setBookedOverrides] = useState<Record<string, boolean>>({});
  const [scheduleRow, setScheduleRow] = useState<CallAnalysisRow | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [schedulePriority, setSchedulePriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [isSchedulingAttempt, setIsSchedulingAttempt] = useState(false);
  const [stagedRefreshCount, setStagedRefreshCount] = useState(0);
  const stagedRowsRef = useRef<{ rows: CallAnalysisRow[]; totalCount: number } | null>(null);

  const dateRangeInvalid = startDate > endDate;

  const filters = useMemo<CallAnalysisFilters>(() => ({
    startDate: toStartIso(startDate),
    endDate: toEndExclusiveIso(endDate),
    agentUserId: agentUserId === 'all' ? null : agentUserId,
    direction: direction === 'all' ? null : direction,
    callStatus: callStatus === 'all' ? null : callStatus,
    transcriptStatus: transcriptStatus === 'all' ? null : transcriptStatus,
    aiStatus: aiStatus === 'all' ? null : aiStatus,
    matchStatus: matchStatus === 'all' ? null : matchStatus,
    callType: callType.trim() || null,
    followUpNeeded: followUpNeeded === 'all' ? null : followUpNeeded === 'yes',
    reviewStatus: reviewStatus === 'all' ? null : reviewStatus,
  }), [
    aiStatus,
    agentUserId,
    callStatus,
    callType,
    direction,
    endDate,
    followUpNeeded,
    matchStatus,
    reviewStatus,
    startDate,
    transcriptStatus,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const { counts: queueCounts, refresh: refreshQueueCounts } = useQueueCounts(filters);
  const bookedMap = useMemo(
    () => ({ ...queueCounts.bookedMap, ...bookedOverrides }),
    [queueCounts.bookedMap, bookedOverrides]
  );

  const loadUsers = useCallback(async () => {
    const loadedUsers = await fetchUsers();
    setUsers(loadedUsers.filter((loadedUser) => loadedUser.status === 'Active'));
  }, []);

  const summaryPendingAiRef = useRef(0);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (dateRangeInvalid) {
      setError('Start date must be before or the same as end date.');
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const previousRange = getPreviousDateRange(startDate, endDate);
      const seriesDates = getSeriesDates(startDate, endDate);
      const previousFilters: CallAnalysisFilters = {
        ...filters,
        startDate: toStartIso(previousRange.start),
        endDate: toEndExclusiveIso(previousRange.end),
      };

      const seriesPromise = Promise.all(
        seriesDates.map(async (seriesDate) => ({
          date: seriesDate,
          overview: await fetchCallDailyOverview({
            ...filters,
            startDate: toStartIso(seriesDate),
            endDate: toEndExclusiveIso(seriesDate),
          }),
        }))
      );

      const [
        summaryData,
        overviewData,
        previousOverviewData,
        seriesData,
        agentData,
        previousAgentData,
        signalData,
        previousSignalData,
        inboundHotSummary,
        statusData,
        rowData,
      ] = await Promise.all([
        fetchCallAnalysisSummary(filters),
        fetchCallDailyOverview(filters),
        fetchCallDailyOverview(previousFilters),
        seriesPromise,
        fetchCallAgentDailyBreakdown(filters),
        fetchCallAgentDailyBreakdown(previousFilters).catch(() => [] as CallAgentDailyBreakdown[]),
        fetchCallSignalBreakdowns(filters),
        fetchCallSignalBreakdowns(previousFilters).catch(() => [] as CallSignalBreakdown[]),
        fetchCallAnalysisSummary({ ...filters, callType: 'inbound_hot' }).catch(() => emptySummary),
        fetchThreeCxStatus().catch(() => null),
        fetchCallAnalysisRows(filters, page, PAGE_SIZE),
      ]);

      setSummary(summaryData);
      setDailyOverview(overviewData);
      setPreviousDailyOverview(previousOverviewData);
      setDailySeries(seriesData);
      setAgentBreakdown(agentData);
      setPreviousAgentBreakdown(previousAgentData);
      setSignalBreakdowns(signalData);
      setPreviousSignalBreakdowns(previousSignalData);
      setInboundHotInstructed(inboundHotSummary.officialInstructions);
      setThreeCxStatus(statusData);

      // While someone is triaging (drawer open or rows selected), a silent poll
      // must not swap the rows underneath them — stage instead and show a banner.
      const triageInProgress = Boolean(drawerRow) || selectedIds.size > 0;
      if (silent && triageInProgress) {
        stagedRowsRef.current = { rows: rowData.rows, totalCount: rowData.totalCount };
        const newlyAnalysed = Math.max(0, summaryPendingAiRef.current - summaryData.pendingAi);
        if (newlyAnalysed > 0) setStagedRefreshCount((current) => current + newlyAnalysed);
      } else {
        stagedRowsRef.current = null;
        setStagedRefreshCount(0);
        setRows(rowData.rows);
        setTotalCount(rowData.totalCount);
        setSelectedIds((current) => {
          const visibleIds = new Set(rowData.rows.map((row) => row.id));
          return new Set(Array.from(current).filter((id) => visibleIds.has(id)));
        });
      }
      summaryPendingAiRef.current = summaryData.pendingAi;
    } catch (loadError: any) {
      console.error('Error loading call analysis:', loadError);
      if (silent) return;
      setError(loadError?.message || 'Unable to load call analysis data.');
      setRows([]);
      setTotalCount(0);
      setSummary(emptySummary);
      setDailyOverview(emptyDailyOverview);
      setPreviousDailyOverview(emptyDailyOverview);
      setDailySeries([]);
      setAgentBreakdown([]);
      setPreviousAgentBreakdown([]);
      setSignalBreakdowns([]);
      setPreviousSignalBreakdowns([]);
      setThreeCxStatus(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeInvalid, endDate, filters, page, startDate, drawerRow, selectedIds.size]);

  const applyStagedRows = useCallback(() => {
    const staged = stagedRowsRef.current;
    if (!staged) return;
    stagedRowsRef.current = null;
    setStagedRefreshCount(0);
    setRows(staged.rows);
    setTotalCount(staged.totalCount);
    setSelectedIds((current) => {
      const visibleIds = new Set(staged.rows.map((row) => row.id));
      return new Set(Array.from(current).filter((id) => visibleIds.has(id)));
    });
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const preset = searchParams.get('preset');
    if (preset === 'today' || preset === 'yesterday' || preset === 'last7' || preset === 'last30') {
      const range = computeCallRangePreset(preset);
      setRangePreset(preset);
      setStartDate(range.start);
      setEndDate(range.end);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  // Imported calls are visible immediately while APCM AI classifies them in the
  // background; refresh quietly while any visible call is pending analysis.
  useEffect(() => {
    const aiStillWorking =
      (summary?.pendingAi || 0) > 0 ||
      rows.some(
        (row) =>
          row.aiAnalysisStatus === 'analyzing' ||
          (row.transcriptAvailable && row.aiAnalysisStatus === 'not_analyzed')
      );

    if (!aiStillWorking) return;

    const timer = window.setInterval(() => {
      loadData({ silent: true });
    }, 90_000);

    return () => window.clearInterval(timer);
  }, [summary, rows, loadData]);

  // When the AI backlog for this range drains to zero, refresh the queue scan once.
  const previousPendingAiRef = useRef<number | null>(null);
  useEffect(() => {
    const previous = previousPendingAiRef.current;
    previousPendingAiRef.current = summary.pendingAi;
    if (previous != null && previous > 0 && summary.pendingAi === 0) {
      refreshQueueCounts();
    }
  }, [summary.pendingAi, refreshQueueCounts]);

  // Apply any staged silent refresh once triage finishes.
  useEffect(() => {
    if (!drawerRow && selectedIds.size === 0 && stagedRowsRef.current) {
      applyStagedRows();
    }
  }, [drawerRow, selectedIds.size, applyStagedRows]);

  useEffect(() => {
    if (!linkRow) {
      setLeadOptions([]);
      setSelectedLeadOption(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingLeads(true);
      try {
        const options = await searchLeadOptions({
          search: leadSearch,
          limit: 25,
          sortBy: leadSearch.trim() ? 'name' : 'updated_at',
          sortDirection: leadSearch.trim() ? 'asc' : 'desc',
        });
        if (!cancelled) setLeadOptions(options);
      } catch (searchError: any) {
        console.error('Error searching leads for call link:', searchError);
        if (!cancelled) setError(searchError?.message || 'Unable to search leads.');
      } finally {
        if (!cancelled) setIsSearchingLeads(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [leadSearch, linkRow]);

  const resetToFirstPage = () => setPage(1);

  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    resetToFirstPage();
  };

  const handleDateChange = (setter: (value: string) => void, value: string) => {
    setRangePreset('custom');
    handleFilterChange(setter, value);
  };

  const applyDatePreset = (preset: Exclude<CallRangePreset, 'custom'>) => {
    const range = computeCallRangePreset(preset);
    setRangePreset(preset);
    setStartDate(range.start);
    setEndDate(range.end);
    resetToFirstPage();
  };

  const clearFocusedFilters = () => {
    setDirection('all');
    setCallStatus('all');
    setTranscriptStatus('all');
    setAiStatus('all');
    setMatchStatus('all');
    setCallType('');
    setFollowUpNeeded('all');
    setReviewStatus('all');
    setSelectedIds(new Set());
    resetToFirstPage();
  };

  // Tabs are pure navigation — they never mutate filters.
  const handleTabChange = (tab: CallAnalysisTab) => setActiveTab(tab);

  const applySummaryFilter = (filterName: string) => {
    clearFocusedFilters();
    setActiveTab('calls');

    if (filterName === 'transcripts') {
      setTranscriptStatus('received');
    } else if (filterName === 'aiAnalysed') {
      setAiStatus('completed');
    } else if (filterName === 'pendingAi') {
      setTranscriptStatus('received');
      setAiStatus('not_analyzed');
    } else if (filterName === 'failedAi') {
      setAiStatus('failed');
    } else if (filterName === 'matched') {
      setMatchStatus('matched');
    } else if (filterName === 'unmatched') {
      setMatchStatus('unmatched');
    } else if (filterName === 'needsReview') {
      setReviewStatus('needs_review');
    } else if (filterName === 'voicemail') {
      setCallType('voicemail');
    } else if (filterName === 'followUp') {
      setFollowUpNeeded('yes');
    } else if (filterName === 'instructionIntent') {
      setCallType('instruction intent');
    } else if (filterName === 'inboundHot') {
      setCallType('inbound_hot');
    } else if (filterName === 'possibleHot') {
      setCallType('possible_hot');
      setReviewStatus('needs_review');
    } else if (filterName === 'outboundSales') {
      setCallType('outbound_sales');
    } else if (filterName === 'outboundAnswered') {
      setCallType('contacted');
    } else if (filterName === 'anyObjection') {
      setCallType('any_objection');
    } else if (filterName === 'officialInstruction') {
      setCallType('official_instruction');
    } else if (filterName === 'attempt1') {
      setCallType('outbound_attempt_1');
    } else if (filterName === 'attempt2') {
      setCallType('outbound_attempt_2');
    } else if (filterName === 'attempt3') {
      setCallType('outbound_attempt_3_plus');
    } else if (filterName === 'missedHot') {
      setCallType('inbound_hot');
      setCallStatus('missed');
    }
  };

  const applyThemeFilter = (signal: { signalType: string; signalValue: string }) => {
    clearFocusedFilters();
    setCallType(signal.signalValue);
    setActiveTab('calls');
    if (signal.signalType.toLowerCase().includes('follow-up')) {
      setFollowUpNeeded('yes');
    }
  };

  const signalFilterLabel = (value: string) => {
    const labels: Record<string, string> = {
      outbound_sales: 'Calls made',
      contacted: 'Conversations',
      voicemail: 'Voicemail',
      inbound_hot: 'Hot inbound',
      possible_hot: 'Possible hot',
      any_objection: 'Calls with objections',
      official_instruction: 'Instructions',
      outbound_attempt_1: '1st calls',
      outbound_attempt_2: '2nd calls',
      outbound_attempt_3_plus: '3rd+ calls',
      positive_signal: 'Positive buying signal',
      'instruction intent': 'Likely to instruct',
    };
    return labels[value] || value;
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onClear: () => void }> = [];
    if (agentUserId !== 'all') {
      chips.push({
        label: `Agent: ${users.find((crmUser) => crmUser.id === agentUserId)?.name || 'Selected agent'}`,
        onClear: () => setAgentUserId('all'),
      });
    }
    if (direction !== 'all') chips.push({ label: `Direction: ${sentenceCase(direction)}`, onClear: () => setDirection('all') });
    if (callStatus !== 'all') chips.push({ label: `Status: ${sentenceCase(callStatus)}`, onClear: () => setCallStatus('all') });
    if (transcriptStatus !== 'all') {
      chips.push({
        label: transcriptStatus === 'received' ? 'Transcript received' : 'Awaiting transcript',
        onClear: () => setTranscriptStatus('all'),
      });
    }
    if (aiStatus !== 'all') {
      const aiLabels: Record<string, string> = {
        completed: 'Analysed by AI',
        failed: 'AI analysis failed',
        not_analyzed: 'Awaiting AI analysis',
        analyzing: 'Analysing',
      };
      chips.push({ label: aiLabels[aiStatus] || aiStatus, onClear: () => setAiStatus('all') });
    }
    if (matchStatus !== 'all') chips.push({ label: matchLabel(matchStatus), onClear: () => setMatchStatus('all') });
    if (callType.trim()) chips.push({ label: signalFilterLabel(callType.trim()), onClear: () => setCallType('') });
    if (followUpNeeded !== 'all') {
      chips.push({
        label: followUpNeeded === 'yes' ? 'Call-back promised' : 'No call-back promised',
        onClear: () => setFollowUpNeeded('all'),
      });
    }
    if (reviewStatus !== 'all') {
      chips.push({
        label: reviewStatus === 'needs_review' ? 'Needs review' : reviewLabel(reviewStatus),
        onClear: () => setReviewStatus('all'),
      });
    }
    return chips;
  }, [agentUserId, aiStatus, callStatus, callType, direction, followUpNeeded, matchStatus, reviewStatus, transcriptStatus, users]);

  const toggleSelected = (row: CallAnalysisRow) => {
    if (!row.transcriptAvailable) return;

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  };

  const handleAnalyze = async (row: CallAnalysisRow) => {
    if (!row.transcriptAvailable) {
      setNotice('Transcript is not available yet for this call.');
      return;
    }

    setAnalyzingId(row.id);
    setNotice(null);

    try {
      await analyzeThreeCxCall(row.id);
      setNotice('APCM AI analysis completed.');
      await loadData();
    } catch (analyzeError: any) {
      console.error('Error analysing call:', analyzeError);
      setError(analyzeError?.message || 'Unable to analyse this call.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalyzeSelected = async () => {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id) && row.transcriptAvailable);
    const cappedRows = selectedRows.slice(0, SELECTED_ANALYSIS_BATCH_LIMIT);

    if (cappedRows.length === 0) {
      setNotice('Select transcript-available calls to analyse.');
      return;
    }

    setIsAnalyzingSelected(true);
    setSelectedAnalysisProgress(`0 of ${cappedRows.length} analysed`);
    setNotice(null);

    try {
      let analysed = 0;
      let failed = 0;

      for (let index = 0; index < cappedRows.length; index += 1) {
        const row = cappedRows[index];
        setSelectedAnalysisProgress(`${index + 1} of ${cappedRows.length} analysing`);

        try {
          await analyzeThreeCxCall(row.id);
          analysed += 1;
        } catch (rowError) {
          failed += 1;
          console.error('Error analysing selected call:', rowError);
        }

        setSelectedAnalysisProgress(`${index + 1} of ${cappedRows.length} analysed`);
      }

      setNotice(
        cappedRows.length < selectedRows.length
          ? `Analysed ${analysed} calls, ${failed} failed. Selected batches run ${SELECTED_ANALYSIS_BATCH_LIMIT} at a time.`
          : `Analysed ${analysed} selected calls, ${failed} failed.`
      );
      setSelectedIds(new Set());
      await loadData();
    } catch (batchError: any) {
      console.error('Error analysing selected calls:', batchError);
      setError(batchError?.message || 'Unable to analyse selected calls.');
    } finally {
      setIsAnalyzingSelected(false);
      setSelectedAnalysisProgress('');
    }
  };

  const handleMarkReviewed = async (row: CallAnalysisRow) => {
    if (!user) return;

    setReviewingId(row.id);
    setNotice(null);

    try {
      await markCallRecordReviewed(row.id, {
        id: user.id,
        name: user.name || 'CRM User',
      });
      setNotice('Call marked as done.');
      await loadData();
    } catch (reviewError: any) {
      console.error('Error marking call done:', reviewError);
      setError(reviewError?.message || 'Unable to mark this call as done.');
    } finally {
      setReviewingId(null);
    }
  };

  const handleDismissCall = async (row: CallAnalysisRow, note: string) => {
    if (!user) return;

    setReviewingId(row.id);
    setNotice(null);

    try {
      await setCallRecordReviewStatus(row.id, 'ignored', {
        id: user.id,
        name: user.name || 'CRM User',
      }, note);
      setNotice('Call dismissed and removed from the worklists.');
      await loadData();
    } catch (reviewError: any) {
      console.error('Error dismissing call:', reviewError);
      setError(reviewError?.message || 'Unable to dismiss this call.');
    } finally {
      setReviewingId(null);
    }
  };

  const handleDismissSelected = async (note: string) => {
    if (!user) return;
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) return;

    setNotice(null);
    let done = 0;
    for (const row of selectedRows) {
      try {
        await setCallRecordReviewStatus(row.id, 'ignored', { id: user.id, name: user.name || 'CRM User' }, note);
        done += 1;
      } catch (dismissError) {
        console.error('Error dismissing selected call:', dismissError);
      }
    }
    setNotice(`Dismissed ${done} of ${selectedRows.length} selected calls.`);
    setSelectedIds(new Set());
    await loadData();
  };

  const handleMarkSelectedDone = async () => {
    if (!user) return;
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) return;

    setNotice(null);
    let done = 0;
    for (const row of selectedRows) {
      try {
        await markCallRecordReviewed(row.id, { id: user.id, name: user.name || 'CRM User' });
        done += 1;
      } catch (doneError) {
        console.error('Error marking selected call done:', doneError);
      }
    }
    setNotice(`Marked ${done} of ${selectedRows.length} selected calls as done.`);
    setSelectedIds(new Set());
    await loadData();
  };

  const handleExportSelected = () => {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) return;

    const headers = [
      'call_id', 'lead_name', 'phone', 'agent', 'call_time', 'direction', 'duration_seconds',
      'status', 'ai_status', 'apcm_ai_summary', 'call_type', 'outcome', 'objections', 'tags',
      'call_back_promised', 'recommended_action', 'likely_to_instruct', 'instruction_confirmed',
    ];
    const lines = [
      headers.map(csvEscape).join(','),
      ...selectedRows.map((row) => [
        row.threecxCallId,
        row.leadName,
        getCallPhone(row),
        row.agentName,
        row.startedAt,
        row.direction,
        row.durationSeconds,
        row.callStatus,
        row.aiAnalysisStatus,
        row.summary,
        row.callType,
        row.outcome,
        row.objections.join('; '),
        row.tags.join('; '),
        row.followUpRequired,
        row.recommendedAction,
        row.instructionIntent,
        row.isOfficialInstruction,
      ].map(csvEscape).join(',')),
    ];
    downloadCsv(`call-analysis-selected-${todayString()}.csv`, lines.join('\n'));
    setNotice(`Exported ${selectedRows.length} selected calls.`);
  };

  const openLinkModal = (row: CallAnalysisRow) => {
    setLinkRow(row);
    setLeadSearch(row.leadName || row.leadPhone || row.normalizedPhone || row.callerNumber || '');
    setManualLinkReason(row.manualLinkReason || row.reviewNote || '');
    setSelectedLeadOption(null);
    setNotice(null);
  };

  const closeLinkModal = () => {
    setLinkRow(null);
    setLeadSearch('');
    setLeadOptions([]);
    setSelectedLeadOption(null);
    setManualLinkReason('');
    setIsLinkingCall(false);
  };

  const handleLinkCallToLead = async () => {
    if (!user || !linkRow || !selectedLeadOption) return;

    setIsLinkingCall(true);
    setNotice(null);

    try {
      await linkCallRecordToLead({
        callRecordId: linkRow.id,
        leadId: selectedLeadOption.id,
        linkedBy: {
          id: user.id,
          name: user.name || 'CRM User',
        },
        reason: manualLinkReason || `Manual link to ${selectedLeadOption.name}`,
      });
      setNotice('Call linked to lead and marked done.');
      closeLinkModal();
      await loadData();
    } catch (linkError: any) {
      console.error('Error linking call to lead:', linkError);
      setError(linkError?.message || 'Unable to link this call to a lead.');
    } finally {
      setIsLinkingCall(false);
    }
  };

  const openScheduleModal = (row: CallAnalysisRow) => {
    if (!row.leadId) {
      setNotice('Link this call to a lead to schedule a follow-up.');
      return;
    }

    const defaultDateTime = buildDefaultScheduleDateTime();
    setScheduleRow(row);
    setScheduleDate(defaultDateTime.date);
    setScheduleTime(defaultDateTime.time);
    setSchedulePriority(inferFollowUpPriority(row));
    setScheduleNotes(buildFollowUpNotes(row));
    setNotice(null);
  };

  const closeScheduleModal = () => {
    setScheduleRow(null);
    setScheduleDate('');
    setScheduleTime('');
    setSchedulePriority('Medium');
    setScheduleNotes('');
    setIsSchedulingAttempt(false);
  };

  const handleScheduleContactAttempt = async () => {
    if (!user || !scheduleRow?.leadId || !scheduleDate || !scheduleTime) return;

    setIsSchedulingAttempt(true);
    setNotice(null);

    try {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      const leadName = scheduleRow.leadName || getLeadLabel(scheduleRow);
      const taskDescription = `Contact attempt from Call Analysis${scheduleNotes ? `\n\n${scheduleNotes}` : ''}`;

      const created = await createTask({
        leadId: scheduleRow.leadId,
        assignedTo: scheduleRow.agentUserId || user.id,
        taskType: 'Call',
        title: `Call follow-up - ${leadName}`,
        description: taskDescription,
        dueDate: scheduledDateTime.toISOString().split('T')[0],
        dueTime: scheduledDateTime.toTimeString().slice(0, 5),
        priority: schedulePriority,
        status: 'Pending',
      });

      if (!created) {
        throw new Error('Unable to create follow-up task.');
      }

      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: created.id,
        leadId: scheduleRow.leadId,
        leadName,
        actionDescription: 'Scheduled Call attempt from Call Analysis',
        doneByType: 'user',
        doneById: user.id,
        doneByName: user.name || 'CRM User',
        metadata: {
          source: 'call_analysis',
          callRecordId: scheduleRow.id,
          aiAnalysisId: scheduleRow.analysisId,
          followUpReason: scheduleRow.followUpReason,
          recommendedAction: scheduleRow.recommendedAction,
          callSummary: scheduleRow.cdrSummary || scheduleRow.summary,
          cdrSummary: scheduleRow.cdrSummary,
          aiSummary: scheduleRow.summary,
          callStartedAt: scheduleRow.startedAt,
          callAgentName: scheduleRow.agentName,
          scheduledFor: scheduledDateTime.toISOString(),
          priority: schedulePriority,
          notes: scheduleNotes,
        },
      });

      setBookedOverrides((current) => ({ ...current, [scheduleRow.id]: true }));
      setNotice('Call-back booked from Call Analysis.');
      closeScheduleModal();
    } catch (scheduleError: any) {
      console.error('Error scheduling contact attempt from call analysis:', scheduleError);
      setError(scheduleError?.message || 'Unable to book this call-back.');
    } finally {
      setIsSchedulingAttempt(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await fetchCallAnalysisExportRows(filters, 10000);
      const lines = [
        EXPORT_HEADERS.map(csvEscape).join(','),
        ...result.rows.map((row) => mapExportRow(row).map(csvEscape).join(',')),
      ];

      downloadCsv(`call-analysis-${startDate}-to-${endDate}.csv`, lines.join('\n'));

      setNotice(
        result.isCapped
          ? `Exported ${result.rows.length} rows. Export is capped at ${formatNumber(result.exportLimit)} rows.`
          : `Exported ${result.rows.length} rows.`
      );
    } catch (exportError: any) {
      console.error('Error exporting call analysis:', exportError);
      setError(exportError?.message || 'Unable to export call analysis.');
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Drawer + queue mode
  // ---------------------------------------------------------------------------

  const openDrawer = (row: CallAnalysisRow) => {
    setDrawerQueue(null);
    setDrawerRow(row);
  };

  const closeDrawer = () => {
    setDrawerRow(null);
    setDrawerQueue(null);
  };

  const openFlaggedQueue = () => {
    const flagged = queueCounts.flaggedRows || [];
    if (flagged.length === 0) {
      setNotice('No calls are flagged for a manager in this range.');
      return;
    }
    setDrawerQueue({ title: 'Listen to these first', rows: flagged, index: 0 });
    setDrawerRow(flagged[0]);
  };

  const stepQueue = (step: number) => {
    setDrawerQueue((current) => {
      if (!current) return current;
      const nextIndex = Math.min(Math.max(current.index + step, 0), current.rows.length - 1);
      setDrawerRow(current.rows[nextIndex]);
      return { ...current, index: nextIndex };
    });
  };

  const handleQueueDoneAndNext = async () => {
    if (!drawerQueue || !drawerRow) return;
    await handleMarkReviewed(drawerRow);
    if (drawerQueue.index >= drawerQueue.rows.length - 1) {
      closeDrawer();
    } else {
      stepQueue(1);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived view models
  // ---------------------------------------------------------------------------

  const periodLabel = rangePreset === 'today' || rangePreset === 'yesterday' ? 'same day last week' : 'previous period';

  const percentDelta = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  const sparkOf = (metric: (overview: CallDailyOverview) => number) =>
    dailySeries.map((point) => metric(point.overview));

  const kpiSpecs: KpiCardSpec[] = [
    {
      key: 'callsMade',
      label: 'Calls made',
      icon: Phone,
      value: dailyOverview.outboundCalls,
      delta: dailyOverview.outboundCalls - previousDailyOverview.outboundCalls,
      deltaPercent: percentDelta(dailyOverview.outboundCalls, previousDailyOverview.outboundCalls),
      deltaMode: 'percent',
      meaning: 'good-up',
      footnote: 'outbound sales calls',
      spark: sparkOf((overview) => overview.outboundCalls),
      onClick: () => applySummaryFilter('outboundSales'),
    },
    {
      key: 'conversations',
      label: 'Conversations',
      icon: UsersIcon,
      value: dailyOverview.outboundAnsweredCalls,
      delta: dailyOverview.outboundAnsweredCalls - previousDailyOverview.outboundAnsweredCalls,
      deltaPercent: percentDelta(dailyOverview.outboundAnsweredCalls, previousDailyOverview.outboundAnsweredCalls),
      deltaMode: 'percent',
      meaning: 'good-up',
      footnote: `${Math.round(dailyOverview.outboundAnswerRate || 0)}% answer rate`,
      spark: sparkOf((overview) => overview.outboundAnsweredCalls),
      onClick: () => applySummaryFilter('outboundAnswered'),
    },
    {
      key: 'leadsReached',
      label: 'Leads reached',
      icon: Target,
      value: dailyOverview.uniqueLeadsContacted,
      delta: dailyOverview.uniqueLeadsContacted - previousDailyOverview.uniqueLeadsContacted,
      deltaPercent: percentDelta(dailyOverview.uniqueLeadsContacted, previousDailyOverview.uniqueLeadsContacted),
      deltaMode: 'percent',
      meaning: 'good-up',
      footnote: `${(dailyOverview.contactRate || 0).toFixed(1)}% of leads called`,
      spark: sparkOf((overview) => overview.uniqueLeadsContacted),
      onClick: () => applySummaryFilter('outboundAnswered'),
    },
    {
      key: 'likelyToInstruct',
      label: 'Likely to instruct',
      icon: Brain,
      value: dailyOverview.instructionIntent,
      delta: dailyOverview.instructionIntent - previousDailyOverview.instructionIntent,
      deltaPercent: percentDelta(dailyOverview.instructionIntent, previousDailyOverview.instructionIntent),
      deltaMode: 'count',
      meaning: 'good-up',
      footnote: dailyOverview.instructionIntent > 0
        ? `AI signal — ${getRate(dailyOverview.officialInstructions, dailyOverview.instructionIntent)}% became instructions`
        : 'AI signal — not confirmed',
      spark: sparkOf((overview) => overview.instructionIntent),
      onClick: () => applySummaryFilter('instructionIntent'),
    },
    {
      key: 'instructions',
      label: 'Instructions',
      icon: CheckCircle,
      value: dailyOverview.officialInstructions,
      delta: dailyOverview.officialInstructions - previousDailyOverview.officialInstructions,
      deltaPercent: percentDelta(dailyOverview.officialInstructions, previousDailyOverview.officialInstructions),
      deltaMode: 'count+percent',
      meaning: 'good-up',
      footnote: `confirmed in CRM · ${(dailyOverview.contactToInstructionRate || 0).toFixed(1)}% of leads reached`,
      spark: sparkOf((overview) => overview.officialInstructions),
      hero: true,
      onClick: () => applySummaryFilter('officialInstruction'),
    },
    {
      key: 'speedToLead',
      label: 'Speed to lead',
      icon: Zap,
      value: dailyOverview.averageFirstOutboundDelaySeconds,
      displayValue: formatDelay(Math.round(dailyOverview.averageFirstOutboundDelaySeconds || 0)),
      delta: dailyOverview.averageFirstOutboundDelaySeconds - previousDailyOverview.averageFirstOutboundDelaySeconds,
      deltaPercent: percentDelta(dailyOverview.averageFirstOutboundDelaySeconds, previousDailyOverview.averageFirstOutboundDelaySeconds),
      deltaMode: 'percent',
      meaning: 'bad-up',
      footnote: 'avg new lead → first call',
      formatDelta: (value) => formatDelay(Math.round(Math.abs(value))),
      onClick: () => setActiveTab('agents'),
    },
  ];

  const funnelStages: FunnelStage[] = [
    {
      key: 'callsMade',
      label: 'Calls made',
      current: dailyOverview.outboundCalls,
      previous: previousDailyOverview.outboundCalls,
      onClick: () => applySummaryFilter('outboundSales'),
    },
    {
      key: 'conversations',
      label: 'Conversations',
      current: dailyOverview.outboundAnsweredCalls,
      previous: previousDailyOverview.outboundAnsweredCalls,
      onClick: () => applySummaryFilter('outboundAnswered'),
    },
    {
      key: 'leadsReached',
      label: 'Leads reached',
      current: dailyOverview.uniqueLeadsContacted,
      previous: previousDailyOverview.uniqueLeadsContacted,
      onClick: () => applySummaryFilter('outboundAnswered'),
    },
    {
      key: 'likelyToInstruct',
      label: 'Likely to instruct',
      current: dailyOverview.instructionIntent,
      previous: previousDailyOverview.instructionIntent,
      onClick: () => applySummaryFilter('instructionIntent'),
    },
    {
      key: 'instructions',
      label: 'Instructions',
      current: dailyOverview.officialInstructions,
      previous: previousDailyOverview.officialInstructions,
      onClick: () => applySummaryFilter('officialInstruction'),
    },
  ];

  const highlights = useMemo<Highlight[]>(() => {
    const result: Highlight[] = [];
    const moveMetrics = [
      { label: 'Conversations', current: dailyOverview.outboundAnsweredCalls, previous: previousDailyOverview.outboundAnsweredCalls },
      { label: 'Leads reached', current: dailyOverview.uniqueLeadsContacted, previous: previousDailyOverview.uniqueLeadsContacted },
      { label: 'Instructions', current: dailyOverview.officialInstructions, previous: previousDailyOverview.officialInstructions },
      { label: 'Calls made', current: dailyOverview.outboundCalls, previous: previousDailyOverview.outboundCalls },
    ];
    const withDeltas = moveMetrics
      .filter((metric) => metric.previous > 0)
      .map((metric) => ({ ...metric, percent: Math.round(((metric.current - metric.previous) / metric.previous) * 100) }));

    const best = withDeltas.filter((metric) => metric.percent > 0).sort((a, b) => b.percent - a.percent)[0];
    if (best) result.push({ tone: 'good', text: `${best.label} up ${best.percent}% vs ${periodLabel}.` });

    const worst = withDeltas.filter((metric) => metric.percent < 0).sort((a, b) => a.percent - b.percent)[0];
    if (worst) result.push({ tone: 'bad', text: `${worst.label} down ${Math.abs(worst.percent)}% vs ${periodLabel}.` });

    const backlogs = [
      { count: queueCounts.callbacksNotBooked, text: `${queueCounts.callbacksNotBooked} promised call-backs not booked yet.` },
      { count: queueCounts.missedHot, text: `${queueCounts.missedHot} hot inbound calls were missed.` },
      { count: dailyOverview.unmatchedOrAmbiguous, text: `${dailyOverview.unmatchedOrAmbiguous} calls still need linking to a lead.` },
    ].filter((item) => item.count > 0).sort((a, b) => b.count - a.count)[0];
    if (backlogs) result.push({ tone: 'warn', text: backlogs.text });

    return result.slice(0, 3);
  }, [dailyOverview, previousDailyOverview, queueCounts, periodLabel]);

  const queueSpecs: QueueCardSpec[] = [
    {
      key: 'flagged',
      title: 'Listen to these first',
      description: 'AI flagged these calls for a manager.',
      count: queueCounts.flaggedRows ? queueCounts.flaggedRows.length : null,
      capped: queueCounts.capped,
      tone: 'red',
      onOpen: openFlaggedQueue,
    },
    {
      key: 'missedHot',
      title: 'Missed hot calls',
      description: "They rang us first and we didn't speak.",
      count: queueCounts.loading ? null : queueCounts.missedHot,
      tone: 'red',
      onOpen: () => applySummaryFilter('missedHot'),
    },
    {
      key: 'toMatch',
      title: 'Calls to match',
      description: "We don't know whose call this is yet.",
      count: dailyOverview.unmatchedOrAmbiguous,
      tone: 'amber',
      extra: dailyOverview.possibleHotCalls > 0 ? `${formatNumber(dailyOverview.possibleHotCalls)} possible hot — match first` : undefined,
      onOpen: () => applySummaryFilter('unmatched'),
    },
    {
      key: 'callbacks',
      title: 'Call-backs promised, not booked',
      description: 'AI heard a promise; no diary task exists.',
      count: queueCounts.loading ? null : queueCounts.callbacksNotBooked,
      tone: 'amber',
      onOpen: () => applySummaryFilter('followUp'),
    },
    {
      key: 'intent',
      title: "Said they'll instruct — not signed yet",
      description: 'Likely instructions waiting on paperwork.',
      count: queueCounts.loading ? null : queueCounts.intentNotSigned,
      tone: 'navy',
      onOpen: () => applySummaryFilter('instructionIntent'),
    },
    {
      key: 'aiProblems',
      title: 'AI problems',
      description: summary.pendingAi > 0 ? `${formatNumber(summary.pendingAi)} still analysing in the background.` : 'Failed analyses to retry.',
      count: summary.failedAi,
      tone: 'red',
      onOpen: () => applySummaryFilter('failedAi'),
    },
  ];

  const callTypeSuggestions = useMemo(() => {
    const values = new Set<string>();
    signalBreakdowns.forEach((signal) => {
      if (signal.signalValue && signal.signalValue !== 'Not specified') values.add(signal.signalValue);
    });
    return Array.from(values).slice(0, 60);
  }, [signalBreakdowns]);

  const orderedSignalGroups = useMemo(() => {
    const groups = signalBreakdowns.reduce<Record<string, CallSignalBreakdown[]>>((accumulator, signal) => {
      if (!accumulator[signal.signalType]) accumulator[signal.signalType] = [];
      accumulator[signal.signalType].push(signal);
      return accumulator;
    }, {});

    const priority = [
      'Objection category',
      'Rejection reason',
      'Objection',
      'Knock back',
      'Follow-up reason',
      'Positive signal',
    ];

    return Object.entries(groups).sort(([left], [right]) => {
      const leftIndex = priority.findIndex((value) => left.toLowerCase().includes(value.toLowerCase()));
      const rightIndex = priority.findIndex((value) => right.toLowerCase().includes(value.toLowerCase()));
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
  }, [signalBreakdowns]);

  const themeGroupTitle = (signalType: string) => {
    const titles: Record<string, string> = {
      'Knock back': 'Knock-backs (lead declined)',
      'Objection category': 'Objection categories',
    };
    return titles[signalType] || signalType;
  };

  const moreFiltersActiveCount = [
    direction, callStatus, transcriptStatus, aiStatus, matchStatus, followUpNeeded, reviewStatus,
  ].filter((value) => value !== 'all').length + (callType.trim() ? 1 : 0);

  const canOpenSettings = user?.role === 'Admin' || user?.role === 'Manager';

  const datePresets: Array<{ id: Exclude<CallRangePreset, 'custom'>; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7', label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
  ];

  const callsPresets: Array<{ label: string; onApply: () => void }> = [
    {
      label: "Yesterday's missed hot calls",
      onApply: () => {
        applyDatePreset('yesterday');
        applySummaryFilter('missedHot');
      },
    },
    {
      label: 'Price objections this week',
      onApply: () => {
        applyDatePreset('last7');
        clearFocusedFilters();
        setActiveTab('calls');
        setCallType('price');
      },
    },
    { label: 'Flagged for a manager', onApply: openFlaggedQueue },
    { label: "Said they'll instruct", onApply: () => applySummaryFilter('instructionIntent') },
    { label: 'Promised call-back, not booked', onApply: () => applySummaryFilter('followUp') },
    { label: 'Calls to match', onApply: () => applySummaryFilter('unmatched') },
    { label: 'AI failed', onApply: () => applySummaryFilter('failedAi') },
    { label: 'Third-time-lucky', onApply: () => applySummaryFilter('attempt3') },
  ];

  const viewSegments: Array<{ id: string; label: string; count: number; isActive: boolean; onApply: () => void }> = [
    {
      id: 'all',
      label: 'All',
      count: summary.totalCalls,
      isActive: reviewStatus === 'all' && followUpNeeded === 'all' && !callType.trim(),
      onApply: () => {
        clearFocusedFilters();
      },
    },
    {
      id: 'needsReview',
      label: 'Needs review',
      count: summary.needsReview,
      isActive: reviewStatus === 'needs_review',
      onApply: () => {
        clearFocusedFilters();
        setReviewStatus('needs_review');
      },
    },
    {
      id: 'followUp',
      label: 'Call-backs',
      count: summary.followUpNeeded,
      isActive: followUpNeeded === 'yes',
      onApply: () => {
        clearFocusedFilters();
        setFollowUpNeeded('yes');
      },
    },
    {
      id: 'inboundHot',
      label: 'Hot inbound',
      count: summary.inboundHotCalls,
      isActive: callType.trim() === 'inbound_hot',
      onApply: () => {
        clearFocusedFilters();
        setCallType('inbound_hot');
      },
    },
  ];

  const rowActions = {
    onOpenDrawer: openDrawer,
    onOpenLead: (leadId: string) => navigate(`/lead-management?leadId=${leadId}`),
    onLink: openLinkModal,
    onSchedule: openScheduleModal,
    onAnalyse: handleAnalyze,
    onDone: handleMarkReviewed,
    onDismiss: handleDismissCall,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Call Analysis</h1>
            {summary.pendingAi > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                APCM AI analysing {formatNumber(summary.pendingAi)} calls
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Yesterday's calls, AI call summaries, and what needs action today.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            disabled={isLoading}
            title="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Preparing export...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <PipelineStatusStrip
        status={threeCxStatus}
        pendingAi={summary.pendingAi}
        failedAi={summary.failedAi}
        canOpenSettings={canOpenSettings}
        onOpenSettings={() => navigate('/settings')}
      />

      {(error || notice) && (
        <div className={`rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || notice}
        </div>
      )}

      {stagedRefreshCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <span>{formatNumber(stagedRefreshCount)} calls finished analysing while you were working.</span>
          <button type="button" onClick={applyStagedRows} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-blue-900 shadow-sm hover:bg-blue-100">
            Refresh list
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="sticky top-0 z-20 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {datePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyDatePreset(preset.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                rangePreset === preset.id ? 'bg-navy-950 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <input
            type="date"
            value={startDate}
            onChange={(event) => handleDateChange(setStartDate, event.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-navy-950 focus:outline-none focus:ring-1 focus:ring-navy-950"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => handleDateChange(setEndDate, event.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-navy-950 focus:outline-none focus:ring-1 focus:ring-navy-950"
          />
          <select
            value={agentUserId}
            onChange={(event) => handleFilterChange(setAgentUserId, event.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-navy-950 focus:outline-none focus:ring-1 focus:ring-navy-950"
          >
            <option value="all">All agents</option>
            {users.map((crmUser) => (
              <option key={crmUser.id} value={crmUser.id}>{crmUser.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMoreFiltersOpen((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              moreFiltersOpen || moreFiltersActiveCount > 0 ? 'bg-navy-50 text-navy-950' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            More filters{moreFiltersActiveCount > 0 ? ` (${moreFiltersActiveCount})` : ''}
            <ChevronDown className={`h-4 w-4 transition-transform ${moreFiltersOpen ? 'rotate-180' : ''}`} />
          </button>
          {activeFilterChips.length > 0 && (
            <button
              type="button"
              onClick={clearFocusedFilters}
              className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Clear all
            </button>
          )}
        </div>

        {activeFilterChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-950">
                {chip.label}
                <button type="button" onClick={() => { chip.onClear(); resetToFirstPage(); }} className="rounded-full p-0.5 hover:bg-white" title="Remove filter">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {moreFiltersOpen && (
          <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Direction</span>
              <select value={direction} onChange={(event) => handleFilterChange(setDirection, event.target.value)} className="input-field text-sm">
                <option value="all">All directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Call status</span>
              <select value={callStatus} onChange={(event) => handleFilterChange(setCallStatus, event.target.value)} className="input-field text-sm">
                <option value="all">All statuses</option>
                <option value="answered">Answered</option>
                <option value="missed">Missed</option>
                <option value="voicemail">Voicemail</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Transcript</span>
              <select value={transcriptStatus} onChange={(event) => handleFilterChange(setTranscriptStatus, event.target.value)} className="input-field text-sm">
                <option value="all">All transcripts</option>
                <option value="received">Transcript received</option>
                <option value="pending">Awaiting transcript</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">AI status</span>
              <select value={aiStatus} onChange={(event) => handleFilterChange(setAiStatus, event.target.value)} className="input-field text-sm">
                <option value="all">All AI statuses</option>
                <option value="not_analyzed">Awaiting AI analysis</option>
                <option value="completed">Analysed by AI</option>
                <option value="failed">AI analysis failed</option>
                <option value="analyzing">Analysing</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Lead link</span>
              <select value={matchStatus} onChange={(event) => handleFilterChange(setMatchStatus, event.target.value)} className="input-field text-sm">
                <option value="all">All link statuses</option>
                <option value="matched">Linked to a lead</option>
                <option value="unmatched">Not linked to a lead</option>
                <option value="ambiguous">Ambiguous match</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Call-back</span>
              <select value={followUpNeeded} onChange={(event) => handleFilterChange(setFollowUpNeeded, event.target.value)} className="input-field text-sm">
                <option value="all">All calls</option>
                <option value="yes">Call-back promised</option>
                <option value="no">No call-back promised</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Review</span>
              <select value={reviewStatus} onChange={(event) => handleFilterChange(setReviewStatus, event.target.value)} className="input-field text-sm">
                <option value="all">All review statuses</option>
                <option value="needs_review">Needs review</option>
                <option value="pending_review">Pending review</option>
                <option value="reviewed">Done</option>
                <option value="ignored">Dismissed</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Call type / tag / signal</span>
              <input
                type="text"
                value={callType}
                onChange={(event) => handleFilterChange(setCallType, event.target.value)}
                placeholder="Hot inbound, voicemail, price objection, callback..."
                list="call-analysis-signal-suggestions"
                className="input-field text-sm"
              />
              <datalist id="call-analysis-signal-suggestions">
                {callTypeSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'agents', label: 'Agents', icon: UsersIcon },
          { id: 'insights', label: 'AI Insights', icon: Brain },
          { id: 'calls', label: 'Calls', icon: Phone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id as CallAnalysisTab)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'border-navy-950 text-navy-950' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'calls' && summary.needsReview > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {formatNumber(summary.needsReview)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {kpiSpecs.map((spec) => (
              <KpiCard key={spec.key} spec={spec} />
            ))}
          </div>

          <QueueStrip queues={queueSpecs} />

          <HighlightsBar highlights={highlights} />

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <TrendPanel series={dailySeries} metric={trendMetric} onMetricChange={setTrendMetric} />
            <FunnelPanel
              stages={funnelStages}
              caption="Likely to instruct is AI-detected (leading). Instructions are CRM truth (lagging)."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <InboundPanel
              hotCalls={dailyOverview.inboundHotCalls}
              possibleHotCalls={dailyOverview.possibleHotCalls}
              hotInstructed={inboundHotInstructed}
              onViewHot={() => applySummaryFilter('inboundHot')}
              onReviewPossibleHot={() => applySummaryFilter('possibleHot')}
            />
            <EffortPanel
              overview={dailyOverview}
              agents={agentBreakdown}
              onAttemptClick={(bucket) => applySummaryFilter(`attempt${bucket}`)}
            />
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="space-y-5">
          <TeamAverageStrip overview={dailyOverview} />
          <AgentLeaderboard
            agents={agentBreakdown}
            previousAgents={previousAgentBreakdown}
            onAgentClick={(clickedAgentUserId) => {
              if (!clickedAgentUserId) return;
              setAgentUserId(clickedAgentUserId);
              resetToFirstPage();
              setActiveTab('calls');
            }}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-5">
          <SignalSummaryRow
            overview={dailyOverview}
            previous={previousDailyOverview}
            aiAnalysed={dailyOverview.aiAnalysed}
            pendingAi={summary.pendingAi}
            onTileClick={(signalValue) => applyThemeFilter({ signalType: 'Signal', signalValue })}
          />
          <div className="grid gap-5 xl:grid-cols-2">
            <CoachingRatioCard uspMentions={dailyOverview.uspMentions} priceConcerns={dailyOverview.priceConcerns} />
            <ObjectionShiftStrip current={signalBreakdowns} previous={previousSignalBreakdowns} />
          </div>
          <RiskFlagsPanel
            flagged={queueCounts.flaggedRows
              ? queueCounts.flaggedRows.map((row) => ({ callId: row.id, leadName: row.leadName, flags: row.managerRiskFlags }))
              : null}
            onOpenQueue={openFlaggedQueue}
          />
          {orderedSignalGroups.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {orderedSignalGroups.map(([signalType, signals]) => (
                <ThemeBreakdownCard
                  key={signalType}
                  title={themeGroupTitle(signalType)}
                  signals={signals}
                  onSignalClick={(signal) => applyThemeFilter(signal)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
              <Brain className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">No AI themes yet</h3>
              <p className="mt-1 text-sm text-gray-500">Themes appear once APCM AI has analysed calls in this range.</p>
            </div>
          )}
          <AiCoverageFooter
            aiAnalysed={summary.aiAnalysed}
            transcriptsReceived={summary.transcriptsReceived}
            pendingAi={summary.pendingAi}
          />
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {viewSegments.map((segment) => (
              <button
                key={segment.id}
                type="button"
                onClick={() => { segment.onApply(); }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  segment.isActive ? 'bg-navy-950 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {segment.label} ({formatNumber(segment.count)})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {callsPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={preset.onApply}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-navy-950 hover:text-navy-950"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <BulkActionBar
              count={selectedIds.size}
              analyseCap={SELECTED_ANALYSIS_BATCH_LIMIT}
              analysing={isAnalyzingSelected}
              progress={selectedAnalysisProgress}
              onAnalyse={handleAnalyzeSelected}
              onDone={handleMarkSelectedDone}
              onDismiss={handleDismissSelected}
              onExportSelected={handleExportSelected}
              onClear={() => setSelectedIds(new Set())}
            />
          )}

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">All calls</h2>
                <p className="text-sm text-gray-500">
                  Showing {formatNumber(rows.length)} of {formatNumber(totalCount)} matching calls.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center text-gray-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading call analysis...
              </div>
            ) : rows.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
                <Phone className="h-10 w-10 text-gray-300" />
                {activeFilterChips.length > 0 ? (
                  <>
                    <h3 className="mt-3 text-sm font-semibold text-gray-900">No calls match these filters</h3>
                    <button
                      type="button"
                      onClick={clearFocusedFilters}
                      className="mt-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="mt-3 text-sm font-semibold text-gray-900">No calls imported for this period yet</h3>
                    <p className="mt-1 max-w-md text-sm text-gray-500">
                      Calls arrive overnight from the phone system.
                      {canOpenSettings ? ' Check Settings → 3CX / Call Intelligence if you expected data here.' : ''}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <CallsTable
                    rows={rows}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    analysingId={analyzingId}
                    reviewingId={reviewingId}
                    bookedMap={bookedMap}
                    {...rowActions}
                  />
                </div>
                <div className="md:hidden">
                  <CallCardList
                    rows={rows}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    analysingId={analyzingId}
                    reviewingId={reviewingId}
                    bookedMap={bookedMap}
                    {...rowActions}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CallDrawer
        row={drawerRow}
        onClose={closeDrawer}
        queue={drawerQueue ? {
          title: drawerQueue.title,
          index: drawerQueue.index,
          total: drawerQueue.rows.length,
          onPrev: () => stepQueue(-1),
          onNext: () => stepQueue(1),
          onDoneAndNext: handleQueueDoneAndNext,
        } : null}
        analysing={analyzingId === drawerRow?.id}
        reviewing={reviewingId === drawerRow?.id}
        bookedMap={bookedMap}
        {...rowActions}
      />

      {scheduleRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Book a call-back</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Confirm the follow-up before creating a diary task and contact attempt activity.
                </p>
              </div>
              <button type="button" onClick={closeScheduleModal} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Linked lead</p>
                <p className="mt-1 font-semibold text-blue-950">{getLeadLabel(scheduleRow)}</p>
                <p className="mt-1 text-sm text-blue-900">
                  {formatDateTime(scheduleRow.startedAt)} · {getCallPhone(scheduleRow)}
                  {scheduleRow.agentName ? ` · ${scheduleRow.agentName}` : ''}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Attempt type</span>
                  <input
                    type="text"
                    value="Call"
                    readOnly
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Priority</span>
                  <select
                    value={schedulePriority}
                    onChange={(event) => setSchedulePriority(event.target.value as 'High' | 'Medium' | 'Low')}
                    className="input-field text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Scheduled date</span>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(event) => setScheduleDate(event.target.value)}
                    className="input-field text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Scheduled time</span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    className="input-field text-sm"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Notes</span>
                <textarea
                  value={scheduleNotes}
                  onChange={(event) => setScheduleNotes(event.target.value)}
                  rows={8}
                  className="input-field text-sm leading-6"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeScheduleModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleContactAttempt}
                disabled={!scheduleDate || !scheduleTime || isSchedulingAttempt}
                className="btn-primary inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSchedulingAttempt ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Book call-back
              </button>
            </div>
          </div>
        </div>
      )}

      {linkRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Link call to lead</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Match this call manually when the automatic matcher could not choose safely.
                </p>
              </div>
              <button type="button" onClick={closeLinkModal} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Call</p>
                    <p className="mt-1 font-medium text-gray-900">{formatDateTime(linkRow.startedAt)} · {getCallPhone(linkRow)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current status</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={statusChipClass(matchTone(linkRow.matchStatus))}>{matchLabel(linkRow.matchStatus)}</span>
                      <span className={statusChipClass(reviewTone(linkRow.reviewStatus))}>{reviewLabel(linkRow.reviewStatus)}</span>
                    </div>
                  </div>
                  {linkRow.leadName && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Currently linked</p>
                      <p className="mt-1 text-gray-900">{linkRow.leadName}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Search leads</span>
                    <input
                      type="text"
                      value={leadSearch}
                      onChange={(event) => setLeadSearch(event.target.value)}
                      placeholder="Search by name, email, or phone"
                      className="input-field text-sm"
                    />
                  </label>

                  <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                    {isSearchingLeads ? (
                      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching leads...
                      </div>
                    ) : leadOptions.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-500">No leads found.</div>
                    ) : (
                      leadOptions.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelectedLeadOption(lead)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                            selectedLeadOption?.id === lead.id
                              ? 'border-navy-950 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{lead.name}</p>
                              <p className="mt-0.5 break-words text-xs text-gray-500">
                                {[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}
                              </p>
                            </div>
                            {lead.assignedToName && (
                              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                {lead.assignedToName}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {lead.shortCode && <span className={statusChipClass('blue')}>{lead.shortCode}</span>}
                            {lead.stage && <span className={statusChipClass('gray')}>{lead.stage}</span>}
                            {lead.status && <span className={statusChipClass('gray')}>{lead.status}</span>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected lead</p>
                    {selectedLeadOption ? (
                      <div className="mt-2 text-sm">
                        <p className="font-semibold text-gray-900">{selectedLeadOption.name}</p>
                        <p className="mt-1 text-gray-600">{[selectedLeadOption.email, selectedLeadOption.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                        {selectedLeadOption.assignedToName && (
                          <p className="mt-2 text-xs text-gray-500">Owner: {selectedLeadOption.assignedToName}</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">Choose the correct lead from the search results.</p>
                    )}
                  </div>

                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Reason / note</span>
                    <textarea
                      value={manualLinkReason}
                      onChange={(event) => setManualLinkReason(event.target.value)}
                      rows={4}
                      placeholder="Example: Phone number confirmed by transcript."
                      className="input-field text-sm"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeLinkModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkCallToLead}
                disabled={!selectedLeadOption || isLinkingCall}
                className="btn-primary inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLinkingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Link call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallAnalysis;
