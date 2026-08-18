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
Browser (static page, /feedback/)              CloudFront (existing dist EJE5SGJ73Q1SL)
  form + Turnstile widget  ──POST /api/feedback──▶  behaviour /api/* ──▶ API Gateway HTTP API ──▶ Lambda (Node 22, TS)
                                                                                                    │
                                              ┌─────────────────────────────────────────────────────┤
                                              ▼                         ▼                           ▼
                                        Neon Postgres            SES (ack email,          GitHub Issues API
                                        (source of truth)        maintainer alert)        (route + label)
```

- **One Lambda, three routes**: `POST /api/feedback` (public), `GET /api/feedback/:ref` (public status by reference id), `POST /api/webhooks/github` (issue closed → `closed_at`, outcome, closing email). Keeps cold-start surface small and deploy trivial.
- **Side effects after commit**: insert row → return 202 with `ref` → then ack email, GitHub issue, alert. Failures in side effects are retried by a lightweight outbox (`side_effects` table, polled by the same Lambda on an EventBridge schedule every minute). Nothing is lost if GitHub or SES is down.
- **Same-origin API** via CloudFront `/api/*` behaviour — no CORS, no second domain, cookies not needed.
- **Neon**: serverless driver over HTTP (`@neondatabase/serverless`), one branch per environment (`main`, `preview`), migrations with `drizzle-kit`.
- **Secrets**: SSM Parameter Store (Neon URL, Turnstile secret, GitHub App private key), read at cold start.

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
  email            text,                            -- optional; needed for ack + close
  consent          boolean not null default false,  -- may we email you?
  status           feedback_status not null default 'new',
  outcome          feedback_outcome,
  github_issue_url text,
  ua_hash          text,                            -- sha256(user-agent), for abuse analysis, not identity
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

PII stance: `email` is the only personal field, optional, deleted (nulled) 90 days after `closed_at` by a scheduled job. IP addresses are used only transiently for rate limiting and never stored.

## 5. Repository layout (reusable-by-design)

```
scaledaiops.org/
├── _content/feedback/index.html      # the form page (one page, three kinds via <select>)
├── assets/js/feedback.js             # progressive enhancement: Turnstile, fetch, inline status
└── tests/feedback.spec.js            # E2E against production (happy path + validation errors)

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
├── api.tf                            # Lambda, API GW HTTP API, IAM, log group, EventBridge minute rule
├── cloudfront.tf                     # + ordered_cache_behavior /api/* → API GW origin (no cache)
├── ses.tf                            # verified identity feedback@scaledaiops.org, templates
└── ssm.tf                            # parameters (values set out-of-band, never in state)
```

Reusability contract: `ffrs-api` depends on nothing site-specific except environment variables (`SITE_NAME`, `GITHUB_REPO`, `FROM_EMAIL`, `ALERT_EMAIL`). Effects are plug-ins behind one interface, so a project without GitHub can drop `githubIssue.ts` and add `linear.ts`.

## 6. Engineering standards (applied, not aspirational)

- **TypeScript strict, no `any`**; Zod validation at every boundary (HTTP body, env, GitHub webhook, Turnstile response).
- **Fail fast**: any unhandled error → 500 + structured log; no silent catches. Outbox handles *expected* transient failures explicitly.
- **Idempotency**: `POST /api/feedback` accepts an `Idempotency-Key` header (client generates UUID once per form fill) so retries never double-insert.
- **Structured logs** (JSON, one line per request, `ref` correlation id) → CloudWatch; metrics view in Neon is the analytics source, no third-party analytics.
- **Testing pyramid**: vitest unit (domain, guards, ref) → contract tests of the handler with a Neon preview branch → Playwright E2E on production (submit → 202 → status page shows "received").
- **Security**: Turnstile server-side verify + honeypot field + token-bucket rate limit (per IP hash, 5/min, in-memory per Lambda instance — good enough at this scale, documented as the known limit); size limits; strict Content-Security-Policy on the form page; GitHub webhook HMAC verified.
- **Accessibility**: form works without JS (plain POST → 303 to `/feedback/thanks/?ref=…`), labelled fields, visible errors, Turnstile in invisible mode.
- **CI**: GitHub Actions on `ffrs-api` — typecheck, test, bundle, `terraform plan` comment; deploy on tag. Site repo unchanged (build.sh + sync).

## 7. Delivery phases

| # | Phase | Deliverable | Est. |
|---|---|---|---|
| 0 | Foundations | Neon project + branches; SES identity verified; Turnstile site; GitHub App (`issues:write`); SSM params | ½ d |
| 1 | Core API | `ffrs-api` repo: schema, migration, `POST /api/feedback` with guards, outbox skeleton, unit tests, bundle | 1½ d |
| 2 | Infra | `api.tf`, CloudFront `/api/*` behaviour, `plan` → `apply`; smoke test with curl | ½ d |
| 3 | Effects | ack email, GitHub issue (labels `kind:bug` etc.), maintainer alert; outbox drain on schedule | 1 d |
| 4 | Form page | `/feedback/` content page + `feedback.js`; nav/footer link; E2E spec; deploy | 1 d |
| 5 | Loop closure | GitHub webhook → `closed_at`/`outcome`; closing email; `GET /api/feedback/:ref` status | 1 d |
| 6 | Measurement | `ffrs_metrics` view; weekly metrics job posting a summary issue; export script for the paper (CSV) | ½ d |
| 7 | Case-study pack | `docs/ffrs-case-study.md`: architecture, decisions log, metrics after 4 and 12 weeks, lessons | ongoing |

Total build ≈ 6 days effort; measurement window 12 weeks before the paper's numbers are final.

## 8. Decisions log (for the paper)

| Decision | Alternatives | Why |
|---|---|---|
| Lambda + API GW behind existing CloudFront | Cloudflare Workers, Vercel | One cloud, one Terraform state, same-origin API |
| Neon serverless Postgres | DynamoDB, Supabase | Relational metrics queries are the point; HTTP driver suits Lambda; branches give free preview envs |
| GitHub Issues as the triage tool | Custom admin UI | Zero new UI to secure; contributors already live there; webhook closes the loop |
| Outbox table over SQS | SQS, EventBridge | One fewer service; Postgres already there; volume is tiny |
| Turnstile + honeypot | hCaptcha, none | Invisible for humans, free, privacy-preserving |
| Optional email + explicit consent | Mandatory email | Lowers friction, honours "responsible by default"; anonymous items still get routed, just not closed by email |

## 9. Open items

- Confirm SES production access in `eu-central-1` (sandbox limits recipients).
- Choose GitHub repo for issues: `Scaled-AIOps/scaledaiops.org` (site) vs a new `Scaled-AIOps/feedback` (keeps site repo clean — recommended).
- Decide whether `/feedback/` also replaces the "Contribute on GitHub" CTA on the homepage or sits beside it.
