[PRD]
# PRD: Solidus Stripe Parity Gap Closure v1

## Problem Statement And Business Context

Solidus has strong Stripe API and webhook scaffolding coverage, but it is not yet turnkey for production app adoption. The remaining gaps are concentrated in persistence wiring (Sequelize adapter), default webhook projection effects, and a few behavior mismatches against Pay gem semantics. Without closing these, teams must build critical glue code themselves and risk inconsistent billing state.

This initiative delivers a production-ready Stripe-first baseline (Express + sequelize-typescript) that preserves Solidus's webhook-first and idempotent architecture while reducing implementation burden for adopters.

## Goals

- Deliver first-party Sequelize repositories that satisfy core contracts used by facade and webhook pipelines.
- Provide default webhook effects so Stripe events can sync domain projections out of the box.
- Improve integrator ergonomics with owner-centric, Pay-like convenience APIs for common sync flows.
- Close known Stripe parity mismatches that materially impact behavior and operator expectations.
- Ship verification coverage (unit + integration) and operational docs required for confident app integration.

## Non-Goals

- Adding new payment providers beyond Stripe.
- Supporting frameworks beyond Express in this milestone set.
- Building productized UI/admin console for billing operations.
- Large schema redesigns not required to satisfy current contract fields.

## Personas And Stakeholders

- App integrator (TypeScript backend engineer): needs drop-in billing primitives with minimal custom glue.
- Platform maintainer (Solidus contributor): needs stable APIs and predictable extension points.
- Ops/on-call engineer: needs replayable webhook operations, observability, and reliable error handling.
- Product owner: needs parity confidence before replacing Pay gem behavior in production workflows.

## Scope

### In Scope

- Sequelize adapter implementation for required repositories and idempotency/event persistence.
- Schema alignment updates for contract-backed records and migrations/docs.
- Default webhook effects package/wiring for customer/payment method/charge/subscription/invoice sync.
- Ergonomic facade helpers for owner-centric processor setup and sync convenience workflows.
- First-class connected-account context flow for per-customer Stripe account scoping.
- Stripe parity fixes: paused subscription semantics, pause defaults, webhook mode gating behavior, charge tax mapping correctness.
- Test coverage and docs updates for all above.

### Out Of Scope

- Multi-tenant billing orchestration features beyond current contracts.
- Non-Stripe tax or metering strategy redesign.
- Backward-incompatible core contract overhauls unless explicitly justified in ADR.

## Functional Requirements

- FR-1: System must provide concrete Sequelize repository implementations for all repositories required by facade/webhook handlers.
- FR-2: System must persist webhook deliveries, attempts, and dead-letter metadata using Sequelize-backed storage compatible with core webhook pipeline contracts.
- FR-3: System must expose default webhook effects that apply normalized Stripe events to contract projection stores without custom app code.
- FR-4: System must preserve idempotent processing semantics for replayed webhook events and duplicate deliveries.
- FR-5: Subscription state helpers must align paused behavior with Pay parity decision (paused should remain active while paused collection behavior applies).
- FR-6: Pause operation must support Pay-like default behavior when caller does not provide explicit pause behavior.
- FR-7: Express webhook adapter must support configurable live/test event acceptance policy equivalent to Pay's test-event gating.
- FR-8: Charge projection mapping must correctly populate tax fields from Stripe payloads.
- FR-9: Docs must describe adapter setup, default effects, parity caveats, and operational runbook updates.
- FR-10: Facade must provide owner-centric ergonomics comparable to Pay's processor assignment and sync conveniences (for example, set processor + sync customer/subscriptions flows) without forcing direct low-level calls.
- FR-11: Stripe request options must support first-class connected-account scoping per customer context across relevant API operations and webhook projections.

## Non-Functional Requirements

- Reliability: webhook processing must remain retry-safe and idempotent across process restarts.
- Security: webhook signature verification and connected-account context handling must remain intact.
- Performance: event ingestion and projection updates should not regress baseline test throughput by more than 10%.
- Observability: logs/metrics/traces must include repository and projection failure context for replay debugging.
- Maintainability: implementation should follow existing package boundaries and strict TypeScript typing.

