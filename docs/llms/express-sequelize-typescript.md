# LLM Guide: Express + Sequelize + TypeScript

This guide is for LLMs implementing Solidus inside an existing Express + Sequelize + TypeScript codebase.

Follow these steps in order. Do not skip migration or webhook setup.

## 0) Scope and assumptions

- Processor scope is Stripe.
- App stack is Express + Sequelize + TypeScript.
- You already have a DB connection and a migration runner in your host app.

## 1) Install dependencies

```bash
bun add @diegoquiroz/solidus stripe express sequelize
```

Set env vars (example):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional for secret rotation:

- `STRIPE_WEBHOOK_SECRETS` (comma-separated)

## 2) Copy Solidus migration templates into your app

Copy both SQL templates from Solidus into your application's migration directory:

- `packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.up.sql`
- `packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.down.sql`

Example (adjust destination):

```bash
cp packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.up.sql ./your-app/migrations/
cp packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.down.sql ./your-app/migrations/
```

Run your app migration command after copying.

Required tables include:

- `customers`
- `stripe_customers`
- `payment_methods`
- `charges`
- `subscriptions`
- `invoices`
- `webhook_events`
- `webhook_outbox`
- `idempotency_keys`

## 3) Define Sequelize models for all required tables

Create Sequelize models that map to the migration tables and expose standard model methods used by Solidus delegates (`upsert`, `create`, `findOne`, `findAll`, `update`, `destroy`).

You will pass these models to Solidus by logical role:

- `BillingCustomer`
- `BillingIdempotencyKey`
- `BillingStripeCustomer`
- `BillingStripeAccount` (optional)
- `BillingPaymentMethod`
- `BillingCharge`
- `BillingSubscription`
- `BillingInvoice`
- `BillingWebhookEvent`
- `BillingWebhookOutbox`

## 4) Wire Sequelize models into a repository bundle

Use `createSequelizeRepositoryBundleFromModels` and pass all billing models.

```ts
import { createSequelizeRepositoryBundleFromModels } from "@diegoquiroz/solidus";

export const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer,
  idempotency: BillingIdempotencyKey,
  stripeCustomers: BillingStripeCustomer,
  stripeAccounts: BillingStripeAccount,
  paymentMethods: BillingPaymentMethod,
  charges: BillingCharge,
  subscriptions: BillingSubscription,
  invoices: BillingInvoice,
  webhookEvents: BillingWebhookEvent,
  outbox: BillingWebhookOutbox,
});
```

## 5) Create the facade

Register the owner model used by checkout owner-linking.

```ts
import Stripe from "stripe";
import {
  createCustomerRegistry,
  createSolidusFacade,
  registerCustomerModel,
} from "@diegoquiroz/solidus";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});
const customerRegistry = createCustomerRegistry();

registerCustomerModel(customerRegistry, {
  modelName: "Workspace",
  resolveOwner: (record: { id: string }) => record,
  isDefault: true,
});

export const facade = createSolidusFacade({
  stripe,
  repositories: repositoryBundle.facade,
  ownerCustomers: repositoryBundle.core.customers,
  customerRegistry,
  webhookRepositories: {
    invoices: repositoryBundle.invoices,
  },
  webhookRegistration: {
    enableDefaultEffects: true,
  },
});
```

## 6) Configure Stripe webhook endpoint and events

Create a Stripe webhook endpoint that points to your Express route (example: `/solidus/webhooks/stripe`).

Enable the events required by Solidus default Stripe effects (see `docs/stripe-webhook-coverage-matrix.md`).

At minimum, include:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.updated`
- `customer.deleted`
- `customer.subscription.updated`
- `payment_method.attached`
- `payment_method.updated`
- `payment_method.detached`
- `payment_intent.succeeded`

## 7) Mount webhooks with persist-first pipeline

Mount webhook route before `express.json()`.

```ts
import express from "express";
import Stripe from "stripe";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
  createStripeWebhookRouter,
} from "@diegoquiroz/solidus";

