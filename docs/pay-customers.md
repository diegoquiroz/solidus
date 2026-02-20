# Pay-style Customers

This guide maps common Pay customer flows to Solidus APIs.

## Copy-ready examples

```ts
const customer = await facade.api.customers.create({
  email: user.email,
  name: user.name,
  metadata: { appUserId: String(user.id) },
});

await facade.api.customers.update(customer.id, {
  name: "Updated Name",
});

const matches = await facade.api.customers.reconcileByEmail({
  email: user.email,
  limit: 5,
});
```

## Pay to Solidus mapping

- `pay_customer` create/update -> `facade.api.customers.create` / `facade.api.customers.update`
- existing Stripe customer reconciliation -> `facade.api.customers.reconcileByEmail` or `facade.api.customers.reconcileByProcessorId`

## Migration callouts

- Solidus does not auto-link existing Stripe customers during registration.
- Use explicit reconciliation and app-level merge rules before switching legacy writes off.
- Keep deterministic metadata for owner identity (`ownerType`, `ownerId`) to simplify replay and audits.

## Related docs

- Payment methods: `docs/pay-payment-methods.md`
- Subscriptions: `docs/pay-subscriptions.md`
- Checkout owner linking: `docs/pay-webhooks.md`
- SCA, checkout, metering, tax, connect helpers: `docs/stripe-core-apis.md`
- Rails portability caveats: `docs/not-portable-from-rails.md`
