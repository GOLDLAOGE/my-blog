export const MAX_UPLOAD = 15 * 1024 * 1024;
export function makeMediaKey(date = new Date(), random = crypto.randomUUID().replace(/-/g, '')) {
  return `posts/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${random}.webp`;
}
export function validMediaKey(key) { return /^posts\/\d{4}\/(?:0[1-9]|1[0-2])\/[a-f0-9]{32}\.webp$/.test(key); }
export function validateUpload(bytes, type) {
  if (bytes.byteLength > MAX_UPLOAD) throw Object.assign(new Error('图片不得超过 15 MB'), { status: 413 });
  const text = new TextDecoder('ascii');
  if (type !== 'image/webp' || bytes.length < 20 || text.decode(bytes.subarray(0, 4)) !== 'RIFF' || text.decode(bytes.subarray(8, 12)) !== 'WEBP' || !['VP8 ', 'VP8L', 'VP8X'].includes(text.decode(bytes.subarray(12, 16)))) throw new Error('只接受转换后的 WebP 图片');
  if (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 !== bytes.byteLength) throw new Error('WebP 文件长度不正确');
}
export async function readUpload(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_UPLOAD) throw Object.assign(new Error('图片不得超过 15 MB'), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('请选择图片'), { status: 400 });
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD) { await reader.cancel(); throw Object.assign(new Error('图片不得超过 15 MB'), { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function mediaResponse(object, { head = false, notModified = false } = {}) {
  const headers = new Headers({ 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff', etag: object.httpEtag });
  if (!notModified) headers.set('content-length', String(object.size));
  return new Response(head || notModified ? null : object.body, { status: notModified ? 304 : 200, headers });
}