## UX/DX Constraints

- Preserve current public API shape where possible; use additive defaults over breaking changes.
- Keep setup path simple: one adapter registration flow + optional policy flags.
- Keep ergonomics high: common onboarding and sync flows should require minimal custom glue and have one documented happy path.
- Reuse existing error classes and registration patterns in `src/packages/core`.
- Keep Bun-first tooling and command conventions.

## Quality Gates

These commands must pass for every user story:

- `bun run typecheck` passes
- `bun run lint` passes
- Story-specific targeted tests pass (`bun test <target>`)

For milestone completion:

- `bun test` passes
- Updated docs examples compile/run where applicable

## Milestones, User Stories, Tasks, And Sub-Tasks

### Milestone 1: Sequelize Adapter + Schema Alignment

#### US-001: Implement Sequelize repositories for core contracts
**Description:** As an app integrator, I want first-party Sequelize repositories so that Solidus can persist and query billing projections without custom infra code.

**Acceptance Criteria:**
- [ ] Implement concrete repositories in `src/packages/sequelize` covering customers, payment methods, charges, subscriptions, invoices, webhook deliveries, and idempotency records.
- [ ] Repositories satisfy `src/packages/core/contracts.ts` interfaces without `any` escapes.
- [ ] Registration path exposes ready-to-use repository bundle for facade/webhook wiring.

**Tasks/Sub-Tasks:**
- Map each contract interface to Sequelize model operations.
- Implement repository methods with transactional safety where needed.
- Add adapter export surface and typed factory.

#### US-002: Align Sequelize schema and migrations to contract fields
**Description:** As a maintainer, I want schema parity with contract records so that runtime writes are lossless and predictable.

**Acceptance Criteria:**
- [ ] Update schema/migrations/templates to include required contract fields currently missing.
- [ ] `packages/sequelize/docs/schema.md` reflects new columns and constraints.
- [ ] Existing migration naming/versioning conventions are preserved.

**Tasks/Sub-Tasks:**
- Diff contract record fields vs current schema artifacts.
- Add migration templates for added columns/indexes/uniques.
- Update schema docs and adapter README snippets.

#### US-003: Add adapter-level repository integration tests
**Description:** As an integrator, I want automated repository contract tests so that adapter behavior remains stable over upgrades.

**Acceptance Criteria:**
- [ ] Add tests validating CRUD + lookup + idempotency conflict behavior.
- [ ] Add tests for webhook persistence lifecycles (delivery, attempt, dead-letter).
- [ ] Test suite runs via Bun and is deterministic.

**Tasks/Sub-Tasks:**
- Create fixture setup helpers for sequelize-typescript test DB.
- Add contract-oriented test cases per repository.
- Wire tests into package-level test scripts.

### Milestone 2: Default Webhook Effects + Turnkey Sync

#### US-004: Provide default webhook effects package
**Description:** As an app integrator, I want default webhook effects so that Stripe events project into local state without custom effect authoring.

**Acceptance Criteria:**
- [ ] Introduce default effects module that maps normalized webhook events to projection repository writes.
- [ ] Effects cover customer, payment method, charge/refund, invoice, and subscription projections.
- [ ] Effects preserve idempotent semantics for duplicate events.

**Tasks/Sub-Tasks:**
- Define event-to-projection handlers with minimal branching.
- Reuse existing Stripe normalization outputs.
- Add effect-level unit tests for event classes.

#### US-005: Wire default effects into facade/express setup path
**Description:** As an app integrator, I want a simple setup path so that default sync works with minimal configuration.

**Acceptance Criteria:**
- [ ] Facade/Express docs include one canonical setup using Sequelize adapter + default effects.
- [ ] Registration supports opting into default effects without breaking custom overrides.
- [ ] Connected account context is propagated through default effect handlers.

