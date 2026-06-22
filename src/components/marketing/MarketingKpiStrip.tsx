import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MktKpi {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "info";
  deltaPct: number;
  good: boolean;
}

interface Props {
  kpis: MktKpi[];
}

const TONE_TEXT: Record<MktKpi["tone"], string> = {
  good: "text-green-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  info: "text-navy-700",
};

export const MarketingKpiStrip: React.FC<Props> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, i) => {
        const DeltaIcon =
          kpi.deltaPct > 0 ? ArrowUpRight : kpi.deltaPct < 0 ? ArrowDownRight : Minus;
        const deltaColor = kpi.good ? "text-green-600" : "text-red-600";
        const deltaLabel = `${kpi.deltaPct > 0 ? "+" : ""}${kpi.deltaPct}%`;

        return (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {kpi.label}
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${TONE_TEXT[kpi.tone]}`}
            >
              {kpi.value}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{kpi.sub}</span>
              <span
                className={`flex items-center gap-0.5 text-[11px] font-semibold ${deltaColor}`}
              >
                <DeltaIcon className="h-3 w-3" />
                {deltaLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
