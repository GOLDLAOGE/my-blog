# Personal Blog CMS Design

## Purpose

Add a personal-only CMS to the existing Hexo and AnZhiYu blog without a VPS. The owner publishes posts and changes common site and theme settings in a browser. Publishing writes source files to GitHub, where the existing Cloudflare Pages build publishes the site.

## Constraints and success criteria

- Only GitHub user `GOLDLAOGE` can use the admin API.
- No drafts or scheduled publishing in the first version. Publishing writes directly to `main`.
- Uploaded JPG, PNG, and WebP images are converted in the browser to WebP, saved in Cloudflare R2, and inserted into article Markdown.
- The CMS manages the selected, high-value AnZhiYu settings rather than every theme configuration key.
- No secret, access token, or R2 credential is committed to Git.

## Architecture

The existing Cloudflare Pages project remains the host. Pages Functions provide the server-side API and operate only on `/api/*` and `/media/*`; the ordinary Hexo output remains static.

```text
/admin/            static CMS application
/api/auth/*        GitHub OAuth start and callback
/api/content/*     posts and configuration through GitHub Contents API
/api/media/*       authenticated WebP uploads to R2
/media/*           cached public reads from R2
GitHub main        source of truth for posts and configuration
Cloudflare R2      WebP media objects
Cloudflare KV      expiring login sessions
```

### Authentication and authorization

1. `/api/auth/login` starts GitHub OAuth.
2. `/api/auth/callback` exchanges the code, checks that the authenticated GitHub login equals `GOLDLAOGE`, and creates an expiring server-side session in KV.
3. The browser holds only a secure, HttpOnly, SameSite cookie containing the opaque session id.
4. Every content and upload endpoint requires that session.

GitHub OAuth identifies the owner only. A separate GitHub fine-grained token, stored as a Cloudflare Pages secret and limited to the `GOLDLAOGE/my-blog` repository Contents permission, performs repository reads and commits. The OAuth access token is not kept in the browser or used to write the repository.

## CMS capabilities

### Posts

- List, create, and edit Markdown posts in `source/_posts/`.
- Fields: title, Markdown body, date, categories, tags, excerpt, cover image, SEO title, SEO description, and SEO keywords.
- Publish validates required fields, creates/updates the Markdown front matter and body, and commits directly to `main`.
- The initial release excludes deletion, drafts, and scheduling.

### Global SEO and site details

The CMS updates the corresponding root `_config.yml` fields: title, subtitle, description, keywords, author, language, and canonical site URL.

### Common AnZhiYu controls

The CMS updates selected fields in `_config.anzhiyu.yml`:

- favicon and avatar;
- menu and navigation links;
- social links;
- home subtitle and typewriter behavior;
- home banner and default post cover;
- footer copyright start year, custom text, and runtime;
- 404 message and background.

Music, albums, comments, friend links, advanced theme toggles, and arbitrary raw YAML editing are outside the first release.

## Media pipeline

1. The browser accepts JPG, PNG, and WebP only.
2. It resizes images proportionally to a maximum long edge of 2560 pixels and encodes WebP at roughly 82% quality.
3. The authenticated API writes the WebP object to `posts/YYYY/MM/<random>.webp` in R2.
4. The CMS inserts a same-origin `/media/posts/YYYY/MM/<random>.webp` URL into Markdown.
5. The public media Function reads the R2 object and returns cacheable responses.

This avoids Cloudflare Images paid storage. R2's included free tier is appropriate for the expected small personal-blog media volume, while still allowing overage billing if limits are exceeded.

## Required Cloudflare and GitHub configuration

- R2 bucket: `my-blog-media` bound to Pages Functions as `MEDIA_BUCKET`.
- KV namespace bound as `CMS_SESSIONS`.
- Pages secrets: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_REPO_TOKEN`, and `CMS_SESSION_SECRET`.
- GitHub OAuth App callback URL: `https://my-blog-4w1.pages.dev/api/auth/callback`.
- GitHub fine-grained token scoped only to `GOLDLAOGE/my-blog` Contents read/write.

## Failure handling and validation

- Reject unauthenticated or non-owner requests, unsupported media, oversized source images, malformed post data, R2 failures, and GitHub API failures with user-visible messages.
- Do not write a Git commit if validation fails.
- Verify with unit tests for front matter/config transformations and session guards; run `npm run build`; then perform manual preview checks for login, WebP upload, post publication, generated SEO metadata, and R2-delivered images.

## Non-goals

- Multi-user editorial workflows, roles, comments, analytics dashboards, post deletion, scheduling, and migration away from Pages.
