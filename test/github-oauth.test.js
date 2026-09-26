import { describe, it, expect, vi, afterEach } from 'vitest';
import { authEnv } from './helpers.js';
import { createOAuthState, buildGitHubAuthorizeUrl } from '../functions/_lib/github-oauth.js';
import { onRequestGet } from '../functions/api/auth/callback.js';

afterEach(() => vi.unstubAllGlobals());

describe('GitHub callback', () => {
  it('binds OAuth state to the browser and asks only for identity access', async () => {
    const state = await createOAuthState(authEnv());
    const url = new URL(buildGitHubAuthorizeUrl(authEnv(), state.state, 'https://blog.test'));
    expect(url.searchParams.get('state')).toBe(state.state);
    expect(url.searchParams.get('scope')).toBe('read:user');
  });
  it.each(['GOLDLAOGE', 'not-the-owner'])('allows only owner %s and clears state', async (login) => {
    const env = authEnv();
    const state = await createOAuthState(env);
    vi.stubGlobal('fetch', vi.fn(async url => new Response(JSON.stringify(String(url).includes('access_token')
      ? { access_token: 'private-token' } : { login }), { headers: { 'content-type': 'application/json' } })));
    const request = new Request(`https://blog.test/api/auth/callback?code=one&state=${state.state}`, { headers: { cookie: state.cookie } });
    const response = await onRequestGet({ request, env });
    expect(response.status).toBe(login === 'GOLDLAOGE' ? 302 : 403);
    expect(await response.text()).not.toContain('private-token');
    expect(await env.CMS_SESSIONS.get(`oauth:${state.state}`)).toBeNull();
  });
  it('rejects an unbound OAuth callback', async () => {
    const env = authEnv();
    const state = await createOAuthState(env);
    const result = await onRequestGet({ env, request: new Request(`https://blog.test/api/auth/callback?code=one&state=${state.state}`) });
    expect(result.status).toBe(400);
  });
});
