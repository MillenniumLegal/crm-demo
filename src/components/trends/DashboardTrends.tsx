// Dashboard "Momentum" band — self-fetching. Surfaces the 30-day trend at the top of
// the manager dashboard. Maps FirmTrends onto the reusable trend components.

import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchFirmTrends, FirmTrends } from '@/services/hubsService';
import { MomentumTiles } from '@/components/trends/MomentumTiles';
import { TrendLineChart } from '@/components/trends/TrendLineChart';

export const DashboardTrends: React.FC = () => {
  const navigate = useNavigate();
  const [t, setT] = useState<FirmTrends | null>(null);

  useEffect(() => {
    let active = true;
    fetchFirmTrends().then((d) => { if (active) setT(d); }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!t) return null;

  const pts = (arr: number[]) => t.labels.map((x, i) => ({ x, y: arr[i] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <TrendingUp className="h-4 w-4 self-center text-navy-700" />
          <h3 className="text-lg font-semibold text-gray-900">Momentum</h3>
          <span className="text-sm text-gray-400">{t.range}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/analytics?tab=trends')}
          className="text-sm font-medium text-navy-700 hover:text-navy-900"
        >
          All trends →
        </button>
      </div>

      <MomentumTiles kpis={t.momentum} />

      <TrendLineChart
        title="Leads & instructions"
        caption="Daily — last 30 days"
        series={[
          { key: 'leads', label: 'New leads', color: '#1e3a8a', points: pts(t.series.leads) },
          { key: 'instructions', label: 'Instructions', color: '#16a34a', points: pts(t.series.instructions) },
        ]}
      />
    </div>
  );
};
