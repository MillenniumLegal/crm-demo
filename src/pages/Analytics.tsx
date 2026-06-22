// Analytics hub — firm-wide visibility (Business + Behaviour). Compiles leads, calls
// (3CX + AI), quotes/instructions, and activity into the firm dashboard lenses.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchFirmAnalytics, FirmAnalytics, fetchFirmTrends, FirmTrends } from '@/services/hubsService';
import { FinanceKpiStrip } from '@/components/hubs/FinanceKpiStrip';
import { PipelineSpreadDonut } from '@/components/pulse/PipelineSpreadDonut';
import { MomentumTiles } from '@/components/trends/MomentumTiles';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { WeeklyTargetBars } from '@/components/trends/WeeklyTargetBars';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { StackedDistributionBar } from '@/components/analytics/StackedDistributionBar';
import { SentimentDistribution } from '@/components/analytics/SentimentDistribution';
import { CaptureBars } from '@/components/analytics/CaptureBars';
import { CommitmentsTable } from '@/components/analytics/CommitmentsTable';
import { QuoteWall } from '@/components/analytics/QuoteWall';

type Tab = 'business' | 'trends' | 'leads' | 'behaviour';

const Analytics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [data, setData] = useState<FirmAnalytics | null>(null);
  const [trends, setTrends] = useState<FirmTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(
    tabParam === 'trends' || tabParam === 'leads' || tabParam === 'behaviour' ? tabParam : 'business'
  );

  useEffect(() => {
    let active = true;
    fetchFirmAnalytics()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    fetchFirmTrends()
      .then((d) => { if (active) setTrends(d); })
      .catch(() => {})
      .finally(() => { if (active) setTrendsLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const tabs: [Tab, string][] = [['business', 'Business'], ['trends', 'Trends'], ['leads', 'Leads'], ['behaviour', 'Behaviour']];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          What&rsquo;s the <span className="font-serif italic text-navy-700">firm doing.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Firm-wide analytics — last 30 days.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'business' && (
        <div className="space-y-5">
          <FinanceKpiStrip kpis={data.kpis} />
          <StackedDistributionBar title="Lifecycle distribution" caption="Where leads sit now" segments={data.lifecycle} />
          <div className="grid gap-5 xl:grid-cols-3">
            <PipelineSpreadDonut total={data.temperature.total} segments={data.temperature.segments} />
            <RankedBarList title="Why we win" caption="Primary close drivers" items={data.closeDrivers} defaultTone="good" />
            <RankedBarList title="Why we lose" caption="Lost reasons" items={data.lostReasons} defaultTone="bad" />
          </div>
        </div>
      )}

      {tab === 'trends' && (
        trends ? (
          <div className="space-y-5">
            <MomentumTiles kpis={trends.momentum} />
            <TrendLineChart
              title="Leads & instructions"
              caption="Daily — last 30 days"
              series={[
                { key: 'leads', label: 'New leads', color: '#1e3a8a', points: trends.labels.map((x, i) => ({ x, y: trends.series.leads[i] })) },
                { key: 'instructions', label: 'Instructions', color: '#16a34a', points: trends.labels.map((x, i) => ({ x, y: trends.series.instructions[i] })) },
              ]}
            />
            <div className="grid gap-5 xl:grid-cols-2">
              <TrendLineChart
                title="Call volume"
                caption="Daily calls made"
                area
                series={[{ key: 'calls', label: 'Calls', color: '#0ea5e9', points: trends.labels.map((x, i) => ({ x, y: trends.series.calls[i] })) }]}
              />
              <TrendLineChart
                title="Conversion rate"
                caption="Daily lead → instruction %"
                yFormat="percent"
                series={[{ key: 'conversion', label: 'Conversion', color: '#8b5cf6', points: trends.labels.map((x, i) => ({ x, y: trends.series.conversion[i] })) }]}
              />
            </div>
            <TrendLineChart
              title="Revenue"
              caption="Daily — last 30 days"
              yFormat="currency"
              area
              series={[{ key: 'revenue', label: 'Revenue', color: '#16a34a', points: trends.labels.map((x, i) => ({ x, y: trends.series.revenue[i] })) }]}
            />
            <div className="grid gap-5 xl:grid-cols-2">
              <WeeklyTargetBars title="Instructions per week" caption="vs weekly target — last 8 weeks" bars={trends.weeklyInstructions} />
              <WeeklyTargetBars title="Revenue per week" caption="vs weekly target — last 8 weeks" valueFormat="currency" bars={trends.weeklyRevenue} />
            </div>
          </div>
        ) : trendsLoading ? (
          <div className="flex h-48 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">Couldn&rsquo;t load trends.</div>
        )
      )}

      {tab === 'leads' && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <RankedBarList title="Lead sources" caption="Where leads come from" items={data.leads.bySource} defaultTone="info" />
            <PipelineSpreadDonut total={data.leads.byTransaction.total} segments={data.leads.byTransaction.segments} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <CaptureBars title="Conversion by source" caption="Lead → instruction rate per source" fields={data.leads.conversionBySource} />
            <RankedBarList title="Speed of first sale" caption="Lead age when sold" items={data.leads.ageDistribution} defaultTone="good" />
          </div>
          <RankedBarList title="Disqualified leads" caption="Why leads were rejected" items={data.leads.disqualified} defaultTone="bad" />
        </div>
      )}

      {tab === 'behaviour' && (
        <div className="space-y-5">
          <SentimentDistribution title="Client sentiment" caption="How clients feel across analysed calls" levels={data.sentiment} />
          <div className="grid gap-5 xl:grid-cols-2">
            <RankedBarList title="Objections raised" caption="What leads push back on — worst handled drill in Call Analysis" items={data.objections} defaultTone="bad" />
            <RankedBarList title="Client questions" caption="What they ask" items={data.questions} defaultTone="info" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <CaptureBars title="Qualification capture" caption="Share of analysed calls where we extracted this" fields={data.capture} />
            <CommitmentsTable title="Commitments" caption="Promised vs honoured" rows={data.commitments} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <RankedBarList title="Follow-up outcomes" caption="Did the call move the lead" items={data.followups} />
            <QuoteWall title="Lines that landed" caption="Standout phrases" quotes={data.phrases} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
