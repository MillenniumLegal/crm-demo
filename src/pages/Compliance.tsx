// Compliance & onboarding — ID/AML/source-of-funds gates, KYC completeness, the onboarding
// risk funnel (where matters get stuck), risk flags, and the file-review pass-rate trend.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchCompliance, Compliance as Comp } from '@/services/complianceService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { TrendLineChart } from '@/components/trends/TrendLineChart';
import { RiskFlagBoard } from '@/components/compliance/RiskFlagBoard';

const Compliance: React.FC = () => {
  const [data, setData] = useState<Comp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCompliance()
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
          Compliance &amp; <span className="font-serif italic text-navy-700">onboarding.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">ID, AML and risk — who is cleared, and who is stuck.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Onboarding funnel" caption="Instructed → cleared to proceed" items={data.onboardingFunnel} defaultTone="info" />
        <RankedBarList title="Where matters are stuck" caption="Outstanding onboarding steps" items={data.stuck} defaultTone="warn" />
      </div>

      <RiskFlagBoard flags={data.riskFlags} />

      <TrendLineChart
        title="File-review pass rate"
        caption="Last 6 months (%)"
        area
        height={200}
        series={[{ key: 'pr', label: 'Pass %', color: '#16a34a', points: data.passRateTrend.labels.map((x, i) => ({ x, y: data.passRateTrend.values[i] })) }]}
      />
    </div>
  );
};

export default Compliance;
