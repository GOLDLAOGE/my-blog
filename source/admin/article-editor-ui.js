import { createArticleEditor } from './article-editor.js';
import { renderArticlePreview } from './article-preview.js';
import { serializeThemeBlock, safeEditorUrl } from './theme-blocks.js';

const titles={link:'链接卡片',note:'提示块',folding:'折叠内容',tabs:'标签页',mermaid:'流程图',code:'代码块',image:'图片与说明'};
function button(text,action){const el=document.createElement('button');el.type='button';el.textContent=text;el.onclick=action;return el;}
function field(parent,name,label,value='',multiline=false){const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement(multiline?'textarea':'input');input.name='component-'+name;input.value=value;if(multiline)input.rows=6;wrapper.append(input);parent.append(wrapper);return input;}
function optionField(parent,name,label,options,value){const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement('select');input.name='component-'+name;for(const [key,text]of options){const option=document.createElement('option');option.value=key;option.textContent=text;input.append(option);}input.value=value;wrapper.append(input);parent.append(wrapper);return input;}
export async function mountArticleEditor({element,sourceInput,onChange=()=>{},onError=()=>{},chooseImage}){
  const modes=document.createElement('div');modes.className='editor-modes';modes.setAttribute('aria-label','编辑模式');
  const extras=document.createElement('div');extras.className='editor-insert-tools';
  const host=document.createElement('div');host.className='editor-host';
  const blockList=document.createElement('div');blockList.className='editor-block-list';
  const preview=document.createElement('div');preview.className='article-preview';preview.hidden=true;
  const dialog=document.createElement('dialog');dialog.className='editor-dialog';dialog.setAttribute('aria-label','编辑内容组件');document.body.append(dialog);
  element.append(modes,extras,host,preview,blockList);
  let editor,active='visual',insertAt,disabled=false;
  function report(error){onError(error);}
  function sync(markdown){if(markdown!==undefined)sourceInput.value=markdown;refreshBlocks();onChange(markdown);}
  function refreshBlocks(){blockList.replaceChildren();try{const blocks=editor.getBlocks();if(!blocks.length)return;const heading=document.createElement('h3');heading.textContent='正文中的主题组件';blockList.append(heading);for(const block of blocks){const row=document.createElement('div');row.className='editor-block-row';const name=document.createElement('span');name.textContent=block.type==='opaque'?'自定义内容（原样保留）':titles[block.type];row.append(name,button(block.type==='opaque'?'查看源码':'编辑',()=>openDialog(block.type,block)),button('移除',()=>{if(!disabled&&confirm('移除此正文组件？')){editor.replaceBlock(block,'');}}));blockList.append(row);}}catch(error){report(error);}}
  function setMode(mode){try{if(disabled)return;editor.setMode(mode);active=mode;host.hidden=false;preview.hidden=true;for(const item of modes.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item.dataset.editorMode===mode));sourceInput.value=editor.getMarkdown();}catch(error){report(error);}}
  for(const [mode,title]of [['visual','可视化编辑'],['source','Markdown 源码']]){const el=button(title,()=>setMode(mode));el.dataset.editorMode=mode;el.setAttribute('aria-pressed',String(mode==='visual'));modes.append(el);}
  let previewController;
  const previewButton=button('正文预览',async()=>{try{if(disabled)return;const markdown=editor.getMarkdown();previewController?.abort();previewController=new AbortController();host.hidden=true;preview.hidden=false;preview.replaceChildren();const hint=document.createElement('p');hint.textContent='正文近似预览；实际效果以构建后的文章为准。';const body=document.createElement('div');preview.append(hint,body);for(const item of modes.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===previewButton));await renderArticlePreview({element:body,markdown,signal:previewController.signal});}catch(error){report(error);}});previewButton.dataset.editorMode='preview';modes.append(previewButton);
  for(const [label,types]of [['内容插入',['image','code']],['主题组件',['link','note','folding','tabs','mermaid']]]){const group=document.createElement('div');group.className='editor-tool-group';const name=document.createElement('span');name.textContent=label;group.append(name);for(const type of types){const el=button(titles[type],()=>openDialog(type));el.dataset.insert=type;group.append(el);}extras.append(group);}
  editor=await createArticleEditor({element:host,onChange:sync,onError:report,onEditBlock:block=>{const current=editor.getBlocks().find(b=>b.raw===block.raw);if(current)openDialog(current.type,current);}});
  function openDialog(type,block){
    if(disabled)return;if(type==='opaque'){setMode('source');return;}
    insertAt=editor.captureInsertion();dialog.replaceChildren();const title=document.createElement('h2');title.textContent=(block?'编辑':'插入')+titles[type];dialog.append(title);
    const f=block?.fields||{},fields={};
    if(['link','folding'].includes(type))fields.title=field(dialog,'title','标题',f.title||'');
    if(type==='link'){fields.site=field(dialog,'site','站点名称',f.site);fields.url=field(dialog,'url','链接地址',f.url);fields.image=field(dialog,'image','图标地址（可选）',f.image);}
    if(type==='note')fields.style=optionField(dialog,'style','提示类型',[['info','信息'],['success','成功'],['warning','提醒'],['danger','警告'],['primary','重点'],['default','普通']],f.style||'info');
    if(['note','folding','mermaid'].includes(type))fields.body=field(dialog,'body',type==='mermaid'?'流程图内容（Mermaid）':'内容（支持 Markdown）',f.body||(type==='mermaid'?'graph TD\n  A[开始] --> B[完成]':''),true);
    if(type==='tabs'){
      fields.name=field(dialog,'name','标签页标识（英文、数字、横线）',f.name||'tabs-'+Math.random().toString(36).slice(2,8));
      fields.items=[];const items=document.createElement('div');dialog.append(items);
      const add=item=>{const row=document.createElement('fieldset');const title=field(row,'tab-title','标签标题',item?.title||'');const body=field(row,'tab-body','标签内容（Markdown）',item?.body||'',true);const record={title,body};fields.items.push(record);row.append(button('移除此标签',()=>{fields.items=fields.items.filter(x=>x!==record);row.remove();}));items.append(row);};
      for(const item of f.items||[{title:'第一项',body:''},{title:'第二项',body:''}])add(item);dialog.append(button('添加标签页',()=>add()));
    }
    if(type==='code'){fields.language=optionField(dialog,'language','代码语言',[['text','纯文本'],['javascript','JavaScript'],['typescript','TypeScript'],['html','HTML'],['css','CSS'],['json','JSON'],['bash','Shell'],['python','Python'],['go','Go'],['sql','SQL'],['yaml','YAML']], 'javascript');fields.body=field(dialog,'body','代码内容','',true);}
    if(type==='image'){fields.url=field(dialog,'url','图片地址（可使用上传后的 /media/ 地址）');fields.alt=field(dialog,'alt','图片说明');dialog.append(button('上传图片',()=>{const savedInsertion=insertAt,alt=fields.alt.value;chooseImage(url=>{try{if(savedInsertion(imageMarkdown(url,alt)))dialog.close();}catch(error){report(error);}});}));}
    const error=document.createElement('p');error.dataset.componentError='';error.className='error';error.setAttribute('role','alert');dialog.append(error);
    const actions=document.createElement('div');actions.className='dialog-actions';const cancel=button('取消',()=>dialog.close());cancel.dataset.componentCancel='';const confirmButton=button(block?'保存组件':'插入正文',()=>{try{const values={};for(const [key,input]of Object.entries(fields))values[key]=key==='items'?input.map(x=>({title:x.title.value,body:x.body.value})):input.value;let markdown;if(type==='code'){if(!values.body.trim())throw new Error('代码不能为空');const fence='`'.repeat(Math.max(3,...[...values.body.matchAll(/`+/g)].map(m=>m[0].length+1)));markdown=fence+values.language+'\n'+values.body+'\n'+fence;}else if(type==='image')markdown=imageMarkdown(values.url,values.alt);else markdown=serializeThemeBlock({type,fields:values});if(block)editor.replaceBlock(block,markdown);else insertAt('\n\n'+markdown+'\n\n');sourceInput.value=editor.getMarkdown();refreshBlocks();dialog.close();}catch(problem){error.textContent=problem.message;}});confirmButton.dataset.componentConfirm='';confirmButton.className='primary';actions.append(cancel,confirmButton);dialog.append(actions);dialog.showModal();
  }
  function imageMarkdown(url,alt){url=safeEditorUrl(url);const caption=String(alt||'').replace(/[\\\[\]]/g,'\\$&').replace(/[\r\n]/g,' ');return `\n![${caption}](${url})\n`;}
  const upload=document.querySelector('#upload-body');upload.onclick=()=>{try{const insert=editor.captureInsertion(),alt=document.querySelector('#image-alt').value;chooseImage(url=>{try{return insert(imageMarkdown(url,alt));}catch(error){report(error);return false;}});}catch(error){report(error);}};
  return {...editor,
    load(markdown){editor.load(markdown);sourceInput.value=markdown;refreshBlocks();setMode(active);},
    setMode,
    setDisabled(value){disabled=!!value;editor.setDisabled(value);for(const control of element.querySelectorAll('button'))control.disabled=disabled;dialog.inert=disabled;},
    destroy(){editor.destroy();dialog.remove();element.replaceChildren();}
  };
}
