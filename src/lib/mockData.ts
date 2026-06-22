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
// UTC date string (YYYY-MM-DD) matching how pages derive "today" (new Date().toISOString().split('T')[0]).
const ymd = (daysAgo = 0) => new Date(D.getTime() - daysAgo * 86400000).toISOString().split('T')[0];
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
const CURATED_LEADS = leadDefs.map((d, i) => {
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
// 30-day history layer so page-level trends/funnels (Reports daily + conversion-by-source,
// Lead Time age, etc.) have real volume + date spread. DEMO-ONLY.
const HSRC = ['Comparison Site', 'Hoowla', 'Direct', 'Referral', 'Google Ads'];
const HSRC_CONV = { 'Comparison Site': 0.14, 'Hoowla': 0.12, 'Direct': 0.18, 'Referral': 0.24, 'Google Ads': 0.09 };
const HISTORY_LEADS = (() => {
  const out = [];
  for (let day = 0; day < 30; day++) {
    const dow = new Date(D.getTime() - day * 86400000).getDay();
    const weekend = dow === 0 || dow === 6;
    const count = weekend ? 1 : 2 + (day % 3);
    for (let k = 0; k < count; k++) {
      const i = out.length;
      const source = HSRC[(day * 2 + k) % HSRC.length];
      const instructed = ((i * 131 + day * 17 + 7) % 100) / 100 < HSRC_CONV[source];
      const tx = TX[(i + day) % TX.length];
      const assigned = AGENTS[(i + k) % AGENTS.length].id;
      const stage = instructed ? 'Instructed' : ['Call-1', 'Call-2', 'Call-3', 'Interested', 'New'][i % 5];
      const status = instructed ? 'Sold' : (stage === 'Interested' ? 'Interested' : 'New');
      const pv = 250000 + ((i * 37) % 45) * 10000;
      const quoted = instructed || i % 3 === 0;
      const qamount = quoted ? 800 + ((i * 53) % 18) * 50 : null;
      out.push({
        id: 'lead-h' + i, short_code: 'ML-' + (10300 + i),
        name: 'History Lead ' + (i + 1), email: 'hist' + i + '@email.com', phone: '07700 7' + pad(i % 100) + pad((i * 3) % 100),
        source, status, stage, transaction_type: tx, priority: ['High', 'Medium', 'Low'][i % 3],
        assigned_to: assigned, assigned_to_name: agentName(assigned),
        outcome_code: null, custom_outcome_reason: null,
        instructed_firm: instructed ? 'Millennium Legal' : null,
        contact_attempts: stage.startsWith('Call-') ? Number(stage.split('-')[1]) : (instructed ? 3 : (i % 5)),
        max_attempts: 5,
        property_value: pv, property_tenure: i % 3 === 0 ? 'Leasehold' : 'Freehold', is_mortgaged: i % 4 !== 0,
        property_address: (i * 5 + 11) + ' Heritage Way', property_region: 'England', property_postcode: 'M' + (i % 25) + ' ' + (i % 9) + 'HX',
        where_things_up_to: 'In progress',
        quote_id: quoted ? 'quote-h' + i : null, quote_amount: qamount, quote_status: quoted ? (instructed ? 'Accepted' : 'Sent') : null,
        quote_accepted_at: instructed ? iso(day, 14, 0) : null,
        callback_requested: false, callback_status: null, callback_requested_at: null, callback_firm_name: null,
        instruction_requested: false, instruction_request_status: null, instruction_requested_at: null, instruction_request_firm_name: null,
        is_manually_instructed: instructed, manual_instructed_at: instructed ? iso(day, 11, 0) : null,
        is_funnel_archived: false, funnel_archived_category: null,
        created_at: iso(day, 8 + (k % 9), (i * 7) % 60), updated_at: iso(day, 12, 0), last_action_at: iso(day, 12, 0),
        notes: null,
      });
    }
  }
  return out;
})();
const LEADS = [...CURATED_LEADS, ...HISTORY_LEADS];
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
const PAYMENTS = LEADS.filter((l) => l.quote_id).slice(0, 28).map((l, i) => {
  const issuedDaysAgo = 1 + i * 2; // spread ~1..55 days (8 weeks)
  const paid = i % 4 !== 3; // ~75% paid
  const overdue = !paid && i % 8 === 7;
  const status = paid ? 'Paid' : (overdue ? 'Overdue' : 'Sent');
  const amt = l.quote_amount || (900 + (i % 12) * 80);
  return {
    id: 'pay-' + (i + 1), lead_id: l.id, quote_id: l.quote_id, amount: amt, currency: 'GBP',
    status, stripe_payment_link: '#', metadata: { description: l.transaction_type + ' — file opening fee' },
    created_at: iso(issuedDaysAgo, 9, 0), issued_at: iso(issuedDaysAgo, 9, 0),
    due_date: iso(issuedDaysAgo - 14, 17, 0), paid_at: paid ? iso(Math.max(0, issuedDaysAgo - 3), 12, 0) : null,
    leads: leadMini(l.id), quotes: { id: l.quote_id, total_inc_vat: amt },
  };
});

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
const COMPARISON_LEADS = Array.from({ length: 60 }).map((_, i) => {
  const nm = ['Olu Martins', 'Priya Shah', 'Daniel Reid', 'Grace Coker', 'Ahmed Khan', 'Lucy Owens', 'Femi Cole', 'Hannah Webb', 'Ravi Patel', 'Mary Quinn'][i] || ('Client' + (i + 1) + ' Bankole');
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
    created_at: iso(i % 30, 6 + (i % 11), (i * 7) % 60), updated_at: iso(0, 12, i),
  };
});

/* --------------------------- diary tasks ------------------------- */
const TTYPE = ['Call', 'Email', 'SMS', 'Follow-up'];
const DIARY_TASKS = (() => {
  const eligible = LEADS
    .filter((l) => l.assigned_to && !['Sold', 'Closed', 'Cancelled'].includes(l.status))
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1)) // most-recent first, matching the diary list order
    .slice(0, 30);
  return eligible.map((l, i) => {
    const bucket = i % 4; // 0 overdue, 1 today, 2 upcoming, 3 completed
    const overdue = bucket === 0, today = bucket === 1, upcoming = bucket === 2, completed = bucket === 3;
    return {
      id: 'task-' + (i + 1), lead_id: l.id, assigned_to: l.assigned_to,
      task_type: TTYPE[i % TTYPE.length], title: l.stage.startsWith('Call-') ? l.stage + ' - Follow-up' : 'Follow up',
      description: 'Discuss quote and next steps',
      due_date: ymd(overdue ? 1 + (i % 3) : today ? 0 : upcoming ? -(1 + (i % 4)) : 0),
      due_time: pad(9 + (i % 8)) + ':00:00', priority: l.priority,
      status: completed ? 'Completed' : 'Pending',
      completed_at: completed ? iso(0, 9 + (i % 6), 0) : null,
      created_at: iso(2 + (i % 5)), updated_at: iso(0),
      leads: { name: l.name, status: l.status, stage: l.stage },
    };
  });
})();

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
  ['Recovery: Not Interested → soft drip approval', 'Draft a low-pressure re-engagement sequence for old not-interested leads', 'outcome_code_selected', 5, true],
  ['Recovery: Wrong number → contact reconstruction', 'Check phone/email/name/IP/area-code signals and create an approval task', 'outcome_code_selected', 6, true],
  ['Recovery: Won client → referral ask', 'Queue brand-safe referral or repeat-matter outreach after completion cooling-off window', 'custom', 4, true],
  ['Recovery: AI call answer → transfer to human', 'When the AI call agent detects intent, create a live handover task for a free agent', 'custom', 5, true],
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
  signals: [
    { key: 'overdue', label: 'Overdue leads', count: 6, prev: 9, delta: -3, direction: 'down', good: true, tone: 'bad', icon: 'clock', href: '/lead-management?pulse=stalled', spark: [12, 11, 10, 9, 10, 8, 9, 8, 7, 8, 7, 6, 7, 6] },
    { key: 'highPriority', label: 'High priority', count: 7, prev: 6, delta: 1, direction: 'up', good: true, tone: 'warn', icon: 'alert', href: '/lead-management?pulse=hot', spark: [4, 5, 4, 5, 6, 5, 6, 5, 6, 7, 6, 7, 6, 7] },
    { key: 'callbacks', label: 'Callback requests today', count: 4, prev: 2, delta: 2, direction: 'up', good: true, tone: 'info', icon: 'phone', href: '/diary', spark: [2, 3, 2, 3, 2, 3, 4, 3, 4, 3, 4, 3, 3, 4] },
    { key: 'instructionReq', label: 'Instruction requests today', count: 3, prev: 1, delta: 2, direction: 'up', good: true, tone: 'info', icon: 'userCheck', href: '/lead-management?pulse=quoted-no-touch', spark: [1, 1, 2, 1, 2, 2, 1, 2, 3, 2, 3, 2, 3, 3] },
    { key: 'quoteAccepted', label: 'Quote accepted from email', count: 6, prev: 3, delta: 3, direction: 'up', good: true, tone: 'good', icon: 'fileText', href: '/quotes', spark: [2, 3, 2, 4, 3, 4, 3, 5, 4, 5, 4, 5, 6, 6] },
    { key: 'instructedToday', label: 'Instructed today', count: 9, prev: 6, delta: 3, direction: 'up', good: true, tone: 'good', icon: 'checkCircle', href: '/reports/instructions?preset=today', spark: [4, 5, 6, 5, 7, 6, 7, 6, 8, 7, 9, 8, 8, 9] },
  ],
  calls: {
    made: 218,
    answered: 142,
    answerRate: 65,
    instructionIntent: 32,
    byHour: [
      { hour: '9a', calls: 14 },
      { hour: '10a', calls: 28 },
      { hour: '11a', calls: 31 },
      { hour: '12p', calls: 22 },
      { hour: '1p', calls: 12 },
      { hour: '2p', calls: 27 },
      { hour: '3p', calls: 30 },
      { hour: '4p', calls: 33 },
      { hour: '5p', calls: 21 },
    ],
  },
  flow: {
    labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }),
    instructions: [4, 5, 6, 5, 7, 6, 7, 6, 8, 7, 9, 8, 8, 9],
    leads: [16, 18, 15, 20, 17, 22, 19, 24, 21, 23, 20, 26, 24, 27],
    quotesAccepted: [2, 3, 2, 4, 3, 4, 3, 5, 4, 5, 4, 5, 6, 6],
  },
  leadOrigins: {
    updatedAt: '09:12 today',
    mappedPct: 91,
    note: 'GeoIP lookup is strongest in London, North West and South East today. North West is creating the most quote-ready work; South West has high lead volume but needs faster first-touch before lunch.',
    regions: [
      {
        key: 'scotland', label: 'Scotland', area: 'Glasgow / Edinburgh', x: 44, y: 14,
        leads: 18, quotes: 11, instructions: 3, hot: 5, avgFee: 980, source: 'Google Ads', transaction: 'Purchase', confidence: 88, bestWindow: '10am-12pm',
        sample: [
          { lead: 'Iain Morrison', leadId: 'lead-origin-001', ip: '203.0.113.21', city: 'Glasgow', source: 'Google Ads', transaction: 'Purchase', status: 'Quote sent', createdAt: '08:54' },
          { lead: 'Fiona Kerr', leadId: 'lead-origin-002', ip: '203.0.113.24', city: 'Edinburgh', source: 'Organic', transaction: 'Sale', status: 'New lead', createdAt: '09:16' },
        ],
      },
      {
        key: 'north-east', label: 'North East', area: 'Newcastle / Durham', x: 62, y: 33,
        leads: 14, quotes: 8, instructions: 2, hot: 3, avgFee: 860, source: 'Organic', transaction: 'Sale', confidence: 84, bestWindow: '11am-1pm',
        sample: [
          { lead: 'Laura Fenwick', leadId: 'lead-origin-003', ip: '203.0.113.41', city: 'Newcastle', source: 'Organic', transaction: 'Sale', status: 'Callback due', createdAt: '09:42' },
        ],
      },
      {
        key: 'north-west', label: 'North West', area: 'Manchester / Liverpool', x: 43, y: 42,
        leads: 36, quotes: 24, instructions: 7, hot: 11, avgFee: 1120, source: 'Google Ads', transaction: 'Sale + Purchase', confidence: 94, bestWindow: '9am-11am',
        sample: [
          { lead: 'Helen Parker', leadId: 'lead-origin-004', ip: '198.51.100.18', city: 'Manchester', source: 'Google Ads', transaction: 'Sale + Purchase', status: 'Hot lead', createdAt: '08:48' },
          { lead: 'Mark Sutton', leadId: 'lead-origin-005', ip: '198.51.100.22', city: 'Liverpool', source: 'Bing', transaction: 'Purchase', status: 'Quote accepted', createdAt: '10:21' },
          { lead: 'Diane Thomas', leadId: 'lead-origin-006', ip: '198.51.100.23', city: 'Warrington', source: 'Referral', transaction: 'Sale', status: 'Instruction intent', createdAt: '10:37' },
        ],
      },
      {
        key: 'yorkshire', label: 'Yorkshire', area: 'Leeds / Sheffield', x: 58, y: 48,
        leads: 28, quotes: 18, instructions: 5, hot: 8, avgFee: 1040, source: 'Bing', transaction: 'Purchase', confidence: 90, bestWindow: '10am-12pm',
        sample: [
          { lead: 'Rebecca Shaw', leadId: 'lead-origin-007', ip: '198.51.100.44', city: 'Leeds', source: 'Bing', transaction: 'Purchase', status: 'Quote sent', createdAt: '09:58' },
          { lead: 'Amir Patel', leadId: 'lead-origin-008', ip: '198.51.100.45', city: 'Sheffield', source: 'Google Ads', transaction: 'Remortgage', status: 'New lead', createdAt: '11:04' },
        ],
      },
      {
        key: 'midlands', label: 'Midlands', area: 'Birmingham / Nottingham', x: 54, y: 61,
        leads: 31, quotes: 20, instructions: 6, hot: 9, avgFee: 1095, source: 'Google Ads', transaction: 'Sale', confidence: 92, bestWindow: '2pm-4pm',
        sample: [
          { lead: 'Priya Coleman', leadId: 'lead-origin-009', ip: '203.0.113.62', city: 'Birmingham', source: 'Google Ads', transaction: 'Sale', status: 'Hot lead', createdAt: '12:18' },
          { lead: 'Chris Dale', leadId: 'lead-origin-010', ip: '203.0.113.64', city: 'Nottingham', source: 'Direct', transaction: 'Purchase', status: 'Callback due', createdAt: '13:05' },
        ],
      },
      {
        key: 'wales', label: 'Wales', area: 'Cardiff / Swansea', x: 38, y: 68,
        leads: 16, quotes: 9, instructions: 2, hot: 4, avgFee: 910, source: 'Organic', transaction: 'Sale', confidence: 83, bestWindow: '3pm-5pm',
        sample: [
          { lead: 'Cerys Morgan', leadId: 'lead-origin-011', ip: '192.0.2.16', city: 'Cardiff', source: 'Organic', transaction: 'Sale', status: 'Quote sent', createdAt: '11:46' },
        ],
      },
      {
        key: 'east', label: 'East of England', area: 'Cambridge / Norwich', x: 66, y: 69,
        leads: 22, quotes: 15, instructions: 3, hot: 6, avgFee: 1030, source: 'Referral', transaction: 'Remortgage', confidence: 87, bestWindow: '1pm-3pm',
        sample: [
          { lead: 'Oliver Reed', leadId: 'lead-origin-012', ip: '192.0.2.31', city: 'Cambridge', source: 'Referral', transaction: 'Remortgage', status: 'Quote sent', createdAt: '13:22' },
        ],
      },
      {
        key: 'london', label: 'London', area: 'Greater London', x: 65, y: 82,
        leads: 42, quotes: 30, instructions: 9, hot: 14, avgFee: 1280, source: 'Google Ads', transaction: 'Purchase', confidence: 96, bestWindow: '2pm-5pm',
        sample: [
          { lead: 'Sophie Grant', leadId: 'lead-origin-013', ip: '203.0.113.88', city: 'London', source: 'Google Ads', transaction: 'Purchase', status: 'Instruction intent', createdAt: '14:11' },
          { lead: 'Daniel West', leadId: 'lead-origin-014', ip: '203.0.113.91', city: 'Croydon', source: 'Direct', transaction: 'Sale + Purchase', status: 'Hot lead', createdAt: '14:44' },
          { lead: 'Mina Clarke', leadId: 'lead-origin-015', ip: '203.0.113.94', city: 'Enfield', source: 'Organic', transaction: 'Sale', status: 'New lead', createdAt: '15:03' },
        ],
      },
      {
        key: 'south-east', label: 'South East', area: 'Brighton / Kent / Surrey', x: 68, y: 88,
        leads: 34, quotes: 23, instructions: 8, hot: 10, avgFee: 1195, source: 'Google Ads', transaction: 'Sale + Purchase', confidence: 93, bestWindow: '12pm-3pm',
        sample: [
          { lead: 'George Blake', leadId: 'lead-origin-016', ip: '198.51.100.73', city: 'Brighton', source: 'Google Ads', transaction: 'Sale + Purchase', status: 'Quote accepted', createdAt: '12:35' },
          { lead: 'Nadia Evans', leadId: 'lead-origin-017', ip: '198.51.100.77', city: 'Guildford', source: 'Bing', transaction: 'Purchase', status: 'Callback due', createdAt: '13:52' },
        ],
      },
      {
        key: 'south-west', label: 'South West', area: 'Bristol / Exeter', x: 40, y: 86,
        leads: 27, quotes: 14, instructions: 3, hot: 7, avgFee: 975, source: 'Bing', transaction: 'Sale', confidence: 86, bestWindow: '9am-10am',
        sample: [
          { lead: 'Annie Gerald-Webb', leadId: 'lead-origin-018', ip: '192.0.2.53', city: 'Bristol', source: 'Bing', transaction: 'Sale', status: 'Quoted no touch', createdAt: '09:08' },
          { lead: 'Tom Fisher', leadId: 'lead-origin-019', ip: '192.0.2.55', city: 'Exeter', source: 'Google Ads', transaction: 'Purchase', status: 'New lead', createdAt: '10:05' },
        ],
      },
      {
        key: 'northern-ireland', label: 'Northern Ireland', area: 'Belfast', x: 22, y: 42,
        leads: 9, quotes: 5, instructions: 1, hot: 2, avgFee: 840, source: 'Direct', transaction: 'Remortgage', confidence: 79, bestWindow: '11am-12pm',
        sample: [
          { lead: 'Aoife Kelly', leadId: 'lead-origin-020', ip: '203.0.113.109', city: 'Belfast', source: 'Direct', transaction: 'Remortgage', status: 'New lead', createdAt: '11:18' },
        ],
      },
    ],
  },
  peakHours: {
    hours: ['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p'],
    leads: [3, 8, 14, 16, 10, 6, 9, 13, 15, 11, 5],
    instructions: [1, 2, 3, 4, 2, 1, 5, 7, 8, 6, 3],
    calls: [9, 14, 28, 31, 22, 12, 27, 30, 33, 21, 9],
    leadPeak: '10am–12pm',
    instructionPeak: '2pm–4pm',
    callPeak: '3pm–4pm',
  },
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

