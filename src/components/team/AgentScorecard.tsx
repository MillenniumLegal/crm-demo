import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from "lucide-react";
import { Sparkline } from "@/components/trends/Sparkline";

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
}

interface Props {
  agent: Agent;
  onOpen?: (id: string) => void;
}

const STATUS_STYLES: Record<Agent["status"], { className: string; label: string }> = {
  top: { className: "bg-green-50 text-green-700", label: "Top" },
  steady: { className: "bg-blue-50 text-blue-700", label: "Steady" },
  watch: { className: "bg-amber-50 text-amber-700", label: "Watch" },
};

function formatSentiment(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return sign + Math.abs(value).toFixed(2);
}

export const AgentScorecard: React.FC<Props> = ({ agent, onOpen }) => {
  const status = STATUS_STYLES[agent.status];

  const deltaPositive = agent.scoreDelta > 0;
  const deltaNegative = agent.scoreDelta < 0;
  const DeltaIcon = deltaPositive ? ArrowUpRight : deltaNegative ? ArrowDownRight : Minus;
  const deltaColor = deltaPositive
    ? "text-green-600"
    : deltaNegative
      ? "text-red-600"
      : "text-gray-400";

  const sentimentColor =
    agent.sentiment > 0
      ? "text-green-600"
      : agent.sentiment < 0
        ? "text-red-600"
        : "text-gray-500";

  const quotaPct =
    agent.quotaTarget > 0
      ? Math.min(100, (agent.quotaUsed / agent.quotaTarget) * 100)
      : 0;
  const quotaMet = agent.quotaUsed >= agent.quotaTarget && agent.quotaTarget > 0;
  const quotaColor = quotaMet ? "#16a34a" : "#1e3a8a";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="rounded bg-gray-100 px-1.5 text-xs font-semibold text-gray-600 tabular-nums">
          #{agent.rank}
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: "#1e3a8a" }}
        >
          {agent.initials}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-gray-900">{agent.name}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">Performance score</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">
              {agent.score}
            </span>
            <span className={`flex items-center gap-0.5 ${deltaColor}`}>
              <DeltaIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums">
                {agent.scoreDelta > 0 ? "+" : ""}
                {agent.scoreDelta}
              </span>
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Sparkline
            points={agent.scoreTrend}
            color={agent.scoreDelta >= 0 ? "#16a34a" : "#ef4444"}
            width={120}
            height={34}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        <div>
          <div className="text-[11px] text-gray-500">Conversion</div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">
            {agent.conversion}%
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Sentiment</div>
          <div className={`text-sm font-semibold tabular-nums ${sentimentColor}`}>
            {formatSentiment(agent.sentiment)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Calls</div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">
            {agent.callsMade}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Answer</div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">
            {agent.answerRate}%
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Instructions</div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">
            {agent.instructions}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500">Coaching</div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">
            {agent.coaching}
          </div>
        </div>
      </div>

      {/* Quota bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Quota</span>
          <span className="tabular-nums">
            {agent.quotaUsed}/{agent.quotaTarget}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            style={{
              height: "100%",
              width: `${quotaPct}%`,
              borderRadius: "9999px",
              backgroundColor: quotaColor,
            }}
          />
        </div>
      </div>

      {/* Highlight */}
      {agent.highlight ? (
        <div className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          {agent.highlight}
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpen && onOpen(agent.id)}
          className="flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900"
        >
          Open calls
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
