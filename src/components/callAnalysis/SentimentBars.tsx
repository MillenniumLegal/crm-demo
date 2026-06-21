// Diverging sentiment bars: average client tone per rep on a -1..+1 scale.
// Pure SVG/flex, no chart lib — a single 0-axis runs down the middle of the
// track; positive tone extends right (green), negative left (red), and
// near-zero reads amber. Self-contained and portable into ty unchanged.

import React from 'react';
import { coachToneClasses } from './coaching';

interface SentimentRow {
  name: string;
  score: number; // [-1, 1]
}

interface SentimentBarsProps {
  rows: SentimentRow[];
}

const NEUTRAL_BAND = 0.05;

const clampScore = (n: number) => Math.max(-1, Math.min(1, n));

const signedLabel = (score: number) => `${score >= 0 ? '+' : '−'}${Math.abs(score).toFixed(2)}`;

type ToneKey = 'good' | 'warn' | 'bad';

const toneFor = (score: number): ToneKey => {
  if (Math.abs(score) < NEUTRAL_BAND) return 'warn';
  return score > 0 ? 'good' : 'bad';
};

// Bar fills use a subtle left-to-right gradient over the tone colour.
const BAR_GRADIENT: Record<ToneKey, string> = {
  good: 'bg-gradient-to-r from-green-400 to-green-500',
  warn: 'bg-amber-400',
  bad: 'bg-gradient-to-l from-red-400 to-red-500',
};

export const SentimentBars: React.FC<SentimentBarsProps> = ({ rows }) => {
  const ranked = [...(rows || [])]
    .filter((r) => r && typeof r.score === 'number' && Number.isFinite(r.score))
    .map((r) => ({ ...r, score: clampScore(r.score) }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-gray-900">Client sentiment by rep</h3>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${coachToneClasses.bad.dot}`} /> Negative
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Neutral
          </span>
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${coachToneClasses.good.dot}`} /> Positive
          </span>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">Average tone the client left the call with</p>

      {ranked.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No data yet</p>
      ) : (
        <>
          <div className="mt-4 space-y-2.5">
            {ranked.map((row) => {
              const tone = toneFor(row.score);
              const c = coachToneClasses[tone];
              const positive = row.score >= 0;
              // Half-width per side; |score| (0..1) maps to 0..100% of that half.
              const magnitudePct = Math.min(100, Math.abs(row.score) * 100);
              return (
                <div
                  key={row.name}
                  className="flex items-center gap-3"
                  title={`${row.name}: ${signedLabel(row.score)} average sentiment`}
                >
                  <span className="w-24 shrink-0 truncate text-right text-sm text-gray-700">
                    {row.name}
                  </span>

                  {/* Diverging track with a centred 0 axis. */}
                  <div className="relative h-5 flex-1 rounded-full bg-gray-50 ring-1 ring-inset ring-gray-100">
                    {/* Centre 0-axis line */}
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300" />
                    {/* Left (negative) half */}
                    <div className="absolute inset-y-0 left-0 right-1/2 flex items-center justify-end pr-px">
                      {!positive && magnitudePct > 0 && (
                        <div
                          className={`h-3 rounded-full ${BAR_GRADIENT[tone]}`}
                          style={{ width: `${magnitudePct}%` }}
                        />
                      )}
                    </div>
                    {/* Right (positive) half */}
                    <div className="absolute inset-y-0 left-1/2 right-0 flex items-center justify-start pl-px">
                      {positive && magnitudePct > 0 && (
                        <div
                          className={`h-3 rounded-full ${BAR_GRADIENT[tone]}`}
                          style={{ width: `${magnitudePct}%` }}
                        />
                      )}
                    </div>
                  </div>

                  <span className={`w-12 shrink-0 text-right text-sm font-semibold tabular-nums ${c.text}`}>
                    {signedLabel(row.score)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scale ticks: −1 … 0 … +1 aligned to the track. */}
          <div className="mt-3 flex items-center gap-3">
            <span className="w-24 shrink-0" />
            <div className="relative flex-1 select-none text-[10px] text-gray-400">
              <span className="absolute left-0 -translate-x-0">−1</span>
              <span className="absolute left-1/2 -translate-x-1/2">0</span>
              <span className="absolute right-0">+1</span>
              {/* spacer to give the absolute labels height */}
              <span className="invisible">.</span>
            </div>
            <span className="w-12 shrink-0" />
          </div>
        </>
      )}
    </div>
  );
};
