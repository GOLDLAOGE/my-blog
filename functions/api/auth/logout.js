import { requireMutation, destroySession } from '../../_lib/session.js';
import { json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const owner = await requireMutation(request, env);
  if (owner instanceof Response) return owner;
  return json({ ok: true }, { headers: { 'set-cookie': await destroySession(request, env) } });
}
