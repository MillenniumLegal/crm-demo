// Forecast — where the next quarter is heading: lead-volume, instruction and revenue
// projections with confidence ranges (trailing run-rate × seasonal index).

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { fetchForecast, Forecast as FC, ForecastSeries } from '@/services/forecastService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { ForecastChart } from '@/components/trends/ForecastChart';
import { RangeFilter, rangeLabel, scaleRangeCount } from '@/components/analytics/RangeFilter';

const Forecast: React.FC = () => {
  const [data, setData] = useState<FC | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchForecast()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<FC | null>(() => {
    if (!data) return null;

    const scaleSeries = (series: ForecastSeries): ForecastSeries => ({
      ...series,
      actual: series.actual.map((value) => value == null ? null : scaleRangeCount(value, range)),
      forecast: series.forecast.map((value) => value == null ? null : scaleRangeCount(value, range)),
      lower: series.lower.map((value) => value == null ? null : scaleRangeCount(value, range)),
      upper: series.upper.map((value) => value == null ? null : scaleRangeCount(value, range)),
    });

    return {
      ...data,
      kpis: data.kpis.map((kpi) => {
        if (kpi.label.startsWith('Instructions')) {
          return {
            ...kpi,
            value: scaleRangeCount(58, range).toLocaleString(),
            sub: `±${scaleRangeCount(6, range)} · ${scaleRangeCount(52, range)} actual Jun`,
          };
        }
        if (kpi.label.startsWith('Revenue')) {
          return {
            ...kpi,
            value: `£${scaleRangeCount(74, range)}k`,
            sub: `±£${scaleRangeCount(8, range)}k forecast`,
          };
        }
        if (kpi.label.startsWith('Completions')) {
          return { ...kpi, value: scaleRangeCount(16, range).toLocaleString() };
        }
        if (kpi.label.startsWith('Lead volume')) {
          return { ...kpi, value: scaleRangeCount(240, range).toLocaleString() };
        }
        return kpi;
      }),
      instructions: scaleSeries(data.instructions),
      revenue: scaleSeries(data.revenue),
      leadVolume: scaleSeries(data.leadVolume),
    };
  }, [data, range]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Forecast<span className="font-serif italic text-navy-700">.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Where the next quarter is heading — leads, instructions and revenue, with confidence ranges.</p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={rangeData?.kpis ?? data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <ForecastChart title="Instructions forecast" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={(rangeData ?? data).instructions.labels} actual={(rangeData ?? data).instructions.actual} forecast={(rangeData ?? data).instructions.forecast} lower={(rangeData ?? data).instructions.lower} upper={(rangeData ?? data).instructions.upper} />
        <ForecastChart title="Revenue forecast (£k)" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={(rangeData ?? data).revenue.labels} actual={(rangeData ?? data).revenue.actual} forecast={(rangeData ?? data).revenue.forecast} lower={(rangeData ?? data).revenue.lower} upper={(rangeData ?? data).revenue.upper} />
      </div>

      <ForecastChart title="Lead volume forecast" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={(rangeData ?? data).leadVolume.labels} actual={(rangeData ?? data).leadVolume.actual} forecast={(rangeData ?? data).leadVolume.forecast} lower={(rangeData ?? data).leadVolume.lower} upper={(rangeData ?? data).leadVolume.upper} />

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>{data.note}</span>
      </div>
    </div>
  );
};

export default Forecast;
