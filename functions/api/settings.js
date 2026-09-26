import { json } from '../_lib/http.js';
import { contentRoute, readJson, validation } from '../_lib/content-api.js';
import { conflict, repositoryHead, readRepositoryFile, writeRepositoryFiles } from '../_lib/github-repo.js';
import { readEditableSettings, writeEditableSettings, SITE_FIELDS, THEME_FIELDS } from '../_lib/settings.js';

async function snapshot(env) {
  const head = await repositoryHead(env);
  const [root, theme] = await Promise.all([readRepositoryFile(env, '_config.yml', head), readRepositoryFile(env, '_config.anzhiyu.yml', head)]);
  return { head, root, theme };
}
export async function onRequestGet(context) {
  return contentRoute(context, false, async () => {
    const { head, root, theme } = await snapshot(context.env);
    return json({ head, settings: readEditableSettings(root.content, theme.content), schema: { site: SITE_FIELDS, theme: THEME_FIELDS } });
  });
}
export async function onRequestPut(context) {
  return contentRoute(context, true, async () => {
    const input = await readJson(context.request);
    const { head, root, theme } = await snapshot(context.env);
    if (input.head !== head) throw conflict();
    const output = validation(() => writeEditableSettings(root.content, theme.content, input.settings));
    const result = await writeRepositoryFiles(context.env, { head, message: 'settings: update site and theme', files: [
      { path: '_config.yml', content: output.rootYaml }, { path: '_config.anzhiyu.yml', content: output.themeYaml },
    ] });
    return json({ ...result, status: 'building' });
  });
}
