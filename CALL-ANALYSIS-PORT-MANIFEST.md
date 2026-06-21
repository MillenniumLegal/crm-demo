# Call Analysis visibility upgrades — port manifest (crm-demo → ty)

The crm-demo is a copy of `ty/client`. These Call Analysis visibility upgrades are
prototyped here (mock data, visible at http://localhost:3000 → Manuscript theme → Call
Analysis) and copy into `ty` once finalized. **Mock-data changes are demo-only and must
NOT be ported.** Every component imports only real `@/services/threecxService` types +
shared `./format` / `./coaching` helpers, so they behave identically against ty's real RPCs.

---

## 1. Copy as-is into ty (NEW files — drop in, no conflict)
`crm-demo/src/components/callAnalysis/`  →  `ty/client/src/components/callAnalysis/`

| File | What it is |
|---|---|
| `coaching.ts` | Transparent coaching-score helper (Connect/Convert/Quality), speedTone, tone classes |
| `RepScorecards.tsx` | Per-rep card grid + coaching score 0–100 + 3 sub-bars + 6 stats |
| `CoachingScoreChart.tsx` | "Who's strongest" horizontal score-ranking bars + team-avg marker |
| `SpeedToLeadChart.tsx` | Speed-to-lead SLA bars with 3h/8h threshold markers |
| `ByRepVolumeChart.tsx` | Per-rep stacked volume bars (connected/voicemail/missed) |
| `OutcomeDonut.tsx` | Outcome-mix donut (connected/voicemail/missed) |
| `HourlyVolumeChart.tsx` | Call volume by hour (outbound+inbound stacked), peak highlight |
| `ScheduleLoadChart.tsx` | Callback load by day (overdue/today/future) |
| `CallRatingTiers.tsx` | Per-rep 100%-stacked call-quality tier bars |
| `SentimentBars.tsx` | Per-rep diverging client-sentiment bars (−1…+1) |
| `ObjectionBoard.tsx` | Objection handling, worst-first, stacked STRONG/ADEQUATE/WEAK + quote, click-to-drill |
| `ObjectionDrill.tsx` | Per-objection drill: CLIENT SAID / REP REPLIED / CLIENT REACTION, graded |
| `TeamHeadlineStrip.tsx` | Reps-tab hero: team coaching / top performer / needs-coaching / avg speed / instructions |
| `ConversionByRep.tsx` | Conversion bars (assigned leads that instructed) + team-avg marker |
| `RadialScoreGauge.tsx` | Premium semicircular coaching-score gauge (0–100, tone-banded) |
| `MiniTrend.tsx` | Min-max-scaled momentum sparkline + signed delta (for coaching trends) |

## 2. Copy as-is into ty service: `client/src/services/threecxService.ts`
Add (after `fetchCallSignalBreakdowns`): the interfaces `CallRepQuality`, `CallHourlyVolume`,
`CallScheduleLoadDay`, `ObjectionHandlingQuality`, `ClientReaction`, `CallObjectionInstance`,
`CallObjectionCategory`, and the fetchers `fetchCallRepQuality`, `fetchCallHourlyVolume`,
`fetchCallScheduleLoad`, `fetchCallObjectionHandling` (plain RPC calls + snake→camel maps).

