// Email & deliverability intelligence — sends, delivery, opens, bounces, spam, the
// open→instruction comparison, per-template performance, trend, and advice. In ty this
// composes the email provider's delivery/open/bounce/spam webhooks with CRM attribution;
// here it reads the MAIL mock. Reuses the marketing KPI/advice components + trends + bars.

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchEmail, EmailData } from '@/services/emailService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { OpenConversionCompare } from '@/components/marketing/OpenConversionCompare';
import { TemplatePerformance } from '@/components/marketing/TemplatePerformance';
import { MarketingAdvice } from '@/components/marketing/MarketingAdvice';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { TrendLineChart } from '@/components/trends/TrendLineChart';

const Email: React.FC = () => {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchEmail()
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
        <p>Couldn&rsquo;t load email data.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Email &amp; <span className="font-serif italic text-navy-700">deliverability.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Are emails landing, getting opened, and converting — {data.range}.</p>
      </div>

      <MarketingKpiStrip kpis={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarList title="Deliverability funnel" caption="Sent → delivered → opened → replied" items={data.funnel} defaultTone="info" />
        <RankedBarList title="Delivery issues" caption="Bounces, spam flags &amp; failed sends" items={data.issues} defaultTone="bad" />
      </div>

      <OpenConversionCompare data={data.openConversion} />

      <TemplatePerformance templates={data.templates} />

      <TrendLineChart
        title="Sends, opens &amp; bounces"
        caption="Last 14 days"
        height={200}
        series={[
          { key: 'sent', label: 'Sent', color: '#1e3a8a', points: data.trend.labels.map((x, i) => ({ x, y: data.trend.sent[i] })) },
          { key: 'opened', label: 'Opened', color: '#16a34a', points: data.trend.labels.map((x, i) => ({ x, y: data.trend.opened[i] })) },
          { key: 'bounced', label: 'Bounced', color: '#ef4444', points: data.trend.labels.map((x, i) => ({ x, y: data.trend.bounced[i] })) },
        ]}
      />

      <MarketingAdvice advice={data.advice} />
    </div>
  );
};

export default Email;
