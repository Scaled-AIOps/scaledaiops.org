# Fast Feedback Response System (FFRS) — Implementation Plan

Status: **proposed** · Owner: ScaledAIOps maintainers · Target: scaledaiops.org · Date: 2026-08-18

## 1. Purpose

Give every visitor a one-minute way to send a bug report, feature request or general message, and give maintainers a measured, low-toil path to respond. The implementation is the reference case study for the FFRS paper, so every design choice must be (a) reusable by other small open projects and (b) instrumented so the paper can report real numbers.

## 2. FFRS model (what the paper describes, what the code implements)

FFRS treats feedback as a pipeline with four stages and one loop-closing event. Each stage transition is timestamped in the database so the metrics below fall out of a single query.

| Stage | Definition | Stored as |
|---|---|---|
| **Capture** | Visitor submits a form; the system stores it durably | `feedback.created_at` |
| **Acknowledge** | Submitter receives confirmation with a reference id | `feedback.acknowledged_at` |
| **Route** | Item lands in the team's working tool with the right label/owner | `feedback.routed_at`, `github_issue_url` |
| **Respond** | A human replies or a decision is recorded | `feedback.responded_at` |
| **Close** (loop) | Outcome communicated back to the submitter | `feedback.closed_at`, `outcome` |

**Metrics** (all P50/P90, per category, per week):
- **TTA** time-to-acknowledge — must be seconds (automated)
- **TTR** time-to-route — must be seconds (automated)
- **TTFR** time-to-first-response — the human number; target < 72 h
- **TTC** time-to-close — target < 30 d for bugs
- **Loop-closure rate** — % of items with `closed_at` and outcome sent
- **Signal ratio** — accepted / (accepted + spam + duplicate)

