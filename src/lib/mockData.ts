// @ts-nocheck
/* ------------------------------------------------------------------ *
 * Demo fixtures for the local mock Supabase client. Real DB column
 * names (snake_case). Joined resources are denormalised onto rows
 * (e.g. quote.leads, payment.leads/quotes, diary_task.leads) so the
 * mock can ignore embedded-select strings.
 * ------------------------------------------------------------------ */

const D = new Date();
const pad = (n) => String(n).padStart(2, '0');
function iso(daysAgo = 0, h = 9, m = 0) {
  const d = new Date(D.getTime() - daysAgo * 86400000);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const todayMid = (() => { const d = new Date(D); d.setHours(2, 0, 0, 0); return d.toISOString(); })();

export const DEMO_SESSION = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_at: 9999999999,
  token_type: 'bearer',
  user: { id: 'demo-user', email: 'demo@apcm.local', role: 'authenticated', aud: 'authenticated', user_metadata: {} },
};

/* ----------------------------- users ----------------------------- */
const USERS = [
  { id: 'demo-user', name: 'Connor', email: 'demo@apcm.local', role: 'Manager', status: 'Active', daily_quota: 25, weekly_quota: 120, created_at: iso(120), updated_at: iso(1) },
  { id: 'u-louise', name: 'Louise Forshaw', email: 'louise@apcm.local', role: 'Agent', status: 'Active', daily_quota: 20, weekly_quota: 100, created_at: iso(110), updated_at: iso(2) },
  { id: 'u-sarah', name: 'Sarah Okafor', email: 'sarah@apcm.local', role: 'Agent', status: 'Active', daily_quota: 20, weekly_quota: 100, created_at: iso(100), updated_at: iso(2) },
  { id: 'u-james', name: 'James Okoro', email: 'james@apcm.local', role: 'Agent', status: 'Active', daily_quota: 18, weekly_quota: 90, created_at: iso(90), updated_at: iso(3) },
  { id: 'u-admin', name: 'APCM Admin', email: 'admin@apcm.local', role: 'Admin', status: 'Active', daily_quota: 30, weekly_quota: 150, created_at: iso(200), updated_at: iso(1) },
];
const AGENTS = USERS.filter((u) => u.role === 'Agent').map((u) => ({ id: u.id, name: u.name }));
const agentName = (id) => (USERS.find((u) => u.id === id) || {}).name || null;

