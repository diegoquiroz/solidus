# Subscriptions

Solidus supports direct subscription APIs and Stripe Checkout subscription sessions.

## Create subscription directly

```ts
const subscription = await facade.api.subscriptions.create({
  customerId: "cus_123",
  priceId: "price_monthly",
  quantity: 1,
});
```

## Create Checkout session for subscription

```ts
const session = await facade.api.checkout.createSubscriptionSession({
  customerId: "cus_123",
  successUrl: "https://app.example.com/billing?checkout=success",
  cancelUrl: "https://app.example.com/billing?checkout=cancel",
  lineItems: [{ price: "price_monthly", quantity: 1 }],
});
```

## Cancel / resume

```ts
await facade.api.subscriptions.cancel("sub_123");
await facade.api.subscriptions.resume("sub_123");
```

## Next

See [Routes & Webhooks](7_webhooks.md).
