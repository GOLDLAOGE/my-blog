import { expect, it } from 'vitest';
import { makeMediaKey, validateUpload, validMediaKey, mediaResponse } from '../functions/_lib/media.js';
import { onRequestPost } from '../functions/api/media.js';
import { onRequestGet } from '../functions/media/[[key]].js';
import { authEnv } from './helpers.js';
import { createSession } from '../functions/_lib/session.js';
const webp = Uint8Array.from(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'));
it('validates WebP bytes and refuses mislabeled or oversized files', () => {
  expect(() => validateUpload(webp, 'image/webp')).not.toThrow();
  expect(() => validateUpload(webp, 'image/png')).toThrow();
  expect(() => validateUpload(new Uint8Array(16 * 1024 * 1024), 'image/webp')).toThrow();
  expect(() => validateUpload(new TextEncoder().encode('not an image'), 'image/webp')).toThrow();
});
it('generates safe immutable keys and rejects traversal', () => {
  expect(makeMediaKey(new Date('2026-09-26T12:00:00Z'), 'a'.repeat(32))).toBe('posts/2026/09/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp');
  expect(validMediaKey('../config.webp')).toBe(false);
  expect(validMediaKey('posts/2026/09/../../config.webp')).toBe(false);
  const response = mediaResponse({ body: webp, size: webp.length, httpEtag: '"test"' });
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(response.headers.get('cache-control')).toContain('immutable');
});
it('uploads authenticated WebP and returns a same-origin media URL', async () => {
  const env = authEnv(), session = await createSession(env);
  let saved;
  env.MEDIA_BUCKET = { put: async (key, bytes, options) => { saved = { key, bytes, options }; } };
  const request = new Request('https://blog.test/api/media', { method: 'POST', body: webp, headers: {
    cookie: session.cookie.split(';')[0], origin: 'https://blog.test', 'x-cms-csrf': session.csrf, 'content-type': 'image/webp',
  } });
  const response = await onRequestPost({ env, request });
  expect(response.status).toBe(201);
  expect((await response.json()).url).toMatch(/^\/media\/posts\/2026\/09\/[a-f0-9]{32}\.webp$/);
  expect(saved.options.httpMetadata.contentType).toBe('image/webp');
  expect(saved.bytes).toEqual(webp);
});
it('returns 404 for missing R2 objects and rejects unsafe paths before lookup', async () => {
  const env = { MEDIA_BUCKET: { get: async () => null } };
  const request = new Request('https://blog.test/media/posts/2026/09/' + 'a'.repeat(32) + '.webp');
  expect((await onRequestGet({ request, env, params: { key: ['posts', '2026', '09', 'a'.repeat(32) + '.webp'] } })).status).toBe(404);
  expect((await onRequestGet({ request, env: {}, params: { key: ['..', 'private'] } })).status).toBe(404);
});
