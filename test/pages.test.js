import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { pagePath, parsePage, serializePage, readFriendLinks, writeFriendLinks } from '../functions/_lib/pages.js';
it('maps only safe ordinary page slugs',()=>{
  expect(pagePath('about')).toBe('source/about/index.md');
  expect(pagePath('关于')).toBe('source/关于/index.md');
  for(const slug of ['admin','ADMIN','_posts','_data','media','tags','categories','archives','../about','a/b','%61dmin','.env','a\\b'])expect(()=>pagePath(slug),slug).toThrow();
});
it('preserves unopened page metadata when editing ordinary Markdown',()=>{
  const original='---\ntitle: Old\ncustom:\n  keep: true\n---\nOld body';
  const page=parsePage(original);page.title='New';page.body='# New content';page.description='SEO';page.top_img='/media/top.webp';
  const saved=serializePage(page,original);
  expect(saved).toContain('# New content');
  const front=parse(saved.split('---')[1]);
  expect(front.custom.keep).toBe(true);expect(front.type).toBeUndefined();expect(front.top_img).toBe('/media/top.webp');
});
it('validates page fields and rejects injected config paths',()=>{
  const page={title:'Test',body:'Body',description:'',keywords:[],seoTitle:'',top_img:'',aside:true,comments:false,type:''};
  for(const change of [{title:''},{top_img:'javascript:evil()'},{aside:'true'},{type:'about'},{layout:'admin'},{keywords:[42]}])expect(()=>serializePage({...page,...change},null)).toThrow();
});
it('round-trips friend groups and duplicate sites with their hidden properties',()=>{
  const original='- class_name: Friends\n  class_desc: Desc\n  flink_style: anzhiyu\n  link_list:\n    - name: Same\n      link: https://one.test\n      avatar: /one.webp\n      descr: One\n      tag: first\n    - name: Same\n      link: https://two.test\n      avatar: /two.webp\n      descr: Two\n      tag: second\n';
  const input=readFriendLinks(original);input[0].links.reverse();input[0].links[0].name='New';
  const saved=parse(writeFriendLinks(original,input));
  expect(saved[0].flink_style).toBe('anzhiyu');expect(saved[0].link_list[0]).toMatchObject({name:'New',tag:'second'});
  expect(saved[0].link_list[1].tag).toBe('first');expect(saved[0]._rowId).toBeUndefined();
  input[0].links[0].link='javascript:evil()';expect(()=>writeFriendLinks(original,input)).toThrow();
});
it('reads absent friend data as empty without inventing sites',()=>expect(readFriendLinks('')).toEqual([]));
