// Marketing & Ads intelligence — acquisition performance, campaign attribution, pricing
// advisor, funnel, source/keyword conversion, and data-driven advice. In ty this composes
// Google/Bing Ads spend with CRM attribution; here it reads the MARKETING mock.

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMarketing, MarketingData } from '@/services/marketingService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { CampaignPerformance } from '@/components/marketing/CampaignPerformance';
import { PricingAdvisor } from '@/components/marketing/PricingAdvisor';
import { AcquisitionFunnel } from '@/components/marketing/AcquisitionFunnel';
import { MarketingAdvice } from '@/components/marketing/MarketingAdvice';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { RangeFilter, rangeLabel, scaleRangeCount, scaleRangeMoney } from '@/components/analytics/RangeFilter';

const Marketing: React.FC = () => {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    let active = true;
    fetchMarketing()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<MarketingData | null>(() => {
    if (!data) return null;

    const pounds = (value: number) => `£${value.toLocaleString()}`;
    const scaledCampaigns = data.campaigns.map((campaign) => {
      const spend = scaleRangeMoney(campaign.spend, range);
      const leads = scaleRangeCount(campaign.leads, range);
      const instructions = scaleRangeCount(campaign.instructions, range);
      return {
        ...campaign,
        spend,
        clicks: scaleRangeCount(campaign.clicks, range),
        leads,
        instructions,
        cpl: Math.round(spend / Math.max(leads, 1)),
        cpi: Math.round(spend / Math.max(instructions, 1)),
        spark: campaign.spark.map((point) => scaleRangeCount(point, range)),
      };
    });

    return {
      ...data,
      range: rangeLabel(range),
      kpis: data.kpis.map((kpi) => {
        if (kpi.label === 'Ad spend') return { ...kpi, value: pounds(scaleRangeMoney(4820, range)) };
        if (kpi.label === 'Paid leads') return { ...kpi, value: scaleRangeCount(218, range).toLocaleString() };
        if (kpi.label === 'Instructions') return { ...kpi, value: scaleRangeCount(31, range).toLocaleString() };
        return kpi;
      }),
      campaigns: scaledCampaigns,
      keywords: data.keywords.map((keyword) => ({
        ...keyword,
        leads: scaleRangeCount(keyword.leads, range),
        instructions: scaleRangeCount(keyword.instructions, range),
      })),
      pricing: {
        ...data.pricing,
        bands: data.pricing.bands.map((band) => ({
          ...band,
          sent: scaleRangeCount(band.sent, range),
          accepted: scaleRangeCount(band.accepted, range),
        })),
      },
      funnel: data.funnel.map((stage) => ({
        ...stage,
        count: scaleRangeCount(stage.count, range),
      })),
      sources: data.sources.map((source) => ({
        ...source,
        leads: scaleRangeCount(source.leads, range),
        instructions: scaleRangeCount(source.instructions, range),
      })),
    };
  }, [data, range]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-500">
        <p>Couldn&rsquo;t load marketing data.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  const activeData = rangeData ?? data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Where the <span className="font-serif italic text-navy-700">leads come from.</span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Ads &amp; acquisition intelligence — {activeData.range}.</p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={activeData.kpis} />

      <CampaignPerformance campaigns={activeData.campaigns} />

      <div className="grid gap-5 xl:grid-cols-2">
        <AcquisitionFunnel stages={activeData.funnel} />
        <PricingAdvisor pricing={activeData.pricing} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Conversion by source" caption={`Lead → instruction rate per source · ${rangeLabel(range)}`} items={activeData.sources.map((s) => ({ label: s.source, count: Math.round(s.conversion) }))} defaultTone="good" />
        <RankedBarList title="Best keywords" caption={`Conversion rate by search keyword · ${rangeLabel(range)}`} items={activeData.keywords.map((k) => ({ label: k.keyword, count: Math.round(k.conversion) }))} defaultTone="info" />
      </div>

      <MarketingAdvice advice={activeData.advice} />
    </div>
  );
};

export default Marketing;
