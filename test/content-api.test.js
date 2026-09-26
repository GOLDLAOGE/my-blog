import { afterEach, expect, it, vi } from 'vitest';
import { authEnv } from './helpers.js';
import { createSession } from '../functions/_lib/session.js';
import { onRequestGet, onRequestPost } from '../functions/api/posts/index.js';
import { onRequestPut } from '../functions/api/posts/[slug].js';
import { onRequestGet as settingsGet, onRequestPut as settingsPut } from '../functions/api/settings.js';
afterEach(() => vi.unstubAllGlobals());
async function context(data = {}, method = 'POST', slug = 'test') {
  const env = { ...authEnv(), GITHUB_REPO_TOKEN: 'test-token' };
  const session = await createSession(env);
  return { env, params: { slug }, request: new Request('https://blog.test/api/posts', {
    method, headers: { cookie: session.cookie.split(';')[0], origin: 'https://blog.test', 'x-cms-csrf': session.csrf, 'content-type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(data) }),
  }) };
}
const post = { slug: 'test', title: '中文文章', description: 'SEO 描述', body: '正文', tags: ['中文'], categories: ['生活'] };
it('rejects missing sessions before contacting GitHub', async () => {
  const ctx = { env: authEnv(), request: new Request('https://blog.test/api/posts') };
  expect((await onRequestGet(ctx)).status).toBe(401);
  expect((await settingsGet(ctx)).status).toBe(401);
});
it('does not write invalid post content', async () => {
  vi.stubGlobal('fetch', () => { throw new Error('must not call GitHub'); });
  expect((await onRequestPost(await context({ ...post, title: '' }))).status).toBe(400);
  expect((await onRequestPost(await context({ ...post, description: '' }))).status).toBe(400);
});
it('creates valid posts and returns their commit id', async () => {
  vi.stubGlobal('fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ message: 'content: publish 中文文章', branch: 'main' });
    expect(Buffer.from(body.content, 'base64').toString()).toContain('description: SEO 描述');
    return Response.json({ commit: { sha: 'published' } }, { status: 201 });
  });
  const response = await onRequestPost(await context(post));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ sha: 'published', slug: 'test' });
});
it('does not overwrite an article whose revision has changed', async () => {
  vi.stubGlobal('fetch', async (url, init) => {
    if (init.method === 'PUT') throw new Error('must not overwrite');
    return Response.json({ content: Buffer.from('---\ntitle: Old\n---\nBody').toString('base64'), sha: 'changed' });
  });
  const response = await onRequestPut(await context({ ...post, sha: 'stale' }, 'PUT'));
  expect(response.status).toBe(409);
});
it('saves settings in one commit while retaining unrelated fields', async () => {
  const ctx = await context({}, 'GET');
  vi.stubGlobal('fetch', async url => {
    if (url.includes('/git/ref/')) return Response.json({ object: { sha: 'head' } });
    const text = url.includes('_config.anzhiyu.yml') ? 'unknown: preserve\n' : 'title: Blog\nurl: https://blog.test\npermalink: custom\n';
    return Response.json({ content: Buffer.from(text).toString('base64'), sha: 'file' });
  });
  const settings = await (await settingsGet(ctx)).json();
  settings.settings.site.title = '新标题';
  const request = await context(settings, 'PUT');
  let blobs = [];
  vi.stubGlobal('fetch', async (url, init) => {
    if (url.includes('/git/ref/')) return Response.json({ object: { sha: 'head' } });
    if (url.includes('/contents/')) {
      const text = url.includes('_config.anzhiyu.yml') ? 'unknown: preserve\n' : 'title: Blog\nurl: https://blog.test\npermalink: custom\n';
      return Response.json({ content: Buffer.from(text).toString('base64'), sha: 'file' });
    }
    if (url.endsWith('/git/blobs')) { blobs.push(Buffer.from(JSON.parse(init.body).content, 'base64').toString()); return Response.json({ sha: 'blob' }); }
    if (!init.method || init.method === 'GET') return Response.json({ tree: { sha: 'tree' } });
    return Response.json({ sha: 'saved' });
  });
  expect((await settingsPut(request)).status).toBe(200);
  expect(blobs[0]).toContain('permalink: custom');
  expect(blobs[1]).toContain('unknown: preserve');
});
