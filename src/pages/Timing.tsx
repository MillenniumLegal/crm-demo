// Best time to call — the upgraded timing view: a weekday×hour heatmap keyed on PICKUP
// RATE (not just volume), filterable by window (7d / 30d / 3 months) and metric, with the
// best window and the call-vs-pickup mismatch (when you dial vs when leads actually answer).

import React from 'react';
import { BestTimeHeatmap } from '@/components/analytics/BestTimeHeatmap';

const Timing: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Best time to <span className="font-serif italic text-navy-700">call.</span>
      </h1>
      <p className="mt-0.5 text-sm text-gray-500">When leads actually pick up — and when you&rsquo;re calling. Filter the window, switch the metric.</p>
    </div>
    <BestTimeHeatmap />
  </div>
);

export default Timing;