/* ----------------------- firm analytics hub ----------------------- */
const FIRM_ANALYTICS = {
  kpis: [
    { label: 'Time to deposit', value: '4.8 d', sub: 'created → paid', tone: 'info' },
    { label: 'Time to connect', value: '5h 56m', sub: 'lead → first call', tone: 'warn' },
    { label: 'Attempts / lead', value: '3.2', sub: 'dials before pickup', tone: 'info' },
    { label: 'Lead → instruction', value: '13.7%', sub: 'conversion', tone: 'good' },
    { label: 'In range', value: '293', sub: 'leads, last 30d', tone: 'info' },
    { label: 'Top objection', value: 'Comparing Quotes', sub: '28 calls · 25% handled', tone: 'bad' },
  ],
  lifecycle: [
    { label: 'New', count: 46, color: '#3b82f6' },
    { label: 'Contacted', count: 48, color: '#f59e0b' },
    { label: 'Qualified', count: 29, color: '#8b5cf6' },
    { label: 'Instructed', count: 23, color: '#22c55e' },
    { label: 'Lost', count: 19, color: '#ef4444' },
  ],
  temperature: {
    total: 187,
    segments: [
      { label: 'Hot', count: 30, color: '#ef4444' },
      { label: 'Warm', count: 22, color: '#f59e0b' },
      { label: 'Lukewarm', count: 41, color: '#eab308' },
      { label: 'Cold', count: 32, color: '#3b82f6' },
      { label: 'Unset', count: 62, color: '#94a3b8' },
    ],
  },
  sentiment: [
    { label: 'Very positive', count: 19, tone: 'good' },
    { label: 'Positive', count: 128, tone: 'good' },
    { label: 'Neutral', count: 389, tone: 'info' },
    { label: 'Negative', count: 32, tone: 'bad' },
    { label: 'Very negative', count: 2, tone: 'bad' },
  ],
  objections: [
    { label: 'Comparing Quotes', count: 28, quote: 'Your quote is £300 more than the firm down the road.' },
    { label: 'Price', count: 24, quote: 'Are there any sort of fees on top?' },
    { label: 'Local Firm Preference', count: 22, quote: 'I am looking for a solicitor in Liverpool.' },
    { label: 'Timing Not Ready', count: 19, quote: 'We just want them quotes at the moment.' },
    { label: 'Online Firm Hesitation', count: 16, quote: 'I thought you just get online quotes.' },
    { label: 'Process Uncertainty', count: 13, quote: 'I never sold anything, not quite sure how things work.' },
  ],
  questions: [
    { label: 'Process', count: 27, quote: 'Do I just pay it over the phone, is that okay?' },
    { label: 'Firm details', count: 13, quote: 'Is your phone number there now?' },
    { label: 'Pricing', count: 11, quote: 'Do I have stamp duty, or is that all together?' },
    { label: 'Timescale', count: 9, quote: 'Is it going to be today?' },
    { label: 'Documentation', count: 4, quote: 'What went on it?' },
    { label: 'Trust', count: 3, quote: 'So what does it mean for me?' },
  ],
  capture: [
    { label: 'Property status', pct: 21 },
    { label: 'Offer status', pct: 19 },
    { label: 'Decision maker', pct: 18 },
    { label: 'Urgency level', pct: 18 },
    { label: 'Timescale', pct: 14 },
    { label: 'Prior conveyancing', pct: 9 },
    { label: 'Chain position', pct: 7 },
    { label: 'Mortgage status', pct: 4 },
  ],
  commitments: [
    { action: 'Call back at specified time', total: 68, kept: 54, broken: 3, active: 11 },
    { action: 'Reply with decision', total: 18, kept: 9, broken: 1, active: 8 },
    { action: 'Document returned', total: 8, kept: 5, broken: 0, active: 3 },
    { action: 'Deposit paid', total: 5, kept: 3, broken: 0, active: 2 },
    { action: 'Partner consultation', total: 6, kept: 2, broken: 1, active: 3 },
  ],
  lostReasons: [
    { label: 'Local firm chosen', count: 8 },
    { label: 'Went with someone else', count: 7 },
    { label: 'No longer proceeding', count: 3 },
    { label: 'Referral firm', count: 1 },
  ],
  closeDrivers: [
    { label: 'Clarity on process', count: 14 },
    { label: 'No-completion-no-fee', count: 9 },
    { label: 'Speed / availability', count: 6 },
    { label: 'Local & accredited', count: 4 },
  ],
  followups: [
    { label: 'Progressed', count: 15, tone: 'good' },
    { label: 'Held', count: 22, tone: 'info' },
    { label: 'Stalled', count: 6, tone: 'warn' },
    { label: 'Lost', count: 6, tone: 'bad' },
  ],
  phrases: [
    { rep: 'Louise', text: 'We have decided to go with you.' },
    { rep: 'Sarah', text: 'Oh, you sorted it. Okay, no problem.' },
    { rep: 'Louise', text: 'No problem, I will take you off the list anyway.' },
    { rep: 'James', text: 'Okay. Well, thank you very much for taking our call today.' },
    { rep: 'Sarah', text: 'That makes sense, send the quote over and I will get it back to you.' },
  ],
  leads: {
    bySource: [
      { label: 'Comparison Site', count: 124 },
      { label: 'Google Ads', count: 42 },
      { label: 'Direct', count: 41 },
      { label: 'Hoowla', count: 58 },
      { label: 'Referral', count: 28 },
    ],
    byTransaction: {
      total: 293,
      segments: [
        { label: 'Purchase', count: 118, color: '#3b82f6' },
        { label: 'Sale', count: 74, color: '#8b5cf6' },
        { label: 'Sale & Purchase', count: 61, color: '#22c55e' },
        { label: 'Remortgage', count: 40, color: '#f59e0b' },
      ],
    },
    ageDistribution: [
      { label: 'Same day', count: 22 },
      { label: '1 day', count: 14 },
      { label: '2–3 days', count: 8 },
      { label: '4–7 days', count: 3 },
      { label: '7 days+', count: 5 },
    ],
    conversionBySource: [
      { label: 'Referral', pct: 24 },
      { label: 'Direct', pct: 18 },
      { label: 'Comparison Site', pct: 14 },
      { label: 'Hoowla', pct: 12 },
      { label: 'Google Ads', pct: 9 },
    ],
    disqualified: [
      { label: 'Wrong number', count: 5 },
      { label: 'Fake / spam', count: 4 },
      { label: 'Duplicate', count: 3 },
      { label: 'Out of area', count: 2 },
    ],
  },
};

/* ------------------------ firm trends (momentum) — DEMO ONLY ------------------------ */
// 30-day daily series + weekly rollups powering the Trends/Momentum visuals.
// Deterministic (no random) so reloads are stable. ty computes this from real history.
const FIRM_TRENDS = (() => {
  const DAYS = 30;
  const labels: string[] = [];
  const dows: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    dows.push(d.getDay());
  }
  const mk = (base: number, amp: number, driftPct: number, weekendDip: number, floor: number) =>
    labels.map((_, i) => {
      const drift = base * driftPct * (i / (DAYS - 1));
      const wave = Math.sin(i / 2.3) * amp * 0.5 + Math.cos(i / 1.7) * amp * 0.3;
      const weekend = dows[i] === 0 || dows[i] === 6 ? -weekendDip : 0;
      return Math.max(floor, Math.round(base + drift + wave + weekend));
    });
  const series = {
    leads: mk(18, 6, 0.35, 7, 2),
    calls: mk(180, 40, 0.25, 70, 20),
    instructions: mk(9, 4, 0.45, 4, 0),
    revenue: mk(2600, 1200, 0.5, 1400, 200),
    conversion: labels.map((_, i) => Math.round((11 + (i / (DAYS - 1)) * 5 + Math.sin(i / 2.1) * 1.6) * 10) / 10),
  };
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
  const last14 = (a: number[]) => a.slice(-14);
  const fmtNum = (n: number) => Math.round(n).toLocaleString('en-GB');
  const fmtGBP = (n: number) =>
    n >= 1000000 ? '£' + (n / 1000000).toFixed(1) + 'm' : n >= 1000 ? '£' + (n / 1000).toFixed(1) + 'k' : '£' + Math.round(n);
  const momentum = [
    { key: 'leads', label: 'New leads', value: fmtNum(sum(series.leads)), deltaPct: 12, direction: 'up', good: true, spark: last14(series.leads) },
    { key: 'calls', label: 'Calls made', value: fmtNum(sum(series.calls)), deltaPct: 6, direction: 'up', good: true, spark: last14(series.calls) },
    { key: 'instructions', label: 'Instructions', value: fmtNum(sum(series.instructions)), deltaPct: 9, direction: 'up', good: true, spark: last14(series.instructions) },
    { key: 'revenue', label: 'Revenue', value: fmtGBP(sum(series.revenue)), deltaPct: 14, direction: 'up', good: true, spark: last14(series.revenue) },
    { key: 'conversion', label: 'Conversion', value: avg(series.conversion).toFixed(1) + '%', deltaPct: 3, direction: 'up', good: true, spark: last14(series.conversion) },
    { key: 'speed', label: 'Speed to lead', value: '3.4h', deltaPct: -18, direction: 'down', good: true, spark: [7.1, 6.8, 6.9, 6.2, 5.8, 6.0, 5.3, 5.1, 4.8, 4.9, 4.2, 3.9, 3.6, 3.4] },
  ];
  const weeklyInstructions = [
    { label: 'W1', value: 58, target: 60 }, { label: 'W2', value: 63, target: 60 },
    { label: 'W3', value: 55, target: 60 }, { label: 'W4', value: 67, target: 62 },
    { label: 'W5', value: 71, target: 62 }, { label: 'W6', value: 64, target: 62 },
    { label: 'W7', value: 74, target: 65 }, { label: 'W8', value: 81, target: 65 },
  ];
  const weeklyRevenue = [
    { label: 'W1', value: 18400, target: 20000 }, { label: 'W2', value: 21200, target: 20000 },
    { label: 'W3', value: 19600, target: 20000 }, { label: 'W4', value: 23800, target: 21000 },
    { label: 'W5', value: 25600, target: 21000 }, { label: 'W6', value: 22900, target: 21000 },
    { label: 'W7', value: 27300, target: 23000 }, { label: 'W8', value: 30100, target: 23000 },
  ];
  return { range: 'Last 30 days', labels, series, momentum, weeklyInstructions, weeklyRevenue };
})();

/* ------------------------ team performance — DEMO ONLY ------------------------ */
// Per-agent performance roll-up for the Team hub. ty composes this from the call
// breakdown, AI rep quality, instructions, and quotas; here it is curated.
const TEAM_AGENTS = [
  { id: 'u-louise', name: 'Louise Forshaw', initials: 'LF', rank: 1, score: 84, scoreTrend: [74, 75, 76, 78, 80, 79, 81, 82, 83, 84], scoreDelta: 6, conversion: 58, sentiment: 0.34, callsMade: 84, answerRate: 79, instructions: 8, coaching: 78, quotaUsed: 22, quotaTarget: 20, status: 'top', highlight: 'Top performer — should coach others on objection handling', connect: 88, convert: 80, quality: 82, speedToLeadH: 1.8, coachingNote: 'Consistently strong across the board — her objection handling and fast call-backs set the standard. Pair her with James for a shadow session.' },
  { id: 'u-priya', name: 'Priya Shah', initials: 'PS', rank: 2, score: 76, scoreTrend: [62, 64, 63, 66, 68, 70, 71, 73, 75, 76], scoreDelta: 11, conversion: 44, sentiment: 0.18, callsMade: 71, answerRate: 73, instructions: 6, coaching: 72, quotaUsed: 18, quotaTarget: 20, status: 'top', highlight: 'Most improved this month (+11)', connect: 80, convert: 70, quality: 74, speedToLeadH: 2.6, coachingNote: 'Biggest mover this month (+11). Conversion is climbing as her qualification questions sharpen — give her stretch targets to keep the momentum.' },
  { id: 'u-sarah', name: 'Sarah Okafor', initials: 'SO', rank: 3, score: 67, scoreTrend: [66, 67, 66, 68, 67, 66, 68, 67, 68, 67], scoreDelta: 1, conversion: 41, sentiment: 0.08, callsMade: 76, answerRate: 71, instructions: 6, coaching: 63, quotaUsed: 17, quotaTarget: 20, status: 'steady', connect: 72, convert: 60, quality: 66, speedToLeadH: 5.5, coachingNote: 'Steady and reliable with high volume, but conversion is flat. A session on closing language could lift her from solid to strong.' },
  { id: 'u-tom', name: 'Tom Bennett', initials: 'TB', rank: 4, score: 61, scoreTrend: [64, 63, 62, 61, 60, 62, 61, 60, 61, 61], scoreDelta: -3, conversion: 38, sentiment: 0.05, callsMade: 47, answerRate: 66, instructions: 3, coaching: 62, quotaUsed: 14, quotaTarget: 20, status: 'steady', connect: 66, convert: 54, quality: 60, speedToLeadH: 8.2, coachingNote: 'Holding steady but call volume dipped this month. Check workload and dialling cadence before it affects pipeline.' },
  { id: 'u-james', name: 'James Okoro', initials: 'JO', rank: 5, score: 50, scoreTrend: [59, 56, 55, 53, 52, 51, 50, 49, 50, 50], scoreDelta: -9, conversion: 27, sentiment: -0.12, callsMade: 58, answerRate: 62, instructions: 3, coaching: 50, quotaUsed: 11, quotaTarget: 18, status: 'watch', highlight: 'Needs coaching — 12h speed-to-lead, weak objection handling', connect: 56, convert: 42, quality: 48, speedToLeadH: 12.5, coachingNote: 'Needs coaching now — 12h speed-to-lead and weak objection handling are dragging conversion to 27%. Prioritise call reviews and a speed-to-lead reset this week.' },
];
const TEAM_PERFORMANCE = {
  range: 'Last 30 days',
  teamMomentum: [
    { key: 'score', label: 'Team score', value: '68', deltaPct: 4, direction: 'up', good: true, spark: [63, 64, 64, 65, 66, 66, 67, 67, 68, 68] },
    { key: 'instructions', label: 'Instructions', value: '26', deltaPct: 9, direction: 'up', good: true, spark: [18, 19, 20, 21, 22, 23, 24, 25, 25, 26] },
    { key: 'conversion', label: 'Avg conversion', value: '42%', deltaPct: 3, direction: 'up', good: true, spark: [37, 38, 38, 39, 40, 40, 41, 41, 42, 42] },
    { key: 'sentiment', label: 'Avg sentiment', value: '+0.11', deltaPct: 8, direction: 'up', good: true, spark: [4, 5, 5, 6, 7, 8, 9, 10, 11, 11] },
    { key: 'calls', label: 'Calls made', value: '336', deltaPct: 6, direction: 'up', good: true, spark: [300, 305, 310, 312, 318, 322, 326, 330, 333, 336] },
    { key: 'answer', label: 'Answer rate', value: '70%', deltaPct: 2, direction: 'up', good: true, spark: [67, 67, 68, 68, 69, 69, 70, 70, 70, 70] },
  ],
  agents: TEAM_AGENTS,
  conversionByAgent: TEAM_AGENTS.map((a) => ({ label: a.name.split(' ')[0], count: a.conversion })).sort((x, y) => y.count - x.count),
  coachingByAgent: TEAM_AGENTS.map((a) => ({ label: a.name.split(' ')[0], count: a.coaching })).sort((x, y) => y.count - x.count),
};

/* ----------------------- marketing / ads intelligence — DEMO ONLY ----------------------- */
const MARKETING = {
  range: 'Last 30 days',
  kpis: [
    { label: 'Ad spend', value: '£4,820', sub: 'Google + Bing', tone: 'info', deltaPct: 6, good: false },
    { label: 'Paid leads', value: '218', sub: 'from paid clicks', tone: 'good', deltaPct: 12, good: true },
    { label: 'Instructions', value: '31', sub: 'from paid', tone: 'good', deltaPct: 9, good: true },
    { label: 'Cost / instruction', value: '£156', sub: 'blended', tone: 'warn', deltaPct: -8, good: true },
    { label: 'Return on spend', value: '3.1x', sub: 'fee vs spend', tone: 'good', deltaPct: 14, good: true },
  ],
  campaigns: [
    { name: 'Conveyancing-Brand', source: 'Google Ads', spend: 1450, clicks: 620, leads: 64, instructions: 12, cpl: 23, cpi: 121, conversion: 18.8, recommend: 'scale', spark: [6, 7, 8, 7, 9, 8, 10, 9, 11, 10, 12, 11, 12, 12] },
    { name: 'Sale & Purchase', source: 'Bing', spend: 540, clicks: 240, leads: 31, instructions: 6, cpl: 17, cpi: 90, conversion: 19.4, recommend: 'scale', spark: [3, 4, 3, 4, 5, 4, 5, 4, 5, 6, 5, 6, 6, 6] },
    { name: 'Leasehold-Push', source: 'Google Ads', spend: 720, clicks: 300, leads: 22, instructions: 5, cpl: 33, cpi: 144, conversion: 22.7, recommend: 'hold', spark: [2, 3, 2, 3, 4, 3, 4, 3, 4, 5, 4, 5, 5, 5] },
    { name: 'Remortgage-Generic', source: 'Google Ads', spend: 980, clicks: 410, leads: 38, instructions: 4, cpl: 26, cpi: 245, conversion: 10.5, recommend: 'cut', spark: [5, 4, 5, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 4] },
    { name: 'Competitor', source: 'Google Ads', spend: 1130, clicks: 380, leads: 18, instructions: 2, cpl: 63, cpi: 565, conversion: 11.1, recommend: 'cut', spark: [3, 2, 3, 2, 2, 3, 2, 2, 2, 1, 2, 2, 1, 2] },
  ],
  keywords: [
    { keyword: 'house sale solicitor', leads: 22, instructions: 5, conversion: 22.7, cpc: 1.9 },
    { keyword: 'conveyancing solicitor near me', leads: 28, instructions: 6, conversion: 21.4, cpc: 2.4 },
    { keyword: 'remortgage solicitor', leads: 18, instructions: 3, conversion: 16.7, cpc: 2.1 },
    { keyword: 'conveyancing quote online', leads: 41, instructions: 5, conversion: 12.2, cpc: 1.6 },
    { keyword: 'cheap conveyancing', leads: 34, instructions: 2, conversion: 5.9, cpc: 1.2 },
  ],
  pricing: {
    bands: [
      { band: 'Under £750', sent: 42, accepted: 9, winRate: 21 },
      { band: '£750–£1.2k', sent: 68, accepted: 22, winRate: 32 },
      { band: '£1.2k–£1.8k', sent: 51, accepted: 14, winRate: 27 },
      { band: '£1.8k+', sent: 24, accepted: 4, winRate: 17 },
    ],
    recommendation: 'Win rate peaks at 32% in the £750–£1.2k band. Above £1.8k it drops to 17% — tighten scoping or stage the fee on high-value matters. Sub-£750 quotes (21%) attract price-shoppers; hold the floor.',
  },
  funnel: [
    { label: 'Impressions', count: 48200 },
    { label: 'Clicks', count: 1950 },
    { label: 'Leads', count: 218 },
    { label: 'Quotes sent', count: 142 },
    { label: 'Instructions', count: 31 },
  ],
  sources: [
    { source: 'Referral', leads: 28, instructions: 7, conversion: 25.0, deltaPct: 4 },
    { source: 'Bing', leads: 31, instructions: 6, conversion: 19.4, deltaPct: 15 },
    { source: 'Direct', leads: 35, instructions: 6, conversion: 17.1, deltaPct: -3 },
    { source: 'Google Ads', leads: 124, instructions: 18, conversion: 14.5, deltaPct: 8 },
  ],
  advice: [
    { severity: 'high', title: 'Reallocate ad budget', text: 'The Competitor campaign costs £565 per instruction — 6× the Sale & Purchase (Bing) campaign at £90. Shift ~£600/mo from Competitor into Sale & Purchase and Brand.' },
    { severity: 'high', title: 'Cut a price-shopper keyword', text: '"cheap conveyancing" brings volume (34 leads) but only 5.9% convert and they shop on price. Pause or down-bid; redirect spend to "house sale solicitor" (22.7%).' },
    { severity: 'med', title: 'Pricing sweet spot', text: 'Quotes in £750–£1.2k win 32%. Above £1.8k drop to 17% — review scoping on high-value work.' },
    { severity: 'med', title: 'Bing is underused', text: 'Bing converts at 19.4% vs Google 14.5% at a lower cost-per-lead. Test a budget increase.' },
    { severity: 'low', title: 'Time the call-backs', text: 'Paid leads land 10am–12pm but instructions close 2–4pm. Schedule follow-up calls for the early afternoon.' },
  ],
};

