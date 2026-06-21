// @ts-nocheck
/* ------------------------------------------------------------------ *
 * DEMO design-pack switcher. Goes beyond colour: each "design" theme
 * restyles typography (serif display / mono labels / body), card
 * shapes, borders, shadows, radii, the sidebar/rail and chrome — same
 * content, different design language. The app hardcodes brand colours
 * as Tailwind utilities (bg-[#011E41], text-[#9164CC]/15, hover:…) with
 * no CSS variables, so we (a) scan those utility classes and inject
 * per-property colour overrides, (b) inject a structural CSS block, and
 * (c) JS-tag the sidebar so it can go light with dark text. Bottom-left
 * popup switches; choice persists. NON-SHIPPED demo only.
 * ------------------------------------------------------------------ */

import { EXTRA_THEMES } from './themePacks';

interface ColorCfg { bg: string; text?: string; }
interface Theme {
  id: string; name: string; sub: string; swatch: [string, string, string];
  kind: 'live' | 'design';
  color?: { navy: ColorCfg; purple: ColorCfg; canvas: ColorCfg };
  css?: string;          // structural overrides
  tagSidebar?: boolean;  // light-rail treatment
  fontsHref?: string;    // optional Google Fonts URL for this pack
}

const NAVY = ['011e41', '011e40', '011633', '022a5c', '012258'];
const PURPLE = ['9164cc', '6d52b0', '401dba'];
const CANVAS = ['f8f8f9'];
const TEXTISH = ['text', 'fill', 'stroke', 'placeholder', 'decoration', 'caret'];

const EDITORIAL_CSS = `
html,body,#root{font-family:system-ui,-apple-system,'Segoe UI',sans-serif !important;color:#3A352B}
h1,h2,h3,h4{font-family:'Fraunces','Georgia',serif !important;font-weight:500 !important;letter-spacing:-.015em !important;color:#2B2820 !important}
.text-2xl,.text-3xl,.text-4xl,.text-5xl{font-family:'Fraunces','Georgia',serif !important}
.uppercase{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace !important;letter-spacing:.12em !important;font-weight:500 !important}
.bg-gradient-to-br,.bg-gradient-to-r,.bg-gradient-to-b,.bg-gradient-to-t{background-image:none !important}
body,.bg-gradient-to-br{background-color:#F4F1EA !important}
.card{background:#FFFDF8 !important;border:1px solid #E7DFCC !important;border-radius:13px !important;box-shadow:0 1px 2px rgba(60,48,20,.05) !important}
.rounded-lg,.rounded-xl,.rounded-2xl{border-radius:13px !important}
.rounded-md{border-radius:9px !important}
.shadow,.shadow-md,.shadow-lg,.shadow-xl,.shadow-2xl{box-shadow:0 10px 30px rgba(60,48,20,.10) !important}
.shadow-sm{box-shadow:0 1px 2px rgba(60,48,20,.05) !important}
[class*="border-gray-"]{border-color:#EAE2D2 !important}
.bg-gray-50{background-color:#F7F2E8 !important}.bg-gray-100{background-color:#F0E8D8 !important}.bg-white{background-color:#FFFDF8 !important}
.text-gray-900,.text-gray-800{color:#2B2820 !important}.text-gray-700,.text-gray-600{color:#6B6353 !important}.text-gray-500,.text-gray-400{color:#9A9079 !important}
input,select,textarea{font-family:system-ui,-apple-system,sans-serif !important}
#root .fixed.inset-y-0.left-0[class*="bg-[#011E41]"]{background:#EFEADF !important;border-right:1px solid #E2DACA !important;box-shadow:none !important}
#root .fixed.inset-y-0.left-0 [class*="text-white"]{color:#3A352B !important}
#root .fixed.inset-y-0.left-0 [class*="text-white/7"],#root .fixed.inset-y-0.left-0 [class*="text-white/6"],#root .fixed.inset-y-0.left-0 [class*="text-white/5"],#root .fixed.inset-y-0.left-0 [class*="text-white/4"],#root .fixed.inset-y-0.left-0 [class*="text-white/3"]{color:#9A9079 !important}
#root .fixed.inset-y-0.left-0 [class*="bg-white/1"],#root .fixed.inset-y-0.left-0 [class*="bg-white/2"]{background:rgba(168,126,46,.16) !important;color:#7A5E22 !important}
#root .fixed.inset-y-0.left-0 [class*="border-white"]{border-color:#E2DACA !important}
#root .fixed.inset-y-0.left-0 svg{color:#6A6152 !important}
`;

const MONO_CSS = `
html,body,#root,h1,h2,h3,h4,h5,.uppercase,input,select,textarea,button,a{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace !important}
h1,h2,h3,h4{letter-spacing:-.02em !important;font-weight:700 !important}
.uppercase{letter-spacing:.1em !important}
.bg-gradient-to-br,.bg-gradient-to-r,.bg-gradient-to-b{background-image:none !important}
body,.bg-gradient-to-br{background-color:#F4F4F1 !important}
.card{background:#FFFFFF !important;border:1px solid #1C1C22 !important;border-radius:3px !important;box-shadow:none !important}
.rounded-lg,.rounded-xl,.rounded-2xl,.rounded-md{border-radius:3px !important}
.shadow,.shadow-sm,.shadow-md,.shadow-lg,.shadow-xl,.shadow-2xl{box-shadow:none !important}
[class*="border-gray-"]{border-color:#D6D6CE !important}
.bg-gray-50{background-color:#ECECE6 !important}.bg-gray-100{background-color:#E4E4DC !important}
.text-gray-900,.text-gray-800{color:#15151A !important}
#root [class*="bg-[#011E41]"],#root [class*="bg-[#011E40]"],#root [class*="bg-[#011633]"]{background-color:#1A1A1F !important}
`;

