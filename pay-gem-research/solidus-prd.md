[PRD]
# PRD: Solidus (Stripe-first Pay Gem Port for Node/Bun/Deno)

## 1. Problem Statement and Business Context

The Ruby `pay` gem gives Rails teams a highly opinionated and low-friction way to ship billing with Stripe. There is no equivalent in the Node ecosystem that combines this level of developer ergonomics, subscription lifecycle coverage, and webhook-driven projection sync in one cohesive library.

Goal: create `solidus`, a Stripe-first library for JavaScript runtimes that delivers Pay-like feature completeness while initially constraining ecosystem compatibility to reduce delivery risk.

Initial compatibility constraints (intentional):
- Provider: Stripe only
- Backend integration: Express only
- ORM integration: sequelize-typescript only

Strategic intent:
- Make Solidus the practical "Pay gem alternative" for Node teams.
- Preserve opinionated defaults and convenience APIs.
- Keep architecture extensible for future providers/frameworks/ORMs.

## 2. Goals

- Achieve Stripe feature parity with Pay's existing Stripe capabilities (documented in `pay-gem-research/stripe-feature-inventory.md`).
- Provide a minimal setup path for Express + sequelize-typescript apps.
- Preserve data consistency through webhook-first sync and idempotent processing.
- Support Node, Bun, and Deno runtime usage with clear compatibility guidance.
- Provide execution-ready docs, examples, and diagnostics for maintainers and users.

## 3. Non-Goals

- Supporting non-Stripe providers in v1.
- Supporting non-Express backends in v1.
- Supporting non-sequelize-typescript ORMs in v1.
- Building a full hosted billing UI.
- Implementing every Rails-specific convenience exactly as in Pay (route auto-mount, generators parity, mailer/view behavior) if equivalent TS patterns are cleaner.

## 4. Personas and Stakeholders

- Primary: Full-stack TypeScript developer building SaaS billing.
- Secondary: Maintainer using LLMs to extend/maintain Solidus.
- Secondary: Platform engineer responsible for reliability/operations.
- Secondary: Product owner needing robust subscription states and lifecycle behavior.

## 5. Scope

### In Scope

- Customer declaration API (Pay-like `pay_customer` equivalent via explicit registration).
- Payment methods add/update/default and webhook sync.
- Charges, authorizations, capture/refunds, receipt metadata.
- Subscription lifecycle: create, cancel, cancel_now, resume, swap, quantity change, pause/unpause, grace period and state helpers.
- SCA/action-required flows.
- Checkout session helpers and Billing Portal helpers.
- Webhook ingestion pipeline and full mapped Stripe event handling.
- Metered billing and meter event reporting.
- Stripe Tax-enabling pass-through support and tax persistence fields.
- Stripe Connect merchant/account support required for Pay parity.
- Custom webhook subscribers (subscribe/unsubscribe).
- Sequelize schema/migrations for all billing projections.
- Runtime compatibility baseline for Node/Bun/Deno.

### Out of Scope (v1)

- Multi-provider abstraction surface exposed to end users.
- Non-Express framework adapters (Nest/Fastify/Hono/etc).
- UI component kit.
- Dashboard/admin frontend.

## 6. Quality Gates

