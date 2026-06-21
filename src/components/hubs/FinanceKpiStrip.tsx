// Finance hub money KPI strip: a responsive grid of compact KPI cards.
// Each card carries an uppercase label, a large tone-coloured value, a muted
// sub caption and a thin tone accent down the left edge. No chart library.

import React from 'react';

type KpiTone = 'good' | 'warn' | 'bad' | 'info';

interface FinanceKpi {
  label: string;
  value: string;
  sub: string;
  tone: KpiTone;
}

interface FinanceKpiStripProps {
  kpis: FinanceKpi[];
}

// Left accent rail per tone.
const TONE_ACCENT: Record<KpiTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-600',
};

// Value colour — subtle by tone, info stays neutral gray-900.
const TONE_VALUE: Record<KpiTone, string> = {
  good: 'text-green-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
  info: 'text-gray-900',
};

// Status dot beside the label.
const TONE_DOT: Record<KpiTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-600',
};

export const FinanceKpiStrip: React.FC<FinanceKpiStripProps> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Finance</h3>
        <p className="mt-3 text-xs text-gray-400">No data yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, index) => (
        <div
          key={`${kpi.label}-${index}`}
          className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5 shadow-sm"
          title={`${kpi.label}: ${kpi.value}${kpi.sub ? ` — ${kpi.sub}` : ''}`}
        >
          <span
            className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[kpi.tone]}`}
            aria-hidden="true"
          />
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[kpi.tone]}`} />
            <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {kpi.label}
            </h3>
          </div>
          <p className={`mt-2 text-2xl font-bold leading-none tabular-nums ${TONE_VALUE[kpi.tone]}`}>
            {kpi.value}
          </p>
          {kpi.sub && <p className="mt-1.5 text-xs text-gray-400">{kpi.sub}</p>}
        </div>
      ))}
    </div>
  );
};
