import React from "react";

interface AgentLead {
  name: string;
  stage: string;
  priority: "high" | "med" | "low";
  next: string;
  value: number;
}

interface Props {
  leads: AgentLead[];
}

const PRIORITY_ORDER: Record<AgentLead["priority"], number> = {
  high: 0,
  med: 1,
  low: 2,
};

const PRIORITY_COLOR: Record<AgentLead["priority"], string> = {
  high: "#ef4444",
  med: "#f59e0b",
  low: "#94a3b8",
};

export const MyWorklist: React.FC<Props> = ({ leads }) => {
  const sorted = [...leads].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Your leads</h3>
      <p className="text-xs text-gray-500">What to action next, by priority</p>

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No leads to action right now.</p>
      ) : (
        <div className="mt-3">
          {sorted.map((lead, i) => (
            <div
              key={`${lead.name}-${i}`}
              className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0"
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[lead.priority] }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="text-sm font-medium text-gray-900">
                    {lead.name}
                  </span>
                  <span className="text-xs text-gray-500"> · {lead.stage}</span>
                </div>
                <p className="text-sm text-gray-700">{lead.next}</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-gray-600">
                £{lead.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
