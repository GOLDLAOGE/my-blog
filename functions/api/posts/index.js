import { json } from '../../_lib/http.js';
import { contentRoute, readJson, validation } from '../../_lib/content-api.js';
import { listRepositoryPosts, readRepositoryFile, writeRepositoryFile } from '../../_lib/github-repo.js';
import { postPath, parsePost, serializePost, validatePost } from '../../_lib/posts.js';

export async function onRequestGet(context) {
  return contentRoute(context, false, async () => {
    const files = await listRepositoryPosts(context.env), posts = [];
    for (let i = 0; i < files.length; i += 4) {
      posts.push(...await Promise.all(files.slice(i, i + 4).map(async file => {
        const data = await readRepositoryFile(context.env, postPath(file.slug));
        const post = parsePost(data.content);
        return { slug: file.slug, sha: data.sha, title: post.title, date: post.date, categories: post.categories, tags: post.tags };
      })));
    }
    return json({ posts: posts.sort((a, b) => b.date.localeCompare(a.date)) });
  });
}
export async function onRequestPost(context) {
  return contentRoute(context, true, async () => {
    const input = await readJson(context.request);
    const { path, content } = validation(() => { validatePost(input); return { path: postPath(input.slug), content: serializePost(input, {}) }; });
    const result = await writeRepositoryFile(context.env, { path, content, message: `content: publish ${input.title.replace(/[\r\n]/g, ' ')}` });
    return json({ ...result, slug: input.slug, status: 'building' }, { status: 201 });
  });
}
