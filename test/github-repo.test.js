import { afterEach, expect, it, vi } from 'vitest';
import { readRepositoryFile, writeRepositoryFile, writeRepositoryFiles } from '../functions/_lib/github-repo.js';
afterEach(() => vi.unstubAllGlobals());
const env = { GITHUB_REPO_TOKEN: 'test-only-token' };
it('decodes Chinese repository contents and sends the expected revision on update', async () => {
  const responses = [Response.json({ content: Buffer.from('中文正文').toString('base64'), sha: 'old' }), Response.json({ commit: { sha: 'new' } })];
  let payload;
  vi.stubGlobal('fetch', async (url, init) => {
    expect(url).toContain('/repos/GOLDLAOGE/my-blog/contents/source/_posts/test.md');
    if (init.method === 'PUT') payload = JSON.parse(init.body);
    return responses.shift();
  });
  expect(await readRepositoryFile(env, 'source/_posts/test.md')).toMatchObject({ content: '中文正文', sha: 'old' });
  expect(await writeRepositoryFile(env, { path: 'source/_posts/test.md', content: '新内容', sha: 'old', message: 'update' })).toEqual({ sha: 'new' });
  expect(payload).toMatchObject({ branch: 'main', sha: 'old' });
  expect(Buffer.from(payload.content, 'base64').toString()).toBe('新内容');
});
it('returns a safe conflict without leaking GitHub response secrets', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ message: 'test-only-token' }, { status: 409 }));
  await expect(readRepositoryFile(env, '_config.yml')).rejects.toMatchObject({ status: 409, message: '仓库已更新，请重新加载后再保存' });
});
it('commits two settings files atomically and never forces a branch update', async () => {
  const calls = [];
  const fixtures = [
    { object: { sha: 'head' } }, { tree: { sha: 'tree' } },
    { sha: 'blob1' }, { sha: 'blob2' }, { sha: 'newtree' }, { sha: 'commit' }, { object: { sha: 'commit' } },
  ];
  vi.stubGlobal('fetch', async (url, init) => { calls.push({ url, body: init.body && JSON.parse(init.body) }); return Response.json(fixtures.shift()); });
  expect(await writeRepositoryFiles(env, { head: 'head', files: [{ path: '_config.yml', content: 'a' }, { path: '_config.anzhiyu.yml', content: 'b' }], message: 'settings' })).toEqual({ sha: 'commit' });
  expect(calls.at(-1).body).toEqual({ sha: 'commit', force: false });
  expect(calls.find(call => call.url.endsWith('/git/trees')).body.tree.map(item => item.path)).toEqual(['_config.yml', '_config.anzhiyu.yml']);
});
