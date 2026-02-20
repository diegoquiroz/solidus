# Not Portable from Rails

This document calls out Pay-on-Rails behaviors that are intentionally not first-party portable to Solidus.

## Scope boundaries

- Solidus is Stripe-first in this milestone; non-Stripe processors are out of scope.
- Solidus docs and defaults target Express + Sequelize operational paths.
- Rails callback chains, ActiveRecord lifecycle hooks, and controller conventions are not reproduced.

## Behavior differences to plan for

- No automatic Rails model inference: register owner/customer mappings explicitly in app wiring.
- No implicit customer auto-link at registration time: use reconciliation APIs (`reconcileByEmail` or `reconcileByProcessorId`).
- No ActionMailer-equivalent built in: notification effects are hooks you connect to your own mail/queue system.
- No Rails migration DSL portability: use your SQL/migration tooling and apply artifacts from `packages/sequelize/migrations/templates`.
- No framework-agnostic webhook middleware bundle in this milestone: Express route ordering is explicit and required.

## Operational differences

- Persist-first ingest and db-outbox queueing are first-class, while in-process callback assumptions from Rails apps should be treated as non-portable.
- Live/test event gating and secret rotation are explicit policy/config tasks, not implicit environment magic.

## What to do during migration

- Keep legacy code path toggles until projection parity is verified.
- Use the canonical quickstart as the integration baseline: `docs/getting-started.md`.
- Use domain docs for replacement flows:
  - `docs/pay-customers.md`
  - `docs/pay-payment-methods.md`
  - `docs/pay-charges.md`
  - `docs/pay-subscriptions.md`
  - `docs/pay-webhooks.md`
