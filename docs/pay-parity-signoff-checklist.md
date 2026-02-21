# Pay Parity v1 Sign-off Checklist (US-014)

Use this checklist to gate parity sign-off for `projects/pay-parity-v1`.

Matrix source of truth: `docs/pay-stripe-parity-matrix.json` (version `2026-02-20`).

## Required validation commands

- [ ] `bun test`
- [ ] `bun run test:integration`
- [ ] `bun run test:example-app`
- [ ] `bun run test:runtime`

## Parity matrix entry coverage

- [ ] `customers.create-update-reconcile` (`implemented`) -> `docs/3_customers.md`, `docs/stripe-core-apis.md`
- [ ] `payment-methods.attach-default-detach` (`implemented`) -> `docs/4_payment_methods.md`, `docs/stripe-core-apis.md`
- [ ] `charges-authorize-capture-refund` (`implemented`) -> `docs/5_charges.md`, `docs/stripe-core-apis.md`
- [ ] `subscriptions-lifecycle-and-state` (`implemented`) -> `docs/6_subscriptions.md`, `docs/stripe-core-apis.md`
- [ ] `webhooks-default-effects-and-owner-linking` (`implemented`) -> `docs/7_webhooks.md`, `docs/express-webhooks.md`, `docs/stripe-webhook-coverage-matrix.md`
- [ ] `checkout-and-billing-portal` (`implemented`) -> `docs/stripe-core-apis.md`, `docs/getting-started.md`
- [ ] `metering-tax-connect` (`implemented`) -> `docs/stripe-core-apis.md`, `docs/stripe-connect-parity-checklist.md`
- [ ] `rails-convention-portability` (`non-portable`) -> `docs/not-portable-from-rails.md`

## Remaining differences and non-portable guidance

- [ ] Customer registration does not auto-link existing Stripe customers; use explicit reconciliation (`docs/stripe-core-apis.md`, `docs/not-portable-from-rails.md`).
- [ ] Rails callback/migration conventions are intentionally non-portable in this scope (`docs/not-portable-from-rails.md`).
