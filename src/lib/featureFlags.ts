// Feature flags.
//
// APCM AI is a local preview for now: it only renders when
// VITE_APCM_AI_ENABLED=true is set (client/.env.local locally). Production
// builds on Vercel do not set the variable, so the page, sidebar entry,
// floating assistant, and dashboard digest stay hidden there until we flip
// the env var on.
export const APCM_AI_ENABLED = import.meta.env.VITE_APCM_AI_ENABLED === 'true';
