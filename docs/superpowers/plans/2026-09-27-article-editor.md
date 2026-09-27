# Article Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认使用可视化编辑，支持 Markdown 源码切换与主题预览，保存后前台呈现设计约定的正文效果。

**Architecture:** 沿用 Markdown、文章 API 和 Hexo 构建。以 Vditor 为首选成熟编辑器，外围建立小型正文适配层、Hexo 组件转换层与安全预览层；先通过浏览器往返兼容验证，再接入现有表单，不自行开发富文本引擎。

**Tech Stack:** 原生 JavaScript、Hexo/AnZhiYu、Vditor、DOMPurify、Mermaid、Vitest；依赖锁定版本、资源同源发布，不依赖运行时公共 CDN。官方能力依据：https://github.com/Vanessa219/vditor 。

**Spec:** `docs/superpowers/specs/2026-09-27-article-editor-design.md`

## Global Constraints

- Markdown 是唯一正文持久化格式；沿用当前文章 API、YAML front matter、文件标识与版本校验。
- 保持现有蓝白后台风格、文章设置分类、图片上传和 GitHub 提交工作流。
- 不增加 ECharts、AI 摘要服务、多人协作或整站迁移。
- 无法安全识别的自定义标签或原始 HTML 必须原样保留为源码块，不能静默删除或自动改写。
- 预览不执行文章里的任意脚本、事件属性或危险 URL；流程图采用严格安全配置。
- 不推送、不合并 main、不部署生产；保留无关改动。所有文件修改使用 apply_patch。

## Review Focus

- 中文输入法组合输入期间，切换模式和上传完成不能截断输入：Task 3 浏览器用例。
- 标签参数含逗号、换行或结束标签，不能生成错误 Hexo 语法：Task 2 参数校验测试。
- 代码围栏中出现 Hexo 标签文字，不应被当作主题组件：Task 2 解析测试。
- 异步预览、图片上传或保存返回晚于文章切换，不能覆盖另一篇正文：Task 3/4 生命周期测试。
- 复杂旧文在没有任何编辑时保存，不应被编辑器自动格式化：Task 1/3 原文保留测试。

## 文件职责

- `source/admin/article-editor.js`：编辑器生命周期和正文接口；不处理 API。
- `source/admin/theme-blocks.js`：Hexo 主题组件识别、验证、序列化；不操作提交。
- `source/admin/article-preview.js`：安全正文预览和组件展示。
- `source/admin/editor.js`：保留图片压缩，增加编辑器图片插入适配，不破坏旧调用。
- `source/admin/app.js`、`index.html`、`style.css`：表单接入、组件对话框和现有风格布局。
- `scripts/cms-editor-assets.js`、`package.json`、`package-lock.json`：可重复的同源资源准备；仅复制实际需要的库资源，携带许可证。
- `_config.anzhiyu.yml`：必要时开启 Mermaid。主题模板仅在构建验收证明存在缺口时做最小兼容改动。
- `test/article-editor.test.js`、`theme-blocks.test.js`、`article-preview.test.js`、`article-editor-integration.test.js`：对应回归测试。

### Task 1: 编辑器可用性与旧文往返

**Files:** 新建 `source/admin/article-editor.js`、`scripts/cms-editor-assets.js`、`test/article-editor.test.js`；修改 `package.json`、`package-lock.json`。

**Interfaces:** `createArticleEditor({element, onChange}) -> Promise<Editor>`；Editor 提供 `load(markdown)`, `getMarkdown()`, `setMode('visual'|'source')`, `insertMarkdown(markdown)`, `setDisabled(boolean)`, `destroy()`。`load` 不触发用户修改事件；无修改时 `getMarkdown` 返回原始字符串。

- [ ] 写失败测试：原文含中文、引用链接、连续空行、围栏、未知标签和 HTML，load 后直接 getMarkdown 严格相等；禁用状态不接受插入；destroy 后回调不再触发。
- [ ] 运行 `npm test -- test/article-editor.test.js`，确认失败原因是缺少适配实现。
- [ ] 查阅官方 API、锁定 Vditor/资源版本，实现最小适配和构建前资源复制，关闭自动缓存、自动中文修正及非约定图表功能。
- [ ] 建立本地浏览器验证夹具，确认真正可视化输入、选区插入、源码切换、表格增删行列和撤销重做；验证特殊块保护可行。若 Vditor 无法满足无损主题块往返，停止并报告证据，不擅自降级成仅 Markdown 工具栏或另造引擎。
- [ ] 运行单测及 `npm run build`，检查发布文件没有运行时 CDN 依赖；提交 `feat: add Markdown visual editor adapter`。

### Task 2: 主题组件双向转换

**Files:** 新建 `source/admin/theme-blocks.js`、`test/theme-blocks.test.js`；修改 `source/admin/article-editor.js`。

**Interfaces:** `parseThemeBlocks(markdown) -> Array<{start,end,type,fields,raw}>`；`serializeThemeBlock({type,fields}) -> string`；`protectThemeBlocks(markdown) -> {markdown,blocks}`；`restoreThemeBlocks(markdown,blocks) -> string`。类型限定 link/note/folding/tabs/mermaid/opaque；不支持块使用 opaque 并保留 raw。

