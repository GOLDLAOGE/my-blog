import { requireEnv } from './env.js';
import { pagePath } from './pages.js';

const BASE = 'https://api.github.com/repos/GOLDLAOGE/my-blog';
export const contentBranch = env => env.CMS_CONTENT_BRANCH || 'main';
const pathUrl = path => path.split('/').map(encodeURIComponent).join('/');
export function conflict() { return Object.assign(new Error('仓库已更新，请重新加载后再保存'), { status: 409 }); }
export async function githubRequest(env, path, init = {}) {
  requireEnv(env, ['GITHUB_REPO_TOKEN']);
  const response = await fetch(`${BASE}${path}`, { ...init, headers: {
    accept: 'application/vnd.github+json', authorization: `Bearer ${env.GITHUB_REPO_TOKEN}`,
    'user-agent': 'personal-blog-cms', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json',
  } });
  if (!response.ok) {
    if ([409, 422].includes(response.status)) throw conflict();
    throw Object.assign(new Error(response.status === 404 ? '仓库文件不存在' : 'GitHub 请求失败，请检查令牌权限和网络'), { status: response.status === 404 ? 404 : 502 });
  }
  return response.json();
}
function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decode(text) { return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), char => char.charCodeAt(0))); }
export async function readRepositoryFile(env, path, ref = contentBranch(env)) {
  const file = await githubRequest(env, `/contents/${pathUrl(path)}?ref=${encodeURIComponent(ref)}`);
  if (typeof file.content !== 'string' || (file.encoding && file.encoding !== 'base64')) throw new Error('文件过大或格式不受支持');
  return { content: decode(file.content), sha: file.sha };
}
export async function listRepositoryPosts(env) {
  const files = await githubRequest(env, `/contents/source/_posts?ref=${encodeURIComponent(contentBranch(env))}`);
  return files.filter(file => file.type === 'file' && file.name.endsWith('.md')).map(file => ({ slug: file.name.slice(0, -3), sha: file.sha }));
}
async function pageTree(env, head) {
  const result=await githubRequest(env,`/git/trees/${encodeURIComponent(head)}?recursive=1`);
  if(result.truncated||!Array.isArray(result.tree))throw Object.assign(new Error('页面目录不完整，请稍后重试'),{status:502});
  return result.tree;
}
export async function listRepositoryPages(env, head) {
  const tree=await pageTree(env,head);
  return tree.filter(file=>file.type==='blob').flatMap(file=>{
    const match=file.path.match(/^source\/([^/]+)\/index\.md$/);if(!match)return [];
    try{if(pagePath(match[1])!==file.path)return [];}catch{return [];}
    return [{slug:match[1],path:file.path}];
  }).sort((a,b)=>a.slug.localeCompare(b.slug));
}
export async function assertPageAvailable(env, slug, head) {
  const prefix=`source/${slug.toLowerCase()}`;
  if((await pageTree(env,head)).some(file=>{const path=file.path.toLowerCase();return path===`${prefix}.md`||path===`${prefix}.html`||path===prefix||path.startsWith(prefix+'/');}))throw conflict();
}
export async function repositoryHead(env) {
  const ref = await githubRequest(env, `/git/ref/heads/${pathUrl(contentBranch(env))}`);
  return ref.object.sha;
}
export async function writeRepositoryFile(env, { path, content, sha, message }) {
  const result = await githubRequest(env, `/contents/${pathUrl(path)}`, { method: 'PUT', body: JSON.stringify({ branch: contentBranch(env), content: encode(content), ...(sha ? { sha } : {}), message }) });
  return { sha: result.commit.sha, fileSha: result.content?.sha };
}
export async function writeRepositoryFiles(env, { head, files, message }) {
  if (await repositoryHead(env) !== head) throw conflict();
  const commit = await githubRequest(env, `/git/commits/${head}`);
  const tree = [];
  for (const file of files) {
    const blob = await githubRequest(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: encode(file.content), encoding: 'base64' }) });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await githubRequest(env, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
  const newCommit = await githubRequest(env, '/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) });
  await githubRequest(env, `/git/refs/heads/${pathUrl(contentBranch(env))}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha, force: false }) });
  return { sha: newCommit.sha };
}
