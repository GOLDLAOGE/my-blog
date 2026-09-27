import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
class Engine {constructor(el,o){this.options=o;this.value='';queueMicrotask(()=>o.after());}setValue(v){this.value=v;}getValue(){return this.value;}insertMD(v){this.value+=v;this.options.input(this.value);}disabled(){}enable(){}destroy(){}}
it('submits latest editor Markdown and locks navigation until save completes',async()=>{
 const dom=new JSDOM(readFileSync('source/admin/index.html','utf8'),{url:'https://cms.test/admin/'});
 for(const key of ['document','window','Event','FormData'])vi.stubGlobal(key,key==='window'?dom.window:dom.window[key]);vi.stubGlobal('Vditor',Engine);vi.stubGlobal('confirm',()=>true);
 let submitted,resolveSave;const pending=new Promise(resolve=>resolveSave=resolve);
 const post={title:'原文',slug:'old',body:'原始正文',sha:'file-sha',date:'2026-09-27',description:'描述',categories:['生活'],tags:['记录'],cover:'/media/cover.webp',seoTitle:'SEO'};
 vi.stubGlobal('fetch',async(path,options={})=>{if(options.method==='PUT'){submitted=JSON.parse(options.body);await pending;return {ok:true,json:async()=>({slug:'old',sha:'commit-sha'})};}return {ok:true,json:async()=>path==='/api/session'?{csrf:'csrf'}:path==='/api/posts'?{posts:[post]}:{...post,...submitted}};});
 await import('../source/admin/app.js');document.querySelector('#posts-list button').click();await vi.waitFor(()=>expect(document.querySelector('#editor-view').hidden).toBe(false));await vi.waitFor(()=>expect(document.querySelector('[data-editor-mode=source]')).not.toBeNull());
 document.querySelector('[data-editor-mode=source]').click();const body=document.querySelector('textarea[aria-label]');body.value='更新正文';body.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#post-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(submitted?.body).toBe('更新正文'));expect(submitted).toMatchObject({cover:'/media/cover.webp',description:'描述',categories:['生活'],tags:['记录'],seoTitle:'SEO',sha:'file-sha'});expect(document.querySelector('#new-post').disabled).toBe(true);expect(body.disabled).toBe(true);
 resolveSave();await vi.waitFor(()=>expect(document.querySelector('#publish').disabled).toBe(false));expect(document.querySelector('#body').value).toBe('更新正文');expect(document.querySelector('#status').textContent).toContain('文章已提交');
});
