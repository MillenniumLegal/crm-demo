// Worklist list card: Today's tasks / Callbacks due / Awaiting quote response.
// A divided list of leads with a tone-coloured marker, meta and an optional note.
// Pure flex/SVG, no chart library — matches the Call Analysis 2.0 design system.

import React from 'react';

type WorklistTone = 'good' | 'warn' | 'bad' | 'info';

interface WorklistItem {
  lead: string;
  meta: string;
  note?: string;
  tone?: WorklistTone;
}

interface WorklistCardProps {
  title: string;
  items: WorklistItem[];
  emptyText?: string;
  icon?: React.ReactNode;
}

const TONE_MARKER: Record<WorklistTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-600',
};

const markerClass = (tone?: WorklistTone) => (tone ? TONE_MARKER[tone] : 'bg-gray-300');

export const WorklistCard: React.FC<WorklistCardProps> = ({ title, items, emptyText = 'All clear', icon }) => {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
          <h3 className="truncate text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums"
          title={`${safeItems.length} item${safeItems.length === 1 ? '' : 's'}`}
        >
          {safeItems.length}
        </span>
      </div>

      {safeItems.length === 0 ? (
        <p className="mt-6 mb-2 text-center text-xs text-gray-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {safeItems.map((item, idx) => (
            <li
              key={`${item.lead}-${idx}`}
              className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0"
              title={item.note ? `${item.lead} — ${item.note}` : item.lead}
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${markerClass(item.tone)}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-gray-900">{item.lead}</span>
                  <span className="shrink-0 text-xs text-gray-400 tabular-nums">{item.meta}</span>
                </span>
                {item.note && <span className="mt-0.5 block line-clamp-1 text-xs text-gray-500">{item.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
