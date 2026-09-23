# ScaledAIOps repositioning spec

Design of record for the September 2026 repositioning. Pages are built from this spec; change the spec first, then the pages.

## 1. Positioning

ScaledAIOps is an open, governance-first framework for **how organisations work with AI**: adopting AI tools (coding assistants, agents, copilots) across the SDLC, CI/CD and DevOps — safely, measurably and at scale.

- **About using AI, not building it.** Model-building content (training, serving, feature stores, MLOps) is archived on `/legacy/` and never returns to navigation or new content.
- **Restructure, don't replace.** Organisations already run an SDLC, CI/CD pipelines, change management and incident response. ScaledAIOps changes those practices so AI can take part in them; it does not add a parallel "AI process".
- **Cradle to grave.** Coverage runs from business concept to a running production system and on to its retirement, for every element created along the way.
- **Proportionate.** Controls scale with risk (four tiers), so a startup and a bank use the same model at different settings.
- **Analogy:** what SAFe did for agile at enterprise scale, ScaledAIOps does for AI adoption.
- **Audience:** engineering leaders; CROs and second-line risk; platform teams — especially in regulated industries.
- **Trust signals:** open (CC BY-SA 4.0), vendor-neutral ("no vendor lock-in"), anchored to the EU AI Act and ISO/IEC 42001. Never write "no certification".

## 2. The model at a glance

| Layer | Contents | Purpose |
|---|---|---|
| Lifecycle | 9 stages, Conceive → Retire; element register | Where AI takes part, and how every element is born, changed and retired |
| Disciplines | 6 | What an organisation must be good at |
| Control pillars | 4: Assess → Prevent → Prove → Detect | How AI use is kept safe, cross-cutting all disciplines |
| Principles | 8 | How decisions are made when the model is silent |
| Roles | 8 | Who does the work |
| Maturity model | 6 dimensions × 5 levels | Where you are, what to do next |

## 3. The AI-augmented lifecycle (cradle to grave)

Reference loop: **Conceive → Plan → Specify → Generate → Verify → Release → Operate → Learn → Retire.**

| Stage | What AI contributes | Human decision | Key outputs | Existing practice it restructures |
|---|---|---|---|---|
| Conceive | Market and domain research summaries, option framing, first-cut business case | Sponsor accepts problem, value hypothesis and risk tier | Business case, value hypothesis, initial risk tier | Idea intake, portfolio triage |
| Plan | Backlog drafting, dependency and estimate proposals | Product owner prioritises; tier confirmed per epic | Prioritised backlog with tiers | Roadmapping, refinement |
| Specify | Drafts user stories, acceptance criteria, API contracts, test cases, ADR options | Owner approves acceptance criteria and architecture decisions | Approved specs, ADRs recording AI involvement | Requirements, design reviews |
| Generate | Code, tests, infrastructure-as-code, configuration, documentation, migrations | Engineer owns the change and its intent | Changes with provenance trailer | Development |
| Verify | Pre-review, test generation, static analysis triage, eval runs | Reviewer(s) per tier; specialist sign-off at high and critical | Review record, evidence bundle | Code review, QA, security testing |
| Release | Release notes, change-risk summary, rollout plan | Approval per tier (auto / review / human-only) | Release record linked to changes | CI/CD, change advisory |
| Operate | Alert triage, runbook suggestions, incident summaries | Incident commander decides; no autonomous production action above low tier | Incident timeline incl. AI actions | Monitoring, incident management |
| Learn | Post-incident and retrospective synthesis, metric analysis | Team agrees changes to delegation, guardrails, context | Updated guardrails, context assets, tiers | Retrospectives, problem management |
| Retire | Dependency and usage discovery, decommission plans | Owner approves retirement; access revoked | Retirement record, archived provenance | Decommissioning, access recertification |

### 3.1 Element register ("every element")

An **element** is anything created, changed, run or retired during delivery: business case, requirement, ADR, code, test, infrastructure and configuration, pipeline, dataset, prompt or context pack, agent or automation, tool integration (e.g. an MCP server), non-human identity or credential, AI service dependency, documentation, release.

Every element has: an **owner**; a **risk tier**; a **provenance record** (human / AI-assisted / AI-generated, the context used, the approver); and a **state**: proposed → approved → active → deprecated → retired. Retirement is deliberate: dependants found, access revoked, provenance archived. Organisations start with the element types they already track (code, releases, access) and add AI-specific ones (prompts, context packs, agents, integrations, non-human identities).

### 3.2 The AI-aware pipeline

Existing CI/CD gains controls, not stages:

