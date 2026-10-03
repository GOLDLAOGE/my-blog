// Reuse the editor build's esbuild dependency; keep source files readable.
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve, extname } = require('node:path');
const { transformSync } = require('esbuild');

function optimizeAssets(publicDir) {
  for (const asset of [
    'css/index.css', 'css/critical.css', 'css/room.css', 'js/main.js', 'js/utils.js',
    'js/tw_cn.js', 'js/anzhiyu/right_click_menu.js', 'js/search/local-search.js',
  ]) {
    const file = resolve(publicDir, asset);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    if (!source.trim()) throw new Error(`Empty generated asset: ${asset}`);
    const { code } = transformSync(source, {
      loader: extname(file) === '.css' ? 'css' : 'js',
      minify: true,
      charset: 'utf8',
      target: ['chrome109', 'firefox115', 'safari16'],
      // No bundling or module format: inline HTML still calls script globals.
    });
    writeFileSync(file, code);
  }
}

// Hexo also imports files under scripts/ as plugins during initialization.
if (require.main === module) optimizeAssets(resolve(process.argv[2] || 'public'));
