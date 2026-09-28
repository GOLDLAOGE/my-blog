import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readEditableSettings, EDITABLE_SCHEMA } from '../functions/_lib/settings.js';

const require=createRequire(import.meta.url);
let dom;
afterEach(()=>{dom?.window.close();vi.unstubAllGlobals();vi.resetModules();});
class Engine {
  constructor(element,options){this.options=options;this.value='';queueMicrotask(()=>options.after());}
  setValue(value){this.value=value;}getValue(){return this.value;}
  insertMD(value){this.value+=value;this.options.input(this.value);}
  disabled(){}enable(){}destroy(){}
}
function setup(handler){
  dom=new JSDOM(readFileSync('source/admin/index.html','utf8'),{url:'https://cms.test/admin/'});
  for(const key of ['document','window','Event','FormData'])vi.stubGlobal(key,key==='window'?dom.window:dom.window[key]);
  vi.stubGlobal('Vditor',Engine);vi.stubGlobal('confirm',()=>true);
  vi.stubGlobal('fetch',async(path,options)=>{
    if(path==='/api/session')return Response.json({csrf:'fixture'});
    return handler(path,options);
  });
}
const $=id=>document.getElementById(id);
function editBody(value){document.querySelector('[data-editor-mode=source]').click();const body=document.querySelector('textarea[aria-label]');body.value=value;body.dispatchEvent(new Event('input',{bubbles:true}));}
function protectedEdits(){const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}

