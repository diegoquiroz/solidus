# Rails -> Node/Bun/Deno Porting Notes

This document captures the architectural translation from Pay (Rails) patterns to Solidus (TypeScript).

## Design principles

- Prefer explicit APIs over metaprogramming.
- Keep core framework-agnostic; isolate Express and Sequelize concerns.
- Preserve Pay's "convenience + opinionated defaults" DX.
- Keep internals simple and debuggable for LLM-assisted maintenance.

## Recommended package boundaries

- `@solidus/core`
  - Domain contracts, processor registry, event bus, errors, idempotency primitives.
- `@solidus/stripe`
  - Stripe gateway client, event verification, Stripe->domain mapping.
- `@solidus/express`
  - Router factory, middleware, webhook endpoint wiring.
- `@solidus/sequelize`
  - sequelize-typescript models, repositories, migrations helpers.
- `solidus`
  - Unified facade and batteries-included defaults.

## Pattern mapping

- Rails concern macro (`pay_customer`) -> `registerCustomerModel(Model, config)`.
- Rails engine routes auto-mount -> explicit `app.use('/solidus', createSolidusRouter(solidus))`.
- ActiveJob -> job adapter interface:
  - `inline` (dev/test)
  - `db-outbox` (default production)
  - optional external queue adapter (BullMQ, etc).
- ActiveSupport::Notifications delegator -> typed event emitter with subscribe/unsubscribe.
- Rails generators -> `solidus init` scaffolder (optional but high DX).

## Decision log (major API choices)

1) Customer declaration API
- Options considered:
  - Decorator-based model annotations.
  - Explicit registration function.
  - Convention-over-configuration model scanning.
- Decision: explicit registration function.
- Why: runtime portable, easier to test, no decorator/compiler pitfalls.

2) Webhook integration
- Options considered:
  - Auto-mount route magic.
  - Router factory with explicit mount.
  - Low-level middleware only.
- Decision: explicit router factory + low-level helper.
- Why: preserves control in Express apps and keeps behavior obvious.

3) Background processing
- Options considered:
  - Inline only.
  - Queue adapter abstraction with default implementations.
  - Hard dependency on external queue.
- Decision: queue adapter abstraction with `inline` and `db-outbox` built-ins.
- Why: reliable by default, no Redis requirement for first-time adopters.

## Runtime compatibility strategy (Node/Bun/Deno)

- Build ESM-first package with conditional exports.
- Keep Node-only APIs out of core package.
- Treat Express adapter as Node/Bun targeted initially; provide Deno guidance via npm compatibility path.
- Add CI matrix for:
  - Node LTS
  - Bun stable
  - Deno stable (at least for core + Stripe service layer tests)

References:
- Bun Express compatibility docs: `https://bun.com/docs/guides/ecosystem/express`
- Deno Node/npm compatibility docs: `https://docs.deno.com/runtime/fundamentals/node/`

## Data modeling guidance

Match Pay table semantics, using normalized columns + JSON payload snapshots:

- customers
- subscriptions
- charges
- payment_methods
- webhooks
- merchants (for Stripe Connect parity)

Recommended invariants:

- Unique `(processor, processor_id)`.
- At most one default customer per owner.
- At most one default payment method per customer.
- Webhook event idempotency unique key (`processor`, `event_id`).

## Error taxonomy to preserve Pay-like DX

- `SolidusError` (base)
- `ProviderError` (wrap Stripe SDK errors)
- `ActionRequiredError` (SCA/3DS continuation required)
- `ConfigurationError` (missing secret, invalid setup)
- `SignatureVerificationError` (webhook signature invalid)
- `IdempotencyConflictError` (duplicate processing edge cases)

## What cannot be ported 1:1

- Rails auto route mounting and initializer hooks.
- Rails ActionMailer defaults and view generators.
- ActiveRecord callbacks and polymorphic conveniences.

Replacement approach:

- Explicit setup API + clear docs snippets.
- Optional mailer adapter hooks or callback events.
- Sequelize model registries and repository abstractions.
