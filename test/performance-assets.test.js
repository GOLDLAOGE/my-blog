import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('compresses public theme assets while preserving inline-callable globals and leaving admin assets alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xiax-assets-'));
  try {
    for (const sub of ['css', 'js', 'admin']) mkdirSync(join(dir, sub));
    const script = '/* large comment */\nvar theme = { color: "coffee" };\nfunction readTheme() { return theme.color; }\n';
    const css = '/* large comment */\n.card { color: var(--accent); background-image: url(../img/cover.webp); padding: 0px 0px 0px 0px; }\n';
    writeFileSync(join(dir, 'js/main.js'), script);
    writeFileSync(join(dir, 'css/index.css'), css);
    writeFileSync(join(dir, 'admin/index.js'), script);
    execFileSync(process.execPath, [resolve('scripts/optimize-assets.js'), dir]);
    const js = readFileSync(join(dir, 'js/main.js'), 'utf8');
    expect(js.length).toBeLessThan(script.length);
    expect(runInNewContext(`${js};readTheme()`)).toBe('coffee');
    const output = readFileSync(join(dir, 'css/index.css'), 'utf8');
    expect(output.length).toBeLessThan(css.length);
    expect(output).toContain('var(--accent)');
    expect(output).toContain('../img/cover.webp');
    expect(readFileSync(join(dir, 'admin/index.js'), 'utf8')).toBe(script);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
