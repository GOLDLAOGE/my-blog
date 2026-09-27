import { convertImageToWebp, insertMarkdownImage } from './editor.js';
import { renderSettings } from './settings.js';
const $ = id => document.getElementById(id);
let csrf='', revision='', settingsPayload, getSettings, imageTarget, dirty=false;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
async function api(path, { method='GET', data, image }={}) {
  const headers={};if(method!=='GET')headers['x-cms-csrf']=csrf;
  if(data){headers['content-type']='application/json';}if(image)headers['content-type']='image/webp';
  const response=await fetch(path,{method,headers,body:image|| (data?JSON.stringify(data):undefined),credentials:'same-origin'});
  let body;try{body=await response.json();}catch{throw new Error('后台接口不可用。请确认 Pages Functions 已部署，并完成绑定和密钥配置。');}
  if(!response.ok){if(response.status===401){$('workspace').hidden=true;$('login').hidden=false;}throw new Error(body.error||'请求失败');}return body;
}
function show(id){for(const view of ['posts-view','editor-view','settings-view'])$(view).hidden=view!==id;const active=id==='settings-view'?'settings-tab':id==='editor-view'&&!revision?'new-post':'posts-tab';for(const button of ['posts-tab','new-post','settings-tab']){if(button===active)$(button).setAttribute('aria-current','page');else $(button).removeAttribute('aria-current');}}
function canLeave(){if(dirty&&!confirm('有尚未提交的修改，确定离开吗？'))return false;dirty=false;return true;}
async function posts(){if(!canLeave())return;show('posts-view');status('正在读取文章…');try{const {posts}=await api('/api/posts');$('posts-list').replaceChildren();if(!posts.length)$('posts-list').textContent='还没有文章，点击「新建文章」开始写作。';for(const post of posts){const row=document.createElement('div');row.className='post-row';const info=document.createElement('div'),title=document.createElement('h2'),date=document.createElement('small');title.textContent=post.title||post.slug;date.textContent=post.date;info.append(title,date);const edit=document.createElement('button');edit.textContent='编辑';edit.onclick=()=>editPost(post.slug);row.append(info,edit);$('posts-list').append(row);}status('');}catch(error){status(error.message,true);}}
function fillPost(post={}){const form=$('post-form');form.reset();revision=post.sha||'';for(const key of ['title','slug','seoTitle','description','excerpt','cover','body','categories','tags','keywords'])form.elements[key].value=Array.isArray(post[key])?post[key].join(', '):post[key]||'';
  const date=new Date(post.date||Date.now());if(!Number.isNaN(date.getTime()))form.elements.date.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  form.elements.slug.readOnly=!!revision;$('editor-heading').textContent=revision?'编辑文章':'新建文章';$('publish').textContent=revision?'发布修改':'发布文章';dirty=false;show('editor-view');}
async function editPost(slug){if(!canLeave())return;status('正在读取文章…');try{fillPost(await api('/api/posts/'+encodeURIComponent(slug)));status('');}catch(error){status(error.message,true);}}
function chooseImage(target){imageTarget=target;$('image-file').value='';$('image-file').click();}
$('image-file').onchange=async()=>{const file=$('image-file').files[0];if(!file)return;status('正在转换并上传图片…');try{const webp=await convertImageToWebp(file);const {url}=await api('/api/media',{method:'POST',image:webp});imageTarget(url);dirty=true;status(`图片上传完成：${Math.round(webp.size/1024)} KB（WebP）`);}catch(error){status(error.message,true);}};
$('upload-body').onclick=()=>chooseImage(url=>insertMarkdownImage($('body'),url,$('image-alt').value));
$('upload-cover').onclick=()=>chooseImage(url=>{$('post-form').elements.cover.value=url;});
$('post-form').oninput=()=>dirty=true;
$('post-form').onsubmit=async event=>{event.preventDefault();const button=$('publish');button.disabled=true;status('正在提交文章…');try{const form=$('post-form'),data=Object.fromEntries(new FormData(form));for(const key of ['tags','categories','keywords'])data[key]=data[key].split(/[,，]/).map(x=>x.trim()).filter(Boolean);data.date=new Date(data.date).toISOString();if(revision)data.sha=revision;
  const result=await api(revision?'/api/posts/'+encodeURIComponent(data.slug):'/api/posts',{method:revision?'PUT':'POST',data});dirty=false;
  // The commit SHA is not the file SHA. Reload the editable article before another save.
  fillPost(await api('/api/posts/'+encodeURIComponent(result.slug)));status(`文章已提交（${result.sha.slice(0,7)}）。Cloudflare 正在构建，请稍后查看博客；这还不代表构建成功。`);
}catch(error){status(error.message,true);}finally{button.disabled=false;}};
$('settings-tab').onclick=async()=>{if(!canLeave())return;show('settings-view');status('正在读取配置…');try{settingsPayload=await api('/api/settings');getSettings=renderSettings($('settings-fields'),settingsPayload,chooseImage);status('');}catch(error){status(error.message,true);}};
$('settings-form').oninput=()=>dirty=true;
$('settings-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;status('正在保存配置…');try{const result=await api('/api/settings',{method:'PUT',data:{head:settingsPayload.head,settings:getSettings()}});settingsPayload=await api('/api/settings');getSettings=renderSettings($('settings-fields'),settingsPayload,chooseImage);dirty=false;status(`设置已提交（${result.sha.slice(0,7)}），请等待 Cloudflare 构建。`);}catch(error){status(error.message,true);}finally{button.disabled=false;}};
$('posts-tab').onclick=posts;$('back-posts').onclick=posts;$('new-post').onclick=()=>{if(canLeave()){fillPost();status('');}};
$('logout').onclick=async()=>{if(!canLeave())return;try{await api('/api/auth/logout',{method:'POST'});location.reload();}catch(error){status(error.message,true);}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
try{const session=await api('/api/session');csrf=session.csrf;$('workspace').hidden=false;$('logout').hidden=false;await posts();}catch(error){$('login').hidden=false;status(error.message,true);}
