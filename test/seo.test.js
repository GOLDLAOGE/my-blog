import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const pug = require('pug');
it('uses the configured site description on the home page', () => {
  const helpers = {};
  runInNewContext(readFileSync('themes/anzhiyu/scripts/helpers/page.js', 'utf8'), {
    require, hexo: { extend: { helper: { register(name, helper) { helpers[name] = helper; } } } },
  });
  expect(helpers.page_description.call({ is_home: () => true, config: { description: '全站搜索描述' }, page: { title: '首页' } })).toBe('全站搜索描述');
});
it('renders the article SEO title, description and keywords into the real theme head', () => {
  const html = pug.renderFile('themes/anzhiyu/layout/includes/head.pug', {
    page: { title: '文章标题', seo_title: '搜索标题', keywords: ['关键词一','关键词二'], description: '搜索描述', path: 'post/' },
    config: { title: '站点', author: '作者', language: 'zh-CN', url: 'https://blog.test', highlight: {}, prismjs: {} },
    theme: { asset: { main_css: '/css/main.css' }, avatar: {}, post_copyright: {}, home_top: { swiper: {} }, inject: {}, aside: { enable: false } },
    site: { data: {} }, strict: true,
    is_archive: () => false, is_tag: () => false, is_category: () => false, is_current: () => false, is_home: () => false,
    is_post: () => true, page_description: () => '搜索描述', favicon_tag: () => '', urlNoIndex: () => 'https://blog.test/post/',
    partial: () => '', url_for: value => value, fragment_cache: (name, callback) => callback(),
    inject_head_js: () => '', injectHtml: () => '', __: value => value, get_page_fill_description: () => '', full_date: () => '',
  });
  expect(html).toContain('<title>搜索标题 | 站点</title>');
  expect(html).toContain('name="description" content="搜索描述"');
  expect(html).toContain('name="keywords" content="关键词一,关键词二"');
});
it('escapes punctuation in SEO descriptions only once at the HTML boundary', () => {
  const helpers = {};
  runInNewContext(readFileSync('themes/anzhiyu/scripts/helpers/page.js', 'utf8'), {
    require, hexo: { extend: { helper: { register(name, helper) { helpers[name] = helper; } } } },
  });
  const description = helpers.page_description.call({ config: {}, page: { description: 'Description "quotes" & ampersand' } });
  const html = pug.render('meta(name="description" content=description)', { description });
  expect(html).toContain('content="Description &quot;quotes&quot; &amp; ampersand"');
});