/* ----------------------------- leads ----------------------------- */
const TX = ['Purchase', 'Sale', 'Sale & Purchase', 'Remortgage'];
const SRC = ['Comparison Site', 'Hoowla', 'Direct', 'Referral'];
const STAGES = ['New', 'Call-1', 'Call-2', 'Call-3', 'Call-4', 'Interested', 'Quote Accepted - Awaiting Payment', 'Payment Completed - Awaiting Client Information', 'Instructed', 'Cancelled'];
const leadDefs = [
  ['Bola Adeyemi', 'Interested', 'Interested', 'High', 'Purchase', 'Comparison Site', 'u-louise', { callback: true, quote: [1486, 'Accepted'] }],
  ['Folake Bello', 'Quote Accepted - Awaiting Payment', 'Interested', 'High', 'Sale & Purchase', 'Comparison Site', 'u-sarah', { instruct: true, quoteAccepted: true, quote: [2150, 'Accepted'] }],
  ['Chidi Okeke', 'Call-3', 'New', 'Medium', 'Remortgage', 'Hoowla', 'u-louise', { callbackContacted: true, quote: [980, 'Sent'] }],
  ['Aisha Bello', 'New', 'New', 'Low', 'Purchase', 'Direct', null, {}],
  ['Gbenga Ade', 'Call-1', 'New', 'Medium', 'Sale', 'Comparison Site', 'u-james', { quote: [1325, 'Sent'] }],
  ['Ibrahim Sani', 'Call-1', 'New', 'Medium', 'Purchase', 'Comparison Site', 'u-louise', {}],
  ['Bhupinder Mohan', 'Interested', 'Interested', 'High', 'Sale', 'Hoowla', 'u-louise', { quote: [1740, 'Accepted'], quoteAccepted: true }],
  ['Clare Chaplin', 'Call-4', 'New', 'High', 'Purchase', 'Comparison Site', 'u-sarah', {}],
  ['Dean Cadman', 'Call-2', 'New', 'Medium', 'Remortgage', 'Direct', 'u-louise', {}],
  ['Sarah Pearse', 'Instructed', 'Sold', 'Medium', 'Sale & Purchase', 'Comparison Site', 'u-sarah', { instructed: true, quote: [2480, 'Accepted'] }],
  ['Jasmine Ashford', 'Instructed', 'Sold', 'Low', 'Purchase', 'Hoowla', 'u-james', { instructed: true, quote: [1390, 'Accepted'] }],
  ['Joe Lewis', 'Interested', 'Interested', 'Medium', 'Sale', 'Direct', 'u-louise', { callback: true }],
  ['Cecilia Cristea', 'New', 'New', 'Low', 'Remortgage', 'Comparison Site', null, { fake: true }],
  ['James Flock', 'Payment Completed - Awaiting Client Information', 'Interested', 'High', 'Purchase', 'Comparison Site', 'u-sarah', { quote: [1620, 'Accepted'], quoteAccepted: true }],
  ['Ngozi Eze', 'Call-2', 'New', 'Medium', 'Sale & Purchase', 'Hoowla', 'u-james', {}],
  ['Tunde Bakare', 'Cancelled', 'Closed', 'Low', 'Purchase', 'Direct', 'u-louise', { outcome: 'Gone Elsewhere' }],
];
const LEADS = leadDefs.map((d, i) => {
  const [name, stage, status, priority, tx, source, assigned, f = {}] = d;
  const first = name.toLowerCase().split(' ')[0];
  const createdDaysAgo = i < 5 ? 0 : i < 9 ? 1 : (i % 6) + 1;
  return {
    id: 'lead-' + (i + 1),
    short_code: 'ML-' + (10200 + i),
    name, email: first + '@email.com', phone: '07700 9001' + pad(i + 10),
    source, status, stage, transaction_type: tx, priority,
    assigned_to: assigned, assigned_to_name: agentName(assigned),
    outcome_code: f.outcome || null, custom_outcome_reason: null,
    instructed_firm: f.instructed ? 'Millennium Legal' : null,
    contact_attempts: stage.startsWith('Call-') ? Number(stage.split('-')[1]) : (status === 'Sold' ? 3 : 0),
    max_attempts: 5,
    property_value: [385000, 520000, 295000, 610000, 450000, 270000, 335000, 480000, 410000, 560000, 300000, 625000, 280000, 470000, 515000, 340000][i],
    property_address: (i * 7 + 3) + ' High Street',
    property_region: 'England', property_postcode: 'M1 ' + (i + 1) + 'BT',
    where_things_up_to: ['Offer accepted (sale)', 'Just researching prices', 'Memorandum of sale received', 'Found a property', 'Awaiting mortgage offer', 'Ready to proceed'][i % 6],
    quote_id: f.quote ? 'quote-' + (i + 1) : null,
    quote_amount: f.quote ? f.quote[0] : null,
    quote_status: f.quote ? f.quote[1] : null,
    quote_accepted_at: f.quoteAccepted ? iso(0, 9, 12) : null,
    callback_requested: !!f.callback, callback_status: f.callback ? 'requested' : (f.callbackContacted ? 'contacted' : null),
    callback_requested_at: f.callback ? iso(0, 9, 12) : null, callback_firm_name: f.callback ? 'Millennium Legal' : null,
    instruction_requested: !!f.instruct, instruction_request_status: f.instruct ? 'requested' : null,
    instruction_requested_at: f.instruct ? iso(0, 10, 30) : null, instruction_request_firm_name: f.instruct ? 'Millennium Legal' : null,
    is_manually_instructed: !!f.instructed, manual_instructed_at: f.instructed ? iso(0, 11, 0) : null,
    is_funnel_archived: false, funnel_archived_category: f.fake ? 'fake' : null,
    created_at: iso(createdDaysAgo, 8, i), updated_at: iso(0, 12, i), last_action_at: iso(0, 12, i),
    notes: null,
  };
});
const leadMini = (id) => { const l = LEADS.find((x) => x.id === id); return l ? { id: l.id, name: l.name, email: l.email, phone: l.phone, short_code: l.short_code, status: l.status, stage: l.stage } : null; };

