hexo.extend.filter.register('after_generate', function () {
  const siteUrl = `${hexo.config.url.replace(/\/$/, '')}/`;
  const routes = hexo.route.list()
    .filter(path => /(?:^|\/)index\.html$|\.html$/.test(path))
    .filter(path => !/^(?:admin|api|preview|test|drafts|error|404|500)(?:\/|\.html$)/.test(path))
    .map(path => new URL(path.replace(/index\.html$/, ''), siteUrl).href)
    .sort();
  const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  hexo.route.set('sitemap.xml', xml);
});