**Design principles** (mirror the framework's own): production-first (durable store before any side effect), automate relentlessly (ack + route are code, respond is human), measure what matters (timestamps not opinions), responsible by default (minimal PII, explicit consent, deletion path).

## 3. Architecture

```
Any page (widget injected by footer)          CloudFront (existing dist EJE5SGJ73Q1SL)
  ┌ right-edge "Feedback" tab ┐
  │ modal: Feature | Bug      │──POST /api/feedback──▶  behaviour /api/* ──▶ API Gateway HTTP API ──▶ Lambda (Node 22, TS)
  │ auto page screenshot      │                                                                          │
  │ description, email, page  │                                  ┌───────────────────────────────────────┤
  └───────────────────────────┘                                  ▼               ▼              ▼         ▼
                                                           Neon Postgres    S3 (screenshots)  SES       GitHub Issues
                                                           (source of truth)                  (ack,alert) (route + label)
```

- **Widget, not a page.** `ffrs-widget.js` is one dependency-free script (≈6 KB gz) that renders the right-edge tab and modal, exactly the pattern of `fmg`'s `FeedbackButton.tsx`: tab → capture screenshot (html2canvas lazy-loaded only on click, JPEG ≤300 KB, floating UI hidden during capture) → modal with **Request a feature / Report a bug** tabs, description, optional email + consent, page path shown read-only → `202 {ref}` → "Received · FB-7K3M2Q". A plain `/feedback/` page remains as the no-JS/accessibility fallback and as the deep link from emails.
- **Embeddable anywhere.** Configuration is data-attributes on the script tag — `<script src="/assets/js/ffrs-widget.js" data-endpoint="/api/feedback" data-site="scaledaiops.org" data-turnstile="…" defer>` — so any other project (fmg included) can adopt it with one tag. That single-tag adoption story is the reusability claim of the paper.
- **One Lambda, three routes**: `POST /api/feedback` (public), `GET /api/feedback/:ref` (public status), `POST /api/webhooks/github` (issue closed → `closed_at`, outcome, closing email).
- **Side effects after commit**: insert row (+ screenshot to S3) → return 202 → ack email, GitHub issue (screenshot embedded), alert. Failures are retried via an outbox (`side_effects` table drained by the same Lambda on a one-minute EventBridge schedule). Nothing is lost if GitHub or SES is down.
- **Same-origin API** via CloudFront `/api/*` behaviour — no CORS, no second domain. Third-party embedders get CORS enabled per `ALLOWED_ORIGINS`.
- **Neon**: serverless driver over HTTP (`@neondatabase/serverless`), one branch per environment, migrations with `drizzle-kit`. **Secrets**: SSM Parameter Store, read at cold start.

## 3a. Feature toggle — FFRS is detachable at three layers

| Layer | Switch | Effect when OFF | Where |
|---|---|---|---|
| **Site (build-time)** | `FFRS_ENABLED=false ./build.sh` (default **false** until launch) | Footer emits no widget `<script>`, no widget CSS, no `/feedback/` page; zero FFRS bytes ship. Playwright `feedback.spec.js` self-skips when the flag is off. | `build.sh`, `_layout/footer.html` (`{{FFRS_WIDGET}}` placeholder) |
| **API (runtime kill switch)** | SSM `/ffrs/enabled` = `false` (no redeploy) | `POST /api/feedback` → `503 {code:"ffrs_disabled"}`; widget reads it and hides its tab on next load. Stops capture in seconds during abuse or an incident. | Lambda config, cached 60 s |
| **Infra (provisioning)** | `enable_ffrs = false` in `aiops-tf-infra` | Terraform module `ffrs` has `count = var.enable_ffrs ? 1 : 0` — Lambda, API GW, `/api/*` behaviour, S3 screenshots bucket, SES identity, EventBridge rule all removed on `apply`. Neon and the site are untouched. | `modules/ffrs`, `variables.tf` |

Rules: no FFRS code path lives outside `ffrs-api/`, `assets/js/ffrs-widget.js`, `_content/feedback/`, `_layout` placeholder and `modules/ffrs`; removing those five locations removes FFRS completely. The homepage/CTA never depends on it.

## 4. Data model (Neon)

```sql
create type feedback_kind    as enum ('bug','feature','contact');
create type feedback_status  as enum ('new','routed','responded','closed','spam','duplicate');
create type feedback_outcome as enum ('fixed','shipped','answered','declined','wontfix','duplicate');

create table feedback (
  id               bigint generated always as identity primary key,
  ref              text unique not null,            -- short public id, e.g. FB-7K3M2Q
  kind             feedback_kind not null,
  title            text not null check (length(title) between 3 and 140),
  body             text not null check (length(body) between 10 and 5000),
  page_url         text,                            -- where the visitor was
  severity         text check (severity in ('low','medium','high','critical')),  -- bugs only
  screenshot_key   text,                            -- S3 object key, ≤300 KB JPEG, purged with email
  meta             jsonb,                           -- viewport, ua_hash, widget version — never identity
  email            text,                            -- optional; needed for ack + close
  consent          boolean not null default false,  -- may we email you?
  status           feedback_status not null default 'new',
  outcome          feedback_outcome,
  github_issue_url text,
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz,
  routed_at        timestamptz,
  responded_at     timestamptz,
  closed_at        timestamptz
);
create index on feedback (kind, status, created_at desc);

create table side_effects (            -- outbox
  id          bigint generated always as identity primary key,
  feedback_id bigint not null references feedback,
  type        text not null,           -- 'ack_email' | 'github_issue' | 'alert_email' | 'close_email'
  attempts    int not null default 0,
  next_try_at timestamptz not null default now(),
  done_at     timestamptz,
  last_error  text
);
create index on side_effects (next_try_at) where done_at is null;

create view ffrs_metrics as
select kind, date_trunc('week', created_at) wk,
  percentile_cont(0.5) within group (order by responded_at - created_at) ttfr_p50,
  percentile_cont(0.9) within group (order by responded_at - created_at) ttfr_p90,
  percentile_cont(0.5) within group (order by closed_at - created_at)   ttc_p50,
  count(*) filter (where closed_at is not null)::float / nullif(count(*),0) loop_closure,
  count(*) filter (where status not in ('spam','duplicate'))::float / nullif(count(*),0) signal_ratio
from feedback group by 1,2;
```

PII stance: `email` is the only personal field, optional, deleted (nulled) 90 days after `closed_at` by a scheduled job; the screenshot object is deleted at the same time (it may show what the visitor typed). IP addresses are used only transiently for rate limiting and never stored.

## 5. Repository layout (reusable-by-design)

```
scaledaiops.org/
├── assets/js/ffrs-widget.js          # the embeddable widget (vanilla, no build step; ships only when FFRS_ENABLED)
├── assets/css/ffrs-widget.css        # tab + modal styles, scoped under .ffrs-*
├── _content/feedback/index.html      # no-JS fallback form + deep-link target from emails
├── _layout/footer.html               # {{FFRS_WIDGET}} placeholder → script tag or nothing
└── tests/feedback.spec.js            # E2E: tab visible, modal opens, submit → ref; skips when flag off

ffrs-api/                             # NEW repo — the reusable core; other projects can adopt it as-is
├── src/
│   ├── handler.ts                    # Lambda entry: router only
│   ├── schema.ts                     # Zod schemas: FeedbackInput, GitHubWebhook, config env
│   ├── db/{client,schema,migrate}.ts # drizzle + neon serverless
│   ├── domain/feedback.ts            # create / transition / metrics — pure functions over a repo interface
│   ├── effects/{ackEmail,githubIssue,alertEmail,closeEmail}.ts   # each: (feedback) => Promise<void>
│   ├── outbox.ts                     # enqueue + drain with backoff
│   ├── guards/{turnstile,honeypot,rateLimit}.ts
│   └── ref.ts                        # FB-XXXXXX generator (crockford base32, no vowels)
├── test/                             # vitest: domain + guards unit tests, handler contract tests
├── drizzle/                          # migrations
└── package.json                      # esbuild bundle → dist/handler.zip

aiops-tf-infra/                       # EXISTING repo
├── modules/ffrs/                     # everything FFRS: Lambda, API GW, IAM, logs, EventBridge, S3 screenshots, SES, SSM
├── ffrs.tf                           # module "ffrs" { count = var.enable_ffrs ? 1 : 0 … }
└── cloudfront.tf                     # dynamic ordered_cache_behavior /api/* only when enable_ffrs
```

Reusability contract: the widget is configured by data-attributes only; `ffrs-api` depends on nothing site-specific except environment variables (`SITE_NAME`, `GITHUB_REPO`, `FROM_EMAIL`, `ALERT_EMAIL`). Effects are plug-ins behind one interface, so a project without GitHub can drop `githubIssue.ts` and add `linear.ts`.

## 6. Engineering standards (applied, not aspirational)

- **TypeScript strict, no `any`**; Zod validation at every boundary (HTTP body, env, GitHub webhook, Turnstile response).
- **Fail fast**: any unhandled error → 500 + structured log; no silent catches. Outbox handles *expected* transient failures explicitly.
- **Idempotency**: `POST /api/feedback` accepts an `Idempotency-Key` header (client generates UUID once per form fill) so retries never double-insert.
- **Structured logs** (JSON, one line per request, `ref` correlation id) → CloudWatch; metrics view in Neon is the analytics source, no third-party analytics.
- **Testing pyramid**: vitest unit (domain, guards, ref) → contract tests of the handler with a Neon preview branch → Playwright E2E on production (submit → 202 → status page shows "received").
- **Security**: Turnstile server-side verify + honeypot field + token-bucket rate limit (per IP hash, 5/min, in-memory per Lambda instance — good enough at this scale, documented as the known limit); size limits; strict Content-Security-Policy on the form page; GitHub webhook HMAC verified.
- **Widget**: no framework, no globals except `window.FFRS` (open/close/version), styles scoped to `.ffrs-*`, `<dialog>` element with focus trap and Escape, `prefers-reduced-motion` respected, hides itself on `/feedback/`. Screenshot is opt-out (thumbnail with ✕, as in fmg).
- **Accessibility**: `/feedback/` works without JS (plain POST → 303 to `/feedback/thanks/?ref=…`), labelled fields, visible errors, Turnstile in invisible mode.
- **CI**: GitHub Actions on `ffrs-api` — typecheck, test, bundle, `terraform plan` comment; deploy on tag. Site repo unchanged (build.sh + sync).

## 7. Delivery phases

| # | Phase | Deliverable | Est. |
|---|---|---|---|
| 0 | Foundations | Neon project + branches; SES identity verified; Turnstile site; GitHub App (`issues:write`); SSM params | ½ d |
| 1 | Core API | `ffrs-api` repo: schema, migration, `POST /api/feedback` with guards, outbox skeleton, unit tests, bundle | 1½ d |
| 2 | Infra | `modules/ffrs` + `enable_ffrs` flag, CloudFront `/api/*` behaviour, `plan` → `apply`; smoke test with curl; prove `enable_ffrs=false` plan removes everything | 1 d |
| 3 | Effects | ack email, GitHub issue (labels `kind:bug` etc.), maintainer alert; outbox drain on schedule | 1 d |
| 4 | Widget | `ffrs-widget.js/.css` ported from fmg `FeedbackButton.tsx`; `FFRS_ENABLED` in `build.sh` + footer placeholder; `/feedback/` fallback page; E2E spec; deploy with flag **on** | 1½ d |
| 5 | Loop closure | GitHub webhook → `closed_at`/`outcome`; closing email; `GET /api/feedback/:ref` status | 1 d |
| 6 | Measurement | `ffrs_metrics` view; weekly metrics job posting a summary issue; export script for the paper (CSV) | ½ d |
| 7 | Case-study pack | `docs/ffrs-case-study.md`: architecture, decisions log, metrics after 4 and 12 weeks, lessons | ongoing |

Total build ≈ 7 days effort; measurement window 12 weeks before the paper's numbers are final.

## 8. Decisions log (for the paper)

| Decision | Alternatives | Why |
|---|---|---|
| Lambda + API GW behind existing CloudFront | Cloudflare Workers, Vercel | One cloud, one Terraform state, same-origin API |
| Neon serverless Postgres | DynamoDB, Supabase | Relational metrics queries are the point; HTTP driver suits Lambda; branches give free preview envs |
| GitHub Issues as the triage tool | Custom admin UI | Zero new UI to secure; contributors already live there; webhook closes the loop |
| Outbox table over SQS | SQS, EventBridge | One fewer service; Postgres already there; volume is tiny |
| Turnstile + honeypot | hCaptcha, none | Invisible for humans, free, privacy-preserving |
| Edge-tab widget over a nav link/page | Dedicated page only | Feedback is contextual — capture *where* the visitor is, with a screenshot; proven pattern from fmg |
| Three-layer toggle (build, runtime, infra) | Single env flag | Build flag ships zero bytes when off; runtime flag stops abuse without a deploy; infra flag makes the case study reproducible from a clean account |
| Optional email + explicit consent | Mandatory email | Lowers friction, honours "responsible by default"; anonymous items still get routed, just not closed by email |

## 9. Open items

- Confirm SES production access in `eu-central-1` (sandbox limits recipients).
- Choose GitHub repo for issues: `Scaled-AIOps/scaledaiops.org` (site) vs a new `Scaled-AIOps/feedback` (keeps site repo clean — recommended).
- Confirm the widget stays subordinate to the "Contribute on GitHub" CTA (it does not replace it).
- Screenshot default: on with opt-out (fmg behaviour) vs off with opt-in — recommend on/opt-out for bugs, off for feature requests.
