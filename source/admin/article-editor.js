import { protectThemeBlocks, restoreThemeBlocks, parseThemeBlocks } from './theme-blocks.js';

export async function createArticleEditor({element, onChange=()=>{}, onError=()=>{}, onEditBlock=()=>{}}) {
  const visual=document.createElement('div'), source=document.createElement('textarea');
  source.setAttribute('aria-label','文章正文（Markdown 源码）');source.rows=24;source.hidden=true;
  element.append(visual,source);
  let mode='visual', original='', changed=false, muted=false, disabled=false, destroyed=false, composing=false, generation=0;
  let engine, protection={blocks:[]},history=[''],historyIndex=0;
  function remember(markdown){if(history[historyIndex]===markdown)return;history=history.slice(0,historyIndex+1);history.push(markdown);while(history.length>50||history.length>2&&history.reduce((size,x)=>size+x.length,0)>10000000)history.shift();historyIndex=history.length-1;}
  function notify(){if(muted||disabled||destroyed)return;changed=true;try{const markdown=getMarkdown();remember(markdown);onChange(markdown);}catch(error){onError(error);}}
  source.addEventListener('input',notify);
  visual.addEventListener('input',()=>{if(!muted&&!disabled&&!destroyed){changed=true;onChange();}},true);
  const start=()=>composing=true,end=()=>composing=false;
  element.addEventListener('compositionstart',start);element.addEventListener('compositionend',end);
  await new Promise((resolve,reject)=>{
    try{engine=new globalThis.Vditor(visual,{
      cdn:'/admin/vendor/vditor',lang:'zh_CN',mode:'wysiwyg',height:520,
      cache:{enable:false},icon:'material',toolbar:['headings','bold','italic','quote','list','ordered-list','link','line','|','table','code','|',{name:'undo',tip:'撤销',click:()=>undo()},{name:'redo',tip:'重做',click:()=>redo()}],
      toolbarConfig:{pin:false},counter:{enable:false},resize:{enable:false},
      preview:{delay:0,mode:'editor',hljs:{enable:false},math:{engine:'KaTeX'},markdown:{autoSpace:false,fixTermTypo:false,mark:false,sanitize:true},theme:{path:'/admin/vendor/vditor/dist/css/content-theme'}},
      input:notify,after:resolve
    });}catch(error){reject(error);}
  });
  function getMarkdown(){if(!changed)return original;return mode==='source'?source.value:restoreThemeBlocks(engine.getValue(),protection.blocks);}
  function renderVisual(markdown){protection=protectThemeBlocks(markdown);engine.setValue(protection.markdown,true);}
  function load(markdown){if(destroyed)return;generation++;muted=true;original=String(markdown);source.value=original;renderVisual(original);changed=false;history=[original];historyIndex=0;muted=false;}
  function restoreHistory(index){if(disabled||destroyed||composing||index<0||index>=history.length)return;historyIndex=index;muted=true;source.value=history[index];renderVisual(history[index]);changed=true;muted=false;onChange(history[index]);}
  function undo(){try{remember(getMarkdown());}catch{}restoreHistory(historyIndex-1);}
  function redo(){restoreHistory(historyIndex+1);}
  element.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();if(event.key.toLowerCase()==='y'||event.shiftKey)redo();else undo();}},true);
  function setMode(next){if(destroyed||disabled)return;if(composing)throw new Error('请完成当前中文输入后再切换模式');if(!['visual','source'].includes(next))throw new Error('未知编辑模式');if(next===mode)return;const value=getMarkdown();muted=true;if(next==='source')source.value=value;else renderVisual(value);mode=next;source.hidden=mode!=='source';visual.hidden=mode!=='visual';muted=false;}
  function insertMarkdown(value){if(disabled||destroyed)return;if(composing)throw new Error('请完成当前输入后再插入内容');if(mode==='source'){source.setRangeText(value,source.selectionStart,source.selectionEnd,'end');notify();source.focus();}else {const inserted=protectThemeBlocks(value);protection.blocks.push(...inserted.blocks);engine.insertMD(inserted.markdown);notify();}}
  const Observer=element.ownerDocument.defaultView.MutationObserver;
  const observer=new Observer(()=>{
    for(const code of visual.querySelectorAll('code')){
      const block=protection.blocks.find(b=>code.textContent.trim()===b.id);if(!block)continue;
      const container=code.closest('[data-type="code-block"]')||code.parentElement;if(container.dataset.cmsBlock===block.id)continue;
      code.setAttribute('contenteditable','false');container.classList.add('cms-theme-block');container.dataset.cmsBlock=block.id;
      container.dataset.cmsTitle=block.type==='opaque'?'自定义内容 · 源码编辑':`${({link:'链接卡片',note:'提示块',folding:'折叠内容',tabs:'标签页',mermaid:'流程图'})[block.type]} · 双击编辑`;
    }
  });observer.observe(visual,{childList:true,subtree:true});
  visual.addEventListener('dblclick',event=>{const container=event.target.closest('[data-cms-block]');const block=protection.blocks.find(b=>b.id===container?.dataset.cmsBlock);if(block&&!disabled&&!destroyed)onEditBlock(block);});
  return {load,getMarkdown,setMode,insertMarkdown,undo,redo,
    captureInsertion(){const version=generation,selectedMode=mode,markdown=getMarkdown(),start=source.selectionStart,end=source.selectionEnd,selection=element.ownerDocument.getSelection();const range=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;return value=>{if(version!==generation||disabled||destroyed||getMarkdown()!==markdown)return false;if(mode!==selectedMode)throw new Error('编辑模式已变更，请重新插入内容');if(mode==='source')source.setSelectionRange(start,end);else if(range&&visual.contains(range.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(range);}insertMarkdown(value);return true;};},
    getBlocks(){return parseThemeBlocks(getMarkdown());},
    getProtectedBlockIndex(id){return protection.blocks.findIndex(block=>block.id===id);},
    replaceBlock(block,value){if(disabled||destroyed)return;const current=getMarkdown(),blocks=parseThemeBlocks(current),matches=blocks.filter(b=>b.raw===block.raw);const target=matches.find(b=>b.start===block.start)||(matches.length===1?matches[0]:null);if(!target)throw new Error('组件已变更，请重新打开编辑');const next=current.slice(0,target.start)+value+current.slice(target.end);remember(current);muted=true;source.value=next;renderVisual(next);changed=true;muted=false;remember(next);onChange(next);},
    setDisabled(value){disabled=!!value;source.disabled=disabled;element.inert=disabled;if(disabled)engine.disabled();else engine.enable();},
    destroy(){destroyed=true;observer.disconnect();element.removeEventListener('compositionstart',start);element.removeEventListener('compositionend',end);engine.destroy();element.replaceChildren();}
  };
}
