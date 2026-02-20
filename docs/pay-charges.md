# Pay-style Charges and Refunds

This guide covers one-off charges, manual capture, and refunds.

## Copy-ready examples

```ts
const charged = await facade.api.charges.charge({
  customerId: "cus_123",
  amount: 2500,
  currency: "usd",
  paymentMethodId: "pm_123",
  description: "One-time add-on",
});

const authorized = await facade.api.charges.authorize({
  customerId: "cus_123",
  amount: 5000,
  currency: "usd",
  paymentMethodId: "pm_123",
});

await facade.api.charges.capture({ paymentIntentId: authorized.processorId });
await facade.api.charges.refund({ paymentIntentId: charged.processorId, amount: 1000 });
```

## Migration callouts

- Catch `ActionRequiredError` for SCA paths and return `paymentIntentId` + `clientSecret` to the client.
- Keep idempotency keys at your API boundary when retrying transient provider failures.
- Tax fields on normalized charge projections map from Stripe PaymentIntent amount detail fields; validate your reporting pipeline before cutover.

## Related docs

- SCA server/client continuation: `docs/stripe-core-apis.md`
- Subscription and checkout usage: `docs/pay-subscriptions.md`
- Metering and tax helper notes: `docs/stripe-core-apis.md`
- Rails portability caveats: `docs/not-portable-from-rails.md`
