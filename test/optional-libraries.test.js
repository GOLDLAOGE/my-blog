import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import pug from 'pug';
import { parse } from 'yaml';

const theme = parse(readFileSync('themes/anzhiyu/_config.yml', 'utf8'));
const config = parse(readFileSync('_config.yml', 'utf8'));
const utils = readFileSync('themes/anzhiyu/source/js/utils.js', 'utf8');
const assets = { fancybox: '/fancybox.js', fancybox_css: '/fancybox.css', waterfall: '/waterfall.js' };

function render(file, overrides = {}) {
  return pug.renderFile(`themes/anzhiyu/layout/includes/${file}.pug`, {
    config, page: {}, site: { data: {} }, strict: true,
    theme: { ...theme, asset: assets, ...overrides },
    is_home: () => true, is_post: () => false, is_page: () => false,
    is_archive: () => false, is_tag: () => false, is_category: () => false, is_current: () => false,
    partial: () => '', url_for: value => value, _p: value => value,
    fragment_cache: (_name, callback) => callback(), injectHtml: () => '', inject_head_js: () => '',
    favicon_tag: () => '', urlNoIndex: () => 'https://example.test/', full_url_for: value => value,
    page_description: () => '', get_page_fill_description: () => '', full_date: () => '',
  });
}

function browser(html = '', overrides = {}) {
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: 'https://example.test/', runScripts: 'outside-only',
  });
  const ready = new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const helpers = {};
  runInNewContext(readFileSync('themes/anzhiyu/scripts/helpers/inject_head_js.js', 'utf8'), {
    hexo: { theme: { config: {} }, extend: { helper: { register: (name, helper) => { helpers[name] = helper; } } } },
  });
  const helperHtml = helpers.inject_head_js.call({ theme: { darkmode: {}, aside: {} } });
  window.eval(helperHtml.slice('<script>'.length, -'</script>'.length));
  const settings = new JSDOM(render('head/config', overrides)).window.document.querySelector('script').textContent;
  window.eval(`${settings}\n${utils}\nwindow.anzhiyu = anzhiyu; window.GLOBAL_CONFIG = GLOBAL_CONFIG;`);
  const requests = [];
  const append = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = element => {
    requests.push(element);
    return append(element);
  };
  const timers = [];
  window.setTimeout = callback => timers.push(callback);
  const bind = vi.fn();
  const qr = vi.fn((element, options) => { element.textContent = options.text; });
  const layout = vi.fn(element => { element.dataset.laidOut = 'true'; });
  function finish(success = true) {
    for (const element of requests) {
      if (!success) { element.onerror?.(new window.Event('error')); continue; }
      const src = element.src || '';
      if (src.endsWith('/fancybox.js')) window.Fancybox = { bind };
      if (src.includes('qrcode')) {
        window.QRCode = function (target, options) { qr(target, options); };
        window.QRCode.CorrectLevel = { H: 2 };
      }
      if (src.endsWith('/waterfall.js')) window.waterfall = layout;
      element.onload?.();
    }
  }
  return { window, ready, requests, bind, qr, layout, finish, runTimers: () => timers.splice(0).forEach(callback => callback()) };
}

const article = '<article id="article-container"><img src="/photo.webp" alt="Photo caption"></article><div id="qrcode"></div>';
const refresh = app => Promise.all([
  app.window.anzhiyu.loadLightbox(app.window.document.querySelectorAll('#article-container img')),
  app.window.anzhiyu.qrcodeCreate(),
  app.window.anzhiyu.reflashEssayWaterFall(),
]);

it('does not put unused lightbox, QR or waterfall downloads in homepage HTML', () => {
  const document = new JSDOM(render('head') + render('additional-js')).window.document;
  const urls = [...document.querySelectorAll('script[src], link[href]')].map(element => element.src || element.href);
  expect(urls.filter(url => /fancybox|qrcode|waterfall/.test(url))).toEqual([]);
});

it('does not request optional libraries while refreshing an empty homepage', async () => {
  const app = browser();
  await refresh(app);
  expect(app.requests).toHaveLength(0);
});

it.each([false, true])('initializes article images and QR once after direct/PJAX arrival (PJAX: %s)', async pjax => {
  const app = browser(pjax ? '' : article);
  if (pjax) {
    await refresh(app);
    expect(app.requests).toHaveLength(0);
    app.window.document.body.innerHTML = article;
  }
  app.window.history.replaceState({}, '', '/article/');
  const first = refresh(app);
  const second = refresh(app);
  expect(app.requests.map(element => element.src || element.href).sort()).toEqual([
    'https://cdn.cbd.int/qrcodejs@1.0.0/qrcode.min.js', 'https://example.test/fancybox.css', 'https://example.test/fancybox.js',
  ]);
  app.finish();
  await Promise.all([first, second]);
  expect(app.window.document.querySelector('[data-fancybox]').getAttribute('href')).toBe('https://example.test/photo.webp');
  expect(app.window.document.querySelector('[data-caption]').dataset.caption).toBe('Photo caption');
  expect(app.bind).toHaveBeenCalledTimes(1);
  expect(app.bind).toHaveBeenCalledWith('[data-fancybox]', { Hash: false, Thumbs: { autoStart: false } });
  expect(app.qr).toHaveBeenCalledTimes(1);
  expect(app.window.document.getElementById('qrcode').textContent).toBe('https://example.test/article/');
  app.window.document.body.innerHTML = '';
  await refresh(app);
  app.window.history.replaceState({}, '', '/next/');
  app.window.document.body.innerHTML = article;
  await refresh(app);
  expect(app.requests).toHaveLength(3);
  expect(app.window.document.getElementById('qrcode').textContent).toBe('https://example.test/next/');
  expect(app.bind).toHaveBeenCalledTimes(1);
});

