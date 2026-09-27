import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import { parseThemeBlocks } from './theme-blocks.js';
for(const [name,language]of Object.entries({javascript,typescript,xml,css,json,bash,python,go,sql,yaml}))hljs.registerLanguage(name,language);
const versions=new WeakMap();
export async function renderArticlePreview({element,markdown,signal}){
  const version=(versions.get(element)||0)+1;versions.set(element,version);
  const doc=element.ownerDocument,purify=createDOMPurify(doc.defaultView),root=doc.createElement('div');
  function node(tag,text){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
  function ordinary(parent,text){const holder=node('div');holder.innerHTML=purify.sanitize(marked.parse(text),{FORBID_TAGS:['style','form','input','button','iframe'],FORBID_ATTR:['style']});for(const image of [...holder.querySelectorAll('img')]){const figure=node('figure'),caption=node('figcaption',image.alt);image.replaceWith(figure);figure.append(image);if(image.alt)figure.append(caption);}for(const code of holder.querySelectorAll('pre code')){const language=[...code.classList].find(x=>x.startsWith('language-'))?.slice(9);if(language&&hljs.getLanguage(language))code.innerHTML=hljs.highlight(code.textContent,{language}).value;}parent.append(...holder.childNodes);}
  async function contents(parent,text){let end=0;for(const block of parseThemeBlocks(text)){ordinary(parent,text.slice(end,block.start));end=block.end;const f=block.fields;
    if(block.type==='note'){const note=node('aside');note.className='preview-note '+f.style;ordinary(note,f.body);parent.append(note);}
    else if(block.type==='folding'){const details=node('details');details.append(node('summary',f.title));ordinary(details,f.body);parent.append(details);}
    else if(block.type==='link'){const link=node('a',f.title);link.className='preview-link';if(/^(https?:\/\/|\/(?!\/))/i.test(f.url))link.href=f.url;link.append(node('small',f.site));parent.append(link);}
    else if(block.type==='tabs'){const group=node('section'),bar=node('div');bar.setAttribute('role','tablist');group.append(bar);const panels=[];for(const [i,item]of f.items.entries()){const tab=node('button',item.title),panel=node('div');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(i===0));panel.setAttribute('role','tabpanel');panel.hidden=i!==0;ordinary(panel,item.body);panels.push({tab,panel});tab.onclick=()=>{for(const pair of panels){pair.panel.hidden=pair!==panels[i];pair.tab.setAttribute('aria-selected',String(pair===panels[i]));}};bar.append(tab);group.append(panel);}parent.append(group);}
    else if(block.type==='mermaid'){const diagram=node('div');parent.append(diagram);try{const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false}});await mermaid.parse(f.body);if(signal?.aborted||versions.get(element)!==version)return;const result=await mermaid.render('cms-diagram-'+crypto.randomUUID().replaceAll('-',''),f.body);diagram.innerHTML=purify.sanitize(result.svg,{USE_PROFILES:{svg:true,svgFilters:true}});}catch{diagram.append(node('p','流程图无法渲染，请检查源码'),node('pre',f.body));}}
    else parent.append(node('pre',block.raw));
  }ordinary(parent,text.slice(end));}
  await contents(root,markdown);if(!signal?.aborted&&versions.get(element)===version)element.replaceChildren(...root.childNodes);
}