const app = express();

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository: repositoryBundle.webhook.idempotencyRepository,
  eventRepository: repositoryBundle.webhook.eventRepository,
  queue: createDbOutboxQueueAdapter({
    outbox: repositoryBundle.webhook.outboxRepository,
  }),
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
  }),
);

app.use(express.json());

// Worker/drainer loop (run in a background worker process)
setInterval(async () => {
  await drainDbOutboxQueue({
    outbox: repositoryBundle.webhook.outboxRepository,
    pipeline,
    limit: 100,
  });
}, 1000);
```

Critical rule:

- Keep `createStripeWebhookRouter(...)` mounted before global JSON body parsing.

## 7.1) ActiveJob equivalent (required background job wiring)

Pay delegates webhook background jobs to ActiveJob.

In Solidus, implement this equivalent:

1. use `createPersistFirstWebhookPipeline(...)`
2. provide a `QueueAdapter` (`createDbOutboxQueueAdapter` recommended)
3. run a worker loop with `drainDbOutboxQueue(...)`

If your app already has a queue system (BullMQ/SQS/etc), implement `QueueAdapter.enqueue(job)` and execute jobs by calling `pipeline.processQueueJob(job)` in your worker.

Minimal custom queue adapter pattern:

```ts
import type { QueueAdapter, QueueJob, WebhookPipeline } from "@diegoquiroz/solidus";
import { createPersistFirstWebhookPipeline } from "@diegoquiroz/solidus";

let pipeline: WebhookPipeline;

const queue: QueueAdapter = {
  async enqueue(job: QueueJob) {
    // Replace with your queue publish logic.
    await pipeline.processQueueJob(job);
    return { jobId: `custom-${job.idempotencyKey}` };
  },
};

pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository: repositoryBundle.webhook.idempotencyRepository,
  eventRepository: repositoryBundle.webhook.eventRepository,
  queue,
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});
```

## 8) Create Stripe customer links before checkout

Before checkout, ensure your owner is linked to a Stripe customer:

```ts
const assignment = await facade.convenience.setOwnerStripeProcessor({
  ownerType: "Workspace",
  ownerId: workspace.id,
  customer: { email: workspace.billingEmail },
});
```

## 9) Create checkout session with Pay-compatible `client_reference_id`

Solidus default webhook effects link checkout sessions to owners only when `client_reference_id` format is:

- `<ModelName>_<OwnerId>`
- Example: `Workspace_123`

```ts
await facade.api.checkout.createSubscriptionSession({
  customerId: assignment.customerId,
  successUrl: "https://app.example.com/billing/success",
  cancelUrl: "https://app.example.com/billing/cancel",
  lineItems: [{ price: "price_monthly", quantity: 1 }],
  stripeOptions: {
    client_reference_id: `Workspace_${workspace.id}`,
  },
});
```

Malformed/unknown `client_reference_id` is ignored (best-effort), matching Pay behavior.

## 10) Verification checklist

After implementation, verify these end-to-end:

1. A checkout creates Stripe objects and webhook events are persisted.
2. Outbox drain processes events and marks webhook events processed.
3. Owner customer link is saved in `customers` (`ownerType`, `ownerId`, `processor`, `processorId`).
4. `customer.updated` updates projections and reconciles default payment method state.
5. `customer.deleted` cancels active subscriptions, removes payment methods, and tombstones customer projection.

Run these project checks locally:

```bash
bun test src/packages/stripe/__tests__/default-effects.test.ts
bun test src/packages/stripe/__tests__/integration/stripe-webhooks.integration.test.ts
bun test src/packages/sequelize/__tests__/repository-adapters.test.ts
```

## Rules for LLM implementations

- Do not invent custom billing tables when Solidus schema artifacts already cover the same data.
- Keep owner identity in owner fields, processor identity in processor fields.
- Treat record `id` as opaque; never parse semantics from it.
- Always wire persist-first webhook processing in production apps.
- Keep webhook route before body parsers.
- Use Stripe webhooks as source of truth for subscription/payment lifecycle updates.
- Copy migration templates before model wiring; do not skip schema setup.
