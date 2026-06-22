// Daily Pipeline — the agent's "today" home: hero worklist counts + today's tasks,
// callbacks due, and quotes awaiting response. Compiles existing task/lead/quota data.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ListTodo, PhoneCall, FileText } from 'lucide-react';
import { fetchDailyPipeline, DailyPipeline as DailyPipelineData } from '@/services/hubsService';
import { HubHeroCards } from '@/components/hubs/HubHeroCards';
import { DaySignalsTrend } from '@/components/hubs/DaySignalsTrend';
import { LeadOriginMap } from '@/components/hubs/LeadOriginMap';
import { PeakHoursChart } from '@/components/hubs/PeakHoursChart';
import { CallsTodayCard } from '@/components/hubs/CallsTodayCard';
import { WorklistCard } from '@/components/hubs/WorklistCard';
import { TrendLineChart } from '@/components/trends/TrendLineChart';

const DailyPipeline: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DailyPipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchDailyPipeline()
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
        <p>Couldn&rsquo;t load today&rsquo;s pipeline.</p>
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-navy-700 hover:text-navy-900">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Daily <span className="font-serif italic text-navy-700">pipeline.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Your day at a glance — who to call, what to chase, what's waiting.</p>
      </div>

      <HubHeroCards stats={data.hero} onSelect={(href) => { if (href) navigate(href); }} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Today&rsquo;s actions</h2>
        <DaySignalsTrend signals={data.signals} onSelect={(href) => navigate(href)} />
      </div>

      <TrendLineChart
        title="How the day is flowing"
        caption="Leads, instructions &amp; accepted quotes — last 14 days"
        height={200}
        series={[
          { key: 'leads', label: 'Leads', color: '#1e3a8a', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.leads[i] })) },
          { key: 'instructions', label: 'Instructions', color: '#16a34a', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.instructions[i] })) },
          { key: 'quotesAccepted', label: 'Quotes accepted', color: '#0ea5e9', points: data.flow.labels.map((x, i) => ({ x, y: data.flow.quotesAccepted[i] })) },
        ]}
      />

      <LeadOriginMap
        data={data.leadOrigins}
        onOpenRegion={(region) => navigate(`/lead-management?origin=${encodeURIComponent(region.key)}`)}
      />

      <PeakHoursChart peak={data.peakHours} />

      <CallsTodayCard calls={data.calls} onOpen={() => navigate('/call-analysis?preset=today')} />

      <div className="grid gap-5 xl:grid-cols-3">
        <WorklistCard title="Today's tasks" items={data.tasks} icon={<ListTodo className="h-4 w-4 text-navy-600" />} emptyText="No tasks due today" />
        <WorklistCard title="Callbacks due" items={data.callbacks} icon={<PhoneCall className="h-4 w-4 text-navy-600" />} emptyText="No callbacks due" />
        <WorklistCard title="Awaiting quote response" items={data.quoteResponses} icon={<FileText className="h-4 w-4 text-navy-600" />} emptyText="No open quotes" />
      </div>
    </div>
  );
};

export default DailyPipeline;