// Hand-authored "premium" reference pack: restrained graphite chrome, one
// refined teal accent, warm white canvas, clean Inter + serif KPI numerals +
// mono labels, white sectioned rail, hairline borders, soft elevation.
const LUMEN_CSS = `
html,body,#root{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif !important;color:#1F2933 !important;-webkit-font-smoothing:antialiased !important;text-rendering:optimizeLegibility !important}
body{background-color:#FAFAF7 !important}
.bg-gradient-to-br,.bg-gradient-to-r,.bg-gradient-to-b,.bg-gradient-to-t{background-image:none !important}
h1,h2,h3,h4{font-family:'Inter',system-ui,sans-serif !important;font-weight:700 !important;letter-spacing:-.022em !important;color:#111827 !important}
.text-2xl,.text-3xl,.text-4xl,.text-5xl{font-family:'Inter',system-ui,sans-serif !important;letter-spacing:-.025em !important;color:#111827 !important}
.uppercase{font-family:'JetBrains Mono',ui-monospace,monospace !important;letter-spacing:.15em !important;font-weight:600 !important;font-size:.68rem !important;color:#0F766E !important}
input,select,textarea{font-family:'Inter',system-ui,sans-serif !important;color:#1F2933 !important}
.text-gray-900{color:#0F172A !important}.text-gray-800{color:#1F2933 !important}.text-gray-700{color:#374151 !important}.text-gray-600{color:#4B5563 !important}.text-gray-500{color:#6B7280 !important}.text-gray-400{color:#9AA3AF !important}
[class*="border-gray-"]{border-color:#E9E7E0 !important}
.bg-gray-50,.bg-gray-100{background-color:#F4F4EE !important}.bg-white{background-color:#FFFFFF !important}
.card{background:#FFFFFF !important;border:1px solid #E9E7E0 !important;border-radius:14px !important;box-shadow:0 1px 2px rgba(17,24,39,.04),0 10px 30px -16px rgba(17,24,39,.12) !important}
.rounded-md{border-radius:9px !important}.rounded-lg{border-radius:12px !important}.rounded-xl{border-radius:14px !important}.rounded-2xl{border-radius:18px !important}
.shadow,.shadow-sm,.shadow-md{box-shadow:0 1px 2px rgba(17,24,39,.05),0 6px 18px -12px rgba(17,24,39,.14) !important}
.shadow-lg,.shadow-xl,.shadow-2xl{box-shadow:0 8px 28px -10px rgba(17,24,39,.16),0 30px 60px -30px rgba(17,24,39,.2) !important}
.card .text-2xl,.card .text-3xl{font-family:'Fraunces','Georgia',serif !important;font-size:2.05rem !important;font-weight:600 !important;letter-spacing:-.02em !important;color:#111827 !important}
.card .text-sm.font-medium,.card .text-xs{font-family:'JetBrains Mono',ui-monospace,monospace !important;letter-spacing:.1em !important;text-transform:uppercase !important;font-size:.66rem !important;color:#6B7280 !important}
.card h2,.card h3{font-family:'Inter',sans-serif !important;letter-spacing:-.015em !important;color:#111827 !important}
header{background:#FFFFFF !important;border-bottom:1px solid #E9E7E0 !important;box-shadow:0 1px 0 rgba(17,24,39,.02) !important}
header h2{font-family:'Inter',sans-serif !important;font-weight:600 !important;color:#111827 !important;letter-spacing:-.01em !important}
header button{color:#4B5563 !important;border-radius:10px !important}
#root .fixed.inset-y-0.left-0[class*="bg-[#011E41]"]{background:#FFFFFF !important;border-right:1px solid #ECEAE3 !important;box-shadow:none !important}
#root .fixed.inset-y-0.left-0 [class*="uppercase"]{font-family:'JetBrains Mono',monospace !important;letter-spacing:.16em !important;font-size:.62rem !important;font-weight:600 !important;color:#0F766E !important;margin-top:16px !important;padding-top:13px !important;border-top:1px solid #EFEDE6 !important}
#root .fixed.inset-y-0.left-0 a{font-family:'Inter',sans-serif !important;font-size:.875rem !important;font-weight:500 !important;border-radius:9px !important;margin:1px 8px !important;padding:8px 11px !important}
#root .fixed.inset-y-0.left-0 a:hover{background:#F3F4F1 !important}
#root .fixed.inset-y-0.left-0 a[class*="bg-white/15"]{background:rgba(15,118,110,.1) !important;color:#0F766E !important;font-weight:600 !important;border-left:3px solid #0F766E !important;box-shadow:none !important}
#root .fixed.inset-y-0.left-0 a[class*="bg-white/15"] svg{color:#0F766E !important}
#root .fixed.inset-y-0.left-0 [class*="rounded-full"]{background:#1C2433 !important;color:#fff !important;border:none !important}
#root .fixed.inset-y-0.left-0 [class*="border-white"]{border-color:#ECEAE3 !important}
`;

