import { expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { parsePost, serializePost } from '../functions/_lib/posts.js';
import { parsePage, serializePage } from '../functions/_lib/pages.js';

it.each(['building-a-small-blog', 'organizing-study-notes', 'coffee-and-reading'])('keeps editable sample content and its local cover for %s', slug => {
  const post = parsePost(readFileSync(new URL(`../source/_posts/${slug}.md`, import.meta.url), 'utf8'));
  expect(post.title.trim()).not.toBe('');
  expect(post.body.trim()).not.toBe('');
  expect(post.categories.length).toBeGreaterThan(0);
  expect(post.cover).toMatch(/^\/img\/covers\//);
  expect(statSync(new URL(`../source${post.cover}`, import.meta.url)).isFile()).toBe(true);
  expect(parsePost(serializePost(post))).toMatchObject({
    title: post.title, categories: post.categories, tags: post.tags,
    cover: post.cover, excerpt: post.excerpt, body: post.body,
  });
});

it.each([
  ['start-first-week-checklist', 'start-first-week'],
  ['seo-search-intent-keyword-sheet', 'seo-keyword-research'],
  ['acquisition-inquiry-workflow', 'acquisition-inquiry'],
  ['ai-inquiry-human-review', 'ai-human-review'],
])('uses a distinct optimized cover for the %s sample post', (slug, coverName) => {
  const post = parsePost(readFileSync(new URL(`../source/_posts/${slug}.md`, import.meta.url), 'utf8'));
  expect(post.cover).toBe(`/img/covers/${coverName}.webp`);
  for (const suffix of ['', '-480', '-768', '-1120']) {
    const image = new URL(`../source/img/covers/${coverName}${suffix}.webp`, import.meta.url);
    expect(statSync(image).size).toBeLessThan(150_000);
  }
});

it('removes the two old test posts while preserving their public URLs as redirects', () => {
  const redirects = readFileSync(new URL('../source/_redirects', import.meta.url), 'utf8');
  for (const [slug, oldUrl] of [
    ['hello-world', '/2026/09/27/hello-world/'],
    ['cms-test-post', '/2026/09/26/cms-test-post/'],
  ]) {
    expect(existsSync(new URL(`../source/_posts/${slug}.md`, import.meta.url))).toBe(false);
    expect(redirects).toContain(`${oldUrl} /archives/ 301`);
  }
});

it('keeps the about page editable as ordinary Markdown', () => {
  const markdown = readFileSync(new URL('../source/about/index.md', import.meta.url), 'utf8');
  const page = parsePage(markdown);
  expect(page.type).toBe('');
  expect(page.body.trim()).not.toBe('');
  expect(parsePage(serializePage(page, markdown))).toEqual(page);
});

it.each(['categories', 'tags'])('uses the theme index type for %s', type => {
  const page = parsePage(readFileSync(new URL(`../source/${type}/index.md`, import.meta.url), 'utf8'));
  expect(page.type).toBe(type);
});
