const paired=new Set(['note','subnote','folding','tabs','subtabs','subsubtabs','mermaid','hide','gallery','timeline']);
const names=new Set(['link','note','folding','tabs','mermaid']);
function excludedRanges(markdown){
  const ranges=[];const expression=/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*(?:\n|$)|(`+)[^`\n]*?\3/gm;
  for(const match of markdown.matchAll(expression))ranges.push([match.index,match.index+match[0].length]);
  return ranges;
}
function fieldsFor(type,args,body){
  if(type==='link'){const [title='',site='',url='',image='']=args.split(',').map(x=>x.trim());return {title,site,url,image};}
  if(type==='note')return {style:args||'info',body};
  if(type==='folding')return {title:args,body};
  if(type==='mermaid')return {body};
  if(type==='tabs'){const items=[...body.matchAll(/<!--\s*tab ([^\n]*?)\s*-->\n([\s\S]*?)<!--\s*endtab\s*-->/g)].map(m=>({title:m[1].trim(),body:m[2].replace(/\n$/,'')}));return {name:args,items};}
  return {};
}
export function parseThemeBlocks(markdown){
  const excluded=excludedRanges(markdown),blocks=[];
  const isExcluded=index=>excluded.some(([start,end])=>index>=start&&index<end);
  const tags=[...markdown.matchAll(/{%\s*([\w-]+)([\s\S]*?)%}/g)].filter(m=>!isExcluded(m.index));
  let covered=-1;
  for(let i=0;i<tags.length;i++){
    const match=tags[i],name=match[1];if(match.index<covered||name.startsWith('end'))continue;
    let end=match.index+match[0].length,body='',args=match[2].trim();
    const hasEnd=tags.slice(i+1).some(m=>m[1]==='end'+name);
    if(paired.has(name)||hasEnd){let depth=1,closing;for(let j=i+1;j<tags.length;j++){if(tags[j][1]===name)depth++;if(tags[j][1]==='end'+name&&!--depth){closing=tags[j];break;}}if(closing){body=markdown.slice(end,closing.index).replace(/^\n/,'').replace(/\n$/,'');end=closing.index+closing[0].length;}else{end=markdown.length;}}
    let type=names.has(name)?name:'opaque';
    // Preserve variant syntax that our field dialogs cannot reproduce without loss.
    if((name==='folding'&&args.includes(','))||(name==='note'&&!/^(default|primary|success|info|warning|danger)$/.test(args))||(name==='tabs'&&(args.includes(',')||body.includes('@'))))type='opaque';
    const raw=markdown.slice(match.index,end);blocks.push({start:match.index,end,type,fields:fieldsFor(type,args,body),raw});covered=end;
  }
  const html=/<([a-zA-Z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;
  for(const match of markdown.matchAll(html)){const start=match.index,end=start+match[0].length;if(isExcluded(start)||blocks.some(b=>start<b.end&&end>b.start))continue;blocks.push({start,end,type:'opaque',fields:{},raw:match[0]});}
  return blocks.sort((a,b)=>a.start-b.start);
}
function parameter(value,label,required=false){const text=String(value||'').trim();if((required&&!text)||/[,\r\n<>"'{}%@]/.test(text))throw new Error(`${label}不能为空或包含逗号、换行、标签字符`);return text;}
export function safeEditorUrl(value,{optional=false}={}){const text=String(value||'').trim();if(!text&&optional)return '';if(/^\/(?!\/)/.test(text)&&!/[\s<>"'\\]/.test(text))return text;try{const parsed=new URL(text);if(!['https:','http:'].includes(parsed.protocol)||/[\s<>"'\\]/.test(text))throw new Error();return text;}catch{throw new Error('地址必须是站内路径或 HTTP(S) 网址');}}
function bodyText(value){const body=String(value||'');if(!body.trim())throw new Error('组件内容不能为空');if(/{%\s*end\w+\s*%}|<!--\s*(?:endtab|tab\b)/i.test(body))throw new Error('组件正文不能包含结束标签，请在源码模式编辑嵌套组件');return body;}
export function serializeThemeBlock({type,fields:f}){
  if(type==='link')return `{% link ${parameter(f.title,'标题',true)}, ${parameter(f.site,'站点')}, ${parameter(safeEditorUrl(f.url),'地址',true)}, ${parameter(safeEditorUrl(f.image,{optional:true}),'图标')} %}`;
  if(type==='note'){if(!/^(default|primary|success|info|warning|danger)$/.test(f.style))throw new Error('请选择提示类型');return `{% note ${f.style} %}\n${bodyText(f.body)}\n{% endnote %}`;}
  if(type==='folding')return `{% folding ${parameter(f.title,'标题',true)} %}\n${bodyText(f.body)}\n{% endfolding %}`;
  if(type==='mermaid')return `{% mermaid %}\n${bodyText(f.body)}\n{% endmermaid %}`;
  if(type==='tabs'){const name=parameter(f.name,'标识',true);if(!/^[a-zA-Z][\w-]*$/.test(name))throw new Error('标签页标识请使用字母开头的英文、数字、横线');if(!f.items?.length)throw new Error('至少添加一个标签页');return `{% tabs ${name} %}\n${f.items.map(item=>`<!-- tab ${parameter(item.title,'标签标题',true)} -->\n${bodyText(item.body)}\n<!-- endtab -->`).join('\n')}\n{% endtabs %}`;}
  throw new Error('该组件请使用源码模式编辑');
}
export function protectThemeBlocks(markdown){
  const prefix='cms-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const blocks=parseThemeBlocks(markdown).map((block,index)=>({...block,id:prefix+'-'+index}));
  let output=markdown;for(const block of [...blocks].reverse())output=output.slice(0,block.start)+`\n\n\`\`\`cms-block\n${block.id}\n\`\`\`\n\n`+output.slice(block.end);
  return {markdown:output,blocks};
}
export function restoreThemeBlocks(markdown,blocks){
  let output=markdown;
  for(const block of blocks){const id=block.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const pattern=new RegExp('(?:\\n\\n)?```cms-block\\s*\\n'+id+'\\s*\\n```(?:\\n\\n)?','g');const matches=[...output.matchAll(pattern)];if(matches.length!==1)throw new Error('主题组件被删除或损坏，请撤销操作或恢复源码后再提交');output=output.replace(pattern,(match,offset)=>{const before=output.slice(0,offset),after=output.slice(offset+match.length);return (before&&!before.endsWith('\n')?'\n\n':'')+block.raw+(after&&!after.startsWith('\n')?'\n\n':'');});}
  if(/```cms-block\b/.test(output))throw new Error('发现未识别的内部组件，不能提交');return output;
}
