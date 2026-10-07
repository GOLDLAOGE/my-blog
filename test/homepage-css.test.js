import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import pug from 'pug';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';

function renderHead(home, scriptEnabled = false, path = '') {
  const theme = parse(readFileSync('_config.anzhiyu.yml', 'utf8'));
  theme.asset = { main_css: '/css/index.css?v=test' };
  const html = pug.renderFile('themes/anzhiyu/layout/includes/head.pug', {
    theme, config: parse(readFileSync('_config.yml', 'utf8')),
    page: { path }, site: { data: {} },
    is_home: () => home, is_post: () => !home, is_page: () => false,
    is_archive: () => false, is_tag: () => false, is_category: () => false,
    is_current: () => false, url_for: value => value,
    full_url_for: value => value, urlNoIndex: () => '/',
    page_description: () => '', get_page_fill_description: () => '',
    full_date: () => '', toc: () => '', favicon_tag: () => '',
    partial: () => '', fragment_cache: () => '',
  });
  return new JSDOM(`<head>${html}</head>`, { url: 'https://example.test/', ...(scriptEnabled ? { runScripts: 'dangerously' } : {}) }).window.document;
}

it('renders one complete homepage stylesheet without downloading duplicate critical or inner-page CSS', () => {
  const document = renderHead(true, true);
  expect(document.querySelector('link[href*="/css/critical.css"]')).toBeNull();
  expect(document.querySelector('link[href*="/css/index.css"]')).toBeNull();
  const styles = document.querySelectorAll('link[href*="/css/home.css"]');
  expect(styles).toHaveLength(1);
  expect(styles[0].rel).toBe('stylesheet');
  expect(styles[0].media).toBe('');
});

it('keeps home CSS available without JavaScript and full CSS on direct inner-page loads', () => {
  const home = renderHead(true);
  const fallback = home.querySelector('link[href*="/css/home.css"]');
  expect(fallback).not.toBeNull();
  expect(fallback.rel).toBe('stylesheet');
  expect(fallback.media).toBe('');
  const post = renderHead(false);
  expect(post.querySelector('link[href*="/css/critical.css"]')).toBeNull();
  const full = post.querySelector('link[href*="/css/index.css"]');
  expect(full.rel).toBe('stylesheet');
  expect(full.media).toBe('');
});

function navigationApp(path = '') {
  const document = renderHead(!path, true, path);
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
  return { document, context, requests, navigations };
}

it('loads full theme once before PJAX, keeps the latest click, then reuses it', () => {
  const { document, context, navigations, requests } = navigationApp();
  context.pjax.loadUrl('/article/');
  expect(requests).toEqual([]);
  const full = document.querySelector('link[href="/css/index.css?v=test"]');
  expect(full).not.toBeNull();
  expect(full.rel).toBe('stylesheet');
  context.pjax.loadUrl('/latest/');
  expect(document.querySelectorAll('link[href="/css/index.css?v=test"]')).toHaveLength(1);
  expect(document.querySelector('link[href*="/css/home.css"]')).not.toBeNull();
  full.dispatchEvent(new document.defaultView.Event('load'));
  expect(requests).toEqual(['/latest/']);
  expect(document.querySelector('link[href*="/css/critical.css"]')).toBeNull();
  expect(document.querySelector('link[href*="/css/home.css"]')).toBeNull();
  context.pjax.loadUrl('/other-article/');
  expect(requests).toEqual(['/latest/', '/other-article/']);
  expect(navigations).toEqual([]);
});

it('falls back to a full navigation if the on-demand stylesheet fails', () => {
  const { document, context, navigations, requests } = navigationApp();
  context.pjax.loadUrl('/article/');
  const full = document.querySelector('link[href="/css/index.css?v=test"]');
  expect(full).not.toBeNull();
  full.dispatchEvent(new document.defaultView.Event('error'));
  expect(navigations).toEqual(['/article/']);
  expect(requests).toEqual([]);
});

it('keeps the plain About page styled without JavaScript and loads full CSS before leaving it', () => {
  const direct = renderHead(false, false, 'about/index.html');
  const about = direct.querySelector('link[href*="/css/about.css"]');
  expect(about.rel).toBe('stylesheet');
  expect(about.media).toBe('');
  expect(direct.querySelector('link[href*="/css/index.css"]')).toBeNull();
  const { document, context, requests } = navigationApp('about/index.html');
  context.pjax.loadUrl('/article/');
  expect(requests).toEqual([]);
  document.querySelector('link[href="/css/index.css?v=test"]').dispatchEvent(new document.defaultView.Event('load'));
  expect(requests).toEqual(['/article/']);
  expect(document.querySelector('link[href*="/css/about.css"]')).toBeNull();
});
