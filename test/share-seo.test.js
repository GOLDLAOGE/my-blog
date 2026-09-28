import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const pug = require('pug');
const theme = parse(readFileSync('_config.anzhiyu.yml', 'utf8'));
const config = parse(readFileSync('_config.yml', 'utf8'));
const templateRoot = 'themes/anzhiyu/layout/';

function articleLocals(page, cached = new Map()) {
  const locals = {
    page: { tags: { data: [] }, categories: { data: [] }, ...page },
    pageTitle: page.title,
    theme: { ...theme, asset: { sharejs_css: '/css/share.css', sharejs: '/js/share.js' }, ptool: { ...theme.ptool, enable: false }, post_meta: { post: { tags: false } } },
    config,
    _p: () => 'Copyright notice',
    url_for: value => value,
    full_url_for: value => new URL(value, `${config.url}/`).href,
    is_post: () => true,
    is_page: () => false,
    is_home: () => false,
  };
  locals.partial = (name, data, options = {}) => {
    if (options.cache && cached.has(name)) return cached.get(name);
    const html = pug.renderFile(`${templateRoot}${name}`, { ...locals, ...data });
    if (options.cache) cached.set(name, html);
    return html;
  };
  return locals;
}

it('renders each article share image as its own absolute URL after another article was rendered', () => {
  const cached = new Map();
  const covers = [
    '/img/covers/web-notes.webp',
    '/img/covers/coffee-reading.webp',
    '/img/covers/study-notes.webp',
    '/media/posts/2026/09/11935150d5de44219627f2b77901a09c.webp',
    '/media/posts/2026/09/354f270c0614461a8b66cf5a3477aa51.webp',
  ];
  covers.forEach((cover, index) => {
    const html = pug.renderFile(`${templateRoot}includes/post/post-copyright.pug`, articleLocals({ title: `Article ${index}`, cover, permalink: `https://xiax.cafe/article-${index}/` }, cached));
    expect(html).toContain(`data-image="https://xiax.cafe${cover}"`);
  });
});

it('encodes the Weibo article title, canonical link, and absolute cover as separate query values', () => {
  const locals = articleLocals({ title: '咖啡 & Code #1', cover: '/img/covers/coffee-reading.webp', permalink: 'https://xiax.cafe/coffee/index.html', copyright_url: 'https://original.example/article/' });
  locals.theme.ptool = { ...theme.ptool, enable: true };
  locals.urlNoIndex = () => 'https://xiax.cafe/coffee/';
  const html = pug.renderFile(`${templateRoot}includes/post/ptool.pug`, locals);
  const href = html.match(/href="(https:\/\/service\.weibo\.com\/share\/share\.php\?[^"]+)"/)?.[1].replaceAll('&amp;', '&');
  expect(href).toBeDefined();
  const share = new URL(href);
  expect(share.searchParams.get('title')).toBe('咖啡 & Code #1');
  expect(share.searchParams.get('url')).toBe('https://xiax.cafe/coffee/');
  expect(share.searchParams.get('pic')).toBe('https://xiax.cafe/img/covers/coffee-reading.webp');
});

it('keeps the Weibo title and link when an article disables its top image', () => {
  const locals = articleLocals({ title: '无封面文章', top_img: false, permalink: 'https://xiax.cafe/no-cover/' });
  locals.theme.ptool = { ...theme.ptool, enable: true };
  locals.urlNoIndex = () => 'https://xiax.cafe/no-cover/';
  const html = pug.renderFile(`${templateRoot}includes/post/ptool.pug`, locals);
  const href = html.match(/href="(https:\/\/service\.weibo\.com\/share\/share\.php\?[^"]+)"/)?.[1].replaceAll('&amp;', '&');
  const share = new URL(href);
  expect(share.searchParams.get('title')).toBe('无封面文章');
  expect(share.searchParams.get('url')).toBe('https://xiax.cafe/no-cover/');
  expect(share.searchParams.get('pic')).toBe('');
});

it('renders the same clean article URL in og:url and canonical', () => {
  const locals = articleLocals({ title: 'Article', cover: '/img/covers/web-notes.webp' });
  Object.assign(locals, {
    url: 'https://xiax.cafe/article/index.html',
    urlNoIndex: () => 'https://xiax.cafe/article/',
    page_description: () => 'Description',
  });
  const html = pug.render('include /themes/anzhiyu/layout/includes/head/Open_Graph.pug\nlink(rel="canonical" href=urlNoIndex())', { ...locals, basedir: process.cwd() });
  expect(html).toContain('property="og:url" content="https://xiax.cafe/article/"');
  expect(html).toContain('rel="canonical" href="https://xiax.cafe/article/"');
});

it('emits escaped canonical public routes while excluding admin, API, preview, and error pages', () => {
  const path = 'scripts/sitemap.js';
  let afterGenerate;
  let sitemap;
  if (existsSync(path)) {
    runInNewContext(readFileSync(path, 'utf8'), {
      hexo: {
        config,
        extend: { filter: { register(name, callback) { if (name === 'after_generate') afterGenerate = callback; } } },
        route: {
          list: () => ['index.html', '2026/09/28/coffee/index.html', 'tags/咖啡 & 阅读/index.html', 'archives/index.html', 'about/index.html', 'admin/index.html', 'api/posts/index.html', 'preview/index.html', 'test/index.html', 'drafts/private/index.html', '404.html', '404/index.html', '500.html'],
          set(name, data) { if (name === 'sitemap.xml') sitemap = data; },
        },
      },
      URL,
    });
  }
  expect(afterGenerate).toBeTypeOf('function');
  afterGenerate();
  expect(sitemap).toContain('<loc>https://xiax.cafe/</loc>');
  expect(sitemap).toContain('<loc>https://xiax.cafe/2026/09/28/coffee/</loc>');
  expect(sitemap).toContain('<loc>https://xiax.cafe/tags/%E5%92%96%E5%95%A1%20&amp;%20%E9%98%85%E8%AF%BB/</loc>');
  expect(sitemap).toContain('<loc>https://xiax.cafe/archives/</loc>');
  expect(sitemap).toContain('<loc>https://xiax.cafe/about/</loc>');
  expect(sitemap).not.toMatch(/<loc>[^<]*(?:admin|api|preview|test|drafts|404|500)/);
});

it('publishes a robots sitemap declaration without placeholder verification tags', () => {
  const robots = existsSync('source/robots.txt') ? readFileSync('source/robots.txt', 'utf8') : '';
  const verification = pug.renderFile(`${templateRoot}includes/head/site_verification.pug`, { theme });
  expect(robots).toContain('Sitemap: https://xiax.cafe/sitemap.xml');
  expect(verification).not.toContain('content="xxx"');
  expect(verification).not.toContain('content="code-xxx"');
});
