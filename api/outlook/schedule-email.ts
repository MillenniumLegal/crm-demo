import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseRecipients(input?: string | string[]): string[] {
  if (!input) {
    return [];
  }
  const list = Array.isArray(input) ? input : input.split(',').map((item) => item.trim());
  return list
    .map((email) => email.toLowerCase())
    .filter((email) => emailRegex.test(email));
}

interface ScheduleEmailBody {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  sendAt: string;
  saveToSentItems?: boolean;
  leadId?: string;
  leadName?: string;
  scheduledBy?: string;
  scheduledByName?: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    fileName: string;
    contentType?: string;
    contentBytes: string;
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ScheduleEmailBody;

    // Validate Outlook is configured
    const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
    const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || '';

    if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Outlook integration is not configured on the server.'
      });
    }

    // Validate recipients
    const toRecipients = normaliseRecipients(body.to);
    if (!toRecipients.length) {
      return res.status(400).json({
        success: false,
        error: 'At least one valid "to" recipient email is required.'
      });
    }

    // Validate sendAt
    const sendAt = new Date(body.sendAt);
    if (Number.isNaN(sendAt.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sendAt value.'
      });
    }

    // Validate sendAt is at least 1 minute in the future
    if (sendAt.getTime() < Date.now() + 60_000) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled send time must be at least 1 minute in the future.'
      });
    }

    // Validate email content
    if (!body.htmlBody && !body.textBody) {
      return res.status(400).json({
        success: false,
        error: 'Email content is required to schedule a send.'
      });
    }

    // Attachments not supported for scheduled emails
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Attachments are not currently supported for scheduled emails.'
      });
    }

    const ccRecipients = normaliseRecipients(body.cc);
    const bccRecipients = normaliseRecipients(body.bcc);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Supabase environment variables not set'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert scheduled email into database
    const { error: insertError } = await supabase
      .from('outlook_scheduled_emails')
      .insert({
        lead_id: body.leadId || null,
        lead_name: body.leadName || null,
        to_emails: toRecipients,
        cc_emails: ccRecipients.length ? ccRecipients : null,
        bcc_emails: bccRecipients.length ? bccRecipients : null,
        subject: body.subject?.trim() || '(no subject)',
        html_body: body.htmlBody || null,
        text_body: body.textBody || null,
        send_at: sendAt.toISOString(),
        save_to_sent_items: body.saveToSentItems !== undefined ? body.saveToSentItems : true,
        status: 'pending',
        metadata: body.metadata || {},
        scheduled_by: body.scheduledBy || null,
        scheduled_by_name: body.scheduledByName || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting scheduled email:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to schedule email',
        details: insertError.message
      });
    }

    return res.json({
      success: true,
      message: 'Email scheduled successfully.',
      leadId: body.leadId,
      leadName: body.leadName,
      sendAt: sendAt.toISOString()
    });
  } catch (error: any) {
    console.error('Unexpected Outlook scheduleEmail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error while scheduling email via Outlook.',
      details: error?.message
    });
  }
}

