export async function createArticleEditor({element, onChange=()=>{}}) {
  const visual=document.createElement('div'), source=document.createElement('textarea');
  source.setAttribute('aria-label','文章正文（Markdown 源码）');source.rows=24;source.hidden=true;
  element.append(visual,source);
  let mode='visual', original='', changed=false, muted=false, disabled=false, destroyed=false, composing=false;
  let engine;
  function notify(){if(muted||disabled||destroyed)return;changed=true;onChange(getMarkdown());}
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
  function getMarkdown(){if(!changed)return original;return mode==='source'?source.value:engine.getValue();}
  function load(markdown){if(destroyed)return;muted=true;original=String(markdown);source.value=original;engine.setValue(original,true);changed=false;muted=false;}
  function setMode(next){if(destroyed||disabled)return;if(composing)throw new Error('请完成当前中文输入后再切换模式');if(!['visual','source'].includes(next))throw new Error('未知编辑模式');if(next===mode)return;const value=getMarkdown();muted=true;if(next==='source')source.value=value;else engine.setValue(value,true);mode=next;source.hidden=mode!=='source';visual.hidden=mode!=='visual';muted=false;}
  function insertMarkdown(value){if(disabled||destroyed)return;if(composing)throw new Error('请完成当前输入后再插入内容');if(mode==='source'){source.setRangeText(value,source.selectionStart,source.selectionEnd,'end');notify();source.focus();}else engine.insertValue(value);}
  return {load,getMarkdown,setMode,insertMarkdown,
    setDisabled(value){disabled=!!value;source.disabled=disabled;element.inert=disabled;if(disabled)engine.disabled();else engine.enable();},
    destroy(){destroyed=true;element.removeEventListener('compositionstart',start);element.removeEventListener('compositionend',end);engine.destroy();element.replaceChildren();}
  };
}
