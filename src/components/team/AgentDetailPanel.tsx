import React from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Sparkline } from "@/components/trends/Sparkline";
import { TrendLineChart } from "@/components/trends/TrendLineChart";

interface Agent {
  id: string;
  name: string;
  initials: string;
  rank: number;
  score: number;
  scoreTrend: number[];
  scoreDelta: number;
  conversion: number;
  sentiment: number;
  callsMade: number;
  answerRate: number;
  instructions: number;
  coaching: number;
  quotaUsed: number;
  quotaTarget: number;
  status: "top" | "steady" | "watch";
  highlight?: string;
  connect: number;
  convert: number;
  quality: number;
  speedToLeadH: number;
  coachingNote: string;
}

interface Props {
  agent: Agent | null;
  onClose: () => void;
  onOpenCalls?: (id: string) => void;
}

const statusChip: Record<
  Agent["status"],
  { cls: string; label: string }
> = {
  top: { cls: "bg-green-50 text-green-700", label: "Top performer" },
  steady: { cls: "bg-blue-50 text-blue-700", label: "Steady" },
  watch: { cls: "bg-amber-50 text-amber-700", label: "Needs attention" },
};

function barColor(v: number): string {
  if (v >= 75) return "#16a34a";
  if (v >= 55) return "#f59e0b";
  return "#ef4444";
}

export const AgentDetailPanel: React.FC<Props> = ({
  agent,
  onClose,
  onOpenCalls,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!agent) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [agent, onClose]);

  if (!agent) return null;

  const chip = statusChip[agent.status];

  const sentimentColor =
    agent.sentiment > 0
      ? "text-green-600"
      : agent.sentiment < 0
      ? "text-red-600"
      : "text-gray-500";
  const sentimentText =
    (agent.sentiment > 0 ? "+" : "") + agent.sentiment.toFixed(2);

  const deltaColor =
    agent.scoreDelta > 0
      ? "text-green-600"
      : agent.scoreDelta < 0
      ? "text-red-600"
      : "text-gray-400";
  const DeltaIcon =
    agent.scoreDelta > 0
      ? ArrowUpRight
      : agent.scoreDelta < 0
      ? ArrowDownRight
      : Minus;
  const deltaText = (agent.scoreDelta > 0 ? "+" : "") + agent.scoreDelta;

  const breakdown: { label: string; value: number }[] = [
    { label: "Connect", value: agent.connect },
    { label: "Convert", value: agent.convert },
    { label: "Quality", value: agent.quality },
  ];

  const metrics: { label: string; node: React.ReactNode }[] = [
    { label: "Conversion", node: <>{agent.conversion}%</> },
    {
      label: "Sentiment",
      node: <span className={sentimentColor}>{sentimentText}</span>,
    },
    { label: "Calls", node: <>{agent.callsMade}</> },
    { label: "Answer", node: <>{agent.answerRate}%</> },
    { label: "Instructions", node: <>{agent.instructions}</> },
    { label: "Coaching", node: <>{agent.coaching}</> },
    { label: "Speed to lead", node: <>{agent.speedToLeadH}h</> },
    {
      label: "Quota",
      node: (
        <>
          {agent.quotaUsed}/{agent.quotaTarget}
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-detail-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: "#1e3a8a" }}
            >
              {agent.initials}
            </div>
            <div className="flex flex-col">
              <span id="agent-detail-title" className="text-lg font-semibold text-gray-900">
                {agent.name}
              </span>
              <span className="text-xs text-gray-400">#{agent.rank}</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}
            >
              {chip.label}
            </span>
          </div>

          {/* Score block */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div>
              <div className="text-xs text-gray-500">Performance score</div>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold tabular-nums">
                  {agent.score}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-sm font-medium ${deltaColor}`}
                >
                  <DeltaIcon className="h-4 w-4" />
                  {deltaText}
                </span>
              </div>
            </div>
            <Sparkline
              points={agent.scoreTrend}
              color={agent.scoreDelta >= 0 ? "#16a34a" : "#ef4444"}
              width={160}
              height={40}
            />
          </div>

          {/* Performance trend */}
          <TrendLineChart
            title="Performance trend"
            caption="Recent scores"
            height={170}
            area
            series={[
              {
                key: "score",
                label: "Score",
                color: "#1e3a8a",
                points: agent.scoreTrend.map((y, i) => ({
                  x: String(i + 1),
                  y,
                })),
              },
            ]}
          />

          {/* Coaching breakdown */}
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-sm font-semibold text-gray-900">
              Coaching breakdown
            </div>
            <div className="text-xs text-gray-500">
              Connect 50% · Convert 30% · Quality 20%
            </div>
            <div className="mt-3 space-y-2">
              {breakdown.map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-gray-600">
                    {row.label}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${row.value}%`,
                        backgroundColor: barColor(row.value),
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold tabular-nums">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="text-[11px] text-gray-500">{m.label}</div>
                <div className="text-sm font-semibold tabular-nums">
                  {m.node}
                </div>
              </div>
            ))}
          </div>

          {/* AI coaching note */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-800" />
              <span className="text-xs font-semibold text-blue-800">
                APCM AI coaching note
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700">{agent.coachingNote}</p>
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onOpenCalls && onOpenCalls(agent.id)}
              className="flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-900"
            >
              Open their calls
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
