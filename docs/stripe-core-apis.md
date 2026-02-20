# Stripe Core APIs (M4)

This guide documents the Stripe customer, payment method, charge/refund, subscription, checkout, billing portal, metering, and connect helper APIs.

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

## Checkout + Billing Portal

Use Checkout mode-specific helpers and feed users into Billing Portal for self-service updates.

```ts
import { createStripeCoreApi } from "@diegoquiroz/solidus";

const api = createStripeCoreApi({ stripe });

const checkout = await api.checkout.createSubscriptionSession({
  customerId: "cus_123",
  successUrl: "https://app.example/billing/success",
  cancelUrl: "https://app.example/billing/cancel",
  lineItems: [{ price: "price_monthly", quantity: 1 }],
  stripeOptions: {
    automatic_tax: { enabled: true },
  },
});

const portal = await api.billingPortal.createSession({
  customerId: "cus_123",
  returnUrl: "https://app.example/account/billing",
});
```

- Checkout success/cancel/return URLs are normalized with `stripe_checkout_session_id={CHECKOUT_SESSION_ID}` for callback correlation.
- Keep entitlement state in sync from webhooks (for example `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`) rather than trusting redirect completion alone.

## SCA continuation flow (Express)

```ts
app.post("/payments/charge", async (req, res, next) => {
  try {
    const charge = await api.charges.charge({
      customerId: req.body.customerId,
      amount: req.body.amount,
      currency: "usd",
      paymentMethodId: req.body.paymentMethodId,
    });

    res.json({ ok: true, chargeId: charge.processorId });
  } catch (error) {
    if (error instanceof ActionRequiredError) {
      res.status(402).json({
        code: error.code,
        paymentIntentId: error.details?.paymentIntentId,
        clientSecret: error.details?.clientSecret,
        recommendedNextAction: error.details?.recommendedNextAction,
      });
      return;
    }

    next(error);
  }
});
```

### SCA troubleshooting quick checks

- `ACTION_REQUIRED` with no `clientSecret`: recreate the PaymentIntent and collect a new payment method.
- PaymentIntent stays `requires_action`: confirm client-side with Stripe.js using the returned `clientSecret`.
- Subscription remains `incomplete`: verify webhook delivery for `invoice.payment_action_required`, `invoice.payment_failed`, and `customer.subscription.updated`.

## Charges and refunds: error and retry guidance

- Stripe exceptions are wrapped by `mapStripeError` into Solidus errors.
- `authentication_required` and `requires_action` are raised as `ActionRequiredError` and include payment intent continuation details.
- Transient provider failures are raised as `ProviderError`; retry with idempotency keys at the API boundary.
- For refunds, prefer partial incremental refunds to preserve audit history and prevent over-refund races.

## Metered billing + tax cookbook

- Send usage with `api.meters.createEvent({ eventName, payload })` using Stripe meter names and customer IDs in payload.
- Keep meter event identifiers deterministic when retrying to avoid duplicate usage writes.
- Pass tax settings through Stripe options where supported (`checkout` helper `stripeOptions.automatic_tax`, `subscriptions.create(...stripeOptions)`).
- Reconcile usage and invoice totals from webhook events before finalizing access changes.

### Usage records to meters migration note

- Follow Stripe's migration path: `https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide`.
- During transition windows, keep event identifiers deterministic and maintain dual-write compatibility if legacy usage records still exist.

## Stripe Connect quickstart

- Create and track connected accounts with `api.connect.createAccount` + `api.connect.retrieveAccount`.
- Generate onboarding links with `api.connect.createAccountLink` and dashboard access links with `api.connect.createLoginLink`.
- Move funds using `api.connect.createTransfer` and set your `transferGroup`/metadata conventions.
- Onboarding is not complete when account creation succeeds; check status flags and requirements (for example `details_submitted`, `charges_enabled`, `requirements.currently_due`) before enabling live payouts.

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
