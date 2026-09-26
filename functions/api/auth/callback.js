import { OAUTH_COOKIE, exchangeCode, getGitHubLogin } from '../../_lib/github-oauth.js';
import { OWNER, cookieValue, verifyValue, secureCookie, createSession } from '../../_lib/session.js';
import { badRequest, forbidden, serverError } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  let cookieState;
  let response;
  try {
    cookieState = await verifyValue(env, cookieValue(request, OAUTH_COOKIE));
    const saved = cookieState ? await env.CMS_SESSIONS.get(`oauth:${cookieState}`, 'json') : null;
    if (!state || state !== cookieState || !saved || saved.expiresAt <= Date.now() || !url.searchParams.get('code')) {
      response = badRequest('登录请求已失效，请重新登录。');
    } else {
      const token = await exchangeCode(env, url.searchParams.get('code'), url.origin);
      if (await getGitHubLogin(token) !== OWNER) response = forbidden();
      else {
        const session = await createSession(env);
        response = new Response(null, { status: 302, headers: { location: '/admin/', 'set-cookie': session.cookie } });
      }
    }
  } catch {
    response = serverError('GitHub 登录失败，请检查 OAuth 配置后重试。');
  } finally {
    if (cookieState) await env.CMS_SESSIONS.delete(`oauth:${cookieState}`);
  }
  response.headers.append('set-cookie', secureCookie(OAUTH_COOKIE, '', 0));
  response.headers.set('cache-control', 'no-store');
  return response;
}
