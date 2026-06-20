// @ts-nocheck
/* ------------------------------------------------------------------ *
 * LOCAL DEMO MOCK Supabase client — NO network, NO production.
 * Replaces the real createClient so a reviewer can click through the
 * whole CRM on in-memory dummy data. Every .from()/.rpc()/.auth/
 * .functions/.storage call resolves locally. See ./mockData for the
 * fixtures and ./mockFetch for the edge-function fetch shim.
 * ------------------------------------------------------------------ */
import { TABLES, RPC, FUNCTIONS, DEMO_SESSION } from './mockData';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
let _uid = 100000;
const genId = () => 'mock-' + _uid++;
const nowIso = () => new Date().toISOString();

function applyFilters(rows, filters) {
  return rows.filter((r) => filters.every((f) => f(r)));
}

class Builder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = 'select';
    this.payload = null;
    this._count = false;
    this._head = false;
    this._single = false;
    this._maybe = false;
    this._limit = null;
    this._from = null;
    this._to = null;
  }

  // selectors / writers
  select(_cols, opts) {
    if (opts && opts.count) this._count = true;
    if (opts && opts.head) this._head = true;
    return this;
  }
  insert(payload) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload) { this.op = 'update'; this.payload = payload; return this; }
  upsert(payload) { this.op = 'upsert'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }

  // filters (lenient — unknown/complex ones are no-ops so they never over-filter to empty)
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  lt(c, v) { this.filters.push((r) => r[c] < v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
  in(c, arr) { this.filters.push((r) => Array.isArray(arr) && arr.includes(r[c])); return this; }
  is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c, op, v) {
    if (op === 'is' && v === null) this.filters.push((r) => r[c] != null);
    else if (op === 'is') this.filters.push((r) => r[c] !== v);
    return this; // list-literal "not in (...)" ignored on purpose
  }
  or() { return this; }
  contains() { return this; }
  ilike(c, pat) {
    const p = String(pat || '').replace(/%/g, '').toLowerCase();
    if (!p) return this;
    this.filters.push((r) => String(r[c] == null ? '' : r[c]).toLowerCase().includes(p));
    return this;
  }
  like(c, pat) { return this.ilike(c, pat); }
  order() { return this; }
  limit(n) { this._limit = n; return this; }
  range(a, b) { this._from = a; this._to = b; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybe = true; return this; }

  _store() { return (TABLES[this.table] = TABLES[this.table] || []); }

  _run() {
    const store = this._store();
    let result = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      result = arr.map((row) => {
        const r = { id: genId(), created_at: nowIso(), updated_at: nowIso(), ...row };
        store.push(r);
        return r;
      });
    } else if (this.op === 'update') {
      result = applyFilters(store, this.filters);
      result.forEach((r) => Object.assign(r, this.payload, { updated_at: nowIso() }));
    } else if (this.op === 'delete') {
      result = applyFilters(store, this.filters);
      for (const r of result) { const i = store.indexOf(r); if (i >= 0) store.splice(i, 1); }
    } else {
      result = applyFilters(store, this.filters);
    }
    const count = result.length;
    let data = result;
    if (this._from != null) data = data.slice(this._from, (this._to == null ? data.length : this._to) + 1);
    if (this._limit != null) data = data.slice(0, this._limit);
    if (this._head) return { data: null, count, error: null, status: 200, statusText: 'OK' };
    if (this._single || this._maybe) return { data: clone(data[0] == null ? null : data[0]), count, error: null, status: 200, statusText: 'OK' };
    return { data: clone(data), count: this._count ? count : null, error: null, status: 200, statusText: 'OK' };
  }

  then(resolve, reject) {
    let out;
    try { out = this._run(); } catch (e) { out = { data: null, error: { message: String(e), code: 'MOCK' } }; }
    return Promise.resolve(out).then(resolve, reject);
  }
  catch(cb) { return this.then((v) => v, cb); }
  finally(cb) { return this.then((v) => { cb && cb(); return v; }, (e) => { cb && cb(); throw e; }); }
}

export const supabase = {
  from: (table) => new Builder(table),
  rpc: (name, params) => {
    let data = [];
    try { data = RPC[name] ? RPC[name](params) : []; } catch { data = []; }
    return Promise.resolve({ data: clone(data), error: null, status: 200, statusText: 'OK' });
  },
  auth: {
    getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
    getUser: async () => ({ data: { user: DEMO_SESSION.user }, error: null }),
    onAuthStateChange: (cb) => {
      setTimeout(() => { try { cb('SIGNED_IN', DEMO_SESSION); } catch (_) {} }, 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithPassword: async () => ({ data: { user: DEMO_SESSION.user, session: DEMO_SESSION }, error: null }),
    signUp: async () => ({ data: { user: DEMO_SESSION.user, session: DEMO_SESSION }, error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: DEMO_SESSION.user }, error: null }),
    signOut: async () => ({ error: null }),
    admin: {
      createUser: async () => ({ data: { user: DEMO_SESSION.user }, error: null }),
      deleteUser: async () => ({ data: {}, error: null }),
      generateLink: async () => ({ data: { properties: { action_link: '#' } }, error: null }),
    },
  },
  functions: {
    invoke: async (name, opts) => {
      let data = { success: true };
      try { data = FUNCTIONS[name] ? FUNCTIONS[name](opts) : { success: true }; } catch { data = { success: true }; }
      return { data: clone(data), error: null };
    },
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'mock/path' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '#' } }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: '#' }, error: null }),
    }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
  removeChannel: () => {},
};
