# 前后台配置联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已批准的前台可维护区域集成到后台，验证保存后的配置确实改变主题输出。

**Architecture:** 延续现有 YAML 白名单、拥有者鉴权和 Git head 原子提交机制。设置扩展与页面管理分别形成可测试交付，不重写现有文章系统；最终统一验证生成结果与预览部署。

**Tech Stack:** JavaScript ES modules、Cloudflare Pages Functions、Hexo 8、AnZhiYu、yaml、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-27-cms-frontend-controls-design.md`

## Global Constraints

- 只在 `feature/cms-backend` 实现和验收；不合并 main，不调整生产环境或密钥。
- 保留原主题视觉、当前蓝白后台样式、现有文章和未开放配置。
- 不做任意 YAML 编辑、代码注入编辑器、CDN/构建内部参数面板、主题切换、第三方账号配置。
- 菜单链接与首页分类入口仅控制链接，不自动创建分类或页面。
- GitHub 提交成功不等于部署成功；不承诺无需构建的即时生效。
- 不增加依赖；所有文件编辑使用 apply_patch；提交只包含本任务文件。

## Review Focus

1. 缺失配置不能在展开/保存后台时被改成 false、0 或空字符串：任务 1 测默认值。
2. 列表排序、重复名称和改名不能丢失隐藏属性或套用另一行属性：任务 1 测稳定标识。
3. 切换设置分类后，未显示控件的数据仍须提交：任务 2 测全表单收集。
4. 页面 slug 的编码、大小写和保留目录不能绕过路径限制：任务 3 测路径矩阵。
5. 文件不存在与 GitHub 上游故障必须区分，且保存中出现并发不能覆盖：任务 4 测 404/502/409。

---

## 文件职责

- 修改 `functions/_lib/settings.js`：字段读取、校验、YAML 保留及结构化列表写入。
- 新建 `functions/_lib/settings-schema.js`：已批准字段的路径、类型、枚举、范围、默认值及分类元数据；默认值逐项对照主题配置。
- 修改 `functions/api/settings.js`：向后台返回扩展 schema，保持现有原子提交。
- 修改 `source/admin/settings.js`：分类、类型控件、列表编辑和全表单收集。
- 新建 `functions/_lib/pages.js`：普通页面路径与 front matter、友链 YAML 序列化。
- 修改 `functions/_lib/github-repo.js`：按不可变 head 列举普通页面。
- 新建 `functions/api/pages/index.js`、`functions/api/pages/[slug].js`：列表、读取、新建和更新。
- 新建 `source/admin/pages.js`：页面列表、编辑和友链分类控件。
- 修改 `source/admin/app.js`、`index.html`、`style.css`：导航及页面控制器接入、提交状态；保留现有视觉。
- 扩展已有测试；新建 `test/pages.test.js`、`test/pages-api.test.js`、`test/admin-pages.test.js`。
- 主题模板仅在配置无法实现已批准效果时最小修改；默认不改模板。

### Task 1: 设置白名单、真实默认值与无损列表

**Files:** `functions/_lib/settings-schema.js`（新建）、`functions/_lib/settings.js`、`functions/api/settings.js`；`test/settings.test.js`。

**Interfaces:**
- 保留 `readEditableSettings(rootYaml, themeYaml) -> {site,theme,menu,social,navigation}` 与 `writeEditableSettings(rootYaml,themeYaml,input) -> {rootYaml,themeYaml}`。
- 新增导出 `SETTINGS_SCHEMA`：`{site:string[],theme:Record<string,[path,type]>,rules:Record<string,{default,options?,min?,max?}>,groups:Array<{id,label,fields:string[]}>,lists:Record<string,{path,fields}>}`。
- 结构化列表作为 `settings.lists` 返回；每行含服务端快照标识 `_rowId`，仅用于匹配原行，绝不写进 YAML。标识绑定原列表索引；重复、未知标识拒绝，新行无标识。

- [ ] 写失败测试：`missing_fields_use_theme_defaults` 断言缺失 aside.enable 为 true、display_mode 为 light；`reordered_rows_preserve_unknown_properties` 断言重复名称的两行排序/改名后各自未知属性不变；非法颜色、枚举、日期、越界整数、未知字段均抛错。
- [ ] 运行 `npm test -- test/settings.test.js`，确认新增断言因 schema/列表能力缺失而失败。
- [ ] 实现 schema：完整覆盖规格表首页、侧栏、文章、外观、页脚字段；字段键用配置路径转下划线，已有键不变。枚举和默认值逐项取自实际 `_config.anzhiyu.yml` 与主题 `_config.yml`，数值数量限 0–1000，摘要长度限 0–10000，日期真实校验。列表支持首页分类、页脚各列表和现有导航，合并已识别原行的隐藏属性；删除只删除明确移除的行。标量沿用 YAML document.setIn。
- [ ] 运行同一测试及 `npm test -- test/content-api.test.js`，全部 PASS；确认 API schema 保持旧 tuple 消费兼容。
- [ ] 提交 `feat: expand frontend settings schema and preserve list data`。

### Task 2: 分区域后台控件与清晰提交反馈

**Files:** `source/admin/settings.js`、`app.js`、`style.css`；`test/admin-groups.test.js`、`test/admin-schema.test.js`。

**Interfaces:**
- 消费任务 1 的 SETTINGS_SCHEMA；保持 `renderSettings(container,payload,upload) -> () => settings`。
- `settingsGroups(schema) -> Array<{id,label,fields}>` 使用 schema.groups，未知支持字段只进入明确的兜底分组。
- 列表编辑器收集 `_rowId` 和白名单字段，提供添加、删除、上移、下移；复用 upload 回调。

- [ ] 写失败测试：全部字段恰好出现一次；首页/侧栏/文章/外观/页脚有独立分类；通过轻量 DOM fixture 编辑两个分类并切换后，getter 同时返回两处新值和列表原标识；enum 渲染 select、color 渲染 color input。
- [ ] 运行 `npm test -- test/admin-groups.test.js test/admin-schema.test.js`，新增测试 FAIL。
- [ ] 实现类型控件和结构化列表。写明人物动画与顶部文案、侧栏总开关、独立运行时间、访问者主题偏好和链接目标限制。所有分类控件保留在同一表单；保存成功显示 SHA、“等待构建”及预览链接，不称部署成功。
- [ ] 同一测试全部 PASS；本地查看桌面 1440px 和手机 390px，无横向溢出；检查列表增删排序与图片上传回填。
- [ ] 提交 `feat: organize frontend controls in admin settings`。

### Task 3: 普通页面与友链的安全数据模型

**Files:** `functions/_lib/pages.js`（新建）；`test/pages.test.js`（新建）。

**Interfaces:**
- `pagePath(slug:string) -> string` 返回 `source/<slug>/index.md`。
- `parsePage(markdown:string) -> {title,body,description,keywords,top_img,aside,comments,type}`。
- `serializePage(input:object,original:string|null) -> string` 保留未开放 front matter。
- `readFriendLinks(yaml:string) -> Array<{_rowId,class_name,class_desc,links:Array<{_rowId,name,descr,link,avatar}>}>`。
- `writeFriendLinks(yaml:string,input:Array) -> string` 复用任务 1 的原行匹配策略，保留隐藏分类和站点属性。

- [ ] 写失败测试：`pagePath('about') === 'source/about/index.md'`；拒绝 admin、_posts、_data、media、点路径、斜线、百分号编码和保留名大小写变体；原页面未知字段保留；友链重复名字排序后隐藏属性保留；非法链接拒绝。
- [ ] 运行 `npm test -- test/pages.test.js`，FAIL：模块不存在。
- [ ] 实现路径只允许 Unicode 字母/数字/横线/下划线，长度 1–120 且不以点或下划线开头。普通页不添加 type: about；友链使用 type: link。缺失友链数据由调用方传空 YAML；Markdown 与字符串上限沿用现有请求约束，URL 沿用 safeUrl。
- [ ] 同一测试全部 PASS。
- [ ] 提交 `feat: add safe page and friend-link serializers`。

### Task 4: 页面快照 API 与原子写入

**Files:** `functions/_lib/github-repo.js`、`functions/api/pages/index.js`、`functions/api/pages/[slug].js`（后两项新建）；`test/pages-api.test.js`、`test/github-repo.test.js`。

**Interfaces:**
- 新增 `listRepositoryPages(env,head:string) -> Array<{slug,path}>`，从 head 的递归 Git tree 只选合法 source/<slug>/index.md；截断 tree 返回明确上游错误，不展示不完整结果。
- GET `/api/pages` 返回 `{head,pages}`；GET `/api/pages/:slug` 返回 `{head,page,friends?}`。
- POST `/api/pages`、PUT `/api/pages/:slug` 输入 `{head,slug,page,friends?}`，返回 `{sha,status:'building'}`。
- 消费 `contentRoute(context,mutation,handler)`、`repositoryHead(env)`、`readRepositoryFile(env,path,head)` 和 `writeRepositoryFiles(env,{head,files,message})`。

- [ ] 写失败测试：未登录/非拥有者/缺 CSRF/错误 Origin 不调用 GitHub；过期 head 返回 409；新增已存在 slug 返回 409；普通页不读取 link.yml；友链缺失 404 按空列表，502 不按空列表；友链更新一次提交含 index.md 和 link.yml；写入前 head 改变返回 409。
- [ ] 运行 `npm test -- test/pages-api.test.js test/github-repo.test.js`，FAIL：端点/列表能力缺失。
- [ ] 实现读取全部绑定同一 head；更新路径按 slug 白名单；只为 type: link 接收 friends，普通页含 friends 拒绝；使用现有原子提交且禁止 force。POST 不覆盖旧页，PUT 不创建不存在页面。
- [ ] 同一测试和 `npm test -- test/content-api.test.js test/routes.test.js` 全部 PASS。
- [ ] 提交 `feat: add authenticated page management api`。

### Task 5: 页面管理 UI

**Files:** `source/admin/pages.js`（新建）、`app.js`、`index.html`、`style.css`；`test/admin-pages.test.js`（新建）。

**Interfaces:**
- `renderPageList(container,pages,onEdit,onCreate) -> void`。
- `renderPageEditor(container,payload,upload) -> () => {head,slug,page,friends?}`；新建 payload 使用 `{head,slug:'',page:{},isNew:true}`。
- app 控制器沿用现有 api、dirty 检查及上传回调，按 isNew 调 POST 或 PUT。

- [ ] 写失败测试：编辑既有页 slug 不可改；普通页无友链字段；type: link 页可编辑分类/站点并保留 _rowId；新建普通页不产生 type: about；getter 返回完整 head；取消切页遵守 dirty 提示。
- [ ] 运行 `npm test -- test/admin-pages.test.js`，FAIL：渲染器不存在。
- [ ] 添加「页面管理」导航、列表、新建/编辑表单；字段按规格，友链分类列表复用列表交互。无删除页面动作。保存反馈与任务 2 一致。
- [ ] 同一测试 PASS；桌面/手机检查页面列表、新建、图片回填、友链排序和保存错误提示。
- [ ] 提交 `feat: add admin pages and friend-link editing`。

### Task 6: 生成输出回归与预览验收

**Files:** `test/theme-cms.test.js`、`test/seo.test.js`；必要时仅修改实际失配的主题模板；新增 `docs/superpowers/plans/2026-09-27-cms-frontend-controls-verification.md` 记录证据。

**Interfaces:** 消费前五任务已有接口；不增加部署凭据或轮询服务。

- [ ] 添加模板输出失败测试：首页文案/分类 href/横幅图片，侧栏公告/微信/关闭卡片/运行日期，文章目录/版权/元信息，页脚链接/徽标/分组；用 writeEditableSettings 的结果作为渲染配置而非手写另一份映射。页面标题、SEO、Markdown、友链头像同样检查输出。
- [ ] 运行 `npm test -- test/theme-cms.test.js test/seo.test.js`；若全部通过说明主题无需改动，记录此结果，不制造无意义失败。
- [ ] 仅修正实际失配映射或必要模板；用临时隔离构建 fixture 验证主题主色进入 CSS、页面路由产生，保证不改当前文章及作者值。
- [ ] 运行 `npm test` 和 `npm run build` 全部 PASS；检查 git diff 仅含范围内文件；桌面/手机无溢出；一次独立最终代码审查并修复有效问题。
- [ ] 提交 `test: verify frontend settings and page output`。推送需要用户明确授权；线上测试需具体测试值与写入授权。获授权后后台保存一组可识别值，核对 SHA、Cloudflare 成功状态与前台实际结果，再恢复临时值并核对恢复部署。未获授权时记录线上尚未验收，不宣称端到端完成。

## 自审结果

规格字段分组由任务 1–2 覆盖；页面/友链与路径、鉴权、并发由任务 3–5 覆盖；输出、视觉及线上证据由任务 6 覆盖。五项 Review Focus 均有所属测试；签名和数据结构保持一致。不扩展生产发布、页面删除或第三方服务范围。
