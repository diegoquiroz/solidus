import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import {
  createStripeWebhookDelegator,
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
  requiredStripeWebhookEvents,
} from "../webhooks.ts";

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
});
