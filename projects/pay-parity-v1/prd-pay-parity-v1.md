[PRD]
# PRD: Solidus Pay Parity v1 (Express + Sequelize + Stripe)

## 1. Problem Statement and Business Context

Solidus already implements most Stripe primitives and webhook infrastructure, but it does not yet deliver end-to-end Pay-level adoption ergonomics for TypeScript teams. The current gap is not just feature presence; it is the combination of API ergonomics, turnkey setup, and docs-first execution that made Rails Pay successful.

This PRD defines the work required to make Solidus resemble Pay functionality as closely as possible for the supported stack (Express + Sequelize + Stripe), explicitly excluding Rails-only mechanisms that cannot be ported 1:1.

## 2. Goals

- Reach practical 100% parity with Pay Stripe capabilities for the supported runtime/framework/ORM scope.
- Deliver best-in-class DX for Express + Sequelize projects with minimal glue code.
- Close parity gaps in owner linking, model registration usage, and connected-account sync behavior.
- Produce one canonical documentation path from install to production operations.
- Keep API design simple, explicit, and strongly typed.

## 3. Non-Goals

- Multi-provider parity (Braintree, Paddle, Lemon Squeezy, fake processor) in this initiative.
- Recreating Rails engines, generators, ActionMailer, view templates, or callback magic exactly.
- Building hosted billing UI components.
- Supporting non-Express backends or non-Sequelize ORMs in this milestone.

## 4. Personas / Stakeholders

- TypeScript backend engineer integrating billing in an existing SaaS app.
- Staff/principal engineer replacing ad-hoc Stripe wrappers with Solidus.
- On-call engineer operating webhook retries and incident recovery.
- Solidus maintainer evolving parity without API churn.

## 5. Scope

### In Scope

- Ergonomics parity for customer/processor assignment and owner-centric workflows.
- Stripe webhook behavior parity including checkout owner linking and account sync effects.
- Stripe API parity improvements where helper coverage is incomplete.
- Turnkey Sequelize/Express wiring patterns and reference implementation.
- Documentation parity (installation, configuration, usage guides, troubleshooting, migration).
- Acceptance test matrix proving parity behavior.

### Out of Scope

- Rails-only route auto-mounting and view generator parity.
- Rails ActiveRecord concern injection (`pay_customer`) as runtime metaprogramming.
- Pay mailer/template system parity.

## 6. Quality Gates

These commands must pass for every user story:

- `bun run lint`
- `bun run typecheck`
- `bun test`

For stories with integration impact:

- `bun run test:integration`
- `bun run test:example-app`

For release readiness stories:

- `bun run test:runtime`

## 7. Functional Requirements

- FR-1: Solidus must provide a single, documented quickstart path to install, configure, migrate schema, mount webhooks, and execute a first successful billing flow.
- FR-2: Solidus must expose Pay-like owner ergonomics for processor assignment and sync without requiring direct low-level Stripe calls.
- FR-3: Checkout webhook processing must support owner auto-linking via client reference IDs out of the box (or explicit opt-in default documented as canonical).
- FR-4: Default webhook effects must include connected-account merchant/account status sync for `account.updated` events.
- FR-5: Customer model registration APIs must be integrated into the runtime workflows where parity semantics depend on owner resolution and client reference mapping.
- FR-6: Stripe helper APIs must cover the remaining meaningful Pay Stripe ergonomics for Express/Sequelize teams.
- FR-7: Webhook event coverage and side effects must remain parity-aligned with Pay Stripe event map.
- FR-8: Documentation must include migration mapping from Pay idioms and ad-hoc Stripe patterns to Solidus APIs.
- FR-9: Documentation must clearly separate "parity-complete", "intentionally different", and "not portable from Rails" behaviors.
- FR-10: Example app smoke flows must validate full setup and parity-critical lifecycle paths.

## 8. Non-Functional Requirements

- Reliability: persist-first webhook processing and idempotency behavior must not regress.
- Security: signature verification and event mode policy must remain explicit and safe by default.
- Observability: parity-critical paths must emit actionable logs/metrics for ingest, process, retry, and dead-letter transitions.
- Maintainability: prefer additive APIs and simple compositions over abstraction-heavy redesigns.
- Backward compatibility: no unnecessary breaking changes to existing public exports.

