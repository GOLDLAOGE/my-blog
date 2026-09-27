// Only public, owner-editable theme fields. Defaults mirror this theme version.
const fields = {};
const rules = {};
const groups = [];
function group(id, label, entries) {
  const keys = [];
  for (const [path, type, value, title, options, key = path.replaceAll('.', '_')] of entries) {
    fields[key] = [path, type];
    rules[key] = { default: value, label: title, ...(options ? { options } : {}), ...(type === 'number' ? { min: 0, max: path === 'index_post_content.length' ? 10000 : 1000 } : {}) };
    keys.push(key);
  }
  groups.push({ id, label, fields: keys });
}
group('home', '首页配置', [
  ['home_top.enable','boolean',true,'显示首页顶部区域'],
  ['home_top.title','text','生活明朗','顶部主标题'], ['home_top.subTitle','text','万物可爱。','顶部副标题'], ['home_top.siteText','text','anheyu.com','顶部站点文字'],
  ['peoplecanvas.enable','boolean',true,'显示人物动画（开启后隐藏顶部文案）'],
  ['peoplecanvas.img','image','https://upload-bbs.miyoushe.com/upload/2024/07/27/125766904/ba62475f396df9de3316a08ed9e65d86_5680958632268053399..png','人物图片'],
  ['home_top.banner.tips','text','新品主题','推荐横幅提示'], ['home_top.banner.title','text','Theme-AnZhiYu','推荐横幅标题'],
  ['home_top.banner.image','image','https://bu.dusays.com/2023/05/13/645fa3cf90d70.webp','推荐横幅图片'], ['home_top.banner.link','url','https://docs.anheyu.com/','推荐横幅链接'],
  ['article_double_row','boolean',true,'文章双栏布局'], ['index_post_content.method','enum',3,'摘要显示方式',[false,1,2,3]], ['index_post_content.length','number',500,'自动摘要长度'],
]);
group('aside', '侧栏配置', [
  ['aside.enable','boolean',true,'显示侧栏'], ['aside.hide','boolean',false,'默认隐藏侧栏'], ['aside.mobile','boolean',true,'移动端显示侧栏'], ['aside.position','enum','right','侧栏位置',['left','right']],
  ['aside.card_author.enable','boolean',true,'显示作者卡片'], ['aside.card_author.description','text','','作者介绍（支持 HTML）'], ['aside.card_author.name_link','url','/','作者名称链接'],
  ['aside.card_announcement.enable','boolean',false,'显示公告'], ['aside.card_announcement.content','text','欢迎来看我的博客鸭~','公告内容（支持 HTML）'],
  ['aside.card_weixin.enable','boolean',true,'显示微信卡片'], ['aside.card_weixin.face','image','https://bu.dusays.com/2023/01/13/63c02edf44033.png','微信卡片正面'], ['aside.card_weixin.backFace','image','https://bu.dusays.com/2023/05/13/645fa415e8694.png','微信卡片背面'],
  ...[['recent_post',true,5],['categories',false,8],['tags',true,40],['archives',true,8]].flatMap(([name,enabled,limit]) => [
    [`aside.card_${name}.enable`,'boolean',enabled,`${({recent_post:'最新文章',categories:'分类',tags:'标签',archives:'归档'})[name]}卡片`],
    [`aside.card_${name}.limit`,'number',limit,`${({recent_post:'最新文章',categories:'分类',tags:'标签',archives:'归档'})[name]}数量（0 为全部）`],
  ]),
  ['aside.card_webinfo.enable','boolean',true,'显示站点信息'], ['runtimeshow.enable','boolean',true,'侧栏显示运行时间'], ['runtimeshow.publish_date','date','4/1/2021 00:00:00','侧栏起始时间（MM/DD/YYYY HH:mm:ss）'],
]);
group('post', '文章页面', [
  ...['page','post'].flatMap(scope => [
    [`post_meta.${scope}.date_type`,'enum',scope==='page'?'created':'both',`${scope==='page'?'首页':'文章'}日期类型`,['created','updated','both']],
    [`post_meta.${scope}.date_format`,'enum',scope==='page'?'simple':'date',`${scope==='page'?'首页':'文章'}日期格式`,scope==='page'?['date','relative','simple']:['date','relative']],
    ...['categories','tags'].map(name => [`post_meta.${scope}.${name}`,'boolean',true,`${scope==='page'?'首页':'文章'}显示${name==='tags'?'标签':'分类'}`]),
  ]),
  ['toc.post','boolean',true,'文章目录'], ['toc.page','boolean',false,'普通页面目录'], ['toc.number','boolean',true,'目录编号'], ['toc.expand','boolean',false,'展开目录'],
  ['post_copyright.enable','boolean',true,'显示文章版权'], ['post_copyright.author_href','url','','版权作者链接'], ['post_copyright.location','text','长沙','作者地区'],
  ['post_copyright.license','text','CC BY-NC-SA 4.0','许可文字'], ['post_copyright.license_url','url','https://creativecommons.org/licenses/by-nc-sa/4.0/','许可链接'],
  ['related_post.enable','boolean',true,'显示相关文章'], ['related_post.limit','number',6,'相关文章数量'], ['photofigcaption','boolean',false,'显示图片说明'],
]);
group('appearance', '外观配置', [
  ['theme_color.enable','boolean',true,'启用自定义主色'], ['theme_color.main','color','#425AEF','浅色主色'], ['theme_color.dark_main','color','#f2b94b','深色主色'],
  ['display_mode','enum','light','默认显示模式',['light','dark']], ['darkmode.enable','boolean',true,'启用深色模式'], ['darkmode.button','boolean',true,'显示模式切换按钮'], ['darkmode.autoChangeMode','enum',1,'自动切换策略',[false,1,2]], ['footer_bg','image',false,'页脚背景图片'],
]);
group('footer', '页脚配置', [
  ['footer.runtime.work_img','image','https://npm.elemecdn.com/anzhiyu-blog@2.0.4/img/badge/安知鱼-上班摸鱼中.svg','上班状态图片'],
  ['footer.runtime.work_description','text','距离月入25k也就还差一个大佬带我~','上班状态说明'],
  ['footer.runtime.offduty_img','image','https://npm.elemecdn.com/anzhiyu-blog@2.0.4/img/badge/安知鱼-下班啦.svg','下班状态图片'], ['footer.runtime.offduty_description','text','下班了就该开开心心的玩耍，嘿嘿~','下班状态说明'],
  ['footer.footerBar.enable','boolean',true,'显示底栏'], ['footer.footerBar.authorLink','url','/','底栏作者链接'], ['footer.bdageitem.enable','boolean',false,'显示徽标'],
  ['footer.socialBar.enable','boolean',false,'显示页脚社交栏'], ['footer.socialBar.centerImg','image','','社交栏中心图片'], ['footer.list.enable','boolean',false,'显示分组链接'],
]);
const listFields = {
  home_top_category: {path:'home_top.category',label:'首页分类入口',group:'home',fields:{name:'text',path:'url',icon:'icon',class:'class'},default:[
    {name:'前端',path:'/categories/前端开发/',icon:'anzhiyu-icon-dove',class:'blue',shadow:'var(--anzhiyu-shadow-blue)'},
    {name:'大学',path:'/categories/大学生涯/',icon:'anzhiyu-icon-fire',class:'red',shadow:'var(--anzhiyu-shadow-red)'},
    {name:'生活',path:'/categories/生活日常/',icon:'anzhiyu-icon-book',class:'green',shadow:'var(--anzhiyu-shadow-green)'},
  ]},
  footer_footerBar_linkList: {path:'footer.footerBar.linkList',label:'底栏链接',group:'footer',fields:{text:'text',link:'url'},default:[{text:'主题',link:'https://github.com/anzhiyu-c/hexo-theme-anzhiyu'}]},
  footer_bdageitem_list: {path:'footer.bdageitem.list',label:'页脚徽标',group:'footer',fields:{link:'url',shields:'image',message:'text'},default:[{link:'https://hexo.io/',shields:'https://npm.elemecdn.com/anzhiyu-blog@2.1.5/img/badge/Frame-Hexo.svg',message:'博客框架为Hexo_v5.4.0'},{link:'https://hexo.anheyu.com/',shields:'https://npm.elemecdn.com/anzhiyu-theme-static@1.0.9/img/Theme-AnZhiYu-2E67D3.svg',message:'本站使用AnZhiYu主题'}]},
  footer_socialBar_left: {path:'footer.socialBar.left',label:'社交栏左侧',group:'footer',fields:{title:'text',link:'url',icon:'icon'},default:[]},
  footer_socialBar_right: {path:'footer.socialBar.right',label:'社交栏右侧',group:'footer',fields:{title:'text',link:'url',icon:'icon'},default:[]},
  footer_list_project: {path:'footer.list.project',label:'页脚分组链接',group:'footer',fields:{title:'text'},children:{key:'links',fields:{title:'text',link:'url'}},default:[]},
};
export const SETTINGS_SCHEMA = { theme: fields, rules, groups, lists: listFields };
