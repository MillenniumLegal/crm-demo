// AI Insights — "What changed" (spec §6.4).
// Diffs Objection-category counts between the current and previous signal
// breakdowns and surfaces the top 3 risers (red) and fallers (green) as chips.

import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, History } from 'lucide-react';
import { ObjectionShiftStripProps } from './types';
import { sentenceCase, statusChipClass } from './format';

const OBJECTION_TYPE = 'Objection category';

interface Shift {
  value: string;
  current: number;
  previous: number;
  /** Rounded percent change; null = no previous count ("New"). */
  percent: number | null;
}

const toObjectionMap = (rows: ObjectionShiftStripProps['current']) => {
  const map = new Map<string, number>();
  rows
    .filter((row) => row.signalType === OBJECTION_TYPE)
    .forEach((row) => {
      map.set(row.signalValue, (map.get(row.signalValue) ?? 0) + row.callsCount);
    });
  return map;
};

export const ObjectionShiftStrip: React.FC<ObjectionShiftStripProps> = ({
  current,
  previous,
}) => {
  const { hasHistory, risers, fallers } = useMemo(() => {
    const currentMap = toObjectionMap(current);
    const previousMap = toObjectionMap(previous);

    const values = new Set<string>([...currentMap.keys(), ...previousMap.keys()]);
    const up: Shift[] = [];
    const down: Shift[] = [];

    values.forEach((value) => {
      const currentCount = currentMap.get(value) ?? 0;
      const previousCount = previousMap.get(value) ?? 0;
      if (currentCount === 0 && previousCount === 0) return;

      if (previousCount === 0) {
        up.push({ value, current: currentCount, previous: previousCount, percent: null });
        return;
      }

      const percent = Math.round(((currentCount - previousCount) / previousCount) * 100);
      if (percent > 0) up.push({ value, current: currentCount, previous: previousCount, percent });
      else if (percent < 0) down.push({ value, current: currentCount, previous: previousCount, percent });
    });

    // "New" objections (no previous baseline) lead, then biggest % rise.
    up.sort((a, b) => {
      if (a.percent === null && b.percent === null) return b.current - a.current;
      if (a.percent === null) return -1;
      if (b.percent === null) return 1;
      return b.percent - a.percent || b.current - a.current;
    });
    down.sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0) || b.previous - a.previous);

    return {
      hasHistory: previousMap.size > 0,
      risers: up.slice(0, 3),
      fallers: down.slice(0, 3),
    };
  }, [current, previous]);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900">What changed</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Objection categories vs the previous period
      </p>

      {!hasHistory ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <History className="h-4 w-4 text-gray-400" />
          Not enough history to compare yet.
        </div>
      ) : risers.length === 0 && fallers.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No change in objection mix vs the previous period.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {risers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Rising
              </span>
              {risers.map((shift) => (
                <span key={shift.value} className={`${statusChipClass('red')} gap-1 tabular-nums`}>
                  <ArrowUp className="h-3 w-3" />
                  {sentenceCase(shift.value)}{' '}
                  {shift.percent === null ? 'New' : `+${shift.percent}%`}
                </span>
              ))}
            </div>
          )}
          {fallers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Falling
              </span>
              {fallers.map((shift) => (
                <span key={shift.value} className={`${statusChipClass('green')} gap-1 tabular-nums`}>
                  <ArrowDown className="h-3 w-3" />
                  {sentenceCase(shift.value)} &minus;{Math.abs(shift.percent ?? 0)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
