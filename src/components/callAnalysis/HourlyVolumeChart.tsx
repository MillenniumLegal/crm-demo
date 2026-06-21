// Call volume by hour of day — the competitor's hourly bar chart, done premium.
// Pure flex/div bars (no chart lib). Each hour is a stacked column: outbound on the
// bottom (navy-500), inbound stacked on top (amber-400). The busiest hour is
// highlighted, faint gridlines carry value labels, and a legend explains the mix.

import React from 'react';
import { Clock } from 'lucide-react';
import { formatNumber } from './format';

interface HourlyDatum {
  hour: number; // 0–23
  inbound: number;
  outbound: number;
}

interface HourlyVolumeChartProps {
  hours: HourlyDatum[];
}

// "8a" / "12p" / "5p" — compact 12-hour label for an hour 0–23.
const formatHour12 = (hour: number): string => {
  const h = ((hour % 24) + 24) % 24;
  const period = h < 12 ? 'a' : 'p';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
};

// A handful of "nice" round gridline ceilings so the top label is readable.
const niceCeiling = (max: number): number => {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  return candidates.find((c) => c >= max) ?? 10 * pow;
};

export const HourlyVolumeChart: React.FC<HourlyVolumeChartProps> = ({ hours }) => {
  const data = [...hours]
    .filter((h) => h && Number.isFinite(h.hour))
    .map((h) => ({
      hour: h.hour,
      inbound: Math.max(0, h.inbound || 0),
      outbound: Math.max(0, h.outbound || 0),
      total: Math.max(0, (h.inbound || 0) + (h.outbound || 0)),
    }))
    .sort((a, b) => a.hour - b.hour);

  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  if (data.length === 0 || grandTotal === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Call volume by hour</h3>
        <p className="mt-0.5 text-xs text-gray-400">When the phones are busiest across the day</p>
        <div className="mt-6 flex h-40 items-center justify-center rounded-md border border-dashed border-gray-100 bg-gray-50/50">
          <span className="text-sm text-gray-400">No data yet</span>
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total));
  const ceiling = niceCeiling(maxTotal);
  const peak = data.reduce((best, d) => (d.total > best.total ? d : best), data[0]);

  // 4 gridlines (incl. baseline) at 0 / ⅓ / ⅔ / top of the nice ceiling.
  const gridValues = [0, 1, 2, 3].map((i) => Math.round((ceiling * i) / 3));

  const legend: { label: string; dot: string }[] = [
    { label: 'Outbound', dot: 'bg-navy-500' },
    { label: 'Inbound', dot: 'bg-amber-400' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Call volume by hour</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatNumber(grandTotal)} calls across {data.length} hour{data.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {/* Y-axis value labels, aligned to the gridlines below. */}
        <div className="relative h-40 w-7 shrink-0">
          {gridValues.map((v, i) => (
            <span
              key={v + '-' + i}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-gray-400"
              style={{ bottom: `${(i / (gridValues.length - 1)) * 100}%` }}
            >
              {formatNumber(v)}
            </span>
          ))}
        </div>

        {/* Plot area: gridlines behind, columns in front. */}
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0">
            {gridValues.map((v, i) => (
              <div
                key={v + '-' + i}
                className="absolute inset-x-0 border-t border-gray-100"
                style={{ bottom: `${(i / (gridValues.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex h-40 items-end gap-1">
            {data.map((d) => {
              const isPeak = d.hour === peak.hour;
              const colHeightPct = ceiling > 0 ? (d.total / ceiling) * 100 : 0;
              const outboundPct = d.total > 0 ? (d.outbound / d.total) * 100 : 0;
              const inboundPct = d.total > 0 ? (d.inbound / d.total) * 100 : 0;
              const tooltip = `${formatHour12(d.hour)} · ${formatNumber(d.total)} calls — ${formatNumber(
                d.outbound
              )} outbound, ${formatNumber(d.inbound)} inbound`;
              return (
                <div key={d.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <div className="relative flex w-full items-end justify-center" style={{ height: '10rem' }}>
                    <div
                      title={tooltip}
                      className={`flex w-full max-w-[26px] flex-col justify-end overflow-hidden rounded-t-md transition-all ${
                        isPeak ? 'ring-2 ring-navy-300 ring-offset-1' : ''
                      }`}
                      style={{ height: `${Math.max(colHeightPct, d.total > 0 ? 4 : 0)}%` }}
                    >
                      {/* Inbound stacked on top (amber), with the rounded cap. */}
                      {d.inbound > 0 && (
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-amber-400 to-amber-300"
                          style={{ height: `${inboundPct}%` }}
                        />
                      )}
                      {/* Outbound forms the base (navy). */}
                      {d.outbound > 0 && (
                        <div
                          className={`w-full bg-gradient-to-t from-navy-600 to-navy-500 ${
                            d.inbound > 0 ? '' : 'rounded-t-md'
                          }`}
                          style={{ height: `${outboundPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className={`mt-1.5 truncate text-[10px] tabular-nums ${
                      isPeak ? 'font-semibold text-navy-700' : 'text-gray-400'
                    }`}
                  >
                    {formatHour12(d.hour)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <Clock className="h-3.5 w-3.5 text-navy-600" />
        <span>
          Busiest at{' '}
          <span className="font-semibold tabular-nums text-gray-900">{formatHour12(peak.hour)}</span>{' '}
          <span className="tabular-nums text-gray-400">({formatNumber(peak.total)} calls)</span>
        </span>
      </div>
    </div>
  );
};