## 9. UX/DX Constraints

- Preserve explicit setup (no hidden global auto-magic), but provide concise convenience APIs.
- Prioritize copy-paste docs with complete code, env vars, and order-of-operations.
- Keep naming close to Pay mental model where practical (`set payment processor`, sync helpers, subscription lifecycle terms).
- Keep Sequelize integration straightforward: a default path should work without custom repository authoring for common projects.

## 10. Milestones, User Stories, Tasks, and Sub-Tasks

### Milestone M1: Ergonomics Parity Core

#### US-001: Integrate customer registration into runtime owner-linking
**Description:** As an integrator, I want `registerCustomerModel` to be used in real flows so owner resolution and checkout linking are first-class.

**Acceptance Criteria:**
- [ ] Checkout owner-link workflow can resolve owners through registered models.
- [ ] Unsafe or unknown client reference values fail with explicit typed errors.
- [ ] Tests cover valid, missing, malformed, and unknown model reference IDs.

**Tasks/Sub-Tasks:**
- Define canonical client reference encoding/decoding format for TS runtime.
- Wire registration resolution into checkout webhook owner-link execution path.
- Add regression tests and docs examples.

#### US-002: Add default checkout owner-link effect
**Description:** As an integrator, I want Pay-like owner auto-linking behavior by default for checkout completion events.

**Acceptance Criteria:**
- [ ] `checkout.session.completed` and `checkout.session.async_payment_succeeded` support owner-linking default effect.
- [ ] Owner link operation is idempotent and safe for replayed events.
- [ ] Behavior can be overridden/disabled without forking internals.

**Tasks/Sub-Tasks:**
- Implement default `linkCheckoutOwner` effect with repository updates.
- Ensure duplicate event safety and owner mismatch guardrails.
- Add integration tests with signed webhook fixtures.

#### US-003: Add default account.updated merchant sync effect
**Description:** As a marketplace integrator, I want merchant onboarding status to sync automatically from Stripe account updates.

**Acceptance Criteria:**
- [ ] Default effects include `syncAccountById` behavior for account projection updates.
- [ ] Connected-account fields needed by facade/core flows are persisted.
- [ ] Tests verify onboarding status transitions from webhook payloads.

**Tasks/Sub-Tasks:**
- Define/confirm merchant projection contract fields.
- Implement default account sync effect + repository mapping.
- Add unit and integration coverage.

#### US-004: Complete Pay-like convenience API surface for Stripe-first workflows
**Description:** As an app developer, I want high-level methods for common billing actions with minimal boilerplate.

**Acceptance Criteria:**
- [ ] Convenience API inventory is parity-reviewed against Pay Stripe customer/subscription ergonomics.
- [ ] Missing high-value helpers are implemented or explicitly documented as intentional differences.
- [ ] Migration table maps Pay idioms to Solidus convenience methods.

**Tasks/Sub-Tasks:**
- Produce parity table of existing vs missing helper methods.
- Implement additive helper methods where gaps are confirmed.
- Document intentional TS-native differences.

### Milestone M2: Stripe Compatibility Parity

#### US-005: Stripe behavior parity audit and closure
**Description:** As a maintainer, I want a deterministic parity matrix so Stripe compatibility claims are test-backed.

**Acceptance Criteria:**
- [ ] A machine-readable parity matrix maps each Pay Stripe capability to Solidus implementation status.
- [ ] Every "missing" entry has an execution story or explicit defer rationale.
- [ ] Matrix is linked from top-level docs.

**Tasks/Sub-Tasks:**
- Build parity matrix from `pay-gem-research/stripe-feature-inventory.md`.
- Reconcile against current code and tests.
- Track closure through milestone issues.

#### US-006: Fill remaining Stripe API helper gaps
**Description:** As an integrator, I want Stripe helper coverage that avoids dropping to raw SDK for common Pay-equivalent flows.

**Acceptance Criteria:**
- [ ] Gap helpers identified in US-005 are implemented with typed APIs.
- [ ] Helpers align with existing error taxonomy (`ActionRequiredError`, `ProviderError`, etc.).
- [ ] Integration tests validate helper behavior against Stripe test mode where feasible.

