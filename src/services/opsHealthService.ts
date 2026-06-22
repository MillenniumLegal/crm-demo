// Integrations & ops health — feed freshness, integration status, CRM-vs-3CX
// reconciliation trend, automation success, data completeness/duplicates. In ty this
// reads sync/health telemetry per integration; here, the mock. Reuses MktKpi.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface IntegrationStatus { name: string; status: 'healthy' | 'degraded' | 'down'; lastSync: string; note: string; }

export interface OpsHealth {
  kpis: MktKpi[];
  integrations: IntegrationStatus[];
  dataGaps: { label: string; count: number }[];
  reconTrend: { labels: string[]; values: number[] };
  errorTrend: { labels: string[]; values: number[] };
}

export async function fetchOpsHealth(): Promise<OpsHealth> {
  const { data, error } = await supabase.rpc('get_ops_health', {});
  if (error) { console.error('Ops health RPC error:', error); throw error; }
  return data as OpsHealth;
}
