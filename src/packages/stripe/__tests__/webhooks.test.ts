import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import {
  createStripeWebhookDelegator,
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
  requiredStripeWebhookEvents,
  verifyStripeWebhookEvent,
} from "../webhooks.ts";
import { toStripeWebhookPayload } from "../runtime-payload.ts";

function makeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: `evt_${type.replace(/[^a-z0-9]+/gi, "_")}`,
    object: "event",
    type,
    data: {
      object,
    },
  } as unknown as Stripe.Event;
}

describe("stripe webhook handlers", () => {
  test("provides handlers for every required Stripe event", () => {
    const handlers = createStripeWebhookHandlers({});

    for (const eventType of requiredStripeWebhookEvents) {
      expect(typeof handlers[eventType]).toBe("function");
    }
  });

  test("supports subscribe, unsubscribe, and all subscribers", async () => {
    const delegator = createStripeWebhookDelegator();
    const calls: string[] = [];

    const specificHandler = async () => {
      calls.push("specific");
    };

    const removeSpecific = delegator.subscribe("charge.succeeded", specificHandler);
    const removeAll = delegator.all(async () => {
      calls.push("all");
    });

    await delegator.publish({
      eventName: "stripe.charge.succeeded",
      event: makeEvent("charge.succeeded", { id: "ch_123" }),
      suppressed: false,
    });

    expect(calls).toEqual(["specific", "all"]);

    removeSpecific();
    removeAll();
    delegator.unsubscribe("charge.succeeded", specificHandler);

    await delegator.publish({
      eventName: "stripe.charge.succeeded",
      event: makeEvent("charge.succeeded", { id: "ch_123" }),
      suppressed: false,
    });

    expect(calls).toEqual(["specific", "all"]);
  });

  test("suppresses subscriber notifications for payment_intent.succeeded", async () => {
    const calls: string[] = [];
    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncChargeByPaymentIntentId(paymentIntentId) {
            calls.push(`sync:${paymentIntentId}`);
          },
        },
      }),
    });

    processor.delegator.all(async () => {
      calls.push("subscribed");
    });

    await processor.process(
      makeEvent("payment_intent.succeeded", {
        id: "pi_123",
      }),
    );

    expect(calls).toEqual(["sync:pi_123"]);
  });

  test("links checkout owners for completed and async payment succeeded events", async () => {
    const calls: string[] = [];
    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async linkCheckoutOwner(input) {
            calls.push(`${input.event.type}:${input.clientReferenceId}:${input.customerId}`);
          },
        },
      }),
    });

    await processor.process(
      makeEvent("checkout.session.completed", {
        id: "cs_1",
        client_reference_id: "User:1",
        customer: "cus_1",
      }),
    );

    await processor.process(
      makeEvent("checkout.session.async_payment_succeeded", {
        id: "cs_2",
        client_reference_id: "User:1",
        customer: "cus_1",
      }),
    );

    expect(calls).toEqual([
      "checkout.session.completed:User:1:cus_1",
      "checkout.session.async_payment_succeeded:User:1:cus_1",
    ]);
  });

  test("converts Uint8Array payloads into UTF-8 strings", async () => {
    const payloads: string[] = [];
    const stripe = {
      webhooks: {
        async constructEventAsync(payload: string): Promise<Stripe.Event> {
          payloads.push(payload);
          return makeEvent("charge.succeeded", { id: "ch_123" });
        },
      },
    } as unknown as Stripe;

    await verifyStripeWebhookEvent({
      stripe,
      payload: new Uint8Array([123, 34, 111, 107, 34, 58, 116, 114, 117, 101, 125]),
      signatureHeader: "t=1,v1=signed",
      webhookSecrets: ["whsec_test"],
    });

    expect(payloads).toEqual(['{"ok":true}']);
  });

  test("keeps string payloads unchanged", () => {
    expect(toStripeWebhookPayload('{"status":"ok"}')).toBe('{"status":"ok"}');
  });
});
