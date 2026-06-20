import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clear Outlook token from database
    await supabase
      .from('outlook_settings')
      .update({
        access_token: null,
        refresh_token: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'shared-mailbox');

    return res.json({
      success: true,
      status: 'disconnected',
      connected: false
    });
  } catch (error: any) {
    console.error('Error disconnecting Outlook:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to disconnect Outlook'
    });
  }
}

