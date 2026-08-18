# FFRS Case Study — scaledaiops.org

Companion to the FFRS paper. Status: **live on production since 2026-08-18 (T0); measurement window running** — first item `FB-DT343N` captured 16:57 UTC, responded 17:12, closed 17:12 with closing email delivered. Sections marked ⏳ are filled from data; everything else is fact as of 2026-08-18. Plan and rationale: [ffrs-plan.md](ffrs-plan.md).

## 1. Context

| | |
|---|---|
| Subject | scaledaiops.org — a static, non-commercial reference site for an AI-Operations framework; volunteer-maintained; no accounts, no analytics |
| Problem | Visitors had no way to report a bug or request content short of opening a GitHub issue themselves; maintainers had no signal on response quality |
| Constraints | Zero-budget hosting (S3 + CloudFront), no server to run, **no database / no new external service**, privacy-first (no third-party analytics), removable without trace, reusable by other small projects |
| Team | 1 maintainer + AI pair (Claude Code); build effort ≈ 1 working day of wall-clock across 7 phases |

## 2. The FFRS model as implemented

Five stages, each a timestamp recorded by the system that naturally owns it. Metrics are differences between those timestamps — no opinions, no manual bookkeeping.

| Stage | Trigger in this implementation | Recorded in |
|---|---|---|
| Capture + Route | `POST /api/feedback` creates the GitHub issue synchronously (labels `kind:*`, `severity:*`, marker `<!-- ffrs:REF -->`) | issue `created_at` |
| Acknowledge | ack email to consented submitters | sidecar `acknowledgedAt` |
| Respond | first *human* comment on the issue | GitHub comments API |
| Close | issue closed → outcome from `outcome:*` label / `state_reason`; webhook sends the closing email | issue `closed_at`, sidecar `closeEmailAt` |

Metrics (per kind, per ISO week; `aggregate()` over items collected from the Issues API, unit-tested): **TTFR** p50/p90 (first human comment − created — the human number), **TTC** p50, **loop-closure rate** (share closed), **signal ratio** (share not `spam`/duplicate). Route is sub-second by construction; the ack timestamp is kept in the sidecar for audit.

## 3. Architecture (as built)

```
widget (edge tab, ~4 KB gz) ──POST /api/feedback──▶ CloudFront /api/* ──▶ API Gateway ──▶ Lambda (Node 22, arm64)
                                                                                            ├─ GitHub Issues  = system of record (route · respond · close) ◀── webhook (closed → email)
                                                                                            ├─ S3 private     sidecar {email}, idempotency map, screenshots (expiring)
                                                                                            └─ SES            ack · alert · close emails
```

Key mechanisms and why they matter for the paper:

- **No database.** The issue *is* the record; the only private state is a JSON sidecar per item in S3. Metrics are recomputed from the Issues API, so anyone with read access can reproduce the paper's numbers. Capture is synchronous: GitHub down ⇒ `502 route_failed`, the widget retries with the same idempotency key, nothing is half-stored. Email outages are logged and never lose feedback.
- **Idempotency.** `Idempotency-Key` per form open; retries return the same `ref` (HTTP 200 vs 202) and never double-count.
- **Guards.** Honeypot (silent fake 202 — bots never learn), per-IP token bucket, Cloudflare Turnstile server-verified. Spam that slips through is labelled `spam` on the issue and shows up in *signal ratio* rather than being deleted.
- **Loop closure without a UI.** Maintainers triage in GitHub; GitHub itself records comments (Respond) and close time; the webhook only sends the closing email on `issues.closed`. Outcome = `outcome:*` label › GitHub `state_reason` › kind default.
- **Three-layer feature toggle.** Site build flag (zero bytes shipped when off), SSM kill switch (`503 ffrs_disabled` in ≤60 s without deploy), Terraform `enable_ffrs` (`count = 0` removes all 19 resources; `enable_ffrs=false` plan is a verified no-op).
- **Secrets never in state.** Lambda reads `/ffrs/*` SecureStrings at cold start; Terraform only asserts the kill-switch parameter exists.
- **Privacy by construction.** Email stored only with explicit consent; screenshots private + expiring; public status endpoint returns timestamps only; export CLI emits no body/email/screenshot; IPs hashed and never stored.

## 4. Implementation facts

| Artifact | Repo · commit | Size |
|---|---|---|
| Capture/loop API | `Scaled-AIOps/ffrs-api` @ `ceb9486` | 24 TS files, ~900 LOC src, ~330 LOC tests, **32 tests**, bundle 414 KB zip (no DB driver; AWS SDK external) |
| Widget + fallback page + build toggle | `Scaled-AIOps/scaledaiops.org` @ `3e048d1` | widget 10.9 KB (4.1 KB gz) + 5.8 KB CSS, no framework, no deps except on-click html2canvas |
| Infra | `Scaled-AIOps/aiops-tf-infra` @ `c6d04c6` | `modules/ffrs`, ~230 lines HCL, 19 resources, applied 2026-08-18 |
| Data model | GitHub issue + `sidecar/<ref>.json` in S3 (see plan §4) | 0 tables |