**Tasks/Sub-Tasks:**
- Implement helper methods and repository projection updates.
- Add contract tests and integration tests.
- Update docs cookbook examples.

#### US-007: Preserve parity-critical webhook semantics
**Description:** As an operator, I want parity-critical webhook semantics to stay stable during feature additions.

**Acceptance Criteria:**
- [ ] Subscriber suppression behavior for duplicate-side-effect events remains preserved.
- [ ] Required event diagnostics remain accurate.
- [ ] Replay behavior remains idempotent across newly added effects.

**Tasks/Sub-Tasks:**
- Extend webhook parity integration suite.
- Add replay tests for new default effects.
- Update coverage matrix docs.

### Milestone M3: Documentation Parity and Developer Onboarding

#### US-008: Publish canonical Quickstart and Installation docs
**Description:** As a first-time user, I want one guide that gets me from zero to first successful charge/subscription with webhooks.

**Acceptance Criteria:**
- [ ] README links a single canonical quickstart.
- [ ] Quickstart includes env vars, Stripe setup, migrations, repository wiring, facade setup, and webhook mount order.
- [ ] Quickstart includes "expected outputs" validation checkpoints.

**Tasks/Sub-Tasks:**
- Create `docs/getting-started.md`.
- Refactor README to route users by journey.
- Validate snippets via smoke tests.

#### US-009: Publish Pay-style usage docs by domain
**Description:** As an integrator migrating from Pay, I want dedicated docs for customers, payment methods, charges, subscriptions, and webhooks.

**Acceptance Criteria:**
- [ ] Docs structure mirrors Pay mental model for discoverability.
- [ ] Each domain page includes copy-ready examples and caveats.
- [ ] Cross-links cover SCA, checkout, metering, tax, and connect.

**Tasks/Sub-Tasks:**
- Create domain docs set under `docs/`.
- Add migration mapping callouts on each page.
- Add troubleshooting sections per domain.

#### US-010: Publish explicit "Not Portable from Rails" guide
**Description:** As a migrating team, I want clear guidance on what cannot or should not be ported 1:1.

**Acceptance Criteria:**
- [ ] Guide lists Rails-only features and TS-native alternatives.
- [ ] No ambiguous parity claims remain in public docs.
- [ ] Guide is referenced from README, migration docs, and release notes.

**Tasks/Sub-Tasks:**
- Author rails-vs-ts compatibility matrix.
- Document recommended replacements for each non-portable behavior.
- Add decision log references.

#### US-011: Publish Sequelize/Express production hardening guide
**Description:** As an on-call owner, I want operational docs tailored to the supported stack.

**Acceptance Criteria:**
- [ ] Guide covers deployment topology, worker setup, retries, replay, dead-letter triage, and secret rotation.
- [ ] Includes live/test mode policy recommendations for production.
- [ ] Includes rollback toggles and incident checklists.

**Tasks/Sub-Tasks:**
- Consolidate runbook + express docs into a stack-specific ops path.
- Add explicit production defaults and anti-pattern warnings.
- Validate with example app scenarios.

### Milestone M4: Turnkey Sequelize/Express DX

#### US-012: Provide first-party Sequelize reference implementation path
**Description:** As an integrator, I want a default repository/model implementation path that works out of the box.

**Acceptance Criteria:**
- [ ] Solidus provides a documented default implementation path, not only delegate wrappers.
- [ ] Setup does not require writing boilerplate delegates for common use cases.
- [ ] Tests validate the default path end-to-end.

**Tasks/Sub-Tasks:**
- Add first-party Sequelize model/repository package or reference module.
- Ensure migrations/schema align with runtime contracts.
- Add integration and smoke validation.

#### US-013: Expand example app to parity scenarios
**Description:** As a user evaluating adoption, I want an executable reference app covering key Pay-style flows.

**Acceptance Criteria:**
- [ ] Example app covers processor assignment, checkout, SCA action-required, subscription lifecycle, webhook replay.
- [ ] Example docs explain expected state transitions in projections.
- [ ] Example scripts run in CI.

