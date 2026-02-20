# Pay-style Payment Methods

This guide covers attach/default/detach flows for Stripe payment methods.

## Copy-ready examples

```ts
await facade.api.paymentMethods.add({
  customerId: "cus_123",
  paymentMethodId: "pm_from_setup_intent",
  setAsDefault: true,
});

await facade.api.customers.updatePaymentMethod({
  customerId: "cus_123",
  paymentMethodId: "pm_next_default",
});

await facade.api.paymentMethods.setDefault({
  customerId: "cus_123",
  paymentMethodId: "pm_987",
});

await facade.api.paymentMethods.detach("pm_old");
```

## Migration callouts

- Recommended flow is SetupIntent client-side, then `paymentMethods.add` server-side.
- `customers.updatePaymentMethod` is the Pay `update_payment_method` parity path: attach + set default in one call.
- `setDefault` syncs Stripe customer invoice settings by default; use `syncCustomerInvoiceSettings: false` only if your app owns that write path.
- Keep webhook handlers for `payment_method.attached`, `payment_method.updated`, and `payment_method.detached` active to preserve projection correctness.

## Related docs

- Customers: `docs/pay-customers.md`
- Charges and SCA continuation: `docs/pay-charges.md`
- Webhook event coverage: `docs/stripe-webhook-coverage-matrix.md`
- Checkout + SCA + tax cookbook: `docs/stripe-core-apis.md`
- Rails portability caveats: `docs/not-portable-from-rails.md`
