import { expect, it } from 'vitest';
import { settingsGroups } from '../source/admin/settings.js';
import { SITE_FIELDS, THEME_FIELDS, EDITABLE_SCHEMA } from '../functions/_lib/settings.js';

it('places every editable field in exactly one settings category', () => {
  const groups = settingsGroups({ site: SITE_FIELDS, theme: THEME_FIELDS });
  const fields = groups.flatMap(group => group.fields);
  expect(fields.filter(field => field.scope === 'site').map(field => field.key).sort()).toEqual([...SITE_FIELDS].sort());
  expect(fields.filter(field => field.scope === 'theme').map(field => field.key).sort()).toEqual(Object.keys(THEME_FIELDS).sort());
  expect(new Set(fields.map(field => `${field.scope}.${field.key}`)).size).toBe(fields.length);
});
it('groups expanded controls by their actual frontend region', () => {
  const groups = settingsGroups(EDITABLE_SCHEMA);
  expect(groups.find(g=>g.id==='aside').fields).toContainEqual({scope:'theme',key:'aside_enable'});
  expect(groups.find(g=>g.id==='appearance').fields).toContainEqual({scope:'theme',key:'theme_color_main'});
  expect(groups.find(g=>g.id==='post').fields).toContainEqual({scope:'theme',key:'toc_post'});
  expect(groups.find(g=>g.id==='home').lists).toContain('home_top_category');
  const fields=groups.flatMap(g=>g.fields.map(f=>`${f.scope}.${f.key}`));
  expect(new Set(fields).size).toBe(SITE_FIELDS.length+Object.keys(THEME_FIELDS).length);
  expect(fields.length).toBe(new Set(fields).size);
});

it('keeps navigation and footer controls out of homepage configuration', () => {
  const groups = settingsGroups({ site: SITE_FIELDS, theme: THEME_FIELDS });
  expect(groups.find(group => group.id === 'home').fields.map(field => field.key)).toEqual([
    'index_img', 'default_top_img', 'disable_top_img', 'subtitle_enable', 'subtitle_effect', 'subtitle_loop', 'subtitle_sub', 'subtitle_type_speed', 'subtitle_back_speed',
  ]);
  expect(groups.find(group => group.id === 'links').lists).toEqual(['menu', 'navigation', 'social']);
  expect(groups.find(group => group.id === 'footer').fields.map(field => field.key)).toEqual([
    'footer_owner_enable', 'footer_since', 'footer_custom_text', 'footer_runtime_enable', 'footer_launch_time',
  ]);
});

it('does not silently lose a newly supported field', () => {
  const groups = settingsGroups({ site: ['title'], theme: { future_field: ['future', 'text'] } });
  expect(groups.flatMap(group => group.fields)).toContainEqual({ scope: 'theme', key: 'future_field' });
});