**Tasks/Sub-Tasks:**
- Add scenario scripts and fixture data.
- Add assertions for projection state and observability hooks.
- Wire into CI validation.

### Milestone M5: Release Readiness and Parity Sign-Off

#### US-014: Parity acceptance suite and sign-off
**Description:** As a maintainer, I want objective sign-off criteria that confirm parity completion.

**Acceptance Criteria:**
- [ ] Release checklist includes all parity matrix entries.
- [ ] All parity stories pass quality gates and integration suites.
- [ ] Remaining differences are documented as intentional or non-portable.

**Tasks/Sub-Tasks:**
- Build parity sign-off checklist artifact.
- Run full validation suite and capture output artifact.
- Update release notes and migration guide.

## 11. Dependencies

- Stripe test-mode account, API keys, and webhook secrets.
- Stable Sequelize schema migration pipeline.
- CI runtime matrix support for Node/Bun/Deno smoke commands.
- Maintained fixture parity with Pay webhook event catalog.

## 12. Risks and Mitigations

- Risk: scope inflation from "100% parity" interpretation.
  - Mitigation: strict parity matrix with portable-vs-non-portable classification.
- Risk: introducing breaking API changes while improving ergonomics.
  - Mitigation: additive APIs and deprecation windows.
- Risk: default effects cause unexpected side effects in existing adopters.
  - Mitigation: explicit feature flags, migration notes, and replay-safe rollout.
- Risk: docs drift from implementation.
  - Mitigation: snippet smoke tests and docs ownership in release gate.

## 13. Acceptance Criteria (Release-Level)

- AC-1: All Stripe capabilities from Pay research are either implemented or documented as non-portable with rationale.
- AC-2: Checkout owner-link and account sync parity behaviors are implemented and tested.
- AC-3: Integrator can complete full setup from docs without custom glue in the common Sequelize/Express path.
- AC-4: Parity matrix, migration guide, and non-portable guide are published and cross-linked.
- AC-5: End-to-end and runtime quality gates pass.

## 14. Rollout and Rollback Plan

### Rollout

- Phase 1: Ship new ergonomics/effects behind explicit config toggles.
- Phase 2: Validate on one internal app using production-like webhook traffic.
- Phase 3: Promote toggles to recommended defaults in docs after stability window.
- Phase 4: Publish parity sign-off release candidate.

### Rollback

- Disable new default effects through config flags.
- Keep webhook ingestion and idempotency pipeline active to avoid data loss.
- Replay impacted events after remediation.
- Fall back to previous facade wiring while preserving projection data.

## 15. Open Questions

- OQ-1: Should turnkey Sequelize implementation ship as core package content or companion reference package?
- OQ-2: Which missing helper methods from Pay should be considered mandatory for parity vs optional for DX?
- OQ-3: Should owner auto-link defaults be enabled by default or opt-in in first release?
- OQ-4: What semver policy will govern deprecating interim APIs added during parity closure?

## 16. Decision Log

- D-1: Parity target is Pay Stripe behavior for supported stack, not Rails infrastructure parity.
- D-2: Explicit TS APIs are preferred over metaprogramming to preserve portability and debuggability.
- D-3: Docs and ergonomics are first-class parity dimensions, not post-implementation tasks.
- D-4: Non-portable Rails features must be documented with direct TS alternatives.

## 17. Evidence Trail (Findings -> Decisions)

- Finding: owner-link and account sync hooks exist but default effect implementations are incomplete.
  - Evidence: `src/packages/stripe/webhooks.ts`, `src/packages/stripe/default-webhook-effects.ts`.
  - Decision: prioritize US-002 and US-003.
- Finding: registration API exists but is mostly test/docs-only in current runtime paths.
  - Evidence: `src/packages/core/registration.ts`, `src/packages/core/__tests__/registration.test.ts`.
  - Decision: prioritize US-001.
- Finding: docs are extensive but fragmented; README is not onboarding-complete.
  - Evidence: `README.md`, `docs/facade-api.md`, `docs/express-webhooks.md`, `docs/stripe-core-apis.md`.
  - Decision: prioritize M3 documentation parity milestones.

[/PRD]
