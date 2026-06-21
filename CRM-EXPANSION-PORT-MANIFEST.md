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

## ⑥ APCM AI — surfaced in the demo + advanced — BUILT & VERIFIED

### ⚠️ DEMO-ONLY flag override — NEVER PORT
- `src/lib/featureFlags.ts`: hardcoded `APCM_AI_ENABLED = true` so Connor sees the full experience.
  **ty MUST keep** `export const APCM_AI_ENABLED = import.meta.env.VITE_APCM_AI_ENABLED === 'true'` (OFF in production until Connor decides to flip the env var). This one line is what unhides the APCM AI page, the `/apcm-ai` route, the sidebar entry, the floating assistant, and the dashboard digest card.

### Copy as-is into ty (NEW file)
- `src/components/ApcmAiActionBoard.tsx` — the "Needs you now" priority-action board (severity-coded cards: red Act-now / amber This-week / green Good-news, each with a deep-link CTA).

### Re-apply into ty `src/pages/ApcmAi.tsx`
- Import `ApcmAiActionBoard` + render `<ApcmAiActionBoard actions={…} onAction={(href) => navigate(href)} />` directly above the digest hero.
- `PRIORITY_ACTIONS` is curated demo content here; in ty COMPUTE it from live signals (stalled hot leads, coaching scores, objection-handling quality, overdue callbacks, instructions/wins). Deep-links target `/lead-management?pulse=…`, `/call-analysis`, `/diary`, `/pipeline-pulse`.

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
