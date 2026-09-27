import { afterEach, expect, it, vi } from 'vitest';
import { authEnv } from './helpers.js';
import { createSession } from '../functions/_lib/session.js';
import { onRequestGet as listGet, onRequestPost } from '../functions/api/pages/index.js';
import { onRequestGet, onRequestPut } from '../functions/api/pages/[slug].js';
import { listRepositoryPages, assertPageAvailable } from '../functions/_lib/github-repo.js';
afterEach(()=>vi.unstubAllGlobals());
const page={title:'About',body:'# Hello',description:'SEO',keywords:[],seoTitle:'',top_img:'',aside:true,comments:false,type:''};
async function context(data={},method='GET',slug='about'){
  const env={...authEnv(),GITHUB_REPO_TOKEN:'fixture-token'};const session=await createSession(env);
  return {env,params:{slug},request:new Request(`https://blog.test/api/pages/${slug}`,{method,headers:{cookie:session.cookie.split(';')[0],origin:'https://blog.test','x-cms-csrf':session.csrf,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data)})})};
}
function repository({text='---\ntitle: About\n---\nOriginal',friendsStatus=404,changed=false,existing=true}={}){
  const state={blobs:[],trees:[],patches:[],reads:[],refs:0};
  vi.stubGlobal('fetch',async(url,init={})=>{
    state.reads.push(url);
    if(url.includes('/git/ref/'))return Response.json({object:{sha:changed&&++state.refs>1?'changed':'head'}});
    if(url.includes('/git/trees/')&&url.includes('recursive'))return Response.json({truncated:false,tree:existing?[{path:'source/about/index.md',type:'blob'},{path:'source/admin/index.md',type:'blob'},{path:'source/_posts/a.md',type:'blob'}]:[]});
    if(url.includes('/contents/source/_data/link.yml'))return friendsStatus===200?Response.json({content:Buffer.from('- class_name: Friends\n  link_list: []').toString('base64'),sha:'friends'}):Response.json({message:'missing'},{status:friendsStatus});
    if(url.includes('/contents/'))return existing?Response.json({content:Buffer.from(text).toString('base64'),sha:'file'}):Response.json({message:'missing'},{status:404});
    if(url.endsWith('/git/blobs')){state.blobs.push(Buffer.from(JSON.parse(init.body).content,'base64').toString());return Response.json({sha:'blob'+state.blobs.length});}
    if(url.endsWith('/git/trees')){state.trees.push(JSON.parse(init.body));return Response.json({sha:'tree'});}
    if(url.endsWith('/git/commits'))return Response.json({sha:'saved'});
    if(init.method==='PATCH'){state.patches.push(JSON.parse(init.body));return Response.json({object:{sha:'saved'}});}
    return Response.json({tree:{sha:'base'}});
  });return state;
}
it('rejects unauthorized page reads and mutations before GitHub',async()=>{
  vi.stubGlobal('fetch',()=>{throw new Error('must not access GitHub');});
  const ctx={env:authEnv(),params:{slug:'about'},request:new Request('https://blog.test/api/pages/about')};
  expect((await listGet(ctx)).status).toBe(401);expect((await onRequestGet(ctx)).status).toBe(401);
  const other=await context({head:'head',slug:'about',page},'PUT');
  const id=other.request.headers.get('cookie').split('=')[1].split('.')[0];
  const saved=await other.env.CMS_SESSIONS.get(`session:${id}`,'json');
  await other.env.CMS_SESSIONS.put(`session:${id}`,JSON.stringify({...saved,login:'someone-else'}));
  expect((await onRequestPut(other)).status).toBe(403);
  for(const header of ['x-cms-csrf','origin']){const ctx=await context({head:'head',slug:'about',page},'PUT');ctx.request.headers.delete(header);expect((await onRequestPut(ctx)).status).toBe(403);}
});
it('lists only safe pages and reads ordinary pages without friend data',async()=>{
  const state=repository();const list=await (await listGet(await context())).json();
  expect(list).toMatchObject({head:'head',pages:[{slug:'about',path:'source/about/index.md'}]});
  const result=await(await onRequestGet(await context())).json();expect(result.page.title).toBe('About');expect(result.friends).toBeUndefined();
  expect(state.reads.some(url=>url.includes('_data'))).toBe(false);
});
it('returns 409 instead of overwriting stale snapshots or existing new-page slugs',async()=>{
  const state=repository();expect((await onRequestPut(await context({head:'stale',slug:'about',page},'PUT'))).status).toBe(409);
  expect((await onRequestPost(await context({head:'head',slug:'about',page},'POST'))).status).toBe(409);expect(state.patches).toHaveLength(0);
});
it('does not overwrite when head changes immediately before writing',async()=>{
  const state=repository({changed:true});expect((await onRequestPut(await context({head:'head',slug:'about',page},'PUT'))).status).toBe(409);expect(state.patches).toHaveLength(0);
});
it('creates a new ordinary page without changing friend data',async()=>{
  const state=repository({existing:false});const response=await onRequestPost(await context({head:'head',slug:'about',page},'POST'));
  expect(response.status).toBe(201);expect(await response.json()).toMatchObject({sha:'saved',status:'building'});
  expect(state.trees[0].tree.map(f=>f.path)).toEqual(['source/about/index.md']);expect(state.blobs[0]).toContain('# Hello');
});
it('reads missing friend YAML as empty but reports upstream errors',async()=>{
  repository({text:'---\ntitle: Links\ntype: link\n---\nHello'});expect((await(await onRequestGet(await context())).json()).friends).toEqual([]);
  repository({text:'---\ntitle: Links\ntype: link\n---\nHello',friendsStatus:502});expect((await onRequestGet(await context())).status).toBe(502);
});
it('commits page and friend YAML atomically while preserving original metadata',async()=>{
  const state=repository({text:'---\ntitle: Links\ntype: link\ncustom: keep\n---\nOld'});
  const response=await onRequestPut(await context({head:'head',slug:'about',page:{...page,type:'link'},friends:[{class_name:'Friends',class_desc:'People',links:[{name:'Site',descr:'Good',link:'https://site.test',avatar:'/a.webp'}]}]},'PUT'));
  expect(response.status).toBe(200);expect(state.trees[0].tree.map(f=>f.path)).toEqual(['source/about/index.md','source/_data/link.yml']);
  expect(state.blobs[0]).toContain('custom: keep');expect(state.blobs[1]).toContain('link_list:');expect(state.patches).toEqual([{sha:'saved',force:false}]);
});
it('rejects unsafe paths and friend data on ordinary pages',async()=>{
  const state=repository();expect((await onRequestGet(await context({},'GET','admin'))).status).toBe(400);
  expect((await onRequestPut(await context({head:'head',slug:'about',page,friends:[]},'PUT'))).status).toBe(400);expect(state.patches).toHaveLength(0);
});
it('reports truncated trees rather than returning an incomplete page list',async()=>{
  vi.stubGlobal('fetch',async()=>Response.json({truncated:true,tree:[]}));
  await expect(listRepositoryPages({GITHUB_REPO_TOKEN:'fixture'},'head')).rejects.toMatchObject({status:502});
});
it('rejects new slugs that collide with an existing differently cased directory or flat page',async()=>{
  for(const path of ['source/About/index.html','source/about.md','source/about/image.webp']){
    vi.stubGlobal('fetch',async()=>Response.json({tree:[{path,type:'blob'}],truncated:false}));
    await expect(assertPageAvailable({GITHUB_REPO_TOKEN:'fixture'},'about','head')).rejects.toMatchObject({status:409});
  }
});
