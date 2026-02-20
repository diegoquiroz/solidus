# Pay-style Subscriptions

This guide covers create, cancel, resume, swap, quantity changes, pause, and invoice recovery.

## Copy-ready examples

```ts
const subscription = await facade.api.subscriptions.create({
  customerId: "cus_123",
  priceId: "price_monthly",
  quantity: 1,
});

await facade.api.subscriptions.changeQuantity({
  subscriptionId: subscription.processorId,
  quantity: 3,
});

await facade.api.subscriptions.pause({ subscriptionId: subscription.processorId });
await facade.api.subscriptions.unpause(subscription.processorId);
await facade.api.subscriptions.cancel(subscription.processorId);

const preview = await facade.api.subscriptions.previewInvoice({
  subscriptionId: subscription.processorId,
});
```

## Migration callouts

- `pause` defaults behavior to `"void"` when omitted for Pay parity.
- Paused subscriptions stay logically active in parity semantics while `pause_collection` is present (unless terminal Stripe status).
- `subscriptions.previewInvoice` mirrors Pay `preview_invoice(subscription:)` helper behavior.
- For incomplete/payment-action-required states, rely on webhook-driven projection updates before access changes.

## Related docs

- Subscription state helpers and pause semantics: `docs/stripe-core-apis.md`
- Checkout and billing portal helpers: `docs/stripe-core-apis.md`
- Webhook sequencing and replay: `docs/pay-webhooks.md`
- Rails portability caveats: `docs/not-portable-from-rails.md`
