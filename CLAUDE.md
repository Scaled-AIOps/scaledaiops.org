# CLAUDE.md — ScaledAIOps

Context for AI-assisted work on this repository. Read this before making changes.

## What this project is

ScaledAIOps (scaledaiops.org) is an open, community-maintained, governance-first
framework for **how organisations work with AI** — adopting AI tools (coding
assistants, agents, copilots) across the SDLC, CI/CD, DevOps, and knowledge
work, safely, measurably, and at scale. It restructures the practices teams
already run rather than adding a parallel "AI process", from business concept
to production and retirement. Design of record: `docs/repositioning-spec.md`.

**Positioning (since Sep 2026):** the framework is about *using* AI, not
*building* AI systems. Legacy MLOps/model-building content lives on a single
archived legacy page and must not reappear in main navigation or new content.

**Migration status:** in progress. Until the repositioning lands, the
discipline, principle and role pages still carry the pre-pivot MLOps content,
and `tests/homepage.spec.js` + `tests/navigation.spec.js` assert those six
disciplines — replace pages and their tests in the same PR.

**Analogy we use:** what SAFe did for agile at enterprise scale, ScaledAIOps
does for AI adoption. Built by practitioners from regulated industries —
rigorous enough for a bank, practical enough for a startup.

**Licence:** CC BY-SA 4.0. **Trust signal:** "no vendor lock-in" (never write
"no certification" — that door stays open).

## Framework structure (three layers)

### Six disciplines
1. **AI-Augmented Delivery** — SDLC/DevOps with AI in every phase, cradle to
   grave. Reference loop: Conceive → Plan → Specify → Generate → Verify →
   Release → Operate → Learn → Retire. Every element (business case, spec,
   code, pipeline, prompt, agent, credential…) has an owner, a risk tier,
   provenance and a deliberate retirement.
2. **Human–AI Workflow Design** — delegation model; risk-tiered approval gates
   (auto-approve / human-review / human-only); handoff and escalation paths.
3. **Tooling & Context Engineering** — tool selection and integration (incl.
   MCP); prompts, skills, and context managed as versioned, reviewed assets.
4. **Governance & Guardrails** — the four pillars (see below), applied to AI
   usage.
5. **Skills & Roles** — competency shift, redefined roles, team topology,
   enablement.
6. **Value & Measurement** — cycle time, rework rate, defect escape rate,
   review burden, cost/ROI. Never vanity metrics ("lines generated").

### Four control pillars (cross-cutting backbone)
Assess → Prevent → Prove → Detect
1. **Self-Assessment** — AI Adoption Maturity Model: 6 dimensions (one per
   discipline) × 5 levels (Ad hoc → Experimenting → Managed → Governed →
   Optimised).
2. **Guardrails** — preventive controls: what AI may access/do/decide;
   input/output controls; action limits; kill switches.
3. **Audit Trail** — provenance of AI-generated work: what generated it, from
   which context, who approved it.
4. **Self-Monitoring** — detective controls: quality of AI-assisted output
   over time, usage drift, incident detection and escalation.

Every discipline page states which pillar controls apply, tiered by risk
(low / medium / high / critical). Proportionality follows the EU AI Act's
risk-based approach, but the tiers don't map one-to-one: the Act classifies AI
systems by use (prohibited / high / limited / minimal); ours classify work.

### Eight principles
1. Human accountability, always
2. Delegate by risk, not by convenience
3. Provenance by default
4. Verify before trust
5. Context is an asset
6. Measure real value
7. Adopt incrementally
8. Governed openness

### Eight roles
Engineering Orchestrator · Eval Engineer · Context Engineer · AI Workflow
Designer · AI Adoption Lead · AI Governance Officer · AI Platform Engineer ·
Value Analyst

## Voice and content rules

- Practitioner tone: concrete, control-oriented, vendor-neutral. No
  productivity hype ("10x"), no vendor endorsements, no model-building content.
- Audience: engineering leaders, CROs/second-line risk, platform teams in
  enterprises — especially regulated industries.
- When citing regulation, anchor to EU AI Act obligations (e.g. AI literacy,
  Art. 4; deployer duties, Art. 26) and ISO/IEC 42001; keep mappings
  tool-agnostic.
