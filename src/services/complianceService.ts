// Compliance & onboarding — ID/AML/source-of-funds gates, KYC completeness, risk flags,
// and file-review pass rate. In ty this composes the onboarding workflow + Yoti ID/AML +
// risk register; here it reads the COMPLIANCE mock. Reuses the Marketing MktKpi shape.

import { supabase } from '@/lib/supabase';
import { MktKpi } from '@/services/marketingService';

export interface RiskFlag { matter: string; flag: string; severity: 'high' | 'med' | 'low'; owner?: string; }

export interface Compliance {
  kpis: MktKpi[];
  onboardingFunnel: { label: string; count: number }[];
  stuck: { label: string; count: number }[];
  riskFlags: RiskFlag[];
  passRateTrend: { labels: string[]; values: number[] };
}

export async function fetchCompliance(): Promise<Compliance> {
  const { data, error } = await supabase.rpc('get_compliance', {});
  if (error) { console.error('Compliance RPC error:', error); throw error; }
  return data as Compliance;
}
