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
    property_tenure: i % 3 === 0 ? 'Leasehold' : 'Freehold',
    is_mortgaged: i % 4 !== 0,
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

/* ----------------------- pipeline pulse (leads landing) ----------------------- */
export const PIPELINE_PULSE = {
  spread: {
    total: 139,
    segments: [
      { label: 'New', count: 46, color: '#3b82f6' },
      { label: 'Contacted', count: 48, color: '#f59e0b' },
      { label: 'Qualified', count: 29, color: '#8b5cf6' },
      { label: 'Instructed', count: 16, color: '#22c55e' },
    ],
  },
  hot: { title: 'Hot leads', total: 30, segments: [{ label: 'Qualified', count: 24, tone: 'bad' }, { label: 'Instructed', count: 6, tone: 'good' }] },
  otherActive: { title: 'Other active', total: 35, segments: [{ label: 'Warm', count: 4 }, { label: 'Lukewarm', count: 16 }, { label: 'Cold', count: 6 }, { label: 'Unset', count: 9 }] },
  overdue: { title: 'Overdue by', total: 69, segments: [{ label: '1–3 days', count: 10, tone: 'warn' }, { label: '3+ days', count: 59, tone: 'bad' }] },
  funnel: [
    { stage: 'New', count: 46, movement: 0 },
    { stage: 'Attempting', count: 12, movement: 3 },
    { stage: 'Contacted', count: 48, movement: 0 },
    { stage: 'Qualified', count: 29, movement: 2 },
    { stage: 'Following up', count: 14, movement: 1 },
    { stage: 'Quote pending', count: 9, movement: 0 },
    { stage: 'Instructed', count: 16, movement: 2 },
  ],
  recentCalls: [
    { party: 'Stuart Robinson', summary: 'Qualification call for a flat sale. Property on the market, meeting the agent next week; wants a quote to compare.', outcome: 'connected', when: '8m' },
    { party: 'Patricia Parker', summary: 'Client confirmed commitment to instruct. Walked through the leasehold management-pack requirement.', outcome: 'connected', when: '1h' },
    { party: '+447902140017', summary: 'Inbound call reached voicemail — no client contact established.', outcome: 'voicemail', when: '2h' },
    { party: 'Jacqui Reading', summary: 'Outbound call; forwarded and did not connect.', outcome: 'no_answer', when: '2h' },
    { party: 'Martin Hewitt', summary: 'Voicemail left requesting a callback on the remortgage quote.', outcome: 'voicemail', when: '3h' },
  ],
  recentDeposits: [
    { name: 'Maxine Howell', ref: 'ML-260616-MX3UA', amount: 250, status: 'Onboarding sent', when: '1d' },
    { name: 'Kerry Wilson', ref: 'ML-260615-KWGS0', amount: 250, status: 'Onboarding sent', when: '2d' },
    { name: 'Patricia Parker', ref: 'ML-260616-PP9NM', amount: 250, status: 'Onboarding sent', when: '2d' },
    { name: 'Tricia Rose', ref: 'ML-260615-TR69C', amount: 250, status: 'Instructed', when: '2d' },
    { name: 'Martin Hewitt', ref: 'ML-260615-MHWTM', amount: 150, status: 'Deposit made', when: '4d' },
    { name: 'Janice Chown', ref: 'ML-260609-JCKQE', amount: 250, status: 'Instructed', when: '10 Jun' },
  ],
  chips: [
    { key: 'all', label: 'All', count: 139 },
    { key: 'hot', label: 'Hot', count: 30 },
    { key: 'decision-today', label: 'Decision today', count: 4 },
    { key: 'quoted-no-touch', label: 'Quoted · no touch', count: 27 },
    { key: 'stalled', label: 'Stalled 7d+', count: 58 },
    { key: 'just-instructed', label: 'Just instructed', count: 8 },
    { key: 'lost-30d', label: 'Lost · 30d', count: 16 },
    { key: 'mine', label: 'Mine', count: 0 },
  ],
};

