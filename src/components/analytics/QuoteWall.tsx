// Firm-wide "Lines that landed" — a curated wall of standout phrases pulled from
// calls. Editorial, quotable: a soft Quote glyph, the line in muted italic, and a
// small navy rep chip. No chart library; pure flex + Tailwind.

import React from 'react';
import { Quote } from 'lucide-react';

interface QuoteRow {
  rep: string;
  text: string;
}

interface QuoteWallProps {
  title: string;
  caption?: string;
  quotes: QuoteRow[];
}

export const QuoteWall: React.FC<QuoteWallProps> = ({ title, caption, quotes }) => {
  const rows = (quotes ?? []).filter((quote) => quote && quote.text?.trim());

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">{title || 'Lines that landed'}</h3>
        {rows.length > 0 && (
          <span className="text-[11px] text-gray-400 tabular-nums">{rows.length}</span>
        )}
      </div>
      {caption && <p className="mt-0.5 text-xs text-gray-400">{caption}</p>}

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((quote, index) => (
            <li
              key={`${quote.rep}-${index}`}
              className="flex items-start gap-2.5 rounded-lg border border-gray-100 p-3 transition hover:border-navy-200 hover:shadow-sm"
              title={`${quote.rep}: "${quote.text}"`}
            >
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm italic leading-relaxed text-gray-700">
                  &ldquo;{quote.text}&rdquo;
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                    {quote.rep || 'Unknown'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
