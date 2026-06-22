// Email & deliverability intelligence — sends, delivery, opens, bounces, spam, the
// open→instruction comparison, per-template performance, trend, and advice. In ty this
// composes the email provider's webhooks (delivered/opened/bounced/spam) with CRM
// attribution; here it reads the MAIL mock. Reuses the Marketing KPI/funnel/advice shapes.

import { supabase } from '@/lib/supabase';
import { MktKpi, MktFunnelStage, MktAdvice } from '@/services/marketingService';

export interface EmailTemplateRow { name: string; sent: number; openRate: number; bounceRate: number; conversion: number; }
export interface OpenConversion {
  openers: { count: number; instructed: number; rate: number };
  nonOpeners: { count: number; instructed: number; rate: number };
  note: string;
}
export interface EmailTrend { labels: string[]; sent: number[]; opened: number[]; bounced: number[]; }

export interface EmailData {
  range: string;
  kpis: MktKpi[];
  funnel: MktFunnelStage[];
  issues: { label: string; count: number }[];
  openConversion: OpenConversion;
  templates: EmailTemplateRow[];
  trend: EmailTrend;
  advice: MktAdvice[];
}

export async function fetchEmail(): Promise<EmailData> {
  const { data, error } = await supabase.rpc('get_email_analytics', {});
  if (error) {
    console.error('Email analytics RPC error:', error);
    throw error;
  }
  return data as EmailData;
}
