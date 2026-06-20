// AI Insights — "Flagged for a manager" (spec §6.3).
// Groups the export-scan risk flags by flag value; each row shows the flag
// chip, how many calls raised it, the first lead names, and a Listen button
// that enters the manager-review queue.

import React, { useMemo } from 'react';
import { CheckCircle, Flag, Headphones } from 'lucide-react';
import { RiskFlagsPanelProps } from './types';
import { formatNumber, sentenceCase, statusChipClass } from './format';

interface FlagGroup {
  flag: string;
  count: number;
  leadNames: string[];
}

export const RiskFlagsPanel: React.FC<RiskFlagsPanelProps> = ({ flagged, onOpenQueue }) => {
  const groups = useMemo<FlagGroup[]>(() => {
    if (!flagged) return [];
    const map = new Map<string, FlagGroup>();
    flagged.forEach((call) => {
      call.flags.forEach((rawFlag) => {
        const flag = rawFlag.trim();
        if (!flag) return;
        const group = map.get(flag) ?? { flag, count: 0, leadNames: [] };
        group.count += 1;
        if (
          call.leadName &&
          group.leadNames.length < 3 &&
          !group.leadNames.includes(call.leadName)
        ) {
          group.leadNames.push(call.leadName);
        }
        map.set(flag, group);
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [flagged]);

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900">Flagged for a manager</h3>
      </div>

      {flagged === null ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          No calls flagged in this range.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {groups.map((group) => (
            <li key={group.flag} className="flex items-center gap-3 py-2.5">
              <span className={`${statusChipClass('red')} shrink-0`}>
                {sentenceCase(group.flag)}
              </span>
              <span className="shrink-0 text-sm text-gray-900">
                <span className="font-semibold tabular-nums">{formatNumber(group.count)}</span>{' '}
                {group.count === 1 ? 'call' : 'calls'}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                {group.leadNames.length > 0 ? group.leadNames.join(', ') : 'No linked leads'}
              </span>
              <button
                type="button"
                onClick={onOpenQueue}
                title="Listen to these calls"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-navy-950 transition hover:border-navy-950 hover:bg-gray-50"
              >
                <Headphones className="h-3.5 w-3.5" />
                Listen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
