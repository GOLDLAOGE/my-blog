# XIAX.CAFE Audit Remediation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. The user approved the audit recommendations and production release; this plan records that approved scope, not a new design proposal.

**Goal:** Repair the verified audit findings without redesigning or changing published content, then release and verify production.
**Architecture:** Keep Hexo, the Anzhiyu theme, Pages Functions, and the existing Git-driven Pages deployment. Make narrow template, client script and generated metadata changes. Redirect only the old production hostname through Cloudflare's supported account redirect flow; preserve API/OAuth paths and preview hosts.
**Tech Stack:** Hexo 8, Pug, Stylus, browser JavaScript, Vitest, Cloudflare Pages.
**Spec:** `/Users/tao/Documents/Codex/2026-09-26/https-eo-blog-cmliussss-com-p/artifacts/xiax-cafe-audit-2026-09-28.md` and user approval “按你的建议修改上线吧”.

## Global Constraints

- Preserve coffee/cream/green branding, v9 assets, existing text and all posts.
- Do not expose secrets, publish test posts, alter authorization, or redirect preview hosts.
- No new UI features, migration, site-wide CSP enforcement or CMS origin split.
- Work in the existing clean checkout; root owns Git integration and production push. Implementers do not commit/push or run concurrent full builds.
- Write targeted behavioral regression tests first, observe failure, implement minimally, rerun.

## Review Focus

- Five articles with different covers must never share cached per-article metadata; special characters must remain correctly encoded.
- Hidden menus must not leave keyboard focus stranded; Escape and resize must close consistently.
- Small screens must not initialize hidden weather/music, but legitimate article audio must continue to work.
- Sitemap must omit admin/API/404/unpublished pages, retain public pages, and XML-escape URLs.
- Old-domain rules must preserve path/query, avoid loops, leave preview and OAuth/API requests untouched.

## Task 1: Share and SEO metadata

**Files:** post-copyright.pug, ptool.pug, third-party/share/share-js.pug, head/Open_Graph.pug, _config.anzhiyu.yml verification fields, scripts/ sitemap generator, source/robots.txt, test/share-seo.test.js (and narrowly affected tests).
**Interfaces:** Existing Hexo page/config/helper values; emits per-article absolute share URLs, matching canonical/og:url, sitemap.xml and robots.txt.

- [ ] Add failing behavioral Pug/Hexo tests for different article covers, encoded titles, canonical URL, sitemap exclusions and XML escaping.
- [ ] Fix cached share fragment and absolute share-image URLs. Normalize og:url with existing canonical helper.
- [ ] Add a minimal sitemap generator using existing Hexo routes/locals, or a maintained official generator if clearly simpler. Keep public taxonomy/archive routes when feasible. No unpublished/admin/API/error routes.
- [ ] Publish robots.txt sitemap declaration; clear only known placeholder verification values, preserve real codes and other settings.
- [ ] Run targeted tests and report RED/GREEN results and changed files.

## Task 2: Accessible interactions and motion

**Files:** header/nav.pug, anzhiyu/console.pug, sidebar.pug, source/js/main.js, source/js/utils.js, relevant nav/sidebar/brand Stylus, source/admin/style.css if needed, test/frontend-accessibility.test.js.
**Interfaces:** Preserve existing click behavior, classes, selectors and theme tokens. Add native button semantics/accessible names, menu ARIA state and focus management without visual redesign.

- [ ] Add failing tests exercising actual menu state transitions, Escape, focus return, desktop controls and repeated initialization.
- [ ] Fix desktop console controls and mobile toggle; Esc closes mobile menu, focus enters/returns, hidden menus are not keyboard-reachable, resize resets state.
- [ ] Respect prefers-reduced-motion for the affected scripted and CSS transitions, avoiding a universal zero-duration override.
- [ ] Increase the audited small mobile targets toward 44px without breaking header layout.
- [ ] Run targeted tests and report RED/GREEN results. Do not edit additional-js.pug, clock.pug, aplayer.pug, layout.pug or music.pug (Task 3 owns those).

## Task 3: Avoid hidden plugin loading

**Files:** anzhiyu/clock.pug, third-party/aplayer.pug, additional-js.pug, layout.pug, music.pug only if necessary; a small dedicated client helper if necessary; test/optional-widgets.test.js.
**Interfaces:** Weather is hidden at <=1400px; nav music at <=1200px. Existing article page.aplayer and desktop functionality must remain supported.

- [ ] Add failing behavioral tests verifying no hidden plugin requests/initialization at narrow widths; eligible desktop and article-audio paths load once, including navigation/resize.
- [ ] Defer weather CSS/JS and nav-only APlayer/Meting load until their UI is eligible. Preserve article-audio loading; handle absent player safely.
- [ ] Run targeted tests and report RED/GREEN results. Do not edit main.js/utils.js/nav.pug or global config; coordinate any interface needs with root.

## Task 4: Integration, old-domain compatibility and release

**Files:** Root-owned release evidence in task artifacts; cloud account redirect rule if supported safely. No full-site Function middleware or architecture change for redirects.

- [ ] Review each task for spec and quality; fix material findings. Run whole-branch review.
- [ ] Run current full suite excluding only stale .worktrees; build and inspect generated files, then browser-check desktop/mobile and keyboard paths.
- [ ] Configure only the exact old production hostname redirect, preserving path/query and excluding API/OAuth/media where necessary. If the supported UI cannot safely express exclusions, report that item rather than broaden routing or break login.
- [ ] Commit scoped changes; compare remote main and push without force via existing HTTPS credentials. Verify Cloudflare production deployment success.
- [ ] Check new metadata, sitemap, homepage/article/media, www/old/preview behavior and admin. No publication/deletion test. Save screenshots and release result.

## Execution evidence (2026-09-28)

- Tasks 1–3 implemented and independently reviewed; material findings repaired.
- Current-source suite: 31 test files, 176 tests passed; clean build: 198 generated files; diff check passed.
- Real Chrome verification passed: 390px menu focus entry, Escape/focus return, no hidden optional plugin assets on fresh mobile load; 1440px console keyboard entry and Escape/focus return. Earlier 320px overflow and PJAX checks also passed.
- Exact old-host Cloudflare redirect enabled and HTTP-verified; API/admin/media and preview URLs remain excluded.
- Release commit, deployment identity and production evidence are recorded in the task artifact `artifacts/xiax-cafe-release-2026-09-28.md`.

## Preflight

| Pair/task | Contract check |
| --- | --- |
| 1 / 2 | Disjoint source files; share UI retains theme classes |
| 1 / 3 | Disjoint source files; share does not depend on audio |
| 2 / 3 | Both affect front-end lifecycle; main.js/nav are Task 2 only, plugin templates Task 3 only; root integration checks global assumptions |
| 1 | Tests cover actual rendered metadata and sitemap output |
| 2 | Tests cover behavior rather than source string matching; source changes preserve visual identity |
| 3 | CSS breakpoints are the loading gates, article audio is explicit exception |
| 4 | Exact old production host only; preserve security and preview boundaries |
