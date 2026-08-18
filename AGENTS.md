# AGENTS.md

Guidance for coding agents and contributors working in this repository.

## What this is

Static HTML site for **scaledaiops.org** — the canonical reference for the ScaledAIOps framework (a community AI-Operations framework in the spirit of SAFe). Hosted on S3 + CloudFront; infra lives in the sibling `aiops-tf-infra` repo (Terraform, AWS profile `scaledaiops`). No JS framework, no bundler — `build.sh` is the whole toolchain.

## Commands

```bash
./build.sh                                   # assemble _layout + _content → dist/ (wipes dist/ first)
FFRS_ENABLED=false ./build.sh                # build without the feedback widget (default on since 2026-08-18)
aws s3 sync dist/ s3://scaledaiops.org --profile scaledaiops
aws cloudfront create-invalidation --distribution-id EJE5SGJ73Q1SL --paths "/*" --profile scaledaiops

npx playwright test                          # all E2E tests (production)
npm run test:local                           # build + serve dist/ on :8765 + all tests locally (skips the CloudFront 404 test)
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
- The mobile nav toggle script lives in `_layout/footer.html`; `assets/` is copied verbatim to `dist/assets/`.
- **FFRS feature toggle:** `{{FFRS_WIDGET}}` in `footer.html` becomes the widget `<link>`+`<script>` unless `FFRS_ENABLED=false` (default true, Turnstile site key baked in); when off `build.sh` also drops `assets/js/ffrs-widget.js`, `assets/css/ffrs-widget.css`, `assets/js/vendor/` and `_content/feedback/` from `dist/`. FFRS files live only in those paths (+ `tests/feedback.spec.js`); the API is the sibling `ffrs-api` repo. Plan: `docs/ffrs-plan.md`.
- Clean URLs: every page is `folder/index.html`; a CloudFront Function rewrites `/about/` → `/about/index.html`. Link with trailing slashes (`/disciplines/strategy/`), never `.html`.

**Adding a page:** create `_content/<section>/<slug>/index.html` with the metadata block, link it from the relevant hub page (`_content/<section>/index.html`), and add it to the URL list in `tests/navigation.spec.js` (the 404 sweep checks every linked page). Rebuild + deploy.

## Layout

- `_layout/` — head, header, footer partials (edit here for site-wide changes)
- `_content/` — one fragment per page: `index.html`, `404.html`, `about/`, `disciplines/`, `principles/`, `roles/`
- `assets/css/style.css` — the single global stylesheet
- `tests/` — Playwright specs: homepage, navigation (incl. 404 sweep of all pages), responsive, ssl-redirects
- `dist/` — gitignored build output

## Conventions

- Six disciplines are canonical and asserted by tests (`tests/homepage.spec.js`); changing their names/order/hrefs requires updating the tests in the same commit.
- Site-wide changes go in `_layout/` or `style.css`, never duplicated per page.
- Content is CC BY-SA 4.0 (footer); keep the license notice.
