import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readEditableSettings, writeEditableSettings } from '../functions/_lib/settings.js';
import { writeFriendLinks } from '../functions/_lib/pages.js';
const require = createRequire(import.meta.url), pug = require('pug');
// Responsive variants are tested separately; arbitrary CMS assets keep their URL.
const cover_srcset = () => undefined;
function settingsLocals(change) {
  const root=readFileSync('_config.yml','utf8'),source=readFileSync('themes/anzhiyu/_config.yml','utf8');
  const settings=readEditableSettings(root,source);change(settings);
  const output=writeEditableSettings(root,source,settings);
  return {theme:parse(output.themeYaml),config:parse(output.rootYaml),page:{content:'<h2>Heading</h2>',tags:{data:[]},permalink:'https://test.example/post/'},site:{data:{},posts:[]},url_for:x=>x,_p:(key,...args)=>args.length?args.join(' '):key,sort_attr_post:()=>[],partial:()=>'',fragment_cache:(_,callback)=>callback(),date_xml:x=>x,date:x=>x,full_date:x=>x,pageTitle:'Title'};
}
it('renders saved home text, classification links and banner assets with their conditions',()=>{
  const locals=settingsLocals(s=>{s.theme.peoplecanvas_enable=false;s.theme.home_top_title='My home';s.theme.home_top_banner_image='/media/banner.webp';s.lists.home_top_category=[{name:'Coding',path:'/categories/coding/',icon:'anzhiyu-icon-link',class:'green'}];});
  const render=()=>pug.renderFile('themes/anzhiyu/layout/includes/top/top.pug',{...locals,cover_srcset});
  expect(render()).toContain('My home');expect(render()).toContain('href="/categories/coding/"');expect(render()).toContain('src="/media/banner.webp"');
  locals.theme.peoplecanvas.enable=true;expect(render()).not.toContain('My home');expect(render()).toContain('id="peoplecanvas"');
  locals.theme.home_top.enable=false;expect(render()).not.toContain('id="home_top"');
});
it('renders sidebar descriptions, announcements, images and independent runtime settings',()=>{
  const locals=settingsLocals(s=>{s.theme.aside_card_author_description='Author bio';s.theme.aside_card_announcement_enable=true;s.theme.aside_card_announcement_content='Announcement';s.theme.aside_card_weixin_face='/media/weixin.webp';s.theme.runtimeshow_publish_date='09/27/2026 00:00:00';});
  const render=name=>pug.renderFile(`themes/anzhiyu/layout/includes/widget/${name}.pug`,locals);
  expect(render('card_author')).toContain('Author bio');expect(render('card_announcement')).toContain('Announcement');expect(render('card_weixin')).toContain('/media/weixin.webp');expect(render('card_webinfo')).toContain('data-publishDate="09/27/2026 00:00:00"');
  locals.theme.aside.card_weixin.enable=false;expect(render('card_weixin')).not.toContain('card-wechat');
});
it('renders saved footer links, grouped projects, badges and social images',()=>{
  const locals=settingsLocals(s=>{
    s.theme.footer_bdageitem_enable=true;s.theme.footer_socialBar_enable=true;s.theme.footer_socialBar_centerImg='/media/footer.webp';s.theme.footer_list_enable=true;
    s.lists.footer_footerBar_linkList=[{text:'Policy',link:'/policy/'}];s.lists.footer_bdageitem_list=[{link:'https://test.example',shields:'/badge.svg',message:'Badge'}];
    s.lists.footer_socialBar_left=[{title:'GitHub',link:'https://github.com/test',icon:'anzhiyu-icon-github'}];s.lists.footer_list_project=[{title:'Docs',links:[{title:'Guide',link:'/guide/'}]}];
  });
  const html=pug.renderFile('themes/anzhiyu/layout/includes/footer.pug',locals);
  expect(html).toContain('href="/policy/"');expect(html).toContain('src="/badge.svg"');expect(html).toContain('src="/media/footer.webp"');expect(html).toContain('href="/guide/"');
});
it('applies the editable copyright author URL to the actual author link',()=>{
  const locals=settingsLocals(s=>{s.theme.post_copyright_author_href='https://author.example';s.theme.post_copyright_license='My license';});
  locals.theme.ptool.enable=false;
  const html=pug.renderFile('themes/anzhiyu/layout/includes/post/post-copyright.pug',locals);
  expect(html).toContain('href="https://author.example"');expect(html).toContain('My license');
});
it('renders freshly created friend groups without requiring hidden style configuration',()=>{
  const locals=settingsLocals(()=>{});locals.site.data.link=parse(writeFriendLinks('',[{class_name:'Friends',class_desc:'People',links:[{name:'New site',descr:'Description',link:'https://friend.example',avatar:'/media/friend.webp'}]}]));
  const html=pug.renderFile('themes/anzhiyu/layout/includes/page/flink.pug',locals);
  expect(html).toContain('href="https://friend.example"');expect(html).toContain('/media/friend.webp');expect(html).toContain('New site');
});
it('renders the uploaded homepage image as a background and retains CSS style configuration', () => {
  const locals = { config: { title: 'Blog' }, page: {}, theme: { index_img: '/media/test.webp', subtitle: {} },
    is_post: () => false, is_page: () => false, is_home: () => true, url_for: x => x, partial: () => '' };
  const imageHtml = pug.renderFile('themes/anzhiyu/layout/includes/header/index.pug', locals);
  expect(imageHtml).toContain('background: url(&quot;/media/test.webp&quot;) top / cover no-repeat');
  locals.theme.index_img = 'background: linear-gradient(red, blue)';
  expect(pug.renderFile('themes/anzhiyu/layout/includes/header/index.pug', locals)).toContain('style="background: linear-gradient(red, blue)"');
});
it('shows the custom excerpt before falling back to the configured body introduction', () => {
  const source = readFileSync('themes/anzhiyu/layout/includes/mixins/post-ui.pug', 'utf8') + '\n+postUI(page.posts)\n';
  const article = { title: 'Title', date: 0, path: 'post/', content: '自动正文摘要', excerpt: '自定义文章摘要', categories: { data: [] }, tags: { data: [] } };
  const locals = { site: { posts: { data: [article] } }, page: { posts: { data: [article] } },
    theme: { cover: { position: 'left' }, post_meta: { page: {} }, comments: {}, index_post_content: { method: 3, length: 100 } },
    is_home: () => true, is_current: () => false, url_for: x => x, _p: x => x, strip_html: x => x };
  expect(pug.render(source, locals)).toContain('class="content">自定义文章摘要');
  article.excerpt = '';
  expect(pug.render(source, locals)).toContain('class="content">自动正文摘要');
});
