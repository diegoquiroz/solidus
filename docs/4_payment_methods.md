# Payment Methods

Solidus supports attach, default, and detach flows for Stripe payment methods.

## Attach and set default

```ts
await facade.api.paymentMethods.add({
  customerId: "cus_123",
  paymentMethodId: "pm_123",
  setAsDefault: true,
});
```

## Update customer default payment method

```ts
await facade.api.customers.updatePaymentMethod({
  customerId: "cus_123",
  paymentMethodId: "pm_456",
});
```

## Detach

```ts
await facade.api.paymentMethods.detach("pm_old");
```

## Next

See [Charges](5_charges.md).
