// @ts-nocheck
/* Extra design packs. Two sources, both mapped into the Theme model used by
 * themeSwitcher.ts: themePacks.raw.json (broad agent-generated set, curated by
 * KEEP) + themePacksPremium.raw.json (premium-recipe batch, all kept).
 * NON-SHIPPED demo only. */
import raw from './themePacks.raw.json';
import premium from './themePacksPremium.raw.json';

const KEEP = ['claret-and-brass', 'cloud', 'paper']; // 'manuscript' re-authored as a built-in (mvadminui look)

function mapTheme(t) {
  return {
    id: t.id, name: t.name, sub: t.sub, swatch: t.swatch, kind: 'design',
    fontsHref: (t.fontsHref || '').replace(/&amp;/g, '&'),
    color: {
      navy: { bg: t.navyBg, text: t.navyText || undefined },
      purple: { bg: t.purpleBg, text: t.purpleText || undefined },
      canvas: { bg: t.canvas || (t.swatch && t.swatch[2]) || '#F4F4F5' },
    },
    css: t.css,
  };
}

export const EXTRA_THEMES = [].concat(
  (raw || []).filter((t) => t && t.id && t.css && KEEP.indexOf(t.id) >= 0).map(mapTheme),
  (premium || []).filter((t) => t && t.id && t.css).map(mapTheme),
);