/* ---------------------------- quotes ----------------------------- */
const QSTAT = ['Accepted', 'Sent', 'Draft', 'Rejected', 'Expired'];
const QUOTES = LEADS.filter((l) => l.quote_id).map((l, i) => ({
  id: l.quote_id, short_code: 'Q-' + (3300 + i), lead_id: l.id, version: 1,
  status: l.quote_status, total_inc_vat: l.quote_amount, total_ex_vat: Math.round(l.quote_amount / 1.2),
  legal_fee_ex_vat: Math.round(l.quote_amount / 1.2 * 0.7), legal_fee_inc_vat: Math.round(l.quote_amount * 0.7),
  quote_type: l.transaction_type, property_value: l.property_value, property_type: i % 2 ? 'Leasehold' : 'Freehold',
  panel_member_id: 'firm-' + ((i % 5) + 1), people_count: 1, supplements: [], disbursements: [],
  expiry_date: iso(-30 + i, 17, 0), sent_at: iso(i + 1, 10, 0), accepted_at: l.quote_status === 'Accepted' ? iso(i, 14, 0) : null,
  created_at: iso(i + 2, 9, 0), updated_at: iso(i, 9, 0),
  leads: { name: l.name, email: l.email, phone: l.phone, short_code: l.short_code },
}));

/* --------------------------- payments ---------------------------- */
const PSTAT = ['Paid', 'Sent', 'Pending', 'Draft', 'Overdue'];
const PAYMENTS = LEADS.filter((l) => l.quote_id).slice(0, 6).map((l, i) => ({
  id: 'pay-' + (i + 1), lead_id: l.id, quote_id: l.quote_id, amount: l.quote_amount, currency: 'GBP',
  status: PSTAT[i % PSTAT.length], stripe_payment_link: '#', metadata: { description: l.transaction_type + ' — file opening fee' },
  created_at: iso(i + 4, 9, 0), due_date: iso(i - 3, 17, 0), paid_at: i % PSTAT.length === 0 ? iso(i + 1, 12, 0) : null,
  leads: leadMini(l.id), quotes: { id: l.quote_id, total_inc_vat: l.quote_amount },
}));

/* ------------------------ solicitor firms ------------------------ */
const CITIES = ['Manchester', 'Leeds', 'Birmingham', 'London', 'Bristol', 'Liverpool', 'Sheffield', 'Nottingham'];
const SOLICITOR_FIRMS = Array.from({ length: 8 }).map((_, i) => ({
  id: 'firm-' + (i + 1), name: ['Millennium Legal', 'Aconveyancing', 'Premier Property Lawyers', 'Beaumont Legal', 'Setfords', 'Convey Law', 'AVRillo', 'Gorvins'][i],
  email: 'enquiries@firm' + (i + 1) + '.co.uk', phone: '0161 200 ' + (3000 + i * 11), address: (i * 5 + 1) + ' King Street',
  city: CITIES[i], postcode: 'M' + (i + 1) + ' 4BT', contact_person: ['Jane Cole', 'Mark Reilly', 'Sue Patel', 'Tom Frost', 'Amy Hughes', 'Raj Shah', 'Kim Lord', 'Ed Mason'][i],
  is_active: i !== 4, firm_type: ['both', 'comparison', 'crm', 'both', 'comparison', 'crm', 'both', 'comparison'][i],
  daily_capacity_limit: 10 + i, daily_capacity_used: (i * 2 + 3) % (10 + i), commission_rate: 10 + i,
  sra_number: String(500000 + i * 111), rating: (3.8 + (i % 5) * 0.25), is_24_7: i % 2 === 0, is_paused: false,
  accepted_transaction_types: ['Purchase', 'Sale', 'Sale & Purchase', 'Remortgage'],
  site_ids: ['cheapconveyancing', 'themoveexchange', 'compareconveyancingprices'].slice(0, (i % 3) + 1),
  logo_url: null, sort_order: i, operating_hours: {}, created_at: iso(150 - i), updated_at: iso(1),
}));

