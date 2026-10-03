import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import pug from 'pug';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';

function renderHead(home, scriptEnabled = false) {
  const theme = parse(readFileSync('_config.anzhiyu.yml', 'utf8'));
  theme.asset = { main_css: '/css/index.css?v=test' };
  const html = pug.renderFile('themes/anzhiyu/layout/includes/head.pug', {
    theme, config: parse(readFileSync('_config.yml', 'utf8')),
    page: {}, site: { data: {} },
    is_home: () => home, is_post: () => !home, is_page: () => false,
    is_archive: () => false, is_tag: () => false, is_category: () => false,
    is_current: () => false, url_for: value => value,
    full_url_for: value => value, urlNoIndex: () => '/',
    page_description: () => '', get_page_fill_description: () => '',
    full_date: () => '', toc: () => '', favicon_tag: () => '',
    partial: () => '', fragment_cache: () => '',
  });
  return new JSDOM(`<head>${html}</head>`, scriptEnabled ? { runScripts: 'dangerously' } : {}).window.document;
}

it('renders homepage critical CSS before a non-blocking full stylesheet, with a working load handler', () => {
  const document = renderHead(true, true);
  const critical = document.querySelector('link[href*="/css/critical.css"]');
  expect(critical).not.toBeNull();
  expect(critical.rel).toBe('stylesheet');
  const full = document.querySelector('link[href*="/css/index.css"]');
  expect(full.media).toBe('print');
  expect(critical.compareDocumentPosition(full) & 4).toBe(4);
  full.dispatchEvent(new document.defaultView.Event('load'));
  expect(full.media).toBe('all');
});

it('keeps full CSS available with JavaScript disabled and on direct inner-page loads', () => {
  const home = renderHead(true);
  const fallback = home.querySelector('noscript link[href*="/css/index.css"]');
  expect(fallback).not.toBeNull();
  expect(fallback.rel).toBe('stylesheet');
  expect(fallback.media).toBe('');
  const post = renderHead(false);
  expect(post.querySelector('link[href*="/css/critical.css"]')).toBeNull();
  const full = post.querySelector('link[href*="/css/index.css"]');
  expect(full.rel).toBe('stylesheet');
  expect(full.media).toBe('');
});

it('uses a full navigation if an article is opened before the deferred theme loads', () => {
  const document = renderHead(true);
  const full = document.querySelector('link[href*="/css/index.css"]');
  const html = pug.renderFile('themes/anzhiyu/layout/includes/third-party/pjax.pug', {
    theme: { pjax: {}, comments: {}, asset: { pjax: '/pjax.js' } }, url_for: value => value,
  });
  const script = new JSDOM(html).window.document.querySelector('script:not([src])').textContent;
  const requests = [];
  const navigations = [];
  // Pjax and location are the two browser navigation boundaries.
  const context = { document, window: { location: { assign: href => navigations.push(href) } },
    Pjax: class { loadUrl(href) { requests.push(href); } },
  };
  runInNewContext(script, context);
  context.pjax.loadUrl('/article/');
  expect(navigations).toEqual(['/article/']);
  expect(requests).toEqual([]);
  full.media = 'all';
  context.pjax.loadUrl('/other-article/');
  expect(requests).toEqual(['/other-article/']);
  expect(navigations).toEqual(['/article/']);
});
