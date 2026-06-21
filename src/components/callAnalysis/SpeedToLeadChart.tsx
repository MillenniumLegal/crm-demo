// Speed-to-lead SLA bars: creation → first dial, shorter is better.
// Pure SVG/flex — no chart lib. Bars scale against the slowest rep, are
// coloured by speedTone(seconds) (≤3h green / ≤8h amber / >8h red), and two
// vertical threshold markers (3h green, 8h amber) sit on the same scale so the
// firm owner can see at a glance who is inside SLA.

import React from 'react';
import { Zap } from 'lucide-react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { formatDelay } from './format';
import { speedTone, coachToneClasses } from './coaching';

interface SpeedToLeadChartProps {
  agents: CallAgentDailyBreakdown[];
}

const THREE_HOURS = 3 * 3600;
const EIGHT_HOURS = 8 * 3600;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Legend bands mirror speedTone's traffic-light thresholds.
const LEGEND: Array<{ tone: 'good' | 'warn' | 'bad'; label: string }> = [
  { tone: 'good', label: '≤ 3h' },
  { tone: 'warn', label: '≤ 8h' },
  { tone: 'bad', label: '> 8h' },
];

export const SpeedToLeadChart: React.FC<SpeedToLeadChartProps> = ({ agents }) => {
  const rows = agents
    .filter((a) => a.averageFirstOutboundDelaySeconds > 0)
    .map((a) => ({
      name: a.agentName,
      id: a.agentUserId || a.agentName,
      seconds: a.averageFirstOutboundDelaySeconds,
    }))
    .sort((a, b) => a.seconds - b.seconds); // fastest first

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Speed to lead</h3>
        <p className="mt-0.5 text-xs text-gray-400">Creation → first dial · shorter is better</p>
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      </div>
    );
  }

  // Scale every bar (and the threshold markers) against the slowest rep, but
  // never let the scale collapse below 8h so the markers stay meaningful.
  const slowest = rows.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const fastest = rows[0];
  const teamMedian = median(rows.map((r) => r.seconds));
  const max = Math.max(slowest.seconds, EIGHT_HOURS) || 1;

  const pct = (seconds: number) => Math.min(100, (seconds / max) * 100);
  const threeHourPct = pct(THREE_HOURS);
  const eightHourPct = pct(EIGHT_HOURS);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Zap className="h-3.5 w-3.5 text-navy-600" /> Speed to lead
        </h3>
        <div className="flex items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.tone} className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className={`h-2 w-2 rounded-full ${coachToneClasses[l.tone].dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">Creation → first dial · shorter is better</p>

      {/* Bars + threshold markers share one positioned track so the green 3h /
          amber 8h lines line up exactly with the proportional bar widths. */}
      <div className="relative mt-4 space-y-2.5">
        {/* Threshold marker lines, drawn behind the bars and spanning all rows. */}
        <div className="pointer-events-none absolute inset-y-0 left-[7.5rem] right-0">
          {threeHourPct < 100 && (
            <div
              className="absolute inset-y-0 border-l border-dashed border-green-400"
              style={{ left: `${threeHourPct}%` }}
              title="3h SLA"
            >
              <span className="absolute -top-3 -translate-x-1/2 text-[9px] font-semibold text-green-600">3h</span>
            </div>
          )}
          {eightHourPct < 100 && (
            <div
              className="absolute inset-y-0 border-l border-dashed border-amber-400"
              style={{ left: `${eightHourPct}%` }}
              title="8h SLA"
            >
              <span className="absolute -top-3 -translate-x-1/2 text-[9px] font-semibold text-amber-600">8h</span>
            </div>
          )}
        </div>

        {rows.map((r) => {
          const tone = speedTone(r.seconds);
          const c = coachToneClasses[tone];
          const width = Math.max(pct(r.seconds), 2);
          const gradient =
            tone === 'good'
              ? 'from-green-400 to-green-500'
              : tone === 'warn'
              ? 'from-amber-400 to-amber-500'
              : 'from-red-400 to-red-500';
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-gray-600" title={r.name}>
                {r.name}
              </span>
              <div className="relative h-4 flex-1">
                <div className="absolute inset-0 rounded-full bg-gray-50" />
                <div
                  className={`absolute inset-y-0 left-0 flex items-center justify-end rounded-full bg-gradient-to-r ${gradient} pr-2`}
                  style={{ width: `${width}%` }}
                  title={`${r.name} — ${formatDelay(r.seconds)}`}
                >
                  {width > 22 && (
                    <span className="text-[10px] font-semibold tabular-nums text-white">
                      {formatDelay(r.seconds)}
                    </span>
                  )}
                </div>
                {width <= 22 && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 pl-1.5 text-[10px] font-semibold tabular-nums ${c.text}`}
                    style={{ left: `${width}%` }}
                  >
                    {formatDelay(r.seconds)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>
          Fastest{' '}
          <span className="font-semibold text-gray-900">{fastest.name}</span>{' '}
          <span className="font-semibold tabular-nums text-green-700">{formatDelay(fastest.seconds)}</span>
        </span>
        <span>
          Slowest{' '}
          <span className="font-semibold text-gray-900">{slowest.name}</span>{' '}
          <span className={`font-semibold tabular-nums ${coachToneClasses[speedTone(slowest.seconds)].text}`}>
            {formatDelay(slowest.seconds)}
          </span>
        </span>
        <span>
          Team median{' '}
          <span className={`font-semibold tabular-nums ${coachToneClasses[speedTone(teamMedian)].text}`}>
            {formatDelay(teamMedian)}
          </span>
        </span>
      </div>
    </div>
  );
};
