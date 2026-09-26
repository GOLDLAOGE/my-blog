import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('generated route manifest', () => {
  it('copies the scoped Function routes into public output', () => {
    const manifest = resolve(import.meta.dirname, '..', 'public', '_routes.json');

    expect(existsSync(manifest)).toBe(true);
    expect(JSON.parse(readFileSync(manifest, 'utf8'))).toEqual({
      version: 1,
      include: ['/api/*', '/media/*'],
      exclude: [],
    });
  });
});
