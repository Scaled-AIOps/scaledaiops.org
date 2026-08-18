# Fast Feedback Response System (FFRS) — Implementation Plan

Status: **built (phases 0–7), revised 2026-08-18 to a no-database design; go-live pending Turnstile + apply** · Case study: [ffrs-case-study.md](ffrs-case-study.md) · Owner: ScaledAIOps maintainers · Target: scaledaiops.org · Date: 2026-08-18

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

## 3. Architecture (no database — GitHub Issues is the system of record)

```
Any page (widget injected by footer)          CloudFront (existing dist EJE5SGJ73Q1SL)
  ┌ right-edge "Feedback" tab ┐
  │ modal: Feature | Bug      │──POST /api/feedback──▶ behaviour /api/* ──▶ API Gateway ──▶ Lambda (Node 22, TS)
  │ auto page screenshot      │                                                              │
  │ description, email, page  │                                        ┌─────────────────────┼──────────────────┐
  └───────────────────────────┘                                        ▼                     ▼                  ▼
                                                                GitHub Issues          S3 (private)          SES
                                                                = the record           sidecar {email},      ack · alert · close
                                                                (route/respond/close)  idem map, screenshots
                                                                       ▲
                                                                       └── webhook: issues.closed → closing email
```

Design decision (revised): the earlier Neon Postgres store was dropped to keep FFRS **dependency-minimal** — the only external systems are ones the project already uses (AWS, GitHub). Consequences:

- **The GitHub issue *is* the feedback record.** Its `created_at`, first human comment and `closed_at` are the Route, Respond and Close timestamps; `kind:*` / `severity:*` / `outcome:*` labels carry the categorical data; a hidden `<!-- ffrs:FB-XXXXXX -->` marker links it to the reference id. Metrics are computed from the Issues API (weekly job + `npm run metrics`), so anyone with read access to the repo can reproduce the paper's numbers.
- **The S3 sidecar holds only what must stay private:** `{email, consent, screenshotKey, acknowledgedAt, closeEmailAt}` per ref, an idempotency map (7-day expiry) and the screenshots (90-day expiry). No email address ever appears in an issue.
- **Capture is synchronous.** Validate → guards → screenshot to S3 → create issue → ack/alert email (best-effort, logged) → sidecar → `202 {ref}`. If GitHub is down the API answers `502 route_failed` and the widget retries with the same `Idempotency-Key`; nothing is half-stored. The outbox is gone — the trade is honesty over buffering, and it removes a table, a schedule and ~150 lines.
- **Widget, embeddable anywhere, same-origin `/api/*`** — unchanged from the previous revision.

## 3a. Feature toggle — FFRS is detachable at three layers

| Layer | Switch | Effect when OFF | Where |
|---|---|---|---|
| **Site (build-time)** | `FFRS_ENABLED=false ./build.sh` (default **false** until launch) | Footer emits no widget `<script>`, no widget CSS, no `/feedback/` page; zero FFRS bytes ship. Playwright `feedback.spec.js` self-skips when the flag is off. | `build.sh`, `_layout/footer.html` (`{{FFRS_WIDGET}}` placeholder) |
| **API (runtime kill switch)** | SSM `/ffrs/enabled` = `false` (no redeploy) | `POST /api/feedback` → `503 {code:"ffrs_disabled"}`; widget reads it and hides its tab on next load. Stops capture in seconds during abuse or an incident. | Lambda config, cached 60 s |
| **Infra (provisioning)** | `enable_ffrs = false` in `aiops-tf-infra` | Terraform module `ffrs` has `count = var.enable_ffrs ? 1 : 0` — Lambda, API GW, `/api/*` behaviour, S3 data bucket, SES identity, EventBridge rule all removed on `apply`. The GitHub repo and the site are untouched. | `modules/ffrs`, `variables.tf` |

Rules: no FFRS code path lives outside `ffrs-api/`, `assets/js/ffrs-widget.js`, `_content/feedback/`, `_layout` placeholder and `modules/ffrs`; removing those five locations removes FFRS completely. The homepage/CTA never depends on it.

## 4. Data model

