import { protectThemeBlocks, restoreThemeBlocks, parseThemeBlocks } from './theme-blocks.js';

export async function createArticleEditor({element, onChange=()=>{}, onError=()=>{}, onEditBlock=()=>{}}) {
  const visual=document.createElement('div'), source=document.createElement('textarea');
  source.setAttribute('aria-label','文章正文（Markdown 源码）');source.rows=24;source.hidden=true;
  element.append(visual,source);
  let mode='visual', original='', changed=false, muted=false, disabled=false, destroyed=false, composing=false;
  let engine, protection={blocks:[]};
  function notify(){if(muted||disabled||destroyed)return;changed=true;try{onChange(getMarkdown());}catch(error){onError(error);}}
  source.addEventListener('input',notify);
  const start=()=>composing=true,end=()=>composing=false;
  element.addEventListener('compositionstart',start);element.addEventListener('compositionend',end);
  await new Promise((resolve,reject)=>{
    try{engine=new globalThis.Vditor(visual,{
      cdn:'/admin/vendor/vditor',lang:'zh_CN',mode:'wysiwyg',height:520,
      cache:{enable:false},icon:'material',toolbar:['headings','bold','italic','quote','list','ordered-list','link','line','|','table','code','|','undo','redo'],
      toolbarConfig:{pin:false},counter:{enable:false},resize:{enable:false},
      preview:{delay:0,mode:'editor',hljs:{enable:false},math:{engine:'KaTeX'},markdown:{autoSpace:false,fixTermTypo:false,mark:false,sanitize:true},theme:{path:'/admin/vendor/vditor/dist/css/content-theme'}},
      input:notify,after:resolve
    });}catch(error){reject(error);}
  });
  function getMarkdown(){if(!changed)return original;return mode==='source'?source.value:restoreThemeBlocks(engine.getValue(),protection.blocks);}
  function renderVisual(markdown){protection=protectThemeBlocks(markdown);engine.setValue(protection.markdown,true);}
  function load(markdown){if(destroyed)return;muted=true;original=String(markdown);source.value=original;renderVisual(original);changed=false;muted=false;}
  function setMode(next){if(destroyed||disabled)return;if(composing)throw new Error('请完成当前中文输入后再切换模式');if(!['visual','source'].includes(next))throw new Error('未知编辑模式');if(next===mode)return;const value=getMarkdown();muted=true;if(next==='source')source.value=value;else renderVisual(value);mode=next;source.hidden=mode!=='source';visual.hidden=mode!=='visual';muted=false;}
  function insertMarkdown(value){if(disabled||destroyed)return;if(composing)throw new Error('请完成当前输入后再插入内容');if(mode==='source'){source.setRangeText(value,source.selectionStart,source.selectionEnd,'end');notify();source.focus();}else {const inserted=protectThemeBlocks(value);protection.blocks.push(...inserted.blocks);engine.insertValue(inserted.markdown);}}
  const Observer=element.ownerDocument.defaultView.MutationObserver;
  const observer=new Observer(()=>{
    for(const code of visual.querySelectorAll('code')){
      const block=protection.blocks.find(b=>code.textContent.trim()===b.id);if(!block)continue;
      const container=code.closest('[data-type="code-block"]')||code.parentElement;if(container.querySelector('[data-edit-theme-block]'))continue;
      code.setAttribute('contenteditable','false');container.classList.add('cms-theme-block');
      const label=document.createElement('button');label.type='button';label.dataset.editThemeBlock=block.id;label.textContent=block.type==='opaque'?'保留的自定义内容 · 源码编辑':`${({link:'链接卡片',note:'提示块',folding:'折叠内容',tabs:'标签页',mermaid:'流程图'})[block.type]} · 编辑`;
      label.onclick=()=>{if(!disabled&&!destroyed)onEditBlock(block);};container.append(label);
    }
  });observer.observe(visual,{childList:true,subtree:true});
  return {load,getMarkdown,setMode,insertMarkdown,
    getBlocks(){return parseThemeBlocks(getMarkdown());},
    replaceBlock(block,value){if(disabled||destroyed)return;const current=getMarkdown(),blocks=parseThemeBlocks(current);const target=blocks.find(b=>b.raw===block.raw&&(block.start===undefined||b.start===block.start));if(!target)throw new Error('组件已变更，请重新打开编辑');const next=current.slice(0,target.start)+value+current.slice(target.end);load(next);changed=true;onChange(next);},
    setDisabled(value){disabled=!!value;source.disabled=disabled;element.inert=disabled;if(disabled)engine.disabled();else engine.enable();},
    destroy(){destroyed=true;observer.disconnect();element.removeEventListener('compositionstart',start);element.removeEventListener('compositionend',end);engine.destroy();element.replaceChildren();}
  };
}
