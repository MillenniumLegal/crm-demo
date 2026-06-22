import React from "react";
import { MarketingKpiStrip } from "@/components/marketing/MarketingKpiStrip";

interface MktKpi {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "info";
  deltaPct: number;
  good: boolean;
}

interface AgentStat {
  agent: string;
  handled: number;
  avgResponseMins: number;
  conversion: number;
}

interface Props {
  kpis: MktKpi[];
  byAgent: AgentStat[];
}

const responseColor = (mins: number): string =>
  mins <= 6 ? "#16a34a" : mins <= 10 ? "#f59e0b" : "#ef4444";

export const ConversationStats: React.FC<Props> = ({ kpis, byAgent }) => {
  return (
    <div className="space-y-4">
      <MarketingKpiStrip kpis={kpis} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">
          Response &amp; conversion by agent
        </div>
        <div className="text-xs text-gray-500">
          Who is handling chats, how fast, and how well
        </div>

        {byAgent.length === 0 ? (
          <div className="mt-4 text-xs text-gray-400">No agent activity yet.</div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 text-left font-medium">Agent</th>
                <th className="pb-2 text-right font-medium">Handled</th>
                <th className="pb-2 text-right font-medium">Avg response</th>
                <th className="pb-2 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byAgent.map((row, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-gray-900">{row.agent}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700">
                    {row.handled}
                  </td>
                  <td
                    className="py-2 text-right tabular-nums font-medium"
                    style={{ color: responseColor(row.avgResponseMins) }}
                  >
                    {row.avgResponseMins}m
                  </td>
                  <td className="py-2 text-right tabular-nums text-gray-700">
                    {row.conversion}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
