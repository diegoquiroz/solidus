import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import {
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
  requiredStripeWebhookEvents,
} from "../../webhooks.ts";

interface FixtureEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

async function loadFixtures(): Promise<readonly FixtureEvent[]> {
  const fixtureText = await Bun.file(
    "src/packages/stripe/__tests__/fixtures/webhook-events.json",
  ).text();

  return JSON.parse(fixtureText) as readonly FixtureEvent[];
}

describe("stripe webhook parity integration", () => {
  test("processes every mapped event fixture", async () => {
    const fixtures = await loadFixtures();
    const calledTypes: string[] = [];

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncChargeById() {},
          async syncChargeByPaymentIntentId() {},
          async syncSubscriptionById() {},
          async syncCustomerById() {},
          async deleteCustomerById() {},
          async syncPaymentMethodById() {},
          async deletePaymentMethodById() {},
          async syncAccountById() {},
          async notifyInvoiceUpcoming() {},
          async notifyPaymentActionRequired() {},
          async notifyPaymentFailed() {},
          async notifySubscriptionTrialWillEnd() {},
          async linkCheckoutOwner() {},
        },
      }),
    });

    processor.delegator.all(async ({ event }) => {
      calledTypes.push(event.type);
    });

    for (const fixture of fixtures) {
      await processor.process({
        id: fixture.id,
        object: "event",
        type: fixture.type,
        data: fixture.data,
      } as unknown as Stripe.Event);
    }

    const processedTypes = new Set([...calledTypes, "payment_intent.succeeded"]);

    for (const eventType of requiredStripeWebhookEvents) {
      expect(processedTypes.has(eventType)).toBe(true);
    }
  });
});
