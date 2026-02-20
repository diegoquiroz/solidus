# Milestone M4 Progress - Checkout, SCA, Metering, Tax, Connect

Status: complete

## Task status

- M4-T1 Checkout and Billing Portal APIs: complete
  - Implemented checkout helpers for payment/setup/subscription and session-id URL propagation helpers in `src/packages/stripe/core-apis.ts`.
  - Implemented billing portal session helper in `src/packages/stripe/core-apis.ts`.
  - Added mode coverage and URL helper tests in `src/packages/stripe/__tests__/core-apis.test.ts`.
  - Published checkout and webhook-sync walkthrough guidance in `docs/stripe-core-apis.md`.
- M4-T2 SCA and action-required workflow: complete
  - Extended Stripe action-required mapping with continuation details (`paymentIntentId`, `clientSecret`, `recommendedNextAction`) in `src/packages/stripe/errors.ts`.
  - Added Express-oriented continuation flow and troubleshooting guidance in `docs/stripe-core-apis.md`.
  - Added ActionRequiredError continuation contract tests in `src/packages/stripe/__tests__/core-apis.test.ts`.
- M4-T3 Metered billing and tax: complete
  - Implemented meter event API helper (`api.meters.createEvent`) in `src/packages/stripe/core-apis.ts`.
  - Added automatic tax pass-through coverage for checkout/subscription options in `src/packages/stripe/__tests__/core-apis.test.ts`.
  - Published metering/tax cookbook guidance and usage-records-to-meters migration notes in `docs/stripe-core-apis.md`.
- M4-T4 Stripe Connect parity: complete
  - Implemented Connect helpers for account create/retrieve, onboarding links, login links, and transfers in `src/packages/stripe/core-apis.ts`.
  - Added Connect workflow tests in `src/packages/stripe/__tests__/core-apis.test.ts`.
  - Reused existing `account.updated` webhook handling path in `src/packages/stripe/webhooks.ts` for status sync.
  - Completed and signed off Connect parity checklist in `docs/stripe-connect-parity-checklist.md`.

## Verification

- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun test src/packages/stripe/__tests__/core-apis.test.ts`

Last verified: 2026-02-19