These quality checks must pass for every implementation story:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration` (Stripe test-mode integration suite)

Compatibility gates per release candidate:

- `pnpm test:runtime:node`
- `pnpm test:runtime:bun`
- `pnpm test:runtime:deno`

Security/reliability gates:

- Verify webhook signature tests (valid, invalid, wrong secret, mutated body).
- Verify webhook idempotency tests (duplicate event delivery).
- Verify async processing retry/dead-letter behavior.

## 7. Functional Requirements

- FR-1: The system must let developers declare/register a customer model and resolve owner records safely.
- FR-2: The system must support explicit processor assignment semantics equivalent to Pay's default customer behavior.
- FR-3: The system must create or retrieve Stripe customers and sync profile attributes.
- FR-4: The system must support payment method attach/update/default/detach and local projection sync.
- FR-5: The system must support one-time charges, authorization/capture, and refunds (full/partial).
- FR-6: The system must support subscription creation with plan/price, items, quantity, and passthrough Stripe options.
- FR-7: The system must support subscription lifecycle operations: cancel, immediate cancel, resume, swap, quantity change, pause/unpause, retry failed payments.
- FR-8: The system must expose state helpers equivalent to Pay semantics (subscribed, on_trial, on_grace_period, paused, active).
- FR-9: The system must support Stripe Checkout session creation for payment/setup/subscription modes.
- FR-10: The system must support Stripe Billing Portal session creation.
- FR-11: The system must support SCA flows and action-required errors with enough metadata for app-level continuation.
- FR-12: The system must provide an Express webhook integration with Stripe signature verification using raw body.
- FR-13: The system must persist incoming webhooks then process asynchronously with idempotency.
- FR-14: The system must implement all mapped Stripe webhook handlers from Pay for charges/subscriptions/customers/payment methods/checkout/account updates.
- FR-15: The system must provide event subscription APIs for custom webhook listeners.
- FR-16: The system must support metered billing events and tax-relevant persistence fields.
- FR-17: The system must support Stripe Connect merchant/account workflows for parity.
- FR-18: The system must expose diagnostics for missing config, missing required webhook events, and processing failures.

## 8. Non-Functional Requirements

- NFR-1 Reliability: webhook processing is at-least-once safe via idempotent handlers.
- NFR-2 Reliability: no event loss between receipt and async processing (persist-first design).
- NFR-3 Security: strict Stripe signature verification and secret management.
- NFR-4 Security: PII minimization and explicit logging redaction rules.
- NFR-5 Performance: webhook ACK latency target p95 < 300ms before async processing.
- NFR-6 Performance: projection update after event processing p95 < 2s in default worker mode.
- NFR-7 Observability: structured logs, metrics, and trace hooks for key lifecycle operations.
- NFR-8 Portability: runtime compatibility matrix for Node/Bun/Deno with published caveats.
- NFR-9 Maintainability: simple APIs, minimal advanced typing, docs-first patterns.

## 9. UX/DX Constraints

- Configuration must be explicit and fail-fast on boot when required keys are missing.
- Quick-start path should be < 20 minutes from install to first successful Stripe test webhook.
- API naming should stay close to Pay mental model where possible (`subscribe`, `charge`, `billingPortal`, etc).
- No hidden global patching or reflection-based model magic in v1.
- Provide copy/paste recipes for common flows (checkout, billing portal, webhook setup, SCA retry).

## 10. Milestones, Tasks, and Subtasks

### Milestone M1: Foundation and Data Model

#### Task M1-T1: Package skeleton and core contracts
- Subtasks:
  - Create package structure: `core`, `stripe`, `express`, `sequelize`, facade.
  - Define core interfaces (customer registry, repositories, queue adapter, event bus).
  - Define error taxonomy (`ActionRequiredError`, `ProviderError`, etc).
- Verification:
  - Compile and typecheck all packages.
  - Contract tests for interface behavior with fake adapters.
- Definition of Done:
  - Public API docs generated for core contracts.

#### Task M1-T2: Sequelize schema and migrations
- Subtasks:
  - Implement models for customers, subscriptions, charges, payment methods, webhooks, merchants.
  - Add unique constraints and indexes for idempotency and default semantics.
  - Ship migration templates and integration instructions.
- Verification:
  - Migration up/down tests on PostgreSQL.
  - Constraint tests (duplicate processor_id/event_id prevention).
- Definition of Done:
  - ERD and schema docs published.

#### Task M1-T3: Registration API (`pay_customer` equivalent)
- Subtasks:
  - Implement `registerCustomerModel` API.
  - Implement owner resolution and client-reference safety helpers.
  - Add examples for User model integration.
- Verification:
  - Unit tests for registration, default selection, owner resolution failures.
- Definition of Done:
  - API docs include migration guidance from Pay semantics.

### Milestone M2: Stripe Customer, Payment Method, Charge, Subscription APIs

#### Task M2-T1: Stripe customer service
- Subtasks:
  - Implement create/retrieve/update customer API logic.
  - Support configurable customer attributes mapping.
  - Add reconciliation helper entry points.
- Verification:
  - Integration tests with Stripe test mode for create/update flows.
- Definition of Done:
  - Reconciliation caveats documented.

#### Task M2-T2: Payment method management
- Subtasks:
  - Implement add/update/default logic.
  - Persist normalized payment method summary + raw payload.
  - Implement detach cleanup.
- Verification:
  - Integration tests for default method switching and detached method cleanup.
- Definition of Done:
  - Cookbook example for SetupIntent + attach flow published.

#### Task M2-T3: Charges and refunds
- Subtasks:
  - Implement `charge`, `authorize`, `capture`, `refund` APIs.
  - Persist receipt URL, tax fields, refund totals, payment method snapshots.
  - Wrap Stripe exceptions into Solidus errors.
- Verification:
  - Integration tests: successful charge, failed charge, partial refund, multiple refunds.
- Definition of Done:
  - Error handling guide and retry guidance published.

#### Task M2-T4: Subscription lifecycle
- Subtasks:
  - Implement create/cancel/cancelNow/resume/swap/changeQuantity/pause/unpause.
  - Implement state helpers and period calculations.
  - Implement retry failed payment and open invoice payment helpers.
- Verification:
  - Integration tests for lifecycle transitions and SCA-required transitions.
- Definition of Done:
  - State machine table documented.

### Milestone M3: Webhooks and Async Processing

#### Task M3-T1: Express webhook adapter
- Subtasks:
  - Implement router factory + route-local raw body middleware.
  - Verify signature with multiple webhook secrets support.
  - Add clear startup/runtime diagnostics for misconfiguration.
- Verification:
  - Tests for valid/invalid signatures, missing headers, wrong secret, parsed body failure.
- Definition of Done:
  - Ready-to-copy Express setup docs published.

#### Task M3-T2: Persist-first webhook pipeline + queue adapter
- Subtasks:
  - Persist incoming events with idempotency keys.
  - Implement `inline` and `db-outbox` processing adapters.
  - Add retry and dead-letter behavior.
- Verification:
  - Tests for duplicate events, transient handler errors, retry/backoff behavior.
- Definition of Done:
  - Operational runbook for stuck/retrying webhooks published.

#### Task M3-T3: Stripe event handler parity implementation
- Subtasks:
  - Implement handlers for all events listed in `pay-gem-research/stripe-webhook-map.md`.
  - Implement custom subscriber API (subscribe/unsubscribe/all).
  - Ensure no duplicate notifications/side effects where Pay suppresses them.
- Verification:
  - Event-by-event integration tests with fixture payloads.
- Definition of Done:
  - Coverage matrix shows all mapped events implemented.

### Milestone M4: Checkout, SCA, Metered Billing, Tax, Connect

#### Task M4-T1: Checkout and Billing Portal APIs
- Subtasks:
  - Implement checkout helper for payment/setup/subscription modes.
  - Support success/cancel URL helpers and session id propagation helper.
  - Implement billing portal session helper.
- Verification:
  - Integration tests per mode.
- Definition of Done:
  - Example app walkthrough covers checkout completion + webhook sync.

#### Task M4-T2: SCA and action-required workflow
- Subtasks:
  - Implement `ActionRequiredError` mapping.
  - Provide continuation contract (`paymentIntentId`, `clientSecret`, recommended next action).
  - Publish Express-oriented confirmation flow recipes.
- Verification:
  - Integration tests with SCA-required test cards.
- Definition of Done:
  - Troubleshooting section for common SCA failures published.

#### Task M4-T3: Metered billing and tax
- Subtasks:
  - Implement meter event APIs.
  - Support automatic tax options and tax field persistence.
  - Add migration notes for usage-records-to-meters path.
- Verification:
  - Integration tests for meter event creation and taxed invoice projections.
- Definition of Done:
  - Tax + metering cookbook docs published.

#### Task M4-T4: Stripe Connect parity
- Subtasks:
  - Implement merchant model and account flows.
  - Implement account onboarding and status update handling.
  - Implement transfer helpers where applicable.
- Verification:
  - Integration tests for account creation/onboarding status sync.
- Definition of Done:
  - Connect feature parity checklist signed off.

### Milestone M5: Runtime Compatibility, Observability, and Release

#### Task M5-T1: Node/Bun/Deno compatibility hardening
- Subtasks:
  - Add runtime CI matrix.
  - Isolate Node-specific code paths in adapters.
  - Publish compatibility caveats and supported versions.
- Verification:
  - Runtime matrix tests green.
- Definition of Done:
  - Compatibility table in docs published.

#### Task M5-T2: Observability and operations
- Subtasks:
  - Add structured logging and metric hooks.
  - Add health diagnostics and webhook lag metrics.
  - Add runbooks for secret rotation and outage handling.
- Verification:
  - Smoke tests for emitted metrics/log fields.
- Definition of Done:
  - Operations section included in docs.

#### Task M5-T3: Packaging and release process
- Subtasks:
  - Finalize facade package APIs and versioning policy.
  - Ship migration guide from ad hoc Stripe integrations.
  - Publish first stable release candidate.
- Verification:
  - End-to-end example app in CI.
- Definition of Done:
  - Release notes and upgrade guide published.

## 11. Dependencies

- Stripe API keys and webhook secrets for test and production.
- Express app configured to preserve raw request body for webhook route.
- Database for projections and webhook queue/outbox.
- Worker process or scheduler for async webhook processing.
- CI support for Node/Bun/Deno matrix.

## 12. Risks and Mitigations

- Risk: webhook signature verification breaks due to middleware ordering.
  - Mitigation: route-local raw parser helper + startup warning if global parser conflicts detected.
- Risk: race conditions between checkout completion and webhook processing.
  - Mitigation: explicit sync APIs and eventual consistency-safe docs.
- Risk: Deno/Bun incompatibilities with npm ecosystem pieces.
  - Mitigation: runtime-isolated adapters and compatibility tests.
- Risk: Connect parity increases scope significantly.
  - Mitigation: phase-gated delivery with explicit feature flags if needed.
- Risk: over-complex typings reduce maintainability.
  - Mitigation: keep interfaces small; rely on inference and practical types.

## 13. Acceptance Criteria (Release-Level)

- AC-1: All Stripe capabilities listed in `pay-gem-research/stripe-feature-inventory.md` are implemented or explicitly marked deferred with documented rationale.
- AC-2: All events in `pay-gem-research/stripe-webhook-map.md` have handler implementations and tests.
- AC-3: Express integration works with copy/paste quickstart and verified webhook signature checks.
- AC-4: sequelize-typescript migrations apply cleanly and schema invariants hold.
- AC-5: Node/Bun/Deno compatibility matrix passes for documented support tier.
- AC-6: Public docs include setup, troubleshooting, reconciliation, and operations runbook.

## 14. Rollout and Rollback Plan

### Rollout

- Stage 1: private alpha with one internal app and Stripe test mode.
- Stage 2: public beta with strict semver pre-release tags and migration notes.
- Stage 3: stable release once parity and reliability gates pass.

### Rollback

- Keep feature flags for async processing strategy (`inline` vs `db-outbox`).
- Keep webhook handler toggles for emergency disable.
- Maintain reversible migrations for new optional tables/columns in beta period.

## 15. Open Questions

- OQ-1: Should Stripe Connect be mandatory for v1 GA parity, or allowed as v1.1 with formal defer criteria?
- OQ-2: Should Solidus include a built-in email adapter, or remain notification-hook-only in v1?
- OQ-3: What minimum Deno support tier is acceptable (core-only vs full Express adapter behavior via npm compatibility)?
- OQ-4: Should a CLI scaffolder (`solidus init`) ship in v1 or immediately after v1?

## 16. Decision Log

- D-1: Use explicit model registration instead of decorators/metaprogramming.
- D-2: Use router factory + explicit Express mount instead of auto-route behavior.
- D-3: Use persist-first webhook architecture with idempotent async processing.
- D-4: Keep scope constrained to Stripe + Express + sequelize-typescript for v1.
- D-5: Prefer simple maintainable TypeScript patterns over advanced typing abstractions.

## 17. Research Links

- `pay-gem-research/stripe-feature-inventory.md`
- `pay-gem-research/stripe-webhook-map.md`
- `pay-gem-research/rails-to-node-porting-notes.md`

[/PRD]
