/**
 * AnZhiYu
 * lazyload
 * replace src to data-lazy-src
 */

"use strict";

const urlFor = require("hexo-util").url_for.bind(hexo);

const lazyload = htmlContent => {
  const error_img = hexo.theme.config.error_img.post_page
  const bg = hexo.theme.config.lazyload.placeholder
    ? urlFor(hexo.theme.config.lazyload.placeholder)
    : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return htmlContent.replace(/<img\b[^>]*>/gi, tag => {
    const classes = tag.match(/\sclass\s*=\s*(['"])(.*?)\1/i)?.[2] || '';
    if (classes.split(/\s+/).includes('nolazyload')) return tag;
    const fallback = /\sonerror\s*=/i.test(tag) ? '' : ` onerror="this.onerror=null,this.src=&quot;${error_img}&quot;"`;
    return tag.replace(/\ssrc\s*=/i, ` src="${bg}"${fallback} data-lazy-src=`);
  });
}

hexo.extend.filter.register('after_render:html', data => {
  const { enable, field } = hexo.theme.config.lazyload
  if (!enable || field !== 'site') return
  return lazyload(data)
})

hexo.extend.filter.register('after_post_render', data => {
  const { enable, field } = hexo.theme.config.lazyload
  if (!enable || field !== 'post') return
  data.content = lazyload(data.content)
  return data
})
