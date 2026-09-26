import { validMediaKey, mediaResponse } from '../_lib/media.js';
import { requireEnv } from '../_lib/env.js';

async function serve(context, head = false) {
  const key = Array.isArray(context.params.key) ? context.params.key.join('/') : context.params.key;
  if (!validMediaKey(key)) return new Response('Not found', { status: 404 });
  try {
    requireEnv(context.env, ['MEDIA_BUCKET']);
    const url = new URL(context.request.url); url.search = '';
    const cacheKey = new Request(url, { method: 'GET' });
    const cache = globalThis.caches?.default;
    const cached = cache && await cache.match(cacheKey);
    if (cached) {
      const match = context.request.headers.get('if-none-match') === cached.headers.get('etag');
      return new Response(head || match ? null : cached.body, { status: match ? 304 : 200, headers: cached.headers });
    }
    const object = await context.env.MEDIA_BUCKET[head ? 'head' : 'get'](key);
    if (!object) return new Response('Not found', { status: 404 });
    const response = mediaResponse(object, { head, notModified: context.request.headers.get('if-none-match') === object.httpEtag });
    if (!head && response.status === 200 && cache) context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return new Response('Media service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
export const onRequestGet = context => serve(context);
export const onRequestHead = context => serve(context, true);
