# Migration Guide: Ad Hoc Stripe -> Solidus

This guide helps teams move from direct Stripe SDK usage to Solidus with minimal risk.

## Migration strategy

1. Keep your existing Stripe webhook endpoint active.
2. Introduce Solidus APIs for one bounded flow at a time (customers, then payment methods, then subscriptions).
3. Switch webhook processing to Solidus persist-first pipeline.
4. Remove duplicate legacy Stripe handling once projections match.

## Common mapping

| Current ad hoc code | Solidus API |
| --- | --- |
| `stripe.customers.create(...)` | `facade.api.customers.create(...)` |
| `stripe.paymentMethods.attach(...)` | `facade.api.paymentMethods.add(...)` |
| `stripe.subscriptions.create(...)` | `facade.api.subscriptions.create(...)` |
| `stripe.checkout.sessions.create(...)` | `facade.api.checkout.createPaymentSession(...)` / `createSubscriptionSession(...)` |
| `stripe.billingPortal.sessions.create(...)` | `facade.api.billingPortal.createSession(...)` |

## Suggested rollout checklist

- Migrate customer creation and reconciliation first.
- Migrate payment method default/attach flows and verify defaults in your local projection.
- Migrate subscription lifecycle calls (`create`, `cancel`, `resume`, `swap`, `changeQuantity`).
- Enable Solidus webhook processing and verify duplicate delivery behavior.
- Validate production telemetry (`webhook.process.transition.count`, `webhook.lag.ms`).

## Safety checks

- Keep idempotency at call sites while dual-running old and new code paths.
- Compare key billing records for a sample of customers before cutover.
- Keep a rollback toggle to route writes back to legacy Stripe wrappers during incident response.
