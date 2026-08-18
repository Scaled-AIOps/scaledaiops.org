# FFRS Case Study — scaledaiops.org

Companion to the FFRS paper. Status: **implementation complete, measurement not started** (go-live pending account setup). Sections marked ⏳ are filled from data; everything else is fact as of 2026-08-18. Plan and rationale: [ffrs-plan.md](ffrs-plan.md).

## 1. Context

| | |
|---|---|
| Subject | scaledaiops.org — a static, non-commercial reference site for an AI-Operations framework; volunteer-maintained; no accounts, no analytics |
| Problem | Visitors had no way to report a bug or request content short of opening a GitHub issue themselves; maintainers had no signal on response quality |
| Constraints | Zero-budget hosting (S3 + CloudFront), no server to run, privacy-first (no third-party analytics), must be removable without trace, must be reusable by other small projects |
| Team | 1 maintainer + AI pair (Claude Code); build effort ≈ 1 working day of wall-clock across 7 phases |

## 2. The FFRS model as implemented

Five stages, each a nullable timestamp on one row. Metrics are differences between those timestamps — no opinions, no manual bookkeeping.

| Stage | Trigger in this implementation | Column |
|---|---|---|
| Capture | `POST /api/feedback` commits the row (before any side effect) | `created_at` |
| Acknowledge | outbox sends the ack email (only with consent) | `acknowledged_at` |
| Route | outbox files the GitHub issue (labels `kind:*`, `severity:*`) | `routed_at` |
| Respond | GitHub webhook: first *human* comment on the issue | `responded_at` |
| Close | GitHub webhook: issue closed → outcome derived, closing email sent | `closed_at`, `outcome` |

Metrics (per kind, per ISO week, view `ffrs_metrics`; TS twin `aggregate()` is unit-tested against the same semantics): **TTA, TTR** (automated — should be seconds), **TTFR** p50/p90 (the human number), **TTC** p50, **loop-closure rate**, **signal ratio**.

## 3. Architecture (as built)

```
widget (edge tab, ~4 KB gz) ──POST /api/feedback──▶ CloudFront /api/* ──▶ API Gateway ──▶ Lambda (Node 22, arm64)
                                                                                            ├─ Neon Postgres (rows + outbox + metrics view)
                                                                                            ├─ S3 (screenshots, private, 90-day expiry)
                                                                                            ├─ SES (ack, alert, close emails)
                                                                                            └─ GitHub Issues (route) ◀── webhook (respond/close)
```

Key mechanisms and why they matter for the paper:

- **Durable-first capture.** Insert commits, `202 {ref}` returns, then side effects run from an **outbox table** drained every minute with backoff (1 m → 6 h, then parked). Result: SES or GitHub outages cannot lose feedback and cannot inflate TTA/TTR beyond what the outbox records — the metrics stay honest.
- **Idempotency.** `Idempotency-Key` per form open; retries return the same `ref` (HTTP 200 vs 202) and never double-count.
- **Guards.** Honeypot (silent fake 202 — bots never learn), per-IP token bucket, Cloudflare Turnstile server-verified. Spam that slips through is labelled in the DB (`status=spam`) and shows up in *signal ratio* rather than being deleted.
- **Loop closure without a UI.** Maintainers triage in GitHub; the webhook maps `issues.closed`/`reopened` and human `issue_comment` events back onto FFRS stages. Outcome = `outcome:*` label › GitHub `state_reason` › kind default.
- **Three-layer feature toggle.** Site build flag (zero bytes shipped when off), SSM kill switch (`503 ffrs_disabled` in ≤60 s without deploy), Terraform `enable_ffrs` (`count = 0` removes all 22 resources; `enable_ffrs=false` plan is a verified no-op).
- **Secrets never in state.** Lambda reads `/ffrs/*` SecureStrings at cold start; Terraform only asserts the kill-switch parameter exists.
- **Privacy by construction.** Email stored only with explicit consent; screenshots private + expiring; public status endpoint returns timestamps only; export CLI emits no body/email/screenshot; IPs hashed and never stored.

## 4. Implementation facts