/* ------------------------ comparison leads ----------------------- */
const CSTAT = ['quoted', 'new', 'pushed', 'sold', 'quoted', 'new'];
const SITES = ['cheapconveyancing', 'themoveexchange', 'compareconveyancingprices'];
const COMPARISON_LEADS = Array.from({ length: 10 }).map((_, i) => {
  const nm = ['Olu Martins', 'Priya Shah', 'Daniel Reid', 'Grace Coker', 'Ahmed Khan', 'Lucy Owens', 'Femi Cole', 'Hannah Webb', 'Ravi Patel', 'Mary Quinn'][i];
  const [first, last] = nm.split(' ');
  const f = SOLICITOR_FIRMS[i % SOLICITOR_FIRMS.length];
  return {
    id: 'cl-' + (i + 1), first_name: first, last_name: last, email: first.toLowerCase() + '@email.com', phone: '07811 2200' + pad(i),
    transaction_type: TX[i % 4], property_value: 250000 + i * 30000, property_type: i % 2 ? 'Leasehold' : 'Freehold',
    property_region: 'England', property_postcode: 'LS' + (i + 1) + ' 2AB', property_address: (i * 9) + ' Park Lane',
    selected_firm_id: f.id, selected_firm_name: f.name,
    quote_breakdown: { totalIncVat: 900 + i * 120, callbackRequested: i % 4 === 0, instructionRequested: i % 5 === 0, displayedFirms: [{ firmId: f.id }] },
    status: CSTAT[i % CSTAT.length], source: 'comparison', site_id: SITES[i % 3],
    where_things_up_to: ['Offer accepted (sale)', 'Just researching prices', 'Found a property'][i % 3],
    utm_source: i % 2 ? 'google' : 'bing', utm_campaign: 'Conveyancing-Brand', utm_term: 'conveyancing quote',
    created_at: iso(0, 6 + (i % 11), (i * 7) % 60), updated_at: iso(0, 12, i),
  };
});

/* --------------------------- diary tasks ------------------------- */
const TTYPE = ['Call', 'Email', 'SMS', 'Follow-up'];
const DIARY_TASKS = LEADS.slice(0, 10).map((l, i) => {
  const overdue = i < 3, today = i >= 3 && i < 6;
  return {
    id: 'task-' + (i + 1), lead_id: l.id, assigned_to: l.assigned_to || 'u-louise',
    task_type: TTYPE[i % TTYPE.length], title: (l.stage.startsWith('Call-') ? l.stage + ' - Follow-up' : 'Follow up'),
    description: 'Discuss quote and next steps', due_date: iso(overdue ? 1 : today ? 0 : -2, 0, 0).slice(0, 10),
    due_time: pad(9 + i) + ':00:00', priority: l.priority, status: i === 9 ? 'Completed' : 'Pending',
    completed_at: i === 9 ? iso(0, 11, 0) : null, created_at: iso(i + 1), updated_at: iso(0),
    leads: { name: l.name, status: l.status, stage: l.stage },
  };
});

/* --------------------------- activity log ------------------------ */
const ACT_TYPES = [
  ['lead_assigned', 'Lead claimed by Louise Forshaw', { assignedTo: 'u-louise' }],
  ['quote_accepted', 'Quote accepted via email', { quoteShortCode: 'Q-3300' }],
  ['payment_received', 'Payment received', {}],
  ['callback_requested', 'Callback requested', {}],
  ['lead_status_changed', 'Moved to Instructed', { stage: 'Instructed' }],
  ['lead_created', 'New lead created', {}],
  ['contact_attempt', 'Call attempt logged', { outcome: 'No Answer' }],
  ['manual_instruction_marked', 'Marked as instructed', {}],
];
const ACTIVITY_LOG = Array.from({ length: 16 }).map((_, i) => {
  const l = LEADS[i % LEADS.length];
  const [type, desc, meta] = ACT_TYPES[i % ACT_TYPES.length];
  return {
    id: 'act-' + (i + 1), activity_type: type, entity_type: 'lead', entity_id: l.id, lead_id: l.id, lead_name: l.name,
    action_description: desc, done_by_type: i % 5 === 4 ? 'system' : 'user', done_by_id: l.assigned_to || 'u-louise',
    done_by_name: agentName(l.assigned_to) || 'Louise Forshaw', metadata: { ...meta, outcome: meta.outcome, outcomeCode: meta.outcome },
    created_at: iso(0, 8 + (i % 9), i * 3), updated_at: iso(0, 8 + (i % 9), i * 3),
  };
});

