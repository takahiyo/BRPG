// Optional cloud backend. Local file play does not depend on this Worker.
const MAX_BODY = 2 * 1024 * 1024;
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let keyCache = { keys: [], until: 0 }, keyRequest;
class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }});
}
function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new ApiError(401, 'invalid_token');
  const text = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(text, c => c.charCodeAt(0));
}
async function googleKeys() {
  if (keyCache.until > Date.now()) return keyCache.keys;
  if (!keyRequest) keyRequest = (async () => {
    const response = await fetch(JWKS_URL, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new ApiError(503, 'identity_unavailable');
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new ApiError(503, 'identity_unavailable');
    const maxAge = Number(/max-age=(\d+)/i.exec(response.headers.get('Cache-Control') || '')?.[1] || 300);
    keyCache = {keys: data.keys, until: Date.now() + Math.min(maxAge, 86400) * 1000};
    return data.keys;
  })().finally(() => { keyRequest = null; });
  return keyRequest;
}
async function subject(request, clientId) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 16384) throw new ApiError(401, 'sign_in_required');
  const parts = auth.slice(7).split('.');
  if (parts.length !== 3) throw new ApiError(401, 'invalid_token');
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch { throw new ApiError(401, 'invalid_token'); }
  const now = Date.now() / 1000;
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || claims?.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
      (claims.azp !== undefined && claims.azp !== clientId)) throw new ApiError(401, 'invalid_token');
  const jwk = (await googleKeys()).find(k => k.kid === header.kid && k.kty === 'RSA' && k.alg === 'RS256' && k.use === 'sig');
  if (!jwk) throw new ApiError(401, 'invalid_token');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1])))
    throw new ApiError(401, 'invalid_token');
  return claims.sub;
}
async function boundedJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'json_required');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new ApiError(413, 'save_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_body');
  const chunks = []; let size = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'save_too_large'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(buffer)); }
  catch { throw new ApiError(400, 'invalid_json'); }
}
// Envelope validation only. The client runs the engine's full validSave before loading.
function saveEnvelope(v) {
  const record = x => x && typeof x === 'object' && !Array.isArray(x);
  return record(v) && v.version === 3 && Array.isArray(v.roster) && v.roster.length > 0 &&
    Array.isArray(v.active) && v.active.length > 0 && v.active.length <= 6 &&
    ['gold','debt','nextGear','nextHero','kills','randomState'].every(k => Number.isFinite(v[k]) && v[k] >= 0) &&
    ['materials','stock','items','research','quests'].every(k => record(v[k])) &&
    ['gear','books','battleRules','log','corpses','towns','addressMaps'].every(k => Array.isArray(v[k]));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status:404});
    try {
      if (url.pathname === '/api/config' && request.method === 'GET')
        return json({googleClientId:env.GOOGLE_CLIENT_ID || '', cloudEnabled:!!(env.GOOGLE_CLIENT_ID && env.DB)});
      if (url.pathname !== '/api/save') throw new ApiError(404, 'not_found');
      if (!['GET','PUT'].includes(request.method)) return new Response(null, {status:405, headers:{Allow:'GET, PUT'}});
      if (!env.GOOGLE_CLIENT_ID || !env.DB) throw new ApiError(503, 'cloud_not_configured');
      if (request.method === 'PUT' && request.headers.get('Origin') !== url.origin) throw new ApiError(403, 'origin_rejected');
      const user = await subject(request, env.GOOGLE_CLIENT_ID);
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT save_json, revision, updated_at FROM player_saves WHERE google_sub = ?1').bind(user).first();
        return json(row ? {save:JSON.parse(row.save_json), revision:row.revision, updatedAt:row.updated_at} : {save:null, revision:0, updatedAt:null});
      }
      const body = await boundedJson(request);
      if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER || !saveEnvelope(body.save))
        throw new ApiError(400, 'invalid_save');
      const updatedAt = new Date().toISOString();
      // One SQL statement: concurrent writes cannot both accept the same revision.
      const row = await env.DB.prepare(`INSERT INTO player_saves (google_sub, save_json, revision, updated_at)
        SELECT ?1, ?2, 1, ?3 WHERE ?4 = 0 OR EXISTS (SELECT 1 FROM player_saves WHERE google_sub = ?1)
        ON CONFLICT(google_sub) DO UPDATE SET save_json = excluded.save_json,
          revision = player_saves.revision + 1, updated_at = excluded.updated_at
        WHERE player_saves.revision = ?4
        RETURNING revision, updated_at`).bind(user, JSON.stringify(body.save), updatedAt, body.revision).first();
      if (!row) throw new ApiError(409, 'revision_conflict');
      return json({revision:row.revision, updatedAt:row.updated_at});
    } catch (error) {
      return json({error:error instanceof ApiError ? error.message : 'cloud_unavailable'}, error instanceof ApiError ? error.status : 503);
    }
  }
};
