import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-refresh-secret');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Optional: Check for secret key for security
    const refreshSecret = process.env.OUTLOOK_REFRESH_SECRET || '';
    const providedSecret = req.headers['x-refresh-secret'] || (req.body?.secret as string) || '';

    if (refreshSecret && providedSecret !== refreshSecret) {
      console.warn('[Outlook] Unauthorized token refresh attempt');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    console.log('[Outlook] Automated token refresh triggered at', new Date().toISOString());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Supabase environment variables not set'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: outlookConfig, error: configError } = await supabase
      .from('outlook_settings')
      .select('access_token, refresh_token, expires_at, email')
      .eq('id', 'shared-mailbox')
      .single();

    if (configError || !outlookConfig?.access_token) {
      console.log('[Outlook] No valid token found - connection is not active');
      return res.json({
        success: true,
        connected: false,
        message: 'No Outlook connection found'
      });
    }

    let accessToken = outlookConfig.access_token;
    const expiresAt = outlookConfig.expires_at ? new Date(outlookConfig.expires_at).getTime() : null;
    const now = Date.now();

    const needsRefresh = expiresAt && (now + 10 * 60 * 1000) >= expiresAt;

    if (needsRefresh && outlookConfig.refresh_token) {
      console.log(`[Outlook] Token expires at ${new Date(expiresAt!).toISOString()}, refreshing now...`);

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

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('[Outlook] Failed to refresh token:', refreshResponse.status, errorText);

          if (refreshResponse.status === 400 || refreshResponse.status === 401) {
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error === 'invalid_grant' || errorJson.error_description?.toLowerCase().includes('refresh token')) {
                console.error('[Outlook] Refresh token expired or invalid. Connection lost.');
                await supabase
                  .from('outlook_settings')
                  .update({
                    access_token: null,
                    refresh_token: null,
                    expires_at: null,
                  })
                  .eq('id', 'shared-mailbox');

                return res.json({
                  success: true,
                  connected: false,
                  message: 'Refresh token expired. Please reconnect Outlook.'
                });
              }
            } catch { }
          }

          if (expiresAt && now < expiresAt) {
            console.warn('[Outlook] Using existing token despite refresh failure (token still valid)');
            accessToken = outlookConfig.access_token;
          } else {
            return res.json({
              success: true,
              connected: false,
              message: 'Token expired and refresh failed'
            });
          }
        } else {
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

          console.log(`[Outlook] Token refreshed successfully. New expiry: ${newExpiresAt.toISOString()}`);
        }
      } catch (error: any) {
        console.error('[Outlook] Error refreshing token:', error);
        if (expiresAt && now < expiresAt) {
          console.warn('[Outlook] Using existing token despite refresh error (token still valid)');
          accessToken = outlookConfig.access_token;
        } else {
          return res.json({
            success: true,
            connected: false,
            message: 'Token expired and refresh failed'
          });
        }
      }
    }

    const finalExpiresAt = expiresAt || (outlookConfig.expires_at ? new Date(outlookConfig.expires_at).getTime() : null);
    const timeUntilExpiry = finalExpiresAt ? finalExpiresAt - now : null;
    const minutesUntilExpiry = timeUntilExpiry ? Math.round(timeUntilExpiry / 60000) : null;

    console.log(`[Outlook] Token refresh check complete. Email: ${outlookConfig.email}, expires_in: ${minutesUntilExpiry}min`);

    return res.json({
      success: true,
      connected: true,
      email: outlookConfig.email,
      expiresAt: finalExpiresAt,
      expiresInMinutes: minutesUntilExpiry,
      message: needsRefresh && accessToken !== outlookConfig.access_token ? 'Token was refreshed' : 'Token is still valid'
    });
  } catch (error: any) {
    console.error('[Outlook] Error in automated token refresh:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
}