/* ----------------------------- calls ----------------------------- */
const CRM_CALL_RECORDS = Array.from({ length: 8 }).map((_, i) => {
  const l = LEADS[i % LEADS.length];
  return {
    id: 'call-' + (i + 1), call_id: '3cx-' + (90000 + i), lead_id: l.id, lead_name: l.name, phone: l.phone,
    agent: agentName(l.assigned_to) || 'Louise Forshaw', agent_user_id: l.assigned_to || 'u-louise', agent_extension: '20' + (i % 4 + 1),
    direction: i % 2 ? 'inbound' : 'outbound', call_time: iso(1, 9 + (i % 8), i * 5), started_at: iso(1, 9 + (i % 8), i * 5),
    duration_seconds: 60 + i * 45, status: i % 3 === 2 ? 'missed' : 'answered', call_status: i % 3 === 2 ? 'missed' : 'answered',
    transcript_status: 'received', ai_status: i % 4 === 3 ? 'failed' : 'completed', ai_analysis_status: i % 4 === 3 ? 'failed' : 'completed',
    match_status: i % 5 === 4 ? 'unmatched' : 'matched', review_status: i < 2 ? 'pending_review' : 'reviewed',
    outcome: ['Interested', 'Call back', 'Not interested', 'Instructed'][i % 4], call_type: 'sales',
    apcm_ai_summary: 'Client discussed pricing and timescales; asked about searches.', summary: 'Discussed pricing and timescales.',
    objections: i % 2 ? ['Price'] : [], tags: ['follow-up'], positive_signals: ['Engaged'], instruction_intent: i % 3 === 0,
    price_concern: i % 2 === 0, follow_up_needed: i % 2 === 0, follow_up_reason: 'Send revised quote', recommended_action: 'Call back tomorrow',
    confidence: 0.8, meaningful_conversation: i % 3 !== 2, official_instruction: i % 4 === 0, manager_risk_flags: [],
    created_at: iso(1, 9, i),
  };
});
const CRM_CALL_AI_ANALYSIS = CRM_CALL_RECORDS.map((c) => ({
  id: 'ai-' + c.id, call_record_id: c.id, lead_id: c.lead_id, outcome: c.outcome, summary: c.summary,
  objections: c.objections, tags: c.tags, instruction_intent: c.instruction_intent, confidence: c.confidence, created_at: c.created_at,
}));

/* ------------------------- outcome codes ------------------------- */
const OUTCOME_CODES = [
  ['INT', 'Interested - Reviewing', 'Lead is interested, proceed to quote', 'call', true, 24, true],
  ['CB', 'Interested - Call Back', 'Client asked to be called back', 'call', true, 2, true],
  ['NA', 'Called - No Answer', 'No answer on this attempt', 'call', true, 4, true],
  ['VM', 'Called - Voicemail', 'Left a voicemail', 'sms', true, 6, true],
  ['NI', 'Not Interested', 'Lead not proceeding', 'delete', false, 24, true],
  ['WN', 'Wrong Number', 'Number incorrect', 'delete', false, 24, true],
  ['GE', 'Gone Elsewhere', 'Instructed another firm', 'delete', false, 24, true],
  ['GP', 'Getting prices', 'Just comparing quotes', 'email', true, 48, false],
].map((c, i) => ({ id: 'oc-' + (i + 1), code: c[0], name: c[1], description: c[2], next_action: c[3], auto_schedule: c[4], schedule_delay: c[5], is_active: c[6], created_at: iso(60), updated_at: iso(2) }));

/* -------------------------- automations -------------------------- */
const AUTOMATIONS = [
  ['New lead → assign round-robin', 'Auto-assign new comparison leads to available agents', 'new_lead', 3, true],
  ['Quote accepted → create invoice', 'When a quote is accepted via email, draft the invoice', 'quote_accepted', 2, true],
  ['No contact 48h → escalate', 'Escalate leads with no contact attempt in 48 hours', 'lead_stage_changed', 4, true],
  ['Instruction → notify manager', 'Notify manager when a lead is instructed', 'lead_status_changed', 1, false],
  ['Callback promised → schedule task', 'Create a diary task when a call-back is promised', 'outcome_code_selected', 2, true],
  ['Overdue payment → reminder', 'Send a reminder email for overdue invoices', 'payment_received', 2, false],
].map((a, i) => ({ id: 'auto-' + (i + 1), name: a[0], description: a[1], trigger_type: a[2], trigger_conditions: {}, steps: Array.from({ length: a[3] }).map((_, j) => ({ type: 'create_task', config: {}, order: j })), is_active: a[4], created_by: 'demo-user', created_at: iso(40 - i), updated_at: iso(1) }));

