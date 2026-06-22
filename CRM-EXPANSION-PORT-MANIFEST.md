# CRM expansion — port manifest (crm-demo → ty)

Broader product tracks beyond Call Analysis (which has its own `CALL-ANALYSIS-PORT-MANIFEST.md`).
Prototyped in crm-demo (mock data, visible at localhost:3000), copy into ty once finalized.
**Mock-data changes are demo-only and must NOT be ported.**

Tracks: ① Pipeline Pulse · ② Quick-win chips/badges · ③ Analytics hub + nav regroup · ④ Finance + Daily Pipeline · ⑤ Matters (Hoowla case visibility — scope first).

---

## ① Pipeline Pulse (leads cockpit landing) — BUILT & VERIFIED

### Copy as-is into ty (NEW files)
| crm-demo path | → ty path |
|---|---|
| `src/components/pulse/PipelineSpreadDonut.tsx` | `client/src/components/pulse/…` |
| `src/components/pulse/PulseBarsCard.tsx` | (Hot leads / Other active / Overdue) |
| `src/components/pulse/StageFunnel.tsx` | (7-stage funnel + movement-today) |
| `src/components/pulse/LiveActivityStrip.tsx` | (recent calls + deposits) |
| `src/components/pulse/SmartLeadChips.tsx` | (one-click filter chips) |
| `src/pages/PipelinePulse.tsx` | the landing page |

### Copy into ty service: `client/src/services/leadsService.ts`
Add interfaces `PulseSegment / PulseBars / PulseFunnelStage / PulseCall / PulseDeposit / PulseChip / PipelinePulse` and `fetchPipelinePulse()` (one RPC call). Components take inline props — `PipelinePulse.tsx` maps the service object onto them.

### Re-apply into ty
- `client/src/App.tsx`: import `PipelinePulse` + a `<Route path="/pipeline-pulse">` (ProtectedRoute > Layout, same pattern as /dashboard).
- `client/src/components/Layout/Sidebar.tsx`: add `Activity` to the lucide import + `{ name: 'Pipeline Pulse', href: '/pipeline-pulse', icon: Activity, roles: [...] }` in the **Work** group.

### DEMO-ONLY (never port)
- `src/lib/mockData.ts` — `PIPELINE_PULSE` const + `get_pipeline_pulse` RPC entry.

### ty BACKEND needed
- Supabase RPC `get_pipeline_pulse()` → `{ spread, hot, otherActive, overdue, funnel[], recentCalls[], recentDeposits[], chips[] }`, aggregating leads by status/stage, overdue buckets (ageInHours/isOverdue), temperature, today's movement (activity_log), and recent calls (3CX) + deposits. The audit confirmed every input already exists (getDashboardStats, OVERVIEW_REPORT, LeadTimeTracking, activity_log).

### Smart-chip deep-links
Chips navigate to `/lead-management?pulse=<key>`. ty's Lead Management should map each key to its existing filter (Hot→temperature, Stalled 7d+→age, Quoted·no-touch→quote state, etc.) — all computable from existing fields.

---

## ② Quick wins — lead-row badges — BUILT & VERIFIED

### Re-apply into `ty/client/src/pages/LeadManagement.tsx`
In the lead-card badge row, after the `transactionType` badge, add three badges (fields already mapped in leadsService:534-543):
- Tenure — `{lead.propertyTenure && <span …>{lead.propertyTenure}</span>}`
- Cash buyer — `{lead.isMortgaged === false && <span …>cash buyer</span>}`
- Property value — `{propertyValue>0 && <span …>£{Math.round(propertyValue/1000)}k</span>}`

