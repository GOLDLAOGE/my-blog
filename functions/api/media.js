import { json } from '../_lib/http.js';
import { requireEnv } from '../_lib/env.js';
import { contentRoute, validation } from '../_lib/content-api.js';
import { makeMediaKey, readUpload, validateUpload } from '../_lib/media.js';

export async function onRequestPost(context) {
  return contentRoute(context, true, async () => {
    requireEnv(context.env, ['MEDIA_BUCKET']);
    const bytes = await readUpload(context.request);
    validation(() => validateUpload(bytes, context.request.headers.get('content-type')));
    const key = makeMediaKey();
    await context.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
    return json({ url: `/media/${key}` }, { status: 201 });
  });
}