1. **Pre-commit** — secret scanning; context hygiene (no sensitive data in prompts/context).
2. **Build** — unchanged.
3. **Verify** — tests; SAST; licence and IP check on generated code; provenance check (every AI-assisted change is marked); evals for prompts, agents and AI features.
4. **Policy gate** — policy-as-code maps the change's risk tier to required approvals.
5. **Release** — progressive delivery as today; release record links to provenance.
6. **Operate / Learn** — AI-assisted change failure rate, rework and review burden fed back into tiers and guardrails.

### 3.3 What changes in existing practice

| Practice | Change |
|---|---|
| Refinement | AI drafts stories and acceptance criteria; the product owner owns acceptance |
| Architecture | AI proposes options; ADRs record AI involvement and the human decision |
| Code review | Risk-tiered; AI pre-review for mechanics, humans review intent and risk |
| Commits | Provenance trailer marks AI involvement, vendor-neutral |
| CI/CD | Provenance, licence and eval gates; tier-driven approvals |
| Change management | Low/medium-tier AI-assisted changes become standard changes; high and critical keep full review |
| Identity & access | Agents are non-human identities: least privilege, short-lived credentials, recertified |
| Incident management | AI assists triage; a human commands; AI actions appear in the timeline |
| Decommissioning | Prompts, agents, integrations and credentials retired like any other asset |

## 4. Risk tiers and delegation

Tier criteria: blast radius, reversibility, data sensitivity, regulatory exposure. The highest applicable criterion sets the tier.

| Tier | Typical work | Delegation gate | Minimum controls |
|---|---|---|---|
| Low | Docs drafts, test scaffolding, internal tooling, reversible and no sensitive data | Auto-approve | Automated checks pass; provenance recorded |
| Medium | Production code and config with normal blast radius, standard rollback | Human review | One qualified reviewer; pipeline gates; provenance |
| High | Security, access control, customer data, financial logic, wide-blast-radius infrastructure | Human review, enhanced | Two reviewers incl. a specialist; evidence bundle; enhanced monitoring after release |
| Critical | Irreversible or regulatory-significant actions: key management, production data deletion, decisions about people, safety functions | Human only | AI may inform, never decide or act; documented rationale; second-line oversight |

Tiers follow the EU AI Act's risk-based approach but do not map one-to-one: the Act classifies AI systems by use (prohibited / high / limited / minimal); ScaledAIOps tiers classify work.

## 5. Control pillars

Assess → Prevent → Prove → Detect. Each discipline page states which pillar controls apply at each tier.

1. **Self-Assessment (Assess)** — the AI Adoption Maturity Model: where you are and what to do next.
2. **Guardrails (Prevent)** — what AI may access, do and decide: approved tools, data boundaries, input/output controls, action limits, kill switches.
3. **Audit Trail (Prove)** — provenance of AI-generated work: what generated it, from which context, who approved it. Queryable from the systems already of record (VCS, tracker, pipeline).
4. **Self-Monitoring (Detect)** — quality of AI-assisted output over time, usage drift, incident detection and escalation.

## 6. Disciplines

Slugs under `/disciplines/`. Each page follows the template in §10.

1. **AI-Augmented Delivery** (`ai-augmented-delivery`) — the lifecycle of §3 applied: AI in every stage, the AI-aware pipeline, the element register.
2. **Human–AI Workflow Design** (`human-ai-workflow-design`) — delegation model; tier-based approval gates (auto-approve / human-review / human-only); handoff and escalation paths; agent autonomy levels.
3. **Tooling & Context Engineering** (`tooling-context-engineering`) — tool selection and integration (incl. MCP); non-human identities; prompts, skills and context as versioned, reviewed assets.
4. **Governance & Guardrails** (`governance-guardrails`) — the four pillars applied to AI usage; policy, inventory, third-party (vendor) risk, regulatory mapping.
5. **Skills & Roles** (`skills-roles`) — competency shift, redefined roles, team topology, enablement; AI literacy (EU AI Act Art. 4).
6. **Value & Measurement** (`value-measurement`) — cycle time, rework rate, defect escape rate, review burden, cost/ROI; measure teams and flow, never individuals; no vanity metrics.

## 7. Maturity model

Levels: **1 Ad hoc → 2 Experimenting → 3 Managed → 4 Governed → 5 Optimised.** One dimension per discipline.

| Level | Generic descriptor |
|---|---|
| Ad hoc | Individuals use AI tools on their own initiative; no inventory, no policy; AI output untracked |
| Experimenting | Sanctioned pilots with named tools; basic usage policy; practice shared informally; value anecdotal |
| Managed | Approved tool catalogue; risk tiers defined and applied in review; provenance recorded; baseline metrics |
| Governed | Controls enforced in pipelines as policy-as-code; audit trail queryable; second line assures; roles staffed |
| Optimised | Delegation boundaries adjusted from evidence; context managed as a product; value and cost optimised continuously |

