import { expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
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