// "Manuscript" re-skinned to the Movescrow mvadminui look: cool #F6F8FB ground,
// crisp white cards with a #E4E7EC hairline + barely-there shadow, navy #012258
// chrome, Geist labels + Montserrat Alternates numerals, and mvadminui's subtle
// active-nav (surface-2 fill + inset hairline, no loud bar).
const MANUSCRIPT_MV_CSS = `
html,body,#root{font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif !important;color:#3A332A !important;font-weight:500 !important}
body{background-color:#F8F6F2 !important}
.bg-gradient-to-br,.bg-gradient-to-r,.bg-gradient-to-b,.bg-gradient-to-t{background-image:none !important}
h1,h2,h3,h4{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:700 !important;letter-spacing:-.012em !important;color:#161412 !important}
.text-2xl,.text-3xl,.text-4xl,.text-5xl{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;letter-spacing:-.014em !important;color:#161412 !important}
.uppercase{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;letter-spacing:.05em !important;font-weight:600 !important;font-size:.7rem !important;text-transform:uppercase !important;color:#6E665E !important}
input,select,textarea{font-family:system-ui,-apple-system,'Segoe UI',sans-serif !important;color:#161412 !important}
.text-gray-900{color:#161412 !important}.text-gray-800{color:#2A241E !important}.text-gray-700{color:#463E36 !important}.text-gray-600{color:#6E665E !important}.text-gray-500{color:#8A8076 !important}.text-gray-400{color:#A89F95 !important}
[class*="border-gray-"]{border-color:#ECE4D8 !important}
.bg-gray-50{background-color:#F1EEEA !important}.bg-gray-100{background-color:#ECE6DC !important}.bg-white{background-color:#FFFFFF !important}
.card{background:#FFFFFF !important;border:1px solid #ECE4D8 !important;border-radius:12px !important;box-shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10) !important}
.rounded-md{border-radius:8px !important}.rounded-lg{border-radius:12px !important}.rounded-xl{border-radius:14px !important}.rounded-2xl{border-radius:16px !important}
.shadow,.shadow-sm,.shadow-md{box-shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10) !important}
.shadow-lg,.shadow-xl,.shadow-2xl{box-shadow:0 4px 12px rgba(16,24,40,.08) !important}
.card .text-2xl,.card .text-3xl{font-family:'Montserrat Alternates','Plus Jakarta Sans',system-ui,sans-serif !important;font-size:1.95rem !important;font-weight:700 !important;letter-spacing:-.02em !important;font-variant-numeric:tabular-nums !important;color:#161412 !important}
.card .text-sm.font-medium,.card .text-xs{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;letter-spacing:.02em !important;text-transform:uppercase !important;font-size:.68rem !important;font-weight:600 !important;color:#6E665E !important}
.card h2,.card h3{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;color:#161412 !important;letter-spacing:-.01em !important}
header{background:rgba(248,246,242,.85) !important;-webkit-backdrop-filter:blur(8px) !important;backdrop-filter:blur(8px) !important;border-bottom:1px solid #ECE4D8 !important;box-shadow:none !important}
header h2{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:700 !important;color:#161412 !important;letter-spacing:-.01em !important}
header button{color:#6E665E !important;border-radius:8px !important}
#root .fixed.inset-y-0.left-0[class*="bg-[#011E41]"]{background:#FFFFFF !important;border-right:1px solid #ECE4D8 !important;box-shadow:none !important}
#root button[class*="bg-[#011E41]"]:not([class*="inset-y-0"]),#root a[class*="bg-[#011E41]"]:not([class*="inset-y-0"]),#root button[class*="bg-purple-6"],#root a[class*="bg-purple-6"]{background-color:#EA580C !important;border-color:#EA580C !important}
#root .fixed.inset-y-0.left-0 [class*="bg-[#011E40]"],#root .fixed.inset-y-0.left-0 [class*="bg-[#011633]"]{background:transparent !important}
/* legibility on the white rail: dark header text + readable muted variants (name, nav labels, role) */
#root .fixed.inset-y-0.left-0 [class*="text-white"]{color:#3A332A !important}
#root .fixed.inset-y-0.left-0 [class*="text-white/7"],#root .fixed.inset-y-0.left-0 [class*="text-white/6"],#root .fixed.inset-y-0.left-0 [class*="text-white/5"],#root .fixed.inset-y-0.left-0 [class*="text-white/4"],#root .fixed.inset-y-0.left-0 [class*="text-white/3"]{color:#6E665E !important}
#root .fixed.inset-y-0.left-0 [class*="uppercase"]{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;letter-spacing:.06em !important;font-size:.64rem !important;font-weight:600 !important;color:#A89F95 !important;margin-top:14px !important;padding-top:12px !important;border-top:1px solid #F2ECE2 !important}
#root .fixed.inset-y-0.left-0 a{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:.875rem !important;font-weight:500 !important;border-radius:8px !important;margin:1px 8px !important;padding:8px 11px !important}
#root .fixed.inset-y-0.left-0 a[class*="bg-white/15"]{background:#FFF1E6 !important;color:#C2410C !important;font-weight:700 !important;box-shadow:none !important;border-left:3px solid #EA580C !important}
#root .fixed.inset-y-0.left-0 a[class*="bg-white/15"] svg{color:#EA580C !important}
#root .fixed.inset-y-0.left-0 [class*="rounded-full"]{background:#012258 !important;color:#fff !important;border:none !important}
#root .fixed.inset-y-0.left-0 [class*="border-white"]{border-color:#ECE4D8 !important}
/* chips/badges -> Movescrow admin soft semantic palette (neutral grey default, soft tints + hairline) */
[class*="bg-green-50"],[class*="bg-green-100"],[class*="bg-emerald-50"],[class*="bg-emerald-100"]{background-color:#ECFDF3 !important;border:1px solid #BBE6CC !important}
[class*="bg-blue-50"],[class*="bg-blue-100"],[class*="bg-sky-50"],[class*="bg-sky-100"],[class*="bg-indigo-50"],[class*="bg-indigo-100"],[class*="bg-purple-50"],[class*="bg-purple-100"],[class*="bg-violet-50"],[class*="bg-violet-100"],[class*="bg-cyan-50"],[class*="bg-cyan-100"]{background-color:#EFF8FF !important;border:1px solid #CFE0FB !important}
[class*="bg-yellow-50"],[class*="bg-yellow-100"],[class*="bg-amber-50"],[class*="bg-amber-100"]{background-color:#FFFAEB !important;border:1px solid #F1D9AE !important}
[class*="bg-red-50"],[class*="bg-red-100"],[class*="bg-rose-50"],[class*="bg-rose-100"],[class*="bg-pink-50"],[class*="bg-pink-100"]{background-color:#FEF3F2 !important;border:1px solid #FECDCA !important}
[class*="bg-gray-100"],[class*="bg-slate-100"],[class*="bg-zinc-100"],[class*="bg-neutral-100"]{background-color:#F1EEEA !important}
[class*="text-green-6"],[class*="text-green-7"],[class*="text-green-8"],[class*="text-emerald-6"],[class*="text-emerald-7"],[class*="text-emerald-8"]{color:#067647 !important}
[class*="text-blue-6"],[class*="text-blue-7"],[class*="text-blue-8"],[class*="text-sky-7"],[class*="text-indigo-6"],[class*="text-indigo-7"],[class*="text-indigo-8"],[class*="text-purple-6"],[class*="text-purple-7"],[class*="text-purple-8"],[class*="text-violet-7"]{color:#175CD3 !important}
[class*="text-yellow-7"],[class*="text-yellow-8"],[class*="text-amber-6"],[class*="text-amber-7"],[class*="text-amber-8"]{color:#B54708 !important}
[class*="text-red-6"],[class*="text-red-7"],[class*="text-red-8"],[class*="text-rose-7"],[class*="text-pink-7"]{color:#B42318 !important}
.btn-primary{background-color:#EA580C !important;border-color:#EA580C !important;color:#fff !important}
.btn-primary:hover{background-color:#C2410C !important;border-color:#C2410C !important}
.btn-primary[class*="min-w-[88px]"],.btn-primary[class*="flex-1"]{background-color:#FFFFFF !important;border:1px solid #DCD3C4 !important;color:#012258 !important}
.btn-primary[class*="min-w-[88px]"] *,.btn-primary[class*="flex-1"] *{color:#012258 !important}
.btn-primary[class*="min-w-[88px]"]:hover,.btn-primary[class*="flex-1"]:hover{background-color:#F4EFE7 !important;border-color:#CFC4B2 !important}
[class*="bg-green-500"],[class*="bg-green-600"],[class*="bg-green-700"],[class*="bg-emerald-500"],[class*="bg-emerald-600"]{background-color:#ECFDF3 !important;border:1px solid #BBE6CC !important;color:#067647 !important}
[class*="bg-green-500"] *,[class*="bg-green-600"] *,[class*="bg-green-700"] *,[class*="bg-emerald-500"] *,[class*="bg-emerald-600"] *{color:#067647 !important}
[class*="bg-red-500"],[class*="bg-red-600"],[class*="bg-red-700"],[class*="bg-rose-500"],[class*="bg-rose-600"]{background-color:#FEF3F2 !important;border:1px solid #FECDCA !important;color:#B42318 !important}
[class*="bg-red-500"] *,[class*="bg-red-600"] *,[class*="bg-red-700"] *,[class*="bg-rose-500"] *,[class*="bg-rose-600"] *{color:#B42318 !important}
[class*="bg-yellow-500"],[class*="bg-yellow-600"],[class*="bg-amber-500"],[class*="bg-amber-600"]{background-color:#FFFAEB !important;border:1px solid #F1D9AE !important;color:#B54708 !important}
[class*="bg-yellow-500"] *,[class*="bg-yellow-600"] *,[class*="bg-amber-500"] *,[class*="bg-amber-600"] *{color:#B54708 !important}
[class*="bg-blue-500"],[class*="bg-blue-600"],[class*="bg-blue-700"],[class*="bg-sky-500"],[class*="bg-sky-600"],[class*="bg-indigo-500"],[class*="bg-indigo-600"]{background-color:#EFF8FF !important;border:1px solid #CFE0FB !important;color:#175CD3 !important}
[class*="bg-blue-500"] *,[class*="bg-blue-600"] *,[class*="bg-blue-700"] *,[class*="bg-sky-500"] *,[class*="bg-sky-600"] *,[class*="bg-indigo-500"] *,[class*="bg-indigo-600"] *{color:#175CD3 !important}
[class*="absolute"][class*="bg-red-500"],[class*="absolute"][class*="bg-red-600"]{background-color:#DC2626 !important;border:0 !important;color:#fff !important}
[class*="absolute"][class*="bg-red-500"] *,[class*="absolute"][class*="bg-red-600"] *{color:#fff !important}
/* chart fills: solid 500-weight bars / dots / progress stay VIVID (the soften-solid rules above mute them; data viz wants full colour). Soft -50/-100 chips are untouched. */
[class*="bg-green-500"],[class*="bg-emerald-500"]{background-color:#16A34A !important;border:0 !important}
[class*="bg-amber-500"],[class*="bg-yellow-500"]{background-color:#F59E0B !important;border:0 !important}
[class*="bg-red-500"],[class*="bg-rose-500"]{background-color:#EF4444 !important;border:0 !important}
#root .fixed.inset-y-0.left-0 [class*="h-px"]{background-color:#E0D8C8 !important}

/* ============================================================
   MANUSCRIPT — Movescrow "Selection Program" refinement pass
   Append after line 163; appended source order + raised specificity
   lets these win over the existing rules at lines 130, 161.
   Orange = CTAs/progress/achievement only. Navy = chrome/emphasis.
   ============================================================ */

/* ---------- 1. NOTIFICATION / TOP BAR (quiet, not red) ---------- */
#root header button[aria-label="Notifications"] span[class*="absolute"][class*="bg-red-500"],#root header span[class*="absolute"][class*="bg-red-500"]{background-color:#012258 !important;border:1.5px solid #F8F6F2 !important;color:#fff !important;box-shadow:0 0 0 1px rgba(1,34,88,.18) !important;font-family:'Montserrat Alternates','Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:700 !important;letter-spacing:0 !important;min-width:18px !important;height:18px !important;font-variant-numeric:tabular-nums !important}
#root header span[class*="absolute"][class*="bg-red-500"] *{color:#fff !important}
#root header button[aria-label="Notifications"],#root header button[aria-label="Toggle menu"]{color:#012258 !important;border:1px solid #ECE4D8 !important;background-color:#FFFFFF !important;border-radius:10px !important;box-shadow:0 1px 2px rgba(16,24,40,.05) !important}
#root header button[aria-label="Notifications"]:hover,#root header button[aria-label="Toggle menu"]:hover{color:#012258 !important;background-color:#F4EFE7 !important;border-color:#DCD3C4 !important}
#root header button[aria-label="Notifications"] svg,#root header button[aria-label="Toggle menu"] svg{color:#012258 !important;stroke:#012258 !important}

/* ---------- 2. HERO GREETING (oversized personal greeting) ---------- */
#root [data-hero="greeting"]{margin-bottom:6px !important}
#root [data-hero="greeting"] h1{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:2.35rem !important;line-height:1.08 !important;font-weight:800 !important;letter-spacing:-.028em !important;color:#161412 !important;margin:0 0 6px 0 !important}
#root [data-hero="greeting"] p{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:1rem !important;line-height:1.5 !important;font-weight:500 !important;letter-spacing:-.006em !important;color:#6E665E !important;text-transform:none !important;margin:0 !important;max-width:62ch !important}
#root [data-hero-pill]{display:inline-flex !important;align-items:center !important;height:24px !important;padding:0 11px !important;border-radius:9999px !important;background:#FFFFFF !important;border:1px solid #ECE4D8 !important;color:#6E665E !important;font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:.7rem !important;font-weight:600 !important;letter-spacing:.04em !important;text-transform:uppercase !important;margin-bottom:10px !important}
@media (max-width:640px){#root [data-hero="greeting"] h1{font-size:1.85rem !important}}

/* ---------- 3. STAT / KPI CARDS (hairline, big tabular numeral, soft round icon chip) ---------- */
.card.cursor-pointer{padding:22px 24px !important;border:1px solid #ECE4D8 !important;transition:box-shadow .18s ease,border-color .18s ease,transform .18s ease !important}
.card.cursor-pointer:hover{transform:none !important;border-color:#E2D8C8 !important;box-shadow:0 1px 2px rgba(16,24,40,.06),0 8px 20px -12px rgba(16,24,40,.18) !important}
.card.cursor-pointer:active{transform:none !important}
.card.cursor-pointer .flex.items-center.gap-4{gap:16px !important}
.card.cursor-pointer .p-3.rounded-lg{width:44px !important;height:44px !important;min-width:44px !important;padding:0 !important;border-radius:9999px !important;display:flex !important;align-items:center !important;justify-content:center !important;box-shadow:none !important}
.card.cursor-pointer .p-3.rounded-lg svg{width:20px !important;height:20px !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-blue-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-sky-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-indigo-500"]{background-color:#EFF8FF !important;border:1px solid #CFE0FB !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-blue-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-sky-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-indigo-500"] svg{color:#175CD3 !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-green-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-emerald-500"]{background-color:#ECFDF3 !important;border:1px solid #BBE6CC !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-green-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-emerald-500"] svg{color:#067647 !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-yellow-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-amber-500"]{background-color:#FFFAEB !important;border:1px solid #F1D9AE !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-yellow-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-amber-500"] svg{color:#B54708 !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-red-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-rose-500"]{background-color:#FEF3F2 !important;border:1px solid #FECDCA !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-red-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-rose-500"] svg{color:#B42318 !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-purple-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-violet-500"]{background-color:#FCEEE3 !important;border:1px solid #F6D9C2 !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-purple-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-violet-500"] svg{color:#C2410C !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-teal-500"],.card.cursor-pointer .p-3.rounded-lg[class*="bg-cyan-500"]{background-color:#EEF2F7 !important;border:1px solid #D4DEEB !important}
.card.cursor-pointer .p-3.rounded-lg[class*="bg-teal-500"] svg,.card.cursor-pointer .p-3.rounded-lg[class*="bg-cyan-500"] svg{color:#012258 !important}
.card.cursor-pointer .min-w-0 .text-sm.font-medium.text-gray-600{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;text-transform:uppercase !important;letter-spacing:.06em !important;font-size:.68rem !important;font-weight:600 !important;color:#8A8076 !important;margin-bottom:3px !important}
.card.cursor-pointer .min-w-0 .text-2xl.font-bold.text-gray-900{font-family:'Montserrat Alternates','Plus Jakarta Sans',system-ui,sans-serif !important;font-size:2.15rem !important;font-weight:700 !important;line-height:1.05 !important;letter-spacing:-.022em !important;font-variant-numeric:tabular-nums !important;color:#161412 !important}
.card.cursor-pointer .text-xs.font-medium.text-green-600{color:#067647 !important;font-weight:600 !important}
.card.cursor-pointer .text-xs.font-medium.text-red-600{color:#B42318 !important;font-weight:600 !important}

/* ---------- 4. PILLS / SEGMENTED CONTROL (navy active, soft-orange counts) ---------- */
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"]{background-color:#F4EFE7 !important;border-bottom:1px solid #ECE4D8 !important}
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"] > button{color:#6E665E !important;font-weight:600 !important;transition:background-color .15s,color .15s !important}
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"] > button:hover{background-color:#FBF8F3 !important;color:#161412 !important}
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"] > button[class*="bg-white"]{background-color:#012258 !important;color:#FFFFFF !important;font-weight:700 !important;box-shadow:inset 0 -2px 0 #012258 !important}
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"] > button[class*="bg-white"] [class*="rounded-full"][class*="bg-gray-200"]{background-color:rgba(255,255,255,.20) !important;color:#FFFFFF !important;border:0 !important;font-weight:700 !important}
#root [class*="grid-cols-3"][class*="bg-gray-50"][class*="border-b"] > button:not([class*="bg-white"]) [class*="rounded-full"][class*="bg-gray-200"]{background-color:#FCEEE3 !important;color:#C2410C !important;border:1px solid #F6D9C2 !important;font-weight:700 !important}
#root [class*="rounded-full"][class*="bg-gray-200"],#root [class*="rounded-full"][class*="bg-gray-100"]{font-variant-numeric:tabular-nums !important}
#root span[class*="rounded-full"][class*="px-2"][class*="py-0.5"],#root span[class*="rounded-full"][class*="px-1.5"][class*="py-0.5"]{border-radius:9999px !important;font-weight:600 !important;letter-spacing:.01em !important;line-height:1.2 !important}

/* ---------- 5. EMPHASIS PANEL — Action Center / FloatingTaskBox (deep navy, quiet count) ---------- */
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"]{background:#012258 !important;border:0 !important}
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] h3,#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="text-white"]:not([class*="text-white/"]){color:#FFFFFF !important}
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="text-white/7"],#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="text-white/6"],#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="text-white/5"],#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] p{color:rgba(255,255,255,.72) !important}
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] svg{color:#FFFFFF !important}
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="bg-[#6D52B0]"]{background:rgba(255,255,255,.16) !important;color:#FFFFFF !important;border:1px solid rgba(255,255,255,.22) !important;font-weight:600 !important}
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] button:hover,#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="hover:bg-[#011633]"]:hover{background:rgba(255,255,255,.12) !important}
#root button.rounded-full[class*="bg-[#011E41]"]:not([class*="inset-y-0"]){background:#012258 !important;border-color:#012258 !important;color:#FFFFFF !important}
#root button.rounded-full[class*="bg-[#011E41]"]:not([class*="inset-y-0"]):hover{background:#011A45 !important;border-color:#011A45 !important}
#root button.rounded-full[class*="bg-[#011E41]"]:not([class*="inset-y-0"]) [class*="bg-[#6D52B0]"]{background:rgba(255,255,255,.16) !important;color:#FFFFFF !important;font-weight:600 !important}
#root .fixed.bottom-4.right-4 .grid [class*="text-[#011E41]"]{color:#012258 !important}
#root [class*="bg-[#011E41]"][class*="text-white"] button.btn-primary,#root [class*="bg-[#011633]"][class*="text-white"] button.btn-primary,#root [class*="bg-[#011E41]"][class*="text-white"] a.btn-primary{background-color:#EA580C !important;border-color:#EA580C !important;color:#FFFFFF !important}
#root [class*="bg-[#011E41]"][class*="text-white"] button.btn-primary:hover,#root [class*="bg-[#011633]"][class*="text-white"] button.btn-primary:hover{background-color:#F97316 !important;border-color:#F97316 !important}

/* ---------- 6. RHYTHM / SPACING + CTA DISCIPLINE (walk back over-orange; navy Quick Actions) ---------- */
#root main > .max-w-7xl > .space-y-6 > * + *{margin-top:30px !important}
#root main > .max-w-7xl > .space-y-6 > div:first-child{margin-bottom:4px !important}
#root main{padding-top:32px !important;padding-bottom:40px !important}
.card{padding:26px !important}
.card > .flex.items-center.justify-between.mb-4,.card > .mb-4{margin-bottom:18px !important}
.card h3.text-lg{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:700 !important;font-size:1.075rem !important;letter-spacing:-.014em !important;color:#161412 !important}
#root a.inline-flex[class*="bg-[#011E41]"]:not([class*="inset-y-0"]),#root button.inline-flex[class*="bg-[#011E41]"]:not([class*="inset-y-0"]){background-color:#EA580C !important;border-color:#EA580C !important;color:#FFFFFF !important;box-shadow:0 1px 2px rgba(234,88,12,.20) !important}
#root a.inline-flex[class*="bg-[#011E41]"]:not([class*="inset-y-0"]):hover,#root button.inline-flex[class*="bg-[#011E41]"]:not([class*="inset-y-0"]):hover{background-color:#C2410C !important;border-color:#C2410C !important}
#root a.inline-flex[class*="bg-purple-6"],#root button.inline-flex[class*="bg-purple-6"]{background-color:#012258 !important;border-color:#012258 !important;color:#FFFFFF !important;box-shadow:0 1px 2px rgba(1,34,88,.18) !important}
#root a.inline-flex[class*="bg-purple-6"]:hover,#root button.inline-flex[class*="bg-purple-6"]:hover{background-color:#01194a !important;border-color:#01194a !important}
#root a.inline-flex[class*="bg-gray-50"][class*="border-gray-200"]{background-color:#FFFFFF !important;border:1px solid #ECE4D8 !important;color:#161412 !important;font-weight:600 !important;border-radius:10px !important}
#root a.inline-flex[class*="bg-gray-50"][class*="border-gray-200"]:hover{background-color:#F4EFE7 !important;border-color:#DCD3C4 !important}
.card button[class*="text-blue-600"]{color:#012258 !important;font-weight:600 !important}
.card button[class*="text-blue-600"]:hover{color:#01194a !important}
.grid [class*="bg-blue-50"][class*="border-blue-100"]{background-color:#EFF8FF !important;border:1px solid #CFE0FB !important}
.grid [class*="bg-amber-50"][class*="border-amber-100"]{background-color:#FFFAEB !important;border:1px solid #F1D9AE !important}
.card .space-y-2 > .flex[class*="rounded-lg"]{padding:10px !important;border-radius:10px !important}
#root main > .max-w-7xl > .space-y-6 > .grid{gap:24px !important;margin-top:30px !important}

/* ============================================================
   MANUSCRIPT — Selection Program refinement pass II
   Append after line 252, immediately before the closing backtick.
   Appended source order + raised specificity let these win over
   the chip rules (139-160) and the activity-row rule (251).
   Orange = CTAs/progress/achievement only. Navy = chrome/emphasis.
   ============================================================ */

/* ---------- A. NATIVE SELECTS / DROPDOWNS (embedded warm caret) ---------- */
#root select{-webkit-appearance:none !important;-moz-appearance:none !important;appearance:none !important;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif !important;font-weight:500 !important;font-size:.875rem !important;color:#161412 !important;background-color:#FFFFFF !important;border:1px solid #ECE4D8 !important;border-radius:10px !important;min-height:40px !important;padding:8px 38px 8px 12px !important;cursor:pointer !important;background-repeat:no-repeat !important;background-position:right 12px center !important;background-size:16px 16px !important;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236E665E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") !important;transition:border-color .15s,box-shadow .15s !important}
#root select:hover{border-color:#DCD3C4 !important}
#root select:focus,#root select:focus-visible{outline:none !important;border-color:#EA580C !important;box-shadow:0 0 0 3px rgba(234,88,12,.15) !important;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23C2410C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") !important}
#root select:disabled{background-color:#F4EFE7 !important;color:#A89F95 !important;cursor:not-allowed !important;opacity:1 !important}
#root select option{background-color:#FFFFFF !important;color:#161412 !important;padding:6px 10px !important}
#root select option:checked{background-color:#FCEEE3 !important;color:#C2410C !important}
#root select[multiple]{background-image:none !important;padding-right:12px !important;min-height:auto !important}

/* ---------- B. SIDEBAR FOOTER (user/logout) — remap for the WHITE rail ----------
   Rail bg is forced white (line 129); line 131 already neutralises the navy slab to
   transparent, but the footer keeps white text that goes invisible. These rules are
   scoped under .fixed.inset-y-0.left-0 + .border-t so the bottom-right Action Center
   (also bg-[#011E40]) is untouched, matching the existing exclusion discipline. */
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"]{background:#FBF8F3 !important;border-top:1px solid #ECE4D8 !important;border-color:#ECE4D8 !important}
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"] p.text-white{color:#161412 !important;font-weight:600 !important}
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"] p[class*="text-white/6"]{color:#6E665E !important}
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"] button[class*="text-white/6"]{color:#6E665E !important;border:1px solid #ECE4D8 !important;border-radius:8px !important;background:#FFFFFF !important;transition:color .15s ease,background-color .15s ease,border-color .15s ease !important}
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"] button[class*="text-white/6"]:hover{color:#B42318 !important;background:#FEF3F2 !important;border-color:#FECDCA !important}
#root .fixed.inset-y-0.left-0 .border-t[class*="bg-[#011E40]"] button[class*="text-white/6"] svg{color:inherit !important}

/* ---------- C. TOP BAR — tighten logo + wordmark (admin restraint) ----------
   This header h2 rule is appended AFTER line 127 so its font-size wins (equal specificity). */
header img{width:34px !important;height:34px !important;filter:none !important;-webkit-filter:none !important;border-radius:7px !important}
header h2{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:600 !important;font-size:.9375rem !important;line-height:1.15 !important;letter-spacing:-.012em !important;color:#161412 !important;white-space:nowrap !important}
header .flex.items-center.space-x-3{column-gap:10px !important}

/* ============================================================
   D. TODAY'S ACTIVITY CARD (Dashboard .card.min-h-[320px])
   Timeline rail + dot halos, hairline rows, quiet right-aligned
   timestamp, ink action line / secondary lead name, soft View All.
   Appended last: wins over chip rules (153-160) + row rule (251).
   ============================================================ */
#root .card[class*="min-h-[320px]"] > .space-y-2{position:relative !important}
#root .card[class*="min-h-[320px]"] > .space-y-2 > * + *{margin-top:0 !important}
#root .card[class*="min-h-[320px]"] > .space-y-2::before{content:"" !important;position:absolute !important;left:13px !important;top:14px !important;bottom:14px !important;width:1.5px !important;background:#ECE4D8 !important;border-radius:1px !important;pointer-events:none !important}
#root .card[class*="min-h-[320px]"] > .space-y-2 > div[class*="rounded-lg"]{position:relative !important;padding:11px 8px !important;border-radius:0 !important;border-bottom:1px solid #F2ECE2 !important;transition:background-color .15s ease !important}
#root .card[class*="min-h-[320px]"] > .space-y-2 > div[class*="rounded-lg"]:last-child{border-bottom:0 !important}
#root .card[class*="min-h-[320px]"] > .space-y-2 > div[class*="rounded-lg"]:hover{background-color:#FBF8F3 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"]{position:relative !important;z-index:1 !important;width:8px !important;height:8px !important;border:0 !important;box-shadow:0 0 0 3px #FFFFFF !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"][class*="bg-blue-500"]{background-color:#175CD3 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"][class*="bg-green-500"],#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"][class*="bg-green-600"]{background-color:#067647 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"][class*="bg-purple-500"]{background-color:#C2410C !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"][class*="bg-yellow-500"]{background-color:#B54708 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 p[class*="font-medium"][class*="text-gray-900"]{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:.845rem !important;font-weight:600 !important;line-height:1.35 !important;letter-spacing:-.006em !important;color:#161412 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 p[class*="text-gray-600"]:not([class*="font-medium"]){font-size:.78rem !important;font-weight:500 !important;line-height:1.4 !important;color:#6E665E !important;margin-top:1px !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="text-gray-500"][class*="whitespace-nowrap"]{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-size:.72rem !important;font-weight:500 !important;letter-spacing:.005em !important;color:#A89F95 !important;font-variant-numeric:tabular-nums !important}
#root .card[class*="min-h-[320px]"] .space-y-2 span[class*="rounded-full"][class*="text-[11px]"]{border-radius:9999px !important;font-weight:600 !important;letter-spacing:.005em !important;line-height:1.25 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 button[class*="text-gray-600"]{color:#A89F95 !important;border-radius:8px !important}
#root .card[class*="min-h-[320px]"] .space-y-2 button[class*="text-gray-600"]:hover{color:#012258 !important;background-color:#F4EFE7 !important}
#root .card[class*="min-h-[320px]"] > .flex button[class*="text-blue-600"]{display:inline-flex !important;align-items:center !important;gap:5px !important;padding:3px 11px !important;border-radius:9999px !important;background-color:#F4EFE7 !important;border:1px solid #ECE4D8 !important;color:#012258 !important;font-size:.76rem !important;font-weight:600 !important;font-variant-numeric:tabular-nums !important;transition:background-color .15s ease,border-color .15s ease !important}
#root .card[class*="min-h-[320px]"] > .flex button[class*="text-blue-600"]:hover{background-color:#EDE5D8 !important;border-color:#DCD3C4 !important;color:#01194a !important}
#root .card[class*="min-h-[320px]"] .space-y-2 > div[class*="text-center"][class*="py-8"]{padding:34px 12px !important;color:#8A8076 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 > div[class*="text-center"][class*="py-8"] > p:first-child{font-size:.9rem !important;font-weight:600 !important;color:#463E36 !important}
#root .card[class*="min-h-[320px]"] .space-y-2 > div[class*="text-center"][class*="py-8"] > p.text-xs{color:#A89F95 !important;margin-top:4px !important}

/* ---------- E. SIGNAL CHIPS (opt-in via data-signal; needs the component edits below) ----------
   Appended here (after lines 139-160 and 153-154) so equal-specificity attribute
   rules win on source order. Three intent tiers only; everything else stays neutral. */
#root span[data-signal]{font-weight:700 !important;gap:6px !important;padding:1px 10px 1px 9px !important;border-radius:9999px !important;display:inline-flex !important;align-items:center !important}
#root span[data-signal] span[data-signal-dot]{width:6px !important;height:6px !important;border-radius:9999px !important;flex:0 0 6px !important;display:inline-block !important}
#root span[data-signal=priority-high]{background-color:#FEE4E2 !important;border:1px solid #FDA29B !important;color:#B42318 !important}
#root span[data-signal=priority-high] span[data-signal-dot]{background-color:#D92D20 !important}
#root span[data-signal=intent-interested]{background-color:#D3F8DF !important;border:1px solid #73E2A3 !important;color:#067647 !important}
#root span[data-signal=intent-interested] span[data-signal-dot]{background-color:#067647 !important}
#root span[data-signal=milestone-quote-accepted]{background-color:#067647 !important;border:1px solid #067647 !important;color:#FFFFFF !important}
#root span[data-signal=milestone-quote-accepted] *{color:#FFFFFF !important}
/* ---------- F. FORM CONTROLS + SCROLLBARS (kill remaining browser defaults) ---------- */
#root input[type="checkbox"],#root input[type="radio"]{accent-color:#012258 !important;width:16px !important;height:16px !important;cursor:pointer !important}
#root input[type="checkbox"]:focus-visible,#root input[type="radio"]:focus-visible{outline:2px solid #EA580C !important;outline-offset:2px !important}
#root *::-webkit-scrollbar{width:10px !important;height:10px !important}
#root *::-webkit-scrollbar-track{background:transparent !important}
#root *::-webkit-scrollbar-thumb{background:#E0D8C8 !important;border-radius:9999px !important;border:2px solid transparent !important;background-clip:padding-box !important}
#root *::-webkit-scrollbar-thumb:hover{background:#D2C7B2 !important;background-clip:padding-box !important}
/* ---------- G. UNIFIED FOCUS RING (inputs/textarea ring + button/link outline) ---------- */
#root input:not([type="checkbox"]):not([type="radio"]):focus,#root input:not([type="checkbox"]):not([type="radio"]):focus-visible,#root textarea:focus,#root textarea:focus-visible{outline:none !important;border-color:#EA580C !important;box-shadow:0 0 0 3px rgba(234,88,12,.15) !important}
#root button:focus-visible,#root a:focus-visible,#root [role="button"]:focus-visible{outline:2px solid #EA580C !important;outline-offset:2px !important}
/* ---------- H. NATIVE DATE/TIME INPUTS (warm box + dimmed picker glyph) ---------- */
#root input[type="date"],#root input[type="datetime-local"],#root input[type="time"],#root input[type="month"]{font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;color:#161412 !important;background-color:#FFFFFF !important;border:1px solid #ECE4D8 !important;border-radius:10px !important;padding:8px 12px !important}
#root input[type="date"]::-webkit-calendar-picker-indicator,#root input[type="datetime-local"]::-webkit-calendar-picker-indicator,#root input[type="time"]::-webkit-calendar-picker-indicator,#root input[type="month"]::-webkit-calendar-picker-indicator{opacity:.5 !important;cursor:pointer !important;filter:saturate(.55) !important}
#root input[type="date"]::-webkit-calendar-picker-indicator:hover,#root input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover,#root input[type="time"]::-webkit-calendar-picker-indicator:hover{opacity:.85 !important}
/* ---------- I. LOADING SPINNERS (branded navy) ---------- */
#root [class*="animate-spin"][class*="text-gray-4"]{color:#012258 !important}
/* ---------- J. SECONDARY BUTTONS (white ghost + hairline + warm hover) ---------- */
.btn-secondary{background-color:#FFFFFF !important;border:1px solid #ECE4D8 !important;color:#161412 !important;border-radius:10px !important;font-weight:600 !important;box-shadow:none !important}
.btn-secondary:hover{background-color:#F4EFE7 !important;border-color:#DCD3C4 !important;color:#161412 !important}
.btn-secondary svg{color:#6E665E !important}
/* ---------- K. TODAY'S ACTIVITY — drop connecting rail + dot halo (cleaner dotted list) ---------- */
#root .card[class*="min-h-[320px]"] > .space-y-2::before{display:none !important}
#root .card[class*="min-h-[320px]"] .space-y-2 div[class*="rounded-full"][class*="w-2"]{box-shadow:none !important}
/* ---------- L. DATA TABLES (Quotes / Payments / Reports etc.) ---------- */
#root table thead th{background-color:#FBF8F3 !important;border-bottom:1px solid #ECE4D8 !important;color:#8A8076 !important;font-family:'Plus Jakarta Sans',system-ui,sans-serif !important;font-weight:600 !important;letter-spacing:.05em !important}
#root table tbody tr{border-bottom:1px solid #F2ECE2 !important}
#root table tbody tr:last-child{border-bottom:0 !important}
#root table tbody tr:hover{background-color:#FBF8F3 !important}
#root table tbody td{color:#2A241E !important}
/* ---------- M. ATTENTION KPI CARD (urgent / needs-attention, red shade) ---------- */
#root .card[data-variant="attention"]{background:linear-gradient(135deg,#FEECEA 0%,#FFFFFF 72%) !important;border:1px solid #FBD3CF !important;box-shadow:0 1px 2px rgba(180,35,24,.05),0 1px 3px rgba(180,35,24,.08) !important}
#root .card[data-variant="attention"]:hover{border-color:#F7B9B3 !important;box-shadow:0 1px 2px rgba(180,35,24,.06),0 10px 22px -12px rgba(180,35,24,.24) !important}
/* ---------- N. RAIL ICONS — a touch more weight ---------- */
#root .fixed.inset-y-0.left-0 a svg{stroke-width:2.25 !important}
#root .fixed.inset-y-0.left-0 a[class*="bg-white/15"] svg{stroke-width:2.5 !important}
/* ---------- O. ACTION CENTER COUNT — a touch of orange ---------- */
#root .fixed.bottom-4.right-4 .rounded-t-lg[class*="bg-[#011E41]"] [class*="bg-[#6D52B0]"],#root button.rounded-full[class*="bg-[#011E41]"]:not([class*="inset-y-0"]) [class*="bg-[#6D52B0]"]{background:#EA580C !important;color:#FFFFFF !important;border:0 !important;font-weight:700 !important}
/* ---------- P. ACTIVE HIGHLIGHT READABILITY — the bg-[#011E41]/10 active tint was being forced SOLID orange by rule 130 while text stayed dark (unreadable). Restore a readable soft-orange active state. ---------- */
#root button[class*="bg-[#011E41]/10"]:not([class*="inset-y-0"]),#root div[class*="bg-[#011E41]/10"]:not([class*="inset-y-0"]),#root a[class*="bg-[#011E41]/10"]:not([class*="inset-y-0"]){background-color:#FFF1E6 !important;border-color:transparent !important;color:#C2410C !important;font-weight:600 !important}
#root [class*="bg-[#011E41]/10"] svg{color:#C2410C !important}
#root [class*="bg-[#011E41]/10"] span:not([class*="rounded-full"]){color:#C2410C !important}
#root [class*="bg-[#011E41]/10"] [class*="bg-[#6D52B0]"]{background-color:#EA580C !important;color:#FFFFFF !important;border:0 !important}
/* ---------- Q. navy-* SCALE IS INDIGO in the app Tailwind config — de-indigo to true navy. Uses ~= (exact token) so navy-50 != navy-500. Fixes Reports "Today"/tabs, Diary clock, the APCM float bg, etc. ---------- */
#root [class~="bg-navy-500"],#root [class~="bg-navy-600"],#root [class~="bg-navy-700"],#root [class~="bg-navy-800"],#root [class~="bg-navy-900"],#root [class~="bg-navy-950"]{background-color:#012258 !important;border-color:#012258 !important;color:#FFFFFF !important}
#root [class~="bg-navy-50"],#root [class~="bg-navy-100"],#root [class~="bg-navy-200"],#root [class~="bg-navy-300"],#root [class~="bg-navy-400"]{background-color:#EAEFF6 !important;border-color:#DCE3EE !important}
#root [class~="text-navy-500"],#root [class~="text-navy-600"],#root [class~="text-navy-700"],#root [class~="text-navy-800"],#root [class~="text-navy-900"],#root [class~="text-navy-950"]{color:#012258 !important}
#root [class~="text-navy-300"],#root [class~="text-navy-400"]{color:#5B7BB5 !important}
#root [class~="border-navy-500"],#root [class~="border-navy-600"],#root [class~="border-navy-700"],#root [class~="border-navy-800"],#root [class~="border-navy-900"]{border-color:#012258 !important}
#root [class~="hover:bg-navy-700"]:hover,#root [class~="hover:bg-navy-800"]:hover,#root [class~="hover:bg-navy-900"]:hover,#root [class~="hover:bg-navy-950"]:hover{background-color:#01194a !important}
#root [class*="text-purple-3"],#root [class*="text-purple-4"],#root [class*="text-purple-5"],#root [class*="text-violet-3"],#root [class*="text-violet-4"],#root [class*="text-violet-5"]{color:#175CD3 !important}

`;

