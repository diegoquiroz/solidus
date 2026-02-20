import { describe, expect, test } from "bun:test";
import Stripe from "stripe";
import {
  createStripeWebhookHandler,
  createStripeWebhookRouter,
  diagnoseStripeWebhookConfiguration,
  type ExpressLikeHandler,
  type ExpressLikeModule,
  type ExpressLikeResponse,
} from "../index.ts";

function createFakeStripe(): Stripe {
  return new Stripe("sk_test_123", {});
}

function createResponseCapture(): {
  response: ExpressLikeResponse;
  statusCode: number;
  body: unknown;
} {
  const captured = {
    statusCode: 200,
    body: undefined as unknown,
  };

  const response: ExpressLikeResponse = {
    status(code: number): ExpressLikeResponse {
      captured.statusCode = code;
      return response;
    },
    send(body?: unknown): void {
      captured.body = body;
    },
    json(body: unknown): void {
      captured.body = body;
    },
  };

  return {
    response,
    get statusCode() {
      return captured.statusCode;
    },
    get body() {
      return captured.body;
    },
  };
}

describe("express stripe webhook adapter", () => {
  test("accepts valid signatures with multiple secrets", async () => {
    const stripe = createFakeStripe();
    const payload = JSON.stringify({ id: "evt_123", object: "event", type: "charge.succeeded", data: { object: { id: "ch_123" } } });
    const validSecret = "whsec_valid";
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: validSecret,
    });

    const ingested: string[] = [];
    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: ["whsec_invalid", validSecret],
      pipeline: {
        async ingest(input) {
          ingested.push(input.eventId);
          return { status: "queued", jobId: "job_1" };
        },
        async processByEventId() {
          return { status: "processed" };
        },
        async processQueueJob() {},
      },
    });

    const capture = createResponseCapture();

    await handler(
      {
        headers: {
          "Stripe-Signature": signature,
        },
        body: payload,
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(200);
    expect(ingested).toEqual(["evt_123"]);
  });

  test("returns 400 for invalid signatures", async () => {
    const stripe = createFakeStripe();
    const payload = JSON.stringify({ id: "evt_123", object: "event", type: "charge.succeeded", data: { object: { id: "ch_123" } } });
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_other",
    });

    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: ["whsec_expected"],
      pipeline: {
        async ingest() {
          return { status: "queued", jobId: "job_1" };
        },
        async processByEventId() {
          return { status: "processed" };
        },
        async processQueueJob() {},
      },
    });

    const capture = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": signature,
        },
        body: payload,
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(400);
  });

  test("returns 400 when Stripe-Signature header is missing", async () => {
    const stripe = createFakeStripe();
    const payload = JSON.stringify({ id: "evt_123", object: "event", type: "charge.succeeded", data: { object: { id: "ch_123" } } });

    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: ["whsec_expected"],
      pipeline: {
        async ingest() {
          return { status: "queued", jobId: "job_1" };
        },
        async processByEventId() {
          return { status: "processed" };
        },
        async processQueueJob() {},
      },
    });

    const capture = createResponseCapture();
    await handler(
      {
        headers: {},
        body: payload,
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(400);
  });

  test("returns 400 when payload was already parsed", async () => {
    const stripe = createFakeStripe();

    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: ["whsec_expected"],
      pipeline: {
        async ingest() {
          return { status: "queued", jobId: "job_1" };
        },
        async processByEventId() {
          return { status: "processed" };
        },
        async processQueueJob() {},
      },
    });

    const capture = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": "t=1,v1=invalid",
        },
        body: {
          parsed: true,
        },
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(400);
  });

  test("builds a router with route-local raw body middleware", () => {
    const handlers: ExpressLikeHandler[] = [];

    const expressModule: ExpressLikeModule = {
      Router() {
        return {
          post(_path: string, ...routeHandlers: ExpressLikeHandler[]) {
            handlers.push(...routeHandlers);
          },
        };
      },
      raw(_options) {
        return (_request, _response, next) => {
          next();
        };
      },
    };

    createStripeWebhookRouter({
      express: expressModule,
      stripe: createFakeStripe(),
      webhookSecrets: ["whsec_expected"],
      pipeline: {
        async ingest() {
          return { status: "queued", jobId: "job_1" };
        },
        async processByEventId() {
          return { status: "processed" };
        },
        async processQueueJob() {},
      },
    });

    expect(handlers.length).toBe(3);
  });

  test("reports startup diagnostics for missing required events", () => {
    const diagnostics = diagnoseStripeWebhookConfiguration({
      webhookSecrets: ["whsec_expected"],
      configuredEvents: ["charge.succeeded"],
    });

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings[0]?.includes("missing required events")).toBe(true);
  });
});
