'use strict';

// The application uses only these three statements for its two state rows.
// This is deliberately not a general SQL-over-HTTP implementation.
const tables = {app_state: {name: 'rea_app_state', id: 'main'}, gateway_state: {name: 'rea_gateway_state', id: 'sandbox'}};
class StorageError extends Error {
  constructor(code, message) { super(message); this.name = 'StorageError'; this.status = 503; this.code = code; }
}
const invalid = () => { throw new StorageError('storage_configuration', '서버 저장소 설정을 확인하세요.'); };
const unavailable = () => new StorageError('storage_unavailable', 'Supabase 저장소 연결·권한을 확인하세요.');

function serverKey(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return invalid();
  if (/^sb_secret_[A-Za-z0-9_-]{12,}$/.test(value)) return {apikey: value};
  try {
    const parts = value.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (parts.length === 3 && payload.role === 'service_role') return {apikey: value, Authorization: 'Bearer ' + value};
  } catch {}
  return invalid();
}

function createSupabaseDB({url, key, fetchImpl = fetch, timeoutMs = 10000} = {}) {
  let base;
  try { base = new URL(url); } catch { return invalid(); }
  if (base.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(base.hostname) || base.port || base.username || base.password || base.search || base.hash || base.pathname !== '/') return invalid();
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) return invalid();
  const credentials = serverKey(key);

  async function request(table, params, {method = 'GET', body, prefer} = {}) {
    const target = new URL('/rest/v1/' + table.name, base);
    for (const [name, value] of Object.entries(params)) target.searchParams.set(name, value);
    let response;
    try {
      response = await fetchImpl(target.href, {method, headers: {...credentials, Accept: 'application/json', ...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...(prefer ? {Prefer: prefer} : {})}, redirect: 'error', signal: AbortSignal.timeout(timeoutMs), ...(body === undefined ? {} : {body: JSON.stringify(body)})});
      if (!response.ok) throw unavailable();
      // PostgREST returns 201 with no body for an INSERT with return=minimal.
      if (prefer?.split(',').includes('return=minimal')) { if(response.body) await response.body.cancel().catch(()=>{}); return []; }
      if (response.status === 204) throw unavailable();
      if (!/application\/json/i.test(response.headers.get('Content-Type') || '')) throw unavailable();
      const data = await response.json();
      if (!Array.isArray(data)) throw unavailable();
      return data;
    } catch { throw unavailable(); } // Never propagate upstream bodies, headers or credentials.
  }

  function prepare(sql) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    const table = tables[normalized.match(/\b(?:INTO|FROM|UPDATE) (app_state|gateway_state)\b/)?.[1]];
    if (!table) return invalid();
    const source = Object.keys(tables).find(name => tables[name] === table);
    const insert = normalized === `INSERT INTO ${source} (id, revision, body, updated_at) VALUES (?, 0, ?, ?) ON CONFLICT(id) DO NOTHING`;
    const select = normalized === `SELECT revision, body FROM ${source} WHERE id = ?`;
    const update = normalized === `UPDATE ${source} SET body = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`;
    if (!insert && !select && !update) return invalid();
    return {bind(...args) {
      if (args.length !== (insert ? 3 : select ? 1 : 4)) return invalid();
      const id = args[insert || select ? 0 : 2];
      if (id !== table.id) return invalid();
      const body = args[insert ? 1 : 0], at = args[insert ? 2 : 1], revision = args[3];
      if (!select && (typeof body !== 'string' || typeof at !== 'string')) return invalid();
      if (update && (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647)) return invalid();
      return {
        async first() {
          if (!select) return invalid();
          const rows = await request(table, {id: 'eq.' + id, select: 'revision,body', limit: '2'});
          if (!rows.length) return null;
          const row = rows[0];
          if (rows.length !== 1 || !Number.isInteger(row.revision) || row.revision < 0 || typeof row.body !== 'string') throw unavailable();
          try { const state=JSON.parse(row.body); if(!state || typeof state!=='object' || Array.isArray(state)) throw unavailable(); } catch { throw unavailable(); }
          return {revision: row.revision, body: row.body};
        },
        async run() {
          if (select) return invalid();
          if (insert) {
            await request(table, {on_conflict: 'id'}, {method: 'POST', body: {id, revision: 0, body, updated_at: at}, prefer: 'resolution=ignore-duplicates,return=minimal'});
            return {meta: {changes: 0}};
          }
          const rows = await request(table, {id: 'eq.' + id, revision: 'eq.' + revision, select: 'revision'}, {method: 'PATCH', body: {body, revision: revision + 1, updated_at: at}, prefer: 'return=representation'});
          if (rows.length > 1 || rows.length && rows[0].revision !== revision + 1) throw unavailable();
          return {meta: {changes: rows.length}};
        }
      };
    }};
  }

  return {prepare, async probe() {
    for (const table of Object.values(tables)) await request(table, {select: 'id,revision,body,updated_at', limit: '0'});
    return {backend: 'supabase', tables: Object.values(tables).map(t => t.name), readOnly: true};
  }};
}

function resolveEnvironment(env) {
  if (env.REA_STORAGE === 'supabase') return {...env, REA_RUNTIME: 'standalone', DB: createSupabaseDB({url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY})};
  if (env.REA_STORAGE && !['sqlite', 'd1'].includes(env.REA_STORAGE)) return invalid();
  if (!env.REA_STORAGE && (env.SUPABASE_URL || env.SUPABASE_SECRET_KEY)) return invalid();
  return env;
}

module.exports = {createSupabaseDB, resolveEnvironment, StorageError};