- British/international English ("organisation").
- The site practises its own framework: changes are Git-tracked, AI-assisted
  edits get human review before merge, and commit messages note AI involvement
  with a vendor-neutral `AI-assisted: yes` trailer — never a `Co-Authored-By`
  trailer or a tool/vendor name (provenance by default).
- Committed text stays impersonal: no session anecdotes, no personal names or
  addresses, no other projects named.

## Working conventions for AI sessions

- The current change spec, when one exists, lives in `docs/` (e.g.
  `docs/repositioning-spec.md`). Read it before structural changes.
- Work incrementally: one logical section per PR (`main` is squash-merge
  only); show diffs for homepage/navigation changes before applying further
  edits.
- Never delete legacy ML content — move it to the legacy page.
- Ask before adding dependencies, changing site structure/navigation, or
  altering the licence footer.

## Stack and workflow

Static HTML, no framework or bundler — `build.sh` is the whole toolchain.
Hosted on S3 + CloudFront; infra in the sibling `aiops-tf-infra` repo
(Terraform, AWS profile `scaledaiops`).

```bash
./build.sh                                   # assemble _layout + _content → dist/ (wipes dist/ first)
FFRS_ENABLED=false ./build.sh                # build without the feedback widget
aws s3 sync dist/ s3://scaledaiops.org --profile scaledaiops
aws cloudfront create-invalidation --distribution-id EJE5SGJ73Q1SL --paths "/*" --profile scaledaiops

npx playwright test                          # all E2E tests, against production
npm run test:local                           # build + serve dist/ on :8765 + tests with FFRS_ENABLED=true (skips 404 + SSL tests)
npx playwright test tests/homepage.spec.js   # one file
npx playwright test -g "404 page"            # one test by title
npx playwright install chromium              # first-time browser install
```

Default tests run against production (`baseURL` in `playwright.config.js`):
deploy + invalidate first; they are the post-deploy smoke check. Preview
locally with `npm run test:local` or `python3 -m http.server 8765 -d dist`.

**How a page is built:** `build.sh` wraps every `_content/**/*.html` in
`_layout/` `head.html` + `header.html` + … + `footer.html` and writes it to
`dist/<same path>`.
- Each content file starts with three metadata comments, one per line:
  `<!-- title: … -->`, `<!-- description: … -->`,
  `<!-- active: disciplines|principles|roles|about|none -->`. They are
  substituted with `sed` using `|` as delimiter — never put `|` in them.
- The stylesheet URL carries `?v=<hash of assets/css>` (`{{ASSET_V}}`) so
  deploys never serve stale CSS. `assets/` is copied verbatim.
- Clean URLs: every page is `<folder>/index.html`; a CloudFront Function
  rewrites `/about/` → `/about/index.html`. Link with trailing slashes, never
  `.html`.
- Site-wide changes go in `_layout/` or `assets/css/style.css`, never per page.

**Adding a page:** create `_content/<section>/<slug>/index.html` with the
metadata block, link it from the section hub (`_content/<section>/index.html`),
and add it to the URL list in `tests/navigation.spec.js` (the 404 sweep).

**FFRS add-on (feedback):** FFRS is a separate concept, not part of the
ScaledAIOps framework — never present it as a discipline, pillar, principle
or framework example. The site only embeds it: the widget is one `<script>` from the shared service
`ffrs.scaledaiops.org` (tenant `scaledaiops`), injected at `{{FFRS_WIDGET}}` in
`footer.html`; no widget code lives here. `FFRS_ENABLED=false` removes it and
`_content/feedback/`. `tests/feedback.spec.js` stubs the API and bot check.
Items land as issues in `Scaled-AIOps/feedback`; an hourly agent answers each
with a PR on `ffrs/<ref>` or a proposal comment, and merging a PR that says
`Resolves Scaled-AIOps/feedback#<n>` closes the item and emails the requester.
API: sibling `ffrs-api` repo. Plan: `docs/ffrs-plan.md`.

**Git:** `main` is protected — changes land by squash-merged pull request;
direct pushes get reverted.
