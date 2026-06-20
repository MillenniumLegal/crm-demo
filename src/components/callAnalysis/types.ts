// Prop contracts for the Call Analysis 2.0 components.
// The page container (src/pages/CallAnalysis.tsx) owns ALL state and handlers;
// every component here is presentational and receives data + callbacks only.

import { LucideIcon } from 'lucide-react';
import {
  CallAgentDailyBreakdown,
  CallAnalysisRow,
  CallDailyOverview,
  CallSignalBreakdown,
  ThreeCxStatus,
} from '@/services/threecxService';
import { DeltaMeaning } from './format';

// ---------------------------------------------------------------------------
// Hero KPI row
// ---------------------------------------------------------------------------

export interface KpiCardSpec {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Raw numeric value (used for delta math). */
  value: number;
  /** Formatted display override, e.g. "1h 10m" for speed to lead. */
  displayValue?: string;
  /** current - previous. null = previous period has no data at all. */
  delta: number | null;
  /** Percent change vs previous. null when previous is 0 or unknown. */
  deltaPercent: number | null;
  deltaMode: 'percent' | 'count' | 'count+percent';
  meaning: DeltaMeaning;
  footnote: string;
  /** Daily values for the sparkline; omit or all-zero = no sparkline. */
  spark?: number[];
  /** Visually emphasised card (Instructions). */
  hero?: boolean;
  /** Format delta values for display (e.g. seconds -> "12m"). Defaults to en-GB number. */
  formatDelta?: (value: number) => string;
  onClick?: () => void;
}

export interface KpiCardProps {
  spec: KpiCardSpec;
}

export interface DeltaChipProps {
  delta: number | null;
  deltaPercent: number | null;
  mode: 'percent' | 'count' | 'count+percent';
  meaning: DeltaMeaning;
  formatValue?: (value: number) => string;
}

export interface SparklineProps {
  values: number[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Funnel + trend
// ---------------------------------------------------------------------------

export interface FunnelStage {
  key: string;
  label: string;
  current: number;
  previous: number;
  onClick?: () => void;
}

export interface FunnelPanelProps {
  stages: FunnelStage[];
  caption: string;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  overview: CallDailyOverview;
}

export type TrendMetricKey = 'outboundCalls' | 'outboundAnsweredCalls' | 'instructionIntent' | 'officialInstructions';

export interface TrendPanelProps {
  series: TrendPoint[];
  metric: TrendMetricKey;
  onMetricChange: (metric: TrendMetricKey) => void;
}

// ---------------------------------------------------------------------------
// Highlights + queues
// ---------------------------------------------------------------------------

export interface Highlight {
  tone: 'good' | 'bad' | 'warn';
  text: string;
}

export interface HighlightsBarProps {
  highlights: Highlight[];
}

export interface QueueCardSpec {
  key: string;
  title: string;
  description: string;
  /** null = still loading the range scan. */
  count: number | null;
  /** True when the underlying scan hit its cap, display "10,000+". */
  capped?: boolean;
  tone: 'red' | 'amber' | 'navy';
  /** Optional extra line, e.g. "3 possible hot — match first". */
  extra?: string;
  onOpen: () => void;
}

export interface QueueStripProps {
  queues: QueueCardSpec[];
}

// ---------------------------------------------------------------------------
// Pipeline status + AI coverage
// ---------------------------------------------------------------------------

export interface PipelineStatusStripProps {
  status: ThreeCxStatus | null;
  pendingAi: number;
  failedAi: number;
  /** Admins/managers see the Settings deep link. */
  canOpenSettings: boolean;
  onOpenSettings: () => void;
}

export interface AiCoverageFooterProps {
  aiAnalysed: number;
  transcriptsReceived: number;
  pendingAi: number;
}

// ---------------------------------------------------------------------------
// Overview side panels
// ---------------------------------------------------------------------------

export interface InboundPanelProps {
  hotCalls: number;
  possibleHotCalls: number;
  /** Hot inbound calls in range that became instructions (from the inbound-hot summary fetch). */
  hotInstructed: number;
  onViewHot: () => void;
  onReviewPossibleHot: () => void;
}

export interface EffortPanelProps {
  overview: CallDailyOverview;
  agents: CallAgentDailyBreakdown[];
  onAttemptClick: (bucket: 1 | 2 | 3) => void;
}

// ---------------------------------------------------------------------------
// Agents tab
// ---------------------------------------------------------------------------

export interface TeamAverageStripProps {
  overview: CallDailyOverview;
}

export interface AgentLeaderboardProps {
  agents: CallAgentDailyBreakdown[];
  /** Same RPC for the previous period; used for rank movement + deltas. May be empty. */
  previousAgents: CallAgentDailyBreakdown[];
  onAgentClick: (agentUserId?: string) => void;
}

// ---------------------------------------------------------------------------
// AI insights tab
// ---------------------------------------------------------------------------

export interface SignalSummaryRowProps {
  overview: CallDailyOverview;
  previous: CallDailyOverview;
  aiAnalysed: number;
  pendingAi: number;
  onTileClick: (signalValue: string) => void;
}

export interface CoachingRatioCardProps {
  uspMentions: number;
  priceConcerns: number;
}

export interface RiskFlaggedCall {
  callId: string;
  leadName?: string;
  flags: string[];
}

export interface RiskFlagsPanelProps {
  /** null = scan still loading. */
  flagged: RiskFlaggedCall[] | null;
  onOpenQueue: () => void;
}

export interface ObjectionShiftStripProps {
  current: CallSignalBreakdown[];
  previous: CallSignalBreakdown[];
}

// ---------------------------------------------------------------------------
// Calls table + drawer
// ---------------------------------------------------------------------------

export interface CallRowActions {
  onOpenDrawer: (row: CallAnalysisRow) => void;
  onOpenLead: (leadId: string) => void;
  onLink: (row: CallAnalysisRow) => void;
  onSchedule: (row: CallAnalysisRow) => void;
  /** Run / re-run APCM AI for one call. */
  onAnalyse: (row: CallAnalysisRow) => void;
  /** Mark reviewed ("Done"). */
  onDone: (row: CallAnalysisRow) => void;
  /** Dismiss with note ("Dismiss") — note collected by the component popover. */
  onDismiss: (row: CallAnalysisRow, note: string) => void;
}

export interface CallsTableProps extends CallRowActions {
  rows: CallAnalysisRow[];
  selectedIds: Set<string>;
  onToggleSelected: (row: CallAnalysisRow) => void;
  analysingId: string | null;
  reviewingId: string | null;
  /** callRecordId -> a call-back has been booked from Call Analysis. */
  bookedMap: Record<string, boolean>;
}

export type CallCardListProps = CallsTableProps;

export interface BulkActionBarProps {
  count: number;
  /** Cap shown in the inline confirm (SELECTED_ANALYSIS_BATCH_LIMIT). */
  analyseCap: number;
  analysing: boolean;
  progress?: string;
  onAnalyse: () => void;
  onDone: () => void;
  onDismiss: (note: string) => void;
  onExportSelected: () => void;
  onClear: () => void;
}

export interface DrawerQueueState {
  title: string;
  index: number; // 0-based
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDoneAndNext: () => void;
}

export interface CallDrawerProps extends CallRowActions {
  row: CallAnalysisRow | null;
  onClose: () => void;
  queue?: DrawerQueueState | null;
  analysing: boolean;
  reviewing: boolean;
  bookedMap: Record<string, boolean>;
}
