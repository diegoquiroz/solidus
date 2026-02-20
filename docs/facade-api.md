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
  webhookEffects,
});
```

## Surface

- `facade.api`: Stripe-first billing API from `createStripeCoreApi`.
- `facade.webhooks.process(event)`: process a verified Stripe event.
- `facade.webhooks.delegator`: subscribe/unsubscribe webhook listeners.

## Compatibility note

- `createFacadePlaceholder` remains available for compatibility with prior milestone artifacts.
- New integrations should use `createSolidusFacade`.
