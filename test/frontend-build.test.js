import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { readEditableSettings, writeEditableSettings } from '../functions/_lib/settings.js';
import { serializePage, writeFriendLinks } from '../functions/_lib/pages.js';
const require=createRequire(import.meta.url),Hexo=require('hexo');
it('builds actual pages, articles, CSS and assets from the editable payload without changing repository content',async()=>{
  const fixture=mkdtempSync(join(tmpdir(),'cms-frontend-build-'));
  let hexo;
  try{
    mkdirSync(join(fixture,'themes'));symlinkSync(resolve('themes/anzhiyu'),join(fixture,'themes/anzhiyu'),'dir');
    symlinkSync(resolve('node_modules'),join(fixture,'node_modules'),'dir');writeFileSync(join(fixture,'package.json'),readFileSync('package.json'));
    mkdirSync(join(fixture,'source/_posts'),{recursive:true});mkdirSync(join(fixture,'source/about'));mkdirSync(join(fixture,'source/link'));mkdirSync(join(fixture,'source/_data'));
    const root=readFileSync('_config.yml','utf8'),theme=readFileSync('themes/anzhiyu/_config.yml','utf8'),settings=readEditableSettings(root,theme);
    Object.assign(settings.theme,{home_top_title:'Fixture home',peoplecanvas_enable:false,theme_color_main:'#123456',theme_color_dark_main:'#654321',display_mode:'dark',
      aside_card_announcement_enable:true,aside_card_announcement_content:'Fixture announcement',aside_card_author_description:'Fixture author',aside_card_weixin_face:'/media/fixture-weixin.webp',runtimeshow_publish_date:'09/27/2026 00:00:00',
      post_copyright_author_href:'https://author.example',post_copyright_license:'Fixture license',post_meta_post_tags:false,toc_post:true,related_post_limit:1});
    settings.lists.home_top_category=[{name:'Fixture category',path:'/categories/fixture/',class:'blue',icon:'anzhiyu-icon-link'}];
    const output=writeEditableSettings(root,theme,settings);writeFileSync(join(fixture,'_config.yml'),output.rootYaml);writeFileSync(join(fixture,'_config.anzhiyu.yml'),output.themeYaml);
    const page={title:'Fixture About',body:'# About heading\n\nFixture Markdown',description:'Fixture SEO',keywords:['Fixture keyword'],seoTitle:'Fixture Search Title',top_img:false,aside:false,comments:false,type:''};
    writeFileSync(join(fixture,'source/about/index.md'),serializePage(page,null));writeFileSync(join(fixture,'source/link/index.md'),serializePage({...page,title:'Fixture Links',type:'link'},null));
    writeFileSync(join(fixture,'source/_data/link.yml'),writeFriendLinks('',[{class_name:'Fixture friends',class_desc:'Group description',links:[{name:'Fixture site',descr:'A friend',link:'https://friend.example',avatar:'/media/fixture-friend.webp'}]}]));
    for(const name of ['fixture','related'])writeFileSync(join(fixture,`source/_posts/${name}.md`),`---\ntitle: ${name}\ndate: 2026-01-01 12:00:00\ntags: [Fixture tag]\ncategories: [Fixture category]\n---\n## Fixture heading\n\nFixture body`);
    hexo=new Hexo(fixture,{silent:true});await hexo.init();await hexo.call('generate');
    const html=path=>readFileSync(join(fixture,'public',path),'utf8');
    const home=html('index.html'),about=html('about/index.html'),links=html('link/index.html'),post=html('2026/01/01/fixture/index.html');
    expect(home).toContain('Fixture home');expect(home).toContain('Fixture announcement');expect(home).toContain('Fixture author');expect(home).toContain('/media/fixture-weixin.webp');expect(home).toContain('href="/categories/fixture/"');
    expect(home).toContain('data-theme="dark"');expect(home).toContain('id="runtimeshow"');
    expect(about).toContain('<title>Fixture Search Title | Hexo</title>');expect(about).toContain('name="description" content="Fixture SEO"');expect(about).toContain('Fixture Markdown');expect(about).toContain('name="keywords" content="Fixture keyword"');
    expect(!!new JSDOM(about,{url:'https://fixture.test/about/'}).window.document.querySelector('#aside-content')).toBe(false);
    expect(links).toContain('href="https://friend.example"');expect(links).toContain('/media/fixture-friend.webp');
    const doc=new JSDOM(post,{url:'https://fixture.test/post/'}).window.document;
    expect(!!doc.querySelector('#card-toc')).toBe(true);expect(post).toContain('Fixture license');expect(post).toContain('href="https://author.example"');
    expect(!!doc.querySelector('#post-firstinfo .article-meta.tags')).toBe(false);
    expect(!!doc.querySelector('#article-container > header a[href^="/tags/"]')).toBe(false);
    const css=html('css/index.css');expect(/--anzhiyu-theme:\s*#123456/i.test(css)).toBe(true);expect(/--anzhiyu-theme:\s*#654321/i.test(css)).toBe(true);
  }finally{if(hexo)await hexo.exit();rmSync(fixture,{recursive:true,force:true});}
},30000);