| Where | What | Retention |
|---|---|---|
| GitHub issue | title `[kind] …`, body (description, page, submitted-at, meta, screenshot link, marker), labels `ffrs`, `kind:*`, `severity:*`, `outcome:*`, `spam`; comments; state + `state_reason`; `created_at`/`closed_at` | forever (public) |
| S3 `sidecar/<ref>.json` | `ref, issueNumber, issueUrl, kind, title, createdAt, email\|null, consent, screenshotKey, acknowledgedAt, closeEmailAt` | until deleted (email is the only PII; delete the object to forget) |
| S3 `idem/<sha256(key)>` | ref | 7 days |
| S3 `screenshots/<date>/<ref>.jpg` | JPEG ≤ 300 KB, private, 7-day presigned link in the issue | 90 days |

Metrics per kind × ISO week (TS `aggregate()`, unit-tested): **TTFR** p50/p90 = first human comment − created; **TTC** p50 = closed − created; **loop closure** = share closed; **signal ratio** = share not labelled `spam`/duplicate. TTA/TTR are no longer separate metrics: routing is synchronous with capture (sub-second by construction) and the ack timestamp lives in the sidecar for audit.

## 5. Repository layout (reusable-by-design)

```
scaledaiops.org/
├── assets/js/ffrs-widget.js          # the embeddable widget (vanilla, no build step; ships only when FFRS_ENABLED)
├── assets/css/ffrs-widget.css        # tab + modal styles, scoped under .ffrs-*
├── _content/feedback/index.html      # no-JS fallback form + deep-link target from emails
├── _layout/footer.html               # {{FFRS_WIDGET}} placeholder → script tag or nothing
└── tests/feedback.spec.js            # E2E: tab visible, modal opens, submit → ref; skips when flag off

ffrs-api/                             # the reusable core; other projects adopt it as-is
├── src/handler.ts                    # Lambda entry: SSM secrets → config → adapters → app; job dispatch
├── src/app.ts                        # routes: POST /api/feedback, GET /api/feedback/:ref, POST /api/webhooks/github
├── src/domain/{ports,feedback,status,metrics,webhook,schema,ref}.ts   # Tracker/Store ports, capture(), pure logic
├── src/adapters/{githubTracker,s3Store,memory}.ts                     # GitHub REST, S3, in-memory twins
├── src/effects/{templates,mailer}.ts # ack/alert/close/issue templates, SES
├── src/guards/{turnstile,honeypot,rateLimit}.ts
├── src/reports/                      # weekly metrics issue
├── test/                             # vitest, no network
└── package.json                      # npm run check → dist/handler.zip

aiops-tf-infra/                       # EXISTING repo
├── modules/ffrs/                     # everything FFRS: Lambda, API GW, IAM, logs, weekly EventBridge, S3 data bucket, SES, SSM
├── ffrs.tf                           # module "ffrs" { count = var.enable_ffrs ? 1 : 0 … }
└── cloudfront.tf                     # dynamic ordered_cache_behavior /api/* only when enable_ffrs
```

Reusability contract: the widget is configured by data-attributes only; `ffrs-api` depends on nothing site-specific except environment variables (`SITE_NAME`, `GITHUB_REPO`, `FROM_EMAIL`, `ALERT_EMAIL`). Effects are plug-ins behind one interface, so a project without GitHub can drop `githubIssue.ts` and add `linear.ts`.

## 6. Engineering standards (applied, not aspirational)

- **TypeScript strict, no `any`**; Zod validation at every boundary (HTTP body, env, GitHub webhook, Turnstile response).
- **Fail fast**: any unhandled error → 500 + structured log; no silent catches. GitHub unavailability is an explicit `502 route_failed`; email failures are logged warnings and never lose feedback.
- **Idempotency**: `POST /api/feedback` accepts an `Idempotency-Key` header (client generates UUID once per form open); the key→ref map in S3 makes retries return the same ref and never file a second issue.
- **Structured logs** (JSON, one line per request, `ref` correlation id) → CloudWatch; the GitHub Issues API is the analytics source, no third-party analytics.
- **Testing pyramid**: vitest unit + handler contract tests against in-memory Tracker/Store (no network) → Playwright E2E on the built site with the API stubbed → manual smoke on production after apply.
- **Security**: Turnstile server-side verify + honeypot field + token-bucket rate limit (per IP hash, 5/min, in-memory per Lambda instance — good enough at this scale, documented as the known limit); size limits; strict Content-Security-Policy on the form page; GitHub webhook HMAC verified.
- **Widget**: no framework, no globals except `window.FFRS` (open/close/version), styles scoped to `.ffrs-*`, `<dialog>` element with focus trap and Escape, `prefers-reduced-motion` respected, hides itself on `/feedback/`. Screenshot is opt-out (thumbnail with ✕, as in fmg).
- **Accessibility**: `/feedback/` works without JS (plain POST → 303 to `/feedback/thanks/?ref=…`), labelled fields, visible errors, Turnstile in invisible mode.
- **CI**: GitHub Actions on `ffrs-api` — typecheck, test, bundle, `terraform plan` comment; deploy on tag. Site repo unchanged (build.sh + sync).

