import { json } from './http.js';
import { contentRoute, readJson, validation } from './content-api.js';
import { assertPageAvailable, conflict, repositoryHead, readRepositoryFile, writeRepositoryFiles } from './github-repo.js';
import { pagePath, parsePage, serializePage, readFriendLinks, writeFriendLinks } from './pages.js';

export async function friendFile(env,head) {
  try{return (await readRepositoryFile(env,'source/_data/link.yml',head)).content;}
  catch(error){if(error.status===404)return '';throw error;}
}
export async function savePage(context,isNew) {
  return contentRoute(context,true,async()=>{
    const input=await readJson(context.request);
    validation(()=>{if(Object.keys(input).some(key=>!['head','slug','page','friends'].includes(key)))throw new Error('包含未开放的请求字段');});
    const slug=isNew?input.slug:context.params.slug;
    const path=validation(()=>pagePath(slug));
    if(!isNew&&input.slug!==slug)throw Object.assign(new Error('页面标识不可更改'),{status:400});
    const head=await repositoryHead(context.env);if(head!==input.head)throw conflict();
    let original=null;
    if(isNew)await assertPageAvailable(context.env,slug,head);
    else original=(await readRepositoryFile(context.env,path,head)).content;
    const content=validation(()=>serializePage(input.page,original));
    const files=[{path,content}];
    if(input.friends!==undefined){
      if(input.page.type!=='link')throw Object.assign(new Error('仅友链页面可提交友链数据'),{status:400});
      const source=await friendFile(context.env,head);
      files.push({path:'source/_data/link.yml',content:validation(()=>writeFriendLinks(source,input.friends))});
    }
    const result=await writeRepositoryFiles(context.env,{head,files,message:`pages: ${isNew?'create':'update'} ${input.page.title}`});
    return json({...result,status:'building'},{status:isNew?201:200});
  });
}
export async function getPage(context) {
  return contentRoute(context,false,async()=>{
    const path=validation(()=>pagePath(context.params.slug));const head=await repositoryHead(context.env);
    const file=await readRepositoryFile(context.env,path,head);const page=parsePage(file.content);
    return json({head,slug:context.params.slug,page,...(page.type==='link'?{friends:readFriendLinks(await friendFile(context.env,head))}:{})});
  });
}
