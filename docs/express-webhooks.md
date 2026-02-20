# Express Stripe Webhooks (M3)

This guide covers Solidus webhook ingestion for Express with Stripe signature verification and persist-first async processing.

## Copy-ready setup

```ts
import express from "express";
import Stripe from "stripe";
import {
  createDbOutboxQueueAdapter,
  getWebhookHealthDiagnostics,
  createPersistFirstWebhookPipeline,
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
  createStripeWebhookRouter,
} from "@diegoquiroz/solidus";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const processor = createStripeWebhookProcessor({
  handlers: createStripeWebhookHandlers({
    effects: {
      async syncChargeById(chargeId) {
        // sync local projection
      },
    },
  }),
});

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository,
  eventRepository,
  queue: createDbOutboxQueueAdapter({ outbox: outboxRepository }),
  processEvent: async (event) => {
    await processor.process(event.payload as Stripe.Event);
  },
  observability: {
    log(entry) {
      console.log(JSON.stringify(entry));
    },
    metric(sample) {
      metricsClient.observe(sample.name, sample.value, sample.tags);
    },
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

const diagnostics = await getWebhookHealthDiagnostics({
  listEvents: () => webhookRepository.listRecent(),
  lagWarningThresholdMs: 120000,
});

if (diagnostics.warnings.length > 0) {
  console.warn("webhook health warning", diagnostics);
}
```

## Middleware ordering

- Keep webhook route on `express.raw({ type: "application/json" })`.
- Do not run `express.json()` on the webhook route.
- You can still use global `express.json()` for non-webhook routes.

## Signature diagnostics

- Missing `Stripe-Signature` header returns `400` with `SIGNATURE_VERIFICATION_ERROR`.
- Empty webhook secret config returns `400` with `CONFIGURATION_ERROR`.
- Parsed body (non-raw payload) returns `400` with a route-ordering hint.
- Multiple secrets are supported for zero-downtime secret rotation.

## Observability and operations

- `observability.log` receives structured transition logs for ingest and process events.
- `observability.metric` receives callback-based metric samples (`count` and lag `ms`).
- Lag metric name is `webhook.lag.ms` with `status` tags (`processed`, `retrying`, `dead_letter`).
- Use `getWebhookHealthDiagnostics` to build `/health/webhooks` checks with pending/retrying/dead-letter counts.
