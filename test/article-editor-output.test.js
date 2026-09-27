import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { serializeThemeBlock } from '../source/admin/theme-blocks.js';
const Hexo=createRequire(import.meta.url)('hexo');
it('renders editor Markdown through the real theme without leaking protected tokens',async()=>{
 const fixture=mkdtempSync(join(tmpdir(),'cms-article-output-'));let hexo;
 try{
  mkdirSync(join(fixture,'themes'));symlinkSync(resolve('themes/anzhiyu'),join(fixture,'themes/anzhiyu'),'dir');symlinkSync(resolve('node_modules'),join(fixture,'node_modules'),'dir');
  for(const file of ['package.json','_config.yml','_config.anzhiyu.yml'])writeFileSync(join(fixture,file),readFileSync(file));
  mkdirSync(join(fixture,'source/_posts'),{recursive:true});
  const blocks=[['link',{title:'编辑器链接',site:'官网',url:'https://example.com',image:''}],['note',{style:'info',body:'提示内容'}],['folding',{title:'点击展开',body:'折叠正文'}],['tabs',{name:'editor-test',items:[{title:'第一项',body:'标签正文'}]}],['mermaid',{body:'graph TD\n A[开始] --> B[完成]'}]].map(([type,fields])=>serializeThemeBlock({type,fields}));
  const markdown=['## 编辑器标题','**粗体**','- 列表','> 引用','[链接](https://example.com)','![图片说明](/media/editor.webp)','| A | B |\n|---|---|\n|1|2|','```javascript\nconst example = 1;\n```',...blocks].join('\n\n');
  writeFileSync(join(fixture,'source/_posts/editor.md'),'---\ntitle: 编辑器验收\ndate: 2026-01-01 12:00:00\n---\n'+markdown);
  hexo=new Hexo(fixture,{silent:true});await hexo.init();await hexo.call('generate');
  const html=readFileSync(join(fixture,'public/2026/01/01/editor/index.html'),'utf8'),doc=new JSDOM(html).window.document,article=doc.querySelector('#article-container');
  for(const selector of ['h2','strong','ul','blockquote','a[href="https://example.com"]','img[alt="图片说明"]','table','figure.highlight','details','.tabs button.tab','.mermaid-src'])expect(article.querySelector(selector),selector).not.toBeNull();
  for(const text of ['编辑器链接','提示内容','折叠正文','标签正文','const','example','graph TD'])expect(article.textContent).toContain(text);
  expect(article.innerHTML).not.toMatch(/cms-block|cms-diagram|{%/);
  expect(html).toMatch(/isPhotoFigcaption:\s*true/);
 }finally{if(hexo)await hexo.exit();rmSync(fixture,{recursive:true,force:true});}
},30000);