/* ----------------------- email / deliverability intelligence — DEMO ONLY ----------------------- */
const MAIL = {
  range: 'Last 30 days',
  kpis: [
    { label: 'Sent', value: '1,284', sub: 'this period', tone: 'info', deltaPct: 8, good: true },
    { label: 'Delivered', value: '97.2%', sub: '1,248 delivered', tone: 'good', deltaPct: 1, good: true },
    { label: 'Open rate', value: '41%', sub: '512 opened', tone: 'good', deltaPct: 4, good: true },
    { label: 'Bounced', value: '2.8%', sub: '36 bounces', tone: 'warn', deltaPct: -1, good: true },
    { label: 'Spam / junk', value: '1.1%', sub: '14 flagged', tone: 'bad', deltaPct: 2, good: false },
  ],
  funnel: [
    { label: 'Sent', count: 1284 },
    { label: 'Delivered', count: 1248 },
    { label: 'Opened', count: 512 },
    { label: 'Replied', count: 231 },
  ],
  issues: [
    { label: 'Soft bounce', count: 22 },
    { label: 'Hard bounce', count: 14 },
    { label: 'Marked spam', count: 14 },
    { label: 'Send failed', count: 6 },
  ],
  openConversion: {
    openers: { count: 512, instructed: 41, rate: 8.0 },
    nonOpeners: { count: 736, instructed: 22, rate: 3.0 },
    note: 'Leads who open our emails instruct at 8.0% — 2.7× the 3.0% for non-openers. Email engagement is a strong intent signal worth surfacing on the lead.',
  },
  templates: [
    { name: 'Welcome / ID request', sent: 140, openRate: 61, bounceRate: 0.7, conversion: 18 },
    { name: 'Callback confirmation', sent: 188, openRate: 56, bounceRate: 1.1, conversion: 15 },
    { name: 'Quote follow-up', sent: 312, openRate: 48, bounceRate: 1.9, conversion: 12 },
    { name: '6pm info email', sent: 420, openRate: 38, bounceRate: 2.1, conversion: 7 },
    { name: 'Quote reminder', sent: 224, openRate: 35, bounceRate: 3.4, conversion: 9 },
  ],
  trend: {
    labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }),
    sent: [38, 42, 40, 45, 41, 48, 44, 52, 46, 50, 43, 55, 49, 58],
    opened: [16, 18, 16, 19, 17, 20, 18, 22, 19, 21, 18, 23, 21, 24],
    bounced: [1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1],
  },
  advice: [
    { severity: 'high', title: 'Clean the Quote-reminder list', text: '"Quote reminder" bounces at 3.4% (vs 0.7% for Welcome). Stale addresses hurt sender reputation — verify or drop hard-bounced contacts.' },
    { severity: 'high', title: 'Surface email opens on the lead', text: 'Openers instruct at 8.0% vs 3.0% for non-openers. Flag "opened our email" on the lead so agents prioritise warm contacts.' },
    { severity: 'med', title: 'Spam is creeping up', text: 'Junk/spam flags rose to 1.1% (+2pp). Review the 6pm info-email content and send volume; warm the sending domain.' },
    { severity: 'med', title: 'Best send window', text: 'Opens peak 9–10am. Schedule the info and follow-up sends for the morning, not late afternoon.' },
    { severity: 'low', title: 'Lean into Welcome / ID', text: '61% open and 18% convert — the highest of any template. Make sure every instruction-intent lead receives it.' },
  ],
};

/* ----------------------- recovery engine — DEMO ONLY ----------------------- */
const RECOVERY_ENGINE = {
  range: 'Last 30 days',
  kpis: [
    { label: 'Recoverable value', value: '£148.6k', sub: 'approval-first queue', tone: 'good', deltaPct: 18, good: true },
    { label: 'Eligible leads', value: '486', sub: 'old/lost/stale', tone: 'info', deltaPct: 12, good: true },
    { label: 'AI touches', value: '1,920', sub: 'email, SMS, calls', tone: 'info', deltaPct: 24, good: true },
    { label: 'Recovered', value: '37', sub: 'instructions/referrals', tone: 'good', deltaPct: 16, good: true },
    { label: 'Needs approval', value: '42', sub: 'contact repairs + tasks', tone: 'warn', deltaPct: -9, good: true },
  ],
  trendLabels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }),
  trend: {
    eligible: [28, 31, 29, 35, 34, 37, 39, 42, 40, 45, 43, 48, 46, 51],
    aiTouches: [88, 96, 104, 112, 118, 130, 126, 142, 151, 148, 162, 171, 168, 184],
    replies: [9, 12, 10, 13, 14, 16, 15, 18, 19, 17, 21, 23, 22, 26],
    recovered: [1, 2, 2, 3, 2, 4, 3, 5, 4, 4, 5, 6, 5, 7],
  },
  funnel: [
    { label: 'Eligible', count: 486 },
    { label: 'AI drafted', count: 438 },
    { label: 'Approved', count: 312 },
    { label: 'Delivered', count: 286 },
    { label: 'Replied', count: 53 },
    { label: 'Recovered', count: 37 },
  ],
  cohorts: [
    {
      key: 'not-interested',
      label: 'Not interested',
      reason: 'Rejected the first quote, but property timing may have changed.',
      eligible: 126,
      value: 38200,
      avgAgeDays: 83,
      aiTouches: 412,
      replyRate: 16,
      conversionRate: 5.8,
      risk: 'low pressure only',
      suppression: 18,
      channel: 'mixed',
      confidence: 78,
      trend: [8, 9, 8, 11, 12, 13],
      leads: [
        { leadId: 'lead-16', lead: 'Tunde Bakare', agent: 'Louise Forshaw', date: '14 Jun', trigger: 'Not interested 78d ago', outcome: 'opened email, no reply', aiDraft: 'Just checking whether you still need anything conveyancing-related. If not, no problem - I can close this off properly.', nextAction: 'Approve soft email then create a 3-day call task if opened.', note: 'Keep tone low-friction; no price pressure.', value: 980 },
        { leadId: 'lead-h14', lead: 'History Lead 15', agent: 'Dej A', date: '11 Jun', trigger: 'Price objection, no instruction elsewhere found', outcome: 'reply asked for updated fee', aiDraft: 'A lot can change with timing and lender requirements. If you still want a quick updated figure, I can get one sent over.', nextAction: 'Send updated quote prompt to agent.', note: 'AI detected "still browsing" not a firm rejection.', value: 1240 },
      ],
    },
    {
      key: 'getting-prices',
      label: 'Getting prices',
      reason: 'Quote shoppers often re-enter once offers, mortgage or chain pressure appears.',
      eligible: 94,
      value: 26800,
      avgAgeDays: 41,
      aiTouches: 328,
      replyRate: 22,
      conversionRate: 8.4,
      risk: 'message before quote expiry',
      suppression: 9,
      channel: 'email',
      confidence: 84,
      trend: [7, 8, 9, 12, 14, 16],
      leads: [
        { leadId: 'lead-13', lead: 'Cecilia Cristea', agent: 'Helen Sadler', date: '18 Jun', trigger: 'Getting prices + opened quote twice', outcome: 'email opened', aiDraft: 'You may already be sorted, but if you are still comparing, I can make sure you are looking at the full cost rather than just the headline fee.', nextAction: 'Approve value-frame email.', note: 'Best cohort for helpful comparison content.', value: 1180 },
        { leadId: 'lead-h22', lead: 'History Lead 23', agent: 'Jonny Green', date: '16 Jun', trigger: 'Quote opened after 19 days', outcome: 'no reply yet', aiDraft: 'I noticed you had another look at the quote. Do you want me to check whether the fee still fits your purchase details?', nextAction: 'Create same-day agent nudge task.', note: 'Recent open lifts priority.', value: 1340 },
      ],
    },
    {
      key: 'gone-elsewhere',
      label: 'Gone elsewhere',
      reason: 'May still need a second matter, rescue help, or future referral follow-up.',
      eligible: 71,
      value: 18400,
      avgAgeDays: 96,
      aiTouches: 204,
      replyRate: 11,
      conversionRate: 3.2,
      risk: 'avoid aggressive win-back',
      suppression: 22,
      channel: 'email',
      confidence: 67,
      trend: [4, 5, 5, 6, 7, 8],
      leads: [
        { leadId: 'lead-h31', lead: 'History Lead 32', agent: 'Dej A', date: '9 Jun', trigger: 'Gone elsewhere 104d ago', outcome: 'no response', aiDraft: 'I hope your move is going smoothly. If anything gets stuck or you need a second opinion, I am happy to point you in the right direction.', nextAction: 'Hold as quarterly helpful check-in.', note: 'Recovery value lower, referral value still present.', value: 840 },
        { leadId: 'lead-h8', lead: 'History Lead 9', agent: 'Louise Forshaw', date: '12 Jun', trigger: 'Sold elsewhere + new remortgage search keyword', outcome: 'clicked guide', aiDraft: 'If this is now a remortgage rather than the original sale, I can route you to the right quote quickly.', nextAction: 'Approve remortgage branch email.', note: 'AI matched new intent to old contact.', value: 950 },
      ],
    },
    {
      key: 'bad-number',
      label: 'Wrong / invalid number',
      reason: 'AI reconstructs likely contact routes from phone, email, name, IP and area-code signals.',
      eligible: 53,
      value: 22100,
      avgAgeDays: 28,
      aiTouches: 119,
      replyRate: 19,
      conversionRate: 6.6,
      risk: 'requires approval',
      suppression: 6,
      channel: 'mixed',
      confidence: 73,
      trend: [3, 4, 6, 7, 8, 10],
      leads: [
        { leadId: 'lead-4', lead: 'Aisha Bello', agent: 'Helen Sadler', date: '18 Jun', trigger: 'Wrong number, email domain valid', outcome: 'email delivered', aiDraft: 'We could not reach you by phone, so I am checking by email before we close this quote request.', nextAction: 'Approve email and verify phone candidate.', note: 'Phone repair confidence 82%.', value: 1450 },
        { leadId: 'lead-h6', lead: 'History Lead 7', agent: 'Jonny Green', date: '17 Jun', trigger: 'Number invalid + Manchester IP', outcome: 'candidate number found', aiDraft: 'I wanted to check we have the best contact number before we close this off.', nextAction: 'Agent approval required before using repaired number.', note: 'Area code and IP both point North West.', value: 1220 },
      ],
    },
    {
      key: 'quoted-no-touch',
      label: 'Quoted no touch',
      reason: 'Quote sent or accepted signal exists, but no human follow-up happened after the window.',
      eligible: 88,
      value: 43100,
      avgAgeDays: 17,
      aiTouches: 463,
      replyRate: 25,
      conversionRate: 11.2,
      risk: 'highest value',
      suppression: 5,
      channel: 'mixed',
      confidence: 88,
      trend: [9, 11, 13, 16, 18, 22],
      leads: [
        { leadId: 'lead-14', lead: 'James Flock', agent: 'Louise Forshaw', date: '18 Jun', trigger: 'Quote accepted, no payment', outcome: 'SMS clicked', aiDraft: 'You accepted the quote but the payment step looks unfinished. Do you want me to resend the secure link?', nextAction: 'Create payment recovery task.', note: 'High intent; do not leave to generic drip.', value: 1620 },
        { leadId: 'lead-3', lead: 'Chidi Okeke', agent: 'Dej A', date: '18 Jun', trigger: 'Remortgage quote sent, no touch 5d', outcome: 'opened twice', aiDraft: 'Do you want me to check whether the remortgage quote still matches your lender timing?', nextAction: 'Approve SMS + call task.', note: 'Best window: early afternoon.', value: 980 },
      ],
    },
    {
      key: 'won-client',
      label: 'Won clients',
      reason: 'Post-completion referral, repeat matter and related-need opportunities.',
      eligible: 54,
      value: 29800,
      avgAgeDays: 142,
      aiTouches: 394,
      replyRate: 31,
      conversionRate: 9.1,
      risk: 'brand-safe only',
      suppression: 3,
      channel: 'email',
      confidence: 86,
      trend: [5, 6, 8, 10, 12, 15],
      leads: [
        { leadId: 'lead-10', lead: 'Sarah Pearse', agent: 'Helen Sadler', date: '15 Jun', trigger: 'Completed sale + purchase 5 months ago', outcome: 'referral link opened', aiDraft: 'I hope you are settled in. If a friend or family member needs conveyancing, I can make sure they are looked after quickly.', nextAction: 'Approve referral ask.', note: 'High satisfaction tag from completion call.', value: 1300 },
        { leadId: 'lead-11', lead: 'Jasmine Ashford', agent: 'Jonny Green', date: '13 Jun', trigger: 'Purchase completed 4 months ago', outcome: 'reply positive', aiDraft: 'Thanks again for trusting us with the purchase. If you ever need sale, remortgage or transfer help, just reply here.', nextAction: 'Create referral follow-up task.', note: 'Client replied positively to check-in.', value: 1180 },
      ],
    },
  ],
  campaigns: [
    { key: 'soft-check-in', name: 'Soft check-in after old rejection', channel: 'email', status: 'running', sent: 424, opened: 198, replied: 42, recovered: 9, value: 11900, openRate: 47, replyRate: 10, conversionRate: 2.1, cost: 92, spark: [22, 26, 30, 33, 37, 42] },
    { key: 'quote-save', name: 'Still moving? quote rescue', channel: 'mixed', status: 'approval', sent: 286, opened: 154, replied: 37, recovered: 14, value: 21800, openRate: 54, replyRate: 13, conversionRate: 4.9, cost: 128, spark: [18, 22, 25, 31, 34, 39] },
    { key: 'bad-number-repair', name: 'Contact reconstruction approval', channel: 'mixed', status: 'learning', sent: 119, opened: 61, replied: 18, recovered: 6, value: 8100, openRate: 51, replyRate: 15, conversionRate: 5.0, cost: 74, spark: [5, 7, 8, 11, 13, 18] },
    { key: 'won-referral', name: 'Won-client referral ask', channel: 'email', status: 'running', sent: 394, opened: 244, replied: 64, recovered: 8, value: 9700, openRate: 62, replyRate: 16, conversionRate: 2.0, cost: 88, spark: [20, 24, 31, 36, 48, 64] },
    { key: 'ai-call-loop', name: 'AI call retry loop', channel: 'call', status: 'paused', sent: 212, opened: 0, replied: 31, recovered: 5, value: 7100, openRate: 0, replyRate: 15, conversionRate: 2.4, cost: 186, spark: [8, 9, 12, 14, 16, 19] },
  ],
  reconstruction: [
    { key: 'rx-1', leadId: 'lead-4', lead: 'Aisha Bello', issue: 'Wrong number', original: '07700 900113', proposal: '07700 900118', signals: ['same email domain', 'Manchester IP', 'name match in web enquiry'], confidence: 82, status: 'needs approval', action: 'Ask Helen to verify before call', value: 1450, agent: 'Helen Sadler', trend: [1, 1, 2, 3, 4, 5], note: 'AI found one digit likely transposed; do not auto-call until approved.' },
    { key: 'rx-2', leadId: 'lead-h6', lead: 'History Lead 7', issue: 'Number invalid', original: '07700 70718', proposal: 'email-first + request best mobile', signals: ['email delivered', 'North West IP', 'no phone confidence'], confidence: 69, status: 'queued', action: 'Send email asking for best number', value: 1220, agent: 'Jonny Green', trend: [1, 2, 2, 3, 3, 4], note: 'Phone repair is weak; email route is safer.' },
    { key: 'rx-3', leadId: 'lead-h20', lead: 'History Lead 21', issue: 'Typo in email', original: 'client@gmial.com', proposal: 'client@gmail.com', signals: ['MX domain typo', 'same phone area', 'quote page revisit'], confidence: 91, status: 'agent notified', action: 'Approve corrected email drip', value: 980, agent: 'Dej A', trend: [2, 2, 3, 4, 4, 6], note: 'Classic domain typo; safe to ask agent to confirm.' },
    { key: 'rx-4', leadId: 'lead-h28', lead: 'History Lead 29', issue: 'Fake number marker', original: '+447000000000', proposal: 'suppress phone, use email only', signals: ['disposable phone pattern', 'email opened', 'London IP'], confidence: 76, status: 'suppressed', action: 'Email only, no dial', value: 710, agent: 'Louise Forshaw', trend: [1, 1, 1, 2, 2, 2], note: 'Do not reintroduce phone noise to agents.' },
  ],
  agentQueue: [
    { agent: 'Louise Forshaw', freeSlots: 6, tasks: 18, value: 26400, focus: 'Quoted no touch', channels: 'SMS + call', expectedRecovery: 7, oldest: '19d' },
    { agent: 'Dej A', freeSlots: 4, tasks: 14, value: 18800, focus: 'Getting prices', channels: 'Email + call', expectedRecovery: 5, oldest: '33d' },
    { agent: 'Helen Sadler', freeSlots: 3, tasks: 11, value: 14200, focus: 'Bad number approval', channels: 'Email first', expectedRecovery: 4, oldest: '28d' },
    { agent: 'Jonny Green', freeSlots: 5, tasks: 16, value: 21600, focus: 'Won-client referral', channels: 'Email', expectedRecovery: 6, oldest: '5mo' },
  ],
  aiCalls: [
    { label: 'AI call attempts', count: 212, rate: 100, tone: 'info' },
    { label: 'Answered', count: 62, rate: 29, tone: 'warn' },
    { label: 'Qualified responses', count: 31, rate: 15, tone: 'good' },
    { label: 'Transferred to human', count: 18, rate: 9, tone: 'good' },
    { label: 'Suppressed', count: 22, rate: 10, tone: 'bad' },
  ],
  wonClients: [
    { leadId: 'lead-10', client: 'Sarah Pearse', completedAgo: '5 months', opportunity: 'Referral ask after positive completion', confidence: 88, referralAsk: 'Friends/family conveyancing intro', expectedValue: 1300, stage: 'draft ready', agent: 'Helen Sadler' },
    { leadId: 'lead-11', client: 'Jasmine Ashford', completedAgo: '4 months', opportunity: 'Repeat purchase/remortgage check', confidence: 81, referralAsk: 'Useful moving checklist + reply prompt', expectedValue: 1180, stage: 'replied positive', agent: 'Jonny Green' },
    { leadId: 'lead-h34', client: 'History Lead 35', completedAgo: '8 months', opportunity: 'Landlord portfolio broadcast', confidence: 74, referralAsk: 'Portfolio remortgage or transfer help', expectedValue: 1840, stage: 'approval needed', agent: 'Dej A' },
    { leadId: 'lead-h41', client: 'History Lead 42', completedAgo: '11 months', opportunity: 'Estate-agent referral route', confidence: 69, referralAsk: 'Ask if their agent needs a trusted conveyancing contact', expectedValue: 960, stage: 'waiting', agent: 'Louise Forshaw' },
  ],
  scores: [
    { leadId: 'lead-14', lead: 'James Flock', score: 94, value: 1620, reason: 'Accepted quote, payment unfinished', lastSignal: 'SMS clicked today', contactConfidence: 96, risk: 'low', agent: 'Louise Forshaw', nextBestAction: 'Approve payment rescue task', channel: 'sms', badges: ['accepted quote', 'warm click', 'high value'], trend: [68, 74, 81, 88, 91, 94] },
    { leadId: 'lead-13', lead: 'Cecilia Cristea', score: 91, value: 1180, reason: 'Getting prices, quote opened twice', lastSignal: 'Email opened 18 Jun', contactConfidence: 88, risk: 'low', agent: 'Helen Sadler', nextBestAction: 'Approve value-frame email', channel: 'email', badges: ['quote shopper', 'recent open', 'helpful angle'], trend: [55, 63, 70, 78, 86, 91] },
    { leadId: 'lead-4', lead: 'Aisha Bello', score: 86, value: 1450, reason: 'Wrong number, email still valid', lastSignal: 'Manchester IP + email delivered', contactConfidence: 82, risk: 'medium', agent: 'Helen Sadler', nextBestAction: 'Approve email-first contact repair', channel: 'email', badges: ['contact repair', 'IP match', 'approval needed'], trend: [42, 51, 63, 70, 79, 86] },
    { leadId: 'lead-10', lead: 'Sarah Pearse', score: 84, value: 1300, reason: 'Won client, positive completion signal', lastSignal: 'Referral link opened', contactConfidence: 94, risk: 'low', agent: 'Jonny Green', nextBestAction: 'Approve relationship-led referral ask', channel: 'email', badges: ['won client', 'brand safe', 'referral'], trend: [60, 64, 70, 78, 80, 84] },
    { leadId: 'lead-h8', lead: 'History Lead 9', score: 77, value: 950, reason: 'Gone elsewhere but new remortgage intent', lastSignal: 'Clicked remortgage guide', contactConfidence: 79, risk: 'medium', agent: 'Louise Forshaw', nextBestAction: 'Branch into remortgage check-in', channel: 'email', badges: ['new intent', 'old lead', 'soft ask'], trend: [41, 48, 52, 60, 68, 77] },
  ],
  lostReasons: [
    { reason: 'Quoted no touch', count: 88, value: 43100, replyRate: 25, recoveredRate: 11.2, topAction: 'Payment/link rescue and same-day call task', trend: [9, 11, 13, 16, 18, 22] },
    { reason: 'Getting prices', count: 94, value: 26800, replyRate: 22, recoveredRate: 8.4, topAction: 'Helpful comparison email before quote expiry', trend: [7, 8, 9, 12, 14, 16] },
    { reason: 'Wrong / invalid number', count: 53, value: 22100, replyRate: 19, recoveredRate: 6.6, topAction: 'Email-first repair, agent approval before calling', trend: [3, 4, 6, 7, 8, 10] },
    { reason: 'Not interested', count: 126, value: 38200, replyRate: 16, recoveredRate: 5.8, topAction: 'Low-pressure timing check', trend: [8, 9, 8, 11, 12, 13] },
    { reason: 'Gone elsewhere', count: 71, value: 18400, replyRate: 11, recoveredRate: 3.2, topAction: 'Quarterly help-first check-in', trend: [4, 5, 5, 6, 7, 8] },
    { reason: 'Won client dormant', count: 54, value: 29800, replyRate: 31, recoveredRate: 9.1, topAction: 'Referral and repeat-matter ask', trend: [5, 6, 8, 10, 12, 15] },
  ],
  journeys: [
    {
      leadId: 'lead-14',
      lead: 'James Flock',
      stage: 'Human task ready',
      value: 1620,
      agent: 'Louise Forshaw',
      steps: [
        { label: 'Quote accepted', at: '18 Jun 09:40', status: 'done', note: 'Payment step not completed.' },
        { label: 'AI detected stall', at: '18 Jun 10:05', status: 'done', note: 'High intent, do not send generic drip.' },
        { label: 'Draft approved', at: '18 Jun 10:22', status: 'done', note: 'SMS and secure payment link ready.' },
        { label: 'Agent handover', at: 'Now', status: 'current', note: 'Louise has the shortest high-value queue.' },
      ],
    },
    {
      leadId: 'lead-4',
      lead: 'Aisha Bello',
      stage: 'Contact repair approval',
      value: 1450,
      agent: 'Helen Sadler',
      steps: [
        { label: 'Wrong number marked', at: '17 Jun 16:10', status: 'done', note: 'Call failed twice.' },
        { label: 'AI reconstructed route', at: '18 Jun 08:35', status: 'done', note: 'Email domain, IP and name match support email-first path.' },
        { label: 'Phone candidate found', at: '18 Jun 08:36', status: 'blocked', note: 'Needs agent approval before use.' },
        { label: 'Email-first recovery', at: 'Next', status: 'current', note: 'Send safe check-in without using repaired phone yet.' },
      ],
    },
    {
      leadId: 'lead-10',
      lead: 'Sarah Pearse',
      stage: 'Referral ask ready',
      value: 1300,
      agent: 'Jonny Green',
      steps: [
        { label: 'Matter completed', at: '5 months ago', status: 'done', note: 'Completion sentiment marked positive.' },
        { label: 'Referral link opened', at: '15 Jun', status: 'done', note: 'Warm relationship signal.' },
        { label: 'AI drafted ask', at: 'Today', status: 'current', note: 'Brand-safe, relationship-led, no pressure.' },
      ],
    },
  ],
  outreachDrafts: [
    { key: 'draft-quote-rescue', leadId: 'lead-14', lead: 'James Flock', channel: 'sms', campaign: 'Still moving? quote rescue', variant: 'Payment link rescue', tone: 'direct but helpful', risk: 'low', expectedReplyRate: 28, approvalStatus: 'ready', body: 'You accepted the quote but the payment step looks unfinished. Do you want me to resend the secure link?', guardrails: ['single SMS only', 'stop on reply', 'no discount pressure'], value: 1620 },
    { key: 'draft-price-helper', leadId: 'lead-13', lead: 'Cecilia Cristea', channel: 'email', campaign: 'Getting prices helper', variant: 'Value comparison', tone: 'helpful adviser', risk: 'low', expectedReplyRate: 24, approvalStatus: 'ready', subject: 'Still comparing conveyancing quotes?', body: 'If you are still comparing, I can help you check the full cost rather than just the headline fee.', guardrails: ['no competitor naming', 'explain total cost', 'agent approves before send'], value: 1180 },
    { key: 'draft-bad-number', leadId: 'lead-4', lead: 'Aisha Bello', channel: 'email', campaign: 'Contact reconstruction approval', variant: 'Email-first repair', tone: 'careful and compliant', risk: 'medium', expectedReplyRate: 19, approvalStatus: 'needs review', subject: 'Best contact number for your quote', body: 'We could not reach you by phone, so I am checking by email before we close this quote request.', guardrails: ['do not call repaired number', 'agent must approve', 'suppress if bounce'], value: 1450 },
    { key: 'draft-referral', leadId: 'lead-10', lead: 'Sarah Pearse', channel: 'email', campaign: 'Won-client referral ask', variant: 'Relationship-led referral', tone: 'warm', risk: 'low', expectedReplyRate: 31, approvalStatus: 'running', subject: 'Hope you are settling in well', body: 'If a friend or family member needs conveyancing, I can make sure they are looked after quickly.', guardrails: ['one follow-up maximum', 'no sales pressure', 'respect completed-client tone'], value: 1300 },
    { key: 'draft-gone-elsewhere', leadId: 'lead-h31', lead: 'History Lead 32', channel: 'email', campaign: 'Gone elsewhere help-first', variant: 'Second opinion', tone: 'low pressure', risk: 'medium', expectedReplyRate: 12, approvalStatus: 'blocked', subject: 'Hope your move is going smoothly', body: 'If anything gets stuck or you need a second opinion, I am happy to point you in the right direction.', guardrails: ['quarterly only', 'never imply failure', 'manual approval'], value: 840 },
  ],
  riskSignals: [
    { key: 'unsubscribe', label: 'Unsubscribe or do-not-contact risk', count: 18, severity: 'high', detail: 'Suppress before any AI drip or call task is created.', action: 'Review suppression list' },
    { key: 'phone-repair', label: 'Repaired phone needs human approval', count: 11, severity: 'high', detail: 'AI can suggest likely numbers, but agents approve before dialling.', action: 'Open contact lab' },
    { key: 'over-touch', label: 'Too many touches in 14 days', count: 26, severity: 'medium', detail: 'Stop automated nudges when a lead has already had 3+ touches.', action: 'Reduce cadence' },
    { key: 'complaint-tone', label: 'Complaint-style wording detected', count: 4, severity: 'high', detail: 'Any upset or complaint-like reply blocks further automation.', action: 'Escalate manually' },
    { key: 'fake-number', label: 'Fake number patterns', count: 9, severity: 'medium', detail: 'Suppress phone and try email-only where deliverability is healthy.', action: 'Email-only branch' },
  ],
  forecastScenarios: [
    { label: 'Conservative', approvals: 24, aiTouches: 210, replies: 31, recovered: 12, value: 18400, confidence: 82 },
    { label: 'Base plan', approvals: 42, aiTouches: 390, replies: 58, recovered: 23, value: 35600, confidence: 76 },
    { label: 'Aggressive', approvals: 72, aiTouches: 680, replies: 96, recovered: 38, value: 58900, confidence: 62 },
  ],
  agentPerformance: [
    { agent: 'Louise Forshaw', recovered: 11, value: 28600, approvalRate: 91, handoverMins: 18, missed: 2, bestCohort: 'Quoted no touch', trend: [4, 5, 6, 7, 9, 11] },
    { agent: 'Jonny Green', recovered: 9, value: 21800, approvalRate: 87, handoverMins: 24, missed: 3, bestCohort: 'Won clients', trend: [3, 4, 5, 6, 7, 9] },
    { agent: 'Helen Sadler', recovered: 8, value: 19100, approvalRate: 84, handoverMins: 21, missed: 1, bestCohort: 'Contact repair', trend: [2, 3, 4, 6, 7, 8] },
    { agent: 'Dej A', recovered: 7, value: 17200, approvalRate: 79, handoverMins: 31, missed: 4, bestCohort: 'Getting prices', trend: [2, 3, 4, 4, 6, 7] },
  ],
  lifecycle: [
    { key: 'old-lead-revival', label: 'Old lead revival', stage: 'Recovery Engine', count: 291, value: 83500, conversionRate: 6.4, owner: 'Louise Forshaw', nextAction: 'Score and approve top 25 today', tone: 'good' },
    { key: 'won-client-growth', label: 'Won-client referrals', stage: 'Lifecycle Growth', count: 54, value: 29800, conversionRate: 9.1, owner: 'Jonny Green', nextAction: 'Approve warm referral asks', tone: 'good' },
    { key: 'contact-repair', label: 'Contact repair', stage: 'Contact Intelligence', count: 53, value: 22100, conversionRate: 6.6, owner: 'Helen Sadler', nextAction: 'Verify email-first repairs', tone: 'warn' },
    { key: 'ai-outreach', label: 'AI outreach operations', stage: 'AI Outreach Command', count: 1435, value: 59400, conversionRate: 4.1, owner: 'Dej A', nextAction: 'Review risky drafts', tone: 'info' },
    { key: 'dormant-vault', label: 'Dormant lead vault', stage: 'Dormant Vault', count: 612, value: 176000, conversionRate: 3.7, owner: 'Louise Forshaw', nextAction: 'Mine high-score dormant rows', tone: 'warn' },
  ],
  contactIntelligence: {
    signals: [
      { key: 'ip-region', label: 'IP region confidence', count: 92, repaired: 31, confidence: 78, region: 'North West + Midlands', note: 'Used only to support routing, never as a sole contact decision.' },
      { key: 'area-code', label: 'Phone area-code match', count: 74, repaired: 28, confidence: 81, region: 'London / South East', note: 'Combines area code, lead source and quote address.' },
      { key: 'email-typo', label: 'Email typo repair', count: 37, repaired: 19, confidence: 89, region: 'UK-wide', note: 'Domain typo fixes are approval-first and email-only.' },
      { key: 'duplicate-match', label: 'Duplicate lead match', count: 44, repaired: 22, confidence: 84, region: 'UK-wide', note: 'Matches name, email stem, postcode and transaction type.' },
      { key: 'fake-phone', label: 'Fake phone suppression', count: 29, repaired: 8, confidence: 76, region: 'Mixed', note: 'Phone is suppressed unless a stronger verified route exists.' },
    ],
    rules: [
      { label: 'Phone repair approval', impact: 'Blocks 11 risky calls', action: 'Require human approval before dial', tone: 'bad' },
      { label: 'Email-first fallback', impact: 'Saves 19 bad-number leads', action: 'Ask for best mobile by email', tone: 'good' },
      { label: 'IP + area support', impact: 'Improves map placement', action: 'Use as location confidence, not proof', tone: 'info' },
      { label: 'Duplicate identity match', impact: 'Merges 22 old enquiries', action: 'Link rows before outreach', tone: 'warn' },
    ],
  },
  dormantVault: [
    { leadId: 'lead-h14', lead: 'History Lead 15', bucket: 'Price objection', ageDays: 76, value: 1240, source: 'Comparison site', location: 'Birmingham', score: 82, lastSignal: 'Asked for updated fee', risk: 'low', nextAction: 'Send updated quote prompt', agent: 'Dej A' },
    { leadId: 'lead-h22', lead: 'History Lead 23', bucket: 'Quote reopened', ageDays: 19, value: 1340, source: 'Web form', location: 'Manchester', score: 80, lastSignal: 'Quote opened after 19 days', risk: 'low', nextAction: 'Same-day call task', agent: 'Jonny Green' },
    { leadId: 'lead-h31', lead: 'History Lead 32', bucket: 'Gone elsewhere', ageDays: 104, value: 840, source: 'Referral', location: 'Leeds', score: 55, lastSignal: 'No reply', risk: 'medium', nextAction: 'Quarterly help-first check-in', agent: 'Dej A' },
    { leadId: 'lead-h20', lead: 'History Lead 21', bucket: 'Email typo', ageDays: 33, value: 980, source: 'Comparison site', location: 'London', score: 87, lastSignal: 'Corrected domain likely', risk: 'medium', nextAction: 'Approve corrected email drip', agent: 'Dej A' },
    { leadId: 'lead-h41', lead: 'History Lead 42', bucket: 'Won client dormant', ageDays: 332, value: 960, source: 'Direct', location: 'Bristol', score: 68, lastSignal: 'Completed 11 months ago', risk: 'low', nextAction: 'Estate-agent referral ask', agent: 'Louise Forshaw' },
  ],
  advice: [
    { severity: 'high', title: 'Start with quoted-no-touch', text: 'It has the best recovery value and 11.2% conversion. Allocate agent tasks before adding more generic AI touches.' },
    { severity: 'high', title: 'Keep bad-number recovery approval-first', text: 'AI can find likely fixes, but repaired phone numbers should be reviewed by an agent before any call attempt.' },
    { severity: 'med', title: 'Train the call agent on winning human calls', text: 'Use old human call outcomes to pretrain scripts: price objection, timing-not-ready and quote rescue paths.' },
    { severity: 'med', title: 'Won clients should become a referral channel', text: 'The referral ask has a 31% reply rate. Treat completed matters as future pipeline, not closed history.' },
    { severity: 'low', title: 'Suppress before scaling', text: 'Keep unsubscribe, fake number and complaint-style signals visible so recovery never damages brand trust.' },
  ],
};

