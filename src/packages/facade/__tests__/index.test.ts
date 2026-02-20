import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import { createSolidusFacade } from "../index.ts";

describe("facade package", () => {
  test("creates facade with stripe api and webhook processor", () => {
    const stripe = {} as Stripe;
    const facade = createSolidusFacade({ stripe });

    expect(typeof facade.api.customers.create).toBe("function");
    expect(typeof facade.api.subscriptions.create).toBe("function");
    expect(typeof facade.webhooks.process).toBe("function");
    expect(facade.webhooks.delegator.listening("charge.succeeded")).toBe(false);
  });
});
