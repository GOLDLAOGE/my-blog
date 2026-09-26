import { parseDocument, stringify } from 'yaml';

export function safeUrl(value, { absolute = false } = {}) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/u.test(value)) throw new Error('链接格式不正确');
  if (!absolute && value.startsWith('/') && !value.startsWith('//')) return value;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('仅支持 HTTP/HTTPS 链接');
  return value;
}

export function postPath(slug) {
  if (typeof slug !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,119}$/u.test(slug)) throw new Error('文章标识只能包含文字、数字、横线和下划线');
  return `source/_posts/${slug}.md`;
}

const list = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(x => x.trim()).filter(Boolean) : [];
export function parsePost(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  const doc = parseDocument(match?.[1] || '');
  if (doc.errors.length) throw new Error('文章 YAML 格式错误');
  const frontMatter = doc.toJS() || {};
  if (typeof frontMatter !== 'object' || Array.isArray(frontMatter)) throw new Error('文章 front matter 必须是对象');
  return { frontMatter, title: frontMatter.title || '', date: String(frontMatter.date || ''),
    body: match ? match[2] : markdown, categories: list(frontMatter.categories), tags: list(frontMatter.tags),
    excerpt: frontMatter.excerpt || '', cover: frontMatter.cover || '', seoTitle: frontMatter.seo_title || '',
    description: frontMatter.description || '', keywords: list(frontMatter.keywords) };
}

export function validatePost(input) {
  for (const key of ['title', 'body', 'description']) {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error('标题、正文和 SEO 描述不能为空');
  }
  for (const key of ['excerpt', 'cover', 'seoTitle']) {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`${key} 必须是文本`);
  }
  if (input.title.length > 300 || input.description.length > 1000 || input.body.length > 1000000) throw new Error('文章内容超过长度限制');
  for (const key of ['categories', 'tags', 'keywords']) {
    if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key].length > 50 || input[key].some(x => typeof x !== 'string' || !x.trim() || x.length > 100))) throw new Error(`${key} 必须是文本列表`);
  }
  if (input.cover) safeUrl(input.cover);
  if (input.date && (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(input.date) || !Number.isFinite(Date.parse(input.date)))) throw new Error('日期格式不正确');
}

export function serializePost(input, original = input.frontMatter || {}) {
  // Existing posts may have no SEO description; retain them when round-tripping.
  validatePost({ ...input, description: input.description || (input.frontMatter ? input.title : '') });
  const data = { ...original, title: input.title, date: input.date || new Date().toISOString(),
    categories: input.categories || [], tags: input.tags || [], excerpt: input.excerpt || '',
    cover: input.cover || '', seo_title: input.seoTitle || '', description: input.description || '', keywords: input.keywords || [] };
  return `---\n${stringify(data)}---\n${input.body}`;
}
