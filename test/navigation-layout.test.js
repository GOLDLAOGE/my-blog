import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

it('skips hidden menu layout on mobile and measures it when resized to desktop', () => {
  const { window } = new JSDOM('<nav id="nav"><div id="blog_name"><a><span>Blog</span></a></div><div id="menus"><a>Menu</a></div></nav>');
  let reads = 0;
  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { reads++; return this.id === 'nav' ? 1000 : 200; } });
  window.innerWidth = 390;
  const source = readFileSync('themes/anzhiyu/source/js/main.js', 'utf8');
  const adjust = source.slice(source.indexOf('  let headerContentWidth'), source.indexOf('  // 初始化右键菜单文本'));
  const adjustMenu = runInNewContext(`${adjust}\nadjustMenu`, { window, document: window.document });
  adjustMenu(true);
  expect(window.document.getElementById('nav').classList.contains('hide-menu')).toBe(true);
  expect(reads).toBe(0);
  window.innerWidth = 1440;
  adjustMenu(false);
  expect(reads).toBeGreaterThan(0);
  expect(window.document.getElementById('nav').classList.contains('hide-menu')).toBe(false);
  window.innerWidth = 390;
  reads = 0;
  adjustMenu(false);
  expect(reads).toBe(0);
});