| Artifact | Repo · commit | Size |
|---|---|---|
| Capture/loop API | `Scaled-AIOps/ffrs-api` @ `df04ae2` | 28 TS files, 1 160 LOC src, 444 LOC tests, **34 tests**, bundle 690 KB zip (Neon + drizzle + presigner; AWS SDK external) |
| Widget + fallback page + build toggle | `Scaled-AIOps/scaledaiops.org` @ `3e048d1` | widget 10.9 KB (4.1 KB gz) + 5.8 KB CSS, no framework, no deps except on-click html2canvas |
| Infra | `Scaled-AIOps/aiops-tf-infra` @ `ca776ee` | `modules/ffrs`, 244 lines HCL, 22 resources |
| Data model | `ffrs-api/drizzle/0000_init.sql`, `0001_ffrs_metrics.sql` | 2 tables, 4 enums, 1 view |

Engineering standards applied (verifiable in the repos): TypeScript strict + `exactOptionalPropertyTypes`, no `any`; Zod at every boundary (HTTP body, env, GitHub webhook, Turnstile, GitHub responses); persistence behind one interface with Neon and in-memory implementations (tests need no database); effects as plug-ins behind one type; structured JSON logs keyed by `ref`; `npm run check` = typecheck + tests + bundle; Terraform `fmt`/`validate`/`plan` before every commit.

## 5. Measurement protocol ⏳

- **Window:** 12 weeks from go-live (T0 = first production submission). Interim read-out at week 4.
- **Source of truth:** `npm run metrics` (weekly view) and `npm run export` (anonymised rows) run against the Neon `main` branch; commit both CSVs under `docs/data/` with the export date in the filename.
- **Report:** per kind × week table (n, TTA p50, TTR p50, TTFR p50/p90, TTC p50, loop closure, signal ratio) plus overall medians; the Monday GitHub report issues (`ffrs-report`) are the running log.
- **Targets stated in advance:** TTA and TTR < 5 min p50 (automation working); TTFR < 72 h p50; TTC (bugs) < 30 d p50; loop closure → 100 % of consented items; signal ratio reported, no target.
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

## 7. Lessons so far (build phase)

1. **Tests caught two silent-failure bugs before any deploy:** a honeypot that returned `400` (telling bots they were detected — fixed to a fake `202`), and a CSS `display:grid` that overrode the `hidden` attribute in the widget.
2. **A memory implementation of the repo interface was worth it:** 34 tests run in <1 s with no database, and the same interface will run the Neon contract tests.
3. **Outbox over queue service** removed one AWS service and made "what happened to item X" a single SQL query — the paper's TTA/TTR numbers come straight from `side_effects.done_at`.
4. **Secrets at cold start** avoided the usual Terraform-state leak with ~20 lines; the cost is one SSM call per cold start.
5. **Feature-toggle discipline is cheap if decided up front:** five well-known locations, one build variable, one Terraform count; verified by an `enable_ffrs=false` plan showing *No changes*.
6. **Pair-programming friction worth naming:** two commits initially slipped past failing checks because a `grep` pipeline masked the exit code in a `&&` chain — fixed by checking `$?` explicitly. Process, not tooling.

## 8. Threats to validity

- Single site, low traffic → wide confidence intervals; report n with every metric.
- Maintainer is also the author → TTFR may be flattering; state it, and report the week-4 vs week-12 drift.
- Turnstile + honeypot bias *who* can submit (no-JS users fall back to the page form; those without JS and Turnstile can still submit).
- Timestamps come from GitHub webhooks: a webhook outage delays `responded_at`/`closed_at` (retried by GitHub, but note the possibility).

## 9. Reproducibility

```bash
git clone https://github.com/Scaled-AIOps/ffrs-api && cd ffrs-api && npm i && npm run check
git clone https://github.com/Scaled-AIOps/aiops-tf-infra && cd aiops-tf-infra && terraform init && terraform plan -var enable_ffrs=true
git clone https://github.com/Scaled-AIOps/scaledaiops.org && cd scaledaiops.org && FFRS_ENABLED=true ./build.sh && FFRS_ENABLED=true npx playwright test tests/feedback.spec.js
```
Adopting FFRS on another site: deploy `ffrs-api` with your env, add one `<script>` tag (see widget header), point a GitHub webhook at `/api/webhooks/github`. Everything site-specific is an environment variable or a `data-*` attribute.

## 10. Ethics & licensing

Content CC BY-SA 4.0 (site), MIT (`ffrs-api`, widget). Data handling: consent-gated email, 90-day purge of email + screenshot after close, anonymised export only. No third-party analytics; the only third parties are Cloudflare Turnstile (on submit), GitHub (issues), AWS (hosting).