`/maturity/` carries the full 6 × 5 grid and a client-side self-assessment (no data leaves the browser).

## 8. Principles

Anchors on `/principles/`: statement, why, in practice, anti-pattern.

1. **Human accountability, always** (`human-accountability`) — every AI-assisted outcome has a named human owner.
2. **Delegate by risk, not by convenience** (`delegate-by-risk`) — the tier decides how much AI may do.
3. **Provenance by default** (`provenance-by-default`) — AI involvement is recorded where the work is recorded.
4. **Verify before trust** (`verify-before-trust`) — AI output is a proposal until checked.
5. **Context is an asset** (`context-is-an-asset`) — prompts, skills and context are versioned, reviewed and owned.
6. **Measure real value** (`measure-real-value`) — outcomes and flow, never output volume.
7. **Adopt incrementally** (`adopt-incrementally`) — small, reversible steps; expand delegation on evidence.
8. **Governed openness** (`governed-openness`) — open standards and portable assets inside clear guardrails; no vendor lock-in.

## 9. Roles

Anchors on `/roles/`: mission, responsibilities, evolves from, primary disciplines.

| Role | Anchor | Evolves from |
|---|---|---|
| Engineering Orchestrator | `engineering-orchestrator` | Senior / lead engineer |
| Eval Engineer | `eval-engineer` | QA / test engineer |
| Context Engineer | `context-engineer` | Technical writer, developer-experience engineer |
| AI Workflow Designer | `ai-workflow-designer` | Business analyst, process engineer |
| AI Adoption Lead | `ai-adoption-lead` | Agile coach, delivery manager |
| AI Governance Officer | `ai-governance-officer` | Risk, compliance, information-security officer |
| AI Platform Engineer | `ai-platform-engineer` | Platform / DevOps engineer |
| Value Analyst | `value-analyst` | Engineering-metrics or finance analyst |

## 10. Discipline page template

1. Hero: breadcrumb to `/disciplines/`, title, one-sentence subtitle.
2. **Overview** — what the discipline covers and why it matters.
3. **What changes in existing practice** — restructure, not replace.
4. **Key practices** — five or six, each an `h3` and a paragraph.
5. **Controls by risk tier** — table: tier × Prevent (Guardrails) / Prove (Audit Trail) / Detect (Self-Monitoring).
6. **Maturity path** — one line per level for this dimension.
7. **Measures** — what to track.
8. **Anti-patterns**.
9. **Regulatory anchors** — EU AI Act and ISO/IEC 42001, tool-agnostic.
10. **Related roles and principles** — links to anchors.

## 11. Information architecture

| URL | Page |
|---|---|
| `/` | Home |
| `/lifecycle/` | The AI-augmented lifecycle, element register, AI-aware pipeline |
| `/disciplines/` + 6 | Discipline hub and pages |
| `/pillars/` | Control pillars and risk tiers |
| `/maturity/` | Maturity model and self-assessment |
| `/principles/` | Eight principles |
| `/roles/` | Eight roles |
| `/about/` | About, contribution, licence |
| `/legacy/` | Archived pre-September-2026 MLOps edition (single page) |
| `/blog/` | Blog |

Navigation: Lifecycle · Disciplines · Pillars · Principles · Roles · About · GitHub.

**Legacy handling:** the old discipline, principle and role content, the old homepage lifecycle diagram and the LLM-hardware post move verbatim to `/legacy/`. Old URLs (`/disciplines/ml-engineering/` etc., `/blog/hardware-for-llm-training/`) become short pages pointing to the matching `/legacy/` anchor, kept out of navigation.

**Add-ons:** the FFRS feedback widget and its blog post are an add-on, not framework content; framework pages never reference it.

## 12. Regulatory anchoring

- **EU AI Act:** risk-based approach; AI literacy for staff of providers and deployers (Art. 4); obligations of deployers of high-risk systems (Art. 26); AI used to evaluate or monitor workers is high-risk (Annex III, point 4) — hence "measure teams, never individuals".
- **ISO/IEC 42001:** the pillars map onto an AI management system — Assess to performance evaluation (clause 9), Prevent to planning and operation (clauses 6 and 8), Prove to documented information (7.5), Detect to monitoring and improvement (9.1, 10).
- Mappings stay tool-agnostic. The phased application dates of the Act are not restated on pages.
