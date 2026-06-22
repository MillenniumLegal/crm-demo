import React from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Sparkline } from "@/components/trends/Sparkline";

interface LbAgent {
  id: string;
  name: string;
  initials: string;
  rank: number;
  score: number;
  scoreTrend: number[];
  scoreDelta: number;
  instructions: number;
  conversion: number;
  status: "top" | "steady" | "watch";
}

interface Props {
  title?: string;
  caption?: string;
  agents: LbAgent[];
  onOpen?: (id: string) => void;
}

const STATUS_COLOR: Record<LbAgent["status"], string> = {
  top: "#16a34a",
  steady: "#1e3a8a",
  watch: "#f59e0b",
};

function rankColor(rank: number): string {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#6b7280";
  if (rank === 3) return "#b45309";
  return "";
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

export const TeamLeaderboard: React.FC<Props> = ({
  title = "Leaderboard",
  caption = "Blended performance score, last 30 days",
  agents,
  onOpen,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{caption}</p>
      </div>

      {agents.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400">No agents yet</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {agents.map((a) => {
            const rc = rankColor(a.rank);
            const fillWidth = clampScore(a.score);
            const deltaPositive = a.scoreDelta >= 0;
            const deltaColor =
              a.scoreDelta > 0 ? "#16a34a" : a.scoreDelta < 0 ? "#ef4444" : "#6b7280";
            const DeltaIcon =
              a.scoreDelta > 0 ? ArrowUp : a.scoreDelta < 0 ? ArrowDown : ArrowRight;

            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen && onOpen(a.id)}
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50"
              >
                <span
                  className="w-6 text-center font-bold"
                  style={rc ? { color: rc } : undefined}
                >
                  <span className={rc ? "" : "text-gray-400"}>{a.rank}</span>
                </span>

                <span
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: "#1e3a8a" }}
                >
                  {a.initials}
                </span>

                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {a.name}
                  </span>
                  <span className="h-1.5 rounded-full bg-gray-100 w-full overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: fillWidth + "%",
                        backgroundColor: STATUS_COLOR[a.status],
                      }}
                    />
                  </span>
                </span>

                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {a.score}
                  </span>
                  <span
                    className="inline-flex items-center text-[11px] tabular-nums"
                    style={{ color: deltaColor }}
                  >
                    <DeltaIcon className="h-3 w-3" />
                    {deltaPositive && a.scoreDelta > 0 ? "+" : ""}
                    {a.scoreDelta}
                  </span>
                  <Sparkline
                    points={a.scoreTrend}
                    color={a.scoreDelta >= 0 ? "#16a34a" : "#ef4444"}
                    width={64}
                    height={22}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
