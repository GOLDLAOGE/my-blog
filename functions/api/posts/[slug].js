import { json } from '../../_lib/http.js';
import { contentRoute, readJson, validation } from '../../_lib/content-api.js';
import { conflict, readRepositoryFile, writeRepositoryFile } from '../../_lib/github-repo.js';
import { postPath, parsePost, serializePost, validatePost } from '../../_lib/posts.js';

export async function onRequestGet(context) {
  return contentRoute(context, false, async () => {
    const path = validation(() => postPath(context.params.slug));
    const file = await readRepositoryFile(context.env, path);
    const { frontMatter, ...post } = parsePost(file.content);
    return json({ ...post, slug: context.params.slug, sha: file.sha });
  });
}
export async function onRequestPut(context) {
  return contentRoute(context, true, async () => {
    const input = await readJson(context.request);
    const path = validation(() => { validatePost(input); if (typeof input.sha !== 'string' || !input.sha) throw new Error('缺少文章版本，请重新加载'); return postPath(context.params.slug); });
    const file = await readRepositoryFile(context.env, path);
    if (file.sha !== input.sha) throw conflict();
    const original = parsePost(file.content);
    const content = validation(() => serializePost(input, original.frontMatter));
    const result = await writeRepositoryFile(context.env, { path, content, sha: file.sha, message: `content: update ${input.title.replace(/[\r\n]/g, ' ')}` });
    return json({ ...result, slug: context.params.slug, status: 'building' });
  });
}
