import React from "react";

interface WbAgent {
  id: string;
  name: string;
  quotaUsed: number;
  quotaTarget: number;
}

interface Props {
  title?: string;
  caption?: string;
  agents: WbAgent[];
}

export const WorkloadBalance: React.FC<Props> = ({
  title = "Workload balance",
  caption = "Daily quota attainment",
  agents,
}) => {
  const hasAgents = agents.length > 0;

  const sumUsed = agents.reduce((acc, a) => acc + a.quotaUsed, 0);
  const sumTarget = agents.reduce((acc, a) => acc + a.quotaTarget, 0);
  const teamPct = sumTarget > 0 ? Math.round((sumUsed / sumTarget) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{caption}</p>
      </div>

      {!hasAgents ? (
        <div className="py-6 text-center text-xs text-gray-400">No agents</div>
      ) : (
        <>
          <div className="space-y-3">
            {agents.map((agent) => {
              const pct =
                agent.quotaTarget > 0
                  ? (agent.quotaUsed / agent.quotaTarget) * 100
                  : 0;

              let statusWord = "Below";
              let statusClass = "text-gray-500";
              if (pct >= 100) {
                statusWord = "Full";
                statusClass = "text-green-600";
              } else if (pct >= 80) {
                statusWord = "On track";
                statusClass = "text-blue-700";
              } else if (pct < 60) {
                statusWord = "Light";
                statusClass = "text-amber-600";
              }

              const fillColor =
                pct >= 100 ? "#16a34a" : pct >= 60 ? "#1e3a8a" : "#f59e0b";

              return (
                <div key={agent.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-gray-700">
                      {agent.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {agent.quotaUsed}/{agent.quotaTarget}
                      </span>
                      <span className={`text-[11px] font-medium ${statusClass}`}>
                        {statusWord}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2.5"
                      style={{
                        width: Math.min(100, pct) + "%",
                        borderRadius: "9999px",
                        backgroundColor: fillColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Team {sumUsed}/{sumTarget} ({teamPct}%)
          </div>
        </>
      )}
    </div>
  );
};
