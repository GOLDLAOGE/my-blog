import { describe, it, expect } from 'vitest';
import { authEnv } from './helpers.js';
import { createSession, readSession, requireOwner, destroySession, requireMutation } from '../functions/_lib/session.js';

describe('owner sessions', () => {
  it('sets a signed HttpOnly cookie and retains identity only on the server', async () => {
    const env = authEnv();
    const session = await createSession(env);
    expect(session.cookie).toContain('HttpOnly; Secure; SameSite=Lax');
    expect(session.cookie).not.toContain('GOLDLAOGE');
    const request = new Request('https://blog.test/api/posts', { headers: { cookie: session.cookie } });
    expect((await readSession(request, env)).login).toBe('GOLDLAOGE');
    await destroySession(request, env);
    expect(await readSession(request, env)).toBeNull();
  });
  it('rejects missing, tampered, expired, and non-owner sessions', async () => {
    const env = authEnv();
    expect((await requireOwner(new Request('https://blog.test/api/posts'), env)).status).toBe(401);
    const session = await createSession(env);
    const request = new Request('https://blog.test/api/posts', { headers: { cookie: session.cookie } });
    expect(await readSession(new Request(request, { headers: { cookie: session.cookie.replace('=', '=x') } }), env)).toBeNull();
    const key = [...env.CMS_SESSIONS.data.keys()][0];
    const saved = JSON.parse(env.CMS_SESSIONS.data.get(key));
    env.CMS_SESSIONS.data.set(key, JSON.stringify({ ...saved, expiresAt: 0 }));
    expect(await readSession(request, env)).toBeNull();
    env.CMS_SESSIONS.data.set(key, JSON.stringify({ ...saved, login: 'someone-else' }));
    expect((await requireOwner(request, env)).status).toBe(403);
  });
  it('requires matching origin and CSRF token for mutation requests', async () => {
    const env = authEnv();
    const session = await createSession(env);
    const headers = { cookie: session.cookie, origin: 'https://blog.test', 'x-cms-csrf': session.csrf };
    expect((await requireMutation(new Request('https://blog.test/api/posts', { method: 'POST', headers }), env)).login).toBe('GOLDLAOGE');
    expect((await requireMutation(new Request('https://blog.test/api/posts', { method: 'POST', headers: { ...headers, origin: 'https://attacker.test' } }), env)).status).toBe(403);
  });
});
