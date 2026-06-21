// Hub hero cards: a responsive row of headline stat cards for a hub landing
// (Daily Pipeline). Each card carries a tone-coloured value + accent; cards
// with an href become clickable buttons that bubble up via onSelect.

import React from 'react';

type HeroTone = 'good' | 'warn' | 'bad' | 'info';

interface HeroStat {
  key: string;
  label: string;
  value: string;
  tone: HeroTone;
  href?: string;
}

interface HubHeroCardsProps {
  stats: HeroStat[];
  onSelect?: (href: string) => void;
}

const TONE_VALUE: Record<HeroTone, string> = {
  good: 'text-green-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
  info: 'text-navy-700',
};

const TONE_DOT: Record<HeroTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-600',
};

const TONE_ACCENT: Record<HeroTone, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  info: 'bg-navy-600',
};

const TONE_HOVER: Record<HeroTone, string> = {
  good: 'hover:border-green-300',
  warn: 'hover:border-amber-300',
  bad: 'hover:border-red-300',
  info: 'hover:border-navy-300',
};

export const HubHeroCards: React.FC<HubHeroCardsProps> = ({ stats, onSelect }) => {
  if (!stats || stats.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-gray-400">No data yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => {
        const clickable = !!stat.href && !!onSelect;
        const tooltip = `${stat.label}: ${stat.value}`;

        const inner = (
          <>
            <span
              className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${TONE_ACCENT[stat.tone]}`}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {stat.label}
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[stat.tone]}`} aria-hidden="true" />
            </div>
            <div className={`mt-1.5 text-2xl font-bold leading-none tabular-nums ${TONE_VALUE[stat.tone]}`}>
              {stat.value}
            </div>
          </>
        );

        if (clickable) {
          return (
            <button
              key={stat.key}
              type="button"
              title={tooltip}
              onClick={() => onSelect!(stat.href!)}
              className={`group relative overflow-hidden rounded-lg border border-gray-200 bg-white py-3 pl-4 pr-3 text-left shadow-sm transition-all hover:shadow ${TONE_HOVER[stat.tone]}`}
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={stat.key}
            title={tooltip}
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-white py-3 pl-4 pr-3 shadow-sm"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
};
