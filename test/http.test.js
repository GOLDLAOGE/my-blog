import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

async function loadHttp() {
  try {
    return await import('../functions/_lib/http.js');
  } catch {
    return null;
  }
}

async function loadEnv() {
  try {
    return await import('../functions/_lib/env.js');
  } catch {
    return null;
  }
}

describe('CMS HTTP helpers', () => {
  it('returns JSON with an application/json content type', async () => {
    const http = await loadHttp();

    expect(http).not.toBeNull();
    const response = http.json({ ok: true });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('names every missing environment binding', async () => {
    const env = await loadEnv();

    expect(env).not.toBeNull();
    expect(() => env.requireEnv({}, ['MEDIA_BUCKET', 'CMS_SESSIONS']))
      .toThrow('MEDIA_BUCKET');
  });
});

describe('Pages Function routing', () => {
  it('limits Functions to API and media paths', () => {
    const routeFile = resolve(root, 'source/_routes.json');

    expect(existsSync(routeFile)).toBe(true);
    const routes = JSON.parse(readFileSync(routeFile, 'utf8'));

    expect(routes).toEqual({
      version: 1,
      include: ['/api/*', '/media/*'],
      exclude: [],
    });
  });
});
