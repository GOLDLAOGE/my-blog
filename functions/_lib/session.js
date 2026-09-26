import { requireEnv } from './env.js';
import { unauthorized, forbidden } from './http.js';

const SESSION_COOKIE = '__Host-cms';
const TTL = 8 * 60 * 60;
export const OWNER = 'GOLDLAOGE';

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}

export function cookieValue(request, name) {
  return (request.headers.get('cookie') || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export function secureCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function signValue(env, value) {
  requireEnv(env, ['CMS_SESSION_SECRET']);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.CMS_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function equalValue(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signedValue(env, value) {
  return `${value}.${await signValue(env, value)}`;
}

export async function verifyValue(env, value) {
  const [id, signature, extra] = value.split('.');
  if (extra || !/^[a-f0-9]{64}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  return equalValue(signature, await signValue(env, id)) ? id : null;
}

export async function createSession(env) {
  requireEnv(env, ['CMS_SESSIONS', 'CMS_SESSION_SECRET']);
  const id = randomToken();
  const csrf = randomToken();
  await env.CMS_SESSIONS.put(`session:${id}`, JSON.stringify({ login: OWNER, csrf, expiresAt: Date.now() + TTL * 1000 }), { expirationTtl: TTL });
  return { csrf, cookie: secureCookie(SESSION_COOKIE, await signedValue(env, id), TTL) };
}

export async function readSession(request, env) {
  requireEnv(env, ['CMS_SESSIONS', 'CMS_SESSION_SECRET']);
  const id = await verifyValue(env, cookieValue(request, SESSION_COOKIE));
  if (!id) return null;
  const saved = await env.CMS_SESSIONS.get(`session:${id}`, 'json');
  return saved && saved.expiresAt > Date.now() ? saved : null;
}

export async function requireOwner(request, env) {
  const session = await readSession(request, env);
  if (!session) return unauthorized();
  return session.login === OWNER ? session : forbidden();
}

export async function requireMutation(request, env) {
  const session = await requireOwner(request, env);
  if (session instanceof Response) return session;
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      !equalValue(request.headers.get('x-cms-csrf'), session.csrf)) return forbidden();
  return session;
}

export async function destroySession(request, env) {
  const id = await verifyValue(env, cookieValue(request, SESSION_COOKIE));
  if (id) await env.CMS_SESSIONS.delete(`session:${id}`);
  return secureCookie(SESSION_COOKIE, '', 0);
}
