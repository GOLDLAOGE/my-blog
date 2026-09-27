import { parseDocument, stringify } from 'yaml';
import { parsePost, safeUrl } from './posts.js';
import { readRows, writeRows } from './structured-lists.js';

const reserved = new Set(['admin','media','tags','categories','archives','api','assets','css','js','img','fonts','search','404']);
export function pagePath(slug) {
  if(typeof slug!=='string'||! /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,119}$/u.test(slug)||reserved.has(slug.toLowerCase()))throw new Error('页面标识无效或为保留目录');
  return `source/${slug}/index.md`;
}
export function parsePage(markdown) {
  const {frontMatter:front,body}=parsePost(markdown);
  return {title:front.title||'',body,description:front.description||'',keywords:Array.isArray(front.keywords)?front.keywords:typeof front.keywords==='string'?front.keywords.split(',').map(x=>x.trim()).filter(Boolean):[],seoTitle:front.seo_title||'',top_img:front.top_img??'',aside:front.aside??true,comments:front.comments??false,type:front.type||''};
}
export function serializePage(input,original=null) {
  const allowed=['title','body','description','keywords','seoTitle','top_img','aside','comments','type'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw new Error('包含未开放的页面字段');
  for(const [key,max]of [['title',300],['body',1000000],['description',1000],['seoTitle',300]])if(typeof input[key]!=='string'||input[key].length>max||(key==='title'&&!input[key].trim()))throw new Error('页面标题或内容格式不正确');
  if(typeof input.aside!=='boolean'||typeof input.comments!=='boolean')throw new Error('页面开关格式不正确');
  if(!Array.isArray(input.keywords)||input.keywords.length>50||input.keywords.some(x=>typeof x!=='string'||x.length>100))throw new Error('关键词必须是文本列表');
  if(input.top_img!==false&&(typeof input.top_img!=='string'||input.top_img.length>2000))throw new Error('顶部图片格式不正确');
  if(input.top_img)safeUrl(input.top_img);
  const existing=original===null?{}:parsePost(original).frontMatter;
  if(!['','link'].includes(input.type)&&input.type!==existing.type)throw new Error('页面类型只能为普通内容或友链');
  const data={...existing,title:input.title,description:input.description,keywords:input.keywords,seo_title:input.seoTitle,top_img:input.top_img,aside:input.aside,comments:input.comments};
  if(input.type)data.type=input.type;else delete data.type;
  return `---\n${stringify(data)}---\n${input.body}`;
}
export const FRIEND_SCHEMA={fields:{class_name:'text',class_desc:'text'},children:{key:'link_list',fields:{name:'text',descr:'text',link:'url',avatar:'image'}}};
function friendData(yaml) {
  const doc=parseDocument(yaml);
  if(doc.errors.length)throw new Error('友链 YAML 格式错误');
  const data=doc.toJS();if(data==null)return [];
  if(!Array.isArray(data))throw new Error('友链数据必须是分类列表');
  return data;
}
export function readFriendLinks(yaml) {
  return readRows(friendData(yaml),FRIEND_SCHEMA).map(({link_list,...group})=>({...group,links:link_list}));
}
export function writeFriendLinks(yaml,input) {
  if(!Array.isArray(input))throw new Error('友链必须是分类列表');
  const converted=input.map(group=>{
    if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).some(k=>!['_rowId','class_name','class_desc','links'].includes(k)))throw new Error('包含未开放的友链字段');
    const {links,...rest}=group;return {...rest,link_list:links};
  });
  return stringify(writeRows(friendData(yaml),converted,FRIEND_SCHEMA));
}
