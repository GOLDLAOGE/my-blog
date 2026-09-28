import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderSettings } from '../source/admin/settings.js';
import { readEditableSettings, EDITABLE_SCHEMA } from '../functions/_lib/settings.js';
afterEach(()=>vi.unstubAllGlobals());
it('omits the removed weather control from the settings form', () => {
  const dom = new JSDOM('<div id="fields"></div>');
  vi.stubGlobal('document',dom.window.document);
  const container=document.getElementById('fields');
  renderSettings(container,{schema:EDITABLE_SCHEMA,settings:readEditableSettings('title: Test','nav:\n  clock: true')},()=>{});
  expect(Boolean(container.querySelector('[data-key="nav_clock"]'))).toBe(false);
});
it('collects hidden categories, typed enums and reordered identities without losing edits', () => {
  const dom = new JSDOM('<div id="fields"></div>');
  vi.stubGlobal('document',dom.window.document);vi.stubGlobal('Event',dom.window.Event);
  const container=document.getElementById('fields');
  const get=renderSettings(container,{schema:EDITABLE_SCHEMA,settings:readEditableSettings('title: Test\nurl: https://test.example','{}')},()=>{});
  const home=container.querySelector('[data-key="home_top_title"]');
  expect(home).not.toBeNull();home.value='New home';
  container.querySelector('[data-category="appearance"]').click();
  const mode=container.querySelector('[data-key="display_mode"]');
  expect(mode.tagName).toBe('SELECT');mode.value='dark';
  const method=container.querySelector('[data-key="index_post_content_method"]');method.value='false';
  expect(container.querySelector('[data-key="theme_color_main"]').type).toBe('color');
  container.querySelector('[data-list="home_top_category"] [data-action="down"]').click();
  const result=get();
  expect(result.theme.home_top_title).toBe('New home');
  expect(result.theme.display_mode).toBe('dark');expect(result.theme.index_post_content_method).toBe(false);
  expect(result.lists.home_top_category.map(r=>r._rowId)).toEqual(['1','0','2']);
});
it('round-trips short colors and reorders existing navigation identities',()=>{
  const dom=new JSDOM('<div id="fields"></div>');vi.stubGlobal('document',dom.window.document);vi.stubGlobal('Event',dom.window.Event);
  const container=document.getElementById('fields'),settings=readEditableSettings('title: Test','theme_color:\n  main: "#abc"');
  settings.navigation=[{_rowId:'0:0',group:'One',name:'A',url:'/a/',icon:'/a.png'},{_rowId:'1:0',group:'Two',name:'B',url:'/b/',icon:'/b.png'}];
  const get=renderSettings(container,{schema:EDITABLE_SCHEMA,settings},()=>{});
  expect(get().theme.theme_color_main).toBe('#aabbcc');
  const rows=container.querySelectorAll('.link-row');expect(rows.length).toBe(2);
  rows[0].querySelector('[data-action="down"]').click();expect(get().navigation.map(r=>r._rowId)).toEqual(['1:0','0:0']);
});
