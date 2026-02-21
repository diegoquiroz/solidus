# Routes & Webhooks

Solidus webhook handling is designed for durability: verify signature, persist event, process asynchronously.

## Mount route

```ts
app.use(
  "/api",
  createStripeWebhookRouter({
    express,
    stripe,
    webhookSecrets: [process.env.STRIPE_WEBHOOK_SECRET!],
    pipeline,
    routePath: "/webhooks/stripe",
  }),
);

app.use(express.json());
```

Important: mount webhook router before `express.json()`.

## Persist-first pipeline

```ts
const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository,
  eventRepository,
  queue: createDbOutboxQueueAdapter({ outbox: outboxRepository }),
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});
```

## ActiveJob equivalent in Solidus

In Pay, background processing is delegated to ActiveJob.

In Solidus, the equivalent is:

1. `createPersistFirstWebhookPipeline(...)` to persist + enqueue
2. a `QueueAdapter` implementation to run jobs
3. a worker/drainer loop to execute queued jobs

### Option A (recommended): DB outbox worker

Use `createDbOutboxQueueAdapter` and run `drainDbOutboxQueue` in a worker process.

```ts
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
} from "@diegoquiroz/solidus";

const queue = createDbOutboxQueueAdapter({
  outbox: repositoryBundle.webhook.outboxRepository,
});

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository: repositoryBundle.webhook.idempotencyRepository,
  eventRepository: repositoryBundle.webhook.eventRepository,
  queue,
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});

// Run in a background worker process
setInterval(async () => {
  await drainDbOutboxQueue({
    outbox: repositoryBundle.webhook.outboxRepository,
    pipeline,
    limit: 100,
  });
}, 1000);
```

### Option B: Bring your own queue system

If you already use BullMQ/SQS/etc, implement the `QueueAdapter` contract (`enqueue`) and delegate back into the pipeline worker API.

```ts
import type { QueueAdapter, QueueJob, WebhookPipeline } from "@diegoquiroz/solidus";
import { createPersistFirstWebhookPipeline } from "@diegoquiroz/solidus";

let pipeline: WebhookPipeline;

const queue: QueueAdapter = {
  async enqueue(job: QueueJob) {
    // Replace this with your queue publish call.
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

## Recommended first events

- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_failed`
- `payment_method.attached`

## Checkout owner-linking reference

When you use checkout owner-linking, send `client_reference_id` as `<ModelName>_<OwnerId>`.

Example: `Workspace_42`.

Malformed or unknown references are ignored (best-effort linking), matching Pay behavior.

## Next

- Advanced webhook details: `docs/express-webhooks.md`
- Full quickstart: `docs/getting-started.md`