Engineering standards applied (verifiable in the repos): TypeScript strict + `exactOptionalPropertyTypes`, no `any`; Zod at every boundary (HTTP body, env, GitHub webhook, Turnstile, GitHub responses); persistence behind two ports (`Tracker`, `Store`) with GitHub/S3 and in-memory implementations (tests need no network); structured JSON logs keyed by `ref`; `npm run check` = typecheck + tests + bundle; Terraform `fmt`/`validate`/`plan` before every commit.

## 5. Measurement protocol ⏳

- **Window:** 12 weeks from **T0 = 2026-08-18** (first production submission `FB-DT343N`); week-4 read-out 2026-09-15, week-12 read-out 2026-11-10.
- **Source of truth:** `npm run metrics` / `npm run export` read the `Scaled-AIOps/feedback` issues (public) — anyone can re-run them; commit both CSVs under `docs/data/` with the export date in the filename.
- **Report:** per kind × week table (n, TTFR p50/p90, TTC p50, loop closure, signal ratio) plus overall medians; the Monday GitHub report issues (`ffrs-report`) are the running log.
- **Targets stated in advance:** TTFR < 72 h p50; TTC (bugs) < 30 d p50; loop closure → 100 % of consented items (closing email sent); signal ratio reported, no target.
- **Qualitative:** count of items that changed the framework text (link issue → commit), maintainer time per item (self-reported), submitter replies to closing emails.

### 5.1 Results — week 4 ⏳
_Table + 3 bullet observations._

### 5.2 Results — week 12 ⏳
_Table + interpretation against targets._

## 6. Decisions log

See [ffrs-plan.md §8](ffrs-plan.md#8-decisions-log-for-the-paper). Two decisions changed during build:

| Change | Was | Now | Why |
|---|---|---|---|
| Capture surface | dedicated `/feedback/` page | edge-tab widget on every page + `/feedback/` as no-JS fallback | feedback is contextual; screenshot + page URL are the most useful triage signals (pattern proven on fixmygadgets.in) |
| Screenshot embedding | — | 7-day presigned S3 link inside the GitHub issue | keeps the bucket private while triage still sees the image |
| Store | Neon Postgres + outbox | GitHub Issues + private S3 sidecar, synchronous capture | owner asked for the least-dependency form; the tracker already held respond/close facts, so the DB was duplicating them |

## 7. Lessons so far (build phase)

1. **Tests caught two silent-failure bugs before any deploy:** a honeypot that returned `400` (telling bots they were detected — fixed to a fake `202`), and a CSS `display:grid` that overrode the `hidden` attribute in the widget.
2. **Ports paid for themselves within a day:** replacing Neon with GitHub-as-store touched adapters, `capture()` and tests; widget, guards, HTTP layer, Terraform (except the bucket) and the site were untouched. 32 tests still run in <1 s with in-memory twins.
3. **Removing the database was a net simplification:** −1 external service, −1 secret, −1 schedule, −276 KB bundle; the cost is a synchronous dependency on GitHub at capture time, made explicit as `502 route_failed` + client retry.
4. **Secrets at cold start** avoided the usual Terraform-state leak with ~20 lines; the cost is one SSM call per cold start.
5. **Feature-toggle discipline is cheap if decided up front:** five well-known locations, one build variable, one Terraform count; verified by an `enable_ffrs=false` plan showing *No changes*.
6. **Go-live findings (2026-08-18):** three defects surfaced only in production — S3 needs `s3:ListBucket` for a missing key to read as `NoSuchKey`; the GitHub token was twice overwritten with clipboard text (verify shape before use); SES sandbox blocks unverified recipients even with a verified domain. All fixed within the hour; capture itself never failed.
7. **Pair-programming friction worth naming:** two commits initially slipped past failing checks because a `grep` pipeline masked the exit code in a `&&` chain — fixed by checking `$?` explicitly. Process, not tooling.

## 8. Threats to validity

- Single site, low traffic → wide confidence intervals; report n with every metric.
- Maintainer is also the author → TTFR may be flattering; state it, and report the week-4 vs week-12 drift.
- Turnstile + honeypot bias *who* can submit (no-JS users fall back to the page form; those without JS and Turnstile can still submit).
- Respond/close timestamps come from GitHub itself (comments/`closed_at`), so webhook outages only delay the closing *email*, not the metric.
- Capture availability equals GitHub API availability (~99.9 %); brief outages surface as `502` and client retries.

## 9. Reproducibility

```bash
git clone https://github.com/Scaled-AIOps/ffrs-api && cd ffrs-api && npm i && npm run check
git clone https://github.com/Scaled-AIOps/aiops-tf-infra && cd aiops-tf-infra && terraform init && terraform plan -var enable_ffrs=true
git clone https://github.com/Scaled-AIOps/scaledaiops.org && cd scaledaiops.org && FFRS_ENABLED=true ./build.sh && FFRS_ENABLED=true npx playwright test tests/feedback.spec.js
```
Adopting FFRS on another site: a GitHub repo + fine-grained token, one private S3 bucket, deploy `ffrs-api` with your env, add one `<script>` tag (see widget header), point a GitHub webhook at `/api/webhooks/github`. Everything site-specific is an environment variable or a `data-*` attribute.

## 10. Ethics & licensing

Content CC BY-SA 4.0 (site), MIT (`ffrs-api`, widget). Data handling: consent-gated email, 90-day purge of email + screenshot after close, anonymised export only. No third-party analytics; the only third parties are Cloudflare Turnstile (on submit), GitHub (issues), AWS (hosting).