### DEMO-ONLY (never port)
- `src/lib/mockData.ts`: added `property_tenure` + `is_mortgaged` to the LEADS builder (ty's real leads already carry these from Hoowla).

### Smart filter chips — BUILT & VERIFIED
- `client/src/pages/LeadManagement.tsx`: added `activeChip` state + a chip row above the lead grid (All/Hot/New/Contacted/Interested/Quoted/Instructed). Each chip calls the SAME setters as the dropdowns — `setFilterStatus(...)` for status chips, `setAdvancedFilters({priority:'High'})` for Hot — so it reuses the existing `loadLeads` reload + page-reset effects. Verified: Interested→only Interested leads, Hot→only High-priority leads. ty inherits this as-is (counts can be added later from a count RPC).

### Remaining quick wins (next)
- Per-lead comms timeline from `activity_log` in lead detail.
- Quota-remaining indicator in the Diary/worklist header.

---

## ⑥ APCM AI — surfaced + advanced to v2 (chat-first) — BUILT & VERIFIED

### ⚠️ DEMO-ONLY flag override — NEVER PORT
- `src/lib/featureFlags.ts`: hardcoded `APCM_AI_ENABLED = true` so Connor sees the full experience.
  **ty MUST keep** `export const APCM_AI_ENABLED = import.meta.env.VITE_APCM_AI_ENABLED === 'true'` (OFF in production until Connor decides to flip the env var). This one line is what unhides the APCM AI page, the `/apcm-ai` route, the sidebar entry, the floating assistant, and the dashboard digest card.

### Copy as-is into ty (NEW files)
- `src/components/ApcmAiActionBoard.tsx` — the "Needs you now" priority-action board (severity-coded cards: red Act-now / amber This-week / green Good-news, each with a deep-link CTA).
- `src/components/ApcmAiChat.tsx` — **reusable chat** powering both the page (`variant="full"`) and the float (`variant="compact"`). Self-contained: messages/thinking/answer state, suggestion chips, free-text box. Answers come from `answerTemplate` (digest, agent breakdown, objections, instructions) + keyword matching over `AI_TEMPLATES`. Props: `variant`, `initialAsk` (deep-link `?ask=<templateId>`), `onOpenFull`. **The seam for live free-form Q&A** is `handleFreeText` (today: keyword→template; later: call the AI endpoint).

### Re-apply into ty `src/pages/ApcmAi.tsx` — v2 chat-first rewrite
- The page now **leads with the chat**. Top row = `<ApcmAiChat variant="full" initialAsk={searchParams.get('ask') || undefined} />` (left) beside a **"What APCM AI is watching"** live-CRM context panel (right). Then, below: `<ApcmAiActionBoard>` → AI-insight charts (`SentimentDistribution` + objections `RankedBarList`, fed by `fetchFirmAnalytics`) → the digest hero → Dig deeper / Coming next.
- The old inline chat (messages state, `askTemplate`, `handleFreeText`, the chat JSX) is **removed** — all of it now lives in `ApcmAiChat`.
- `WATCHING` (context panel) + `PRIORITY_ACTIONS` (action board) are curated demo content; in ty COMPUTE from live signals (stalled hot leads, instruction-intent calls, coaching scores, rising objections, overdue callbacks, instructions/wins). Deep-links target `/lead-management?pulse=…`, `/call-analysis`, `/diary`, `/pipeline-pulse`, `/analytics`.
- The insight charts reuse the **Analytics-hub** components + `get_firm_analytics` (see ③) — no new backend beyond that.

### Re-apply into ty `src/components/ApcmAiFloat.tsx` — v2 direct chat
- The float **opens straight into the chat**: `<ApcmAiChat variant="compact" onOpenFull={() => navigate('/apcm-ai')} />`. The old digest-first landing + quick-question chips + scheduled-sends preview are gone (the digest still lives on the full page). Still gated by `APCM_AI_ENABLED` + Manager/Admin, still hidden on `/apcm-ai`.

### v2.1 — trends/team-aware chat
- `apcmAiService.ts`: 4 new `AI_TEMPLATES` + `answerTemplate` cases — `momentum` (from `fetchFirmTrends`, Track ⑦), and `teamHealth` / `mostImproved` / `needsCoaching` (from `fetchTeamPerformance`, Track ⑧). The assistant now answers about momentum and team performance, not just calls. `ApcmAiChat.tsx` gained matching free-text keywords; the 4 templates are ordered right after `digest` so they surface in both the page (7 chips) and the compact float (4 chips). In ty these compute from the same `get_firm_trends` / `get_team_performance` RPCs — no new backend beyond ⑦/⑧.

---

## ⑨ Quality hardening (multi-agent QA pass) — APPLIED & VERIFIED

A workflow audited every new page/component (theme-safety, consistency, a11y, empty-states) → 17 findings deduped to 8 ranked fixes, all applied:
- **Theme (real bug):** `info`-tone status dots used `bg-navy-400`, which the theme switcher mutes to near-white (only green/amber/red are re-vivified). Now driven by a shared **`TONE_DOT_HEX`** (exported from `apcmAiService.ts`) via inline `style.backgroundColor` in `DigestItemRow` (ApcmAi.tsx) + the chat answer dots (ApcmAiChat.tsx). Verified vivid slate `#475569` in Manuscript. **ty: reuse `TONE_DOT_HEX` for any digest/answer dots — do not colour data dots with `bg-*` classes.**
- **a11y:** `AgentDetailPanel` gained Escape-to-close, `role="dialog"` / `aria-modal` / `aria-labelledby`, and focus-on-open (verified Escape closes); `aria-label`s on the icon-only Send (ApcmAiChat) + Minimise (ApcmAiFloat) buttons.
- **Empty states:** `TeamPerformance` + the Analytics **Trends** tab no longer spin forever on a failed fetch — they branch to an error/retry (or "Couldn't load") state once the fetch settles (`trendsLoading` flag / split `loading` vs `!data` guards).
- **Consistency:** `ApcmAi` header aligned to the sibling-hub pattern (`font-semibold` + serif-italic accent + `text-gray-500` subtitle); `WeeklyTargetBars` header switched to `<h3>` + `<p>` to match `TrendLineChart`; `AgentDetailPanel` neutral sentiment grey aligned to the scorecard.
- Deferred (low value-for-effort): MomentumTiles' private sparkline dedup, DashboardTrends load skeleton, TrendLineChart tick de-dup, RankedBarList radius, ApcmAi firm-insight loading skeleton.

---

## ⑩ Daily Pipeline → "today" command view + nav reorder — BUILT & VERIFIED

### Re-apply into ty
- `Sidebar.tsx`: in the **Workspace** group, reorder to **Dashboard → Daily Pipeline → Pipeline Pulse** (Dashboard first; default landing `/` is already `/dashboard`).

### Copy as-is into ty (NEW files)
- `src/components/hubs/DaySignals.tsx` — the day's action signals as drill-down cards (Overdue leads, High priority, Callback requests today, Instruction requests today, Quote accepted from email, Instructed today — matching the lead-sidebar Quick Actions). Props `{ signals, onSelect }`; each card icon-coded + count chip + deep-links to a filtered page. Built + reviewed via workflow.
- `src/components/hubs/CallsTodayCard.tsx` — "Calls today": Made / Answered / Answer rate / Instruction-intent KPIs + an hourly bar chart + an "Open Call Analysis" deep-link. Props `{ calls, onOpen }`.

### Re-apply into ty `src/pages/DailyPipeline.tsx`
- Render `<DaySignals signals={data.signals} onSelect={navigate} />` under a "Today's actions" heading, and `<CallsTodayCard calls={data.calls} onOpen={() => navigate('/call-analysis?preset=today')} />`, between the hero and the worklists. Split the load guard into `loading` (spinner) vs `!data` (retry card).

### DEMO-ONLY (never port)
- `mockData.ts`: `DAILY_PIPELINE` gained `signals[]` + `calls{}` ; `hubsService.ts` gained `DaySignal` / `CallsToday` types on `DailyPipeline`.

### ty BACKEND
- `get_daily_pipeline()` already exists; extend it to also return today's `signals` (counts from the same queries that power the lead-sidebar Quick Actions: overdue, high-priority, callback-requests-today, instruction-requests-today, quote-accepted-from-email, instructed-today) and `calls` (3CX today: made/answered/answer-rate/instruction-intent + by-hour).

### Backlog — untouched-page deep-analysis (audit, ⑪ below)
A workflow audited 10 untouched pages → 58 opportunities, ranked. Most are **render-swaps of already-computed state** reusing existing chart components. Top tier being built next: Reports conversion-funnel drop-off + source-conversion bars + daily trend; Payments aged-receivables + collected-trend + time-to-pay; Quotes status-funnel + dataset-wide KPIs; Diary completion-gauge + per-agent workload; Contact-Attempts channel/outcome cross-tabs; Comparison-Leads win-rate-by-firm; Lead-Time account-wide SLA stats; Instructions source/campaign bars; Firm-Price-Lists comparison matrix; Solicitor-Firms capacity leaderboard.

---

## ⑪ Untouched-page deep analysis — wave 1 — BUILT & VERIFIED

Additive analysis visuals on 5 untouched pages (workflow build + adversarial review, all PASS; each verified in-browser). Every one renders ALREADY-COMPUTED page state — no existing logic changed.

| Page | Added | Reads (existing state) |
|---|---|---|
| `pages/Reports.tsx` | **Funnel Drop-off** card (Lead Analysis tab) — per-stage bars + stage-to-stage drop %, largest drop flagged | `leadAnalysisData.conversionFunnel` |
| `pages/Payments.tsx` | **Aged receivables** card — unpaid invoices bucketed 0–30 / 31–60 / 61–90 / 90+ days past due (RankedBarList) | `payments` (amount/status/dueDate) |
| `pages/Quotes.tsx` | **Quote status** funnel — Draft→Sent→Accepted→Rejected→Expired (StackedDistributionBar) | `quotes` (status) |
| `pages/ComparisonLeads.tsx` | **Win rate** column in Firm Rankings (totalLeads/appearances) | `firmStats` |
| `pages/DiaryNew.tsx` | **Today's progress** strip — completion rate + completed/remaining/overdue bar | `displayedCompletedTasks/TodayTasks/OverdueTasks` |

### DEMO bug fixed (demo-only)
- `mockData.ts` `get_comparison_lead_stats` returned a plain object, but the page reads `statsRows[0]` with `*_count` field names + `firm_stats` — so the **Firm Rankings table was always empty in the demo**. Fixed to return `[{ total_count, today_count, quoted_count, new_count, callbacks_count, site_counts, firm_stats[] }]` with 5 seeded firms (varied win rates). ty's real RPC already returns this array shape.

### ty re-apply
- The 5 page additions are pure render-swaps of existing state — copy each block into the matching ty page; reused components (`RankedBarList` / `StackedDistributionBar`) ship via Track ③.
- Remaining ranked backlog (next waves): Reports source-conversion bars + daily-trend + period deltas; Payments collected-trend + time-to-pay; Quotes pipeline-wide KPIs (needs a quotes aggregate); Lead-Time account-wide SLA stats (needs aggregate); Diary per-agent workload; Contact-Attempts channel×outcome; Instructions source/campaign bars; Firm-Price-Lists matrix; Solicitor-Firms capacity leaderboard.

---

## ⑫ Untouched-page deep analysis — wave 2 — BUILT & VERIFIED

Six more additive visuals (workflow build + adversarial review, all PASS; each verified in-browser):

| Page | Added | Reads (existing state) |
|---|---|---|
| `pages/Reports.tsx` | **Conversion by source** bars (Lead Analysis tab) | `leadAnalysisData.sourceBreakdown` — range-dependent: 0% in the "today" default, populates over last7/30 |
| `pages/Payments.tsx` | **Invoice status** breakdown (StackedDistributionBar) | `payments` (status) |
| `pages/ContactAttempts.tsx` | **Channel performance** — Call/SMS/Email × completed/failed | `baseFilteredAttempts` (call-heavy in the demo; SMS sparse) |
| `pages/InstructionsAttributionReport.tsx` | **Conversion by source** bars (Lead Conversion view) | `groupedBreakdowns.source` |
| `pages/FirmPriceLists.tsx` | **Compare firms** price matrix (cheapest cell highlighted) | `priceLists` |
| `pages/SolicitorFirms.tsx` | **Capacity utilisation** leaderboard (fill rate per firm) | `dailyLeadCounts` / `dailyCapacityLimit` |

### DEMO bug fixed (demo-only)
- `mockData.ts` `get_instruction_report_breakdowns` returned `{by_agent, by_source, …}`, but `reportsService.fetchInstructionReportBreakdowns` maps an **array** of `{dimension, dimension_value, total_leads, instructed_leads, conversion_rate, missing_attribution_count}` rows — so the Instructions report's breakdown tables (source/UTM/campaign/keyword/credited-agent) **and** the new bars were always empty and logged a `(data||[]).map is not a function` error. Fixed to return the array shape (17 rows across 5 dimensions, varied conversion). ty's real RPC already returns this.

### ty re-apply
- All 6 are render-swaps of existing state — copy each block to the matching ty page; reused components ship via Track ③. Remaining backlog: Reports daily-trend + period deltas; Payments collected-trend + time-to-pay; Quotes pipeline-wide KPIs; Lead-Time account-wide SLA stats; Diary per-agent workload; Contact-Attempts attempts-to-contact funnel; Instructions campaign/keyword bars; Firm-Price outlier flags.

---

## ⑬ Untouched-page deep analysis — wave 3 — BUILT & VERIFIED (data-constrained)

Six more additive visuals (workflow build + adversarial review, all PASS; verified in-browser, console clean). These lean **time-series / per-agent**, where the demo's small, clustered fixtures show their limits — all are correctly wired to real fields and populate richly in ty.

| Page | Added | Demo render |
|---|---|---|
| `pages/LeadTimeTracking.tsx` | **Lead age distribution** histogram (RankedBarList) | ✅ rich (7 buckets) |
| `pages/ContactAttempts.tsx` | **Attempts-to-contact funnel** (1st→5+, maxed-out) | ✅ (1st–4th populated; 5+/maxed empty — call stages cap at 4) |
| `pages/Reports.tsx` | **Daily leads vs instructions** trend (TrendLineChart) | ⚠️ range-dependent — mirrors the existing Daily Trends table; few points in the narrow default range |
| `pages/Payments.tsx` | **Revenue collected** weekly trend (WeeklyTargetBars) | ⚠️ thin — only 2 paid invoices in the mock |
| `pages/ComparisonLeads.tsx` | **Daily lead volume** trend (TrendLineChart) | ⚠️ single point — all 10 mock comparison-leads dated today |
| `pages/DiaryNew.tsx` | **Today's progress** strip + **per-agent Team workload** | ⚠️ empty — the demo's diary-task fixtures don't flow into `allLeadsWithTasks` (pre-existing; page shows 0 tasks) |

### Note on demo data
The rich time-series experience already lives in **Analytics → Trends** + **Dashboard momentum** (Track ⑦, backed by the 30-day `FIRM_TRENDS` mock). The page-level trends above compute from each page's own small fixtures, so they're thin in the demo by nature — **now addressed in Track ⑭ below.**

---

## ⑭ Demo fixture enrichment — page-level trends now light up — DONE & VERIFIED

Wave 3's thin trends were a fixture problem (small, today-clustered data), not a wiring one. Enriched `mockData.ts` so every page-level trend/funnel + the Diary fill in. **All DEMO-ONLY (never port the data).**

- **LEADS**: added a 30-day **history layer** (`HISTORY_LEADS`, ~70 leads over 30 days, varied source + per-source conversion + instructions-by-day) appended to the 16 curated leads → Reports **daily leads-vs-instructions** trend (multi-day) + **conversion-by-source** (Referral 36 / Comparison 23 / Google Ads 14 / Hoowla 13), Lead-Time age histogram, Lead Management all rich.
- **PAYMENTS**: rebuilt to ~28 invoices over 8 weeks, ~75% paid with spread `paid_at` → Revenue-collected trend (8 non-zero weeks, £800→£6.4k) + richer aged-receivables + invoice-status.
- **COMPARISON_LEADS**: 10 → 60, `created_at` spread over 30 days (+ name fallback) → daily lead-volume multi-day line.
- **DIARY_TASKS**: rebuilt — 30 tasks on the most-recent assigned-active leads, full overdue/today/upcoming/completed mix across agents; **UTC-safe `due_date`** via a new `ymd()` helper (the old `iso(...).slice(0,10)` shifted "today" across the UTC boundary).
- `Reports.tsx` default range `'today'` → `'last30'` so the lead-analysis trends show on load. (Optional in ty.)

### Pre-existing DEMO bug fixed — the entire Diary was empty
`tasksService.fetchTasks` + `leadsService` (×3: `fetchLeadsByIds` + 2 siblings) filtered lead ids through a strict **UUID regex** (to block malformed queries). The demo's ids are `lead-1` / `lead-h0`, so **every** lead-id-scoped task/lead query returned `[]` → the Diary showed 0 tasks (0% progress, no workload). Relaxed each guard to also accept `^lead-` ids. **Demo-only** (harmless in ty — real ids are UUIDs; no need to port). Diary now shows **47% today progress + per-agent workload** (Louise 3 overdue/4 done · Sarah 3/1 · James 2/2).

### Verified (fresh server, console clean)
Reports (30-day trend + conversion), Payments (8-week collected), Lead-Time (histogram), Diary (workload + progress), Comparison (daily volume), Lead Management + Dashboard all render rich, no errors.

---

## ⑮ Untouched-page deep analysis — wave 4 — BUILT & VERIFIED

Six more additive visuals (workflow build + adversarial review; verified in-browser):
| Page | Added |
|---|---|
| `pages/Payments.tsx` | **Avg time-to-pay** KPI (issued→paid days, fastest/slowest) |
| `pages/InstructionsAttributionReport.tsx` | **Conversion by campaign** + **by keyword** bars |
| `pages/FirmPriceLists.tsx` | **Pricing outliers** (firm fees >30% above band median) |
| `pages/SolicitorFirms.tsx` | **Appearance → win** per firm (shown vs won %) |
| `pages/LeadTimeTracking.tsx` | **Account-wide SLA** stats ("Across all leads", not page-25) |
| `pages/Quotes.tsx` | **Pipeline-wide KPIs** (dataset totals, true acceptance rate) |

**DEMO bug fixed:** `get_instruction_report_breakdowns` emitted dimension keys `campaign`/`keyword` but the page reads `utm_campaign`/`utm_term` — fixed in the mock, which also un-broke the pre-existing empty Campaign/Keyword breakdown tables.

---

## ⑯ Daily Pipeline V3 (past-comparison) + Marketing/Ads hub — BUILT & VERIFIED

### Daily Pipeline → not dry anymore
- `src/components/hubs/DaySignalsTrend.tsx` (NEW) — replaces `DaySignals`: each signal now shows count + **▲/▼ delta vs yesterday** + a 14-day **sparkline** (still drill-down). Signals enriched in `DAILY_PIPELINE.signals` with `prev/delta/direction/good/spark`.
- `src/components/hubs/PeakHoursChart.tsx` (NEW) — leads vs instructions vs calls **by hour**, with the peak windows called out (leads 10am–12pm, instructions 2–4pm, calls 3–4pm). New `DAILY_PIPELINE.peakHours`.
- `DailyPipeline.tsx` also gained a **"How the day is flowing"** `TrendLineChart` (leads / instructions / accepted quotes over 14 days). New `DAILY_PIPELINE.flow`.
- `hubsService.DailyPipeline` gained `DaySignal` past-comparison fields + `DayFlow` + `PeakHours`.

### Marketing & Ads intelligence — NEW hub at `/marketing` (Admin/Manager)
- `src/pages/Marketing.tsx` + `src/services/marketingService.ts` (`MarketingData` + `fetchMarketing`) + `MARKETING` mock + `get_marketing` RPC.
- Components (NEW, `src/components/marketing/`): `MarketingKpiStrip` (spend/leads/instructions/cost-per-instruction/ROI with deltas), `CampaignPerformance` (table + cost/instruction colour + **Scale/Hold/Cut** action + sparkline), `AcquisitionFunnel` (impression→instruction drop-off), `PricingAdvisor` (win-rate by quote band + recommendation), `MarketingAdvice` (data-driven "what to do next"); plus reused `RankedBarList` for conversion-by-source + best-keywords.
- `App.tsx` route `/marketing` + `Sidebar.tsx` **Marketing** (Megaphone) in the Analytics group.

### ty BACKEND
- `get_daily_pipeline()` extends to return `signals[].{prev,delta,spark}` (today vs yesterday + 14-day), `flow` (14-day leads/instructions/quotes-accepted), `peakHours` (by-hour from created_at / instruction / 3CX timestamps).
- `get_marketing()` joins Google/Bing Ads spend with CRM attribution (`utm_source`/`utm_campaign`/`utm_term`, `gclid`) → leads → quotes → instructions: campaign cost-per-instruction, keyword conversion, pricing win-rate by quote band, the acquisition funnel, and the advice rules.

---

## ⑰ Email & deliverability intelligence — NEW hub at `/email` — BUILT & VERIFIED

Answers "are emails landing, getting opened, and converting" (SOW: spam/bounce/open tracking + the daily-report deliverability lines + the "opened our email" intent signal).
- `src/pages/Email.tsx` + `src/services/emailService.ts` (`EmailData` + `fetchEmail`; reuses Marketing `MktKpi`/`MktFunnelStage`/`MktAdvice` shapes) + `MAIL` mock + `get_email_analytics` RPC.
- NEW components (`src/components/marketing/`): `OpenConversionCompare` (instruction rate of email-openers vs non-openers — the **2.7× engagement→conversion** signal) + `TemplatePerformance` (open/bounce/conversion per template). Reuses `MarketingKpiStrip` (sent / delivered / open-rate / bounce / spam, with deltas), `RankedBarList` (deliverability funnel + delivery issues), `TrendLineChart` (sends/opens/bounces 14-day), `MarketingAdvice` (clean-the-list · surface-opens · spam-creep · best-send-window).
- `App.tsx` route `/email` + `Sidebar.tsx` **Email** (Mail) in the Analytics group.

### ty BACKEND
- `get_email_analytics()` composes the email provider's webhook events (delivered / opened / bounced / complained / failed) with CRM attribution: deliverability funnel, per-template open/bounce/conversion, and the **openers-vs-non-openers instruction-rate** comparison (join opened-events → lead → instruction). Feeds the SOW daily-report deliverability section + an "opened our email" lead intent flag.

---

## ⑱ SOW alignment — coverage audit + Call Intelligence hub at `/call-intel` — BUILT & VERIFIED

A 5-agent audit mapped the whole Horlar SOW against the demo: **~2/3 already shown**; gaps cluster in Call-Analysis integrity + the agent dashboard, and are **mostly render-only** (the data model is ahead of the UI — e.g. `op1Calls` is seeded but never displayed).

NEW Call Intelligence page (`src/pages/CallIntel.tsx`) + `src/services/callIntelService.ts` + mocks (`CALL_VERIFICATION`, `INBOUND_OVERVIEW`, `CALLBACK_FUNNEL`, `AGENT_DAY`) + RPCs (`get_call_verification` / `get_inbound_overview` / `get_callback_funnel` / `get_agent_day`). Surfaces 4 SOW gaps:
- **Per-agent "my day"** (`components/callintel/AgentDayCard`) — the SOW Agent Dashboard (Option A): 12 tiles (assigned / active / unique-attempted / outbound / meaningful-convos / voicemail / contact-rate / Call-1-2-3 / follow-ups / high-intent / instructions / inbound-Opt1) + AI coaching + today's action list.
- **Inbound Calls Overview** (`components/callintel/InboundOverview`) — IVR **Option 1 (sales) vs Option 3 (post-sale)** split, outcome chips, by-hour bars — separate from the outbound-focused Call Analysis. Plus `MarketingKpiStrip` inbound KPIs (received / answered / missed / speed-to-answer / became-instructions).
- **CRM-vs-3CX Call Verification** (`components/callintel/CallVerificationPanel`) — per agent: marked / verified / marked-no-match / found-not-marked / mismatch stacked bar + verification rate (James flagged at 67% with 14 unmatched marks = padding signal). SOW 4.6.
- **Callback → conversion funnel** (`RankedBarList`) — Requested → Contacted → Completed → Quote-accepted → Instructed, 26% win rate. SOW 4.1.
`App.tsx` route `/call-intel` + `Sidebar.tsx` **Call Intel** (ShieldCheck) in the Analytics group.

### ty BACKEND
- `get_call_verification()` per agent/day: join CRM Call-1/2/3 marks ↔ 3CX call records → verified / marked-no-match / found-not-marked / timing-or-count mismatch + verification rate.
- `get_inbound_overview()` inbound 3CX calls (received / answered / missed / abandoned / speed-to-answer) split by IVR option (Opt 1 sales vs Opt 3 post-sale) + became-instructions.
- `get_callback_funnel()` callback lifecycle (Requested → Contacted → Completed) joined to quote-accept + instruction marking.
- `get_agent_day()` per-agent daily breakdown (already on `CallAgentDailyBreakdown`) + AI coaching + action list.

### Remaining SOW polish (next, all render-only)
- Internal / provider-leg / test-call **exclusion footnote** on the Call Analysis Overview.
- **Sales-only users** reporting-scope chip + excluded-users line.
- **Working-hours speed-to-lead** toggle on `SpeedToLeadChart` (business minutes, Europe/London, excl. weekends & UK bank holidays).
- Unified per-lead **comms timeline** incl. WhatsApp (reskin LeadManagement contact-attempt history into channel-tagged bubbles).

---

## ⑲ Instructions report — compare-with-the-past band — BUILT & VERIFIED

The Instructions & Attribution report was a snapshot (tables + 1–3 bar lists, no trend, no vs-past, no unit visibility). Added a self-contained **Instruction trends & comparison** band (drops in with one `<InstructionInsightBand />` line + one import — existing report untouched):
- `src/components/analytics/InstructionInsightBand.tsx` (fetches its own data) + `src/services/instructionInsightsService.ts` + `INSTRUCTION_INSIGHTS` mock + `get_instruction_insights` RPC.
- KPIs with **vs-prior-period deltas** (`MarketingKpiStrip`) — instruction units 68 vs 59, lead→instruction 13.4% vs 11.9%, Sale+Purchase ×2 count, avg/working-day.
- **Instructions over time — this period vs prior period** (`TrendLineChart`, two series).
- **Sale / Purchase / Both unit split** (`RankedBarList`) — surfaces the SOW instruction-unit counting (Sale + Purchase = 2 units).
- **Source movers** vs prior period (inline list, ▲/▼ coloured deltas: Google Ads +58%, Hoowla +57%, Move Exchange −11%).

### ty BACKEND
- `get_instruction_insights(range)` aggregates instruction marks over the range vs the preceding equal-length window: per-day counts (current + prior), unit split by matter type (Sale/Purchase/Both/Remortgage with weights), and per-source now-vs-prev deltas. Reuses the same instruction-weight logic as the existing report.

---

## ⑳ Finance revenue + APCM AI finance coach, Comparison engine intelligence — BUILT & VERIFIED

**Finance** (`src/pages/Finance.tsx` now fetches `FinanceOverview` + `FinanceInsights`) gained two sections via `src/services/financeInsightsService.ts` + `FINANCE_INSIGHTS` mock + `get_finance_insights` RPC:
- `components/hubs/FinanceCoach.tsx` — **the APCM AI finance coach**: set a monthly £ target → live **pace-to-target** (progress bar, projected month-end, pace/day, needed/day) + **pushy advice that recomputes as you type** (verified: £80k → "Behind pace −£3.1k", £60k → "On track", £150k → "Behind pace −£73k") + "what APCM is watching". Pure client-side maths off `mtdRevenue / workingDays`.
- `components/hubs/RevenueTrendBand.tsx` — revenue KPIs vs prior (`MarketingKpiStrip`), **6-month revenue trend** (`TrendLineChart` area, currency y-format), revenue **by matter type** (`RankedBarList`).

**Comparison Leads** (`src/pages/ComparisonLeads.tsx`, one-line `<ComparisonEngineBand />` insert) gained `components/analytics/ComparisonEngineBand.tsx` (self-fetch) via `src/services/comparisonEngineService.ts` + `COMPARISON_ENGINE` mock + `get_comparison_engine` RPC:
- **Per-site performance** (which comparison site performs — Move Exchange flagged "Top": started→submitted, conversion + ▲/▼ delta, avg quote, instructions), **quote-engine funnel** (started → instructed), **where users get stuck** (abandonment by step), submissions **this-period-vs-prior** trend, recovery insight.

### ty BACKEND
- `get_finance_insights()` monthly paid+billed fees by month/type, the firm's monthly target, MTD + working-day counts, accepted-not-instructed value. Coach maths is client-side.
- `get_comparison_engine()` joins `comparison_leads` + engine step events by `site_id`: per-site started/submitted/callback/instruction + conversion + vs-prior delta, the engine step funnel, abandonment per step, daily submissions current vs prior.

---

## Conveyancing-CRM ideation backlog (86 ideas, 8 domains + critic) — for future build waves

A 10-agent ideation pass ranked the gaps a world-class UK conveyancing CRM fills that the demo doesn't. **Biggest theme: the demo stops at "instruction" — almost nothing on the post-instruction conveyancing process.** Top build-next:
1. **Matter / Case progression** (largest net-new surface) — time-in-stage vs benchmark, milestone SLA-breach board, **fall-through rate trend**, completion forecast, stalled-matter radar (searches → enquiries → mortgage offer → exchange → completion).
2. **Key dates / SRA** — exchange/completion countdown board (RAG), client-money reconciliation (aged balances).
3. **Compliance/AML** — onboarding risk funnel (ID/AML gates), KYC completeness, file-review pass rate.
4. **Financial/BI** — WIP & lockup aging, profit per matter type, completion & revenue forecast, cohort revenue.
5. **Sales/Team** — speed-to-lead SLA curve, win/loss reasons over time, completions/week vs target, pipeline velocity.
6. **Integrations** — feed-freshness watchdog, CRM-vs-3CX reconciliation trend, automation success rate.
Full 86-idea list: workflow `conveyancing-crm-ideation` output. Recommended next hub: **Matter Progression**.

---

## ㉑ Matter Progression hub + LIVE AGENT view + ManyChat-style Conversations — BUILT & VERIFIED

Three new surfaces. Mocks `MATTER_PROGRESSION` / `AGENT_WORKSPACE` / `CONVERSATIONS` + RPCs `get_matter_progression` / `get_agent_workspace` / `get_conversations` + services `matterProgressionService` / `agentWorkspaceService` / `conversationsService`.

**Matter Progression** (`src/pages/MatterProgression.tsx`, `/matter-progression`, Admin/Manager) — the post-instruction conveyancing pipeline (the demo previously stopped at instruction):
- `components/matters/StagePipeline` — instructed → searches → enquiries → mortgage offer → report&sign → exchanged → completed, each with **time-in-stage vs benchmark** (over-benchmark amber).
- `components/matters/MatterWatchBoard` — **milestone SLA breaches** (overdue worklist) + **key dates** (exchange/completion RAG countdown).
- Reuse: `MarketingKpiStrip` (active matters / avg-to-completion / fall-through / completing-this-month), `TrendLineChart` (**fall-through rate** 6-mo), `RankedBarList` (fall-throughs by type).

**Agent Workspace** (`src/pages/AgentWorkspace.tsx`, `/my-workspace`, all roles) — the LIVE AGENT view scoped to one agent (Louise):
- `components/agent/AgentTargetCard` — personal **instructions/calls/conversion targets + pace + rank** (#2 of 6).
- Reuse `AgentDayCard` (12 tiles + coaching + actions). `components/agent/MyWorklist` (active leads by priority + next action). Inline "your instructions this month" (units + ×2 chip + fees).

**Conversations** (`src/pages/Conversations.tsx`, `/conversations`, all roles) — **ManyChat-style unified inbox**:
- `components/conversations/ConversationsInbox` — thread list (channel-coloured) + per-lead chat **bubbles** + **composer** (interactive: switch thread loads history, type+Send/Enter appends an agent message, verified). Channels WhatsApp/SMS/email/web.
- `RankedBarList` "How enquiries enter" (channel mix).
Nav: `My Workspace` (CircleUser) + `Conversations` (MessagesSquare) in Workspace; `Matter Progression` (Milestone) in Analytics.

### ty BACKEND
- `get_matter_progression()` matter milestones: count + median-days-in-stage per stage vs benchmark, overdue-vs-benchmark breaches, key-date countdown (exchange/completion), fall-through % trend + by-type.
- `get_agent_workspace(agentId)` filtered to the signed-in agent: their day breakdown, targets vs actuals + leaderboard rank, lead worklist, instructions.
- `get_conversations()` composes provider message logs (WhatsApp Cloud API / SMS / email / web chat) keyed by lead into threads + history; channel mix = inbound by channel. Sending wires to the provider send API (here local-only).

---

## ㉒ Revenue Boost + Compliance & onboarding — BUILT & VERIFIED

Two financial/compliance hubs. Mocks `REVENUE_OPPORTUNITIES` / `COMPLIANCE` + RPCs `get_revenue_opportunities` / `get_compliance` + services `revenueOpportunitiesService` / `complianceService`.

**Revenue Boost** (`src/pages/RevenueBoost.tsx`, `/revenue-boost`, Admin/Manager, Money nav · Coins) — the "what would boost financial stuffs" layer:
- `components/finance/OpportunityList` (reusable £-list with summed accent-coloured total; handles £0 → em dash, NaN/negative guarded) used for **Recovery** (accepted-not-instructed £8.6k, aged invoices £18.4k, abandoned/expired quotes), **Revenue at risk** (fall-through/overdue completions/unanswered enquiries), **Upsell & repeat** (remortgage-due, past-sale-likely-to-buy, referral candidates).
- Summary hero (recoverable £54.4k / at-risk £14.2k / lockup 58d vs 45d) + WIP-by-age (`RankedBarList`).

**Compliance & onboarding** (`src/pages/Compliance.tsx`, `/compliance`, Admin/Manager, Admin nav · ShieldAlert):
- KPIs (ID verified 80% / AML-SoF 71% / file-review 94% / open flags) via `MarketingKpiStrip`; **onboarding funnel** instructed → ID(Yoti) → SoF → KYC → cleared (`RankedBarList`); **where matters are stuck** (`RankedBarList`); `components/compliance/RiskFlagBoard` (PEP/sanctions/high-risk worklist, severity chips); **file-review pass-rate trend** (`TrendLineChart`).

### ty BACKEND
- `get_revenue_opportunities()` composes quotes + instructions + invoices + matters: accepted-not-instructed value, aged-quote/invoice recovery, fall-through/overdue revenue at risk, remortgage/repeat upsell candidates, WIP by age + lockup days.
- `get_compliance()` onboarding workflow + Yoti ID/AML + risk register: gate funnel counts, stuck-step counts, KYC %, open risk flags by severity, file-review pass-rate trend.

---

## ㉓ Conversations v2 + Lead Resale (Marketplace Dashboard) — BUILT & VERIFIED

**Conversations v2** — deepened from the ManyChat inbox per feedback ("didn't show which agent, response analysis, conversions, new sessions"):
- `CONVERSATIONS` mock gained per-thread `agent` / `responseMins` / `converted`, an `assignableAgents` list, and a `stats` block (kpis + per-agent handled/avgResponse/conversion). `conversationsService` types extended.
- `components/conversations/ConversationsInbox` REWRITTEN — shows the **handling agent** per thread + "Handled by … · responded in Nm · instructed" in the header, and a **"+ New" session creator** (name + channel + agent → prepends a live local thread; verified end-to-end). Keeps switch/send/Enter.
- NEW `components/conversations/ConversationStats` — **response & conversion analytics**: KPI strip (open convos, avg first response 6m, within-10m-SLA 78%, chat→instruction 16%) + per-agent table (handled / avg-response coloured / conversion%). Wired above the inbox on `Conversations.tsx`.

**Lead Resale** (`src/pages/LeadResale.tsx`, `/lead-resale`, Admin/Manager, Money nav · Store) — the **Marketplace Dashboard** (the recommended entry page from the assessment): `LEAD_RESALE` mock + `get_lead_resale` RPC + `leadResaleService`. KPIs (sold/revenue/avg-price/margin), resale **pipeline** (available → offered → sold → delivered → paid), **sellable inventory** by the 4 buckets (out-of-area / unconverted / wrong-type / declined), `components/resale/BuyersTable` (partner firms + rating + status), resale-revenue trend, sold-by-type, and a **GDPR consent gate** callout up top.

### Lead-resale assessment (workflow `lead-resale-assessment`) — verdict for the build-out
**Conditional greenlight.** Realistic size **~£500–£1,500/month** (blended £15–25/lead). The gate is **GDPR/PECR capture-consent** — current privacy notice says "we don't sell data", so the **back-catalogue is unsellable**; only post-rewrite opt-in leads qualify. Premium = out-of-area+consented; declined-quote = toxic. **Must-have before launch:** rewritten privacy notice, immutable capture-consent record, per-buyer Data-Sharing Agreement + verified SRA number, DPIA, do-not-sell suppression list, data-enforced anti-double-selling, per-lead flat-fee (SRA-cleaner than rev-share). **Recommended deeper pages (next):** Sellable-Lead **Eligibility Queue** → per-lead **Sell Panel** (matched buyers, computed price, exclusivity) → **Buyers/DSA** management → **Consent & Eligibility Settings** → prepaid **wallet ledger**.

### ty BACKEND
- `get_lead_resale()` reads consented-sellable leads (`share_consent` gate) + buyer accounts + the append-only sale ledger: inventory by sellable-reason, deal pipeline, buyer spend, revenue trend. Sellability wired off the existing outcome/disqualification codes; junk never exposed.

---

## ㉔ Resale Queue (Sell Panel) + Ops Health + Client Experience — BUILT & VERIFIED

- **Resale Queue** (`src/pages/LeadResaleQueue.tsx`, `/lead-resale-queue`) — `components/resale/EligibilityQueue` (self-fetch, `RESALE_QUEUE` mock + `get_resale_queue` RPC + `fetchResaleQueue`): bucket filter (out-of-area / unconverted / wrong-type / declined), per-lead row (reason / region / matter / value / freshness dot / quality / price / **consent-locked**), and an **interactive Sell Panel** (matched buyers + computed price + Offer/List/Withhold). The assessment's recommended operational page. Verified filter + sell-panel interactive.
- **Ops Health** (`src/pages/OpsHealth.tsx`, `/ops-health`, Admin nav · Gauge) — `OPS_HEALTH` mock + `get_ops_health` + `opsHealthService`; `components/ops/IntegrationsBoard` (8 systems, status dots, email-deliverability flagged degraded), KPIs, **CRM-vs-3CX match-rate** + **errors/day** trends, data-gap/duplicate list. Ideation #1 gap (catches silent failures).
- **Client Experience** (`src/pages/ClientExperience.tsx`, `/client-experience`, Analytics nav · Heart) — `CLIENT_EXPERIENCE` mock + `get_client_experience` + `clientExperienceService`; reuse-only: NPS trend, review funnel, update-cadence-vs-promise, referrals/repeat, open-complaints list (severity dots).

### ty BACKEND
- `get_resale_queue()` consented-sellable leads with computed price (base × freshness × quality × exclusivity) + rules-matched eligible buyers (region/matter/wallet); actions write the sale ledger.
- `get_ops_health()` per-integration sync telemetry, CRM-vs-3CX match rate, automation success, data-completeness/duplicate scans.
- `get_client_experience()` survey (NPS/CSAT) + portal update logs vs promised cadence + review-request funnel + complaints register.

---

## ㉕ Sales Velocity + Capacity & Workload — BUILT & VERIFIED (reuse-only)

- **Sales Velocity** (`src/pages/SalesVelocity.tsx`, `/sales-velocity`, Analytics · Rocket) — `SALES_VELOCITY` mock + `get_sales_velocity` + `salesVelocityService`: KPIs (lead→instruction 11.2d, quote→accept, win rate, pipeline velocity), days-in-each-stage, **lead→instruction time trend**, **why-we-win vs why-we-lose**, and **conversion by lead age at first contact** (the speed-to-lead payoff).
- **Capacity & Workload** (`src/pages/Capacity.tsx`, `/capacity`, Analytics · Scale) — `CAPACITY` mock + `get_capacity` + `capacityService`: capacity KPIs, **demand-vs-capacity** 8-week trend (two series), caseload-by-fee-earner vs cap (Louise/Sarah over cap), bottleneck-stage list, rebalance advice.

### ty BACKEND
- `get_sales_velocity()` stage-transition timestamps → avg days per stage + lead→instruction trend; win/loss outcome codes; conversion bucketed by lead age at first contact.
- `get_capacity()` open-matter counts per fee-earner vs configured caps; weekly new-matter (demand) vs completion throughput (capacity); open matters by stage.

---

## ㉖ Forecast hub + working-hours speed-to-lead toggle — BUILT & VERIFIED

- **Forecast** (`src/pages/Forecast.tsx`, `/forecast`, Analytics · LineChart) — `FORECAST` mock + `get_forecast` + `forecastService`; NEW `components/trends/ForecastChart` (SVG: **actuals solid + projection dashed + confidence-band polygon**, NaN/Infinity-guarded). Instruction / revenue / lead-volume projections with ± ranges + seasonal note. (ty: `get_forecast()` fits a seasonal model over trailing series.)
- **Working-hours speed-to-lead** (SOW 4.8) — additive, self-contained edit to `components/callAnalysis/SpeedToLeadChart.tsx`: a **Clock time ↔ Business hours toggle** (default Clock = unchanged). Business mode strips off-hours dead time (demo ×0.4; ty = real Mon–Fri 9–5 Europe/London business minutes excl. weekends + UK bank holidays). Verified: Team median **5h 30m → 2h 12m** with the working-hours caption. On the Call Analysis **Reps** tab.

### SOW polish — COMPLETE
- Internal/provider/test-call **exclusion footnote** + **sales-only reporting** chip on Call Analysis Overview — DONE (`CallAnalysis.tsx`, under the Overview KPI grid: "Sales department only · 5 of 9 users in reporting · 142 raw call legs · 18 excluded · 124 counted").
- **Chat from different places** — the Conversations inbox is now embedded in `AgentWorkspace.tsx` ("Your conversations" section), so agents chat without leaving their workspace. Remaining known follow-up: embed it in the lead-detail view (`LeadManagement.tsx` contact-attempt history — a large, sensitive file, so left as a deliberate next step).

---

## ㉗ Best Time to Call (upgraded heatmap) + Call Insights (AI conversation analytics) — BUILT & VERIFIED

Both modelled on the real ty/hpa screens the user shared.

**Best Time to Call** (`src/pages/Timing.tsx`, `/timing`, Analytics · CalendarClock) — `TIMING` mock (deterministic day×hour generator with pickup rates) + `get_timing` + `timingService`; NEW `components/analytics/BestTimeHeatmap` (self-fetch, interactive): a weekday×hour heatmap keyed on **pickup rate** (not just volume), a **metric toggle** (Pickup % / Calls / Connected), a **window toggle** (7d / 30d / **3 months**), the best-window callout, **pickup-by-hour + pickup-by-day** bars, and the **call-vs-pickup mismatch** ("you dial most at 2pm but leads answer most at 10am"). Verified: 77 live cells, metric toggle changes values.

**Call Insights** (`src/pages/CallInsights.tsx`, `/call-insights`, Analytics · Sparkles) — the **full Call-Analytics restructure** the user asked for. `CALL_INSIGHTS` mock + `get_call_insights` + `callInsightsService`. NEW `components/callinsights/SignalGroup` (clickable ranked signal list) + `SignalDrawer` (right-side slide-over). Every analysed call is grouped into clickable **signals** — Topics, Impact (sentiment), **Objections** (with conversion impact), **Live-file blockers**, **Conveyancer guidance** — and clicking one opens the **calls behind it from the right**: which agent → which lead, the **exact words**, an **APCM AI note**, a trend sparkline, and conversion impact. Verified: drawer opens on click ("Timing Not Ready" → 30 calls, Annie Gerald-Webb quote, AI note, 16% vs 60%).

### ty BACKEND
- `get_timing(range)` aggregates 3CX attempts + answered legs by weekday/hour over the window → pickup rate per cell + per-hour/day aggregates + best/busiest hour.
- `get_call_insights()` reads the call-transcript analysis tables: per-signal counts + trend + sentiment + conversion-impact (leads where the signal appears vs not), and the calls behind each signal (agent, lead, quote, AI-generated note). This is where "APCM AI does more work" — the per-call notes + signal grouping are AI outputs.

---

## ㉘ Draft agent names + collapsible sidebar + Lead Analytics (handling drill-down) — BUILT & VERIFIED

- **Agent names** — the names copied from the real hpa screens (Noman/Maya/Shehroz/Imran) were swapped throughout `CALL_INSIGHTS`/`LEAD_ANALYTICS` to the draft list: **Dej A · Jonny Green · Louise Forshaw · Helen Sadler**.
- **Collapsible sidebar** — the nav had grown to ~30 items in one Analytics group. Restructured `Sidebar.tsx` into **8 collapsible sections** (Workspace · Money · Calls & AI · Performance · Conveyancing · Growth · Reports · Admin) with clickable headers + chevrons; default-open = Workspace + the section containing the active route, the rest collapse. (Gotcha logged: `lucide-react` has no `UserSearch` export in this version — use `Search`; a bad icon import crashes the whole shell to a blank page.)
- **Lead Analytics** (`src/pages/LeadAnalytics.tsx`, `/lead-analytics`, Performance · Search) — `LEAD_ANALYTICS` mock + `get_lead_analytics` + `leadAnalyticsService`. Mirrors the hpa Leads-analytics screens: lifecycle distribution, qualification-capture rate, and clickable signal groups (objections "worst-handled first", sentiment, client questions, follow-up outcomes) + standout phrases. **`SignalDrawer` upgraded to v2** (backward-compatible) — the drill-down now shows the **handling breakdown (Strong/Adequate/Weak/Missed)**, **handled-well %**, trend, sentiment, conversion impact, and per-call **CLIENT SAID / REP REPLIED / CLIENT REACTION** + a handling badge. Verified: Lead Analytics drill-down shows the breakdown; Call Insights still drills in (quote/note format).

---

## ㉙ Floating APCM AI advisor + Lead Enrichment + call-voice taxonomy — BUILT & VERIFIED

- **Floating APCM AI advisor** (`src/components/ApcmAdvisor.tsx`, in `Layout.tsx` — replaces the old `ApcmAiFloat`) — a **page-aware** floating button on every page; opens a chat popup whose opener + quick-prompts are keyed to the current route (Finance → "you're £3.1k behind pace…"; Lead Analytics → "Local Firm Preference is worst-handled…"; Best Time → "leads answer most at 10am…"), with a **running cost readout (£ + tokens) top-right**. Verified: opener correct per page, cost £0.00→£0.01 on send, chips/Enter reply.
- **Lead Enrichment** (`src/pages/LeadEnrichment.tsx`, `/lead-enrichment`, Performance · MapPin) — `LEAD_ENRICHMENT` mock + `get_lead_enrichment` + `leadEnrichmentService`. Domain reverse-lookup → company/job/seniority, **UK regional spread**, email-domain mix, enrichment match-rate trend, **decision-maker signal** (high/med/low), and an enriched-leads table (Deloitte · Head of Engineering …). ty backend: an enrichment provider (Clearbit/Apollo-style) on email/domain + IP geolocation.
- **Call-voice categorization taxonomy** (workflow `call-voice-categorization`, 7 agents) — from what clients SAY, an in-depth lead-category taxonomy: Buyer-readiness (Ready-to-Instruct, Comparing-Quotes, Deposit-Ready, Early-not-on-market, Just-Curious, Stalled-by-Chain), Price-sensitivity (Cheapest-Wins, Comparison-Site, Hidden-Fee-Wary, Value-Over-Price), + decision-style / trust / urgency / comms dimensions, each with verbatim trigger phrases + routing. **To integrate next** as a "Lead categories" voice-tag analytics panel + a category chip on each lead.

---

## ㉚ Lead Categories (voice-tag panel) + reusable RangeFilter — BUILT & VERIFIED

- **Lead Categories** (`src/pages/LeadCategories.tsx`, `/lead-categories`, Performance · Tags) — `LEAD_CATEGORIES` mock + `get_lead_categories` + `leadCategoriesService` (reuses the Lead-Analytics `LASignalGroup` shape). Integrates the call-voice taxonomy: clickable category groups — **Buyer readiness** (Ready-to-Instruct, Comparing-Quotes, Deposit-Ready, Early, Just-Curious, Stalled-by-Chain), **Price sensitivity** (Comparison-Site, Cheapest-Wins, Value-Over-Price, Hidden-Fee-Wary), **Urgency** (FTB-anxious, Completion-deadline, Relocating, Divorce/Probate), **Communication & risk** (Confused, Frustrated/Complaint-risk, Transactional, Champion). Drill-down (reused `SignalGroup`/`SignalDrawer`) shows the **verbatim words that triggered the tag** + the **routing**. ty: a categoriser tags each lead from its call transcripts → a category chip per lead.
- **Reusable `RangeFilter`** (`src/components/analytics/RangeFilter.tsx` + `RANGE_SCALE`) — a premium time-range chip bar (Today / 7d / 30d / 90d / Year / All). On Lead Categories it **rescales the category counts live** (verified: Ready-to-Instruct 42 → 126 at 90 days). Drop-in for the other analytics pages.
- **`SignalDrawer` fix** — added a NOTE block to the client-said branch so routing/AI-notes show on client-said calls (benefits Lead Categories + Lead Analytics follow-ups).

### Still on the list (next)
Apply `RangeFilter` across the other new graphs · **Business-analytics drill-downs** (click → right popup, tag the calls/source, link to the lead) · Ops **9am daily-review** · **Contact Attempts** + **Quotes** depth · **Finance/Payments merge** · **Forecast** depth · Callbacks command-centre · multi-view Leads board.

---

## ④ Daily Pipeline + Finance hubs — BUILT & VERIFIED

### Copy as-is into ty (NEW files)
- `src/components/hubs/HubHeroCards.tsx`, `WorklistCard.tsx`, `FinanceKpiStrip.tsx`, `MoneyList.tsx`, `AgingBars.tsx`
- `src/pages/DailyPipeline.tsx`, `src/pages/Finance.tsx`
- `src/services/hubsService.ts` (types + `fetchDailyPipeline` / `fetchFinanceOverview`)

### Re-apply into ty
- `App.tsx`: import `DailyPipeline` + `Finance` + routes `/daily-pipeline`, `/finance`.
- `Sidebar.tsx`: add `ListChecks` + `Wallet` to the lucide import; **Daily Pipeline** in the Work group, **Finance** in the Commercial group.

### DEMO-ONLY (never port)
- `mockData.ts`: `DAILY_PIPELINE` + `FINANCE_OVERVIEW` consts + `get_daily_pipeline` / `get_finance_overview` RPC entries.

### ty BACKEND needed
- `get_daily_pipeline()` — rolls up today's tasks (DiaryNew/tasksService), callbacks due (activity_log `callback_*`), new-leads-today + hot leads (leadsService), quota remaining (quotaService).
- `get_finance_overview()` — rolls up quotes (quotesService: live/accepted value) + invoices (paymentsService: pending/overdue/paid, aging) + revenue this month.

---

## ⑤ Matters — post-instruction case visibility — BUILT & VERIFIED (demo-mocked)

### Copy as-is into ty (NEW files)
- `src/components/matters/MattersStageStrip.tsx`, `MattersList.tsx`
- `src/pages/Matters.tsx`
- `src/services/hubsService.ts` gains `Matter` / `MattersData` types + `fetchMatters`

### Re-apply into ty
- `App.tsx`: import `Matters` + route `/matters`.
- `Sidebar.tsx`: add `Briefcase` to the lucide import; **Matters** in the Commercial group.

### DEMO-ONLY (never port)
- `mockData.ts`: `MATTERS` const + `get_matters` RPC entry.
- `themeSwitcher.ts`: Manuscript **chart-fill fix** — re-vivifies solid 500-weight bar/dot fills (the theme's soften-solid rules were muting all chart bars); soft −50/−100 chips untouched. Demo-theme-only.

### ⚠️ ty BACKEND — HOOWLA integration (the scoping you flagged)
`get_matters()` must source **live case data from Hoowla** (the conveyancing case system) — the CRM only MIRRORS status (stage, days-in-stage, next action) for visibility; it does NOT rebuild case management. Confirm the Hoowla API surface + auth before building. The demo shows the concept with mock cases.

---

## ③ Analytics hub + nav regroup — BUILT & VERIFIED

### Copy as-is into ty (NEW files)
- `src/components/analytics/RankedBarList.tsx`, `StackedDistributionBar.tsx`, `SentimentDistribution.tsx`, `CaptureBars.tsx`, `CommitmentsTable.tsx`, `QuoteWall.tsx`
- `src/pages/Analytics.tsx` (Business + **Leads** + Behaviour tabs; the Leads tab reuses RankedBarList/PipelineSpreadDonut/CaptureBars — no new components)
- `src/services/hubsService.ts` gains `FirmAnalytics` + `fetchFirmAnalytics`

### Re-apply into ty
- `App.tsx`: import `Analytics` + route `/analytics` (Admin/Manager).
- `Sidebar.tsx`: add `PieChart`; **Analytics** first in the Analytics group; AND apply the **nav regroup** — 5 groups → 4: **Workspace / Money / Analytics / Admin** (Contact Attempts→Workspace, Commercial→Money, Reporting+Intelligence analytics+Comparison Leads→Analytics).

### DEMO-ONLY (never port)
- `mockData.ts`: `FIRM_ANALYTICS` const + `get_firm_analytics` RPC entry.

### ty BACKEND needed
- `get_firm_analytics()` rolls up: leads (lifecycle, temperature, conversion, lost reasons), calls+AI (sentiment, objections, **client questions**, **qualification capture**, **commitments promised-vs-honoured**, **close drivers**, **follow-up outcomes**, **standout phrases**). The **bold** lenses are net-new AI extraction — extend `threecx-analyze-call` (alongside the objection_handling / sentiment work in CALL-ANALYSIS-PORT-MANIFEST §5).

### Scope note
- `/analytics` is a NEW firm-wide hub (Business + Behaviour). It does NOT re-parent the existing Call Analysis / Pipeline Reports / Instructions / Lead Time pages into tabs — those stay as their own pages under the Analytics nav group (full page-tabbing deferred as higher-risk, lower-value).

---

## ⑦ Trends / Momentum (over-time visibility) — BUILT & VERIFIED

The demo was point-in-time only; this adds the **time-series dimension** — sparklines, line/area charts, and weekly target bars — on the Dashboard and a new Analytics **Trends** tab.

### Copy as-is into ty (NEW files)
- `src/components/trends/Sparkline.tsx` — tiny inline line/area sparkline (props: points, color, width, height, fill, strokeWidth).
- `src/components/trends/MomentumTiles.tsx` — responsive KPI tiles (value + up/down delta chip + inline sparkline). `good` encodes whether the move is positive for the business (so a falling "speed to lead" is green). Props: `{ kpis: MomentumKpi[] }`.
- `src/components/trends/TrendLineChart.tsx` — multi-series SVG line chart with gridlines, y/x labels, legend, optional single-series area fill, last-point emphasis. Props: `{ title, caption?, series: {key,label,color,points:{x,y}[]}[], height?, yFormat?: number|currency|percent, area? }`.
- `src/components/trends/WeeklyTargetBars.tsx` — weekly bars (HTML divs, inline-style fills) with per-bar dashed target markers; bar turns green when ≥ target. Props: `{ title, caption?, bars: {label,value,target?}[], valueFormat?, barColor?, goodAboveTarget? }`.
- `src/components/trends/DashboardTrends.tsx` — self-fetching "Momentum" band (MomentumTiles + a leads/instructions TrendLineChart + "All trends →" → `/analytics?tab=trends`).
- **Theme-safe by construction**: every data colour comes from SVG `stroke`/`fill` attributes or inline `style.backgroundColor` (NOT Tailwind `bg-*`), so the theme switcher cannot mute them. Verified vivid under Manuscript. Built + adversarially reviewed via workflow (the review caught & fixed a Sparkline responsiveness bug).

### Copy into ty service `hubsService.ts`
Add `TrendMomentum` / `TrendWeeklyBar` / `FirmTrends` types + `fetchFirmTrends()` (one RPC). Pages map `FirmTrends.series[*]` onto `TrendSeries.points` via `labels.map((x,i)=>({x, y: series.metric[i]}))`.

### Re-apply into ty
- `src/pages/Analytics.tsx`: add the **Trends** tab (2nd, after Business) + `useSearchParams` so `?tab=trends` deep-links open it. Fetch `fetchFirmTrends` alongside analytics; render MomentumTiles + 4 TrendLineCharts (leads&instructions, calls [area], conversion [percent], revenue [area, currency]) + 2 WeeklyTargetBars (instructions, revenue).
- `src/pages/Dashboard.tsx`: `import { DashboardTrends }` + render `{user?.role !== 'Agent' && <DashboardTrends />}` directly after the stat-card grid (managers only).

### DEMO-ONLY (never port)
- `mockData.ts`: `FIRM_TRENDS` const (deterministic 30-day daily series + 8-week rollups + computed momentum KPIs) + `get_firm_trends` RPC entry.

### ty BACKEND needed
- `get_firm_trends()` → `{ range, labels[], series{leads,calls,instructions,revenue,conversion}, momentum[], weeklyInstructions[], weeklyRevenue[] }`. Rolls up **daily history**: leads by created day, calls by day (3CX `crm_call_records`), weighted instructions by day, paid payments by day, daily conversion; momentum deltas compare the latest period to the prior; weekly rollups vs a configurable target. All inputs already exist in the Dashboard's own date-bucketed queries.

---

## ⑧ Team Performance hub (per-agent visibility) — BUILT & VERIFIED

A manager's people view: team momentum, a leaderboard, rich per-agent scorecards (with coaching-trend sparklines), workload balance, and per-agent comparison bars. Complements Call Analysis (call-level) with a performance-management roll-up.

### Copy as-is into ty (NEW files)
- `src/components/team/AgentScorecard.tsx` — per-agent card: rank + avatar + status chip, blended score + delta + Sparkline of the trend, a 6-metric grid (conversion, sentiment, calls, answer rate, instructions, coaching), a quota bar, optional highlight, "Open calls" CTA. Props: `{ agent, onOpen? }`.
- `src/components/team/TeamLeaderboard.tsx` — ranked rows (medal ranks, score bar, delta chip, mini Sparkline). Props: `{ title?, caption?, agents, onOpen? }`. Does not re-sort (expects rank order).
- `src/components/team/WorkloadBalance.tsx` — per-agent quota attainment bars + team total footer. Props: `{ title?, caption?, agents }`.
- `src/pages/TeamPerformance.tsx` — the page (MomentumTiles + Leaderboard + WorkloadBalance + scorecards grid + 2 RankedBarList comparisons).
- `src/services/teamService.ts` — `TeamAgent` / `TeamPerformance` types + `fetchTeamPerformance()` (one RPC). `teamMomentum` reuses `TrendMomentum` (Track ⑦).
- **Reuses** `MomentumTiles` + `Sparkline` (Track ⑦) and `RankedBarList` (Track ③) — no duplication. Theme-safe (inline-style hex fills); built + adversarially reviewed via workflow (all 3 passed clean).

### Re-apply into ty
- `App.tsx`: `import TeamPerformance` + `<Route path="/team">` (ProtectedRoute Admin/Manager, same shape as `/analytics`).
- `Sidebar.tsx`: add `Trophy` to the lucide import + `{ name: 'Team', href: '/team', icon: Trophy, roles: ['Admin','Manager'] }` in the **Analytics** group (after Call Analysis).

### DEMO-ONLY (never port)
- `mockData.ts`: `TEAM_AGENTS` + `TEAM_PERFORMANCE` consts + `get_team_performance` RPC entry (curated 5-agent team).

### ty BACKEND needed
- `get_team_performance()` composes, per agent: the call breakdown (`get_call_agent_daily_breakdown`), AI rep quality (sentiment, coaching), instructions credited, and quota usage (quotaService). **Blended score** = the existing `computeCoachingScore` model (Connect 50% / Convert 30% / Quality 20%); `scoreTrend` from the per-day coaching history; `scoreDelta` vs the prior period; `status` banded (top/steady/watch) off the score. Every input already exists — this is an aggregation RPC, no new capture.

### v2 additions (drill-down + team trends)
- `src/components/team/AgentDetailPanel.tsx` (NEW) — click any agent (leaderboard row or scorecard) to open a drill-down modal: header + score + Sparkline, a Performance-trend `TrendLineChart`, a Connect/Convert/Quality coaching breakdown, the full metric grid, and an AI coaching note. Built + adversarially reviewed via workflow. Wired in `TeamPerformance.tsx` via `selectedAgent` state — `onOpen` opens the panel; the panel's "Open their calls" routes to `/call-analysis`.
- `TeamPerformance.tsx` also gained a multi-series **"Score trends by agent"** `TrendLineChart` (one line per agent).
- `TeamAgent` / `TEAM_AGENTS` gained `connect`, `convert`, `quality`, `speedToLeadH`, `coachingNote`. ty derives the 3 sub-scores from `computeCoachingScore`; `coachingNote` is the AI coaching summary.
