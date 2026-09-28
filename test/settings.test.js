import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { THEME_FIELDS } from '../functions/_lib/settings.js';
import { readEditableSettings, writeEditableSettings } from '../functions/_lib/settings.js';

const root = '# keep comment\ntitle: Old\nurl: https://blog.test\npermalink: :year/:title/\n';
const theme = 'avatar:\n  img: /old.webp\n  effect: true\nunknown:\n  value: preserve\nmenu:\n  博客:\n    首页: / || anzhiyu-icon-house\n';

describe('settings transforms', () => {
  it('does not expose or accept the removed weather switch', () => {
    const settings = readEditableSettings(root, 'nav:\n  clock: true\n');
    expect(settings.theme).not.toHaveProperty('nav_clock');
    expect(THEME_FIELDS).not.toHaveProperty('nav_clock');
    settings.theme.nav_clock = true;
    expect(() => writeEditableSettings(root, theme, settings)).toThrow('包含未开放的设置字段');
  });
  it('matches all non-null scalar defaults from the installed theme', () => {
    const installed = parse(readFileSync(new URL('../themes/anzhiyu/_config.yml',import.meta.url),'utf8'));
    const fallback = readEditableSettings(root, '{}').theme;
    for (const [key,[path]] of Object.entries(THEME_FIELDS)) {
      const expected = path.split('.').reduce((node,part)=>node?.[part],installed);
      if (expected != null) expect(fallback[key],path).toEqual(expected);
    }
  });
  it('preserves navigation group and item attributes on rename and reorder', () => {
    const source = 'nav:\n  menu:\n    - title: Group\n      custom: keep-group\n      item:\n        - name: One\n          link: /one/\n          icon: /one.png\n          custom: keep-item\n';
    const settings = readEditableSettings(root, source);
    settings.navigation[0].name = 'Changed';
    const saved = parse(writeEditableSettings(root, source, settings).themeYaml).nav.menu[0];
    expect(saved.custom).toBe('keep-group');
    expect(saved.item[0].custom).toBe('keep-item');
  });
  it('rejects duplicate and unknown list identities', () => {
    const settings = readEditableSettings(root,theme);
    const first = settings.lists.home_top_category[0];
    settings.lists.home_top_category = [first,first];
    expect(()=>writeEditableSettings(root,theme,settings)).toThrow();
    settings.lists.home_top_category = [{...first,_rowId:'999'}];
    expect(()=>writeEditableSettings(root,theme,settings)).toThrow();
  });
  it('uses actual theme defaults for missing frontend fields', () => {
    const settings = readEditableSettings(root, theme);
    expect(settings.theme.aside_enable).toBe(true);
    expect(settings.theme.display_mode).toBe('light');
    expect(settings.theme.home_top_title).toBe('生活明朗');
    expect(settings.theme.index_post_content_method).toBe(3);
  });
  it('preserves hidden list attributes when duplicate names are reordered and renamed', () => {
    const source = 'home_top:\n  category:\n    - name: Same\n      path: /one/\n      icon: icon-one\n      class: blue\n      custom: first\n    - name: Same\n      path: /two/\n      icon: icon-two\n      class: red\n      custom: second\n';
    const settings = readEditableSettings(root, source);
    expect(settings.lists?.home_top_category).toHaveLength(2);
    settings.lists.home_top_category.reverse();
    settings.lists.home_top_category[0].name = 'Renamed';
    const saved = parse(writeEditableSettings(root, source, settings).themeYaml).home_top.category;
    expect(saved[0]).toMatchObject({ name: 'Renamed', custom: 'second', shadow: 'var(--anzhiyu-shadow-red)' });
    expect(saved[1].custom).toBe('first');
    expect(saved[0]._rowId).toBeUndefined();
  });
  it.each([
    ['theme_color_main', 'red'], ['display_mode', 'system'],
    ['runtimeshow_publish_date', '02/30/2026 00:00:00'], ['aside_card_tags_limit', 1001],
  ])('rejects invalid frontend field %s', (key, value) => {
    const settings = readEditableSettings(root, theme);
    settings.theme[key] = value;
    expect(() => writeEditableSettings(root, theme, settings)).toThrow();
  });
  it('updates selected fields while preserving comments and unrelated keys', () => {
    const settings = readEditableSettings(root, theme);
    settings.site.title = '新站点';
    settings.theme.avatar_img = '/media/new.webp';
    const output = writeEditableSettings(root, theme, settings);
    expect(output.rootYaml).toContain('# keep comment');
    expect(parse(output.rootYaml).permalink).toBe(':year/:title/');
    expect(parse(output.themeYaml).unknown.value).toBe('preserve');
    expect(parse(output.themeYaml).avatar.img).toBe('/media/new.webp');
  });
  it('round-trips navigation and social rows into theme map structures', () => {
    const settings = readEditableSettings(root, theme);
    expect(settings.menu[0]).toMatchObject({ group: '博客', name: '首页', url: '/' });
    settings.social = [{ name: 'GitHub', url: 'https://github.com/GOLDLAOGE', icon: 'anzhiyu-icon-github' }];
    const output = writeEditableSettings(root, theme, settings);
    expect(parse(output.themeYaml).social.GitHub).toContain('https://github.com/GOLDLAOGE');
  });
  it('rejects unknown settings and unsafe URL schemes', () => {
    const settings = readEditableSettings(root, theme);
    settings.site.url = 'javascript:alert(1)';
    expect(() => writeEditableSettings(root, theme, settings)).toThrow();
    settings.site.url = 'https://blog.test';
    settings.site.permalink = 'unexpected';
    expect(() => writeEditableSettings(root, theme, settings)).toThrow();
  });
});
it('preserves duplicate navigation groups and validates footer calendar dates',()=>{
  const theme='nav:\n  menu:\n    - title: Same\n      hidden: first\n      item:\n        - name: A\n          link: /a/\n          icon: /a.png\n    - title: Same\n      hidden: second\n      item:\n        - name: B\n          link: /b/\n          icon: /b.png\n';
  const root='title: Test\nurl: https://test.example';const settings=readEditableSettings(root,theme),out=writeEditableSettings(root,theme,settings);
  expect(out.themeYaml).toContain('hidden: second');
  expect((out.themeYaml.match(/title: Same/g)||[]).length).toBe(2);
});
it('rejects malformed and impossible footer runtime dates',()=>{
  const root='title: Test\nurl: https://test.example',settings=readEditableSettings(root,'{}');
  for(const date of ['not-a-date','02/30/2026 00:00:00']){settings.theme.footer_launch_time=date;expect(()=>writeEditableSettings(root,'{}',settings)).toThrow();}
});
