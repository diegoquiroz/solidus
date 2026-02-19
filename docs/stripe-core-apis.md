# Stripe Core APIs (M2)

This guide documents the M2 Stripe customer, payment method, charge/refund, and subscription APIs.

## Customer reconciliation caveats

- Solidus does not auto-link existing Stripe customers during registration.
- Use `customers.reconcileByEmail` or `customers.reconcileByProcessorId` and apply explicit merge rules in your app.
- Prefer deterministic identifiers in metadata (for example `ownerType:ownerId`) when creating customers.

## SetupIntent + attach cookbook

Use SetupIntents client-side, then attach and optionally set default server-side.

```ts
import { createStripeCoreApi } from "@diegoquiroz/solidus";

const api = createStripeCoreApi({ stripe });

await api.paymentMethods.add({
  customerId: "cus_123",
  paymentMethodId: "pm_from_setup_intent",
  setAsDefault: true,
});
```

## Charges and refunds: error and retry guidance

- Stripe exceptions are wrapped by `mapStripeError` into Solidus errors.
- `authentication_required` and `requires_action` are raised as `ActionRequiredError` and include payment intent details.
- Transient provider failures are raised as `ProviderError`; retry with idempotency keys at the API boundary.
- For refunds, prefer partial incremental refunds to preserve audit history and prevent over-refund races.

## Subscription state machine

| Stripe status / flags | `subscribed` | `active` | `onTrial` | `onGracePeriod` | `paused` |
| --- | --- | --- | --- | --- | --- |
| `active` | yes | yes | no | no | no |
| `trialing` | yes | yes | yes | no | no |
| `active` + `cancelAtPeriodEnd=true` + future period end | yes | yes | no | yes | no |
| any status + `pause_collection` set | yes | no | no | no | yes |
| `canceled` / `incomplete_expired` / `unpaid` | no | no | no | no | no |

Helpers are exposed under `api.state`:

- `subscribed(subscription)`
- `active(subscription)`
- `onTrial(subscription)`
- `onGracePeriod(subscription)`
- `paused(subscription)`
- `billingPeriod(subscription)`
