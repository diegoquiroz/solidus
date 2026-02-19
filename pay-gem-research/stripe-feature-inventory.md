# Pay (Stripe) Feature Inventory

This inventory maps current Stripe support in the `pay` gem, with notes for Solidus parity.

## 1) Customer declaration and lifecycle

- `pay_customer` declares billable model and injects payment APIs.
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/attributes.rb`
- Per-user processor assignment (`set_payment_processor`) and model default processor (`default_payment_processor`).
  - Source: `/Users/diego/Developer/clones/pay/docs/3_customers.md`
- Customer create-or-retrieve behavior on first API use (`api_record`).
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Optional Stripe customer attribute enrichment (`stripe_attributes`) and sync hooks.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/7_stripe_tax.md`, `/Users/diego/Developer/clones/pay/docs/1_installation.md`
- Reconciliation caveat: Pay does not auto-match existing Stripe customers.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/9_customer_reconciliation.md`

Porting note:
- Replace Ruby macro with explicit TS registration API (recommended): `registerCustomerModel(User, config)`.

## 2) Payment methods

- Add/update default payment method.
  - `update_payment_method`
  - `add_payment_method(paymentMethodId, default: false)`
  - Source: `/Users/diego/Developer/clones/pay/docs/4_payment_methods.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Payment method sync from webhook events (`attached`, `updated`, `card_automatically_updated`, `detached`).
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/stripe.rb`
- Supports many method types at charge snapshot level (card, PayPal-like wallets, bank methods, etc.).
  - Source: `/Users/diego/Developer/clones/pay/docs/5_charges.md`, Stripe VCR tests in `/Users/diego/Developer/clones/pay/test/vcr_cassettes/`

Porting note:
- Persist full Stripe `PaymentMethod` payload plus normalized columns (`brand`, `last4`, `exp_month`, etc.) for query ergonomics.

## 3) Charges and refunds

- One-time charge creation (`charge`) with passthrough options and currency overrides.
  - Source: `/Users/diego/Developer/clones/pay/docs/5_charges.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Authorization/capture flow (`authorize` and charge capture support).
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`, Stripe tests (`test_stripe_can_capture_an_authorized_charge.yml`)
- Refunds, partial refunds, tax-aware credit note paths.
  - Source: `/Users/diego/Developer/clones/pay/docs/5_charges.md`, Stripe tests (`test_stripe_can_issue_credit_note_for_a_refund_for_Stripe_tax.yml`)
- Receipt URL storage for Stripe charges.
  - Source: `/Users/diego/Developer/clones/pay/docs/5_charges.md`

Porting note:
- Keep `charge` API simple and expose advanced Stripe options as passthrough object.

## 4) Subscriptions

- Create subscriptions by Price ID or legacy Plan ID.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/1_overview.md`
- Multi-item subscriptions (`items`) and quantity updates.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/1_overview.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`
- Trial, status helpers, active/on_grace_period checks.
  - Source: `/Users/diego/Developer/clones/pay/docs/6_subscriptions.md`
- Cancel at period end, cancel now, resume, swap plan, preview invoice.
  - Source: `/Users/diego/Developer/clones/pay/docs/6_subscriptions.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`
- Pause/unpause with Stripe pause behaviors (`void`, `keep_as_draft`, `mark_uncollectible`, optional `resumes_at`).
  - Source: `/Users/diego/Developer/clones/pay/docs/6_subscriptions.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`
- Retry failed payments for past_due flows (`retry_failed_payment`, `pay_open_invoices`).
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`
- Manual sync paths (`sync!`, `sync_subscriptions(status: "all")`) for webhook race windows.
  - Source: `/Users/diego/Developer/clones/pay/docs/6_subscriptions.md`

Porting note:
- Preserve convenience state helpers in TS, even if derived from raw status.

## 5) SCA and payment confirmations

- SCA-first design with PaymentMethod/PaymentIntent/SetupIntent flows.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/4_sca.md`, `/Users/diego/Developer/clones/pay/docs/stripe/3_javascript.md`
- Raises action-required error class and provides confirmation route/page in Rails.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/4_sca.md`, `/Users/diego/Developer/clones/pay/docs/7_webhooks.md`

Porting note:
- For Express, provide JSON-first action-required contract and optional hosted confirmation adapter examples instead of Rails views.

## 6) Stripe Checkout and Billing Portal

- Checkout sessions for payment, setup, and subscription modes.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/8_stripe_checkout.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Auto-adds `stripe_checkout_session_id` to return URLs.
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Billing Portal session creation for self-service.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/8_stripe_checkout.md`
- Critical dependency: webhooks must be configured before checkout for accurate local state.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/8_stripe_checkout.md`

## 7) Webhooks, sync, and event bus

- Endpoint verifies Stripe signature, supports multiple signing secrets, persists events, then processes async.
  - Source: `/Users/diego/Developer/clones/pay/app/controllers/pay/webhooks/stripe_controller.rb`
- Event delivery uses delegator/pub-sub layer and supports custom subscribers and unsubscription.
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/webhooks/delegator.rb`, `/Users/diego/Developer/clones/pay/docs/7_webhooks.md`
- Full event set includes charges, invoices, subscriptions, customer updates/deletes, payment methods, account updates, checkout completion.
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/stripe.rb`, `/Users/diego/Developer/clones/pay/docs/stripe/5_webhooks.md`

Porting note:
- For Express, expose `createSolidusRouter()` and low-level webhook middleware; avoid auto-route metaprogramming.

## 8) Metered billing and tax

- Metered subscription support and meter event creation (`create_meter_event`).
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/6_metered_billing.md`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
- Stripe Tax support via customer address attrs + `automatic_tax` on subscribe/checkout.
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/7_stripe_tax.md`
- Charge-level tax fields persisted (`tax`, `total_tax_amounts`).
  - Source: `/Users/diego/Developer/clones/pay/docs/stripe/7_stripe_tax.md`

## 9) Stripe Connect (marketplace)

- Merchant account model and account lifecycle support (create, onboarding links, login links, transfers).
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/merchant.rb`, `/Users/diego/Developer/clones/pay/docs/marketplaces/stripe_connect.md`
- Uses `account.updated` webhook to track onboarding completeness.
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/stripe/webhooks/account_updated.rb`

Porting note:
- Even if marketplace is optional in v1, this is part of Stripe feature completeness in Pay and should be represented in roadmap.

## 10) Reliability and failure behavior

- Stripe SDK network retries are enabled globally (`max_network_retries = 2`).
  - Source: `/Users/diego/Developer/clones/pay/lib/pay/stripe.rb`
- Sync methods include optimistic retry loops for race conditions.
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`, `/Users/diego/Developer/clones/pay/app/models/pay/stripe/charge.rb`
- Webhook payload persisted before processing to avoid data loss.
  - Source: `/Users/diego/Developer/clones/pay/app/models/pay/webhook.rb`

## Suggested parity target definition

Solidus should be considered "Stripe feature-complete parity" when it supports:

- Customer declaration + processor assignment semantics.
- Payment methods, charges/refunds, full subscription lifecycle (including pause/swap/retry).
- SCA-required flows and action-required handoff.
- Checkout/Billing Portal, metered billing, and Stripe Tax.
- Webhook ingestion/verification + all Pay Stripe event handlers + custom subscriber hooks.
- Stripe Connect merchant workflows (or clearly documented staged parity with acceptance gates).
