# Installing Solidus

Solidus installation is straightforward: install dependencies, add billing tables, and initialize the facade.

## 1) Install package

```bash
bun add @diegoquiroz/solidus stripe
```

## 2) Add database tables

Use the Sequelize migration templates in `packages/sequelize/migrations/templates`.

At minimum, create tables for:

- Customers / owner-customer links
- Subscriptions
- Charges
- Invoices
- Payment methods
- Webhook idempotency
- Webhook events
- Webhook outbox

## 3) Build repository bundle and facade

```ts
import Stripe from "stripe";
import { createSequelizeRepositoryBundleFromModels, createSolidusFacade } from "@diegoquiroz/solidus";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer,
  idempotency: BillingIdempotencyKey,
  stripeCustomers: BillingStripeCustomer,
  paymentMethods: BillingPaymentMethod,
  charges: BillingCharge,
  subscriptions: BillingSubscription,
  invoices: BillingInvoice,
  webhookEvents: BillingWebhookEvent,
  outbox: BillingWebhookOutbox,
});

export const facade = createSolidusFacade({
  stripe,
  repositories: repositoryBundle.facade,
  ownerCustomers: repositoryBundle.core.customers,
  webhookRepositories: {
    invoices: repositoryBundle.invoices,
  },
  webhookRegistration: {
    enableDefaultEffects: true,
  },
});
```

## Next

See [Configuration](2_configuration.md).
