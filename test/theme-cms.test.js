import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url), pug = require('pug');
it('renders the uploaded homepage image as a background and retains CSS style configuration', () => {
  const locals = { config: { title: 'Blog' }, page: {}, theme: { index_img: '/media/test.webp', subtitle: {} },
    is_post: () => false, is_page: () => false, is_home: () => true, url_for: x => x, partial: () => '' };
  const imageHtml = pug.renderFile('themes/anzhiyu/layout/includes/header/index.pug', locals);
  expect(imageHtml).toContain('background: url(&quot;/media/test.webp&quot;) top / cover no-repeat');
  locals.theme.index_img = 'background: linear-gradient(red, blue)';
  expect(pug.renderFile('themes/anzhiyu/layout/includes/header/index.pug', locals)).toContain('style="background: linear-gradient(red, blue)"');
});
it('shows the custom excerpt before falling back to the configured body introduction', () => {
  const source = readFileSync('themes/anzhiyu/layout/includes/mixins/post-ui.pug', 'utf8') + '\n+postUI(page.posts)\n';
  const article = { title: 'Title', date: 0, path: 'post/', content: '自动正文摘要', excerpt: '自定义文章摘要', categories: { data: [] }, tags: { data: [] } };
  const locals = { site: { posts: { data: [article] } }, page: { posts: { data: [article] } },
    theme: { cover: { position: 'left' }, post_meta: { page: {} }, comments: {}, index_post_content: { method: 3, length: 100 } },
    is_home: () => true, is_current: () => false, url_for: x => x, _p: x => x, strip_html: x => x };
  expect(pug.render(source, locals)).toContain('class="content">自定义文章摘要');
  article.excerpt = '';
  expect(pug.render(source, locals)).toContain('class="content">自动正文摘要');
});