## 3. Re-apply by hand into `ty/client/src/pages/CallAnalysis.tsx`
> ty's `CallAnalysis.tsx` has DIVERGED (it carries the 3CX 15-min cadence changes). Re-apply
> these diffs — do NOT overwrite the file.
- **Imports:** add the 4 new service fetchers + the 4 new types to the `threecxService` import; add the 9 new component imports; add `MessageSquare` to the `lucide-react` import.
- **Tab type:** `type CallAnalysisTab = 'overview' | 'agents' | 'objections' | 'insights' | 'calls';`
- **Tab nav array:** rename `agents` label → **Reps**, `insights` label → **Behaviour**; insert `{ id: 'objections', label: 'Objections', icon: MessageSquare }` between them.
- **State:** add `repQuality`, `hourlyVolume`, `scheduleLoad`, `objectionHandling`, `selectedObjection`.
- **loadData:** add the 4 fetchers to the `Promise.all` (with `.catch(() => [])`), 4 destructured vars, and 4 `setState` calls.
- **Reps tab (`activeTab === 'agents'`):** render `<RepScorecards>`, then a 2-col grid of `<CoachingScoreChart>` + `<SpeedToLeadChart>`, then a 2-col grid of `<CallRatingTiers rows={repQuality.map(...)}>` + `<SentimentBars rows={repQuality.map(...)}>`, above `<AgentLeaderboard>`.
- **Objections tab (NEW `activeTab === 'objections'`):** 2-col grid of `<ObjectionBoard categories={objectionHandling} onDrill={setSelectedObjection}>` + (`selectedObjection` ? `<ObjectionDrill ...>` : placeholder).
- **Calls tab (`activeTab === 'calls'`):** prepend a 2-col grid of `<OutcomeDonut>` + `<HourlyVolumeChart hours={hourlyVolume}>` + `<ScheduleLoadChart days={scheduleLoad}>` + `<ByRepVolumeChart>` above the existing table.

### Focus-pass changes (latest)
- **Reps tab:** replaced `<TeamAverageStrip>` with `<TeamHeadlineStrip agents={agentBreakdown} avgConversion={…}/>` as the hero; added `<ConversionByRep rows={repQuality.map(q => ({name, rate: q.conversionRate}))}/>` above the league table.
- **Objections tab:** moved `<ObjectionShiftStrip>` here (below the board/drill grid) so all objection lenses live together.
- **Behaviour tab:** removed `<ObjectionShiftStrip>` (now on Objections); `<CoachingRatioCard>` is full-width.
- **Header subtitle:** reworded to "Live call performance, coaching, objections and outcomes — at a glance."
- **Data:** `CallRepQuality` gained `conversionRate` (mock `conversion_rate`); ty's `get_call_rep_quality` returns it.

### Momentum pass (latest)
- **`TeamHeadlineStrip`** rebuilt as a `RadialScoreGauge` hero + a team 7-day `MiniTrend` + 4 stat tiles. Now takes `repTrends={repQuality.map(q => q.coachingTrend)}`.
- **`RepScorecards`** gained a per-rep momentum `MiniTrend` (+ signed delta) on each card; takes `trendByAgent={Object.fromEntries(repQuality.map(q => [q.agentUserId || q.agentName, q.coachingTrend]))}`.
- **Data:** `CallRepQuality` gained `coachingTrend: number[]` (mock `coaching_trend`, 7 daily scores); ty's `get_call_rep_quality` returns it.

## 4. DEMO-ONLY — never port (ty has the real RPCs)
- `src/lib/mockData.ts` — `CALL_REP_PROFILES`, `CALL_AGENT_BREAKDOWN`, `CALL_REP_QUALITY(_PROFILES)`,
  `CALL_HOURLY`, `CALL_SCHEDULE_LOAD`, `CALL_OBJECTION_HANDLING`, and all the `get_call_*` mock
  RPC entries. NOTE: components expect rates as **0–100 percentages**.

## 5. ty BACKEND work required for real data (tracked separately)
New Supabase RPCs (manual SQL migration, never on prod by us):
- `get_call_rep_quality(p_start_date, p_end_date)` → per-rep `{excellent, good, meets_floor, below_floor, sentiment_score}`
- `get_call_hourly_volume(p_start_date, p_end_date, p_agent_user_id)` → `{hour, inbound, outbound}`
- `get_call_schedule_load(p_start_date, p_end_date)` → `{label, count, tone}` (from callback/follow-up tasks)
- `get_call_objection_handling(p_start_date, p_end_date, p_agent_user_id)` → category rows `{category, count, strong, adequate, weak, quote, instances[]}`

New AI extraction in `ty/supabase/functions/threecx-analyze-call/index.ts` `analysisSchema`
(+ mirror in `threecx-process-cdr`): `objection_handling[]` `{category, client_said, rep_replied,
client_reaction, quality}`, plus per-call `client_sentiment_score` and `call_quality_tier` — these
feed get_call_objection_handling / get_call_rep_quality. Keep APCM AI feature-flag posture unchanged.
