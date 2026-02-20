# Getting Started

This is the canonical quickstart for Solidus with Stripe, Express, and Sequelize-backed projections.

## 1) Install

```bash
bun install
```

## 2) Configure environment variables

Set these values before booting your app:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=development
```

Notes:

- Bun loads `.env` automatically.
- For secret rotation, provide multiple webhook secrets in app config.

## 3) Stripe dashboard setup

Create or update a Stripe webhook endpoint that delivers at least the events listed in `docs/stripe-webhook-coverage-matrix.md`.

At minimum for a first end-to-end flow, enable:

- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_failed`
- `payment_method.attached`

## 4) Apply Sequelize migrations

Use your app's migration runner and apply the template SQL from `packages/sequelize/migrations/templates`.

Required artifacts include webhook lifecycle and outbox tables documented in `packages/sequelize/README.md`.

Checkpoint:

- Your database has projection tables and webhook queue tables (`webhook_events`, `webhook_outbox` in the template set).

## 5) Wire repositories

Use the first-party Sequelize model path for common setups.

```ts
import Stripe from "stripe";
import {
  createSequelizeRepositoryBundleFromModels,
  createSolidusFacade,
} from "@diegoquiroz/solidus";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: customerModel,
  idempotency: idempotencyKeyModel,
  stripeCustomers: stripeCustomerProjectionModel,
  stripeAccounts: stripeAccountProjectionModel,
  paymentMethods: paymentMethodProjectionModel,
  charges: chargeProjectionModel,
  subscriptions: subscriptionProjectionModel,
  invoices: invoiceProjectionModel,
  webhookEvents: webhookEventModel,
  outbox: webhookOutboxModel,
});

const facade = createSolidusFacade({
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

If you already have custom delegates, `createSequelizeRepositoryBundle` remains supported.

Checkpoint:

- `facade.api.customers.create` and `facade.api.subscriptions.create` are callable.

## 6) Add persist-first webhook pipeline

```ts
import express from "express";
import Stripe from "stripe";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  createStripeWebhookRouter,
} from "@diegoquiroz/solidus";

const app = express();

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository,
  eventRepository,
  queue: createDbOutboxQueueAdapter({ outbox: outboxRepository }),
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});

app.use(
  "/solidus",
  createStripeWebhookRouter({
    express,
    stripe,
    webhookSecrets: [process.env.STRIPE_WEBHOOK_SECRET!],
    pipeline,
    routePath: "/webhooks/stripe",
    eventModePolicy: {
      allowLiveEvents: true,
      allowTestEvents: process.env.NODE_ENV !== "production",
    },
  }),
);

app.use(express.json());
```

Mount-order rule:

- Mount `createStripeWebhookRouter(...)` before global `express.json()` so Stripe signature verification receives raw request bytes.

## 7) First-flow checkpoints

After creating a customer, attaching a payment method, and running one checkout or subscription flow:

- Stripe objects exist in dashboard (customer/subscription or payment intent).
- Projection rows are persisted in your Sequelize-backed tables.
- Webhook ingest records transition to `processed` without dead-letter growth.
- If you disabled test events in production policy, test-mode deliveries are rejected with `WEBHOOK_EVENT_REJECTED`.

## 8) Run parity smoke script

Run the reference smoke checks that mirror Pay-style lifecycle scenarios:

```bash
bun run test:example-app
```

The script validates processor assignment, checkout owner-linking, SCA action-required handling, subscription lifecycle projections, webhook replay idempotency, and observability checkpoints.

## Next docs

- Domain flows: `docs/pay-customers.md`, `docs/pay-payment-methods.md`, `docs/pay-charges.md`, `docs/pay-subscriptions.md`, `docs/pay-webhooks.md`
- SCA + checkout + metering + tax + connect: `docs/stripe-core-apis.md`
- Production hardening: `docs/sequelize-express-production-hardening.md`
- Migration planning: `docs/migration-from-ad-hoc-stripe.md`
- Rails non-portable differences: `docs/not-portable-from-rails.md`
