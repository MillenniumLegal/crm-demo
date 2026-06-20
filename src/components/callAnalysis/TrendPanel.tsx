// TrendPanel — "Daily trend" (spec §3).
// Refactor of the old daily movement chart: 4 metric toggle pills, div column
// bars over the daily series, faint gridlines and a dashed period-average line.
// Below md only the most recent 7 days are shown (older columns are hidden).

import React from 'react';
import { formatNumber } from './format';
import { TrendMetricKey, TrendPanelProps } from './types';

const METRIC_OPTIONS: Array<{ key: TrendMetricKey; label: string }> = [
  { key: 'outboundCalls', label: 'Calls made' },
  { key: 'outboundAnsweredCalls', label: 'Conversations' },
  { key: 'instructionIntent', label: 'Likely to instruct' },
  { key: 'officialInstructions', label: 'Instructions' },
];

const MOBILE_DAY_CAP = 7;

const formatDayLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const TrendPanel: React.FC<TrendPanelProps> = ({ series, metric, onMetricChange }) => {
  const activeLabel = METRIC_OPTIONS.find((option) => option.key === metric)?.label ?? 'Calls made';
  const values = series.map((point) => point.overview[metric] ?? 0);
  const max = Math.max(...values, 0);
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const averagePercent = max > 0 ? (average / max) * 100 : 0;
  // Columns older than the last 7 days are hidden below md.
  const firstMobileIndex = Math.max(0, series.length - MOBILE_DAY_CAP);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Daily trend</h3>
        <div className="flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map((option) => {
            const active = option.key === metric;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onMetricChange(option.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-navy-950 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No call data for this period.</p>
      ) : (
        <div className="mt-6 pt-4">
          <div className="relative h-[132px]">
            {/* Faint horizontal gridlines */}
            {[25, 50, 75].map((position) => (
              <div
                key={position}
                className="pointer-events-none absolute inset-x-0 border-t border-gray-100"
                style={{ bottom: `${position}%` }}
              />
            ))}

            {/* Dashed period-average line */}
            {max > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-navy-400"
                style={{ bottom: `${averagePercent}%` }}
              >
                <span className="absolute -top-2 right-0 bg-white px-1 text-[10px] leading-none text-navy-400">
                  avg {formatNumber(Math.round(average))}
                </span>
              </div>
            )}

            {/* Column bars */}
            <div className="flex h-full items-end gap-1.5 sm:gap-2">
              {series.map((point, index) => {
                const value = point.overview[metric] ?? 0;
                const percent = max > 0 ? (value / max) * 100 : 0;
                const hiddenOnMobile = index < firstMobileIndex;
                return (
                  <div
                    key={point.date}
                    className={`${hiddenOnMobile ? 'hidden md:flex' : 'flex'} h-full flex-1 items-end justify-center`}
                    title={`${formatDayLabel(point.date)}: ${formatNumber(value)} — ${activeLabel}`}
                  >
                    <div
                      className="relative w-full max-w-[32px] rounded-t bg-navy-950"
                      style={{ height: `${percent}%`, minHeight: value > 0 ? '3px' : '0' }}
                    >
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-gray-600">
                        {formatNumber(value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date labels */}
          <div className="mt-2 flex gap-1.5 border-t border-gray-100 pt-2 sm:gap-2">
            {series.map((point, index) => {
              const hiddenOnMobile = index < firstMobileIndex;
              return (
                <div
                  key={point.date}
                  className={`${hiddenOnMobile ? 'hidden md:block' : 'block'} min-w-0 flex-1 text-center text-[10px] text-gray-500`}
                >
                  {formatDayLabel(point.date)}
                </div>
              );
            })}
          </div>

          {series.length > MOBILE_DAY_CAP && (
            <p className="mt-2 text-xs text-gray-400 md:hidden">
              Showing the last {MOBILE_DAY_CAP} days — widen the screen for the full range.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
