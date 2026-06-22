// Marketing & Ads intelligence — acquisition performance, campaign attribution, pricing
// advisor, funnel, source/keyword conversion, and data-driven advice. In ty this composes
// Google/Bing Ads spend with CRM attribution; here it reads the MARKETING mock.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMarketing, MarketingData } from '@/services/marketingService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { CampaignPerformance } from '@/components/marketing/CampaignPerformance';
import { PricingAdvisor } from '@/components/marketing/PricingAdvisor';
import { AcquisitionFunnel } from '@/components/marketing/AcquisitionFunnel';
import { MarketingAdvice } from '@/components/marketing/MarketingAdvice';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const Marketing: React.FC = () => {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMarketing()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Where the <span className="font-serif italic text-navy-700">leads come from.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Ads &amp; acquisition intelligence — {data.range}.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <CampaignPerformance campaigns={data.campaigns} />

      <div className="grid gap-5 xl:grid-cols-2">
        <AcquisitionFunnel stages={data.funnel} />
        <PricingAdvisor pricing={data.pricing} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Conversion by source" caption="Lead → instruction rate per source" items={data.sources.map((s) => ({ label: s.source, count: Math.round(s.conversion) }))} defaultTone="good" />
        <RankedBarList title="Best keywords" caption="Conversion rate by search keyword" items={data.keywords.map((k) => ({ label: k.keyword, count: Math.round(k.conversion) }))} defaultTone="info" />
      </div>

      <MarketingAdvice advice={data.advice} />
    </div>
  );
};

export default Marketing;