const THEMES: Theme[] = [
  { id: 'live', name: 'Live', sub: 'Navy + Purple · clean sans', swatch: ['#011E41', '#9164CC', '#F8F8F9'], kind: 'live' },
  {
    id: 'manuscript', name: 'Manuscript', sub: 'web/admin · warm cream, orange CTA · Plus Jakarta', swatch: ['#EA580C', '#012258', '#F8F6F2'],
    kind: 'design', css: MANUSCRIPT_MV_CSS,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Montserrat+Alternates:wght@600;700&display=swap',
    color: { navy: { bg: '#012258', text: '#161412' }, purple: { bg: '#EA580C', text: '#C2410C' }, canvas: { bg: '#F8F6F2' } },
  },
  {
    id: 'editorial', name: 'Editorial', sub: 'Cream + gold · serif & mono, light rail', swatch: ['#A87E2E', '#EFEADF', '#F4F1EA'],
    kind: 'design', tagSidebar: true, css: EDITORIAL_CSS,
    color: { navy: { bg: '#A87E2E', text: '#2B2820' }, purple: { bg: '#B58A3C', text: '#8A6A1E' }, canvas: { bg: '#F4F1EA' } },
  },
  {
    id: 'mono', name: 'Carbon', sub: 'Charcoal + gold · all-mono, sharp', swatch: ['#1A1A1F', '#C9A24B', '#F4F4F1'],
    kind: 'design', tagSidebar: false, css: MONO_CSS,
    color: { navy: { bg: '#1A1A1F', text: '#15151A' }, purple: { bg: '#C9A24B', text: '#A77E1E' }, canvas: { bg: '#F4F4F1' } },
  },
  {
    id: 'lumen', name: 'Lumen', sub: 'Premium graphite · teal · serif numerals', swatch: ['#1C2433', '#0F766E', '#FAFAF7'],
    kind: 'design', css: LUMEN_CSS,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap',
    color: { navy: { bg: '#1C2433', text: '#111827' }, purple: { bg: '#0F766E', text: '#0F766E' }, canvas: { bg: '#FAFAF7' } },
  },
  ...(EXTRA_THEMES as Theme[]),
];

