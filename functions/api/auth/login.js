import { createOAuthState, buildGitHubAuthorizeUrl } from '../../_lib/github-oauth.js';
import { serverError } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  try {
    const state = await createOAuthState(env);
    return new Response(null, { status: 302, headers: {
      location: buildGitHubAuthorizeUrl(env, state.state, new URL(request.url).origin),
      'set-cookie': state.cookie, 'cache-control': 'no-store',
    } });
  } catch {
    return serverError('登录尚未配置，请检查 Cloudflare 的 OAuth 和会话绑定。');
  }
}
