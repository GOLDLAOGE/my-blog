const { existsSync } = require('node:fs');
const { join } = require('node:path');

// Only these bundled 1440px covers have generated smaller copies. CMS uploads
// and remote images keep their original URL, without guessing variant paths.
hexo.extend.helper.register('cover_srcset', function (src) {
  if (!/^\/img\/covers\/(coffee-reading|web-notes|study-notes)\.webp$/.test(src)) return;
  const variants = [480, 768, 1120].map(width => [src.replace('.webp', `-${width}.webp`), width]);
  if (!variants.every(([url]) => existsSync(join(hexo.source_dir, url)))) return;
  const version = /^\/img\/covers\/(coffee-reading|web-notes)\.webp$/.test(src) ? '?v=perf-20260929' : '';
  return [...variants, [src, 1440]].map(([url, width]) => `${this.url_for(url)}${version} ${width}w`).join(', ');
});
