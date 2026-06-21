// Call volume by rep, split by outcome (connected / voicemail / missed).
// Horizontal stacked bars, each row scaled so the busiest rep fills the track.
// Pure div/flex bars — no chart lib. Portable into ty unchanged (TYPES only).

import React from 'react';
import { CallAgentDailyBreakdown } from '@/services/threecxService';
import { formatNumber } from './format';

interface ByRepVolumeChartProps {
  agents: CallAgentDailyBreakdown[];
}

// Outcome palette — semantic traffic lights: connected good, voicemail warn, missed muted.
const SEGMENTS: Array<{ key: 'connected' | 'voicemail' | 'missed'; label: string; barClass: string; dotClass: string }> = [
  { key: 'connected', label: 'Connected', barClass: 'bg-gradient-to-r from-green-400 to-green-500', dotClass: 'bg-green-500' },
  { key: 'voicemail', label: 'Voicemail', barClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
  { key: 'missed', label: 'Missed', barClass: 'bg-gray-300', dotClass: 'bg-gray-300' },
];

export const ByRepVolumeChart: React.FC<ByRepVolumeChartProps> = ({ agents }) => {
  const rows = agents
    .map((a) => {
      const connected = Math.max(a.outboundAnsweredCalls, 0);
      const voicemail = Math.max(a.outboundVoicemailCalls, 0);
      const missed = Math.max(a.outboundCalls - connected - voicemail, 0);
      return { name: a.agentName, total: a.outboundCalls, connected, voicemail, missed };
    })
    .filter((r) => r.total > 0)
    .sort((x, y) => y.total - x.total);

  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Calls by rep</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dotClass}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">Outcome split per handler</p>

      {rows.length === 0 || max === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            // Scale the whole row so the busiest rep fills 100% of the track.
            const trackPct = (r.total / max) * 100;
            const segPct = (v: number) => (r.total > 0 ? (v / r.total) * 100 : 0);
            const tip = `${r.name} — ${formatNumber(r.total)} calls · ${formatNumber(r.connected)} connected · ${formatNumber(r.voicemail)} voicemail · ${formatNumber(r.missed)} missed`;
            return (
              <div key={r.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm text-gray-700" title={r.name}>
                  {r.name}
                </span>
                <div className="flex-1">
                  <div className="h-3 w-full rounded-full bg-gray-50">
                    <div
                      className="flex h-3 overflow-hidden rounded-full"
                      style={{ width: `${Math.max(trackPct, 2)}%` }}
                      title={tip}
                    >
                      {SEGMENTS.map((s) =>
                        r[s.key] > 0 ? (
                          <div
                            key={s.key}
                            className={s.barClass}
                            style={{ width: `${segPct(r[s.key])}%` }}
                          />
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold text-gray-900 tabular-nums">
                  {formatNumber(r.total)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