/* ----------------------- call intelligence (SOW gaps) — DEMO ONLY ----------------------- */
// Per-agent CRM Call-1/2/3 marking vs what 3CX actually recorded (SOW 4.6 accountability).
const CALL_VERIFICATION = {
  range: 'Yesterday',
  agents: [
    { agent: 'Louise Forshaw', marked: 84, verified: 76, markedNoMatch: 5, foundNotMarked: 8, mismatch: 3, verificationRate: 90 },
    { agent: 'Priya Shah', marked: 71, verified: 66, markedNoMatch: 3, foundNotMarked: 6, mismatch: 2, verificationRate: 93 },
    { agent: 'Sarah Okafor', marked: 76, verified: 64, markedNoMatch: 9, foundNotMarked: 4, mismatch: 3, verificationRate: 84 },
    { agent: 'Tom Bennett', marked: 47, verified: 41, markedNoMatch: 4, foundNotMarked: 2, mismatch: 0, verificationRate: 87 },
    { agent: 'James Okoro', marked: 58, verified: 39, markedNoMatch: 14, foundNotMarked: 3, mismatch: 2, verificationRate: 67 },
  ],
  note: 'James marked 14 calls with no matching 3CX record yesterday (24% of his marks). Worth a review before trusting his Call-1/2/3 figures.',
};
// Inbound Calls Overview, separate from outbound; IVR Option 1 (sales) vs Option 3 (post-sale).
const INBOUND_OVERVIEW = {
  kpis: [
    { label: 'Calls received', value: '142', sub: 'today', tone: 'info', deltaPct: 5, good: true },
    { label: 'Answered', value: '118', sub: '83%', tone: 'good', deltaPct: 3, good: true },
    { label: 'Missed', value: '18', sub: '13%', tone: 'warn', deltaPct: -2, good: true },
    { label: 'Speed to answer', value: '14s', sub: 'avg', tone: 'good', deltaPct: -9, good: true },
    { label: 'Became instructions', value: '9', sub: 'from inbound', tone: 'good', deltaPct: 12, good: true },
  ],
  optionSplit: { option1: 96, option3: 46 },
  outcome: [
    { label: 'Answered', count: 118 },
    { label: 'Missed', count: 18 },
    { label: 'Abandoned', count: 6 },
  ],
  byHour: [
    { hour: '8a', calls: 6 }, { hour: '9a', calls: 14 }, { hour: '10a', calls: 19 }, { hour: '11a', calls: 17 },
    { hour: '12p', calls: 11 }, { hour: '1p', calls: 8 }, { hour: '2p', calls: 15 }, { hour: '3p', calls: 18 },
    { hour: '4p', calls: 16 }, { hour: '5p', calls: 12 }, { hour: '6p', calls: 6 },
  ],
};
// Callback request → contacted → completed → quote-accepted → instructed (SOW 4.1).
const CALLBACK_FUNNEL = {
  range: 'Last 30 days',
  stages: [
    { label: 'Requested', count: 86 },
    { label: 'Contacted', count: 71 },
    { label: 'Completed', count: 58 },
    { label: 'Quote accepted', count: 31 },
    { label: 'Instructed', count: 22 },
  ],
  winRate: 26,
};
// One agent's full day — the SOW "Agent Dashboard & AI Coaching" (Option A) per-agent view.
const AGENT_DAY = {
  agent: 'Louise Forshaw',
  date: 'Yesterday',
  tiles: [
    { label: 'Assigned today', value: '6' }, { label: 'Active leads', value: '23' },
    { label: 'Unique attempted', value: '38' }, { label: 'Outbound calls', value: '84' },
    { label: 'Meaningful convos', value: '31' }, { label: 'Voicemail', value: '15' },
    { label: 'Contact rate', value: '74%' }, { label: 'Call 1 / 2 / 3', value: '30 / 22 / 14' },
    { label: 'Follow-ups due', value: '7' }, { label: 'High-intent', value: '5' },
    { label: 'Official instructions', value: '8' }, { label: 'Inbound Option 1', value: '12' },
  ],
  coaching: [
    { tone: 'good', text: 'Strong objection handling on the Comparing-Quotes calls — 4 of 5 turned around. Keep leading with value before price.' },
    { tone: 'warn', text: 'Missed the no-estate-agent USP on 3 purchase calls where it would have landed.' },
    { tone: 'bad', text: '2 calls ended with no clear next action — set a callback or task before hanging up.' },
  ],
  actions: [
    'Call back Karen Howe — promised a decision today',
    'Chase Folake Bello — quote accepted, not yet instructed',
    'Complete the overdue Call 3 for Chidi Okeke',
    'Follow up 5 high-intent leads not yet instructed',
  ],
};
// Instruction-report trends + period-over-period comparison (the "compare with the past"
// layer the snapshot report lacked) incl. SOW Sale/Purchase/Both unit counting.
const INSTRUCTION_INSIGHTS = {
  range: 'Last 30 days',
  kpis: [
    { label: 'Instruction units', value: '68', sub: 'vs 59 prior 30d', tone: 'good', deltaPct: 15, good: true },
    { label: 'Lead → instruction', value: '13.4%', sub: 'vs 11.9% prior', tone: 'good', deltaPct: 13, good: true },
    { label: 'Sale + Purchase (×2)', value: '11', sub: 'dual-unit instructions', tone: 'info', deltaPct: 10, good: true },
    { label: 'Avg / working day', value: '2.9', sub: 'vs 2.5 prior', tone: 'good', deltaPct: 16, good: true },
  ],
  trend: {
    labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }),
    current: [3, 2, 4, 3, 5, 2, 4, 3, 4, 5, 3, 6, 4, 5],
    prior: [2, 3, 2, 4, 2, 3, 3, 2, 4, 3, 2, 4, 3, 4],
  },
  unitSplit: [
    { label: 'Sale only (×1)', count: 24 },
    { label: 'Purchase only (×1)', count: 17 },
    { label: 'Sale + Purchase (×2)', count: 11 },
    { label: 'Remortgage (×1)', count: 5 },
  ],
  sourceMovers: [
    { label: 'Google Ads', now: 19, prev: 12, deltaPct: 58 },
    { label: 'The Move Exchange', now: 16, prev: 18, deltaPct: -11 },
    { label: 'Hoowla', now: 11, prev: 7, deltaPct: 57 },
    { label: 'Direct', now: 9, prev: 10, deltaPct: -10 },
    { label: 'Referral', now: 8, prev: 7, deltaPct: 14 },
  ],
};

// Finance — revenue trend, breakdown, KPIs vs prior + the APCM AI finance coach
// (set a monthly target → pace-to-target + pushy advice). DEMO ONLY.
const FINANCE_INSIGHTS = {
  month: 'June 2026',
  kpis: [
    { label: 'Revenue (MTD)', value: '£52.4k', sub: 'vs £47.8k same day last mo', tone: 'good', deltaPct: 10, good: true },
    { label: 'Collected', value: '£34.0k', sub: '65% of billed', tone: 'good', deltaPct: 5, good: true },
    { label: 'Outstanding', value: '£18.4k', sub: '3 invoices 30d+', tone: 'warn', deltaPct: -3, good: true },
    { label: 'Avg matter fee', value: '£1,180', sub: 'vs £1,120 last mo', tone: 'good', deltaPct: 5, good: true },
  ],
  revenue6mo: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [58200, 63100, 59800, 71200, 68400, 52400],
  },
  byType: [
    { label: 'Purchase', count: 24800 },
    { label: 'Sale', count: 18200 },
    { label: 'Sale & Purchase', count: 6900 },
    { label: 'Remortgage', count: 2500 },
  ],
  coach: {
    mtdRevenue: 52400,
    workingDaysElapsed: 15,
    workingDaysTotal: 22,
    lastMonthRevenue: 71200,
    defaultTarget: 80000,
    acceptedNotInstructed: { count: 5, value: 8600 },
    watching: [
      '5 accepted quotes not yet instructed — £8.6k of fees waiting on a signature',
      '£18.4k billed but unpaid — 3 invoices are over 30 days',
      'Purchase fees up 9% — your strongest margin line this month',
    ],
  },
};