/* ----------------------- daily pipeline (agent worklist) ----------------------- */
const DAILY_PIPELINE = {
  hero: [
    { key: 'overdue', label: 'Overdue', value: '12', tone: 'bad', href: '/diary' },
    { key: 'due', label: 'Due now', value: '8', tone: 'warn', href: '/diary' },
    { key: 'upcoming', label: 'Upcoming', value: '19', tone: 'good', href: '/diary' },
    { key: 'new', label: 'New leads today', value: '6', tone: 'info', href: '/pipeline-pulse' },
    { key: 'hot', label: 'Hot leads', value: '30', tone: 'bad', href: '/lead-management?pulse=hot' },
    { key: 'quota', label: 'Quota left', value: '14 / 40', tone: 'info', href: '' },
  ],
  tasks: [
    { lead: 'Bola Adeyemi', meta: 'Call · 10:30', note: 'Chase signed quote — callback promised today.', tone: 'bad' },
    { lead: 'Folake Bello', meta: 'Email · 11:00', note: 'Send leasehold management-pack request.', tone: 'warn' },
    { lead: 'Chidi Okeke', meta: 'Call · 14:00', note: 'Remortgage quote follow-up.', tone: 'good' },
    { lead: 'Gbenga Ade', meta: 'Call · 15:30', note: 'First qualification call.', tone: 'good' },
  ],
  callbacks: [
    { lead: 'Karen Howe', meta: 'Promised Thu', note: 'Call back Thursday for a decision.', tone: 'bad' },
    { lead: 'Yvonne Akinyi', meta: 'Later today', note: 'Comparing quotes — intends to instruct.', tone: 'warn' },
    { lead: 'Norman Smith', meta: '15 Jun', note: 'Offer accepted £270k — prefers email first.', tone: 'warn' },
  ],
  quoteResponses: [
    { lead: 'Debbie Taylor', meta: '£789 · sent 4d ago', note: 'No-estate-agent purchase £525k.', tone: 'warn' },
    { lead: 'Ryan Darlaston', meta: '£410 · sent 5d ago', note: 'Comparing quotes across firms.', tone: 'bad' },
    { lead: 'Julie Robinson', meta: '£160 · sent 2d ago', note: 'Ltd-company freehold sale.', tone: 'good' },
  ],
};

/* ----------------------------- finance hub ----------------------------- */
const FINANCE_OVERVIEW = {
  kpis: [
    { label: 'Quoted (live)', value: '£48,250', sub: '31 quotes sent', tone: 'info' },
    { label: 'Accepted', value: '£12,400', sub: '8 this month', tone: 'good' },
    { label: 'Awaiting payment', value: '£3,150', sub: '6 invoices', tone: 'warn' },
    { label: 'Overdue', value: '£900', sub: '2 invoices', tone: 'bad' },
    { label: 'Revenue (June)', value: '£9,840', sub: '17 instructions', tone: 'good' },
  ],
  recentQuotes: [
    { name: 'Folake Bello', amount: 2150, status: 'Accepted', when: '1d' },
    { name: 'Bola Adeyemi', amount: 1486, status: 'Accepted', when: '2d' },
    { name: 'Chidi Okeke', amount: 980, status: 'Sent', when: '2d' },
    { name: 'Debbie Taylor', amount: 789, status: 'Sent', when: '4d' },
    { name: 'Ryan Darlaston', amount: 410, status: 'Sent', when: '5d' },
  ],
  recentInvoices: [
    { name: 'Maxine Howell', amount: 250, status: 'Paid', when: '1d' },
    { name: 'Tricia Rose', amount: 250, status: 'Paid', when: '2d' },
    { name: 'Janice Chown', amount: 250, status: 'Paid', when: '10 Jun' },
    { name: 'Daniel Kilev', amount: 250, status: 'Pending', when: '3d' },
    { name: 'Barry Pudney', amount: 50, status: 'Overdue', when: '12 Jun' },
  ],
  aging: [
    { bucket: 'Current', amount: 1500, tone: 'good' },
    { bucket: '1–30d', amount: 900, tone: 'warn' },
    { bucket: '31–60d', amount: 450, tone: 'warn' },
    { bucket: '60d+', amount: 900, tone: 'bad' },
  ],
};