it.each([false,true])('ignores a stale page read (failure=%s) after starting a new article',async(failure)=>{
  let finish;
  setup(async path=>{
    if(path==='/api/posts')return Response.json({posts:[]});
    if(path==='/api/pages')return Response.json({head:'head',pages:[{slug:'about'}]});
    if(path==='/api/pages/about')return new Promise((resolve,reject)=>finish=()=>failure?reject(new Error('old read failed')):resolve(Response.json({head:'head',slug:'about',page:{title:'About',body:'Old',type:''}})));
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');await $('pages-tab').onclick();
  const pending=document.querySelector('[data-edit=about]').onclick();
  await $('new-post').onclick();$('post-form').elements.title.value='Keep this draft';editBody('Unsaved body');
  finish();await pending;
  expect($('editor-view').hidden).toBe(false);expect(protectedEdits()).toBe(true);
  expect($('post-form').elements.title.value).toBe('Keep this draft');
  expect($('body').value).toBe('Unsaved body');expect($('status').textContent).not.toContain('old read failed');
});

it('does not let an older settings response replace newer edits',async()=>{
  const pending=[];
  const payload={head:'head',schema:EDITABLE_SCHEMA,settings:readEditableSettings('title: Test\nurl: https://cms.test','{}')};
  setup(async path=>{
    if(path==='/api/posts')return Response.json({posts:[]});
    if(path==='/api/settings')return new Promise(resolve=>pending.push(()=>resolve(Response.json(payload))));
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');const older=$('settings-tab').onclick(),newer=$('settings-tab').onclick();
  pending[1]();await newer;
  document.querySelector('[data-key=title]').value='My edited title';$('settings-form').oninput();
  pending[0]();await older;
  expect(document.querySelector('[data-key=title]').value).toBe('My edited title');expect(protectedEdits()).toBe(true);
});

it('ignores a delayed friend-page type response after leaving the page',async()=>{
  let finish;
  setup(async path=>{
    if(path==='/api/posts')return Response.json({posts:[]});
    if(path==='/api/pages')return Response.json({head:'head',pages:[]});
    if(path==='/api/pages?type=link')return new Promise(resolve=>finish=()=>resolve(Response.json({head:'head',friends:[]})));
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');await $('pages-tab').onclick();await document.querySelector('[data-create]').onclick();
  const type=document.querySelector('#page-fields [name=type]');type.value='link';
  const pending=$('page-form').onchange({target:type});
  await $('new-post').onclick();editBody('Keep my article');finish();await pending;
  expect($('editor-view').hidden).toBe(false);expect(protectedEdits()).toBe(true);expect($('body').value).toBe('Keep my article');
});

it('removes the old settings form while reloading so edits cannot be overwritten',async()=>{
  let finish,reads=0;
  const payload={head:'head',schema:EDITABLE_SCHEMA,settings:readEditableSettings('title: Test\nurl: https://cms.test','{}')};
  setup(async(path,options)=>{
    if(path==='/api/posts')return Response.json({posts:[]});
    if(path==='/api/settings'&&options.method==='GET'){
      if(++reads===1)return Response.json(payload);
      return new Promise(resolve=>finish=()=>resolve(Response.json(payload)));
    }
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');await $('settings-tab').onclick();
  expect(document.querySelector('[data-key=title]')).not.toBeNull();
  const pending=$('settings-tab').onclick();
  expect(document.querySelector('[data-key=title]')).toBeNull();
  await $('settings-form').onsubmit({preventDefault(){}});
  expect($('status').textContent).toContain('正在读取');
  finish();await pending;expect(document.querySelector('[data-key=title]').value).toBe('Test');
});

it.each([[false,false],[true,false],[true,true]])('recovers a committed article (existing=%s, remote changed=%s) without losing edits',async(existing,diverged)=>{
  const writes=[];let failRead=false,committed=false;
  const post={slug:'article',title:'Article',body:'Original',description:'Description',date:'2026-09-27',sha:'old-file',categories:[],tags:[],keywords:[]};
  setup(async(path,options)=>{
    if(path==='/api/posts'&&options.method==='GET')return Response.json({posts:existing?[post]:[]});
    if(['POST','PUT'].includes(options.method)){
      writes.push({path,method:options.method,data:JSON.parse(options.body)});committed=true;failRead=true;
      return Response.json({slug:'article',sha:'commit-sha',fileSha:'fresh-file',status:'building'},{status:existing?200:201});
    }
    if(path==='/api/posts/article'){
      if(failRead)throw new Error('read timeout');
      return Response.json({...post,sha:committed?(diverged?'other-file':'fresh-file'):'old-file'});
    }
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');
  if(existing)await document.querySelector('#posts-list button').onclick();else await $('new-post').onclick();
  const form=$('post-form');for(const key of ['slug','title','description'])form.elements[key].value=post[key];editBody('First version');
  await form.onsubmit({preventDefault(){}});
  expect($('status').textContent).toContain('已提交');expect($('status').textContent).toContain('commit-');
  expect(form.elements.slug.readOnly).toBe(true);expect($('publish').disabled).toBe(true);
  expect($('retry-post-read').hidden).toBe(false);expect($('retry-post-read').disabled).toBe(false);
  editBody('Keep edits made after the commit');
  await form.onsubmit({preventDefault(){}});expect(writes).toHaveLength(1);
  await $('retry-post-read').onclick();expect(writes).toHaveLength(1);expect($('publish').disabled).toBe(true);
  failRead=false;await $('retry-post-read').onclick();
  if(diverged){expect($('publish').disabled).toBe(true);expect($('status').textContent).toContain('仓库');expect($('body').value).toBe('Keep edits made after the commit');expect(protectedEdits()).toBe(true);expect(writes).toHaveLength(1);return;}
  expect(writes).toHaveLength(1);expect($('body').value).toBe('Keep edits made after the commit');expect(protectedEdits()).toBe(true);
  expect($('publish').disabled).toBe(false);expect($('retry-post-read').hidden).toBe(true);
  await form.onsubmit({preventDefault(){}});
  expect(writes[1]).toMatchObject({path:'/api/posts/article',method:'PUT',data:{sha:'fresh-file',body:'Keep edits made after the commit'}});
});

it('packages executable toolbar icons used by the real editor',async()=>{
  await require('../scripts/cms-editor-assets.js').prepareEditorAssets();
  dom=new JSDOM('<body></body>',{runScripts:'outside-only'});
  const script=readFileSync('source/admin/vendor/vditor/dist/js/icons/material.js','utf8');
  dom.window.eval(script);
  for(const name of ['headings','bold','italic','list','link','table','code','undo','redo'])expect(dom.window.document.querySelector('#vditor-icon-'+name)?.querySelector('path')).toBeTruthy();
},30000);