it('loads Fancybox for existing gallery video links without article images', async () => {
  const app = browser('<a data-fancybox="gallery" href="/movie.mp4">Video</a>');
  const pending = refresh(app);
  expect(app.requests).toHaveLength(2);
  app.finish();
  await pending;
  expect(app.bind).toHaveBeenCalledTimes(1);
});

it('loads the lightbox when homepage search inserts its first image result', async () => {
  const app = browser(render('third-party/search/local-search') + '<div id="search-button"><button class="search">Search</button></div><button id="menu-search">Search</button>', {
    local_search: { enable: true, preload: false, CDN: '/search.json' },
  });
  await refresh(app);
  expect(app.requests).toHaveLength(0);
  app.window.fetch = async () => ({ ok: true, json: async () => [
    { title: 'Image', content: 'Photo article', url: '/article/', tags: [], oneImage: 'https://example.test/photo.webp' },
  ] });
  await app.ready;
  app.window.eval(readFileSync('themes/anzhiyu/source/js/search/local-search.js', 'utf8'));
  app.window.dispatchEvent(new app.window.Event('load'));
  app.window.document.querySelector('#search-button .search').click();
  const input = app.window.document.querySelector('#local-search-input input');
  input.value = 'photo';
  input.dispatchEvent(new app.window.Event('input'));
  await vi.waitFor(() => expect(app.window.document.querySelector('#local-search-results img')).not.toBeNull());
  expect(app.requests.map(element => element.src || element.href).sort()).toEqual([
    'https://example.test/fancybox.css', 'https://example.test/fancybox.js',
  ]);
  app.finish();
  await vi.waitFor(() => expect(app.bind).toHaveBeenCalledTimes(1));
  input.dispatchEvent(new app.window.Event('input'));
  await Promise.resolve();
  expect(app.requests).toHaveLength(2);
});

it('waits for the waterfall library before arranging gallery items and reuses it after PJAX', async () => {
  const app = browser('<ul id="waterfall"><li>Photo</li></ul>');
  const first = refresh(app);
  const second = refresh(app);
  app.runTimers();
  expect(app.layout).not.toHaveBeenCalled();
  expect(app.requests.map(element => element.src)).toEqual(['https://example.test/waterfall.js']);
  app.finish();
  await Promise.all([first, second]);
  app.runTimers();
  expect(app.window.document.getElementById('waterfall').classList.contains('show')).toBe(true);
  expect(app.window.document.getElementById('waterfall').dataset.laidOut).toBe('true');
  app.window.document.body.innerHTML = '<ul id="waterfall"><li>Next photo</li></ul>';
  await refresh(app);
  app.runTimers();
  expect(app.requests).toHaveLength(1);
  expect(app.window.document.getElementById('waterfall').dataset.laidOut).toBe('true');
});

it('ignores old article/gallery elements when navigation finishes before a library loads', async () => {
  const app = browser(article + '<ul id="waterfall"><li>Photo</li></ul>');
  const pending = refresh(app);
  app.window.document.body.innerHTML = '';
  app.finish();
  await pending;
  app.runTimers();
  expect(app.qr).not.toHaveBeenCalled();
  expect(app.layout).not.toHaveBeenCalled();
  expect(app.bind).not.toHaveBeenCalled();
});

it('keeps image links and gallery contents usable when the optional CDN requests fail', async () => {
  const app = browser(article + '<ul id="waterfall"><li>Photo</li></ul>');
  const pending = refresh(app);
  app.finish(false);
  await pending;
  app.runTimers();
  expect(app.window.document.querySelector('#article-container a').href).toBe('https://example.test/photo.webp');
  expect(app.window.document.getElementById('waterfall').classList.contains('show')).toBe(true);
  expect(app.qr).not.toHaveBeenCalled();
});

it('preserves the configured medium-zoom behavior without fetching Fancybox', async () => {
  const document = new JSDOM(render('additional-js', { medium_zoom: true, asset: { ...assets, medium_zoom: '/medium-zoom.js' } })).window.document;
  expect(document.querySelector('script[src="/medium-zoom.js"]')).not.toBeNull();
  expect(document.querySelector('script[src="/fancybox.js"]')).toBeNull();
});
