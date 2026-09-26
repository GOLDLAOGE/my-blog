const labels = {
  title:'网站标题', subtitle:'网站副标题', description:'全站 SEO 描述', keywords:'全站关键词', author:'作者', language:'语言（如 zh-CN）', url:'正式网站网址',
  favicon:'网站图标', avatar_img:'头像图片', avatar_effect:'头像旋转', nav_enable:'启用顶部导航', nav_travelling:'启用开往链接', nav_clock:'显示时钟',
  index_img:'首页顶部图片', default_top_img:'默认顶部图片', disable_top_img:'禁用顶部图片', cover_default:'默认文章封面（每行一张）', cover_index:'首页显示封面', cover_aside:'侧栏显示封面',
  subtitle_enable:'显示首页副标题', subtitle_effect:'副标题打字效果', subtitle_loop:'循环打字', subtitle_sub:'副标题文字（每行一句）', subtitle_type_speed:'打字间隔（毫秒）', subtitle_back_speed:'删除间隔（毫秒）',
  footer_owner_enable:'显示版权信息', footer_since:'版权起始年份', footer_custom_text:'页脚自定义内容（支持 HTML）', footer_runtime_enable:'显示运行时间', footer_launch_time:'上线时间（MM/DD/YYYY HH:mm:ss）',
  error_404_enable:'启用 404 页面', error_404_subtitle:'404 提示', error_404_background:'404 背景图片',
};
export function renderSettings(container, payload, upload) {
  container.replaceChildren(); const controls = {}, lists = {};
  const group = title => { const section = document.createElement('div'); section.className='setting-group'; const h=document.createElement('h2');h.textContent=title;section.append(h);container.append(section);return section; };
  const site = group('站点信息与 SEO'), theme = group('常用主题配置');
  for (const [scope, keys, target] of [['site', payload.schema.site, site], ['theme', Object.keys(payload.schema.theme), theme]]) {
    controls[scope] = {};
    for (const key of keys) {
      const type = scope === 'site' ? 'text' : payload.schema.theme[key][1];
      const label = document.createElement('label'); label.textContent = labels[key] || key;
      const input = document.createElement(['list','urls'].includes(type) || key.includes('description') || key==='footer_custom_text' ? 'textarea' : 'input');
      input.dataset.type = type;
      const value = payload.settings[scope][key];
      if (type === 'boolean') { input.type='checkbox';input.checked=value;label.className='check'; }
      else if (['number','year'].includes(type)) {input.type='number';input.min='0';input.value=value;}
      else { input.value = Array.isArray(value) ? value.join('\n') : value === false ? '' : value; }
      label.append(input); target.append(label);controls[scope][key]=input;
      if (['url','image','urls'].includes(type)) { const button=document.createElement('button');button.type='button';button.className='upload-field';button.textContent='上传图片';button.onclick=()=>upload(url=>{input.value=type==='urls' && input.value ? input.value+'\n'+url : url;input.dispatchEvent(new Event('input',{bubbles:true}));});target.append(button); }
    }
  }
  for (const [key, title] of [['menu','主菜单'],['social','社交链接'],['navigation','顶部导航分组']]) {
    const target=group(title), rows=document.createElement('div');target.append(rows);lists[key]=rows;
    const add = data => {
      const row=document.createElement('div');row.className='link-row';
      for(const field of key==='social'?['name','url','icon']:['group','name','url','icon']) { const label=document.createElement('label');label.textContent=({group:'分组',name:'名称',url:'链接',icon:key==='navigation'?'图标图片链接':'图标类名'})[field];const input=document.createElement('input');input.dataset.field=field;input.value=data[field]||'';label.append(input);row.append(label); }
      const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.onclick=()=>{row.remove();container.dispatchEvent(new Event('input',{bubbles:true}));};row.append(remove);rows.append(row);
    };
    (payload.settings[key]||[]).forEach(add);
    const button=document.createElement('button');button.type='button';button.textContent='添加链接';button.onclick=()=>{add({});container.dispatchEvent(new Event('input',{bubbles:true}));};target.append(button);
  }
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
