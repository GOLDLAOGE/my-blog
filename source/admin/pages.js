import { renderList } from './lists.js';
const friendSchema={fields:{class_name:'text',class_desc:'text'},children:{key:'links',fields:{name:'text',descr:'text',link:'url',avatar:'image'}}};
export function renderPageList(container,pages,onEdit,onCreate) {
  container.replaceChildren();
  const create=document.createElement('button');create.type='button';create.className='primary';create.dataset.create='';create.textContent='新建页面';create.onclick=onCreate;container.append(create);
  if(!pages.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='还没有普通内容页。可新建关于、说明或友链页面。分类、标签和归档由文章自动生成。';container.append(empty);}
  for(const page of pages){const row=document.createElement('div');row.className='post-row';const info=document.createElement('div'),title=document.createElement('h2'),path=document.createElement('small');title.textContent=page.slug;path.textContent=`/${page.slug}/`;info.append(title,path);const button=document.createElement('button');button.type='button';button.dataset.edit=page.slug;button.textContent='编辑';button.onclick=()=>onEdit(page.slug);row.append(info,button);container.append(row);}
}
export function renderPageEditor(container,payload,upload) {
  container.replaceChildren();const fields={};
  const grid=document.createElement('div');grid.className='settings-grid';container.append(grid);
  const definitions=[['slug','页面标识（网址目录）','text'],['title','页面标题','text'],['type','页面类型','select'],['seoTitle','SEO 标题','text'],['description','SEO 描述','textarea'],['keywords','SEO 关键词（逗号分隔）','text'],['top_img','顶部图片','text'],['aside','显示侧栏','checkbox'],['comments','显示评论（仍需已配置评论服务）','checkbox']];
  for(const [key,text,type]of definitions){const label=document.createElement('label');label.textContent=text;const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');input.name=key;fields[key]=input;
    const value=key==='slug'?payload.slug:payload.page[key];
    if(type==='select'){
      for(const [v,t]of [['','普通内容（Markdown）'],['link','友链页面']]){const option=document.createElement('option');option.value=v;option.textContent=t;input.append(option);}
      if(value&&!['','link'].includes(value)){const option=document.createElement('option');option.value=value;option.textContent=`已有主题页面（${value}）`;input.append(option);}
      input.value=value||'';input.disabled=!payload.isNew;
    }else if(type==='checkbox'){input.type='checkbox';input.checked=value??key==='aside';label.className='check';}
    else{input.value=Array.isArray(value)?value.join(', '):value===false?'':value||'';if(key==='slug'){input.readOnly=!payload.isNew;input.required=true;input.maxLength=120;}if(key==='title'){input.required=true;input.maxLength=300;}if(key==='description')input.maxLength=1000;}
    label.append(input);grid.append(label);
    if(key==='top_img'){const button=document.createElement('button');button.type='button';button.dataset.upload='';button.textContent='上传顶部图片';button.onclick=()=>upload(url=>{input.value=url;input.dispatchEvent(new Event('input',{bubbles:true}));});label.append(button);}
  }
  const note=document.createElement('p');note.className='muted';note.textContent='页面标识创建后不可更改。普通关于页使用 Markdown；原主题复杂关于卡片的数据不在本次编辑范围。页面发布后，可在导航与链接中添加入口。';container.append(note);
  const label=document.createElement('label');label.textContent='页面正文（Markdown）';const body=document.createElement('textarea');body.name='body';body.rows=16;body.value=payload.page.body||'';label.append(body);container.append(label);fields.body=body;
  let getFriends;
  if(payload.page.type==='link'){
    const section=document.createElement('div');section.className='setting-group';section.dataset.friends='';const heading=document.createElement('h2');heading.textContent='友链分类与站点';const hint=document.createElement('p');hint.className='muted';hint.textContent='友链数据由所有友链页共享。保存会将本页与友链数据一起提交；不修改未开放的样式或站点属性。';section.append(heading,hint);container.append(section);getFriends=renderList(section,friendSchema,payload.friends||[],upload);
  }
  return ()=>{
    const page=Object.fromEntries(Object.entries(fields).filter(([key])=>key!=='slug').map(([key,input])=>[key,input.type==='checkbox'?input.checked:key==='keywords'?input.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean):input.value]));
    if(payload.page.top_img===false&&!page.top_img)page.top_img=false;
    return {head:payload.head,slug:fields.slug.value.trim(),page,...(getFriends?{friends:getFriends()}:{})};
  };
}
