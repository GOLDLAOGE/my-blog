const labels = {
  title:'网站标题', subtitle:'网站副标题', description:'全站 SEO 描述', keywords:'全站关键词', author:'作者', language:'语言（如 zh-CN）', url:'正式网站网址',
  favicon:'网站图标', avatar_img:'头像图片', avatar_effect:'头像旋转', nav_enable:'启用顶部导航', nav_travelling:'启用开往链接', nav_clock:'显示时钟',
  index_img:'首页顶部图片', default_top_img:'默认顶部图片', disable_top_img:'禁用顶部图片', cover_default:'默认文章封面（每行一张）', cover_index:'首页显示封面', cover_aside:'侧栏显示封面',
  subtitle_enable:'显示首页副标题', subtitle_effect:'副标题打字效果', subtitle_loop:'循环打字', subtitle_sub:'副标题文字（每行一句）', subtitle_type_speed:'打字间隔（毫秒）', subtitle_back_speed:'删除间隔（毫秒）',
  footer_owner_enable:'显示版权信息', footer_since:'版权起始年份', footer_custom_text:'页脚自定义内容（支持 HTML）', footer_runtime_enable:'显示运行时间', footer_launch_time:'上线时间（MM/DD/YYYY HH:mm:ss）',
  error_404_enable:'启用 404 页面', error_404_subtitle:'404 提示', error_404_background:'404 背景图片',
};
export function settingsGroups(schema) {
  const definitions = [
    ['basic', '基础配置', '网站身份与全站 SEO', 'site', schema.site, []],
    ['identity', '图标与头像', '网站标识与个人头像', 'theme', ['favicon','avatar_img','avatar_effect'], []],
    ['links', '导航与链接', '顶部导航、主菜单与社交入口', 'theme', ['nav_enable','nav_travelling','nav_clock'], ['menu','navigation','social']],
    ['home', '首页配置', '首页图片与副标题效果', 'theme', ['index_img','default_top_img','disable_top_img','subtitle_enable','subtitle_effect','subtitle_loop','subtitle_sub','subtitle_type_speed','subtitle_back_speed'], []],
    ['covers', '文章封面', '默认封面及列表展示位置', 'theme', ['cover_default','cover_index','cover_aside'], []],
    ['footer', '页脚配置', '版权信息与网站运行时间', 'theme', ['footer_owner_enable','footer_since','footer_custom_text','footer_runtime_enable','footer_launch_time'], []],
    ['error', '404 页面', '页面不存在时的提示与背景', 'theme', ['error_404_enable','error_404_subtitle','error_404_background'], []],
  ];
  const groups = definitions.map(([id,title,description,scope,keys,lists]) => ({id,title,description,lists,fields:keys.filter(key => scope==='site' || key in schema.theme).map(key => ({scope,key}))}));
  const assigned = new Set(groups.flatMap(group => group.fields.filter(field=>field.scope==='theme').map(field=>field.key)));
  const remaining = Object.keys(schema.theme).filter(key=>!assigned.has(key));
  if(remaining.length)groups.push({id:'other',title:'其他配置',description:'其他已开放的主题设置',lists:[],fields:remaining.map(key=>({scope:'theme',key}))});
  return groups;
}
export function renderSettings(container, payload, upload) {
  const selected = container.querySelector('[aria-current="page"]')?.dataset.category || 'basic';
  container.replaceChildren(); const controls = {site:{},theme:{}}, lists = {};
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
      const label = document.createElement('label'); label.textContent = labels[key] || key;
      const input = document.createElement(['list','urls'].includes(type) || key.includes('description') || key==='footer_custom_text' ? 'textarea' : 'input');
      input.dataset.type = type;
      const value = payload.settings[scope][key];
      if (type === 'boolean') { input.type='checkbox';input.checked=value;label.className='check'; }
      else if (['number','year'].includes(type)) {input.type='number';input.min='0';input.value=value;}
      else { input.value = Array.isArray(value) ? value.join('\n') : value === false ? '' : value; }
      const field=document.createElement('div');field.className='setting-field';label.append(input);field.append(label);fields.append(field);controls[scope][key]=input;
      if (['url','image','urls'].includes(type)) { const button=document.createElement('button');button.type='button';button.className='upload-field';button.textContent='上传图片';button.onclick=()=>upload(url=>{input.value=type==='urls' && input.value ? input.value+'\n'+url : url;input.dispatchEvent(new Event('input',{bubbles:true}));});field.append(button); }
    }
    for (const key of category.lists) {
    const section=document.createElement('div');section.className='setting-group';const heading=document.createElement('h3');heading.textContent=({menu:'主菜单',social:'社交链接',navigation:'顶部导航分组'})[key];section.append(heading);target.append(section);
    const rows=document.createElement('div');section.append(rows);lists[key]=rows;
    const add = data => {
      const row=document.createElement('div');row.className='link-row';
      for(const field of key==='social'?['name','url','icon']:['group','name','url','icon']) { const label=document.createElement('label');label.textContent=({group:'分组',name:'名称',url:'链接',icon:key==='navigation'?'图标图片链接':'图标类名'})[field];const input=document.createElement('input');input.dataset.field=field;input.value=data[field]||'';label.append(input);row.append(label); }
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
      result[scope][key]=type==='boolean'?input.checked:['number','year'].includes(type)?Number(input.value):['list','urls'].includes(type)?input.value.split('\n').map(x=>x.trim()).filter(Boolean):type==='image' && !input.value?false:input.value;
    }
    for(const [key,rows] of Object.entries(lists)) result[key]=[...rows.children].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.field,input.value.trim()])));
    return result;
  };
}
