import { requireOwner } from '../_lib/session.js';
import { json, serverError } from '../_lib/http.js';

export async function onRequestGet({ request, env }) {
  try {
    const owner = await requireOwner(request, env);
    return owner instanceof Response ? owner : json({ login: owner.login, csrf: owner.csrf });
  } catch {
    return serverError('后台尚未配置，请完成 KV 绑定和会话密钥设置。');
  }
}
