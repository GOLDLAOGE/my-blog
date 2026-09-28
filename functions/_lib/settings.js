import { parseDocument } from 'yaml';
import { safeUrl } from './posts.js';
import { SETTINGS_SCHEMA } from './settings-schema.js';
import { readRows, writeRows } from './structured-lists.js';

export const SITE_FIELDS = ['title', 'subtitle', 'description', 'keywords', 'author', 'language', 'url'];
export const THEME_FIELDS = {
  favicon: ['favicon', 'url'], avatar_img: ['avatar.img', 'url'], avatar_effect: ['avatar.effect', 'boolean'],
  nav_enable: ['nav.enable', 'boolean'], nav_travelling: ['nav.travelling', 'boolean'],
  index_img: ['index_img', 'image'], default_top_img: ['default_top_img', 'image'], disable_top_img: ['disable_top_img', 'boolean'],
  cover_default: ['cover.default_cover', 'urls'], cover_index: ['cover.index_enable', 'boolean'], cover_aside: ['cover.aside_enable', 'boolean'],
  subtitle_enable: ['subtitle.enable', 'boolean'], subtitle_effect: ['subtitle.effect', 'boolean'], subtitle_loop: ['subtitle.loop', 'boolean'],
  subtitle_sub: ['subtitle.sub', 'list'], subtitle_type_speed: ['subtitle.typeSpeed', 'number'], subtitle_back_speed: ['subtitle.backSpeed', 'number'],
  footer_owner_enable: ['footer.owner.enable', 'boolean'], footer_since: ['footer.owner.since', 'year'], footer_custom_text: ['footer.custom_text', 'text'],
  footer_runtime_enable: ['footer.runtime.enable', 'boolean'], footer_launch_time: ['footer.runtime.launch_time', 'date'],
  error_404_enable: ['error_404.enable', 'boolean'], error_404_subtitle: ['error_404.subtitle', 'text'], error_404_background: ['error_404.background', 'url'],
  ...SETTINGS_SCHEMA.theme,
};
const legacyDefaults = { avatar_effect:false, nav_enable:false, nav_travelling:false, disable_top_img:false,
  cover_index:true,cover_aside:true,subtitle_enable:false,subtitle_effect:true,subtitle_loop:true,subtitle_type_speed:150,subtitle_back_speed:50,
  footer_owner_enable:true,footer_since:2020,footer_runtime_enable:false,footer_launch_time:'04/01/2021 00:00:00',error_404_enable:true,
  error_404_subtitle:'请尝试站内搜索寻找文章',error_404_background:'https://bu.dusays.com/2023/05/08/645907596997d.gif',
  avatar_img:'https://bu.dusays.com/2023/04/27/64496e511b09c.jpg',favicon:'/favicon.ico' };
