import { json } from './http.js';
import { requireOwner, requireMutation } from './session.js';

export async function contentRoute(context, mutation, handler) {
  try {
    const session = await (mutation ? requireMutation : requireOwner)(context.request, context.env);
    if (session instanceof Response) return session;
    return await handler();
  } catch (error) {
    if (error.name === 'MissingEnvironmentError') return json({ error: '后台尚未配置完整，请检查 Cloudflare 绑定及密钥' }, { status: 503 });
    return json({ error: error.status ? error.message : '服务器处理失败，请稍后重试' }, { status: error.status || 500 });
  }
}
export function validation(action) {
  try { return action(); }
  catch (error) { throw Object.assign(new Error(error.message), { status: 400 }); }
}
export async function readJson(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw Object.assign(new Error('请求必须是 JSON'), { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('请求内容为空'), { status: 400 });
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1500000) { await reader.cancel(); throw Object.assign(new Error('请求内容过大'), { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return validation(() => {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('请求必须是对象');
    return data;
  });
}
