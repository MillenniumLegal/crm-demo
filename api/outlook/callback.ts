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
    const { code, state, error, error_description } = req.query;

    const CLIENT_URL = process.env.CLIENT_URL || 'https://www.apcmcrm.co.uk';
    const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
    const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || '';
    const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
    const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || `${CLIENT_URL}/api/outlook/callback`;

    if (error) {
      console.error('Outlook OAuth error:', error, error_description);
      return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
    }

    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
    }

    // Note: In production, validate state token here
    // For now, we'll proceed with the OAuth flow

    const AUTHORITY = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0`;
    const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

    try {
      // Exchange code for token
      const tokenResponse = await fetch(`${AUTHORITY}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: OUTLOOK_CLIENT_ID,
          client_secret: OUTLOOK_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: OUTLOOK_REDIRECT_URI
        })
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        console.error('Failed to exchange Outlook code:', tokenResponse.status, text);
        return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
      }

      const tokenData = await tokenResponse.json() as any;

      if (!tokenData.access_token) {
        console.error('Outlook token response missing access_token', tokenData);
        return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
      }

      // Get user profile
      const meResponse = await fetch(`${GRAPH_BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      if (!meResponse.ok) {
        const text = await meResponse.text();
        console.error('Failed to fetch Outlook profile:', meResponse.status, text);
        return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
      }

      const profile = await meResponse.json() as any;
      const email = profile.mail || profile.userPrincipalName;

      // Store token in database
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const expiresAt = new Date(Date.now() + (Number(tokenData.expires_in) || 3600) * 1000);

        await supabase
          .from('outlook_settings')
          .upsert({
            id: 'shared-mailbox',
            email: email,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_at: expiresAt.toISOString(),
            last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });
      }

      return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=connected`);
    } catch (err: any) {
      console.error('Unexpected Outlook callback error:', err);
      return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
    }
  } catch (error: any) {
    console.error('Error in Outlook callback:', error);
    const CLIENT_URL = process.env.CLIENT_URL || 'https://www.apcmcrm.co.uk';
    return res.redirect(`${CLIENT_URL}/settings?tab=notifications&outlook=error`);
  }
}

