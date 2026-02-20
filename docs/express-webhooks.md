# Express Stripe Webhooks (M3)

This guide covers Solidus webhook ingestion for Express with Stripe signature verification and persist-first async processing.

## Copy-ready setup

```ts
import express from "express";
import Stripe from "stripe";
import {
  createDbOutboxQueueAdapter,
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
