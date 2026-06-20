import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: outlookConfig, error: configError } = await supabase
      .from('outlook_settings')
      .select('access_token, refresh_token, expires_at, email, last_synced, connected_by')
      .eq('id', 'shared-mailbox')
      .single();

    if (configError || !outlookConfig?.access_token) {
      return res.json({
        success: true,
        connected: false
      });
    }

    // Check if token needs refresh (within 10 minutes of expiry)
    const expiresAt = outlookConfig.expires_at ? new Date(outlookConfig.expires_at).getTime() : null;
    const now = Date.now();
    const needsRefresh = expiresAt && (now + 10 * 60 * 1000) >= expiresAt;

    let accessToken = outlookConfig.access_token;
    let tokenRefreshed = false;

    if (needsRefresh && outlookConfig.refresh_token) {
      try {
        const AUTHORITY = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0`;
        const refreshResponse = await fetch(`${AUTHORITY}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.OUTLOOK_CLIENT_ID!,
            client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
            refresh_token: outlookConfig.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);
          await supabase
            .from('outlook_settings')
            .update({
              access_token: refreshData.access_token,
              refresh_token: refreshData.refresh_token || outlookConfig.refresh_token,
              expires_at: newExpiresAt.toISOString(),
              last_synced: new Date().toISOString(),
            })
            .eq('id', 'shared-mailbox');

          tokenRefreshed = true;
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }

    const finalExpiresAt = expiresAt || (outlookConfig.expires_at ? new Date(outlookConfig.expires_at).getTime() : null);
    const timeUntilExpiry = finalExpiresAt ? finalExpiresAt - now : null;
    const minutesUntilExpiry = timeUntilExpiry ? Math.round(timeUntilExpiry / 60000) : null;

    return res.json({
      success: true,
      connected: true,
      email: outlookConfig.email,
      lastSynced: outlookConfig.last_synced,
      expiresAt: finalExpiresAt,
      connectedBy: outlookConfig.connected_by,
      tokenRefreshed,
      expiresInMinutes: minutesUntilExpiry
    });
  } catch (error: any) {
    console.error('Error checking Outlook status:', error);
    return res.json({
      success: true,
      connected: false
    });
  }
}