**Tasks/Sub-Tasks:**
- Add additive registration option and defaults.
- Validate propagation of account-scoped identifiers.
- Update docs and smoke example.

#### US-006: Add end-to-end webhook sync integration coverage
**Description:** As a maintainer, I want E2E webhook sync tests so that turnkey behavior remains regression-safe.

**Acceptance Criteria:**
- [ ] Add integration tests from signed webhook ingress through persisted projection state.
- [ ] Add replay test proving duplicate webhook event does not duplicate side effects.
- [ ] Add failure/retry test proving dead-letter path captures terminal failures.

**Tasks/Sub-Tasks:**
- Extend integration fixtures for webhook payload sets.
- Assert projection state for key event types.
- Assert retry counters and dead-letter records.

#### US-013: Add owner-centric ergonomics and sync convenience APIs
**Description:** As an app integrator, I want Pay-like convenience methods so that common processor setup and sync workflows are fast and low-risk.

**Acceptance Criteria:**
- [ ] Facade exposes a clear owner-centric processor setup flow equivalent to "set payment processor" behavior for Stripe.
- [ ] Facade exposes convenience sync methods for customer and subscription reconciliation workflows.
- [ ] API docs include migration mapping from Pay idioms to Solidus equivalents with examples.

**Tasks/Sub-Tasks:**
- Design additive facade methods that preserve existing public API compatibility.
- Implement convenience methods by composing existing core/stripe primitives.
- Add unit/integration tests and docs examples for each convenience path.

#### US-014: Add first-class per-customer connected-account request context
**Description:** As a marketplace integrator, I want customer-scoped connected-account context applied automatically so cross-account billing calls are correct by default.

**Acceptance Criteria:**
- [ ] Repository and facade flows can persist/read per-customer connected-account context where configured.
- [ ] Stripe API calls use the correct connected-account request options derived from customer context.
- [ ] Tests verify account context propagation across create/update/sync flows and webhook projection updates.

**Tasks/Sub-Tasks:**
- Define minimal context model and lookup strategy for customer-scoped account routing.
- Apply request-option resolution in Stripe client wrapper/facade paths.
- Add regression tests for account context leakage and incorrect scoping.

### Milestone 3: Stripe Parity Behavior Corrections

#### US-007: Align paused subscription semantics with parity decision
**Description:** As a product owner, I want paused subscriptions to behave predictably so that reports and entitlement checks match Pay expectations.

**Acceptance Criteria:**
- [ ] Subscription active-state derivation for paused subscriptions matches documented parity decision.
- [ ] Regression tests cover paused lifecycle transitions.
- [ ] Docs call out final semantics clearly.

**Tasks/Sub-Tasks:**
- Update state helper logic in Stripe mapping layer.
- Add unit tests for active/canceled/past-due/paused combinations.
- Update parity checklist documentation.

#### US-008: Add default pause behavior parity
**Description:** As an integrator, I want pause operations to have sensible defaults so that behavior matches Pay-style ergonomics.

**Acceptance Criteria:**
- [ ] Pause API supports omission of explicit behavior and applies documented default.
- [ ] Existing explicit behavior input remains supported.
- [ ] Tests cover default and explicit pause behavior paths.

**Tasks/Sub-Tasks:**
- Implement defaulting in pause API wrapper.
- Validate outgoing Stripe payload.
- Add API contract tests.

#### US-009: Add configurable webhook live/test event gating
**Description:** As an operator, I want to configure test-event acceptance policy so that production endpoints enforce desired event modes.

**Acceptance Criteria:**
- [ ] Express webhook adapter supports policy flag for accepting/rejecting test events.
- [ ] Default policy is documented and backward-compatible.
- [ ] Rejected events produce observable logs/metrics and appropriate HTTP responses.

**Tasks/Sub-Tasks:**
- Add adapter option and policy check during event handling.
- Wire policy outcome to logging/telemetry hooks.
- Add adapter tests for each policy mode.

