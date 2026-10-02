import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import pug from 'pug';
import { parse } from 'yaml';

const theme = parse(readFileSync('_config.anzhiyu.yml', 'utf8'));
const config = parse(readFileSync('_config.yml', 'utf8'));
const helpers = {};
const helperFile = resolve('themes/anzhiyu/scripts/helpers/cover-srcset.js');
if (existsSync(helperFile)) runInNewContext(readFileSync(helperFile, 'utf8'), {
  require: createRequire(helperFile),
  hexo: { source_dir: resolve('source'), extend: { helper: { register: (name, fn) => { helpers[name] = fn.bind({ url_for: value => value }); } } } },
});

function lazyFilter(html) {
  const filters = {};
  const file = resolve('themes/anzhiyu/scripts/filters/post_lazyload.js');
  runInNewContext(readFileSync(file, 'utf8'), {
    require: createRequire(file),
    hexo: { config, theme: { config: theme }, extend: { filter: { register: (name, fn) => { filters[name] = fn; } } } },
  });
  return filters['after_render:html'](html);
}

function renderTop(overrides = {}) {
  const html = pug.renderFile('themes/anzhiyu/layout/includes/top/top.pug', {
    theme: { ...theme, ...overrides }, site: { data: {} }, url_for: value => value,
    sort_attr_post: () => [{ path: '/post/', title: 'Post', cover: '/img/covers/web-notes.webp' }],
    ...helpers,
  });
  return new JSDOM(lazyFilter(html)).window.document;
}

it('does not enable a full-screen wait for slow third-party resources', () => {
  expect(theme.preloader.enable).toBe(false);
});

it('discovers the homepage LCP cover from initial HTML with high priority, while hidden cards stay lazy', () => {
  const document = renderTop();
  const hero = document.querySelector('.todayCard-cover');
  expect(hero.getAttribute('src')).toBe('/img/covers/coffee-reading.webp');
  expect(hero.hasAttribute('data-lazy-src')).toBe(false);
  expect(hero.getAttribute('loading')).toBe('eager');
  expect(hero.getAttribute('width')).toBe('1440');
  expect(hero.getAttribute('height')).toBe('810');
  expect(hero.getAttribute('fetchpriority')).toBe('high');
  expect(document.querySelector('.topGroup .post_bg').getAttribute('data-lazy-src')).toBe('/img/covers/web-notes.webp');
  expect(document.querySelector('.home-brand-icon').hasAttribute('data-lazy-src')).toBe(false);
});

it('serves real smaller cover variants without changing arbitrary CMS or remote images', () => {
  const hero = renderTop().querySelector('.todayCard-cover');
  expect(hero.getAttribute('srcset')).toBe('/img/covers/coffee-reading-480.webp?v=perf-20260929 480w, /img/covers/coffee-reading-768.webp?v=perf-20260929 768w, /img/covers/coffee-reading-1120.webp?v=perf-20260929 1120w, /img/covers/coffee-reading.webp?v=perf-20260929 1440w');
  expect(hero.getAttribute('sizes')).toContain('100vw');
  for (const candidate of hero.getAttribute('srcset').split(', ')) expect(existsSync(`source${candidate.split(' ')[0].split('?')[0]}`)).toBe(true);
  for (const image of ['/media/posts/custom.webp', 'https://images.example/cover.webp']) {
    const document = renderTop({ home_top: { ...theme.home_top, banner: { ...theme.home_top.banner, image } } });
    const custom = document.querySelector('.todayCard-cover');
    expect(custom.getAttribute('src')).toBe(image);
    expect(custom.hasAttribute('srcset')).toBe(false);
    expect(custom.hasAttribute('width')).toBe(false);
  }
});

it.each(['start-first-week', 'seo-keyword-research', 'acquisition-inquiry', 'ai-human-review'])('serves responsive variants for the %s editorial cover', name => {
  const srcset = helpers.cover_srcset(`/img/covers/${name}.webp`);
  expect(srcset).toBe(`/img/covers/${name}-480.webp 480w, /img/covers/${name}-768.webp 768w, /img/covers/${name}-1120.webp 1120w, /img/covers/${name}.webp 1440w`);
});

it('keeps the first-screen responsive covers within a mobile transfer budget', () => {
  for (const [name, max768, max1120] of [
    ['coffee-reading', 30_000, 48_000],
    ['web-notes', 29_000, 44_000],
  ]) {
    expect(statSync(`source/img/covers/${name}-768.webp`).size).toBeLessThan(max768);
    expect(statSync(`source/img/covers/${name}-1120.webp`).size).toBeLessThan(max1120);
  }
});

it('loads the header logo immediately even when site-wide lazy loading is enabled', () => {
  const html = pug.renderFile('themes/anzhiyu/layout/includes/header/nav.pug', {
    theme, config, url_for: value => value, _p: value => value, partial: () => '',
  });
  const logo = new JSDOM(lazyFilter(html)).window.document.querySelector('.site-brand-icon');
  expect(logo.getAttribute('src')).toBe(theme.favicon);
  expect(logo.hasAttribute('data-lazy-src')).toBe(false);
});

it('keeps lazy-loading decisions per image and preserves its error handler', () => {
  const html = '<img class="post_bg" src="/first.webp" onerror="this.src=\'/fallback.webp\'">'
    + '<img src="/hero.webp" class="hero nolazyload">'
    + '<img class="post_bg" src="/last.webp">';
  const images = new JSDOM(lazyFilter(html)).window.document.querySelectorAll('img');
  expect(images[0].getAttribute('data-lazy-src')).toBe('/first.webp');
  expect(images[0].getAttribute('onerror')).toBe("this.src='/fallback.webp'");
  expect(images[1].getAttribute('src')).toBe('/hero.webp');
  expect(images[1].hasAttribute('data-lazy-src')).toBe(false);
  expect(images[2].getAttribute('data-lazy-src')).toBe('/last.webp');
});

it('starts the first article cover early without downloading the rest of the list', () => {
  const posts = [0, 1].map(i => ({ title: `Post ${i}`, path: `/post-${i}/`, cover: '/img/covers/web-notes.webp', date: i, categories: { data: [] }, tags: { data: [] }, content: 'Text' }));
  const html = pug.render('include /themes/anzhiyu/layout/includes/mixins/post-ui.pug\n+postUI(page.posts)', {
    basedir: process.cwd(), theme: { ...theme, post_meta: { page: {} } }, config,
    site: { posts: { data: posts } }, page: { posts: { data: posts } },
    url_for: value => value, is_current: () => true, is_home: () => true, _p: value => value, strip_html: value => value,
    ...helpers,
  });
  const images = new JSDOM(lazyFilter(html)).window.document.querySelectorAll('.post_bg');
  expect(images[0].getAttribute('src')).toBe('/img/covers/web-notes.webp');
  expect(images[0].getAttribute('loading')).toBe('eager');
  expect(images[0].getAttribute('srcset')).toContain('web-notes-480.webp?v=perf-20260929 480w');
  expect(images[1].getAttribute('data-lazy-src')).toBe('/img/covers/web-notes.webp');
  expect(images[1].hasAttribute('srcset')).toBe(false);
});
