import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { readEditableSettings, writeEditableSettings } from '../functions/_lib/settings.js';

const root = '# keep comment\ntitle: Old\nurl: https://blog.test\npermalink: :year/:title/\n';
const theme = 'avatar:\n  img: /old.webp\n  effect: true\nunknown:\n  value: preserve\nmenu:\n  博客:\n    首页: / || anzhiyu-icon-house\n';

describe('settings transforms', () => {
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
