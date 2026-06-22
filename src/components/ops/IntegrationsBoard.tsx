import React from "react";

interface IntegrationStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  lastSync: string;
  note: string;
}

interface Props {
  integrations: IntegrationStatus[];
}

const DOT_COLOR: Record<IntegrationStatus["status"], string> = {
  healthy: "#16a34a",
  degraded: "#f59e0b",
  down: "#ef4444",
};

const CHIP_CLASS: Record<IntegrationStatus["status"], string> = {
  healthy: "bg-green-50 text-green-700",
  degraded: "bg-amber-50 text-amber-700",
  down: "bg-red-50 text-red-700",
};

export const IntegrationsBoard: React.FC<Props> = ({ integrations }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Integration health</h3>
      <p className="text-xs text-gray-500">Connected systems and last sync</p>

      {integrations.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No integrations connected.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {integrations.map((it, i) => (
            <div
              key={`${it.name}-${i}`}
              className="rounded-lg border border-gray-100 p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: DOT_COLOR[it.status] }}
                />
                <span className="truncate text-sm font-medium text-gray-900">
                  {it.name}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[11px] capitalize ${CHIP_CLASS[it.status]}`}
                >
                  {it.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {"Synced " + it.lastSync + (it.note ? " · " + it.note : "")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
