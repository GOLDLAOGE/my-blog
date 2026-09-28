import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const pug = require('pug');

function render(file, page = {}) {
  return pug.renderFile(`themes/anzhiyu/layout/includes/${file}.pug`, {
    page,
    theme: { asset: { aplayer_css: '/aplayer.css', aplayer_js: '/aplayer.js', meting_js: '/meting.js' }, nav_music: { id: 'playlist', server: 'netease', volume: 0.7 } },
    url_for: value => value,
  });
}

function browser(html, width) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/' });
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

it('avoids weather resources at 1400px and loads them once when eligible', async () => {
  const app = browser(render('anzhiyu/clock'), 390);
  app.runScripts();
  expect(app.window.document.querySelectorAll('script[src*="qweather"], link[href*="qweather"]').length).toBe(0);
  expect(app.requests).toEqual([]);
  app.resize(1400);
  await flush();
  expect(app.requests).toEqual([]);
  app.resize(1401);
  await flush();
  expect(app.requests).toEqual([
    'https://widget.qweather.net/simple/static/css/he-simple.css?v=1.4.0',
    'https://widget.qweather.net/simple/static/js/he-simple.js?v=1.4.0',
  ]);
  app.resize(1600);
  await flush();
  expect(app.requests).toHaveLength(2);
  const nextHeader = app.window.document.createElement('header');
  nextHeader.innerHTML = render('anzhiyu/clock');
  app.window.document.body.appendChild(nextHeader);
  app.window.eval(nextHeader.querySelector('script').textContent);
  expect(app.window.document.querySelectorAll('#he-plugin-simple')).toHaveLength(1);
  expect(app.requests).toHaveLength(2);
});

it('avoids nav music resources and player creation at 1200px, then initializes once', async () => {
  const app = browser(render('music') + render('third-party/aplayer'), 390);
  app.runScripts();
  expect(app.window.document.querySelectorAll('script[src="/aplayer.js"], script[src="/meting.js"], link[href="/aplayer.css"]').length).toBe(0);
  expect(app.window.document.querySelector('#nav-music meting-js')).toBeNull();
  expect(app.requests).toEqual([]);
  app.resize(1200);
  await flush();
  expect(app.requests).toEqual([]);
  app.resize(1201);
  await flush();
  expect(app.window.document.querySelector('#nav-music meting-js')).not.toBeNull();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
  app.resize(1600);
  await flush();
  expect(app.requests).toHaveLength(3);
});

it('loads explicitly requested article audio on mobile and reuses it after navigation', async () => {
  const app = browser(render('music') + render('third-party/aplayer', { aplayer: true }), 390);
  app.runScripts();
  await flush();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
  expect(app.window.document.querySelector('#nav-music meting-js')).toBeNull();
  app.runScripts();
  await flush();
  expect(app.requests).toHaveLength(3);
});

it('loads article audio after narrow PJAX navigation from a plain page', async () => {
  const app = browser(render('music') + render('third-party/aplayer'), 390);
  app.runScripts();
  expect(app.requests).toEqual([]);
  const article = app.window.document.createElement('section');
  article.innerHTML = render('third-party/aplayer', { aplayer: true });
  app.window.document.body.appendChild(article);
  app.window.eval(article.querySelector('script').textContent);
  await flush();
  expect(app.requests).toEqual(['https://example.test/aplayer.css', 'https://example.test/aplayer.js', 'https://example.test/meting.js']);
  expect(app.window.document.querySelector('#nav-music meting-js')).toBeNull();
});

it('announces nav audio readiness only after the deferred scripts finish loading', async () => {
  const app = browser(render('music') + render('third-party/aplayer', { aplayer: true }), 390);
  const ready = [];
  app.window.addEventListener('optional-audio-ready', () => ready.push('ready'));
  app.runScripts();
  app.resize(1201);
  expect(ready).toEqual([]);
  await flush();
  expect(ready).toEqual(['ready']);
});

it('does not load nav audio on desktop when the nav player is disabled', async () => {
  const app = browser(render('third-party/aplayer'), 1600);
  app.runScripts();
  await flush();
  expect(app.requests).toEqual([]);
});
