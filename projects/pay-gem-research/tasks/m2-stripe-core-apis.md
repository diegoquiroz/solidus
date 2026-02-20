# Milestone M2 Progress - Stripe Core APIs

Status: complete

## Task status

- M2-T1 Stripe customer service: complete
  - Implemented create/retrieve/update customer APIs in `src/packages/stripe/core-apis.ts`.
  - Added configurable customer attribute mapping on create/update.
  - Added reconciliation entry points (`reconcileByEmail`, `reconcileByProcessorId`).
  - Documented reconciliation caveats in `docs/stripe-core-apis.md`.
- M2-T2 Payment method management: complete
  - Implemented attach, update, default switching, and detach APIs.
  - Persisted normalized fields (`brand`, `last4`, expiry) plus raw payload via repository contracts.
  - Added cleanup behavior for detached payment methods.
  - Published SetupIntent + attach cookbook in `docs/stripe-core-apis.md`.
- M2-T3 Charges and refunds: complete
  - Implemented `charge`, `authorize`, `capture`, and `refund` APIs.
  - Persisted receipt URL, refund totals, and payment method snapshots in projection records.
  - Added Stripe-to-Solidus error mapping for provider/action-required/configuration errors.
  - Added charge/refund error handling and retry guidance in `docs/stripe-core-apis.md`.
- M2-T4 Subscription lifecycle: complete
  - Implemented `create`, `cancel`, `cancelNow`, `resume`, `swap`, `changeQuantity`, `pause`, and `unpause`.
  - Added state helpers (`subscribed`, `active`, `onTrial`, `onGracePeriod`, `paused`) and billing period helper.
  - Implemented invoice retry helpers (`retryFailedPayment`, `payOpenInvoices`).
  - Documented subscription state machine in `docs/stripe-core-apis.md`.

## Verification

- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun test src/packages/stripe/__tests__/integration/stripe-core-apis.integration.test.ts` (env-gated)

Last verified: 2026-02-19
