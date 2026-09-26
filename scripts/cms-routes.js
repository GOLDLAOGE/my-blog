const fs = require('node:fs');
const path = require('node:path');

// Hexo ignores source files whose names begin with an underscore.
hexo.extend.generator.register('cms-routes', () => ({
  path: '_routes.json',
  data: fs.readFileSync(path.join(hexo.base_dir, 'source/_routes.json'), 'utf8'),
}));
