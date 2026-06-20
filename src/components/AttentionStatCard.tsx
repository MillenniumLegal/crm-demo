import React from 'react';
import { Bell } from 'lucide-react';

/**
 * AttentionStatCard — an urgent KPI card (Unassigned, High Priority). Matches the
 * regular stat-card layout exactly (round icon chip · label+value · right-slot) so
 * it rhymes with the others, distinguished by a red bell chip, a soft red tint
 * (data-variant="attention", themed in MANUSCRIPT_MV_CSS) and a red "needs
 * attention" line in the right slot. NON-SHIPPED demo.
 */
export const AttentionStatCard: React.FC<{
  title: string;
  value: string | number;
  note?: string;
  onClick?: () => void;
}> = ({ title, value, note = 'Needs attention', onClick }) => (
  <div
    data-variant="attention"
    className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent active:scale-[0.98]"
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    }}
  >
    <div className="flex items-center gap-4">
      <div className="p-3 rounded-lg bg-red-500">
        <Bell className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-5 text-gray-600">{title}</p>
        <p className="break-words text-2xl font-bold leading-8 text-gray-900">{value}</p>
      </div>
      {note ? (
        <div className="flex max-w-[7rem] flex-shrink-0 items-center justify-end text-right">
          <span className="text-xs font-medium leading-tight" style={{ color: '#B42318' }}>
            {note}
          </span>
        </div>
      ) : null}
    </div>
  </div>
);

export default AttentionStatCard;