## 7. Delivery phases

| # | Phase | Deliverable | Est. |
|---|---|---|---|
| 0 | Foundations | GitHub repo `Scaled-AIOps/feedback` + fine-grained token + webhook; SSM params; Turnstile site; SES identity (via Terraform) | ½ d |
| 1 | Core API | `ffrs-api` repo: `POST /api/feedback` with guards, GitHub tracker + S3 store behind ports, unit tests, bundle | 1½ d |
| 2 | Infra | `modules/ffrs` + `enable_ffrs` flag, CloudFront `/api/*` behaviour, `plan` → `apply`; smoke test with curl; prove `enable_ffrs=false` plan removes everything | 1 d |
| 3 | Emails | ack email, maintainer alert (SES), issue template with presigned screenshot | ½ d |
| 4 | Widget | `ffrs-widget.js/.css` ported from fmg `FeedbackButton.tsx`; `FFRS_ENABLED` in `build.sh` + footer placeholder; `/feedback/` fallback page; E2E spec; deploy with flag **on** | 1½ d |
| 5 | Loop closure | GitHub webhook `issues.closed` → closing email; `GET /api/feedback/:ref` status from GitHub | ½ d |
| 6 | Measurement | metrics from the Issues API; weekly report issue; CSV export CLI | ½ d |
| 7 | Case-study pack | `docs/ffrs-case-study.md`: architecture, decisions log, metrics after 4 and 12 weeks, lessons | ongoing |

Total build ≈ 7 days effort; measurement window 12 weeks before the paper's numbers are final.

## 8. Decisions log (for the paper)

| Decision | Alternatives | Why |
|---|---|---|
| Lambda + API GW behind existing CloudFront | Cloudflare Workers, Vercel | One cloud, one Terraform state, same-origin API |
| **GitHub Issues as the system of record + S3 sidecar** (revised) | Neon Postgres (original), DynamoDB | Zero new dependencies: the tracker already holds respond/close timestamps; metrics reproducible by anyone with repo read; only PII (email) kept in a private S3 object |
| GitHub Issues as the triage tool | Custom admin UI | Zero new UI to secure; contributors already live there; webhook closes the loop |
| Synchronous capture, no outbox (revised) | Outbox table / SQS | With GitHub as the store there is nothing to buffer *into*; an honest 502 + client retry with idempotency key is simpler and truthful |
| Turnstile + honeypot | hCaptcha, none | Invisible for humans, free, privacy-preserving |
| Edge-tab widget over a nav link/page | Dedicated page only | Feedback is contextual — capture *where* the visitor is, with a screenshot; proven pattern from fmg |
| Three-layer toggle (build, runtime, infra) | Single env flag | Build flag ships zero bytes when off; runtime flag stops abuse without a deploy; infra flag makes the case study reproducible from a clean account |
| Optional email + explicit consent | Mandatory email | Lowers friction, honours "responsible by default"; anonymous items still get routed, just not closed by email |

## 9. Open items

- Confirm SES production access in `eu-central-1` (sandbox limits recipients).
- Turnstile site key + secret (only remaining Phase 0 item besides `apply`).
- Confirm the widget stays subordinate to the "Contribute on GitHub" CTA (it does not replace it).
- Screenshot default: on with opt-out (fmg behaviour) vs off with opt-in — recommend on/opt-out for bugs, off for feature requests.
