# Customers

Every billing flow starts by associating your domain owner (for example `Workspace`) with a Stripe customer.

For checkout owner-linking parity with Pay, use `client_reference_id` in the format `<ModelName>_<OwnerId>`.

## Set or create the owner customer

```ts
const ownerStripeProcessor = await facade.convenience.setOwnerStripeProcessor({
  ownerType: "Workspace",
  ownerId: workspace.id,
});

const customerId = ownerStripeProcessor.customerId;
```

## Reconcile existing Stripe customers by email

```ts
const matches = await facade.api.customers.reconcileByEmail({
  email: workspace.email,
  limit: 10,
});
```

Then associate the owner explicitly:

```ts
await facade.convenience.setOwnerStripeProcessor({
  ownerType: "Workspace",
  ownerId: workspace.id,
  customerId: matches[0].id,
});
```

## Next

See [Payment Methods](4_payment_methods.md).
