// Objection drill panel: the exact graded exchanges for one objection category.
// Pure presentation over the instances passed in — sorts WEAK first so the
// worst coaching moments lead. Self-contained and portable into ty unchanged.

import React from 'react';
import { X, ArrowRight, Quote } from 'lucide-react';
import { coachToneClasses, CoachTone } from './coaching';

type Quality = 'STRONG' | 'ADEQUATE' | 'WEAK';
type Reaction = 'positive' | 'neutral' | 'pushed_back';

interface ObjectionInstance {
  rep: string;
  client: string;
  quality: Quality;
  clientSaid: string;
  repReplied: string;
  reaction: Reaction;
  date?: string;
}

interface ObjectionDrillProps {
  category: string;
  instances: ObjectionInstance[];
  onClose?: () => void;
}

// Quality → traffic-light tone + left-border colour + soft chip classes.
const QUALITY_META: Record<Quality, { tone: CoachTone; border: string; label: string; rank: number }> = {
  WEAK: { tone: 'bad', border: 'border-l-red-500', label: 'Weak', rank: 0 },
  ADEQUATE: { tone: 'warn', border: 'border-l-amber-400', label: 'Adequate', rank: 1 },
  STRONG: { tone: 'good', border: 'border-l-green-500', label: 'Strong', rank: 2 },
};

const REACTION_META: Record<Reaction, { label: string; chip: string; dot: string }> = {
  positive: { label: 'Positive', chip: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  neutral: { label: 'Neutral', chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  pushed_back: { label: 'Pushed back', chip: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
};

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const FieldBlock: React.FC<{ label: string; children: React.ReactNode; accent?: string }> = ({
  label,
  children,
  accent,
}) => (
  <div>
    <div className={`text-[10px] font-semibold uppercase tracking-wide ${accent ?? 'text-gray-400'}`}>{label}</div>
    <div className="mt-0.5">{children}</div>
  </div>
);

export const ObjectionDrill: React.FC<ObjectionDrillProps> = ({ category, instances, onClose }) => {
  const sorted = [...instances].sort((a, b) => QUALITY_META[a.quality].rank - QUALITY_META[b.quality].rank);

  // Tiny mix summary so the firm owner sees the spread at a glance.
  const counts = sorted.reduce(
    (acc, i) => {
      acc[i.quality] += 1;
      return acc;
    },
    { STRONG: 0, ADEQUATE: 0, WEAK: 0 } as Record<Quality, number>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Objection: <span className="text-navy-700">{category}</span>
          </h3>
          <p className="mt-0.5 text-xs text-gray-400 tabular-nums">
            {sorted.length === 0
              ? 'No exchanges recorded'
              : `${sorted.length} exchange${sorted.length === 1 ? '' : 's'} — worst handling first`}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close drill"
            aria-label="Close drill"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {(['WEAK', 'ADEQUATE', 'STRONG'] as Quality[]).map((q) => {
            const meta = QUALITY_META[q];
            const c = coachToneClasses[meta.tone];
            if (counts[q] === 0) return null;
            return (
              <span key={q} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                <span>{meta.label}</span>
                <span className="font-semibold tabular-nums text-gray-700">{counts[q]}</span>
              </span>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {sorted.map((inst, i) => {
            const meta = QUALITY_META[inst.quality];
            const c = coachToneClasses[meta.tone];
            const reaction = REACTION_META[inst.reaction];
            const dateLabel = formatDate(inst.date);
            return (
              <div
                key={`${inst.rep}-${inst.client}-${i}`}
                className={`rounded-lg border border-l-4 border-gray-100 bg-white p-3 shadow-sm ${meta.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-semibold text-gray-900">{inst.rep}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                    <span className="text-gray-600">{inst.client}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.soft} ${c.text}`}
                      title={`Rep handling graded ${meta.label.toLowerCase()}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {dateLabel && (
                    <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">{dateLabel}</span>
                  )}
                </div>

                <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
                  <FieldBlock label="Client said">
                    <div className="flex gap-1.5">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" />
                      <p className="text-sm italic text-gray-500">“{inst.clientSaid}”</p>
                    </div>
                  </FieldBlock>

                  <FieldBlock label="Rep replied">
                    <p className="text-sm text-gray-700">{inst.repReplied}</p>
                  </FieldBlock>

                  <FieldBlock label="Client reaction">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${reaction.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${reaction.dot}`} />
                      {reaction.label}
                    </span>
                  </FieldBlock>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
