# Charges

Use Solidus to create one-time payments while keeping projections in sync through webhooks.

## Create a charge

```ts
const charge = await facade.api.charges.create({
  customerId: "cus_123",
  amount: 2500,
  currency: "usd",
});
```

## Use Checkout for one-time payment

```ts
const session = await facade.api.checkout.createPaymentSession({
  customerId: "cus_123",
  successUrl: "https://app.example.com/billing?checkout=success",
  cancelUrl: "https://app.example.com/billing?checkout=cancel",
  lineItems: [{ price: "price_123", quantity: 1 }],
});
```

## Next

See [Subscriptions](6_subscriptions.md).