const loadedFonts = new Set<string>();
function ensureFont(href?: string) {
  if (!href || loadedFonts.has(href)) return;
  loadedFonts.add(href);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}

function familyOf(hex: string) { if (NAVY.includes(hex)) return 'navy'; if (PURPLE.includes(hex)) return 'purple'; if (CANVAS.includes(hex)) return 'canvas'; return null; }
function resolve(theme: Theme, prefix: string, hex: string) {
  const fam = familyOf(hex); if (!fam || !theme.color) return null;
  const cfg = (theme.color as any)[fam]; if (!cfg) return null;
  return TEXTISH.includes(prefix) ? (cfg.text || cfg.bg) : cfg.bg;
}

const PROP: Record<string, string> = {
  bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color',
  from: '--tw-gradient-from', to: '--tw-gradient-to', via: '--tw-gradient-via',
  fill: 'fill', stroke: 'stroke', placeholder: 'color', accent: 'accent-color',
  divide: 'border-color', outline: 'outline-color', decoration: 'text-decoration-color', caret: 'caret-color',
};
const TOKEN_RE = /^(?:([a-z-]+):)?(bg|text|border|ring|from|via|to|fill|stroke|placeholder|accent|divide|outline|decoration|caret)-\[#([0-9a-fA-F]{6})\](?:\/(\d{1,3}))?$/;
function variantSel(v: string) {
  if (!v) return { pre: '', suf: '' };
  const ps: Record<string, string> = { hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', active: ':active', disabled: ':disabled', 'focus-within': ':focus-within' };
  if (ps[v]) return { pre: '', suf: ps[v] };
  if (v === 'group-hover') return { pre: '.group:hover ', suf: '' };
  if (v === 'group-focus') return { pre: '.group:focus ', suf: '' };
  return null;
}
function rgb(hex: string) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function colorVal(hex: string, op?: string) { if (op == null) return hex; const [r, g, b] = rgb(hex); return `rgb(${r} ${g} ${b} / ${Math.min(Number(op), 100) / 100})`; }

const seen = new Set<string>();
function scanTokens() {
  document.querySelectorAll('[class]').forEach((el) => {
    const cls = el.getAttribute('class'); if (!cls || cls.indexOf('[#') < 0) return;
    cls.split(/\s+/).forEach((t) => { if (t.indexOf('[#') > -1 && !seen.has(t) && TOKEN_RE.test(t)) seen.add(t); });
  });
}
function buildColorCss(theme: Theme) {
  const out: string[] = [];
  seen.forEach((token) => {
    const m = token.match(TOKEN_RE); if (!m) return;
    const [, variant = '', prefix, hexRaw, op] = m;
    const newHex = resolve(theme, prefix, hexRaw.toLowerCase()); if (!newHex) return;
    const vp = variantSel(variant); if (!vp) return;
    let sel = vp.pre + '.' + CSS.escape(token) + vp.suf;
    if (prefix === 'placeholder') sel += '::placeholder';
    out.push(`${sel}{${PROP[prefix]}:${colorVal(newHex, op)} !important}`);
  });
  return out.join('\n');
}

function tagSidebar(on: boolean) {
  document.querySelectorAll('.ed-side').forEach((e) => e.classList.remove('ed-side'));
  if (!on) return;
  let best: Element | null = null, bestH = 0;
  document.querySelectorAll('[class*="bg-[#011E41]"],[class*="bg-[#011E40]"]').forEach((el) => {
    const h = (el as HTMLElement).offsetHeight; if (h > bestH) { bestH = h; best = el; }
  });
  if (best && bestH > 250) (best as HTMLElement).classList.add('ed-side');
}

function styleEl(id: string) {
  let s = document.getElementById(id) as HTMLStyleElement | null;
  if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
  return s;
}
function hexToRgb2(hex: string) { hex = (hex || '').replace('#', ''); if (hex.length === 3) hex = hex.split('').map((c) => c + c).join(''); return [parseInt(hex.slice(0, 2), 16) || 0, parseInt(hex.slice(2, 4), 16) || 0, parseInt(hex.slice(4, 6), 16) || 0]; }
// The rail <a> resists colour rules but its <span>/<svg> children don't; and a
// pack may be light- or dark-railed. So auto-detect rail luminance and force the
// nav LABEL + ICON colour on the real text nodes (active items keep pack styling).
function railTextFix(theme: any, tries = 10) {
  const side = document.querySelector('.fixed.inset-y-0.left-0[class*="bg-[#011E41]"]') as HTMLElement | null;
  if (!side) { if (tries > 0) setTimeout(() => railTextFix(theme, tries - 1), 120); return; }
  const m = (getComputedStyle(side).backgroundColor || '').match(/\d+/g);
  const lumv = m ? (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) : 0;
  const lightRail = lumv > 140;
  let ink: string, icon: string;
  if (lightRail) {
    ink = (theme.color && theme.color.navy && (theme.color.navy.text || theme.color.navy.bg)) || '#1f2937';
    const r = hexToRgb2(ink); icon = `rgba(${r[0]},${r[1]},${r[2]},0.72)`;
  } else { ink = '#ffffff'; icon = 'rgba(255,255,255,0.78)'; }
  const base = '#root .fixed.inset-y-0.left-0 a:not([class*="bg-white/15"])';
  styleEl('demo-theme-railfix').textContent =
    `${base} span,${base}{color:${ink} !important}\n${base} svg{color:${icon} !important}`;
}

let active = 'live';
function apply(id: string) {
  active = id;
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  try { localStorage.setItem('demo-theme', id); } catch (_) {}
  if (theme.kind === 'live') {
    styleEl('demo-theme-color').textContent = '';
    styleEl('demo-theme-struct').textContent = '';
    styleEl('demo-theme-railfix').textContent = '';
    tagSidebar(false);
  } else {
    ensureFont(theme.fontsHref);
    scanTokens();
    styleEl('demo-theme-color').textContent = buildColorCss(theme);
    styleEl('demo-theme-struct').textContent = theme.css || '';
    tagSidebar(!!theme.tagSidebar);
    railTextFix(theme);
  }
  document.querySelectorAll('.demo-theme-opt').forEach((o) => o.classList.toggle('is-on', o.getAttribute('data-id') === id));
}

let timer: any = null;
function scheduleRebuild() {
  if (active === 'live') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const theme = THEMES.find((t) => t.id === active)!;
    const before = seen.size; scanTokens();
    if (seen.size !== before) styleEl('demo-theme-color').textContent = buildColorCss(theme);
    tagSidebar(!!theme.tagSidebar);
    railTextFix(theme);
  }, 200);
}