export const EDITABLE_SCHEMA = { ...SETTINGS_SCHEMA, site:SITE_FIELDS, theme:THEME_FIELDS };
function getPath(object, path) { return path.split('.').reduce((node, part) => node?.[part], object); }
function document(text) {
  const doc = parseDocument(text);
  if (doc.errors.length || !doc.toJS() || typeof doc.toJS() !== 'object' || Array.isArray(doc.toJS())) throw new Error('配置 YAML 格式错误');
  return doc;
}
function defaults(type) { return ['boolean', 'image'].includes(type) ? false : ['list', 'urls'].includes(type) ? [] : ['number', 'year'].includes(type) ? 0 : ''; }
function linkRow(name, value, group = '') {
  const [url = '', icon = ''] = String(value).split('||').map(x => x.trim());
  return { group, name, url, icon };
}
export function readEditableSettings(rootYaml, themeYaml) {
  const root = document(rootYaml).toJS(), theme = document(themeYaml).toJS();
  const site = Object.fromEntries(SITE_FIELDS.map(key => [key, root[key] || '']));
  const fields = Object.fromEntries(Object.entries(THEME_FIELDS).map(([key, [path, type]]) => {
    const value = path.split('.').reduce((node, part) => node?.[part], theme);
    return [key, value ?? SETTINGS_SCHEMA.rules[key]?.default ?? legacyDefaults[key] ?? defaults(type)];
  }));
  const menu = Object.entries(theme.menu || {}).flatMap(([name, value]) => value && typeof value === 'object'
    ? Object.entries(value).map(([child, link]) => linkRow(child, link, name)) : [linkRow(name, value)]);
  const social = Object.entries(theme.social || {}).map(([name, value]) => { const { group, ...row } = linkRow(name, value); return row; });
  const navigation = (theme.nav?.menu || []).flatMap((group,gi) => (group.item || []).map((item,ii) => ({ _rowId:`${gi}:${ii}`, group: group.title, name: item.name, url: item.link, icon: item.icon || '' })));
  const lists = Object.fromEntries(Object.entries(SETTINGS_SCHEMA.lists).map(([key, schema]) => [key, readRows(getPath(theme,schema.path) ?? schema.default, schema)]));
  return { site, theme: fields, menu, social, navigation, lists };
}
function known(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !keys.includes(key))) throw new Error('包含未开放的设置字段');
}
function validateValue(value, type, rule = {}) {
  if (type === 'enum') { if (!rule.options.includes(value)) throw new Error('设置选项无效'); return; }
  if (type === 'color') { if (typeof value !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) throw new Error('颜色须为十六进制'); return; }
  if (type === 'date') {
    const match = typeof value === 'string' && value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) throw new Error('时间须为 MM/DD/YYYY HH:mm:ss');
    const [,m,d,y,h,min,s] = match.map(Number), date = new Date(y,m-1,d,h,min,s);
    if (y < 1000 || date.getFullYear()!==y || date.getMonth()!==m-1 || date.getDate()!==d || h>23 || min>59 || s>59) throw new Error('日期无效');
    return;
  }
  if (type === 'boolean' && typeof value === 'boolean') return;
  if (type === 'image' && value === false) return;
  if (['number', 'year'].includes(type)) {
    if (!Number.isInteger(value) || value < (rule.min ?? 0) || value > (rule.max ?? (type === 'year' ? 9999 : 10000))) throw new Error('设置数值超出范围');
    return;
  }
  if (['list', 'urls'].includes(type)) {
    if (!Array.isArray(value) || value.length > 50 || value.some(x => typeof x !== 'string' || x.length > 2000)) throw new Error('设置必须是文本列表');
    if (type === 'urls') value.forEach(x => safeUrl(x));
    return;
  }
  if (typeof value !== 'string' || value.length > 10000) throw new Error('设置必须是文本');
  if (['url', 'image'].includes(type) && value) safeUrl(value);
  if (type === 'boolean') throw new Error('设置必须是布尔值');
}
function rows(values, grouped, imageIcon = false) {
  if (!Array.isArray(values) || values.length > 100) throw new Error('导航必须是列表');
  const seen = new Set();
  for (const row of values) {
    known(row, grouped ? ['group', 'name', 'url', 'icon', ...(imageIcon?['_rowId']:[])] : ['name', 'url', 'icon']);
    for (const key of grouped ? ['group', 'name', 'url', 'icon'] : ['name', 'url', 'icon']) {
      if (typeof row[key] !== 'string' || row[key].length > 2000 || /[\r\n]|\|\|/.test(row[key])) throw new Error('导航字段格式不正确');
    }
    if (!row.name.trim() || [row.name, row.group].some(x => ['__proto__', 'constructor', 'prototype'].includes(x))) throw new Error('导航名称不正确');
    safeUrl(row.url);
    if (row.icon && imageIcon) safeUrl(row.icon);
    else if (row.icon && !/^[\w -]+$/.test(row.icon)) throw new Error('图标名称不正确');
    const id = JSON.stringify([row.group || '', row.name]);
    if (seen.has(id)) throw new Error('导航名称不能重复');
    seen.add(id);
  }
}
export function writeEditableSettings(rootYaml, themeYaml, input) {
  known(input, ['site', 'theme', 'menu', 'social', 'navigation', 'lists']);
  known(input.site, SITE_FIELDS); known(input.theme, Object.keys(THEME_FIELDS));
  const root = document(rootYaml), theme = document(themeYaml);
  for (const [key, value] of Object.entries(input.site)) {
    validateValue(value, 'text');
    if (key === 'url') safeUrl(value, { absolute: true });
    if (key === 'title' && !value.trim()) throw new Error('网站标题不能为空');
    root.set(key, value);
  }
  for (const [key, value] of Object.entries(input.theme)) {
    const [path, type] = THEME_FIELDS[key]; validateValue(value, type,SETTINGS_SCHEMA.rules[key]); theme.setIn(path.split('.'), value);
  }
  if (input.lists !== undefined) {
    known(input.lists, Object.keys(SETTINGS_SCHEMA.lists));
    for (const [key, value] of Object.entries(input.lists)) {
      const schema = SETTINGS_SCHEMA.lists[key];
      const original = getPath(document(themeYaml).toJS(),schema.path) ?? schema.default;
      theme.setIn(schema.path.split('.'), writeRows(original,value,schema));
    }
  }
  if (input.menu !== undefined) {
    rows(input.menu, true); const map = Object.create(null);
    for (const row of input.menu) {
      const value = `${row.url} || ${row.icon}`;
      if (row.group) {
        if (typeof map[row.group] === 'string') throw new Error('菜单组与菜单名称冲突');
        (map[row.group] ||= Object.create(null))[row.name] = value;
      } else {
        if (map[row.name] !== undefined) throw new Error('菜单名称冲突');
        map[row.name] = value;
      }
    }
    theme.set('menu', map);
  }
  if (input.social !== undefined) {
    rows(input.social, false); theme.set('social', Object.fromEntries(input.social.map(row => [row.name, `${row.url} || ${row.icon}`])));
  }
  if (input.navigation !== undefined) {
    rows(input.navigation, true, true); const groups = new Map();
    const original = document(themeYaml).toJS().nav?.menu || [], ids = new Set();
    for (const row of input.navigation) {
      let oldGroup = {}, oldItem = {};
      if (row._rowId !== undefined) {
        if (typeof row._rowId !== 'string' || !/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(row._rowId) || ids.has(row._rowId)) throw new Error('导航行标识无效');
        ids.add(row._rowId);
        const [gi,ii] = row._rowId.split(':').map(Number);
        oldGroup = original[gi]; oldItem = oldGroup?.item?.[ii];
        if (!oldItem) throw new Error('导航行标识无效');
      }
      const groupId=row._rowId===undefined?`new:${row.group}`:`old:${row._rowId.split(':')[0]}:${row.group}`;
      if (!groups.has(groupId)) groups.set(groupId, {...oldGroup,title:row.group,item:[]});
      groups.get(groupId).item.push({ ...oldItem, name: row.name, link: row.url, icon: row.icon });
    }
    // New entries join an unambiguous existing group; duplicate titles stay distinct.
    for(const [id,group] of [...groups])if(id.startsWith('new:')){
      const matches=[...groups].filter(([key,value])=>key.startsWith('old:')&&value.title===group.title);
      if(matches.length>1)throw new Error('导航分组名称重复，请为新增链接使用唯一分组名称');
      if(matches.length===1){matches[0][1].item.push(...group.item);groups.delete(id);}
    }
    theme.setIn(['nav', 'menu'], [...groups.values()]);
  }
  return { rootYaml: String(root), themeYaml: String(theme) };
}
