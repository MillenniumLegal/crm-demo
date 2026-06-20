import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

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
    const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
    const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || '';
    const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
    const CLIENT_URL = process.env.CLIENT_URL || 'https://www.apcmcrm.co.uk';
    const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || `${CLIENT_URL}/api/outlook/callback`;

    if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Outlook integration is not configured'
      });
    }

    const { userId } = req.query;

    // Generate state token
    const state = crypto.randomBytes(16).toString('hex');

    // Store state in memory (in production, use Redis or database)
    // For now, we'll pass it through the OAuth flow
    // The callback will validate it

    const AUTHORITY = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0`;

    const params = new URLSearchParams({
      client_id: OUTLOOK_CLIENT_ID,
      response_type: 'code',
      redirect_uri: OUTLOOK_REDIRECT_URI,
      response_mode: 'query',
      scope: [
        'offline_access',
        'Mail.ReadWrite',
        'Mail.Send',
        'User.Read'
      ].join(' '),
      state
    });

    const authorizeUrl = `${AUTHORITY}/authorize?${params.toString()}`;
    res.redirect(authorizeUrl);
  } catch (error: any) {
    console.error('Error initiating Outlook connection:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate Outlook connection'
    });
  }
}

