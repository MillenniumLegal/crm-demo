// Callback / follow-up load by day — vertical bar chart so the firm owner sees
// the backlog shape at a glance (Overdue piling up vs. spread across future days).
// Pure SVG-free flex/div bars, no chart lib. Self-contained and portable into ty.

import React from 'react';
import { CalendarClock } from 'lucide-react';
import { formatNumber } from './format';
import { coachToneClasses, CoachTone } from './coaching';

type DayTone = 'bad' | 'warn' | 'good';

interface ScheduleLoadDay {
  label: string;
  count: number;
  tone?: DayTone;
}

interface ScheduleLoadChartProps {
  days: ScheduleLoadDay[];
}

// Bar fill by tone. Default (tone omitted) is a neutral gray for distant future days.
const barClassFor = (tone?: DayTone) => {
  switch (tone) {
    case 'bad':
      return 'bg-gradient-to-t from-red-600 to-red-500';
    case 'warn':
      return 'bg-gradient-to-t from-amber-600 to-amber-500';
    case 'good':
      return 'bg-gradient-to-t from-green-600 to-green-500';
    default:
      return 'bg-gradient-to-t from-gray-300 to-gray-200';
  }
};

const dotClassFor = (tone?: DayTone) => {
  switch (tone) {
    case 'bad':
      return coachToneClasses.bad.dot;
    case 'warn':
      return coachToneClasses.warn.dot;
    case 'good':
      return coachToneClasses.good.dot;
    default:
      return 'bg-gray-300';
  }
};

const labelClassFor = (tone?: DayTone) => {
  switch (tone) {
    case 'bad':
      return coachToneClasses.bad.text;
    case 'warn':
      return coachToneClasses.warn.text;
    case 'good':
      return coachToneClasses.good.text;
    default:
      return 'text-gray-500';
  }
};

const LEGEND: Array<{ tone: DayTone; label: string }> = [
  { tone: 'bad', label: 'Overdue' },
  { tone: 'warn', label: 'Today' },
  { tone: 'good', label: 'Upcoming' },
];

export const ScheduleLoadChart: React.FC<ScheduleLoadChartProps> = ({ days }) => {
  const safeDays = days.map((d) => ({ ...d, count: Math.max(0, d.count || 0) }));
  const total = safeDays.reduce((sum, d) => sum + d.count, 0);
  const maxCount = safeDays.reduce((max, d) => Math.max(max, d.count), 0);
  const overdue = safeDays
    .filter((d) => d.tone === 'bad')
    .reduce((sum, d) => sum + d.count, 0);

  const hasData = safeDays.length > 0 && total > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <CalendarClock className="h-4 w-4 text-navy-600" />
            Callback load
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">Scheduled call-backs by day</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none text-gray-900 tabular-nums">
            {formatNumber(total)}
          </div>
          {overdue > 0 ? (
            <div className="mt-0.5 text-[11px] font-semibold text-red-600 tabular-nums">
              {formatNumber(overdue)} overdue
            </div>
          ) : (
            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
              scheduled
            </div>
          )}
        </div>
      </div>

      {hasData ? (
        <>
          {/* Chart plot: gridlines behind, rounded-top bars in front. */}
          <div className="relative mt-4 h-36">
            {/* Subtle horizontal gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-t border-gray-100" />
              ))}
            </div>

            <div className="relative flex h-full items-end gap-2">
              {safeDays.map((day) => {
                const heightPct = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                // Keep a sliver visible for non-zero days so the shape never disappears.
                const minited = day.count > 0 ? Math.max(heightPct, 4) : 0;
                return (
                  <div
                    key={day.label}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                    title={`${day.label}: ${formatNumber(day.count)} call-back${day.count === 1 ? '' : 's'}`}
                  >
                    <span
                      className={`mb-1 text-xs font-semibold tabular-nums ${labelClassFor(day.tone)}`}
                    >
                      {day.count > 0 ? formatNumber(day.count) : ''}
                    </span>
                    <div
                      className={`w-full max-w-[2.25rem] rounded-t-md transition-all ${barClassFor(day.tone)}`}
                      style={{ height: `${minited}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day labels under each bar, aligned to the same grid */}
          <div className="mt-2 flex gap-2">
            {safeDays.map((day) => (
              <div
                key={day.label}
                className="flex-1 truncate text-center text-[11px] font-medium text-gray-500"
                title={day.label}
              >
                {day.label}
              </div>
            ))}
          </div>

          {/* Legend with coloured dots */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3">
            {LEGEND.map((item) => (
              <span key={item.tone} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`h-2 w-2 rounded-full ${dotClassFor(item.tone)}`} />
                {item.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 flex h-36 flex-col items-center justify-center rounded-md bg-gray-50 text-center">
          <CalendarClock className="h-5 w-5 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No data yet</p>
          <p className="text-xs text-gray-400">Call-backs appear here once scheduled.</p>
        </div>
      )}
    </div>
  );
};
