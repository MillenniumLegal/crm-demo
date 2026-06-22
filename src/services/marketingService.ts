// Marketing / acquisition intelligence — campaigns, keywords, pricing advisor, funnel,
// source comparison + data-driven advice. In ty this composes Google/Bing Ads spend with
// CRM attribution (utm_source/campaign/keyword → leads → quotes → instructions); here it
// hits the MARKETING mock.

import { supabase } from '@/lib/supabase';

export type MktTone = 'good' | 'warn' | 'bad' | 'info';

export interface MktKpi { label: string; value: string; sub: string; tone: MktTone; deltaPct: number; good: boolean; }
export interface MktCampaign { name: string; source: string; spend: number; clicks: number; leads: number; instructions: number; cpl: number; cpi: number; conversion: number; recommend: 'scale' | 'hold' | 'cut'; spark: number[]; }
export interface MktKeyword { keyword: string; leads: number; instructions: number; conversion: number; cpc: number; }
export interface MktPricing { bands: { band: string; sent: number; accepted: number; winRate: number }[]; recommendation: string; }
export interface MktFunnelStage { label: string; count: number; }
export interface MktSource { source: string; leads: number; instructions: number; conversion: number; deltaPct: number; }
export interface MktAdvice { severity: 'high' | 'med' | 'low'; title: string; text: string; }

export interface MarketingData {
  range: string;
  kpis: MktKpi[];
  campaigns: MktCampaign[];
  keywords: MktKeyword[];
  pricing: MktPricing;
  funnel: MktFunnelStage[];
  sources: MktSource[];
  advice: MktAdvice[];
}

export async function fetchMarketing(): Promise<MarketingData> {
  const { data, error } = await supabase.rpc('get_marketing', {});
  if (error) {
    console.error('Marketing RPC error:', error);
    throw error;
  }
  return data as MarketingData;
}
