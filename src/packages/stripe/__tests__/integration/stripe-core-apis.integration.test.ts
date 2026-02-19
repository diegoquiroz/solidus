import { describe, expect, test } from "bun:test";
import Stripe from "stripe";
import { createStripeCoreApi } from "../../core-apis.ts";

const secretKey = Bun.env.STRIPE_SECRET_KEY;
const hasSecret = typeof secretKey === "string" && secretKey.trim().length > 0;
const testIfStripeConfigured = hasSecret ? test : test.skip;

describe("stripe core APIs integration", () => {
  testIfStripeConfigured("creates and updates customers in Stripe test mode", async () => {
    const stripe = new Stripe(secretKey as string, { maxNetworkRetries: 2 });
    const api = createStripeCoreApi({ stripe });

    const email = `solidus-m2-${Date.now()}@example.com`;
    const customer = await api.customers.create({ email, name: "Solidus Test" });
    const updated = await api.customers.update(customer.id, { name: "Solidus Updated" });
    const reconciled = await api.customers.reconcileByEmail({ email, limit: 1 });

    expect(updated.name).toBe("Solidus Updated");
    expect(reconciled[0]?.id).toBe(customer.id);
  });
});