- [ ] 写失败测试：五类支持块解析序列化后字段一致；未知标签和 HTML 原样往返；围栏内标签不识别；嵌套块不截断；逗号/换行/结束标签注入被拒绝并给出可读错误。
- [ ] 运行 `npm test -- test/theme-blocks.test.js`，确认失败。
- [ ] 逐一读取现有 `themes/anzhiyu/scripts/tag/{link,note,folding,tabs,mermaid}.js`，按实际语法实现，不猜标签格式。保护块使用内部围栏表示，仅在编辑器内存在；恢复时验证标识唯一且完整，丢失/重复则阻止提交并保留原文。
- [ ] 接入可视化块选中和编辑回调；源码模式展示真实 Hexo 标签，不展示内部标识。
- [ ] 运行两组单测；提交 `feat: preserve and edit Hexo theme blocks`。

### Task 3: 工具栏、图片与现有发布接入

**Files:** 修改 `source/admin/index.html`、`style.css`、`app.js`、`editor.js`、`article-editor.js`；新建 `test/article-editor-integration.test.js`。

**Interfaces:** app.js 通过 Task 1 Editor 接口加载/提交正文；组件对话框调用 Task 2 序列化后插入或替换选中块。上传继续使用现有媒体 API 和 convertImageToWebp。

- [ ] 写失败测试：所有约定工具有可访问名称；load 不标脏、输入会标脏；提交读取最新 Markdown；封面/SEO/分类/标签保持；图片插入当前选区；失败保留正文；保存期间禁用编辑和文章切换，finally 恢复；失效上传回调不写另一篇文章。
- [ ] 运行 `npm test -- test/article-editor-integration.test.js`，确认失败。
- [ ] 接入三组工具栏和可视化/源码/预览切换；主题组件用有字段标签、校验错误、取消/确认的对话框；代码块选择语言，图片说明随图编辑，不添加未约定工具。
- [ ] 用编辑器实例代替直接读取 textarea；保留原字段约束、SHA 冲突处理和离开未保存提醒。发布/上传绑定当前文章生命周期，避免迟到结果覆盖新正文。
- [ ] 本地浏览器验证中文输入法、键盘焦点、对话框取消、插入位置、撤销和源码切换；运行现有 admin/posts 测试及新测试；提交 `feat: integrate visual article editing workflow`。

### Task 4: 安全主题正文预览

**Files:** 新建 `source/admin/article-preview.js`、`test/article-preview.test.js`；修改 `article-editor.js`、`style.css`、资源准备脚本、依赖锁文件及 `_config.anzhiyu.yml`（必要开启 Mermaid）。

**Interfaces:** `renderArticlePreview({element,markdown,signal}) -> Promise<void>`；只读渲染、不写仓库。Task 2 提供主题块；普通 Markdown 使用成熟库渲染，统一 DOMPurify 清理，Mermaid strict，最新请求才可更新界面。

- [ ] 写失败测试：标题、表格、语言代码块、图与说明、五类组件有对应结构；script/onerror/javascript URL 不执行、不留危险属性；非法 Mermaid 有错误提示且保留源码；迟到预览不覆盖最新输入。
- [ ] 运行 `npm test -- test/article-preview.test.js`，确认失败。
- [ ] 实现安全预览及必要同源依赖，折叠/标签页可操作；只加载约定能力，不额外开启库自带数学、ECharts 等功能。明确预览为正文近似展示，前台验收由 Task 5 负责。
- [ ] 运行全部编辑器测试，浏览器检查恶意输入无执行与外部脚本请求；提交 `feat: add safe theme-aware article preview`。

### Task 5: 前台构建与完整验收

**Files:** 新建 `test/article-editor-output.test.js`、`docs/superpowers/plans/2026-09-27-article-editor-verification.md`；仅按验收缺口修改相关主题模板/脚本。

**Interfaces:** 使用 Task 1/2 输出真实 Markdown，经当前 Hexo 配置构建；不通过后台发布真实测试文章、不写远端仓库。

- [ ] 写构建输出测试夹具：标题、粗体、列表、引用、链接、图片说明、表格、语言代码块、链接卡片、提示块、折叠、标签页、Mermaid 各一例；断言生成 HTML 有对应元素、正文路径和代码内容，内部保护标识不泄漏。
- [ ] 运行 `npm test -- test/article-editor-output.test.js`；发现真实缺口先补失败断言，再作最小修复，不顺手重构主题。
- [ ] 运行 `npm test`、`npm run build`、`git diff --check`；记录测试数量与结果，不沿用旧任务的通过数字。
- [ ] 本地浏览器批量检查桌面 1440px/手机 390px：可视化输入、源码往返、图片上传模拟、组件编辑、表格和长代码无页面横向溢出；检查前台流程图、图片说明、折叠和标签页。一次集中修正后确认。
- [ ] 完成一次独立整分支审查，修复实质问题并重跑相关测试；记录已验证与限制，提交 `test: verify visual editor and frontend output`。清理本次临时夹具/服务，保留用户文章。

## 实施方式与交付

建议 Native：由当前会话逐项实施，最后一次独立审查。原因是编辑器实例、主题块保护和预览之间接口紧密，保持实现上下文更直接；不需要按任务各开一名实现代理。

另一选择是 Subagent-driven：每项任务由新代理实施并逐项独立审查，检查更细，但成本更高。

计划须用户审核并选定实施方式后执行。本计划不授权推送；完成后交付验证结果和本地提交。
