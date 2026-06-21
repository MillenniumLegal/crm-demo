// Daily Pipeline — the agent's "today" home: hero worklist counts + today's tasks,
// callbacks due, and quotes awaiting response. Compiles existing task/lead/quota data.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ListTodo, PhoneCall, FileText } from 'lucide-react';
import { fetchDailyPipeline, DailyPipeline as DailyPipelineData } from '@/services/hubsService';
import { HubHeroCards } from '@/components/hubs/HubHeroCards';
import { WorklistCard } from '@/components/hubs/WorklistCard';

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
          Daily <span className="font-serif italic text-navy-700">pipeline.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Your day at a glance — who to call, what to chase, what's waiting.</p>
      </div>

      <HubHeroCards stats={data.hero} onSelect={(href) => { if (href) navigate(href); }} />

      <div className="grid gap-5 xl:grid-cols-3">
        <WorklistCard title="Today's tasks" items={data.tasks} icon={<ListTodo className="h-4 w-4 text-navy-600" />} emptyText="No tasks due today" />
        <WorklistCard title="Callbacks due" items={data.callbacks} icon={<PhoneCall className="h-4 w-4 text-navy-600" />} emptyText="No callbacks due" />
        <WorklistCard title="Awaiting quote response" items={data.quoteResponses} icon={<FileText className="h-4 w-4 text-navy-600" />} emptyText="No open quotes" />
      </div>
    </div>
  );
};

export default DailyPipeline;
