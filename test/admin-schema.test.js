import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { convertImageToWebp, insertMarkdownImage } from '../source/admin/editor.js';
afterEach(() => vi.unstubAllGlobals());
it('serves admin HTML without the public blog layout', () => {
  const html = readFileSync('public/admin/index.html', 'utf8');
  expect(html).toContain('<title>博客管理</title>');
  expect(html).toContain('name="robots" content="noindex,nofollow"');
  expect(html).not.toContain('GLOBAL_CONFIG_SITE');
});
it('resizes large images proportionally and encodes WebP before upload', async () => {
  let canvas, quality, mime, draw;
  vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 2000, close() {} }));
  vi.stubGlobal('document', { createElement() { canvas = { getContext() { return { drawImage(...args) { draw = args.slice(1); } }; }, toBlob(callback, type, q) { mime = type; quality = q; callback(new Blob(['encoded'], { type })); } }; return canvas; } });
  const result = await convertImageToWebp(new File(['source'], 'photo.png', { type: 'image/png' }));
  expect([canvas.width, canvas.height]).toEqual([2560, 1280]);
  expect(draw).toEqual([0, 0, 2560, 1280]);
  expect(mime).toBe('image/webp'); expect(quality).toBe(0.82); expect(result.type).toBe('image/webp');
});
it('rejects unsupported and oversized source images before decoding', async () => {
  await expect(convertImageToWebp(new File(['gif'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow();
  await expect(convertImageToWebp(new File([new Uint8Array(16 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }))).rejects.toThrow();
});
it('inserts escaped image alt text at the cursor without replacing other content', () => {
  const editor = { value: 'hello world', selectionStart: 5, selectionEnd: 5, setRangeText(text, start, end) { this.value = this.value.slice(0, start) + text + this.value.slice(end); }, focus() {}, dispatchEvent() {} };
  insertMarkdownImage(editor, '/media/posts/image.webp', '图片[一]');
  expect(editor.value).toBe('hello\n![图片\\[一\\]](/media/posts/image.webp)\n world');
});
