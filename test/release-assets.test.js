import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

it('versions only the three local assets used by the released page', () => {
  const file = resolve('themes/anzhiyu/scripts/events/cdn.js');
  const themeConfig = parse(readFileSync('_config.anzhiyu.yml', 'utf8'));
  let beforeGenerate;
  const hexo = {
    theme: { config: themeConfig },
    theme_dir: resolve('themes/anzhiyu'),
    render: { renderSync: ({ path }) => parse(readFileSync(path, 'utf8')) },
    extend: { filter: { register: (name, callback) => {
      if (name === 'before_generate') beforeGenerate = callback;
    } } },
  };
  runInNewContext(readFileSync(file, 'utf8'), { require: createRequire(file), hexo });
  beforeGenerate();
  expect(themeConfig.asset).toMatchObject({
    main_css: 'css/index.css?v=audit-20260928',
    main: 'js/main.js?v=audit-20260928',
    utils: 'js/utils.js?v=audit-20260928',
    translate: 'js/tw_cn.js',
  });
});
