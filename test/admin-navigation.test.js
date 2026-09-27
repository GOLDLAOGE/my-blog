import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
afterEach(()=>vi.unstubAllGlobals());
it('protects dirty page edits when leaving and submits the safe page payload',async()=>{
  const dom=new JSDOM(readFileSync('source/admin/index.html','utf8'),{url:'https://blog.test/admin/'});
  vi.stubGlobal('document',dom.window.document);vi.stubGlobal('window',dom.window);vi.stubGlobal('Event',dom.window.Event);vi.stubGlobal('confirm',()=>false);
  const calls=[];
  vi.stubGlobal('fetch',async(path,init)=>{
    calls.push({path,init});
    if(path==='/api/session')return Response.json({csrf:'fixture'});
    if(path==='/api/posts')return Response.json({posts:[]});
    if(path==='/api/pages'&&init.method==='GET')return Response.json({head:'head',pages:[]});
    if(path==='/api/pages'&&init.method==='POST')return Response.json({sha:'saved',status:'building'});
    if(path==='/api/pages/about')return Response.json({head:'saved',slug:'about',page:{title:'About',body:'Body',type:''}});
    throw new Error('Unexpected request '+path);
  });
  await import('../source/admin/app.js');
  await document.getElementById('pages-tab').onclick();document.querySelector('[data-create]').click();
  await vi.waitFor(()=>expect(document.querySelector('#page-fields [name=slug]')).not.toBeNull());
  document.querySelector('#page-fields [name=slug]').value='about';document.querySelector('#page-fields [name=title]').value='About';
  document.querySelector('#page-fields [name=body]').value='Body';document.getElementById('page-form').oninput();
  await document.getElementById('posts-tab').onclick();expect(document.getElementById('page-editor-view').hidden).toBe(false);
  await document.getElementById('page-form').onsubmit({preventDefault(){}});
  const submitted=JSON.parse(calls.find(call=>call.path==='/api/pages'&&call.init.method==='POST').init.body);
  expect(submitted).toMatchObject({head:'head',slug:'about',page:{title:'About',body:'Body',type:''}});
  expect(document.getElementById('status').textContent).toContain('等待构建');
});
