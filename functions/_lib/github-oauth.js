import { requireEnv } from './env.js';
import { randomToken, signedValue, secureCookie } from './session.js';

export const OAUTH_COOKIE = '__Host-cms-oauth';

export async function createOAuthState(env) {
  requireEnv(env, ['CMS_SESSIONS', 'CMS_SESSION_SECRET']);
  const state = randomToken();
  await env.CMS_SESSIONS.put(`oauth:${state}`, JSON.stringify({ expiresAt: Date.now() + 600000 }), { expirationTtl: 600 });
  return { state, cookie: secureCookie(OAUTH_COOKIE, await signedValue(env, state), 600) };
}

export function buildGitHubAuthorizeUrl(env, state, origin) {
  requireEnv(env, ['GITHUB_OAUTH_CLIENT_ID']);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return url.href;
}

export async function exchangeCode(env, code, origin) {
  requireEnv(env, ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET']);
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code, redirect_uri: `${origin}/api/auth/callback` }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('GitHub 登录验证失败，请重新登录。');
  return data.access_token;
}

export async function getGitHubLogin(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'personal-blog-cms' },
  });
  if (!response.ok) throw new Error('无法获取 GitHub 登录身份。');
  return (await response.json()).login;
}
