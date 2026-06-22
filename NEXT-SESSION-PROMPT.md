# APCM `crm-demo` — next-session handoff prompt

Paste this to the next agent (Codex/Claude) to continue the work.

---

## What this is
`crm-demo` is a **premium, NON-SHIPPED demo copy** of APCM's real production CRM (`ty`, branded **hpa** — a UK residential-conveyancing firm: sale / purchase / remortgage, leads → quote → instruction → completion). Its job is to **prototype premium "compare-with-the-past" visibility and new sections fast**, then port the good parts into `ty` via `CRM-EXPANSION-PORT-MANIFEST.md`.

**Guiding aim (the owner's words):** *"almost every possible thing that can be compared with the past should be visible — no dead ends randomly."* Plus: grouped, clickable signals that open a **right-side drill-down panel** (never bounce to another page), **APCM AI as a per-page advisor**, and **dynamic time filters everywhere** ("that's what makes it premium").

## Where it is
- **Repo:** https://github.com/MillenniumLegal/crm-demo (branch `main`, remote `origin`).
- **Local path / cd:** `C:\APCM GROUP\crm-demo`  (Windows; Git Bash + PowerShell both available).
- **The real CRM (port target):** `C:\APCM GROUP\ty` (separate repo — do NOT confuse).

## Stack & build
- Vite + React 18 + TypeScript + Tailwind + lucide-react + react-router-dom.
- **Build = `vite build` (esbuild — NO tsc), so TYPE ERRORS DO NOT BLOCK** the build or dev server. Runtime correctness is what matters.
- Dev server on **port 3000** (`npm run dev`). Verify in-browser with the preview tools (`preview_eval`, `preview_console_logs`); **screenshots are broken** in this environment — use DOM evals.

## Demo data model (important)
- All data is in **`src/lib/mockData.ts`** (`@ts-nocheck`, very large). It exports an `RPC` object that **intercepts `supabase.rpc(name)`** — every `get_*` function returns a mock object.
- Services in **`src/services/*Service.ts`** call `supabase.rpc('get_*', {})` and type the result. Pattern to add a feature: write a `FOO` const + `get_foo: () => FOO` in mockData → a `fooService.ts` → a page → wire route in `App.tsx` + nav in `Sidebar.tsx` → verify.
- The mock supabase query builder DOES apply `.eq/.lt/.gt/.in/.gte` filters; tables expose denormalised joins. `ymd(daysAgo)` = UTC date helper (matches page `getToday()`); `iso(...)` uses LOCAL setHours (can shift UTC date — prefer `ymd` for date-only).
- **Agent names in drafts must come from this list only:** Dej A · Jonny Green · Louise Forshaw · Helen Sadler. (Do NOT copy real names like Noman/Maya/Shehroz from hpa screenshots.)

## Conventions (match these)
- Card shell: `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`. Title `text-sm font-semibold text-gray-900`, caption `text-xs text-gray-500`. `tabular-nums` on numbers.
- **THEME SAFETY (critical):** the theme switcher overrides `bg-*-500` globally, so **DATA colours (bars/dots/fills/deltas) must use inline `style` hex or SVG attrs — NEVER `bg-*-500` classes.** Soft `bg-*-50/100` chips are fine. Tones: good `#16a34a`, warn `#f59e0b`, bad `#ef4444`, navy `#1e3a8a`, indigo `#4338ca`.
- **Reusable components:** `MarketingKpiStrip` (kpis), `RankedBarList` (items {label,count}), `TrendLineChart` (series {key,label,color,points:{x,y}}, supports `area`), `ForecastChart`, `SignalGroup` + `SignalDrawer` (clickable signal → right-side drill-down — see below), `RangeFilter` (+ `RANGE_SCALE`) for dynamic time filtering, plus the hubs/* / analytics/* / callintel/* sets.
- **`lucide-react` in this version has NO `UserSearch` export** (and some other newer icons). A bad icon import crashes the whole shell to a blank page — stick to verified icons (Search, MapPin, Tags, Sparkles, etc.).
- Guard EVERY divide with `Math.max(denom,1)`; no NaN in widths/SVG coords; empty arrays render a muted placeholder.

## The shared drill-down panel (`src/components/callinsights/SignalDrawer.tsx`)
This is THE premium pattern, used by Call Insights, Lead Analytics, Lead Categories (and should be reused for new drill-downs). It is **portaled to `document.body`** (so `fixed` is viewport-relative — full height, no top gap), **42% wide on ≥768px** (min 720, max 1000), **locks page scroll** while open (only the panel scrolls), has a **bordered close button**, an **"Ask APCM AI"** inline-insight button, a flex stats strip (no empty-grid gaps), an optional handling breakdown (Strong/Adequate/Weak/Missed), and per-call CLIENT SAID / REP REPLIED / CLIENT REACTION / NOTE. `SignalItem`/`SignalCall` fields are optional so both the Call-Insights (quote+note) and Lead-Analytics (handling) formats render.

## What's already built (all verified console-clean; see `CRM-EXPANSION-PORT-MANIFEST.md` tracks ⑰–㉚)
Email & Deliverability · Call Intelligence (agent day, inbound Opt1/3, CRM-vs-3CX verification, callback funnel) · **Call Insights** (AI conversation analytics, 6 signal groups) · **Lead Analytics** (handling-quality drill-down) · **Lead Categories** (call-voice taxonomy → category + trigger words + routing, with `RangeFilter`) · **Lead Enrichment** (domain→job/seniority, UK regions, decision-maker signal) · Matter Progression · Compliance & onboarding · Ops Health · Client Experience · Sales Velocity · Capacity · **Forecast** (confidence bands) · **Best Time to Call** (pickup-rate heatmap, range+metric toggles, call-vs-pickup mismatch) · Revenue Boost · Lead Resale + Eligibility Queue/Sell Panel · **Conversations** (ManyChat-style, agent-aware) · **Agent Workspace** (live agent view) · Marketing · Team · Instructions/Finance/Comparison enhancement bands · **floating page-aware APCM AI advisor** (cost readout, stacked above the task box) · **8-section collapsible sidebar** · theme default = **Manuscript**.

## What's LEFT to do (the queue, roughly prioritised)
1. **Roll `RangeFilter` across the remaining graphs** (Lead Analytics, Call Insights, Forecast, Sales Velocity, Marketing, etc.) so every chart filters by Today/7d/30d/90d/Year/All — owner wants this everywhere ("makes it premium"). Pattern: hold a `range` state, scale counts by `RANGE_SCALE[range]` (or refetch per-range).
2. **Business-analytics drill-downs** — on Analytics → Business/Leads, clicking a row/filter opens the shared SignalDrawer that **tags the calls + source and links a clicked person (e.g. "Diane Thomas") back to their lead** (`/lead-management?leadId=...`). Owner: general filters backed by the customer words that triggered the section.
3. **Ops 9am daily-review** dashboard — Connor's ops team reviews the CRM daily at 9am; they need one "what's best / what needs attention today" briefing (AI-generated).
4. **Contact Attempts** page upgrade (it's stale: add graphs, recontact→conversion, progress) and **Quotes** page depth.
5. **Merge Finance + Payments** (owner asked).
6. **Forecast depth** (more in-depth, more scenarios).
7. **Callbacks command-centre** (Action-Centre layout: per-callback commitments/objections + 5-day timeline) and **multi-view Leads board** (List / Pipeline / By owner / By source + saved-view chips) — from hpa screenshots.
8. **Category chip per lead** (surface the call-voice category on each lead) + the full voice taxonomy panel.
9. **Lead-detail chat embed** — reskin LeadManagement's Communication Center into the bubble style (large, sensitive file — do carefully).
10. Anything else that adds "compare-with-past" visibility; the owner keeps adding ideas (use multi-agent workflows to ideate/build where helpful).

## Hard constraints (do not break)
- **NEVER touch production Supabase** (ref `zxyvworgnzemogzderum`) or run prod migrations/deploys. Migrations are manual SQL.
- **Commit only; push only when explicitly told "push".** **NEVER add Claude/Co-Authored-By attribution to commits.**
- **Demo-only files never port to `ty`:** `mockData.ts`, `themeSwitcher.ts` / `themePacks*`, the feature-flag override, and any UUID-guard relaxations in services (`/^lead-/` allowances). The manifest's "ty BACKEND" notes say what to wire to live data.
- Keep APCM AI feature-flagged OFF in `ty` (`import.meta.env.VITE_APCM_AI_ENABLED === 'true'`).

## Workflow that works here
Scout inline → spawn multi-agent workflow(s) to build per-distinct-file components with adversarial review → wire pages/routes/nav yourself → verify in-browser with `preview_eval` → seed mock-data gaps. Restart the dev server to clear stale HMR console errors before a final clean check.
