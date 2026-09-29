import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import pug from 'pug';
import stylus from 'stylus';

const utils = readFileSync('themes/anzhiyu/source/js/utils.js', 'utf8');

function page() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <nav id="nav"><a id="site-name" href="/">Home</a><button id="center-console" aria-expanded="false">Console</button>
      <div id="toggle-menu"><button aria-controls="sidebar-menus" aria-expanded="false">Menu</button></div>
    </nav>
    <main><a id="outside" href="/">Outside</a></main>
    <div id="sidebar"><div id="menu-mask"></div><div id="sidebar-menus">
      <a id="first-link" href="/about/">About</a><a href="/posts/">Posts</a>
    </div></div>
    <div id="console"><button id="consoleHideAside">Aside</button>
      <button class="console-mask">Close</button></div>
  </body></html>`, { url: 'https://xiax.cafe/', runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.eval(`var rm = null;\n${utils}\nwindow.anzhiyu = anzhiyu;`);
  return dom;
}

it('opens the mobile menu with focus and closes it on Escape with focus returned', async () => {
  const { window } = page();
  const { document } = window;
  window.anzhiyu.initMobileSidebar();
  const toggle = document.querySelector('#toggle-menu button');
  const menu = document.getElementById('sidebar-menus');
  expect(menu.hasAttribute('inert')).toBe(true);
  toggle.focus();
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(menu.getAttribute('aria-hidden')).toBe('false');
  expect(menu.hasAttribute('inert')).toBe(false);
  expect(document.activeElement === toggle).toBe(true);
  await new Promise(resolve => window.setTimeout(resolve, 10));
  expect(document.activeElement.id).toBe('first-link');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(menu.hasAttribute('inert')).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

it('does not move focus into a drawer that closes before the next task', async () => {
  const { window } = page();
  const { document } = window;
  window.anzhiyu.initMobileSidebar();
  const toggle = document.querySelector('#toggle-menu button');
  toggle.focus();
  toggle.click();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(resolve => window.setTimeout(resolve, 10));
  expect(document.activeElement === toggle).toBe(true);
  expect(document.getElementById('sidebar-menus').hasAttribute('inert')).toBe(true);
});

it('cancels pending drawer focus when reinitialized before the next task', async () => {
  const { window } = page();
  const { document } = window;
  window.anzhiyu.initMobileSidebar();
  const toggle = document.querySelector('#toggle-menu button');
  toggle.focus();
  toggle.click();
  toggle.focus();
  window.anzhiyu.initMobileSidebar();
  await new Promise(resolve => window.setTimeout(resolve, 10));
  expect(document.activeElement === toggle).toBe(true);
});

it('keeps mobile menu handlers singular across repeated initialization and resets on resize', () => {
  const { window } = page();
  const { document } = window;
  const toggle = document.querySelector('#toggle-menu button');
  window.anzhiyu.initMobileSidebar();
  window.anzhiyu.initMobileSidebar();
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  window.innerWidth = 1024;
  window.dispatchEvent(new window.Event('resize'));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById('sidebar-menus').hasAttribute('inert')).toBe(true);
  expect(document.activeElement.id).toBe('site-name');
});

it('compiled sidebar stays offscreen and inert when closed without hiding focus during opening', () => {
  const source = '.limit-one-line\n  overflow hidden\n'
    + readFileSync('themes/anzhiyu/source/css/_layout/sidebar.styl', 'utf8');
  const css = stylus.render(source);
  const sidebarRule = css.match(/#sidebar #sidebar-menus\s*\{([^}]*)\}/)?.[1];
  expect(sidebarRule).toMatch(/right:\s*-300px;/);
  expect(sidebarRule).toMatch(/transition:\s*transform 0\.5s ease 0s;/);
  const inertRule = css.match(/#sidebar #sidebar-menus\[inert\]\s*\{([^}]*)\}/)?.[1] || '';
  expect(inertRule).not.toMatch(/visibility:\s*hidden;/);
});

it('keeps inactive article table-of-contents links readable before hover', () => {
  const css = stylus.render('.limit-one-line\n  overflow hidden\n' + readFileSync('themes/anzhiyu/source/css/_layout/sidebar.styl', 'utf8'));
  const rule = css.match(/#aside-content #card-toc \.toc-content \.toc-link:not\(\.active\) span\s*\{([^}]*)\}/)?.[1];
  expect(rule).toBeDefined();
  expect(rule).not.toMatch(/opacity:\s*(?:0|0\.\d+)/);
  expect(rule).not.toMatch(/filter:\s*blur\(/);
});

it('keeps archive and category dates legible without fading their text', () => {
  const css = stylus.render('.limit-one-line\n  overflow hidden\n' + readFileSync('themes/anzhiyu/source/css/_layout/sidebar.styl', 'utf8'));
  const rule = css.match(/\.card-archive-list-date,\s*span\.card-category-list-name\s*\{([^}]*)\}/)?.[1];
  expect(rule).toBeDefined();
  expect(rule).not.toMatch(/opacity:\s*(?:0|0\.\d+)/);
});

it('compiled header styles keep the mobile menu target at 44px and the console trigger hidden', () => {
  const source = '.limit-one-line\n  overflow hidden\n.limit-more-line\n  overflow hidden\n'
    + readFileSync('themes/anzhiyu/source/css/_layout/head.styl', 'utf8')
    + '\n' + readFileSync('themes/anzhiyu/source/css/_layout/nav.styl', 'utf8');
  const css = stylus.render(source)
    + '\n' + readFileSync('themes/anzhiyu/source/css/_extra/console/console.css', 'utf8');
  const menuRule = css.match(/#nav\.hide-menu #toggle-menu button\.site-page\s*\{([^}]*)\}/)?.[1];
  expect(menuRule).toMatch(/width:\s*44px;[\s\S]*height:\s*44px;/);
  const stylesheet = new JSDOM(`<style>${css}</style>`).window.document.styleSheets[0];
  for (const width of [768, 867]) {
    const hiddenWithoutState = Array.from(stylesheet.cssRules).some(rule =>
      rule.conditionText === `screen and (max-width: ${width}px)` && Array.from(rule.cssRules).some(child =>
        child.selectorText === '#center-console.widget' && child.style.display === 'none'
      )
    );
    expect(hiddenWithoutState, `console hidden at ${width}px regardless of expanded state`).toBe(true);
  }
});

it('opens and closes the desktop console with visible state, keyboard focus and hidden controls', () => {
  const { window } = page();
  const { document } = window;
  const toggle = document.getElementById('center-console');
  const consolePanel = document.getElementById('console');
  window.anzhiyu.initConsoleAccessibility();
  expect(consolePanel.hasAttribute('inert')).toBe(true);
  toggle.focus();
  toggle.click();
  expect(consolePanel.classList.contains('show')).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(document.getElementById('consoleHideAside'));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(consolePanel.classList.contains('show')).toBe(false);
  expect(consolePanel.hasAttribute('inert')).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

it('skips controls inside a hidden console card when moving focus on open', () => {
  const { window } = page();
  const { document } = window;
  document.getElementById('console').insertAdjacentHTML('afterbegin', '<div class="console-card-group" style="display:none"><a id="hidden-card-link" href="/hidden/">Hidden</a></div>');
  window.anzhiyu.initConsoleAccessibility();
  document.getElementById('center-console').click();
  expect(document.activeElement.id).toBe('consoleHideAside');
});

it('dismisses a visible shared mask with the sidebar closed', () => {
  const { window } = page();
  const { document } = window;
  window.matchMedia = () => ({ matches: true });
  window.anzhiyu.initMobileSidebar();
  const mask = document.getElementById('menu-mask');
  mask.style.display = 'block';
  mask.style.animation = 'to_show 0.5s';
  document.getElementById('outside').focus();
  mask.click();
  expect(mask.style.display).toBe('');
  expect(document.activeElement.id).toBe('outside');
});

it('focuses the console control when opened by a keyboard shortcut and does not double-toggle after reinit', () => {
  const { window } = page();
  const { document } = window;
  window.anzhiyu.initConsoleAccessibility();
  window.anzhiyu.initConsoleAccessibility();
  window.anzhiyu.switchConsole();
  expect(document.activeElement).toBe(document.getElementById('consoleHideAside'));
  window.anzhiyu.hideConsole();
  document.getElementById('center-console').click();
  expect(document.getElementById('console').classList.contains('show')).toBe(true);
});

it('allows reward console content when the nav console toggle is disabled', () => {
  const { window } = page();
  const { document } = window;
  document.getElementById('center-console').remove();
  window.eval('consoleEl = document.getElementById("console")');
  const panel = document.getElementById('console');
  panel.setAttribute('inert', '');
  window.anzhiyu.rewardShowConsole();
  expect(panel.hasAttribute('inert')).toBe(false);
  expect(panel.getAttribute('aria-hidden')).toBe('false');
});

it('scrolls immediately when reduced motion is requested', () => {
  const { window } = page();
  const calls = [];
  window.matchMedia = () => ({ matches: true });
  window.scrollTo = (...args) => calls.push(args);
  window.anzhiyu.scrollToDest(360, 500);
  expect(calls).toEqual([[0, 360]]);
});

it('renders native, named buttons for the console and mobile menu actions', () => {
  const theme = {
    nav: { enable: false, menu: [], clock: false, travelling: false },
    centerConsole: { enable: true }, reward: { QR_code: [] },
    algolia_search: { enable: false }, local_search: { enable: false }, docsearch: { enable: false },
    darkmode: { enable: true }, comment_barrage_config: { enable: true },
    nav_music: { enable: true }, shortcutKey: { enable: true },
    sidebar: { display_mode: true },
  };
  const locals = {
    theme, config: { title: 'Fixture' }, site: {},
    url_for: value => value, _p: key => key, partial: () => '',
  };
  const render = path => new JSDOM(pug.renderFile(path, locals)).window.document;
  const nav = render('themes/anzhiyu/layout/includes/header/nav.pug');
  const consolePanel = render('themes/anzhiyu/layout/includes/anzhiyu/console.pug');
  const sidebar = render('themes/anzhiyu/layout/includes/sidebar.pug');
  expect(nav.querySelector('#center-console').tagName).toBe('BUTTON');
  expect(nav.querySelector('#center-console').getAttribute('aria-controls')).toBe('console');
  expect(nav.querySelector('#toggle-menu button[aria-controls="sidebar-menus"]')).not.toBeNull();
  for (const selector of ['.darkmode_switchbutton', '.asideSwitch', '.commentBarrage', '.keyboard-switch', '.console-mask']) {
    const control = consolePanel.querySelector(selector);
    expect(control?.tagName).toBe('BUTTON');
    expect(control?.getAttribute('aria-label') || control?.getAttribute('title')).toBeTruthy();
  }
  expect(sidebar.querySelector('.darkmode_switchbutton').tagName).toBe('BUTTON');
  expect(Boolean(consolePanel.querySelector('.music-switch'))).toBe(false);
});

it('can dismiss loading when the full-page preloader is disabled', () => {
  const { window } = page();
  expect(() => window.anzhiyu.hideLoading()).not.toThrow();
});

it('keeps the right-click menu working without any site music controls', () => {
  const { window } = page();
  const html = pug.renderFile('themes/anzhiyu/layout/includes/anzhiyu/rightmenu.pug', {
    theme: { translate: {}, nav_music: {} },
  });
  window.document.body.insertAdjacentHTML('beforeend', html);
  window.document.querySelectorAll('[id^="menu-music-"]').forEach(node => node.remove());
  expect(() => window.eval(readFileSync('themes/anzhiyu/source/js/anzhiyu/right_click_menu.js', 'utf8'))).not.toThrow();
  Object.defineProperty(window.document.body, 'clientWidth', { value: 1600 });
  window.selectTextNow = '';
  window.stopMaskScroll = () => {};
  const rightMenu = window.document.getElementById('rightMenu');
  expect(() => window.oncontextmenu({ target: window.document.querySelector('main'), clientX: 20, clientY: 30 })).not.toThrow();
  expect(rightMenu.style.display).toBe('block');
  expect(window.document.getElementById('menu-copyimg').style.display).toBe('none');
  window.document.querySelector('main').insertAdjacentHTML('beforeend', '<img src="/article.webp" alt="Article image">');
  expect(() => window.oncontextmenu({ target: window.document.querySelector('main img'), clientX: 20, clientY: 30 })).not.toThrow();
  expect(window.document.getElementById('menu-copyimg').style.display).toBe('block');
});
