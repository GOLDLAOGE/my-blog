import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createArticleEditor } from '../source/admin/article-editor.js';

afterEach(()=>vi.unstubAllGlobals());
// Browser layout/Lute loading are exercised separately in a real browser.
class Engine {
  constructor(element, options){this.options=options;this.value='';queueMicrotask(()=>options.after());}
  setValue(value){this.value=value;this.options.input(value);}
  getValue(){return this.value;}
  insertValue(value){this.value+=value;this.options.input(this.value);}
  disabled(){} enable(){} destroy(){}
}
async function setup(){const dom=new JSDOM('<div id="editor"></div>');vi.stubGlobal('document',dom.window.document);vi.stubGlobal('Event',dom.window.Event);vi.stubGlobal('Vditor',Engine);const changes=[];const editor=await createArticleEditor({element:document.querySelector('#editor'),onChange:md=>changes.push(md)});return {editor,changes};}
it('keeps complex untouched Markdown byte-for-byte through mode switches',async()=>{
  const {editor,changes}=await setup();const original='# 中文\n\n\n[参考][x]\n\n```text\n{% note %}\n```\n{% custom x %}\n<div>原文</div>\n[x]: https://example.com\n';
  editor.load(original);expect(editor.getMarkdown()).toBe(original);editor.setMode('source');editor.setMode('visual');expect(editor.getMarkdown()).toBe(original);expect(changes).toEqual([]);
});
it('prevents disabled insertion and suppresses events after destruction',async()=>{
  const {editor,changes}=await setup();editor.load('正文');editor.setDisabled(true);editor.insertMarkdown('不应出现');expect(editor.getMarkdown()).toBe('正文');editor.setDisabled(false);editor.setMode('source');editor.insertMarkdown('新增');expect(editor.getMarkdown()).toContain('新增');expect(changes).toHaveLength(1);editor.destroy();editor.insertMarkdown('关闭后');expect(changes).toHaveLength(1);
});
it('uses source selection and preserves input while composing',async()=>{
  const {editor}=await setup();editor.load('前面 后面');editor.setMode('source');const source=document.querySelector('textarea');source.setSelectionRange(3,5);editor.insertMarkdown('替换');expect(editor.getMarkdown()).toBe('前面 替换');source.dispatchEvent(new document.defaultView.CompositionEvent('compositionstart',{bubbles:true}));expect(()=>editor.setMode('visual')).toThrow(/输入/);source.dispatchEvent(new document.defaultView.CompositionEvent('compositionend',{bubbles:true}));expect(()=>editor.setMode('visual')).not.toThrow();
});
it('retains theme components while visual text is edited and emits real tag syntax',async()=>{const {editor}=await setup();editor.load('前文\n\n{% note info %}\n重要\n{% endnote %}\n\n<div>原文</div>');editor.insertMarkdown('\n\n新增');expect(editor.getMarkdown()).toContain('{% note info %}\n重要\n{% endnote %}');expect(editor.getMarkdown()).toContain('<div>原文</div>');expect(editor.getMarkdown()).not.toContain('cms-block');});
