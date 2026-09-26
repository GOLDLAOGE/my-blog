# 个人博客 CMS 配置与验收

后台地址：`https://my-blog-4w1.pages.dev/admin/`。仅 GitHub 用户 `GOLDLAOGE` 可登录。部署代码前，先完成下面的绑定及密钥配置。

## 1. 创建 Cloudflare 存储

在现有 Cloudflare 账号创建：

- R2 标准存储桶 `my-blog-media`（生产图片）；另建 `my-blog-media-preview` 用于测试。
- Workers KV 命名空间 `my-blog-cms-sessions`；另建 `my-blog-cms-sessions-preview` 用于测试。

桶保持私有，不需要打开 r2.dev 公共访问或配置 CORS；浏览器通过同源 `/api/media` 上传，访客通过 `/media/*` 读取。

在 Workers & Pages → `my-blog` → Settings → Bindings 添加：

| 变量名 | Production 资源 | Preview 资源 |
| --- | --- | --- |
| `MEDIA_BUCKET` | `my-blog-media` | `my-blog-media-preview` |
| `CMS_SESSIONS` | `my-blog-cms-sessions` | `my-blog-cms-sessions-preview` |

新增绑定后需要重新部署。[Cloudflare 绑定说明](https://developers.cloudflare.com/pages/functions/bindings/)

## 2. 创建 GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：

- 名称：`My Blog CMS`
- Homepage URL：`https://my-blog-4w1.pages.dev`
- Authorization callback URL：`https://my-blog-4w1.pages.dev/api/auth/callback`

生成 Client Secret 后，直接填入 Cloudflare 的 Secret 字段，不要发到聊天、截图或提交 Git。OAuth 只读取账号身份，仓库写入使用下一节的独立令牌。

预览环境另建一个 OAuth App，使用稳定分支预览域名（从部署页复制完整域名，不使用每次变化的提交哈希域名）。Homepage 与 callback 必须对应预览域名，callback 后缀同样为 `/api/auth/callback`。

## 3. 创建仓库写入令牌

GitHub → Developer settings → Personal access tokens → Fine-grained tokens：

- Resource owner：`GOLDLAOGE`
- Repository access：Only select repositories → **仅 `my-blog`**
- Repository permissions：Contents → **Read and write**；Metadata 保留自动只读。
- 设置合理的有效期，过期前更换 Cloudflare Secret。不要添加其他仓库权限。

复制令牌直接填 Cloudflare，不放入前端、Git、命令参数或聊天。[GitHub Contents 权限说明](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

## 4. 配置 Pages Secrets 与环境变量

在项目 Settings → Variables and Secrets（生产与预览分别设置）：

| Secret 名称 | 值的来源 |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | 当前环境 OAuth App 的 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | 当前环境 OAuth App 的 Client Secret |
| `GITHUB_REPO_TOKEN` | 上述仓库限定令牌 |
| `CMS_SESSION_SECRET` | 密码管理器生成的至少 32 字节随机值；生产与预览使用不同值 |

服务端环境变量 `CMS_CONTENT_BRANCH`：生产为 `main`（不填也默认 main）；**预览必须填 `feature/cms-backend`**，防止测试文章进入生产分支。验证代码更新后，分支最新部署才会显示新文章；旧哈希部署不可更新。

仅部署这一条 CMS 预览分支做写入验收；不要把相同预览密钥配置用于其他不受信任的 PR 分支。

Functions 兼容日期使用 `2026-09-26`。无需 Node.js compatibility flag。保留原构建命令 `npm run build` 和输出目录 `public`。不要添加会覆盖仪表盘绑定的空 Wrangler 配置。

## 5. 本地检查与预览发布

在 CMS 工作区运行：

```sh
npm ci
npm run clean
npm run build
npm test
npx wrangler pages functions build functions --outdir .superpowers/cms-build --compatibility-date 2026-09-26
```

Hexo 本地 `npm run server` 只预览静态后台，不提供 OAuth、R2 和 GitHub API。完整检查必须使用配置好的 Pages 预览环境。先经授权推送 CMS 分支，确认 Preview 构建成功，再从稳定分支预览域名进入 `/admin/`。

## 6. 预览验收清单（完成后才合并 main）

- 用 `GOLDLAOGE` 登录成功；退出后 API 返回 401。其他账号返回 403。
- 新建测试文章，填写正文、分类、标签、SEO 标题、描述、关键词。
- 上传 JPG 和 PNG，检查返回路径为 `/media/posts/年/月/随机值.webp`；R2 中 MIME 为 `image/webp`，正文显示图片。
- 检查最长边不超过 2560px，WebP 文件可打开；GIF、SVG 和超过 15 MB 的原图被拒绝。
- 发布后确认 GitHub **预览分支**出现提交；新预览构建成功后检查文章 `<title>`、description、keywords、canonical 和图片 alt。
- 修改网站标题、描述、头像及一项主题配置；确认只更新两个配置文件，前台生效。
- 两个窗口同时编辑同一篇文章：后保存的旧版本应返回 409，并保留本地输入，不覆盖新版本。
- 普通首页、文章、CSS/JS 不调用 Functions；只有 `/api/*` 和 `/media/*` 在 `_routes.json` 中。

发布按钮提示“已提交”仅代表 GitHub 提交成功，不等于 Cloudflare 构建成功。构建失败时查看 Pages 部署日志，不要重复创建文章。图片上传成功后即永久保存；未发布文章使用的图片不会自动删除，可在 R2 仪表盘手动清理确认无引用的文件。

## 7. 正式上线

预览全部通过后，经确认合并到 main 并推送，等待 Production 构建成功。用正式域名登录并重复发布、图片和设置的关键验收。首次在后台将网站 URL 改成正式网址（当前 Hexo 配置可能仍是 example.com），以便生成正确 canonical 链接。

## 免费额度与限制

浏览器转换 WebP 不调用付费 Images 服务。但 R2、KV、Pages Functions 各有额度，超额不是无限免费。R2 标准存储免费包含 10 GB/月、100 万次 A 类操作、1000 万次 B 类操作，出站流量免费；具体以 [R2 价格](https://developers.cloudflare.com/r2/pricing/) 为准。

免费 Functions 与 Workers 合计每日 10 万请求，媒体访问即使命中缓存也可能计入函数请求。只在 API 和媒体路径启用 Functions，普通静态文章不占此额度。查看 [Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)；开启 R2 时如要求支付方式，不能把绑定支付方式理解成绝不会产生费用。

登录会话持续 8 小时。KV 存在传播延迟，极少数情况下登录/退出后状态不立即一致；可等待后重试。后台不提供草稿、定时发布、删除文章、多用户管理或任意 YAML 编辑。