// Comparison engine intelligence — which site performs, the quote-engine funnel, and
// where users get stuck (abandon). DEMO ONLY.
const COMPARISON_ENGINE = {
  range: 'Last 30 days',
  topSite: 'The Move Exchange',
  sites: [
    { site: 'The Move Exchange', started: 240, submitted: 142, callbacks: 38, instructions: 19, conversion: 13.4, avgQuote: 1180, deltaPct: 12 },
    { site: 'Cheap Conveyancing', started: 198, submitted: 98, callbacks: 21, instructions: 9, conversion: 9.2, avgQuote: 980, deltaPct: -6 },
    { site: 'Compare Conveyancing Prices', started: 174, submitted: 71, callbacks: 16, instructions: 8, conversion: 11.1, avgQuote: 1090, deltaPct: 8 },
  ],
  funnel: [
    { label: 'Started quote', count: 612 },
    { label: 'Entered details', count: 503 },
    { label: 'Saw quote', count: 411 },
    { label: 'Submitted lead', count: 311 },
    { label: 'Requested callback', count: 96 },
    { label: 'Instructed', count: 41 },
  ],
  stuck: [
    { step: 'Dropped at property details', count: 109, pct: 18 },
    { step: 'Left before seeing a quote', count: 92, pct: 15 },
    { step: 'Saw the quote, never submitted', count: 100, pct: 16 },
  ],
  trend: {
    labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }),
    current: [9, 11, 8, 12, 10, 13, 11, 14, 12, 13, 11, 16, 13, 15],
    prior: [8, 9, 7, 10, 8, 9, 10, 9, 11, 10, 9, 11, 10, 12],
  },
  note: 'The Move Exchange converts best (13.4%, ▲12%). But 16% who see a quote never submit — a "save / email me my quote" step could recover ~100 leads a month.',
};

// Matter / case progression — the post-instruction conveyancing pipeline (the biggest gap
// the demo had: it stopped at instruction). Stages, time-in-stage vs benchmark, SLA
// breaches, exchange/completion key dates, and fall-through trend. DEMO ONLY.
const MATTER_PROGRESSION = {
  range: 'Live',
  kpis: [
    { label: 'Active matters', value: '89', sub: 'in progress', tone: 'info', deltaPct: 6, good: true },
    { label: 'Avg to completion', value: '74d', sub: 'vs 81d last qtr', tone: 'good', deltaPct: -9, good: true },
    { label: 'Fall-through rate', value: '9.4%', sub: 'vs 11.2% last qtr', tone: 'good', deltaPct: -16, good: true },
    { label: 'Completing this month', value: '12', sub: 'forecast 15', tone: 'good', deltaPct: 20, good: true },
  ],
  stages: [
    { label: 'Instructed / opening', count: 18, medianDays: 3, benchmarkDays: 4 },
    { label: 'Searches ordered', count: 14, medianDays: 9, benchmarkDays: 10 },
    { label: 'Enquiries raised', count: 22, medianDays: 16, benchmarkDays: 14 },
    { label: 'Mortgage offer', count: 11, medianDays: 21, benchmarkDays: 20 },
    { label: 'Report & sign', count: 8, medianDays: 6, benchmarkDays: 7 },
    { label: 'Exchanged', count: 6, medianDays: 4, benchmarkDays: 5 },
    { label: 'Completed (this mo)', count: 12, medianDays: 0, benchmarkDays: 0 },
  ],
  slaBreaches: [
    { matter: 'Okeke purchase — 14 Elm Rd', stage: 'Enquiries', overdueDays: 6, owner: 'Louise' },
    { matter: 'Bello sale — 7 Oak Ave', stage: 'Searches', overdueDays: 4, owner: 'Sarah' },
    { matter: 'Khan remortgage — 22 Birch Cl', stage: 'Mortgage offer', overdueDays: 3, owner: 'James' },
    { matter: 'Owusu purchase — 9 Maple Dr', stage: 'Enquiries', overdueDays: 2, owner: 'Louise' },
  ],
  keyDates: [
    { matter: 'Chen remortgage', event: 'Completion', when: 'Overdue 1 day', rag: 'bad' },
    { matter: 'Howe purchase', event: 'Completion', when: 'In 2 days', rag: 'amber' },
    { matter: 'Adeyemi sale', event: 'Exchange', when: 'In 5 days', rag: 'good' },
    { matter: 'Mensah purchase', event: 'Exchange', when: 'In 6 days', rag: 'good' },
    { matter: 'Patel sale', event: 'Completion', when: 'In 8 days', rag: 'good' },
  ],
  fallThroughTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [12.1, 11.8, 10.9, 11.2, 10.1, 9.4] },
  fallThroughByType: [
    { label: 'Purchase', count: 11 }, { label: 'Sale', count: 7 }, { label: 'Sale & Purchase', count: 4 }, { label: 'Remortgage', count: 2 },
  ],
};

// Agent workspace — the LIVE AGENT view (role-scoped): the agent's own day, personal
// targets/pace, lead worklist, and their instructions. DEMO ONLY.
const AGENT_WORKSPACE = {
  agent: 'Louise Forshaw',
  day: AGENT_DAY,
  targets: {
    instructions: { mtd: 8, target: 12 },
    calls: { today: 84, target: 80 },
    conversion: { value: 14.2, target: 12.5 },
    rank: 2, of: 6,
    note: '4 instructions to target — you have 5 high-intent leads and 5 accepted quotes within reach. Clear those and you top the board.',
  },
  myLeads: [
    { name: 'Karen Howe', stage: 'Quote sent', priority: 'high', next: 'Promised a decision today — call back', value: 1180 },
    { name: 'Folake Bello', stage: 'Quote accepted', priority: 'high', next: 'Accepted — send the instruction pack', value: 1340 },
    { name: 'Chidi Okeke', stage: 'Contacted', priority: 'med', next: 'Overdue Call 3', value: 980 },
    { name: 'Sara Mensah', stage: 'New', priority: 'med', next: 'First call due in 20 min', value: 1100 },
    { name: 'Tom Reilly', stage: 'Quoted', priority: 'low', next: 'Follow up tomorrow', value: 890 },
  ],
  myInstructions: [
    { name: 'Grace Adeyemi', type: 'Sale & Purchase', units: 2, fee: 1840, at: '2 days ago' },
    { name: 'Daniel Park', type: 'Purchase', units: 1, fee: 1180, at: '4 days ago' },
    { name: 'Aisha Khan', type: 'Remortgage', units: 1, fee: 720, at: '6 days ago' },
  ],
};

// Conversations — the ManyChat-style unified inbox: WhatsApp/SMS/email/web chat history
// per lead + how inquiries enter (channel mix). DEMO ONLY.
const CONVERSATIONS = {
  channelMix: [
    { label: 'Web form', count: 142 }, { label: 'Comparison site', count: 118 }, { label: 'Phone', count: 96 }, { label: 'WhatsApp', count: 84 }, { label: 'Email', count: 61 }, { label: 'Recovery Engine', count: 53 },
  ],
  threads: [
    { id: 't1', name: 'Karen Howe', channel: 'whatsapp', intent: 'Purchase quote', last: 'Yes that works, what next?', at: '4m', unread: 2, status: 'open', agent: 'Louise Forshaw', responseMins: 4, converted: false },
    { id: 't2', name: 'Folake Bello', channel: 'whatsapp', intent: 'Quote accepted', last: 'I will sign tonight', at: '1h', unread: 0, status: 'open', agent: 'Louise Forshaw', responseMins: 6, converted: true },
    { id: 't3', name: 'Tom Reilly', channel: 'sms', intent: 'Remortgage', last: 'Can you call me?', at: '3h', unread: 1, status: 'open', agent: 'Priya Shah', responseMins: 12, converted: false },
    { id: 't4', name: 'Sara Mensah', channel: 'email', intent: 'Sale quote', last: 'Thanks for the quote', at: '5h', unread: 0, status: 'open', agent: 'Sarah Okafor', responseMins: 22, converted: false },
    { id: 't5', name: 'Daniel Park', channel: 'web', intent: 'Purchase enquiry', last: 'Submitted via comparison site', at: '1d', unread: 0, status: 'closed', agent: 'James Okoro', responseMins: 35, converted: true },
    { id: 't6', name: 'Aisha Bello', channel: 'email', intent: 'Recovery: wrong number repair', last: 'Yes, this is my correct email. Please resend the quote.', at: '28m', unread: 1, status: 'open', agent: 'Helen Sadler', responseMins: 8, converted: false },
    { id: 't7', name: 'Sarah Pearse', channel: 'email', intent: 'Recovery: won-client referral', last: 'Happy to pass your details to my brother.', at: '2h', unread: 1, status: 'open', agent: 'Jonny Green', responseMins: 7, converted: true },
    { id: 't8', name: 'History Lead 23', channel: 'sms', intent: 'Recovery: quote rescue', last: 'Still interested, can someone call tomorrow?', at: '4h', unread: 2, status: 'open', agent: 'Dej A', responseMins: 11, converted: false },
  ],
  assignableAgents: ['Louise Forshaw', 'Priya Shah', 'Sarah Okafor', 'James Okoro'],
  stats: {
    kpis: [
      { label: 'Open conversations', value: '23', sub: '5 unassigned', tone: 'info', deltaPct: 8, good: true },
      { label: 'Avg first response', value: '6m', sub: 'vs 11m last wk', tone: 'good', deltaPct: -45, good: true },
      { label: 'Within 10-min SLA', value: '78%', sub: 'of conversations', tone: 'good', deltaPct: 12, good: true },
      { label: 'Chat → instruction', value: '16%', sub: 'conversion', tone: 'good', deltaPct: 9, good: true },
      { label: 'Recovery replies', value: '53', sub: 'from old/lost leads', tone: 'good', deltaPct: 18, good: true },
    ],
    byAgent: [
      { agent: 'Louise Forshaw', handled: 38, avgResponseMins: 5, conversion: 18 },
      { agent: 'Priya Shah', handled: 31, avgResponseMins: 7, conversion: 15 },
      { agent: 'Sarah Okafor', handled: 27, avgResponseMins: 9, conversion: 12 },
      { agent: 'James Okoro', handled: 22, avgResponseMins: 14, conversion: 8 },
    ],
  },
  messages: {
    t1: [
      { from: 'lead', text: 'Hi, I got a quote on The Move Exchange for my purchase', at: '10:02' },
      { from: 'agent', text: 'Hi Karen! Yes I can see it — £1,180 all in for a £320k purchase. Happy to talk it through.', at: '10:05' },
      { from: 'lead', text: 'Great. Does that include searches?', at: '10:09' },
      { from: 'agent', text: 'It does — searches, SDLT handling and Land Registry are all included. No hidden extras.', at: '10:11' },
      { from: 'lead', text: 'Yes that works, what next?', at: '10:14' },
    ],
    t2: [
      { from: 'agent', text: 'Hi Folake, your quote is accepted — I will send the instruction pack now.', at: '09:20' },
      { from: 'lead', text: 'Perfect, thank you', at: '09:34' },
      { from: 'lead', text: 'I will sign tonight', at: '09:35' },
    ],
    t3: [
      { from: 'lead', text: 'Looking to remortgage, can you help?', at: '08:50' },
      { from: 'agent', text: 'Of course — what is the property value and current lender?', at: '08:58' },
      { from: 'lead', text: 'Can you call me?', at: '09:12' },
    ],
    t4: [
      { from: 'agent', text: 'Hi Sara, here is your sale quote — £980 all in.', at: 'Yesterday' },
      { from: 'lead', text: 'Thanks for the quote', at: 'Yesterday' },
    ],
    t5: [
      { from: 'lead', text: 'Submitted via comparison site', at: '2 days ago' },
      { from: 'agent', text: 'Thanks for your enquiry — I will be in touch shortly.', at: '2 days ago' },
    ],
    t6: [
      { from: 'agent', text: 'Hi Aisha, we could not reach you by phone, so I am checking by email before closing this quote request.', at: '10:18' },
      { from: 'lead', text: 'Yes, this is my correct email. Please resend the quote.', at: '10:46' },
    ],
    t7: [
      { from: 'agent', text: 'I hope you are settled in. If a friend or family member needs conveyancing, I can make sure they are looked after quickly.', at: '09:20' },
      { from: 'lead', text: 'Happy to pass your details to my brother.', at: '11:05' },
    ],
    t8: [
      { from: 'agent', text: 'I noticed you had another look at the quote. Do you want me to check whether it still matches your purchase details?', at: '08:44' },
      { from: 'lead', text: 'Still interested, can someone call tomorrow?', at: '12:03' },
    ],
  },
};

// Revenue boost — money on the table: recovery opportunities, revenue at risk, upsell,
// and WIP/lockup aging. The "what would boost financial stuffs" layer. DEMO ONLY.
const REVENUE_OPPORTUNITIES = {
  summary: { recoverable: 54400, atRisk: 14160, lockupDays: 58, lockupTarget: 45 },
  recovery: [
    { label: 'Accepted, not instructed', count: 5, value: 8600, action: 'Send the instruction packs today', tone: 'good' },
    { label: 'Quotes accepted >7 days ago', count: 3, value: 4200, action: 'Chase the signatures', tone: 'warn' },
    { label: 'Abandoned quotes (saw price, left)', count: 100, value: 14000, action: 'Email a "save my quote" follow-up', tone: 'warn' },
    { label: 'Aged unpaid invoices (30d+)', count: 3, value: 18400, action: 'Send payment reminders', tone: 'bad' },
    { label: 'Expired quotes to re-issue', count: 8, value: 9200, action: 'Re-quote with updated pricing', tone: 'warn' },
  ],
  atRisk: [
    { label: 'Fall-through risk (stalled 14d+)', count: 6, value: 7080, note: 'Past stage benchmark' },
    { label: 'Overdue completions', count: 2, value: 2360, note: 'Past committed date' },
    { label: 'Enquiries unanswered 5d+', count: 4, value: 4720, note: 'Other side waiting' },
  ],
  upsell: [
    { label: 'Remortgage clients due to switch', count: 7, value: 5040, note: 'Fixed rate ending within 90 days' },
    { label: 'Past sale clients likely to buy', count: 11, value: 12980, note: 'Sold 6–12mo ago, no purchase yet' },
    { label: 'Repeat / referral candidates', count: 18, value: 0, note: 'NPS 9–10 — ask for a referral' },
  ],
  wip: [
    { label: '0–30 days', value: 40120 },
    { label: '30–60 days', value: 25960 },
    { label: '60–90 days', value: 16520 },
    { label: '90+ days', value: 10620 },
  ],
};

// Compliance & onboarding — ID/AML/SoF gates, KYC completeness, risk flags, file-review
// pass rate. The SOW Phase-3 + ideation onboarding-risk gap. DEMO ONLY.
const COMPLIANCE = {
  kpis: [
    { label: 'ID verified', value: '80%', sub: '71 of 89 matters', tone: 'good', deltaPct: 4, good: true },
    { label: 'AML / SoF clear', value: '71%', sub: '63 of 89', tone: 'warn', deltaPct: 6, good: true },
    { label: 'File-review pass', value: '94%', sub: 'vs 90% last qtr', tone: 'good', deltaPct: 4, good: true },
    { label: 'Open risk flags', value: '5', sub: '2 high severity', tone: 'bad', deltaPct: -1, good: true },
  ],
  onboardingFunnel: [
    { label: 'Instructed', count: 89 },
    { label: 'ID requested', count: 84 },
    { label: 'ID verified (Yoti)', count: 71 },
    { label: 'Source of funds', count: 63 },
    { label: 'KYC complete', count: 58 },
    { label: 'Cleared to proceed', count: 54 },
  ],
  stuck: [
    { label: 'Awaiting ID upload', count: 13 },
    { label: 'Source-of-funds docs outstanding', count: 8 },
    { label: 'KYC review pending', count: 5 },
  ],
  riskFlags: [
    { matter: 'Volkov purchase — 3 Cedar Ct', flag: 'High-risk jurisdiction (source of funds)', severity: 'high', owner: 'James' },
    { matter: 'Adelaja sale — 18 Pine Rd', flag: 'PEP match — enhanced due diligence', severity: 'high', owner: 'Louise' },
    { matter: 'Webb remortgage — 5 Ash Ln', flag: 'ID document expired', severity: 'med', owner: 'Sarah' },
    { matter: 'Nkemelu purchase — 41 Fir Ave', flag: 'Source of funds unclear', severity: 'med', owner: 'James' },
    { matter: 'Cole sale — 12 Birch Way', flag: 'Address mismatch on ID', severity: 'low', owner: 'Tom' },
  ],
  passRateTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [88, 90, 89, 91, 92, 94] },
};

// Lead resale — selling surplus / out-of-area / unconverted / declined leads to partner
// firms as a new revenue line. Admin pipeline, buyers, inventory, profit. DEMO ONLY.
// NOTE: only consented "happy to be contacted by partners" leads are sellable (GDPR).
const LEAD_RESALE = {
  kpis: [
    { label: 'Leads sold (30d)', value: '142', sub: 'vs 118 prior', tone: 'good', deltaPct: 20, good: true },
    { label: 'Resale revenue', value: '£4.3k', sub: 'this month', tone: 'good', deltaPct: 18, good: true },
    { label: 'Avg price / lead', value: '£30', sub: 'vs £26 prior', tone: 'good', deltaPct: 15, good: true },
    { label: 'Gross margin', value: '82%', sub: 'on otherwise-wasted leads', tone: 'good', deltaPct: 3, good: true },
  ],
  pipeline: [
    { label: 'Available to sell', count: 210 },
    { label: 'Offered to buyers', count: 168 },
    { label: 'Agreed / sold', count: 142 },
    { label: 'Delivered', count: 138 },
    { label: 'Paid', count: 121 },
  ],
  inventory: [
    { label: 'Out-of-area (cannot service)', count: 64 },
    { label: 'Unconverted after 30 days', count: 71 },
    { label: 'Wrong matter type', count: 38 },
    { label: 'Declined our quote', count: 37 },
  ],
  buyers: [
    { name: 'Conveyancing Direct Ltd', leadsBought: 58, spend: 1740, avgPrice: 30, rating: 'A', status: 'active' },
    { name: 'MoveFast Solicitors', leadsBought: 41, spend: 1435, avgPrice: 35, rating: 'A', status: 'active' },
    { name: 'PropertyLeads CRM', leadsBought: 28, spend: 700, avgPrice: 25, rating: 'B', status: 'active' },
    { name: 'Regional Law Group', leadsBought: 15, spend: 525, avgPrice: 35, rating: 'B', status: 'paused' },
  ],
  byType: [
    { label: 'Purchase', count: 58 }, { label: 'Sale', count: 44 }, { label: 'Remortgage', count: 24 }, { label: 'Sale & Purchase', count: 16 },
  ],
  revenueTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [2100, 2600, 2900, 3400, 3650, 4300] },
  note: 'Only leads consented at capture to "be contacted by partner firms" are sellable (GDPR explicit consent). These are out-of-area, wrong-type, unconverted and declined-quote leads that would otherwise be wasted — ~82% margin. Keep delivery exclusive (one buyer per lead) to protect price and reputation.',
};

