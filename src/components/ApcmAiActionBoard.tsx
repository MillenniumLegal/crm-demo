// APCM AI "Needs you now" — the priority-action board. Synthesises the firm's
// analytics (stalled hot leads, coaching drops, objection trends, overdue
// callbacks, wins) into prioritised, one-click actions. In ty these are computed;
// in the demo they're a curated snapshot.

import React from 'react';
import { Flame, TrendingDown, MessageSquare, Clock, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';

export interface ApcmAiAction {
  severity: 'high' | 'med' | 'low';
  icon: 'flame' | 'coaching' | 'objection' | 'callback' | 'win';
  title: string;
  detail: string;
  cta: string;
  href: string;
}

const ICONS = { flame: Flame, coaching: TrendingDown, objection: MessageSquare, callback: Clock, win: CheckCircle };
const SEV: Record<ApcmAiAction['severity'], { ring: string; icon: string; label: string; labelCls: string }> = {
  high: { ring: 'border-red-200 bg-red-50', icon: 'text-red-600', label: 'Act now', labelCls: 'bg-red-100 text-red-700' },
  med: { ring: 'border-amber-200 bg-amber-50', icon: 'text-amber-600', label: 'This week', labelCls: 'bg-amber-100 text-amber-700' },
  low: { ring: 'border-green-200 bg-green-50', icon: 'text-green-600', label: 'Good news', labelCls: 'bg-green-100 text-green-700' },
};

export const ApcmAiActionBoard: React.FC<{ actions: ApcmAiAction[]; onAction?: (href: string) => void }> = ({ actions, onAction }) => {
  if (!actions.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AlertTriangle className="h-4 w-4 text-navy-600" />
        <h2 className="text-sm font-semibold text-gray-900">Needs you now</h2>
        <span className="text-xs text-gray-400">APCM AI prioritised {actions.length} things across the firm</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((a, i) => {
          const Icon = ICONS[a.icon] || AlertTriangle;
          const s = SEV[a.severity];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onAction?.(a.href)}
              className={`group flex flex-col rounded-lg border p-3 text-left transition hover:shadow ${s.ring}`}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.labelCls}`}>{s.label}</span>
                <Icon className={`h-4 w-4 ${s.icon}`} />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900">{a.title}</p>
              <p className="mt-1 flex-1 text-xs leading-5 text-gray-600">{a.detail}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-700">
                {a.cta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
