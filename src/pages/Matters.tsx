// Live Matters — post-instruction case visibility. The CRM mirrors live case status
// (stage, days-in-stage, next action) so the firm can see progress without leaving the
// CRM. In ty this is sourced from Hoowla (the conveyancing case system).

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMatters, MattersData } from '@/services/hubsService';
import { HubHeroCards } from '@/components/hubs/HubHeroCards';
import { MattersStageStrip } from '@/components/matters/MattersStageStrip';
import { MattersList } from '@/components/matters/MattersList';

const Matters: React.FC = () => {
  const [data, setData] = useState<MattersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMatters()
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
          Live <span className="font-serif italic text-navy-700">matters.</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Post-instruction case progress — synced from Hoowla.</p>
      </div>

      <HubHeroCards stats={data.stats} />
      <MattersStageStrip stages={data.stages} distribution={data.distribution} />
      <MattersList stages={data.stages} matters={data.matters} />
    </div>
  );
};

export default Matters;