// Lead-resale ELIGIBILITY QUEUE — the admin operational page: sellable leads with reason
// bucket, region, freshness, quality, consent gate, computed price + matched buyers. DEMO.
const RESALE_QUEUE = {
  buckets: [
    { key: 'all', label: 'All sellable', count: 210 },
    { key: 'out_of_area', label: 'Out of area', count: 64 },
    { key: 'unconverted', label: 'Unconverted', count: 71 },
    { key: 'wrong_type', label: 'Wrong type', count: 38 },
    { key: 'declined', label: 'Declined quote', count: 37 },
  ],
  leads: [
    { id: 'q1', ref: 'CL-2041', initials: 'K.H.', reason: 'out_of_area', region: 'Manchester M20', matter: 'Purchase', value: 320000, freshnessHrs: 6, quality: 88, consent: true, price: 38, exclusivity: 'unsold', matchedBuyers: ['Conveyancing Direct Ltd', 'MoveFast Solicitors'] },
    { id: 'q2', ref: 'CL-2038', initials: 'T.R.', reason: 'wrong_type', region: 'Leeds LS1', matter: 'Commercial', value: 0, freshnessHrs: 20, quality: 72, consent: true, price: 22, exclusivity: 'unsold', matchedBuyers: ['Regional Law Group'] },
    { id: 'q3', ref: 'CL-2035', initials: 'S.M.', reason: 'unconverted', region: 'Bristol BS8', matter: 'Sale', value: 285000, freshnessHrs: 72, quality: 64, consent: true, price: 18, exclusivity: 'unsold', matchedBuyers: ['PropertyLeads CRM', 'MoveFast Solicitors'] },
    { id: 'q4', ref: 'CL-2031', initials: 'D.P.', reason: 'declined', region: 'Birmingham B15', matter: 'Remortgage', value: 210000, freshnessHrs: 96, quality: 51, consent: false, price: 0, exclusivity: 'blocked', matchedBuyers: [] },
    { id: 'q5', ref: 'CL-2029', initials: 'A.K.', reason: 'out_of_area', region: 'Glasgow G12', matter: 'Purchase', value: 240000, freshnessHrs: 10, quality: 81, consent: true, price: 35, exclusivity: 'unsold', matchedBuyers: ['Conveyancing Direct Ltd'] },
    { id: 'q6', ref: 'CL-2024', initials: 'F.B.', reason: 'unconverted', region: 'Sheffield S10', matter: 'Sale', value: 175000, freshnessHrs: 120, quality: 58, consent: true, price: 12, exclusivity: 'unsold', matchedBuyers: ['PropertyLeads CRM'] },
    { id: 'q7', ref: 'CL-2019', initials: 'J.O.', reason: 'wrong_type', region: 'Cardiff CF10', matter: 'Probate', value: 0, freshnessHrs: 48, quality: 69, consent: true, price: 20, exclusivity: 'listed', matchedBuyers: ['Regional Law Group'] },
    { id: 'q8', ref: 'CL-2014', initials: 'M.E.', reason: 'out_of_area', region: 'Liverpool L1', matter: 'Sale & Purchase', value: 410000, freshnessHrs: 4, quality: 91, consent: true, price: 46, exclusivity: 'unsold', matchedBuyers: ['Conveyancing Direct Ltd', 'MoveFast Solicitors', 'PropertyLeads CRM'] },
    { id: 'q9', ref: 'CL-2008', initials: 'C.O.', reason: 'declined', region: 'Nottingham NG1', matter: 'Purchase', value: 198000, freshnessHrs: 144, quality: 44, consent: true, price: 8, exclusivity: 'unsold', matchedBuyers: ['PropertyLeads CRM'] },
    { id: 'q10', ref: 'CL-2003', initials: 'W.C.', reason: 'unconverted', region: 'Newcastle NE1', matter: 'Remortgage', value: 160000, freshnessHrs: 96, quality: 55, consent: true, price: 14, exclusivity: 'sold', matchedBuyers: ['MoveFast Solicitors'] },
  ],
};

// Integrations & ops health — feed freshness, sync health, CRM-vs-3CX reconciliation,
// automation success, data completeness/duplicates. Catches silent failures. DEMO ONLY.
const OPS_HEALTH = {
  kpis: [
    { label: 'Integrations healthy', value: '7/8', sub: '1 degraded', tone: 'warn', deltaPct: 0, good: true },
    { label: 'Data completeness', value: '92%', sub: 'vs 88% last mo', tone: 'good', deltaPct: 5, good: true },
    { label: 'Automations (24h)', value: '98.2%', sub: 'success rate', tone: 'good', deltaPct: 1, good: true },
    { label: '3CX feed', value: 'Fresh', sub: 'synced 4m ago', tone: 'good', deltaPct: 0, good: true },
  ],
  integrations: [
    { name: '3CX (calls)', status: 'healthy', lastSync: '4m ago', note: 'Real-time webhook' },
    { name: 'HMLR / Land Registry', status: 'healthy', lastSync: '1h ago', note: 'Searches OK' },
    { name: 'Search provider', status: 'healthy', lastSync: '20m ago', note: '' },
    { name: 'Lender panel', status: 'healthy', lastSync: '2h ago', note: '' },
    { name: 'Yoti (ID / AML)', status: 'healthy', lastSync: '12m ago', note: '' },
    { name: 'Email deliverability', status: 'degraded', lastSync: '8m ago', note: 'Spam rate elevated' },
    { name: 'Comparison-sites feed', status: 'healthy', lastSync: '6m ago', note: '' },
    { name: 'Accounting (Xero)', status: 'healthy', lastSync: '1d ago', note: 'Nightly sync' },
  ],
  dataGaps: [
    { label: 'Leads missing source / UTM', count: 14 },
    { label: 'Matters missing key dates', count: 9 },
    { label: 'Contacts missing phone', count: 6 },
    { label: 'Duplicate leads to merge', count: 4 },
  ],
  reconTrend: { labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }), values: [94, 95, 93, 96, 95, 97, 96, 95, 97, 98, 96, 97, 98, 97] },
  errorTrend: { labels: Array.from({ length: 14 }, (_, i) => { const d = new Date(D.getTime() - (13 - i) * 86400000); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }), values: [6, 4, 5, 3, 4, 2, 3, 5, 2, 1, 3, 2, 4, 2] },
};

// Client experience — NPS/CSAT, update cadence vs promise, review funnel, complaints,
// referrals & repeat. DEMO ONLY (all reused chart components).
const CLIENT_EXPERIENCE = {
  kpis: [
    { label: 'NPS', value: '+62', sub: 'vs +54 last qtr', tone: 'good', deltaPct: 15, good: true },
    { label: 'CSAT', value: '4.6/5', sub: '218 responses', tone: 'good', deltaPct: 4, good: true },
    { label: 'Avg update gap', value: '3.1d', sub: 'promised every 5d', tone: 'good', deltaPct: -12, good: true },
    { label: 'Open complaints', value: '2', sub: '1 overdue', tone: 'warn', deltaPct: -1, good: true },
  ],
  npsTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [48, 52, 54, 57, 59, 62] },
  reviewFunnel: [
    { label: 'Asked for a review', count: 142 },
    { label: 'Opened the request', count: 98 },
    { label: 'Left a review', count: 61 },
    { label: '5-star reviews', count: 48 },
  ],
  cadence: [
    { label: 'On promised cadence', count: 71 },
    { label: 'Slightly behind', count: 14 },
    { label: 'Overdue an update', count: 6 },
  ],
  referrals: [
    { label: 'Referrals received', count: 23 },
    { label: 'Repeat clients', count: 11 },
    { label: 'Review → new enquiry', count: 9 },
  ],
  complaints: [
    { client: 'Mr & Mrs Dunne — 8 Rowan Cl', issue: 'Slow response on enquiries', age: '5 days', severity: 'high' },
    { client: 'Ms Adebayo — 14 Larch Rd', issue: 'Unclear on completion date', age: '2 days', severity: 'med' },
  ],
};

// Sales velocity — how fast deals move and why they win/lose: stage durations, win/loss
// reasons, conversion-by-lead-age, and the lead→instruction time trend. DEMO ONLY (reuse).
const SALES_VELOCITY = {
  kpis: [
    { label: 'Lead → instruction', value: '11.2d', sub: 'vs 13.8d last qtr', tone: 'good', deltaPct: -19, good: true },
    { label: 'Quote → accept', value: '3.4d', sub: 'vs 4.1d', tone: 'good', deltaPct: -17, good: true },
    { label: 'Win rate', value: '34%', sub: 'of quotes sent', tone: 'good', deltaPct: 8, good: true },
    { label: 'Pipeline velocity', value: '£62k/wk', sub: 'weighted', tone: 'good', deltaPct: 12, good: true },
  ],
  stageDays: [
    { label: 'New → contacted', count: 1 },
    { label: 'Contacted → quoted', count: 3 },
    { label: 'Quoted → accepted', count: 3 },
    { label: 'Accepted → instructed', count: 4 },
  ],
  winReasons: [
    { label: 'Price competitive', count: 38 },
    { label: 'Fast response', count: 29 },
    { label: 'Recommended / reviews', count: 18 },
    { label: 'No estate-agent tie-in', count: 14 },
  ],
  lossReasons: [
    { label: 'Price too high', count: 31 },
    { label: 'Went with a comparison rival', count: 22 },
    { label: 'Too slow to respond', count: 13 },
    { label: 'Chose own solicitor', count: 11 },
  ],
  conversionByAge: [
    { label: '0–1 day', count: 24 },
    { label: '2–3 days', count: 16 },
    { label: '4–7 days', count: 9 },
    { label: '8+ days', count: 4 },
  ],
  velocityTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [14.1, 13.8, 13.2, 12.5, 11.9, 11.2] },
};

// Capacity & workload — demand vs capacity, caseload balance per fee-earner, and where
// matters pile up (bottleneck stage). DEMO ONLY (reuse).
const CAPACITY = {
  kpis: [
    { label: 'Capacity used', value: '86%', sub: 'firm-wide', tone: 'warn', deltaPct: 4, good: false },
    { label: 'Open vs capacity', value: '89 / 105', sub: 'matters', tone: 'good', deltaPct: 6, good: true },
    { label: 'Avg caseload', value: '18', sub: 'per fee-earner', tone: 'info', deltaPct: 3, good: true },
    { label: 'Bottleneck stage', value: 'Enquiries', sub: '22 matters stuck', tone: 'bad', deltaPct: 0, good: true },
  ],
  byFeeEarner: [
    { label: 'Louise Forshaw (cap 22)', count: 23 },
    { label: 'Sarah Okafor (cap 22)', count: 21 },
    { label: 'James Okoro (cap 20)', count: 19 },
    { label: 'Priya Shah (cap 20)', count: 16 },
    { label: 'Tom Bennett (cap 18)', count: 10 },
  ],
  demandVsCapacity: {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    demand: [16, 18, 17, 21, 19, 22, 20, 24],
    capacity: [20, 20, 20, 20, 21, 21, 21, 21],
  },
  bottlenecks: [
    { label: 'Enquiries', count: 22 },
    { label: 'Searches', count: 14 },
    { label: 'Mortgage offer', count: 11 },
    { label: 'Report & sign', count: 8 },
  ],
  note: 'Demand has topped capacity for 3 of the last 4 weeks — backlog is building at the Enquiries stage. Louise and Sarah are over their caseload cap; Tom has room. Rebalance or add cover.',
};

// Forecast — lead-volume, instruction and revenue projections with confidence bands
// (trailing run-rate + seasonal index). DEMO ONLY.
const FORECAST = {
  kpis: [
    { label: 'Instructions (Jul)', value: '58', sub: '±6 · 52 actual Jun', tone: 'good', deltaPct: 12, good: true },
    { label: 'Revenue (Jul)', value: '£74k', sub: '±£8k forecast', tone: 'good', deltaPct: 9, good: true },
    { label: 'Completions (Jul)', value: '16', sub: 'from pipeline', tone: 'good', deltaPct: 14, good: true },
    { label: 'Lead volume (Jul)', value: '240', sub: '+8% seasonal', tone: 'good', deltaPct: 8, good: true },
  ],
  instructions: {
    labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    actual: [44, 47, 49, 51, 52, null, null, null],
    forecast: [null, null, null, null, 52, 58, 61, 57],
    lower: [null, null, null, null, 52, 52, 53, 49],
    upper: [null, null, null, null, 52, 64, 69, 65],
  },
  revenue: {
    labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    actual: [58, 63, 60, 71, 68, null, null, null],
    forecast: [null, null, null, null, 68, 74, 78, 73],
    lower: [null, null, null, null, 68, 66, 68, 63],
    upper: [null, null, null, null, 68, 82, 88, 83],
  },
  leadVolume: {
    labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    actual: [198, 212, 221, 218, 222, null, null, null],
    forecast: [null, null, null, null, 222, 240, 252, 234],
    lower: [null, null, null, null, 222, 224, 232, 214],
    upper: [null, null, null, null, 222, 256, 272, 254],
  },
  note: 'Seasonal uplift expected into July–August (the spring/summer moving peak). Pre-book fee-earner capacity now — current demand already tops capacity.',
};

