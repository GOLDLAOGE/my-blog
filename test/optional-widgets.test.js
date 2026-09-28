import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const pug = require('pug');
const theme = parse(readFileSync('themes/anzhiyu/_config.yml', 'utf8'));

function render(file, page = {}) {
  return pug.renderFile('themes/anzhiyu/layout/includes/' + file + '.pug', {
    page, config: { title: 'Fixture' },
    theme: { ...theme, nav: { ...theme.nav, clock: true }, asset: { aplayer_css: '/aplayer.css', aplayer_js: '/aplayer.js', meting_js: '/meting.js' } },
    url_for: value => value, _p: key => key,
    partial: name => name === 'includes/anzhiyu/clock' ? render('anzhiyu/clock') : '',
  });
}

function browser(html, width) {
  const dom = new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>', { runScripts: 'outside-only', url: 'https://example.test/' });
  const { window } = dom;
  let currentWidth = width;
  const listeners = new Set();
  window.matchMedia = query => ({
    get matches() { return currentWidth >= Number(query.match(/\d+/)[0]); },
    addEventListener(_name, callback) { listeners.add(callback); },
    addListener(callback) { listeners.add(callback); },
  });
  const requests = [];
  const append = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = node => {
    if (node.src || node.href) requests.push(node.src || node.href);
    const result = append(node);
    if (node.tagName === 'SCRIPT') window.setTimeout(() => node.onload?.(), 0);
    return result;
  };
  function runScripts() {
    for (const script of window.document.querySelectorAll('script:not([src])')) window.eval(script.textContent);
  }
  function resize(nextWidth) {
    currentWidth = nextWidth;
    for (const listener of listeners) listener({ matches: true });
  }
  return { window, requests, runScripts, resize };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

it.each([390, 1600])('renders no weather or weather resources at %ipx, including resize and navigation', async width => {
  const app = browser(render('header/nav'), width);
  app.runScripts();
  app.resize(1800);
  app.window.document.body.insertAdjacentHTML('beforeend', render('header/nav'));
  app.runScripts();
  await flush();
  expect(app.window.document.querySelector('#he-plugin-simple')).toBeNull();
  expect(app.requests).toEqual([]);
});

it('removes the site music controls and shortcut even with legacy music settings enabled', () => {
  const app = browser(render('anzhiyu/console') + render('anzhiyu/rightmenu') + render('shortcutKey'), 1600);
  expect(app.window.document.querySelector('#consoleMusic, .music-switch, [id^="menu-music-"]')).toBeNull();
  expect(app.window.document.querySelector('#keyboard-tips').textContent).not.toContain('shortcut.play_music');
});

it('does not revive an old site player on desktop or when resized', async () => {
  const oldPlayer = '<div id="nav-music"><template id="nav-music-player"><meting-js id="old-playlist"></meting-js></template></div>';
  const app = browser(oldPlayer + render('third-party/aplayer'), 1600);
  app.runScripts();
  app.resize(1800);
  await flush();
  expect(app.window.document.querySelector('#nav-music meting-js')).toBeNull();
  expect(app.requests).toEqual([]);
});

it('loads explicitly requested article audio on mobile and reuses it after navigation', async () => {
  const app = browser(render('third-party/aplayer', { aplayer: true }), 390);
  app.runScripts();
  await flush();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
  app.runScripts();
  await flush();
  expect(app.requests).toHaveLength(3);
});

it('loads embedded article audio without requiring a page flag', async () => {
  const app = browser('<article><meting-js id="article-track"></meting-js></article>' + render('third-party/aplayer'), 390);
  app.runScripts();
  await flush();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
  expect(app.window.document.querySelector('article meting-js').id).toBe('article-track');
});

it('loads article audio after narrow PJAX navigation from a plain page', async () => {
  const app = browser(render('third-party/aplayer'), 390);
  app.runScripts();
  expect(app.requests).toEqual([]);
  const article = app.window.document.createElement('section');
  article.innerHTML = render('third-party/aplayer', { aplayer: true });
  app.window.document.body.appendChild(article);
  app.window.eval(article.querySelector('script').textContent);
  await flush();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
});

it.each([{}, { type: 'music' }])('does not load audio for a page without article audio: %j', async page => {
  const app = browser(render('third-party/aplayer', page), 1600);
  app.runScripts();
  await flush();
  expect(app.requests).toEqual([]);
});
