import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const source = readFileSync('themes/anzhiyu/source/js/main.js', 'utf8');
// Execute the actual cover behavior and its color helpers without booting unrelated menus.
const coverSource = source.slice(source.indexOf('  const coverColor ='), source.indexOf('  //监听跳转页面输入框'));

function setup({ complete = false, naturalWidth = 0, color = [80, 100, 120], extractionError = false, coverChange = true, coffee = '#3d2118', image = true } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(image ? '<img id="post-top-bg" src="/media/cover.webp">' : '', { url: 'https://blog.test/post/', virtualConsole });
  const { document } = dom.window;
  const style = document.documentElement.style;
  style.setProperty('--anzhiyu-theme', '#008653');
  style.setProperty('--anzhiyu-main', '#fff2d8');
  style.setProperty('--xiax-coffee', coffee);
  const bg = document.getElementById('post-top-bg');
  if (bg) Object.defineProperties(bg, { complete: { value: complete, configurable: true }, naturalWidth: { value: naturalWidth, configurable: true } });
  const coverColor = runInNewContext(`${coverSource}\ncoverColor;`, {
    document,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: callback => callback(),
    anzhiyu: { initThemeColor() {} },
    GLOBAL_CONFIG: { mainTone: { mode: 'colorthief', cover_change: coverChange } },
    GLOBAL_CONFIG_SITE: { isPost: image },
    ColorThief: class { getColor() { if (extractionError) throw new Error('Canvas is tainted'); return color; } },
  });
  return { bg, style, errors, coverColor, event: type => bg.dispatchEvent(new dom.window.Event(type)) };
}

it.each([
  [[80, 100, 120], '#788ca0'],
  [[220, 180, 140], '#b48c64'],
])('keeps the extracted cover palette after a normal image load: %s', async (color, want) => {
  const page = setup({ color });
  await page.coverColor();
  page.event('load');
  expect(page.style.getPropertyValue('--anzhiyu-bar-background')).toBe(want);
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe(want);
  expect(page.errors).toEqual([]);
});

it('extracts the palette when a cached image has already loaded', async () => {
  const page = setup({ complete: true, naturalWidth: 800 });
  await page.coverColor();
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#788ca0');
});

it('uses a legible background when the cover fails to load', async () => {
  const page = setup();
  await page.coverColor();
  page.event('error');
  expect(page.style.getPropertyValue('--anzhiyu-bar-background')).toBe('#3d2118');
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#3d2118');
  expect(page.style.getPropertyValue('--anzhiyu-theme-op')).toBe('#3d211823');
  expect(page.style.getPropertyValue('--anzhiyu-theme-op-deep')).toBe('#3d2118dd');
});

it('uses the fallback for an image that failed before initialization', async () => {
  const page = setup({ complete: true });
  await page.coverColor();
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#3d2118');
});

it('uses the fallback without an uncaught exception when extraction fails', async () => {
  const page = setup({ extractionError: true });
  await page.coverColor();
  page.event('load');
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#3d2118');
  expect(page.errors).toEqual([]);
});

it('uses the configured theme color when there is no coffee color', async () => {
  const page = setup({ coffee: '', complete: true });
  await page.coverColor();
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#008653');
});

it('keeps the site accent when cover color changes are disabled', async () => {
  const page = setup({ coverChange: false });
  await page.coverColor();
  page.event('error');
  expect(page.style.getPropertyValue('--anzhiyu-bar-background')).toBe('#3d2118');
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#fff2d8');
});

it('restores the configured site palette on pages without an article cover', async () => {
  const page = setup({ image: false });
  await page.coverColor();
  expect(page.style.getPropertyValue('--anzhiyu-bar-background')).toBe('var(--anzhiyu-meta-theme-color)');
  expect(page.style.getPropertyValue('--anzhiyu-main')).toBe('#008653');
});