/* ------------------------ firm price lists ----------------------- */
const FIRM_PRICE_LISTS = [];
const FIRM_SUPPLEMENTS = [];
SOLICITOR_FIRMS.slice(0, 5).forEach((f, fi) => {
  [['Purchase', 'Freehold', 0, 250000, 695], ['Sale', 'Leasehold', 250001, 500000, 795], ['Remortgage', 'Freehold', 0, 1000000, 450]].forEach((p, i) => {
    FIRM_PRICE_LISTS.push({ id: 'fpl-' + fi + '-' + i, firm_id: f.id, transaction_type: p[0], property_type: p[1], min_value: p[2], max_value: p[3], legal_fee_ex_vat: p[4], vat_rate: 20, fee_rules: [], is_active: true, created_at: iso(50), updated_at: iso(2) });
  });
  [['Mortgage admin fee', 195, 'mortgaged'], ['ID / AML check', 12, 'always'], ['Leasehold supplement', 150, 'leasehold']].forEach((s, i) => {
    FIRM_SUPPLEMENTS.push({ id: 'fs-' + fi + '-' + i, firm_id: f.id, name: s[0], amount: s[1], is_percentage: false, per_person: s[2] === 'always', vat_applicable: true, trigger_condition: s[2], transaction_types: [], category: 'supplement', is_active: true, sort_order: i, created_at: iso(50), updated_at: iso(2) });
  });
});

/* --------------------- quota adjustments ------------------------- */
const AGENT_QUOTA_ADJUSTMENTS = [
  { id: 'qa-1', agent_id: 'u-louise', scope: 'daily', action_type: 'extra_allowance', effective_date: iso(0).slice(0, 10), allowance_bonus: 5, usage_offset: 0, reason: 'Cover for sick colleague', created_by: 'demo-user', created_by_name: 'Demo Manager', created_at: iso(0, 8, 0), metadata: {} },
  { id: 'qa-2', agent_id: 'u-sarah', scope: 'daily', action_type: 'reset_to_zero', effective_date: iso(0).slice(0, 10), usage_offset: -3, allowance_bonus: 0, reason: 'Mis-assigned leads', created_by: 'demo-user', created_by_name: 'Demo Manager', created_at: iso(0, 9, 0), metadata: {} },
];

const COMMUNICATION_TEMPLATES = [
  ['Quote follow-up', 'email', 'Following up on your conveyancing quote'],
  ['Callback reminder', 'sms', 'Quick reminder about your call-back'],
  ['Instruction welcome', 'email', 'Welcome — next steps for your instruction'],
  ['Payment reminder', 'email', 'Your invoice is awaiting payment'],
].map((t, i) => ({ id: 'tmpl-' + (i + 1), name: t[0], channel: t[1], type: t[1], subject: t[2], body: 'Hello {{name}}, ...', is_active: true, created_at: iso(30), updated_at: iso(2) }));

