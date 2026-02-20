# Facade API

The facade package provides a stable composition entrypoint for common Solidus setup.

## Create facade

```ts
import Stripe from "stripe";
import { createSolidusFacade } from "@diegoquiroz/solidus";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const facade = createSolidusFacade({
  stripe,
  repositories,
  webhookRepositories,
  webhookRegistration: {
    enableDefaultEffects: true,
    effects: webhookEffects,
  },
});
```

## Surface

- `facade.api`: Stripe-first billing API from `createStripeCoreApi`.
- `facade.convenience.setOwnerStripeProcessor(...)`: owner-centric Stripe processor setup (Pay-style `set_payment_processor` flow).
- `facade.convenience.syncCustomer(...)`: reconcile an owner-linked customer projection.
- `facade.convenience.syncSubscriptions(...)`: reconcile owner-linked subscription projections.
- `facade.webhooks.process(event)`: process a verified Stripe event.
- `facade.webhooks.delegator`: subscribe/unsubscribe webhook listeners.
- `webhookRegistration.enableDefaultEffects`: toggle built-in sync effects.
- `webhookRegistration.effects`: add or override specific effect handlers.

## Pay idiom migration mapping

| Pay idiom | Solidus convenience method |
| --- | --- |
| `user.set_payment_processor(:stripe)` | `facade.convenience.setOwnerStripeProcessor({ ownerType: "User", ownerId: String(user.id) })` |
| `pay_customer.sync` | `facade.convenience.syncCustomer({ ownerType: "User", ownerId: String(user.id) })` |
| `pay_customer.subscriptions.sync` (bulk reconcile pattern) | `facade.convenience.syncSubscriptions({ ownerType: "User", ownerId: String(user.id) })` |

### Example: set owner processor and reuse existing customer

```ts
await facade.convenience.setOwnerStripeProcessor({
  ownerType: "User",
  ownerId: String(user.id),
  customerId: "cus_123",
});
```

### Example: create Stripe customer while assigning processor

```ts
await facade.convenience.setOwnerStripeProcessor({
  ownerType: "User",
  ownerId: String(user.id),
  customer: {
    email: user.email,
    metadata: { appUserId: String(user.id) },
  },
});
```

### Example: convenience reconciliation workflows

```ts
await facade.convenience.syncCustomer({
  ownerType: "User",
  ownerId: String(user.id),
});

await facade.convenience.syncSubscriptions({
  ownerType: "User",
  ownerId: String(user.id),
  limit: 50,
});
```

## Compatibility note

- `createFacadePlaceholder` remains available for compatibility with prior milestone artifacts.
- New integrations should use `createSolidusFacade`.
