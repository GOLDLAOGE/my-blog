import { renderList } from './lists.js';
const labels = {
  title:'网站标题', subtitle:'网站副标题', description:'全站 SEO 描述', keywords:'全站关键词', author:'作者', language:'语言（如 zh-CN）', url:'正式网站网址',
  favicon:'网站图标', avatar_img:'头像图片', avatar_effect:'头像旋转', nav_enable:'启用顶部导航', nav_travelling:'启用开往链接',
  index_img:'首页顶部图片', default_top_img:'默认顶部图片', disable_top_img:'禁用顶部图片', cover_default:'默认文章封面（每行一张）', cover_index:'首页显示封面', cover_aside:'侧栏显示封面',
  subtitle_enable:'显示首页副标题', subtitle_effect:'副标题打字效果', subtitle_loop:'循环打字', subtitle_sub:'副标题文字（每行一句）', subtitle_type_speed:'打字间隔（毫秒）', subtitle_back_speed:'删除间隔（毫秒）',
  footer_owner_enable:'显示版权信息', footer_since:'版权起始年份', footer_custom_text:'页脚自定义内容（支持 HTML）', footer_runtime_enable:'显示运行时间', footer_launch_time:'上线时间（MM/DD/YYYY HH:mm:ss）',
  error_404_enable:'启用 404 页面', error_404_subtitle:'404 提示', error_404_background:'404 背景图片',
};
export function settingsGroups(schema) {
  const definitions = [
    ['basic', '基础配置', '网站身份与全站 SEO', 'site', schema.site, []],
    ['identity', '图标与头像', '网站标识与个人头像', 'theme', ['favicon','avatar_img','avatar_effect'], []],
    ['links', '导航与链接', '顶部导航、主菜单与社交入口', 'theme', ['nav_enable','nav_travelling'], ['menu','navigation','social']],
    ['home', '首页配置', '首页图片与副标题效果', 'theme', ['index_img','default_top_img','disable_top_img','subtitle_enable','subtitle_effect','subtitle_loop','subtitle_sub','subtitle_type_speed','subtitle_back_speed'], []],
    ['covers', '文章封面', '默认封面及列表展示位置', 'theme', ['cover_default','cover_index','cover_aside'], []],
    ['footer', '页脚配置', '版权信息与网站运行时间', 'theme', ['footer_owner_enable','footer_since','footer_custom_text','footer_runtime_enable','footer_launch_time'], []],
    ['error', '404 页面', '页面不存在时的提示与背景', 'theme', ['error_404_enable','error_404_subtitle','error_404_background'], []],
  ];
  const groups = definitions.map(([id,title,description,scope,keys,lists]) => ({id,title,description,lists,fields:keys.filter(key => scope==='site' || key in schema.theme).map(key => ({scope,key}))}));
  if(schema.groups){
    const covers=groups.splice(groups.findIndex(g=>g.id==='covers'),1)[0];
    const error=groups.splice(groups.findIndex(g=>g.id==='error'),1)[0];
    for(const group of schema.groups){let target=groups.find(g=>g.id===group.id);if(!target){target={id:group.id,title:group.label,description:'',fields:[],lists:[]};groups.push(target);}target.fields.push(...group.fields.map(key=>({scope:'theme',key})));}
    groups.find(g=>g.id==='post').fields.push(...covers.fields);
    groups.find(g=>g.id==='appearance').fields.push(...error.fields);
    for(const [key,list]of Object.entries(schema.lists||{}))groups.find(g=>g.id===list.group).lists.push(key);
    const descriptions={home:'顶部区域关闭时，下方子配置不会显示；人物动画开启时隐藏顶部文案。分类链接不会自动创建分类。',aside:'侧栏总开关影响所有卡片。这里的运行时间与页脚运行时间分别管理。',post:'文章信息、目录、版权及封面显示。',appearance:'默认明暗模式可能被访问者保存的偏好覆盖。',footer:'页脚运行时间、底栏、徽标、社交栏和分组链接。',links:'菜单仅设置链接，目标页面需先创建，否则可能返回 404。图标类名如 anzhiyu-icon-link。'};
    for(const group of groups)if(descriptions[group.id])group.description=descriptions[group.id];
    const order=['basic','identity','links','home','aside','post','appearance','footer'];groups.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  }
  const assigned = new Set(groups.flatMap(group => group.fields.filter(field=>field.scope==='theme').map(field=>field.key)));
  const remaining = Object.keys(schema.theme).filter(key=>!assigned.has(key));
  if(remaining.length)groups.push({id:'other',title:'其他配置',description:'其他已开放的主题设置',lists:[],fields:remaining.map(key=>({scope:'theme',key}))});
  return groups;
}
export function renderSettings(container, payload, upload) {
  const selected = container.querySelector('[aria-current="page"]')?.dataset.category || 'basic';
  container.replaceChildren(); const controls = {site:{},theme:{}}, lists = {}, structured = {};
  const navigation=document.createElement('nav');navigation.className='settings-categories';navigation.setAttribute('aria-label','设置分类');container.append(navigation);
  const panels=[];
  const select = id => {for(const {button,panel} of panels){panel.hidden=panel.id!==id;if(panel.hidden)button.removeAttribute('aria-current');else button.setAttribute('aria-current','page');}};
  for(const category of settingsGroups(payload.schema)) {
    const button=document.createElement('button');button.type='button';button.textContent=category.title;button.dataset.category=category.id;navigation.append(button);
    const target=document.createElement('div');target.id=category.id;target.className='setting-panel';
    const heading=document.createElement('h2');heading.textContent=category.title;const description=document.createElement('p');description.className='muted';description.textContent=category.description;target.append(heading,description);container.append(target);
    panels.push({button,panel:target});button.onclick=()=>select(category.id);
    const fields=document.createElement('div');fields.className='settings-grid';target.append(fields);
    for (const {scope,key} of category.fields) {
      const type = scope === 'site' ? 'text' : payload.schema.theme[key][1];
      const rule=payload.schema.rules?.[key];
      const label = document.createElement('label'); label.textContent = rule?.label || labels[key] || key;
      const input = document.createElement(type==='enum'?'select':['list','urls'].includes(type) || key.includes('description') || key==='footer_custom_text' || key==='aside_card_announcement_content' ? 'textarea' : 'input');
      input.dataset.type = type;input.dataset.key=key;
      if(type==='enum')for(const value of rule.options){const option=document.createElement('option');option.value=String(value);option.textContent=(key==='index_post_content_method'?{false:'不显示摘要',1:'文章描述',2:'描述优先，否则自动截取',3:'自动截取正文'}:key==='darkmode_autoChangeMode'?{false:'不自动切换',1:'跟随系统',2:'按时间切换'}:{false:'关闭',light:'浅色',dark:'深色',left:'左侧',right:'右侧',created:'创建日期',updated:'更新日期',both:'创建与更新',date:'完整日期',relative:'相对时间',simple:'简洁日期'})[String(value)]||String(value);input.append(option);}
      const value = payload.settings[scope][key];
      if (type === 'boolean') { input.type='checkbox';input.checked=value;label.className='check'; }
      else if (['number','year'].includes(type)) {input.type='number';input.min=rule?.min??0;input.max=rule?.max??(type==='year'?9999:10000);input.value=value;}
      else { input.value = Array.isArray(value) ? value.join('\n') : value === false ? '' : value; }
      if(type==='color'){input.type='color';input.value=/^#[0-9a-f]{3}$/i.test(value)?'#'+value.slice(1).split('').map(c=>c+c).join(''):value;}
      if(type==='enum')input.value=String(value);
      const field=document.createElement('div');field.className='setting-field';label.append(input);field.append(label);fields.append(field);controls[scope][key]=input;
      if (['url','image','urls'].includes(type)) { const button=document.createElement('button');button.type='button';button.className='upload-field';button.textContent='上传图片';button.onclick=()=>upload(url=>{input.value=type==='urls' && input.value ? input.value+'\n'+url : url;input.dispatchEvent(new Event('input',{bubbles:true}));});field.append(button); }
    }
    for (const key of category.lists) {
    if(payload.schema.lists?.[key]){
      const schema=payload.schema.lists[key],section=document.createElement('div');section.className='setting-group';section.dataset.list=key;
      const heading=document.createElement('h3');heading.textContent=schema.label;section.append(heading);target.append(section);
      structured[key]=renderList(section,schema,payload.settings.lists?.[key]||[],upload);continue;
    }
    const section=document.createElement('div');section.className='setting-group';const heading=document.createElement('h3');heading.textContent=({menu:'主菜单',social:'社交链接',navigation:'顶部导航分组'})[key];section.append(heading);target.append(section);
    const rows=document.createElement('div');section.append(rows);lists[key]=rows;
    const add = data => {
      const row=document.createElement('div');row.className='link-row';
      row.dataset.rowId=data._rowId||'';
      for(const field of key==='social'?['name','url','icon']:['group','name','url','icon']) { const label=document.createElement('label');label.textContent=({group:'分组',name:'名称',url:'链接',icon:key==='navigation'?'图标图片链接':'图标类名'})[field];const input=document.createElement('input');input.dataset.field=field;input.value=data[field]||'';label.append(input);row.append(label); }
      for(const [action,text] of [['up','上移'],['down','下移']]){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=text;button.onclick=()=>{const sibling=action==='up'?row.previousElementSibling:row.nextElementSibling;if(sibling)rows.insertBefore(action==='up'?row:sibling,action==='up'?sibling:row);container.dispatchEvent(new Event('input',{bubbles:true}));};row.append(button);}
      const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.onclick=()=>{row.remove();container.dispatchEvent(new Event('input',{bubbles:true}));};row.append(remove);rows.append(row);
    };
    (payload.settings[key]||[]).forEach(add);
    const button=document.createElement('button');button.type='button';button.textContent='添加链接';button.onclick=()=>{add({});container.dispatchEvent(new Event('input',{bubbles:true}));};section.append(button);
    }
  }
  select(panels.some(({panel})=>panel.id===selected)?selected:'basic');
  return () => {
    const result = { site:{}, theme:{} };
    for(const scope of ['site','theme']) for(const [key,input] of Object.entries(controls[scope])) {
      const type=input.dataset.type;
      result[scope][key]=type==='enum'?payload.schema.rules[key].options.find(v=>String(v)===input.value):type==='boolean'?input.checked:['number','year'].includes(type)?Number(input.value):['list','urls'].includes(type)?input.value.split('\n').map(x=>x.trim()).filter(Boolean):type==='image' && !input.value?false:input.value;
    }
    for(const [key,rows] of Object.entries(lists)) result[key]=[...rows.children].map(row=>({...Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.field,input.value.trim()])),...(row.dataset.rowId?{_rowId:row.dataset.rowId}:{})}));
    if(Object.keys(structured).length)result.lists=Object.fromEntries(Object.entries(structured).map(([key,get])=>[key,get()]));
    return result;
  };
}