/* ------------------- matters (post-instruction cases · Hoowla in ty) ------------------- */
const MATTER_STAGES = ['Instructed', 'Searches', 'Enquiries', 'Mortgage', 'Exchange', 'Completion'];
const MATTERS = {
  stats: [
    { key: 'active', label: 'Active matters', value: '34', tone: 'info', href: '' },
    { key: 'completing', label: 'Completing this month', value: '7', tone: 'good', href: '' },
    { key: 'needs', label: 'Needs action', value: '9', tone: 'bad', href: '' },
    { key: 'avg', label: 'Avg days to completion', value: '72', tone: 'info', href: '' },
  ],
  stages: MATTER_STAGES,
  distribution: [
    { stage: 'Instructed', count: 8 },
    { stage: 'Searches', count: 7 },
    { stage: 'Enquiries', count: 9 },
    { stage: 'Mortgage', count: 4 },
    { stage: 'Exchange', count: 3 },
    { stage: 'Completion', count: 3 },
  ],
  matters: [
    { client: 'Patricia Parker', ref: 'ML-260616-PP', txn: 'Purchase', value: 610000, stage: 0, status: 'needs_action', days: 6, next: 'ID/AML outstanding — chase client', firm: 'Millennium Legal' },
    { client: 'Bola Adeyemi', ref: 'ML-260616-BA', txn: 'Purchase', value: 385000, stage: 1, status: 'on_track', days: 4, next: 'Searches ordered — awaiting results', firm: 'Millennium Legal' },
    { client: 'Norman Smith', ref: 'ML-260525-NS', txn: 'Purchase', value: 270000, stage: 1, status: 'on_track', days: 5, next: 'Local search returned — reviewing', firm: 'Millennium Legal' },
    { client: 'Folake Bello', ref: 'ML-260616-FB', txn: 'Sale & Purchase', value: 410000, stage: 2, status: 'needs_action', days: 11, next: 'Chase outstanding enquiries from buyer side', firm: 'Millennium Legal' },
    { client: 'Maxine Howell', ref: 'ML-260616-MH', txn: 'Sale & Purchase', value: 515000, stage: 2, status: 'on_track', days: 7, next: 'Enquiries raised with seller', firm: 'Millennium Legal' },
    { client: 'Daniel Kilev', ref: 'ML-260608-DK', txn: 'Purchase', value: 470000, stage: 3, status: 'stalled', days: 21, next: 'Mortgage offer delayed — chase broker', firm: 'Millennium Legal' },
    { client: 'Ryan Darlaston', ref: 'ML-260520-RD', txn: 'Sale', value: 400000, stage: 3, status: 'on_track', days: 6, next: 'Mortgage offer received', firm: 'Millennium Legal' },
    { client: 'Tricia Rose', ref: 'ML-260615-TR', txn: 'Remortgage', value: 295000, stage: 4, status: 'on_track', days: 3, next: 'Exchange target Friday', firm: 'Millennium Legal' },
    { client: 'Karen Howe', ref: 'ML-260602-KH', txn: 'Sale', value: 140000, stage: 4, status: 'needs_action', days: 9, next: 'Buyer slow to exchange — push', firm: 'Millennium Legal' },
    { client: 'Janice Chown', ref: 'ML-260609-JC', txn: 'Sale', value: 280000, stage: 5, status: 'on_track', days: 2, next: 'Completion booked Monday', firm: 'Millennium Legal' },
  ],
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
/* --------------------- call analysis (3CX) --------------------- */
// Differentiated conveyancing sales reps (index 0 = strongest) so the league
// table, per-rep cards, coaching score and speed-to-lead traffic-lights all
// have a real spread to render. Cycles if there are more than 5 demo agents.
const CALL_REP_PROFILES = [
  { calls: 84, ansRate: 0.79, leads: 38, contactRate: 0.74, instr: 8, c2i: 0.30, speedH: 1.8, att1: 38, att2: 26, att3: 20, attPerLead: 3.2, intent: 16, obj: 12, pos: 26, hot: 5 },
  { calls: 76, ansRate: 0.71, leads: 33, contactRate: 0.64, instr: 6, c2i: 0.24, speedH: 5.5, att1: 33, att2: 24, att3: 19, attPerLead: 4.1, intent: 11, obj: 20, pos: 16, hot: 3 },
  { calls: 58, ansRate: 0.62, leads: 27, contactRate: 0.55, instr: 3, c2i: 0.18, speedH: 12.5, att1: 27, att2: 17, att3: 14, attPerLead: 2.0, intent: 5, obj: 22, pos: 9, hot: 2 },
  { calls: 47, ansRate: 0.66, leads: 22, contactRate: 0.59, instr: 3, c2i: 0.21, speedH: 8.2, att1: 22, att2: 14, att3: 11, attPerLead: 2.3, intent: 6, obj: 15, pos: 11, hot: 2 },
  { calls: 34, ansRate: 0.58, leads: 18, contactRate: 0.50, instr: 2, c2i: 0.16, speedH: 15.2, att1: 18, att2: 9, att3: 7, attPerLead: 1.9, intent: 3, obj: 12, pos: 6, hot: 1 },
];
const CALL_AGENT_BREAKDOWN = AGENTS.map((a, i) => {
  const p = CALL_REP_PROFILES[i % CALL_REP_PROFILES.length];
  const answered = Math.round(p.calls * p.ansRate);
  const voicemail = Math.round(p.calls * 0.18);
  const missed = Math.max(p.calls - answered - voicemail, 0);
  const contacted = Math.round(p.leads * p.contactRate);
  return {
    agent_user_id: a.id, agent_name: a.name, agent_extension: String(201 + i),
    total_calls: p.calls, answered_calls: answered, voicemail_calls: voicemail, missed_abandoned_calls: missed,
    outbound_calls: p.calls, outbound_answered_calls: answered, outbound_voicemail_calls: voicemail,
    outbound_answer_rate: Math.round(p.ansRate * 100),
    unique_leads_attempted: p.leads, unique_leads_contacted: contacted, contact_rate: Math.round(p.contactRate * 100),
    official_instructions: p.instr, crm_instructions: p.instr,
    contact_to_instruction_rate: Math.round(p.c2i * 100), call_to_instruction_rate: Number(((p.instr / p.calls) * 100).toFixed(1)),
    inbound_hot_calls: p.hot,
    outbound_attempt_1_calls: p.att1, outbound_attempt_2_calls: p.att2, outbound_attempt_3_plus_calls: p.att3,
    outbound_attempts_per_lead: p.attPerLead,
    average_first_outbound_delay_seconds: Math.round(p.speedH * 3600),
    op1_calls: p.att1,
    follow_up_needed: Math.round(p.leads * 0.4),
    instruction_intent: p.intent, any_objection: p.obj, positive_signals: p.pos,
  };
});
const callSum = (k) => CALL_AGENT_BREAKDOWN.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const callWeightedSpeed = () => {
  const calls = callSum('total_calls');
  if (!calls) return 0;
  return Math.round(CALL_AGENT_BREAKDOWN.reduce((s, r) => s + r.average_first_outbound_delay_seconds * r.total_calls, 0) / calls);
};

// Per-rep call-quality tier mix + average client sentiment (AI-derived in ty; mocked here).
// Indexed to AGENTS so it lines up with CALL_AGENT_BREAKDOWN (Louise strong -> James weak).
const CALL_REP_QUALITY_PROFILES = [
  { excellent: 28, good: 34, meetsFloor: 16, belowFloor: 6, sentiment: 0.34, conversion: 58, coachingTrend: [70, 72, 71, 74, 76, 77, 78] },
  { excellent: 14, good: 30, meetsFloor: 22, belowFloor: 10, sentiment: 0.08, conversion: 41, coachingTrend: [66, 65, 64, 63, 64, 62, 63] },
  { excellent: 6, good: 18, meetsFloor: 20, belowFloor: 14, sentiment: -0.12, conversion: 27, coachingTrend: [59, 56, 55, 53, 52, 51, 50] },
  { excellent: 10, good: 22, meetsFloor: 18, belowFloor: 9, sentiment: 0.05, conversion: 38, coachingTrend: [60, 61, 60, 62, 61, 63, 62] },
  { excellent: 5, good: 14, meetsFloor: 16, belowFloor: 11, sentiment: -0.04, conversion: 24, coachingTrend: [48, 47, 49, 46, 47, 45, 46] },
];
const CALL_REP_QUALITY = AGENTS.map((a, i) => {
  const p = CALL_REP_QUALITY_PROFILES[i % CALL_REP_QUALITY_PROFILES.length];
  return { agent_user_id: a.id, agent_name: a.name, excellent: p.excellent, good: p.good, meets_floor: p.meetsFloor, below_floor: p.belowFloor, sentiment_score: p.sentiment, conversion_rate: p.conversion, coaching_trend: p.coachingTrend };
});

// Call volume by hour (business hours). Outbound dialling peaks mid-morning + early afternoon.
const CALL_HOURLY = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((hour) => {
  const outbound = { 8: 14, 9: 31, 10: 42, 11: 38, 12: 19, 13: 22, 14: 36, 15: 33, 16: 27, 17: 12 };
  const inbound = { 8: 4, 9: 9, 10: 14, 11: 16, 12: 7, 13: 6, 14: 11, 15: 9, 16: 8, 17: 5 };
  return { hour, outbound: outbound[hour], inbound: inbound[hour] };
});

// Callback / follow-up load by day.
const CALL_SCHEDULE_LOAD = [
  { label: 'Overdue', count: 38, tone: 'bad' },
  { label: 'Today', count: 24, tone: 'warn' },
  { label: 'Tomorrow', count: 18, tone: 'good' },
  { label: '+2d', count: 13, tone: 'good' },
  { label: '+3d', count: 9, tone: 'good' },
  { label: '+4d', count: 6, tone: 'good' },
];

// Objection handling: per-category quality split (STRONG/ADEQUATE/WEAK), a representative
// client quote, and the exact graded exchanges for the drill panel (AI-derived in ty).
const CALL_OBJECTION_HANDLING = [
  { category: 'Comparing Quotes', count: 28, strong: 7, adequate: 9, weak: 12, quote: "Your quote is £300 more than the firm down the road.", instances: [
    { rep: 'James Okoro', client: 'G. Ade', quality: 'WEAK', client_said: "I've had a cheaper quote elsewhere, why should I pay more?", rep_replied: "Okay, I can ask if we're able to match it.", reaction: 'pushed_back' },
    { rep: 'Sarah Okafor', client: 'C. Okeke', quality: 'ADEQUATE', client_said: "The other firm is a bit cheaper.", rep_replied: "We're fully transparent on fees with no surprise costs later, which often works out cheaper overall.", reaction: 'neutral' },
    { rep: 'Louise Forshaw', client: 'B. Adeyemi', quality: 'STRONG', client_said: "I'm comparing a few quotes.", rep_replied: "Of course — what matters most, the headline price or reaching completion without delays? Our no-completion-no-fee protects you either way.", reaction: 'positive' },
  ] },
  { category: 'Online Firm Hesitation', count: 16, strong: 3, adequate: 5, weak: 8, quote: "I'd rather use a local high-street solicitor I can walk into.", instances: [
    { rep: 'James Okoro', client: 'A. Bello', quality: 'WEAK', client_said: "I don't really trust online conveyancers.", rep_replied: "We are online though, so that's just how we work.", reaction: 'pushed_back' },
    { rep: 'Louise Forshaw', client: 'F. Bello', quality: 'STRONG', client_said: "I prefer someone local I can pop in to see.", rep_replied: "Understandable — we're SRA-regulated and you get one named handler on their direct line, so you actually reach the same person faster than a high-street queue.", reaction: 'positive' },
  ] },
  { category: 'Timing Not Ready', count: 19, strong: 8, adequate: 7, weak: 4, quote: "We haven't had an offer accepted yet.", instances: [
    { rep: 'Sarah Okafor', client: 'A. Bello', quality: 'ADEQUATE', client_said: "We're not ready, still house-hunting.", rep_replied: "No problem, I'll give you a call back next week.", reaction: 'neutral' },
    { rep: 'Louise Forshaw', client: 'G. Ade', quality: 'STRONG', client_said: "Too early, the offer isn't in.", rep_replied: "Smart to line it up now — I can hold today's quote for 30 days so you're ready the moment it's accepted.", reaction: 'positive' },
  ] },
  { category: 'Local Firm Preference', count: 22, strong: 6, adequate: 9, weak: 7, quote: "My estate agent recommended their in-house solicitor.", instances: [
    { rep: 'Sarah Okafor', client: 'C. Okeke', quality: 'ADEQUATE', client_said: "The agent suggested their own solicitor.", rep_replied: "You're free to choose your own — I can send a quote so you can compare.", reaction: 'neutral' },
  ] },
  { category: 'Price', count: 24, strong: 9, adequate: 9, weak: 6, quote: "That's more than I budgeted for.", instances: [
    { rep: 'Louise Forshaw', client: 'B. Adeyemi', quality: 'STRONG', client_said: "It's a bit more than I'd hoped.", rep_replied: "I hear you — that figure is all-in with no add-ons later. Shall I break down exactly what's included?", reaction: 'positive' },
  ] },
  { category: 'Process Uncertainty', count: 13, strong: 5, adequate: 5, weak: 3, quote: "I don't really understand how conveyancing works.", instances: [
    { rep: 'Sarah Okafor', client: 'A. Bello', quality: 'STRONG', client_said: "This is my first purchase, I'm a bit lost.", rep_replied: "Totally normal — I'll send a simple step-by-step and you'll get a text update at each stage.", reaction: 'positive' },
  ] },
  { category: 'Speed Urgency', count: 9, strong: 4, adequate: 3, weak: 2, quote: "I need to complete before the end of next month.", instances: [
    { rep: 'Louise Forshaw', client: 'F. Bello', quality: 'STRONG', client_said: "Can you complete quickly? I'm on a deadline.", rep_replied: "Yes — if we instruct today I'll open the file immediately and order searches up front.", reaction: 'positive' },
  ] },
  { category: 'Trust Verification', count: 7, strong: 3, adequate: 3, weak: 1, quote: "How do I know you're a legitimate firm?", instances: [
    { rep: 'Louise Forshaw', client: 'C. Okeke', quality: 'STRONG', client_said: "How do I know you're a real firm?", rep_replied: "You can verify us on the SRA register — I'll text you the link and our firm number now.", reaction: 'positive' },
  ] },
];

export const RPC = {
  get_agent_quota_overview: () => quotaOverview(),
  get_comparison_lead_stats: () => ({ total: COMPARISON_LEADS.length, today: COMPARISON_LEADS.filter((c) => c.created_at >= todayMid).length, quoted: COMPARISON_LEADS.filter((c) => c.status === 'quoted').length, new: COMPARISON_LEADS.filter((c) => c.status === 'new').length, new_count: COMPARISON_LEADS.filter((c) => c.status === 'new').length, callbacks: COMPARISON_LEADS.filter((c) => c.quote_breakdown && c.quote_breakdown.callbackRequested).length, instructions: 3, sold: COMPARISON_LEADS.filter((c) => c.status === 'sold').length }),
  count_today_appearances_by_firm: () => SOLICITOR_FIRMS.map((f, i) => ({ firm_id: f.id, appearance_count: 30 + i * 7 })),
  get_overview_report: () => OVERVIEW_REPORT,
  get_pipeline_pulse: () => PIPELINE_PULSE,
  get_daily_pipeline: () => DAILY_PIPELINE,
  get_finance_overview: () => FINANCE_OVERVIEW,
  get_matters: () => MATTERS,
  get_lead_quality_breakdown: () => [],
  get_disqualified_breakdown: () => [{ source: 'Comparison Site', total: 12, fake: 4, duplicate: 3, wrong_number: 5 }, { source: 'Hoowla', total: 6, fake: 2, duplicate: 2, wrong_number: 2 }],
  get_instruction_report_summary: () => ({ total_instructions: 47, agents_credited: 5, todays_instructions: 7, missing_attribution: 10, leads_created: 342, conversion: 13.7 }),
  get_instruction_report_breakdowns: () => ({ by_agent: AGENTS.map((a, i) => ({ value: a.name, count: 12 - i * 2, conversion: 18 - i })), by_source: [{ value: 'Comparison Site', count: 31, conversion: 16.6 }], by_utm_source: [{ value: 'google', count: 28, conversion: 15.1 }], by_campaign: [{ value: 'Conveyancing-Brand', count: 19, conversion: 18.2 }], by_keyword: [{ value: 'house sale solicitor', count: 8, conversion: 21 }] }),
  get_instruction_report_leads: () => LEADS.slice(0, 6).map((l) => ({ id: l.id, name: l.name, email: l.email, instruction_date: iso(0).slice(0, 10), credited_agent: l.assigned_to_name, source: l.source, status: l.status, stage: l.stage, instruction_units: 1 })),
  get_instruction_report_export: () => [],
  get_call_analysis_summary: () => ({ calls_made: callSum('total_calls'), conversations: callSum('answered_calls'), leads_reached: callSum('unique_leads_contacted'), likely_to_instruct: callSum('instruction_intent'), instructions: callSum('official_instructions'), speed_to_lead_seconds: callWeightedSpeed() }),
  get_call_analysis_rows: () => CRM_CALL_RECORDS,
  get_call_analysis_export: () => [],
  get_call_daily_overview: () => [{
    total_calls: callSum('total_calls'), answered_calls: callSum('answered_calls'),
    voicemail_calls: callSum('voicemail_calls'), missed_abandoned_calls: callSum('missed_abandoned_calls'),
    outbound_calls: callSum('outbound_calls'), outbound_answered_calls: callSum('outbound_answered_calls'),
    outbound_voicemail_calls: callSum('voicemail_calls'),
    outbound_answer_rate: Math.round((callSum('answered_calls') / Math.max(callSum('total_calls'), 1)) * 100),
    unique_leads_attempted: callSum('unique_leads_attempted'), unique_leads_contacted: callSum('unique_leads_contacted'),
    contact_rate: Math.round((callSum('unique_leads_contacted') / Math.max(callSum('unique_leads_attempted'), 1)) * 100),
    official_instructions: callSum('official_instructions'),
    contact_to_instruction_rate: Math.round((callSum('official_instructions') / Math.max(callSum('unique_leads_contacted'), 1)) * 100),
    outbound_attempt_1_calls: callSum('outbound_attempt_1_calls'), outbound_attempt_2_calls: callSum('outbound_attempt_2_calls'),
    outbound_attempt_3_plus_calls: callSum('outbound_attempt_3_plus_calls'),
    inbound_hot_calls: callSum('inbound_hot_calls'), possible_hot_calls: 9,
    outbound_attempts_per_lead: Number((callSum('outbound_calls') / Math.max(callSum('unique_leads_attempted'), 1)).toFixed(2)),
    average_first_outbound_delay_seconds: callWeightedSpeed(), average_duration_seconds: 168,
    transcripts_received: callSum('answered_calls'), ai_analysed: Math.round(callSum('answered_calls') * 0.92),
    pending_ai: Math.round(callSum('answered_calls') * 0.08), matched_leads: callSum('unique_leads_contacted'), unmatched_or_ambiguous: 6,
    follow_up_needed: callSum('follow_up_needed'), instruction_intent: callSum('instruction_intent'),
    any_objection: callSum('any_objection'), has_positive_signal: callSum('positive_signals'),
    price_concerns: 24, usp_mentions: 21, op1_calls: callSum('op1_calls'),
  }],
  get_call_agent_daily_breakdown: () => CALL_AGENT_BREAKDOWN,
  get_call_signal_breakdowns: () => [
    { signal_type: 'objection', signal_value: 'Comparing Quotes', calls_count: 28 },
    { signal_type: 'objection', signal_value: 'Price', calls_count: 24 },
    { signal_type: 'objection', signal_value: 'Local Firm Preference', calls_count: 22 },
    { signal_type: 'objection', signal_value: 'Timing Not Ready', calls_count: 19 },
    { signal_type: 'objection', signal_value: 'Online Firm Hesitation', calls_count: 16 },
    { signal_type: 'objection', signal_value: 'Process Uncertainty', calls_count: 13 },
    { signal_type: 'objection', signal_value: 'Speed Urgency', calls_count: 9 },
    { signal_type: 'objection', signal_value: 'Trust Verification', calls_count: 7 },
    { signal_type: 'positive', signal_value: 'Ready to instruct', calls_count: 18 },
    { signal_type: 'positive', signal_value: 'Happy with quote', calls_count: 15 },
    { signal_type: 'usp', signal_value: 'No-completion-no-fee', calls_count: 12 },
    { signal_type: 'usp', signal_value: 'Local & accredited', calls_count: 9 },
  ],
  get_call_rep_quality: () => CALL_REP_QUALITY,
  get_call_hourly_volume: () => CALL_HOURLY,
  get_call_schedule_load: () => CALL_SCHEDULE_LOAD,
  get_call_objection_handling: () => CALL_OBJECTION_HANDLING,
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
