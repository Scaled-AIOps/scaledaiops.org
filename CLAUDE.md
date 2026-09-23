# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static HTML site for **scaledaiops.org** — the canonical reference for the ScaledAIOps framework (a community AI-Operations framework in the spirit of SAFe). Hosted on S3 + CloudFront; infra lives in the sibling `aiops-tf-infra` repo (Terraform, AWS profile `scaledaiops`). No JS framework, no bundler — `build.sh` is the whole toolchain.

## Commands

```bash
./build.sh                                   # assemble _layout + _content → dist/ (wipes dist/ first)
FFRS_ENABLED=false ./build.sh                # build without the feedback widget (default on since 2026-08-18)
aws s3 sync dist/ s3://scaledaiops.org --profile scaledaiops
aws cloudfront create-invalidation --distribution-id EJE5SGJ73Q1SL --paths "/*" --profile scaledaiops

npx playwright test                          # all E2E tests (production)
npm run test:local                           # build + serve dist/ on :8765 + all tests with FFRS_ENABLED=true (skips 404 + SSL tests, which need CloudFront)
npx playwright test tests/homepage.spec.js   # one file
npx playwright test -g "404 page"            # one test by title
FFRS_ENABLED=true npx playwright test tests/feedback.spec.js   # widget E2E (spec runs only when this env is set)
npx playwright install chromium              # first-time browser install
```

**Tests run against production** (`baseURL: https://www.scaledaiops.org`, see `playwright.config.js`) — there is no local dev server. Deploy + invalidate before expecting test changes to pass; the tests are the post-deploy smoke check.

## How a page is built

`build.sh` walks every `_content/**/*.html`, strips its three metadata comments, and writes `dist/<same path>` as `head.html` + `header.html` + body + `footer.html`.

- **Metadata** (must be at top of the content file, exact format, one per line):
  `<!-- title: … -->`, `<!-- description: … -->`, `<!-- active: disciplines|principles|roles|about|none -->`
- `{{TITLE}}` / `{{DESCRIPTION}}` are substituted in `head.html`; `{{ACTIVE_<nav>}}` in `header.html` becomes ` class="active"` for the matching nav item and is removed for the rest. Substitution is `sed` with `|` as delimiter — **don't use `|` in title/description**.
- `_layout/footer.html` holds the mobile nav toggle and the site-wide scroll-entrance animation (`.fade-in-up`); `assets/` is copied verbatim to `dist/assets/`. The stylesheet URL carries `?v=<hash of assets/css>` (`{{ASSET_V}}` in `head.html`) so browsers never serve stale CSS after a deploy.
- **FFRS feedback widget:** served by the shared FFRS service at `ffrs.scaledaiops.org` (this site is tenant `scaledaiops`); no widget code lives in this repo. `{{FFRS_WIDGET}}` in `footer.html` becomes one `<script src="https://ffrs.scaledaiops.org/widget.js" …>` tag unless `FFRS_ENABLED=false`, which also drops `_content/feedback/` (the no-JS form + status page, posting to the service's `/api/feedback`). The widget renders in an open shadow root; `tests/feedback.spec.js` stubs the API and Turnstile, so it never files real feedback. API: sibling `ffrs-api` repo. Plan: `docs/ffrs-plan.md`.
- Clean URLs: every page is `folder/index.html`; a CloudFront Function rewrites `/about/` → `/about/index.html`. Link with trailing slashes (`/disciplines/strategy/`), never `.html`.

**Adding a page:** create `_content/<section>/<slug>/index.html` with the metadata block, link it from the relevant hub page (`_content/<section>/index.html`), and add it to the URL list in `tests/navigation.spec.js` (the 404 sweep checks every linked page). Rebuild + deploy.

## Layout

- `_layout/` — head, header, footer partials (edit here for site-wide changes)
- `_content/` — one fragment per page: `index.html`, `404.html`, `about/`, `disciplines/`, `principles/`, `roles/`, `blog/` (hub + one folder per post), `feedback/`
- `assets/css/style.css` — the single global stylesheet
- `tests/` — Playwright specs: homepage, navigation (incl. 404 sweep of all pages), responsive, ssl-redirects, feedback
- `docs/` — FFRS plan and case study
- `dist/`, `scratch/`, `test-results/` — gitignored

## Conventions

- Six disciplines are canonical and asserted by tests (`tests/homepage.spec.js`); changing their names/order/hrefs requires updating the tests in the same commit.
- Site-wide changes go in `_layout/` or `style.css`, never duplicated per page.
- Content is CC BY-SA 4.0 (footer); keep the license notice.
- `main` is protected by a ruleset: changes land via pull request, squash-merge only. Direct pushes to `main` get reverted.
- Visitor feedback becomes issues in `Scaled-AIOps/feedback`; an hourly hosted agent answers each item with a PR on branch `ffrs/<ref>` (e.g. `ffrs/fb-cfqwf2`) or a proposal comment. Merging a PR whose body says `Resolves Scaled-AIOps/feedback#<n>` closes the item and emails the requester.
- Committed text (content, docs, commits, PRs) stays impersonal and vendor-neutral: no AI-tool or vendor names, no `Co-Authored-By` trailers.
