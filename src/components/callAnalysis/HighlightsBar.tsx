// Highlights bar (spec §1, replaces the managerSummary prose per §9.4):
// at most three derived bullets — biggest improvement, biggest decline, biggest backlog.

import React from 'react';
import { Highlight, HighlightsBarProps } from './types';

const dotToneClass: Record<Highlight['tone'], string> = {
  good: 'bg-green-500',
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
};

export const HighlightsBar: React.FC<HighlightsBarProps> = ({ highlights }) => {
  if (highlights.length === 0) return null;

  return (
    <div className="card flex flex-wrap gap-x-6 gap-y-2">
      {highlights.slice(0, 3).map((highlight, index) => (
        <span key={`${index}-${highlight.text}`} className="flex items-center gap-2 text-sm text-gray-700">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotToneClass[highlight.tone]}`} aria-hidden="true" />
          {highlight.text}
        </span>
      ))}
    </div>
  );
};