// Best time to call — day×hour timing intelligence keyed on PICKUP RATE (not just volume),
// filterable by window (7d / 30d / 3 months), with the call-vs-pickup mismatch. DEMO ONLY.
const TIMING = (() => {
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hourPickup: Record<number, number> = { 8: 42, 9: 64, 10: 84, 11: 78, 12: 55, 13: 48, 14: 70, 15: 75, 16: 71, 17: 58, 18: 44 };
  const hourVol: Record<number, number> = { 8: 0.5, 9: 0.9, 10: 1.0, 11: 0.85, 12: 0.5, 13: 0.6, 14: 1.05, 15: 1.0, 16: 0.9, 17: 0.7, 18: 0.45 };
  const dayMult: Record<string, number> = { Mon: 1.0, Tue: 1.05, Wed: 0.97, Thu: 1.0, Fri: 0.9, Sat: 0.45, Sun: 0.4 };
  const dayVol: Record<string, number> = { Mon: 1.0, Tue: 1.1, Wed: 0.85, Thu: 0.82, Fri: 0.8, Sat: 0.06, Sun: 0.05 };
  const hourLabel = (h: number) => (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`);
  const build = (callBase: number) => {
    const grid = DAYS.map((day) => ({
      day,
      cells: HOURS.map((h) => {
        const calls = Math.max(0, Math.round(callBase * dayVol[day] * hourVol[h]));
        const pickup = Math.min(98, Math.round(hourPickup[h] * dayMult[day]));
        const connected = Math.round((calls * pickup) / 100);
        return { calls, connected, pickup };
      }),
    }));
    const pickupByHour = HOURS.map((h, hi) => {
      let c = 0, k = 0;
      grid.forEach((g) => { c += g.cells[hi].calls; k += g.cells[hi].connected; });
      return { hour: hourLabel(h), pickup: c ? Math.round((k / c) * 100) : 0, calls: c };
    });
    const pickupByDay = grid.map((g) => {
      const c = g.cells.reduce((s, x) => s + x.calls, 0);
      const k = g.cells.reduce((s, x) => s + x.connected, 0);
      return { day: g.day, pickup: c ? Math.round((k / c) * 100) : 0, calls: c };
    });
    const bestHour = [...pickupByHour].filter((p) => p.calls >= 5).sort((a, b) => b.pickup - a.pickup)[0] || pickupByHour[0];
    const busiestHour = [...pickupByHour].sort((a, b) => b.calls - a.calls)[0];
    return { hours: HOURS.map(hourLabel), grid, pickupByHour, pickupByDay, bestHour, busiestHour };
  };
  return {
    days: DAYS,
    bestWindow: 'Tue–Thu 10–11am',
    note: 'Leads pick up most 10–11am and 2–4pm, Tue–Thu. You dial most at 2pm but the 10am window connects ~14pp better — shift early-day calls earlier to lift connect rate.',
    byRange: { '7d': build(16), '30d': build(60), '3mo': build(180) },
  };
})();

// Call insights — AI conversation analytics: every analysed call grouped into clickable
// signals (topic / impact / objection / blocker / guidance); each opens the calls behind
// it (which agent, which lead, the exact words, an AI note, a trend). DEMO ONLY.
const CALL_INSIGHTS = {
  kpis: [
    { label: 'Calls to hand', value: '1,000', sub: '554 analysed', tone: 'info', deltaPct: 0, good: true },
    { label: 'Analysed', value: '55%', sub: '554 transcripts', tone: 'good', deltaPct: 6, good: true },
    { label: 'Sales calls', value: '514', sub: 'pre-deposit + enquiries', tone: 'info', deltaPct: 4, good: true },
    { label: 'Substantive', value: '284', sub: 'real conversations', tone: 'good', deltaPct: 8, good: true },
  ],
  withWho: [{ label: 'Sales', count: 93 }, { label: 'Live file', count: 7 }],
  howLanded: [{ label: 'Substantive', count: 51 }, { label: 'Brief check-in', count: 17 }, { label: 'Voicemail', count: 26 }, { label: 'No answer', count: 6 }],
  groups: [
    {
      key: 'topics', title: 'Primary topic mix', caption: 'click a topic for the calls behind it', tone: 'navy',
      items: [
        { key: 'vm', label: 'Voicemail Left', count: 165, calls: 165, trend: [22, 26, 24, 28, 30, 35], sample: [
          { agent: 'Dej A', lead: 'Annie Gerald-Webb', date: '18 Jun', quote: 'Hi, this is Dej from APCM — give me a call back when you can.', note: 'Auto-logged voicemail. Trigger the day-2 follow-up SMS.' },
          { agent: 'Jonny Green', lead: 'Philip Blundred', date: '16 Jun', quote: 'Tried you a couple of times — happy to talk the quote through.', note: 'Third VM on this lead; switch channel to email + WhatsApp.' },
        ] },
        { key: 'na', label: 'No Answer', count: 157, calls: 157, trend: [20, 24, 26, 23, 28, 30], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '15 Jun', quote: 'No answer — line rang out.', note: 'Best-time-to-call: this lead picks up ~10am, dialled at 4pm.' },
        ] },
        { key: 'fpu', label: 'File Progress Update', count: 112, calls: 112, trend: [14, 16, 18, 17, 20, 22], sample: [
          { agent: 'Dej A', lead: 'Nicola Caddick', date: '15 Jun', quote: 'Searches are back, we are waiting on the lender now.', note: 'Live-file call; blocker = Waiting On Lender. Surface on the matter.' },
        ] },
        { key: 'dc', label: 'Document Chase', count: 88, calls: 88, trend: [10, 12, 11, 14, 15, 16], sample: [
          { agent: 'Jonny Green', lead: 'Diane Thomas', date: '15 Jun', quote: 'We still need your ID and proof of funds to proceed.', note: 'Outstanding KYC docs — link to the compliance onboarding queue.' },
        ] },
        { key: 'ic', label: 'Internal Coordination', count: 85, calls: 85, trend: [12, 13, 12, 14, 15, 15], sample: [
          { agent: 'Dej A', lead: '—', date: '12 Jun', quote: 'Can you check with the head of sales and I will find out for you.', note: 'Internal call — excluded from outbound sales metrics.' },
        ] },
        { key: 'qd', label: 'Quote Discussion', count: 64, calls: 64, trend: [9, 10, 11, 10, 12, 13], sample: [
          { agent: 'Dej A', lead: 'Barry Pudney', date: '10 Jun', quote: 'It is £1,180 all in for the purchase — searches and SDLT handling included.', note: 'Price-sensitive; lead with value before number.' },
        ] },
        { key: 'qual', label: 'Qualification', count: 57, calls: 57, trend: [8, 9, 9, 10, 11, 11], sample: [
          { agent: 'Jonny Green', lead: 'Katherine Smith', date: '10 Jun', quote: 'And is this a freehold or leasehold sale?', note: 'Good qualification — property type captured.' },
        ] },
        { key: 'fuci', label: 'Follow Up Check In', count: 50, calls: 50, trend: [6, 7, 8, 8, 9, 10], sample: [
          { agent: 'Helen Sadler', lead: 'Elizabeth Pearce', date: '11 Jun', quote: 'Just checking in before you go on holiday — where are we up to?', note: 'Timing-sensitive; client travelling. Set a hard callback.' },
        ] },
      ],
    },
    {
      key: 'impact', title: 'Call impact', caption: 'positive or negative — click to read why', tone: 'good',
      items: [
        { key: 'neu', label: 'Neutral', count: 389, calls: 389, trend: [60, 62, 61, 64, 63, 65], sample: [
          { agent: 'Jonny Green', lead: 'Anne', date: '8 Jun', quote: 'I am not quite ready yet.', note: 'Neutral close; no commitment but no objection. Nurture.' },
        ] },
        { key: 'pos', label: 'Positive', count: 128, sentiment: 0.51, calls: 128, trend: [18, 20, 22, 21, 24, 26], sample: [
          { agent: 'Dej A', lead: 'Rebecca Wasey', date: '9 Jun', quote: 'That works for me, what do we do next?', note: 'Buying signal — send the instruction pack immediately.' },
        ] },
        { key: 'neg', label: 'Negative', count: 32, sentiment: -0.41, calls: 32, trend: [7, 6, 6, 5, 5, 4], sample: [
          { agent: 'Jonny Green', lead: 'Martin Sach', date: '4 Jun', quote: 'Not right now. No.', note: 'Hard no; mark disposition + suppress for 30 days.' },
        ] },
        { key: 'vpos', label: 'Very Positive', count: 19, sentiment: 0.74, calls: 19, trend: [2, 3, 3, 4, 3, 4], sample: [
          { agent: 'Dej A', lead: 'Francine Lewis', date: '3 Jun', quote: 'Brilliant, you have been really helpful — let us get going.', note: 'Champion client; ask for a review after completion.' },
        ] },
        { key: 'vneg', label: 'Very Negative', count: 2, sentiment: -0.88, calls: 2, trend: [1, 0, 1, 0, 0, 1], sample: [
          { agent: 'Jonny Green', lead: '—', date: '2 Jun', quote: 'I have asked you not to call me again.', note: 'Complaint risk + do-not-call. Flag to manager.' },
        ] },
      ],
    },
    {
      key: 'objections', title: 'Sales objections', caption: 'tier-0 friction — click for the exact words', tone: 'warn',
      items: [
        { key: 'timing', label: 'Timing Not Ready', count: 30, sentiment: 0.24, conversion: { withPct: 16, otherPct: 60 }, calls: 30, trend: [6, 9, 12, 16, 20, 24], sample: [
          { agent: 'Dej A', lead: 'Annie Gerald-Webb', date: '18 Jun', quote: "I've got a million and one things to do. I don't have time to give you feedback.", note: 'Not a price objection — set a low-friction callback, do not pitch.' },
          { agent: 'Jonny Green', lead: 'Jane A Pittam', date: '15 Jun', quote: "Not at the moment. It couldn't be busy at the moment.", note: 'Park + nurture; re-touch in 7 days.' },
        ] },
        { key: 'comparing', label: 'Comparing Quotes', count: 26, sentiment: -0.08, conversion: { withPct: 22, otherPct: 58 }, calls: 26, trend: [4, 6, 8, 7, 9, 10], sample: [
          { agent: 'Dej A', lead: 'Ryan Darlaston', date: '20 May', quote: "I'm getting a range of quotes.", note: 'Differentiate on service + speed; reiterate no hidden extras.' },
        ] },
        { key: 'process', label: 'Process Uncertainty', count: 19, sentiment: 0.05, conversion: { withPct: 31, otherPct: 57 }, calls: 19, trend: [3, 4, 5, 4, 6, 6], sample: [
          { agent: 'Jonny Green', lead: '—', date: '11 Jun', quote: "I had to Google what they even meant. I was like, I don't know what that is.", note: 'Educate in plain English; send the step-by-step explainer.' },
        ] },
        { key: 'localfirm', label: 'Local Firm Preference', count: 16, sentiment: -0.12, conversion: { withPct: 19, otherPct: 59 }, calls: 16, trend: [2, 3, 4, 3, 5, 5], sample: [
          { agent: 'Dej A', lead: '—', date: '10 Jun', quote: "It's my friend who used the mini-store local. So there are two things.", note: 'Counter local-preference with reviews + nationwide track record.' },
        ] },
        { key: 'price', label: 'Price Too High', count: 12, sentiment: -0.33, conversion: { withPct: 14, otherPct: 61 }, calls: 12, trend: [2, 2, 3, 2, 3, 3], sample: [
          { agent: 'Jonny Green', lead: '—', date: '9 Jun', quote: "The top end is £2,900, several that just on a thousand. And a couple that are…", note: 'Reframe on what is included vs the cheap quote; show the real all-in.' },
        ] },
        { key: 'speed', label: 'Speed Urgency', count: 12, sentiment: 0.18, conversion: { withPct: 44, otherPct: 56 }, calls: 12, trend: [1, 2, 3, 3, 4, 4], sample: [
          { agent: 'Dej A', lead: '—', date: '8 Jun', quote: 'I need to. So I need to know when things are gonna be done.', note: 'High intent — fast-track; promise + keep a concrete next date.' },
        ] },
        { key: 'trust', label: 'Trust Verification', count: 14, sentiment: -0.05, conversion: { withPct: 27, otherPct: 58 }, calls: 14, trend: [2, 3, 3, 4, 4, 5], sample: [
          { agent: 'Jonny Green', lead: '—', date: '8 Jun', quote: "It's the make sure it's you, you know, that you I'm sure you are, but…", note: 'Send SRA number + verified-firm proof to build trust.' },
        ] },
        { key: 'cheaper', label: 'Cheaper Quote Elsewhere', count: 6, sentiment: -0.36, conversion: { withPct: 12, otherPct: 60 }, calls: 6, trend: [1, 1, 2, 1, 2, 2], sample: [
          { agent: 'Dej A', lead: '—', date: '6 Jun', quote: 'Because your quote was 1,900 and I have seen two or three already cheaper…', note: 'Low conversion when present; qualify hard before over-investing.' },
        ] },
      ],
    },
    {
      key: 'blockers', title: 'Live-file blockers', caption: "what's holding matters up", tone: 'bad',
      items: [
        { key: 'otherside', label: 'Waiting On Other Side', count: 90, calls: 90, trend: [12, 14, 16, 18, 20, 22], sample: [
          { agent: 'Dej A', lead: '—', date: '16 Jun', quote: 'The other side of contacted me again and said no one replied to any of th…', note: 'Chase the other side’s solicitor; log on the matter timeline.' },
        ] },
        { key: 'clientdocs', label: 'Waiting On Client Documents', count: 49, calls: 49, trend: [8, 9, 10, 11, 12, 13], sample: [
          { agent: 'Jonny Green', lead: '—', date: '15 Jun', quote: 'Just waiting for missus Lloyd to provide some photographs.', note: 'Outstanding docs blocking progress; send a reminder + portal link.' },
        ] },
        { key: 'internalteam', label: 'Waiting On Internal Team', count: 47, calls: 47, trend: [7, 8, 9, 9, 10, 11], sample: [
          { agent: 'Dej A', lead: '—', date: '15 Jun', quote: "If I speak to the head of sales, then I'll get a I'll find out for you.", note: 'Internal dependency; route to the right fee-earner.' },
        ] },
        { key: 'clientdecision', label: 'Waiting On Client Decision', count: 42, calls: 42, trend: [6, 7, 8, 8, 9, 10], sample: [
          { agent: 'Jonny Green', lead: '—', date: '14 Jun', quote: "I'm just wait I'm well, that's what I'm waiting on when I go up next week.", note: 'Decision pending; set a firm follow-up date.' },
        ] },
        { key: 'lender', label: 'Waiting On Lender', count: 35, calls: 35, trend: [5, 6, 7, 7, 8, 9], sample: [
          { agent: 'Dej A', lead: '—', date: '13 Jun', quote: 'They did say that if the client calls, they can just send it directly to ya…', note: 'Lender holding the offer; chase + update the client proactively.' },
        ] },
        { key: 'contractpack', label: 'Contract Pack Pending', count: 14, calls: 14, trend: [2, 2, 3, 3, 4, 4], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '12 Jun', quote: 'It just needs to be drafted.', note: 'Contract pack not issued; assign + set an SLA.' },
        ] },
        { key: 'searchpack', label: 'Search Pack Pending', count: 11, calls: 11, trend: [1, 2, 2, 3, 3, 3], sample: [
          { agent: 'Jonny Green', lead: '—', date: '11 Jun', quote: 'He has made the payment, but we have still not received it…', note: 'Searches paid but not back; chase the provider (ops-health feed).' },
        ] },
      ],
    },
    {
      key: 'solutions', title: 'Solutions & actions', caption: 'situation identified, solved on the call, follow-up promised', tone: 'good',
      items: [
        { key: 'identified', label: 'Situation Identified', count: 113, calls: 113, trend: [14, 16, 18, 19, 21, 22], sample: [
          { agent: 'Dej A', lead: 'Nicola Caddick', date: '15 Jun', quote: 'Right, so the hold-up is the redemption figure from your lender.', note: 'Root cause named on the call — log the blocker + owner on the matter.' },
        ] },
        { key: 'offered', label: 'Solution Offered', count: 113, calls: 113, trend: [13, 15, 17, 18, 20, 21], sample: [
          { agent: 'Jonny Green', lead: 'Diane Thomas', date: '15 Jun', quote: 'I can chase the lender today and call you back the moment it is in.', note: 'Concrete action committed — auto-create the task + callback.' },
        ] },
        { key: 'followup', label: 'Follow-up Promised', count: 113, calls: 113, trend: [12, 14, 16, 17, 19, 20], sample: [
          { agent: 'Dej A', lead: 'Barry Pudney', date: '10 Jun', quote: 'I will speak to my colleague and come back to you before Friday.', note: 'Promise made — track it; flag if the Friday callback is missed.' },
        ] },
        { key: 'resolvedcall', label: 'Resolved On Call', count: 88, calls: 88, trend: [10, 11, 13, 14, 15, 16], sample: [
          { agent: 'Jonny Green', lead: 'Katherine Smith', date: '10 Jun', quote: 'Done — I have updated the file and emailed you the confirmation now.', note: 'Closed in one touch; good first-contact resolution.' },
        ] },
      ],
    },
    {
      key: 'guidance', title: 'Conveyancer guidance', caption: 'reusable legal advice captured from internal calls', tone: 'navy',
      items: [
        { key: 'do', label: 'Do', count: 60, calls: 52, trend: [8, 9, 10, 11, 12, 13], sample: [
          { agent: 'Dej A', lead: '—', date: '16 Jun', quote: 'If she logs into the app you can get a figure over the phone.', note: 'Reusable: redemption figure obtainable in-app — saves a lender call.' },
        ] },
        { key: 'process', label: 'Process', count: 23, calls: 21, trend: [3, 4, 5, 4, 6, 6], sample: [
          { agent: 'Dej A', lead: '—', date: '15 Jun', quote: 'She sends that figure, and then within a few days, the statement will come.', note: 'Process note: figure first, formal statement follows in days.' },
        ] },
        { key: 'ask', label: 'Ask', count: 8, calls: 7, trend: [0, 2, 4, 6, 7, 8], sample: [
          { agent: 'Dej A', lead: '—', date: '16 Jun', quote: "If the neighbour's happy to transfer the property, she'll have to speak to them and do it that way.", note: 'Always explore a TP1 / deed of easement before the adverse-possession route.' },
          { agent: 'Helen Sadler', lead: '—', date: '15 Jun', quote: 'Can we calculate the daily rate and then pay the redemption?', note: 'Ask if you can calculate accrual + pay redemption while awaiting the formal statement.' },
        ] },
        { key: 'dont', label: "Don't", count: 8, calls: 7, trend: [1, 1, 2, 2, 3, 3], sample: [
          { agent: 'Dej A', lead: '—', date: '12 Jun', quote: "We certainly won't be dealing with the TP1 one. And if you are, then you're gonna charge an additional fee…", note: 'Do not absorb extra-title work without re-quoting the additional fee.' },
        ] },
      ],
    },
  ],
};

// Lead analytics — the "Leads" analytics view: where leads sit, how they feel, what they
// push back on (worst-handled first, with handling quality), client questions, follow-up
// outcomes, qualification capture, standout phrases. Clicking a signal opens the rich
// drill-down (handling breakdown + client-said / rep-replied / client-reaction). DEMO ONLY.
const LEAD_ANALYTICS = {
  kpis: [
    { label: 'Time to deposit', value: '0.1d', sub: 'created → paid', tone: 'good', deltaPct: -10, good: true },
    { label: 'Time to connect', value: '11.0h', sub: 'lead → first connected', tone: 'warn', deltaPct: -5, good: true },
    { label: 'Attempts', value: '1.1', sub: 'dials until pickup', tone: 'info', deltaPct: 0, good: true },
    { label: 'Contacts to deposit', value: '1.1', sub: 'calls + emails before deposit', tone: 'info', deltaPct: 0, good: true },
    { label: 'In range', value: '293', sub: '290 with temperature', tone: 'info', deltaPct: 6, good: true },
  ],
  lifecycle: [
    { label: 'New', count: 45 }, { label: 'Contacted', count: 41 }, { label: 'Qualified', count: 26 },
    { label: 'Deposited', count: 13 }, { label: 'Won', count: 149 }, { label: 'Lost', count: 19 },
  ],
  qualificationCapture: [
    { label: 'Property Status', count: 21 }, { label: 'Offer Status', count: 19 }, { label: 'Decision Maker', count: 18 },
    { label: 'Urgency Level', count: 18 }, { label: 'Timescale', count: 14 }, { label: 'Prior Conveyancing Experience', count: 9 },
    { label: 'Mortgage Status', count: 8 }, { label: 'Chain Position', count: 6 },
  ],
  groups: [
    {
      key: 'objections', title: 'What leads push back on', caption: 'worst-handled first — click for the exact words', tone: 'warn',
      items: [
        { key: 'process', label: 'Process Uncertainty', count: 5, calls: 5, handling: { strong: 1, adequate: 0, weak: 4, missed: 0 }, handledWellPct: 20, sentiment: 0.11, conversion: { withPct: 40, otherPct: 10 }, trend: [1, 2, 3, 2, 4, 5], sample: [
          { agent: 'Jonny Green', lead: 'Daniel Kilev', date: '8 Jun', handling: 'weak', clientSaid: 'I never sold anything. Not quite sure how things work.', repReplied: 'For us, you will have received this email where it has your quote price in it, and the button that takes you to make the deposit payment.', clientReaction: 'neutral' },
          { agent: 'Jonny Green', lead: 'Ellie Haigh', date: '8 Jun', handling: 'weak', clientSaid: 'Where are you guys based? When you hand stuff in, you have normally got to literally go to the office.', repReplied: 'Yes, we do have a physical location, Blackburn. But everything is on the online portal.', clientReaction: 'unclear' },
          { agent: 'Dej A', lead: 'Yvonne Akinyi Aleyakpo', date: '26 May', handling: 'strong', clientSaid: 'How would I know how to track my case?', repReplied: 'We have an online portal for your ID checks and onboarding documents, and we keep you in the loop by email throughout.', clientReaction: 'positive' },
        ] },
        { key: 'localfirm', label: 'Local Firm Preference', count: 5, calls: 5, handling: { strong: 0, adequate: 1, weak: 3, missed: 1 }, handledWellPct: 20, sentiment: -0.37, conversion: { withPct: 0, otherPct: 11 }, trend: [1, 2, 3, 4, 3, 5], sample: [
          { agent: 'Dej A', lead: 'Kai Liu', date: '9 Jun', handling: 'weak', clientSaid: "I'm looking for a solicitor in Liverpool.", repReplied: "We've got clients all the way in London and up north as well — everything's done through our online portal.", clientReaction: 'pushed_back' },
          { agent: 'Jonny Green', lead: 'Kai Liu', date: '9 Jun', handling: 'missed', clientSaid: "I tried to find the solicitors near my house. I'm in Liverpool, so it's not good.", repReplied: "No. So we're online.", clientReaction: 'pushed_back' },
          { agent: 'Jonny Green', lead: 'Eric Bain', date: '9 Jun', handling: 'adequate', clientSaid: "I've just instructed the local firm that I've used before.", repReplied: 'No problem at all.', clientReaction: 'positive' },
        ] },
        { key: 'timing', label: 'Timing Not Ready', count: 6, calls: 6, handling: { strong: 1, adequate: 2, weak: 3, missed: 0 }, handledWellPct: 50, sentiment: 0.24, conversion: { withPct: 16, otherPct: 60 }, trend: [2, 3, 4, 4, 5, 6], sample: [
          { agent: 'Dej A', lead: 'Annie Gerald-Webb', date: '18 Jun', handling: 'weak', clientSaid: "I've got a million and one things to do. I don't have time to give you feedback.", repReplied: 'No problem — when is a better time to catch you for five minutes?', clientReaction: 'neutral' },
          { agent: 'Helen Sadler', lead: 'Elizabeth Pearce', date: '11 Jun', handling: 'adequate', clientSaid: 'We are getting married on Saturday and after that we will be unavailable.', repReplied: 'Congratulations — let me line everything up so it is ready the moment you are back.', clientReaction: 'positive' },
        ] },
        { key: 'comparing', label: 'Comparing Quotes', count: 6, calls: 6, handling: { strong: 2, adequate: 1, weak: 3, missed: 0 }, handledWellPct: 50, sentiment: -0.08, conversion: { withPct: 22, otherPct: 58 }, trend: [1, 2, 3, 3, 5, 6], sample: [
          { agent: 'Dej A', lead: 'Ryan Darlaston', date: '20 May', handling: 'strong', clientSaid: "I'm getting a range of quotes.", repReplied: 'Totally fair — ours is all-in with no hidden extras, and we move fast. Happy to put it side by side.', clientReaction: 'positive' },
        ] },
        { key: 'price', label: 'Price Too High', count: 2, calls: 2, handling: { strong: 0, adequate: 0, weak: 2, missed: 0 }, handledWellPct: 0, sentiment: -0.33, conversion: { withPct: 14, otherPct: 61 }, trend: [1, 1, 2, 1, 2, 2], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '9 Jun', handling: 'weak', clientSaid: 'Were there some extra fees on top, like transfer fees?', repReplied: 'That is the all-in figure, there is nothing on top.', clientReaction: 'unclear' },
        ] },
      ],
    },
    {
      key: 'sentiment', title: 'How clients feel', caption: 'click to read why', tone: 'good',
      items: [
        { key: 'neutral', label: 'Neutral', count: 389, calls: 389, sentiment: 0.01, trend: [60, 62, 61, 64, 63, 65], sample: [
          { agent: 'Jonny Green', lead: 'Anne', date: '8 Jun', clientSaid: 'I am not quite ready yet.', note: 'Neutral close; nurture and re-touch.' },
        ] },
        { key: 'positive', label: 'Positive', count: 128, calls: 128, sentiment: 0.51, trend: [18, 20, 22, 21, 24, 26], sample: [
          { agent: 'Dej A', lead: 'Rebecca Wasey', date: '9 Jun', clientSaid: 'That works for me, what do we do next?', note: 'Buying signal — send the instruction pack.' },
        ] },
        { key: 'negative', label: 'Negative', count: 32, calls: 32, sentiment: -0.43, trend: [7, 6, 6, 5, 5, 4], sample: [
          { agent: 'Dej A', lead: 'Aida Mezit', date: '16 Jun', clientSaid: 'I have already instructed a competitor.', note: 'Client had already instructed a competitor and politely but firmly closed the door on APCM.' },
          { agent: 'Dej A', lead: 'Barry Pudney', date: '17 Jun', clientSaid: 'I am still waiting on those documents you promised.', note: 'Polite but clearly frustrated, chasing promised documents that never arrived.' },
        ] },
        { key: 'verypos', label: 'Very Positive', count: 19, calls: 19, sentiment: 0.74, trend: [2, 3, 3, 4, 3, 4], sample: [
          { agent: 'Dej A', lead: 'Francine Lewis', date: '3 Jun', clientSaid: 'You have been really helpful — let us get going.', note: 'Champion client; ask for a review after completion.' },
        ] },
        { key: 'veryneg', label: 'Very Negative', count: 2, calls: 2, sentiment: -0.88, trend: [1, 0, 1, 0, 0, 1], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '2 Jun', clientSaid: 'I have asked you not to call me again.', note: 'Complaint risk + do-not-call. Flag to manager.' },
        ] },
      ],
    },
    {
      key: 'questions', title: 'Client questions', caption: 'what they ask — click for the exact wording', tone: 'navy',
      items: [
        { key: 'process', label: 'Process', count: 27, calls: 27, trend: [4, 5, 6, 5, 7, 8], sample: [{ agent: 'Jonny Green', lead: '—', date: '10 Jun', clientSaid: 'Just pay it over the phone, mate. Is that okay?', note: 'Explain the deposit-by-link flow in plain English.' }] },
        { key: 'firm', label: 'Firm Details', count: 13, calls: 13, trend: [2, 3, 3, 4, 4, 5], sample: [{ agent: 'Dej A', lead: '—', date: '9 Jun', clientSaid: 'Is your phone number in there now?', note: 'Send the firm contact card + SRA number.' }] },
        { key: 'pricing', label: 'Pricing', count: 11, calls: 11, trend: [1, 2, 2, 3, 3, 4], sample: [{ agent: 'Helen Sadler', lead: '—', date: '8 Jun', clientSaid: 'Do I have to pay stamp duty? Or is that all together?', note: 'Clarify SDLT handling vs the legal fee.' }] },
        { key: 'timescale', label: 'Timescale', count: 9, calls: 9, trend: [1, 1, 2, 2, 3, 3], sample: [{ agent: 'Dej A', lead: '—', date: '8 Jun', clientSaid: 'Is that going to be today?', note: 'Set realistic completion expectations.' }] },
      ],
    },
    {
      key: 'followup', title: 'Follow-up outcomes', caption: 'did the call move the lead — split = left with a specific next step', tone: 'bad',
      items: [
        { key: 'held', label: 'Held', count: 22, calls: 22, conversion: { withPct: 38, otherPct: 7 }, trend: [3, 4, 4, 5, 5, 6], sample: [
          { agent: 'Louise Forshaw', lead: 'Jacqui Reading', date: '18 Jun', handling: 'missed', clientSaid: '(no conversation)', repReplied: '—', clientReaction: 'no next step', note: 'Call forwarded to voicemail immediately; no conversation occurred, no message left.' },
          { agent: 'Dej A', lead: 'Antony Sica', date: '18 Jun', handling: 'weak', clientSaid: 'I will leave it with you then anyways.', repReplied: 'Feel free to give us a call at any time.', clientReaction: 'no next step', note: 'Rep surrendered the follow-up without extracting any commitment or specific next step.' },
        ] },
        { key: 'progressed', label: 'Progressed', count: 15, calls: 15, conversion: { withPct: 61, otherPct: 12 }, trend: [2, 3, 3, 4, 5, 5], sample: [
          { agent: 'Dej A', lead: 'John Smith', date: '26 May', handling: 'strong', clientSaid: 'Is it alright if I give you a call Thursday?', repReplied: 'Of course — I will hold Thursday and send a calendar note.', clientReaction: 'specific next step', note: 'Soft close with a concrete callback date.' },
        ] },
        { key: 'lost', label: 'Lost', count: 6, calls: 6, conversion: { withPct: 0, otherPct: 20 }, trend: [1, 1, 1, 2, 1, 1], sample: [
          { agent: 'Jonny Green', lead: '—', date: '12 Jun', handling: 'missed', clientSaid: 'I have already instructed another firm.', repReplied: '—', clientReaction: 'lost', note: 'Client explicitly instructed another firm based on local recommendation.' },
        ] },
        { key: 'stalled', label: 'Stalled', count: 1, calls: 1, conversion: { withPct: 0, otherPct: 18 }, trend: [0, 1, 0, 1, 0, 1], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '11 Jun', handling: 'missed', clientSaid: 'I am still chasing those documents.', repReplied: '—', clientReaction: 'stalled', note: 'Rep failed to answer the client follow-up call; commitment broken, no recovery attempted.' },
        ] },
      ],
    },
  ],
  standoutPhrases: [
    { agent: 'Dej A', lead: '—', date: '18 Jun', quote: 'We have decided to go with you.' },
    { agent: 'Dej A', lead: '—', date: '16 Jun', quote: 'Oh, you sorted it. Okay. No problem.' },
    { agent: 'Jonny Green', lead: '—', date: '15 Jun', quote: "When cheaper isn't always better, I genuinely mean it — I've been through things where I thought cheaper was the better option and it wasn't." },
    { agent: 'Dej A', lead: '—', date: '14 Jun', quote: "It's Edmond calling — just a quick call regarding the quotation you're online for, for your conveyancing." },
  ],
};

// Lead enrichment — who your leads really are: domain reverse-lookup → company + job title
// + seniority, where they come from (UK region), email-domain mix, and decision-maker
// signals. In ty this calls an enrichment provider (Clearbit/Apollo-style) on the lead's
// email/domain; here, the mock. DEMO ONLY.
const LEAD_ENRICHMENT = {
  kpis: [
    { label: 'Enriched', value: '78%', sub: 'leads matched to a person/company', tone: 'good', deltaPct: 8, good: true },
    { label: 'Decision-makers', value: '34', sub: 'C-suite / founder / director', tone: 'good', deltaPct: 12, good: true },
    { label: 'Company emails', value: '96', sub: 'vs 229 personal', tone: 'info', deltaPct: 5, good: true },
    { label: 'Top region', value: 'London', sub: '24% of leads', tone: 'info', deltaPct: 0, good: true },
  ],
  byRegion: [
    { label: 'London', count: 71 }, { label: 'South East', count: 48 }, { label: 'North West', count: 39 },
    { label: 'Midlands', count: 33 }, { label: 'South West & Wales', count: 31 }, { label: 'Yorkshire & NE', count: 27 }, { label: 'Scotland', count: 18 },
  ],
  bySeniority: [
    { label: 'C-suite / Founder', count: 34 }, { label: 'Director / Head', count: 41 }, { label: 'Manager', count: 52 },
    { label: 'Senior individual', count: 38 }, { label: 'Other / unknown', count: 62 },
  ],
  byJob: [
    { label: 'Engineering / Tech', count: 48 }, { label: 'Other', count: 83 }, { label: 'Finance / Banking', count: 31 },
    { label: 'Sales / Marketing', count: 29 }, { label: 'Healthcare', count: 22 }, { label: 'Legal / Professional', count: 14 },
  ],
  bySourceDomain: [
    { label: 'gmail.com', count: 142 }, { label: 'Company domains', count: 96 }, { label: 'outlook.com', count: 54 },
    { label: 'icloud.com', count: 33 }, { label: 'yahoo.com', count: 21 },
  ],
  matchTrend: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [64, 68, 71, 74, 76, 78] },
  leads: [
    { name: 'Grace Adeyemi', domain: 'deloitte.co.uk', company: 'Deloitte', jobTitle: 'Partner', seniority: 'C-suite / Founder', region: 'London', propertyValue: 910000, signal: 'high' },
    { name: 'Daniel Park', domain: 'monzo.com', company: 'Monzo Bank', jobTitle: 'Head of Engineering', seniority: 'Director / Head', region: 'London', propertyValue: 620000, signal: 'high' },
    { name: 'Karen Howe', domain: 'astrazeneca.com', company: 'AstraZeneca', jobTitle: 'Clinical Lead', seniority: 'Senior individual', region: 'South East', propertyValue: 540000, signal: 'high' },
    { name: 'Tom Reilly', domain: 'gmail.com', company: '—', jobTitle: 'Self-employed', seniority: 'Other / unknown', region: 'North West', propertyValue: 285000, signal: 'low' },
    { name: 'Folake Bello', domain: 'hsbc.com', company: 'HSBC', jobTitle: 'VP, Risk', seniority: 'Director / Head', region: 'London', propertyValue: 720000, signal: 'high' },
    { name: 'Sara Mensah', domain: 'nhs.net', company: 'NHS', jobTitle: 'GP', seniority: 'Senior individual', region: 'Midlands', propertyValue: 410000, signal: 'med' },
    { name: 'Chidi Okeke', domain: 'gmail.com', company: '—', jobTitle: 'Teacher', seniority: 'Manager', region: 'Yorkshire & NE', propertyValue: 230000, signal: 'low' },
    { name: 'Aisha Khan', domain: 'arm.com', company: 'Arm', jobTitle: 'Principal Engineer', seniority: 'Senior individual', region: 'South West & Wales', propertyValue: 480000, signal: 'med' },
    { name: 'James Whitfield', domain: 'foundersco.io', company: 'Founders & Co', jobTitle: 'Founder / CEO', seniority: 'C-suite / Founder', region: 'London', propertyValue: 1180000, signal: 'high' },
    { name: 'Priya Nair', domain: 'gmail.com', company: '—', jobTitle: 'Marketing Manager', seniority: 'Manager', region: 'South East', propertyValue: 360000, signal: 'med' },
  ],
  note: 'High-value signal: 34 leads are C-suite / founders, concentrated in London + the South East across tech & finance, on higher property bands (£600k+). Route these to your best closers — they convert at a higher fee and refer.',
};

// Lead categories — the in-depth "what category a lead is", derived from what they SAY on
// calls (the call-voice taxonomy). Each category opens the verbatim words that triggered it
// + the routing. Counts are 30-day base; the page scales them by the selected window. DEMO.
const LEAD_CATEGORIES = {
  kpis: [
    { label: 'Leads categorised', value: '88%', sub: 'from call voice', tone: 'good', deltaPct: 6, good: true },
    { label: 'Ready to instruct', value: '42', sub: 'hot — route to closers', tone: 'good', deltaPct: 14, good: true },
    { label: 'Price-led', value: '31%', sub: 'cheapest + comparison', tone: 'warn', deltaPct: 3, good: false },
    { label: 'At risk', value: '18', sub: 'frustrated / complaint-risk', tone: 'bad', deltaPct: -2, good: true },
  ],
  groups: [
    {
      key: 'readiness', title: 'Buyer readiness & intent', caption: 'how ready to instruct — click for the words that triggered it', tone: 'good',
      items: [
        { key: 'ready', label: 'Ready to Instruct', count: 42, calls: 42, trend: [6, 8, 9, 11, 12, 14], sample: [
          { agent: 'Dej A', lead: 'Folake Bello', date: '18 Jun', clientSaid: "We've had our offer accepted on Friday and need a solicitor straight away.", note: 'Route: HOT — senior closer, same-day callback, push the instruction pack in minutes.' },
          { agent: 'Jonny Green', lead: 'Karen Howe', date: '17 Jun', clientSaid: 'Can you send me the bill so I can pay and get the ball rolling?', note: 'Route: instruct now; do not put in nurture.' },
        ] },
        { key: 'comparing', label: 'Comparing Quotes', count: 36, calls: 36, trend: [4, 6, 7, 8, 9, 10], sample: [
          { agent: 'Helen Sadler', lead: 'Ryan Darlaston', date: '20 May', clientSaid: "I'm just ringing round a few solicitors before I decide.", note: 'Route: closer trained on fee objections; itemised no-hidden-extras quote within 24h; log the competitor named.' },
        ] },
        { key: 'depositready', label: 'Deposit-Ready', count: 21, calls: 21, trend: [2, 3, 3, 4, 5, 6], sample: [
          { agent: 'Dej A', lead: 'James Whitfield', date: '15 Jun', clientSaid: "We're cash buyers, so as soon as we offer we'll want to move quickly.", note: 'Route: high-value warm; quote-on-file + prompt callback when a property is found.' },
        ] },
        { key: 'early', label: 'Early — Not On Market', count: 29, calls: 29, trend: [5, 6, 6, 7, 7, 8], sample: [
          { agent: 'Jonny Green', lead: 'Sara Mensah', date: '12 Jun', clientSaid: "We haven't put ours on the market yet, just working out the costs.", note: 'Route: medium-term nurture with a quote validity window; re-qualify before it cools.' },
        ] },
        { key: 'curious', label: 'Just Curious', count: 24, calls: 24, trend: [3, 3, 4, 4, 5, 5], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '10 Jun', clientSaid: "I'm not actually buying yet, just wanted to see roughly what it costs.", note: 'Route: self-serve quote link + explainer; long-term automated nurture; suppress from closer lists.' },
        ] },
        { key: 'chain', label: 'Stalled by Chain', count: 17, calls: 17, trend: [2, 3, 3, 4, 4, 5], sample: [
          { agent: 'Dej A', lead: 'Chidi Okeke', date: '9 Jun', clientSaid: "We're ready our end but the people we're buying from haven't found anywhere.", note: 'Route: instruct if they commit; chain-aware expectations + proactive chain chasing.' },
        ] },
      ],
    },
    {
      key: 'price', title: 'Price sensitivity', caption: 'how they decide on fee — click for the words', tone: 'warn',
      items: [
        { key: 'compsite', label: 'Comparison-Site Anchored', count: 31, calls: 31, trend: [4, 5, 6, 6, 7, 8], sample: [
          { agent: 'Dej A', lead: '—', date: '14 Jun', clientSaid: 'Your website quoted me 720 all in, is that the final figure?', note: 'Route: speed-to-lead (call within minutes); confirm the online estimate line-by-line, surface omitted disbursements.' },
        ] },
        { key: 'cheapest', label: 'Cheapest Wins', count: 22, calls: 22, trend: [3, 3, 4, 4, 5, 5], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '12 Jun', clientSaid: "Who's gonna do it cheapest? That's all I really care about.", note: 'Route: fixed-fee handler; price-match if margin allows; flag low-margin; qualify out fast if we cannot compete.' },
        ] },
        { key: 'value', label: 'Value Over Price', count: 19, calls: 19, trend: [2, 3, 3, 4, 4, 5], sample: [
          { agent: 'Jonny Green', lead: '—', date: '11 Jun', clientSaid: "I don't mind paying a bit more, I just want someone who'll actually answer the phone.", note: 'Route: relationship closer + named contact; lead on responsiveness, not fee.' },
        ] },
        { key: 'hiddenfee', label: 'Hidden-Fee Wary', count: 16, calls: 16, trend: [2, 2, 3, 3, 4, 4], sample: [
          { agent: 'Dej A', lead: '—', date: '10 Jun', clientSaid: "Is that everything, or are there extras you're gonna spring on me later?", note: 'Route: fully itemised all-in quote in writing before the call ends; name leasehold/expedite supplements up front.' },
        ] },
      ],
    },
    {
      key: 'urgency', title: 'Urgency & life situation', caption: 'what is driving the move', tone: 'navy',
      items: [
        { key: 'ftb', label: 'First-Time-Buyer Anxious', count: 18, calls: 18, trend: [2, 3, 3, 4, 4, 5], sample: [
          { agent: 'Jonny Green', lead: '—', date: '9 Jun', clientSaid: "It's our first time, we don't really know how any of this works.", note: 'Route: patient educator; plain-English explainer + step-by-step; reassurance reduces churn.' },
        ] },
        { key: 'deadline', label: 'Completion Deadline', count: 14, calls: 14, trend: [1, 2, 2, 3, 3, 4], sample: [
          { agent: 'Helen Sadler', lead: 'Elizabeth Pearce', date: '11 Jun', clientSaid: "We're getting married Saturday and need to exchange before then.", note: 'Route: fast-track; senior fee-earner; protect the date with proactive chasing.' },
        ] },
        { key: 'relocating', label: 'Relocating / Job Move', count: 11, calls: 11, trend: [1, 1, 2, 2, 3, 3], sample: [
          { agent: 'Dej A', lead: '—', date: '8 Jun', clientSaid: "I'm moving for a new job and need to be in by next month.", note: 'Route: time-bound; online-first firm is a fit; emphasise no-office-visits.' },
        ] },
        { key: 'probate', label: 'Divorce / Probate', count: 7, calls: 7, trend: [1, 1, 1, 2, 1, 2], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '6 Jun', clientSaid: "It's a sale after a bereavement, I just want it handled sensitively.", note: 'Route: empathetic handler; flag for sensitivity; allow more time.' },
        ] },
      ],
    },
    {
      key: 'comms', title: 'Communication & risk', caption: 'how they talk — and complaint risk', tone: 'bad',
      items: [
        { key: 'confused', label: 'Confused / Needs Education', count: 23, calls: 23, trend: [3, 4, 4, 5, 5, 6], sample: [
          { agent: 'Dej A', lead: '—', date: '10 Jun', clientSaid: "I had to Google what that even meant, I don't know what that is.", note: 'Route: educate in plain English; send the explainer; do not assume knowledge.' },
        ] },
        { key: 'frustrated', label: 'Frustrated / Complaint-Risk', count: 18, calls: 18, trend: [4, 4, 3, 3, 3, 2], sample: [
          { agent: 'Jonny Green', lead: 'Barry Pudney', date: '17 Jun', clientSaid: "My mate got hit with loads of admin fees at the end, that won't happen here will it?", note: 'Route: transparency script + written all-in quote; flag for complaint-risk monitoring.' },
        ] },
        { key: 'transactional', label: 'Transactional / Curt', count: 15, calls: 15, trend: [2, 2, 3, 3, 3, 3], sample: [
          { agent: 'Helen Sadler', lead: '—', date: '9 Jun', clientSaid: 'Just give me the price and what you need from me.', note: 'Route: keep it brief + factual; skip the relationship-building, send the quote.' },
        ] },
        { key: 'champion', label: 'Champion / Advocate', count: 12, calls: 12, trend: [1, 2, 2, 3, 3, 4], sample: [
          { agent: 'Dej A', lead: 'Francine Lewis', date: '3 Jun', clientSaid: "You've been brilliant — I'll definitely recommend you.", note: 'Route: ask for a review + referral after completion; potential repeat client.' },
        ] },
      ],
    },
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
  get_comparison_lead_stats: () => [{
    total_count: COMPARISON_LEADS.length,
    today_count: COMPARISON_LEADS.filter((c) => c.created_at >= todayMid).length,
    quoted_count: COMPARISON_LEADS.filter((c) => c.status === 'quoted').length,
    new_count: COMPARISON_LEADS.filter((c) => c.status === 'new').length,
    callbacks_count: COMPARISON_LEADS.filter((c) => c.quote_breakdown && c.quote_breakdown.callbackRequested).length,
    site_counts: [],
    firm_stats: SOLICITOR_FIRMS.map((f, i) => {
      const appearances = 120 - i * 18;
      const rates = [0.18, 0.14, 0.22, 0.09, 0.12];
      const totalLeads = Math.round(appearances * rates[i % rates.length]);
      return { firmId: f.id, firmName: f.name, totalLeads, todayLeads: Math.max(1, Math.round(totalLeads / 8)), callbackLeads: Math.round(totalLeads / 3), newLeads: Math.round(totalLeads / 4), totalRevenue: totalLeads * 920, appearances, siteBreakdown: [] };
    }),
  }],
  count_today_appearances_by_firm: () => SOLICITOR_FIRMS.map((f, i) => ({ firm_id: f.id, appearance_count: 30 + i * 7 })),
  get_overview_report: () => OVERVIEW_REPORT,
  get_pipeline_pulse: () => PIPELINE_PULSE,
  get_daily_pipeline: () => DAILY_PIPELINE,
  get_finance_overview: () => FINANCE_OVERVIEW,
  get_matters: () => MATTERS,
  get_firm_analytics: () => FIRM_ANALYTICS,
  get_firm_trends: () => FIRM_TRENDS,
  get_team_performance: () => TEAM_PERFORMANCE,
  get_marketing: () => MARKETING,
  get_recovery_engine: () => RECOVERY_ENGINE,
  get_email_analytics: () => MAIL,
  get_call_verification: () => CALL_VERIFICATION,
  get_inbound_overview: () => INBOUND_OVERVIEW,
  get_callback_funnel: () => CALLBACK_FUNNEL,
  get_agent_day: () => AGENT_DAY,
  get_instruction_insights: () => INSTRUCTION_INSIGHTS,
  get_finance_insights: () => FINANCE_INSIGHTS,
  get_comparison_engine: () => COMPARISON_ENGINE,
  get_matter_progression: () => MATTER_PROGRESSION,
  get_agent_workspace: () => AGENT_WORKSPACE,
  get_conversations: () => CONVERSATIONS,
  get_revenue_opportunities: () => REVENUE_OPPORTUNITIES,
  get_compliance: () => COMPLIANCE,
  get_lead_resale: () => LEAD_RESALE,
  get_resale_queue: () => RESALE_QUEUE,
  get_ops_health: () => OPS_HEALTH,
  get_client_experience: () => CLIENT_EXPERIENCE,
  get_sales_velocity: () => SALES_VELOCITY,
  get_capacity: () => CAPACITY,
  get_forecast: () => FORECAST,
  get_timing: () => TIMING,
  get_call_insights: () => CALL_INSIGHTS,
  get_lead_analytics: () => LEAD_ANALYTICS,
  get_lead_enrichment: () => LEAD_ENRICHMENT,
  get_lead_categories: () => LEAD_CATEGORIES,
  get_lead_quality_breakdown: () => [],
  get_disqualified_breakdown: () => [{ source: 'Comparison Site', total: 12, fake: 4, duplicate: 3, wrong_number: 5 }, { source: 'Hoowla', total: 6, fake: 2, duplicate: 2, wrong_number: 2 }],
  get_instruction_report_summary: () => ({ total_instructions: 47, agents_credited: 5, todays_instructions: 7, missing_attribution: 10, leads_created: 342, conversion: 13.7 }),
  get_instruction_report_breakdowns: () => {
    const mk = (dimension: string, dimension_value: string, total_leads: number, instructed_leads: number) => ({ dimension, dimension_value, total_leads, instructed_leads, conversion_rate: total_leads > 0 ? Math.round((instructed_leads / total_leads) * 1000) / 10 : 0, missing_attribution_count: 0 });
    return [
      mk('source', 'Comparison Site', 124, 18), mk('source', 'Hoowla', 58, 11), mk('source', 'Direct', 41, 9), mk('source', 'Referral', 28, 7), mk('source', 'Google Ads', 42, 4),
      mk('utm_source', 'google', 86, 12), mk('utm_source', 'bing', 24, 3), mk('utm_source', 'facebook', 31, 4),
      mk('utm_campaign', 'Conveyancing-Brand', 64, 12), mk('utm_campaign', 'Remortgage-Q2', 38, 5), mk('utm_campaign', 'Leasehold-Push', 22, 2),
      mk('utm_term', 'house sale solicitor', 28, 6), mk('utm_term', 'conveyancing quote', 41, 5), mk('utm_term', 'cheap conveyancing', 33, 2),
      mk('credited_user', 'Louise Forshaw', 96, 12), mk('credited_user', 'Sarah Okafor', 74, 8), mk('credited_user', 'James Okoro', 58, 5),
    ];
  },
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