function buildUi() {
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);

  const css = document.createElement('style');
  css.textContent = `
  .demo-theme-fab{position:fixed;left:16px;bottom:16px;z-index:99999;width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;background:#111827;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-size:18px;font-family:system-ui,sans-serif}
  .demo-theme-pop{position:fixed;left:16px;bottom:70px;z-index:99999;width:280px;max-height:72vh;overflow-y:auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:10px;display:none;font-family:system-ui,sans-serif}
  .demo-theme-pop.is-open{display:block}
  .demo-theme-h{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;padding:4px 6px 8px}
  .demo-theme-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1px solid transparent;background:none;border-radius:10px;padding:9px;cursor:pointer}
  .demo-theme-opt:hover{background:#f3f4f6}
  .demo-theme-opt.is-on{border-color:#111827;background:#f9fafb}
  .demo-theme-sw{display:flex;flex:none;border-radius:7px;overflow:hidden;width:46px;height:32px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
  .demo-theme-sw i{flex:1}
  .demo-theme-nm{font-size:13.5px;font-weight:700;color:#111827}
  .demo-theme-sub{font-size:11px;color:#6b7280}`;
  document.head.appendChild(css);

  const fab = document.createElement('button'); fab.className = 'demo-theme-fab'; fab.title = 'Switch design (demo)'; fab.innerHTML = '◐';
  const pop = document.createElement('div'); pop.className = 'demo-theme-pop';
  pop.innerHTML = '<div class="demo-theme-h">Design</div>' + THEMES.map((t) =>
    `<button class="demo-theme-opt" data-id="${t.id}"><span class="demo-theme-sw"><i style="background:${t.swatch[0]}"></i><i style="background:${t.swatch[1]}"></i><i style="background:${t.swatch[2]}"></i></span><span><span class="demo-theme-nm">${t.name}</span><br><span class="demo-theme-sub">${t.sub}</span></span></button>`).join('');
  document.body.appendChild(fab); document.body.appendChild(pop);
  fab.addEventListener('click', () => pop.classList.toggle('is-open'));
  pop.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('.demo-theme-opt'); if (b) apply(b.getAttribute('data-id')!); });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target as Node) && e.target !== fab) pop.classList.remove('is-open'); });
}

function init() {
  buildUi();
  let saved = 'live'; try { saved = localStorage.getItem('demo-theme') || 'live'; } catch (_) {}
  if (!THEMES.find((t) => t.id === saved)) saved = 'live'; // drop removed themes
  apply(saved);
  new MutationObserver(scheduleRebuild).observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

export {};
