// @ts-nocheck
/* ------------------------------------------------------------------ *
 * Global fetch shim for the demo build. Intercepts edge-function and
 * /api/* calls (which bypass the supabase client via raw fetch) so the
 * demo never reaches the network. Local /public assets pass through.
 * Imported FIRST in main.tsx.
 * ------------------------------------------------------------------ */
import { OVERVIEW_REPORT } from './mockData';

const realFetch = window.fetch ? window.fetch.bind(window) : null;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const isEdge = /\/functions\/v1\//.test(url);
  const isApi = /(^|\/)api\//.test(url) || url.startsWith('/api');
  if (isEdge || isApi) {
    if (/outlook\/status/i.test(url)) return jsonResponse({ connected: false });
    if (/sms-status/i.test(url)) return jsonResponse({ connected: false });
    if (/reports-overview/i.test(url)) return jsonResponse({ data: OVERVIEW_REPORT });
    // generic benign success for everything else (payment-link, instruction-link,
    // create-user-with-link, generate-invite-link, delete-user, change-password,
    // quote-acceptance-url, outlook send/schedule/reset/disconnect, sms-send, ...)
    return jsonResponse({ success: true, url: '#', link: '#', magicLink: '#', user: null, connected: false });
  }
  // same-origin static assets (e.g. /millennium-legal-logo.svg) and anything else
  if (realFetch) return realFetch(input, init);
  return jsonResponse({});
};

export {};