/* --------------------- overview report (exact shape) ------------- */
const _byTx = {}; LEADS.forEach((l) => { _byTx[l.transaction_type] = (_byTx[l.transaction_type] || 0) + 1; });
const _bySrc = {}; LEADS.forEach((l) => { _bySrc[l.source] = (_bySrc[l.source] || 0) + 1; });
const _byStatus = {}; LEADS.forEach((l) => { _byStatus[l.status] = (_byStatus[l.status] || 0) + 1; });
const _total = LEADS.length;
const _accepted = QUOTES.filter((q) => q.status === 'Accepted').length;
const _paid = PAYMENTS.filter((p) => p.status === 'Paid').length;
export const OVERVIEW_REPORT = {
  range: { start: iso(30).slice(0, 10), end: iso(0).slice(0, 10), startExclusive: iso(31), endExclusive: iso(-1), days: 30, timezone: 'Europe/London' },
  totals: { leadsGenerated: _total, leadsSold: LEADS.filter((l) => l.status === 'Sold').length, conversionRate: 18.4, leadsDeleted: 2, quotesAccepted: _accepted, paymentsCreated: PAYMENTS.length, paymentsCompleted: _paid },
  leadsByTransaction: Object.keys(_byTx).map((k) => ({ type: k, count: _byTx[k] })),
  leadsBySource: Object.keys(_bySrc).map((k) => ({ source: k, count: _bySrc[k], percentage: Math.round(_bySrc[k] / _total * 100) })),
  leadsByStatus: Object.keys(_byStatus).map((k) => ({ status: k, count: _byStatus[k], percentage: Math.round(_byStatus[k] / _total * 100) })),
  salesByAgent: AGENTS.map((a, i) => ({ agentId: a.id, agentName: a.name, leadsCreated: 6 - i, sales: Math.max(2 - i, 0), conversionRate: 18 - i * 2 })),
  salesByLeadAge: [{ bucket: 'Same Day', count: 22 }, { bucket: '1 Day', count: 14 }, { bucket: '2-3 Days', count: 8 }, { bucket: '4-7 Days', count: 3 }],
  deletedBreakdown: { byActor: [{ actor: 'System', count: 1 }, { actor: 'Demo Manager', count: 1 }], byReason: [{ reason: 'fake', count: 1 }, { reason: 'duplicate', count: 1 }] },
  paymentsByStatus: [{ status: 'Paid', count: _paid }, { status: 'Pending', count: 1 }, { status: 'Overdue', count: 1 }],
};

/* ----------------------------- TABLES ---------------------------- */
export const TABLES = {
  users: USERS,
  leads: LEADS,
  quotes: QUOTES,
  payments: PAYMENTS,
  solicitor_firms: SOLICITOR_FIRMS,
  comparison_leads: COMPARISON_LEADS,
  diary_tasks: DIARY_TASKS,
  tasks: DIARY_TASKS,
  activity_log: ACTIVITY_LOG,
  crm_call_records: CRM_CALL_RECORDS,
  crm_call_ai_analysis: CRM_CALL_AI_ANALYSIS,
  outcome_codes: OUTCOME_CODES,
  automations: AUTOMATIONS,
  automation_executions: [],
  firm_price_lists: FIRM_PRICE_LISTS,
  firm_supplements: FIRM_SUPPLEMENTS,
  agent_quota_adjustments: AGENT_QUOTA_ADJUSTMENTS,
  communication_templates: COMMUNICATION_TEMPLATES,
  lead_instruction_events: [],
  solicitor_instructions: [],
  contact_attempts: [],
  apcm_ai_digests: [],
  quote_fee_rules: [],
  quote_legal_fee_bands: [],
  quote_sdlt_rates: [],
  quote_land_registry_fees: [],
  threecx_call_events: [],
  threecx_call_settings: [{ id: 'default', auto_analyze: false, max_calls_per_run: 100, min_call_seconds: 20 }],
  threecx_cdr_imports: [],
  threecx_sync_runs: [],
  threecx_extension_mappings: AGENTS.map((a, i) => ({ id: 'ext-' + i, user_id: a.id, extension: '20' + (i + 1), agent_name: a.name })),
  cdroutput: [],
  recordings: [],
};

