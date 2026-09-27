import { expect, it } from 'vitest';
import { parseThemeBlocks, serializeThemeBlock, protectThemeBlocks, restoreThemeBlocks } from '../source/admin/theme-blocks.js';
it('keeps inline HTML in its sentence while restoring opaque content',()=>{const raw='这是<em>重要</em>说明。',protectedValue=protectThemeBlocks(raw);expect(restoreThemeBlocks(protectedValue.markdown,protectedValue.blocks)).toBe(raw);});
it.each(['    <div>literal</div>','> ```html\n> <div>literal</div>\n> ```','- ```html\n  <div>literal</div>\n  ```'])('does not extract HTML or tags inside nested literal code: %s',raw=>{expect(parseThemeBlocks(raw)).toEqual([]);expect(protectThemeBlocks(raw).markdown).toBe(raw);});
it.each([
 ['link',{title:'文档',site:'站点',url:'https://example.com',image:'/icon.webp'},'{% link 文档, 站点, https://example.com, /icon.webp %}'],
 ['note',{style:'info',body:'**提示**'},'{% note info %}\n**提示**\n{% endnote %}'],
 ['folding',{title:'详情',body:'内容'},'{% folding 详情 %}\n内容\n{% endfolding %}'],
 ['tabs',{name:'sample',items:[{title:'一',body:'A'},{title:'二',body:'B'}]},'{% tabs sample %}\n<!-- tab 一 -->\nA\n<!-- endtab -->\n<!-- tab 二 -->\nB\n<!-- endtab -->\n{% endtabs %}'],
 ['mermaid',{body:'graph TD\nA --> B'},'{% mermaid %}\ngraph TD\nA --> B\n{% endmermaid %}']
])('serializes %s to real Hexo syntax and parses it back',(type,fields,want)=>{expect(serializeThemeBlock({type,fields})).toBe(want);expect(parseThemeBlocks(want)[0]).toMatchObject({type,fields,raw:want});});
it('preserves nested tags, unknown tags and raw HTML around ordinary edits',()=>{
 const raw='{% custom %}\n{% note info %}\n嵌套\n{% endnote %}\n{% endcustom %}\n\n<div class="old">原始 HTML</div>';
 const protectedValue=protectThemeBlocks(raw);expect(protectedValue.blocks).toHaveLength(2);expect(restoreThemeBlocks('新增\n\n'+protectedValue.markdown,protectedValue.blocks)).toBe('新增\n\n'+raw);
});
it('ignores tag-like text in code fences and inline code',()=>{expect(parseThemeBlocks('```text\n{% note %}\n{% endnote %}\n```\n\n`{% link x %}`')).toEqual([]);});
it('blocks malformed protected tokens rather than silently discarding content',()=>{const value=protectThemeBlocks('{% note info %}\n重要\n{% endnote %}');expect(()=>restoreThemeBlocks('',value.blocks)).toThrow(/组件/);expect(()=>restoreThemeBlocks(value.markdown+'\n'+value.markdown,value.blocks)).toThrow(/组件/);});
it('keeps block boundaries after the visual engine normalizes blank lines',()=>{const value=protectThemeBlocks('前文\n\n{% note info %}\n重要\n{% endnote %}\n\n后文');expect(restoreThemeBlocks(value.markdown.replace(/\n{3,}/g,'\n\n'),value.blocks)).toContain('前文\n\n{% note');});
it.each([
 {type:'link',fields:{title:'a,b',url:'https://example.com'}},
 {type:'link',fields:{title:'a',url:'javascript:alert(1)'}},
 {type:'folding',fields:{title:'x\n坏',body:'OK'}},
 {type:'note',fields:{style:'info',body:'{% endnote %}'}},
 {type:'tabs',fields:{name:'sample',items:[{title:'<img onerror=x>',body:'a'}]}}
])('rejects unsafe tag parameters',value=>expect(()=>serializeThemeBlock(value)).toThrow());
