export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message = 'Bad request') {
  return json({ error: message }, { status: 400 });
}

export function unauthorized() {
  return json({ error: 'Authentication required' }, { status: 401 });
}

export function forbidden() {
  return json({ error: 'Forbidden' }, { status: 403 });
}

export function serverError(message = 'Internal server error') {
  return json({ error: message }, { status: 500 });
}
