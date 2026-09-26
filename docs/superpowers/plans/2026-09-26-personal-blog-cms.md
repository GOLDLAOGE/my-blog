# Personal Blog CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal-only, no-VPS CMS to the existing Hexo + AnZhiYu blog for publishing SEO-ready posts, updating selected site/theme settings, and storing browser-converted WebP media in R2.

**Architecture:** Static files under `source/admin/` provide the CMS interface. Route-scoped Cloudflare Pages Functions authenticate `GOLDLAOGE`, use a narrowly-scoped GitHub token to read/write source files on `main`, store sessions in KV, and serve R2 media through `/media/*`. Hexo remains responsible only for static generation after GitHub commits.

**Tech Stack:** Hexo 8, plain browser JavaScript and CSS, Cloudflare Pages Functions, Workers KV, R2, GitHub OAuth App and Contents API, `yaml`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-personal-blog-cms-design.md`

## Global Constraints

- Preserve the existing Cloudflare Pages deployment and Hexo build command: `npm run build`.
- Only GitHub login `GOLDLAOGE` may create CMS sessions or call protected APIs.
- Publish directly to `main`; do not implement drafts, scheduling, deletion, roles, or multi-user workflows.
- Browser uploads accept JPG, PNG, and WebP only; resize to a 2560px maximum long edge and encode WebP at 0.82 quality.
- Reject source uploads larger than 15 MB before the R2 write.
- R2 media keys use `posts/YYYY/MM/<random>.webp` and are inserted as same-origin `/media/...` URLs.
- Secrets and tokens are Pages Secrets, never Git files or browser storage.
- Function invocation routes must be restricted to `/api/*` and `/media/*`; ordinary Hexo pages remain static.

## Review Focus

- An OAuth callback whose GitHub login is not `GOLDLAOGE` must clear any partial state and return 403; test in Task 2.
- A tampered, expired, or KV-missing session cookie must not access posts, settings, or uploads; test in Task 2 and Task 4.
- YAML serialization must preserve arrays and valid quoted content in post front matter and settings; test in Task 3.
- A media key containing traversal characters, an unsupported MIME type, or an image over the configured source limit must be rejected; test in Task 5.
- A Functions route must not cause ordinary Hexo assets to invoke a Function; test the generated `public/_routes.json` in Task 1 and verify in Task 7.

---

## File Structure

- `source/_routes.json`: copied into `public/` by Hexo; scopes Function invocations.
- `functions/_lib/*.js`: shared response, environment, session, GitHub, post, and settings helpers.
- `functions/api/auth/*.js`: OAuth lifecycle.
- `functions/api/posts/*.js`: protected post list/read/publish API.
- `functions/api/settings.js`: protected global and selected-theme setting API.
- `functions/api/media.js`: protected R2 upload API.
- `functions/media/[[key]].js`: public cached R2 delivery route.
- `source/admin/index.html`, `source/admin/app.js`, `source/admin/style.css`: static personal CMS application.
- `test/*.test.js`: isolated helper/function contract tests.
- `docs/cms-setup.md`: exact one-time GitHub and Cloudflare dashboard configuration steps.

### Task 1: Establish Pages Function boundaries and test tooling

**Files:**
- Create: `source/_routes.json`
- Create: `functions/_lib/http.js`
- Create: `functions/_lib/env.js`
- Create: `test/http.test.js`
- Create: `test/routes.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `json(data, init?)`, `badRequest(message)`, `unauthorized()`, `forbidden()`, and `serverError(message)` from `functions/_lib/http.js`.
- Produces `requireEnv(env, keys)` from `functions/_lib/env.js`; it throws a named configuration error for missing bindings or secrets.
- Later API tasks consume those helpers.

- [ ] **Step 1: Add failing unit tests for JSON error responses, required environment variables, and generated routes**

Test that `source/_routes.json` contains only `"/api/*"` and `"/media/*"`, `json()` returns `application/json`, and missing secrets fail with the missing key name.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test`

Expected: FAIL because the test script and helper modules do not yet exist.

- [ ] **Step 3: Install `vitest` as a development dependency and `yaml` as a runtime dependency; add `test: vitest run` to `package.json`**

Keep existing Hexo dependencies and scripts unchanged.

- [ ] **Step 4: Implement the route manifest and shared helpers**

`source/_routes.json` must use version 1, include `/api/*` and `/media/*`, and exclude all other static paths by omission. `requireEnv()` must require `MEDIA_BUCKET`, `CMS_SESSIONS`, and each route's required secret explicitly.

- [ ] **Step 5: Run helper tests and the Hexo build**

Run: `npm test && npm run build`

Expected: all tests pass and `public/_routes.json` exists with only the two Function route patterns.

- [ ] **Step 6: Commit the route and test foundation**

```bash
git add source/_routes.json functions/_lib package.json package-lock.json test
git commit -m "feat: add CMS function foundation"
```

### Task 2: Implement owner-only GitHub OAuth sessions

**Files:**
- Create: `functions/_lib/session.js`
- Create: `functions/_lib/github-oauth.js`
- Create: `functions/api/auth/login.js`
- Create: `functions/api/auth/callback.js`
- Create: `functions/api/auth/logout.js`
- Create: `functions/api/session.js`
- Create: `test/session.test.js`
- Create: `test/github-oauth.test.js`

**Interfaces:**
- Produces `createOAuthState(env)`, `buildGitHubAuthorizeUrl(env, state)`, `exchangeCode(env, code)`, and `getGitHubLogin(token)`.
- Produces `createSession(env)`, `readSession(request, env)`, `destroySession(request, env)`, and `requireOwner(request, env)`.
- `requireOwner()` returns `{ login: "GOLDLAOGE" }` or a 401/403 `Response`.
- Tasks 4 and 5 consume `requireOwner()`.

- [ ] **Step 1: Write failing OAuth and session tests**

Cover authorize URL state, callback login matching `GOLDLAOGE`, a rejected non-owner login, an expired KV session, and a tampered/missing cookie.

- [ ] **Step 2: Run the OAuth/session tests to verify they fail**

Run: `npm test -- test/session.test.js test/github-oauth.test.js`

Expected: FAIL because auth modules and routes do not exist.

- [ ] **Step 3: Implement OAuth state validation and KV-backed sessions**

Use an opaque, cryptographically random state and session id. Set cookies with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and an 8-hour expiration. Delete callback state on every terminal callback result.

- [ ] **Step 4: Implement the login, callback, logout, and current-session routes**

The callback must exchange the GitHub OAuth code server-side, compare the returned login exactly to `GOLDLAOGE`, and never return either OAuth token to the browser.

- [ ] **Step 5: Run all OAuth/session tests**

Run: `npm test -- test/session.test.js test/github-oauth.test.js`

Expected: PASS, including 403 for every non-owner identity.

- [ ] **Step 6: Commit owner-only authentication**

```bash
git add functions/_lib/session.js functions/_lib/github-oauth.js functions/api/auth functions/api/session.js test
git commit -m "feat: add owner-only CMS login"
```

### Task 3: Add GitHub content, post, and settings serialization helpers

**Files:**
- Create: `functions/_lib/github-repo.js`
- Create: `functions/_lib/posts.js`
- Create: `functions/_lib/settings.js`
- Create: `test/posts.test.js`
- Create: `test/settings.test.js`

**Interfaces:**
- Produces `githubRequest(env, path, init)`, `readRepositoryFile(env, path)`, and `writeRepositoryFile(env, { path, content, sha, message })`.
- Produces `parsePost(markdown)`, `serializePost(draft)`, and `postPath(slug)`.
- Produces `readEditableSettings(rootYaml, themeYaml)` and `writeEditableSettings(rootYaml, themeYaml, input)`.
- Tasks 4 consumes the repository, post, and settings helpers.

- [ ] **Step 1: Write failing serialization tests from representative blog files**

Test post round-trips with multi-value categories/tags and descriptions containing punctuation. Test that only the selected root and AnZhiYu fields are changed and that unexposed YAML keys remain present.

- [ ] **Step 2: Run serialization tests to verify they fail**

Run: `npm test -- test/posts.test.js test/settings.test.js`

Expected: FAIL because helper modules do not exist.

- [ ] **Step 3: Implement GitHub Contents API client with the fine-grained token**

Read `GITHUB_REPO_TOKEN` only from `env`; use repository `GOLDLAOGE/my-blog` and branch `main`. Return GitHub error messages without exposing token values.

- [ ] **Step 4: Implement post front-matter and selected-setting transforms**

Use `yaml` for front matter and config parsing. Support the exact post fields defined in the spec. Preserve uneditable `_config.yml` and `_config.anzhiyu.yml` keys when writing.

- [ ] **Step 5: Run serialization tests and build**

Run: `npm test -- test/posts.test.js test/settings.test.js && npm run build`

Expected: PASS and no change in regular Hexo output behavior.

- [ ] **Step 6: Commit repository and serialization helpers**

```bash
git add functions/_lib/github-repo.js functions/_lib/posts.js functions/_lib/settings.js test
git commit -m "feat: add CMS content serialization"
```

### Task 4: Expose protected post and settings APIs

**Files:**
- Create: `functions/api/posts/index.js`
- Create: `functions/api/posts/[slug].js`
- Create: `functions/api/settings.js`
- Create: `test/content-api.test.js`

**Interfaces:**
- `GET /api/posts` returns post summaries.
- `GET /api/posts/:slug` returns a complete editable post.
- `POST /api/posts` creates a post; `PUT /api/posts/:slug` updates one.
- `GET /api/settings` and `PUT /api/settings` expose only the fields from Task 3.
- All routes consume `requireOwner()` and Task 3 helpers.

- [ ] **Step 1: Write failing route tests with fake KV and GitHub client responses**

Test unauthenticated rejection, missing title/body validation, GitHub conflict propagation, successful post creation, and successful settings update that preserves unrelated YAML settings.

- [ ] **Step 2: Run content API tests to verify they fail**

Run: `npm test -- test/content-api.test.js`

Expected: FAIL because the API route modules do not exist.

- [ ] **Step 3: Implement post routes**

Validate title, body, SEO description, tags/categories arrays, cover URL, and a filesystem-safe slug before calling the GitHub client. Commit messages use `content: publish <title>` and `content: update <title>`.

- [ ] **Step 4: Implement settings routes**

Accept only the selected site/AnZhiYu schema. Commit a single settings update with message `settings: update site and theme`.

- [ ] **Step 5: Run route tests and build**

Run: `npm test -- test/content-api.test.js && npm run build`

Expected: PASS and generated admin/static route manifest remains present.

- [ ] **Step 6: Commit the protected content API**

```bash
git add functions/api/posts functions/api/settings.js test/content-api.test.js
git commit -m "feat: add CMS posts and settings API"
```

### Task 5: Add R2-backed WebP media upload and delivery

**Files:**
- Create: `functions/_lib/media.js`
- Create: `functions/api/media.js`
- Create: `functions/media/[[key]].js`
- Create: `test/media.test.js`

**Interfaces:**
- Produces `makeMediaKey(date, randomBytes)`, `validateUpload(file)`, and `mediaResponse(object)`.
- `POST /api/media` accepts one already-WebP binary upload and returns `{ url }`.
- `GET /media/*` returns the matching R2 object or 404.
- Admin Task 6 consumes `POST /api/media`.

- [ ] **Step 1: Write failing media tests**

Test valid WebP upload key shape, content type, cache headers, missing R2 object, traversal attempts, wrong MIME types, and a source upload exceeding the configured 15 MB server limit.

- [ ] **Step 2: Run media tests to verify they fail**

Run: `npm test -- test/media.test.js`

Expected: FAIL because media modules do not exist.

- [ ] **Step 3: Implement media validation and R2 routes**

Accept only `image/webp` after browser conversion. Write `posts/YYYY/MM/<random>.webp` with content type `image/webp`; return `Cache-Control: public, max-age=31536000, immutable` for successful reads.

- [ ] **Step 4: Run media tests and the full local suite**

Run: `npm test && npm run build`

Expected: PASS and Hexo copies the route manifest into `public/`.

- [ ] **Step 5: Commit the media pipeline**

```bash
git add functions/_lib/media.js functions/api/media.js functions/media test/media.test.js
git commit -m "feat: add CMS R2 media pipeline"
```

### Task 6: Build the static personal admin interface

**Files:**
- Create: `source/admin/index.html`
- Create: `source/admin/style.css`
- Create: `source/admin/app.js`
- Create: `source/admin/editor.js`
- Create: `source/admin/settings.js`
- Create: `test/admin-schema.test.js`

**Interfaces:**
- `app.js` uses `/api/session`, `/api/auth/login`, `/api/auth/logout`, `/api/posts`, and `/api/settings`.
- `editor.js` exposes `convertImageToWebp(file): Promise<File>` and `insertMarkdownImage(editor, url, alt)`.
- `settings.js` maps only the approved site/theme field schema to the settings API.

- [ ] **Step 1: Write failing schema tests for browser-side validation and WebP settings**

Test the allowed input MIME list, 2560px maximum edge, 0.82 output quality setting, required post fields, and the selected settings field names.

- [ ] **Step 2: Run admin tests to verify they fail**

Run: `npm test -- test/admin-schema.test.js`

Expected: FAIL because admin modules do not exist.

- [ ] **Step 3: Implement the login gate, navigation, and post editor**

Provide article list, new/edit form, Markdown textarea, metadata fields, status/error messages, and a single Publish action. Do not add drafts, scheduling, deletion, or user management.

- [ ] **Step 4: Implement browser conversion and upload insertion**

Use a canvas to resize proportionally and encode `image/webp` at 0.82 quality. Send the converted blob to `/api/media`; insert the returned Markdown image URL at the editor cursor.

- [ ] **Step 5: Implement selected global/theme settings forms**

Group fields into Site SEO, identity/media, navigation/social, home/cover, and footer/404; hydrate and save through `/api/settings`.

- [ ] **Step 6: Run admin tests and build a local preview**

Run: `npm test && npm run build && npm run server`

Expected: tests pass; `/admin/` is generated and the normal blog pages remain functional.

- [ ] **Step 7: Commit the static CMS interface**

```bash
git add source/admin test/admin-schema.test.js
git commit -m "feat: add personal blog CMS interface"
```

### Task 7: Document dashboard setup and verify deployed behavior

**Files:**
- Create: `docs/cms-setup.md`
- Modify: `README.md` only if it exists and already documents local setup

**Interfaces:**
- Documents the exact bindings and secret names consumed by Tasks 1–5.
- Documents the GitHub OAuth callback URL and the restricted token requirements.

- [ ] **Step 1: Write the setup guide**

Include creating R2 bucket `my-blog-media`, KV binding `CMS_SESSIONS`, production and preview Pages bindings, Pages Secrets, the GitHub OAuth App callback URL, and a fine-grained token limited to this repository's Contents permission.

- [ ] **Step 2: Verify the guide does not contain real credentials**

Run: `rg -n 'ghp_|github_pat_|client_secret' docs/cms-setup.md`

Expected: no credential values, only variable names and dashboard instructions.

- [ ] **Step 3: Commit the setup guide**

```bash
git add docs/cms-setup.md
git commit -m "docs: add CMS deployment setup"
```

- [ ] **Step 4: Create Cloudflare resources and secrets through the dashboard with the owner**

Create the R2 bucket and KV namespace, then add production and preview bindings and secrets exactly as documented. Do not place secret values in chat, source, or terminal history.

- [ ] **Step 5: Push a preview branch and perform end-to-end validation**

Verify owner login, rejected non-owner login, JPG/PNG-to-WebP conversion, R2 delivery under `/media/*`, post publish into GitHub, Cloudflare preview build, article SEO metadata, and static blog requests outside `/api/*` and `/media/*`.

- [ ] **Step 6: Merge only after preview validation and deploy to `main`**

Run: `npm test && npm run build` before merging. Verify production login, image delivery, a published post, and theme settings after the production deployment is green.
