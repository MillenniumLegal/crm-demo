// Forecast — where the next quarter is heading: lead-volume, instruction and revenue
// projections with confidence ranges (trailing run-rate × seasonal index).

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { fetchForecast, Forecast as FC } from '@/services/forecastService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { ForecastChart } from '@/components/trends/ForecastChart';

const Forecast: React.FC = () => {
  const [data, setData] = useState<FC | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchForecast()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Forecast<span className="font-serif italic text-navy-700">.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Where the next quarter is heading — leads, instructions and revenue, with confidence ranges.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <ForecastChart title="Instructions forecast" caption="Actual + projection (± range)" labels={data.instructions.labels} actual={data.instructions.actual} forecast={data.instructions.forecast} lower={data.instructions.lower} upper={data.instructions.upper} />
        <ForecastChart title="Revenue forecast (£k)" caption="Actual + projection (± range)" labels={data.revenue.labels} actual={data.revenue.actual} forecast={data.revenue.forecast} lower={data.revenue.lower} upper={data.revenue.upper} />
      </div>

      <ForecastChart title="Lead volume forecast" caption="Actual + projection (± range)" labels={data.leadVolume.labels} actual={data.leadVolume.actual} forecast={data.leadVolume.forecast} lower={data.leadVolume.lower} upper={data.leadVolume.upper} />

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>{data.note}</span>
      </div>
    </div>
  );
};

export default Forecast;