/* ------------------------------ RPC ------------------------------ */
function quotaOverview() {
  return USERS.filter((u) => u.role === 'Agent').map((u, i) => {
    const today = 8 + i * 3, week = 40 + i * 9;
    return {
      agent_id: u.id, agent_name: u.name, agent_email: u.email,
      daily_quota: u.daily_quota, weekly_quota: u.weekly_quota,
      assigned_today_raw: today, assigned_week_raw: week,
      daily_adjustment_total: 0, weekly_adjustment_total: 0, daily_allowance_bonus: i === 0 ? 5 : 0, weekly_allowance_bonus: 0,
      daily_effective: today, weekly_effective: week,
      daily_effective_quota: u.daily_quota + (i === 0 ? 5 : 0), weekly_effective_quota: u.weekly_quota,
      remaining_daily: Math.max(u.daily_quota + (i === 0 ? 5 : 0) - today, 0), remaining_weekly: Math.max(u.weekly_quota - week, 0),
      quota_reached_daily: today >= u.daily_quota, quota_reached_weekly: false,
      active_leads_count: 12 + i * 4, timezone_used: 'Europe/London',
    };
  });
}
export const RPC = {
  get_agent_quota_overview: () => quotaOverview(),
  get_comparison_lead_stats: () => ({ total: COMPARISON_LEADS.length, today: COMPARISON_LEADS.filter((c) => c.created_at >= todayMid).length, quoted: COMPARISON_LEADS.filter((c) => c.status === 'quoted').length, new: COMPARISON_LEADS.filter((c) => c.status === 'new').length, new_count: COMPARISON_LEADS.filter((c) => c.status === 'new').length, callbacks: COMPARISON_LEADS.filter((c) => c.quote_breakdown && c.quote_breakdown.callbackRequested).length, instructions: 3, sold: COMPARISON_LEADS.filter((c) => c.status === 'sold').length }),
  count_today_appearances_by_firm: () => SOLICITOR_FIRMS.map((f, i) => ({ firm_id: f.id, appearance_count: 30 + i * 7 })),
  get_overview_report: () => OVERVIEW_REPORT,
  get_lead_quality_breakdown: () => [],
  get_disqualified_breakdown: () => [{ source: 'Comparison Site', total: 12, fake: 4, duplicate: 3, wrong_number: 5 }, { source: 'Hoowla', total: 6, fake: 2, duplicate: 2, wrong_number: 2 }],
  get_instruction_report_summary: () => ({ total_instructions: 47, agents_credited: 5, todays_instructions: 7, missing_attribution: 10, leads_created: 342, conversion: 13.7 }),
  get_instruction_report_breakdowns: () => ({ by_agent: AGENTS.map((a, i) => ({ value: a.name, count: 12 - i * 2, conversion: 18 - i })), by_source: [{ value: 'Comparison Site', count: 31, conversion: 16.6 }], by_utm_source: [{ value: 'google', count: 28, conversion: 15.1 }], by_campaign: [{ value: 'Conveyancing-Brand', count: 19, conversion: 18.2 }], by_keyword: [{ value: 'house sale solicitor', count: 8, conversion: 21 }] }),
  get_instruction_report_leads: () => LEADS.slice(0, 6).map((l) => ({ id: l.id, name: l.name, email: l.email, instruction_date: iso(0).slice(0, 10), credited_agent: l.assigned_to_name, source: l.source, status: l.status, stage: l.stage, instruction_units: 1 })),
  get_instruction_report_export: () => [],
  get_call_analysis_summary: () => ({ calls_made: 143, conversations: 86, leads_reached: 64, likely_to_instruct: 12, instructions: 7, speed_to_lead_seconds: 492 }),
  get_call_analysis_rows: () => CRM_CALL_RECORDS,
  get_call_analysis_export: () => [],
  get_call_daily_overview: () => Array.from({ length: 7 }).map((_, i) => ({ day: iso(6 - i).slice(0, 10), calls: 100 + i * 8, conversations: 60 + i * 5, instructions: 1 + (i % 3) })),
  get_call_agent_daily_breakdown: () => AGENTS.map((a, i) => ({ agent_id: a.id, agent_name: a.name, calls: 34 - i * 4, conversations: 22 - i * 3, reached: 16 - i * 2, instructions: 4 - Math.min(i, 3), avg_score: 88 - i * 5 })),
  get_call_signal_breakdowns: () => [],
  archive_leads_for_funnel: () => ({ archived: 0 }),
  restore_funnel_archived_leads: () => ({ restored: 0 }),
  mark_lead_instructed: () => ({ success: true }),
  unmark_lead_instructed: () => ({ success: true }),
  disqualify_lead: () => ({ success: true }),
  increment_solicitor_capacity: () => ({ success: true }),
  reset_daily_solicitor_capacity: () => ({ success: true }),
  link_call_record_to_lead: () => ({ success: true }),
  set_call_record_review_status: () => ({ success: true }),
};

/* --------------------------- FUNCTIONS --------------------------- */
export const FUNCTIONS = {
  'auto-assign-solicitor': () => ({ success: true, data: { solicitorFirmId: 'firm-1', solicitorFirmName: 'Millennium Legal' } }),
  'generate-payment-link': () => ({ url: '#' }),
  'threecx-analyze-call': () => ({ success: true, analysis: { outcome: 'Interested', summary: 'Demo analysis', confidence: 0.8 } }),
  'threecx-process-cdr': () => ({ success: true, summary: {}, results: [] }),
  'threecx-call-start': () => ({ success: true }),
  'send-client-email': () => ({ success: true }),
  'apcm-ai-digest': () => ({ success: true }),
};
