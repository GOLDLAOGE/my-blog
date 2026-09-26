import { describe, it, expect } from 'vitest';
import { parsePost, serializePost, postPath } from '../functions/_lib/posts.js';

describe('post serialization', () => {
  it('round-trips Chinese text, quoted descriptions, categories and tags', () => {
    const input = { title: '第一篇：博客', body: '你好\n\n![图片](/media/posts/2026/09/test.webp)',
      date: '2026-09-26T12:00:00Z', categories: ['生活', '旅行'], tags: ['测试', '中文'],
      excerpt: '摘要', cover: '/media/posts/2026/09/test.webp', seoTitle: 'SEO 标题',
      description: '描述包含 "引号": 测试', keywords: ['博客', '旅行'] };
    const parsed = parsePost(serializePost(input));
    expect(parsed).toMatchObject(input);
  });
  it('preserves unknown front matter when editing and converts legacy keywords', () => {
    const post = parsePost('---\ntitle: Old\ndate: 2026-09-26\ncustom: preserve\nkeywords: a,b\n---\nBody');
    post.title = 'New';
    expect(serializePost(post)).toContain('custom: preserve');
    expect(post.keywords).toEqual(['a', 'b']);
  });
  it('rejects empty required fields and traversal slugs', () => {
    expect(() => serializePost({ title: '', body: '', description: '' })).toThrow();
    expect(() => postPath('../secret')).toThrow();
    expect(postPath('hello-world')).toBe('source/_posts/hello-world.md');
  });
});