#### US-010: Correct charge tax mapping
**Description:** As a maintainer, I want tax fields mapped correctly so that revenue/tax projections are accurate.

**Acceptance Criteria:**
- [ ] Charge normalization uses correct Stripe fields for total tax amount(s).
- [ ] Tests cover charges with no tax, single tax, and multi-tax scenarios.
- [ ] Docs/examples reference final mapped fields.

**Tasks/Sub-Tasks:**
- Fix mapper implementation in Stripe projection conversion.
- Add focused unit tests for tax extraction.
- Update API docs examples if field semantics changed.

### Milestone 4: Production Readiness And Release Packaging

#### US-011: Operational hardening and runbook updates
**Description:** As on-call, I want clear operational playbooks so that webhook failures can be diagnosed and replayed quickly.

**Acceptance Criteria:**
- [ ] Runbook includes replay, dead-letter triage, and common failure signatures.
- [ ] Logging/metrics fields required for triage are documented and validated in tests where practical.
- [ ] Example app smoke flow documents expected checkpoints.

**Tasks/Sub-Tasks:**
- Update `docs/webhook-operations-runbook.md`.
- Add checklist for incident triage.
- Verify example smoke flow against latest adapter wiring.

#### US-012: Release candidate validation and upgrade guidance
**Description:** As a maintainer, I want an RC checklist so that teams can adopt v1 with predictable migration steps.

**Acceptance Criteria:**
- [ ] Publish release readiness checklist covering parity scope and known limitations.
- [ ] Update release notes/upgrade guide with adapter + default effects setup.
- [ ] Final full-suite validation artifacts are captured.

**Tasks/Sub-Tasks:**
- Update release notes with milestone outcomes.
- Produce final parity matrix delta table.
- Execute and record full validation command set.

## Dependencies

- Stripe normalization contracts and event model remain stable.
- Existing core contract interfaces remain source of truth.
- Sequelize schema artifacts in `packages/sequelize` remain migration authority.

## Risks And Mitigations

- Risk: Contract/schema drift introduces runtime write failures. Mitigation: explicit schema diff checklist + repository integration tests.
- Risk: Default effects conflict with custom integrator logic. Mitigation: additive opt-in with override hooks and docs.
- Risk: Behavior parity changes break existing adopters. Mitigation: document defaults, add compatibility flags where needed.
- Risk: Webhook policy gating misconfiguration drops needed events. Mitigation: safe default + observability warnings.

## Rollout Plan

- Phase 1: Ship Milestone 1 behind adapter package release tag.
- Phase 2: Introduce default effects as opt-in and validate in example app.
- Phase 3: Enable parity corrections with changelog notes and compatibility guidance.
- Phase 4: Publish RC checklist and stabilization patch window.

## Rollback Plan

- Keep new behavior behind additive config defaults where feasible.
- Revert to prior adapter/effects package version if regressions detected.
- Disable default effects opt-in and run webhook replay after rollback to restore projection consistency.

## Success Metrics

- 100% completion of milestone acceptance criteria with passing quality gates.
- Zero known critical parity gaps remaining from current comparison set.
- Integrator can complete setup from docs without writing custom webhook effects.
- Webhook replay and dead-letter workflows validated in integration tests and runbook.

## Open Questions

- Should paused-active parity be strict Pay compatibility by default, or configurable via flag?
- Should live/test gating default to "accept live only" in production mode, or preserve permissive backward-compatible mode?
- Is any contract field expansion needed for future Stripe tax breakdown reporting beyond current fix?
- Which exact facade method names should be used for Pay-like convenience APIs to maximize migration ergonomics?

## Decision Log

- D-001: Quality gates use Bun commands (`bun run typecheck`, `bun run lint`, `bun test`) per repository standards.
- D-002: Scope remains Stripe + Express + sequelize-typescript to match current project direction.
- D-003: Default webhook effects are additive and override-friendly to avoid breaking custom integrator behavior.
- D-004: Milestone structure prioritizes foundation first (persistence) before behavior parity and release hardening.
[/PRD]
