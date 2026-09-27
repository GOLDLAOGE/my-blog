import { json } from '../../_lib/http.js';
import { contentRoute } from '../../_lib/content-api.js';
import { listRepositoryPages, repositoryHead } from '../../_lib/github-repo.js';
import { friendFile, savePage } from '../../_lib/page-api.js';
import { readFriendLinks } from '../../_lib/pages.js';
export async function onRequestGet(context) {
  return contentRoute(context,false,async()=>{
    const head=await repositoryHead(context.env);const pages=await listRepositoryPages(context.env,head);
    const wantsFriends=new URL(context.request.url).searchParams.get('type')==='link';
    return json({head,pages,...(wantsFriends?{friends:readFriendLinks(await friendFile(context.env,head))}:{})});
  });
}
export const onRequestPost=context=>savePage(context,true);
