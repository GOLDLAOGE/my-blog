import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderPageList, renderPageEditor } from '../source/admin/pages.js';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const dom=new JSDOM('<div id="view"></div>');vi.stubGlobal('document',dom.window.document);vi.stubGlobal('Event',dom.window.Event);return document.getElementById('view');}
it('keeps existing slugs immutable and collects ordinary page metadata',()=>{
  const container=setup();const get=renderPageEditor(container,{head:'head',slug:'about',page:{title:'About',body:'Body',type:''}},()=>{});
  expect(container.querySelector('[name=slug]').readOnly).toBe(true);
  expect(container.querySelector('[data-friends]')).toBeNull();
  container.querySelector('[name=description]').value='SEO description';
  expect(get()).toMatchObject({head:'head',slug:'about',page:{description:'SEO description',type:''}});expect(get().friends).toBeUndefined();
});
it('uses ordinary Markdown for a new about page and reuses image uploads',()=>{
  const container=setup();const get=renderPageEditor(container,{head:'head',slug:'',page:{},isNew:true},callback=>callback('/media/new.webp'));
  container.querySelector('[name=slug]').value='about';container.querySelector('[name=title]').value='About';
  container.querySelector('[data-upload]').click();
  expect(get()).toMatchObject({head:'head',slug:'about',page:{type:'',top_img:'/media/new.webp'}});
});
it('edits friend categories and sites while retaining snapshot identities',()=>{
  const container=setup();const get=renderPageEditor(container,{head:'head',slug:'link',page:{title:'Friends',type:'link'},friends:[{_rowId:'0',class_name:'Friends',class_desc:'Desc',links:[{_rowId:'0',name:'Site',descr:'Good',link:'https://site.test',avatar:'/site.webp'}]}]},()=>{});
  container.querySelector('[data-field=name]').value='Changed';
  expect(get().friends[0]).toMatchObject({_rowId:'0',links:[{_rowId:'0',name:'Changed'}]});
});
it('lists pages with edit and create actions, and does not offer deletion',()=>{
  const container=setup();let selected='',created=false;renderPageList(container,[{slug:'about',path:'source/about/index.md'}],slug=>selected=slug,()=>created=true);
  container.querySelector('[data-edit]').click();expect(selected).toBe('about');
  container.querySelector('[data-create]').click();expect(created).toBe(true);expect(container.textContent).not.toContain('删除');
});
