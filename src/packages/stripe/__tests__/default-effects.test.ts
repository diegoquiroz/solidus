import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import type {
  ChargeRecord,
  ChargeRepository,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../../core/contracts.ts";
import type {
  StripeCustomerProjection,
  StripeCustomerProjectionRepository,
} from "../core-apis.ts";
import {
  type StripeInvoiceProjection,
  type StripeInvoiceProjectionRepository,
  createDefaultStripeWebhookEffects,
} from "../default-webhook-effects.ts";
import {
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
} from "../webhooks.ts";

class InMemoryCustomerRepo implements StripeCustomerProjectionRepository {
  readonly values = new Map<string, StripeCustomerProjection>();

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    this.values.set(customer.processorId, customer);
  }

  async findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null> {
    return this.values.get(processorId) ?? null;
  }
}

class InMemoryPaymentMethodRepo implements PaymentMethodRepository {
  readonly values = new Map<string, PaymentMethodRecord>();

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    this.values.set(paymentMethod.processorId, paymentMethod);
  }

  async clearDefaultForCustomer(customerProcessorId: string): Promise<void> {
    for (const paymentMethod of this.values.values()) {
      if (paymentMethod.customerProcessorId === customerProcessorId) {
        paymentMethod.isDefault = false;
      }
    }
  }

  async deleteByProcessorId(processorId: string): Promise<void> {
    this.values.delete(processorId);
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]> {
    return Array.from(this.values.values()).filter((value) => value.customerProcessorId === customerProcessorId);
  }
}

class InMemoryChargeRepo implements ChargeRepository {
  readonly values = new Map<string, ChargeRecord>();

  async upsert(charge: ChargeRecord): Promise<void> {
    this.values.set(charge.processorId, charge);
  }

  async findByProcessorId(processorId: string): Promise<ChargeRecord | null> {
    return this.values.get(processorId) ?? null;
  }
}

class InMemorySubscriptionRepo implements SubscriptionRepository {
  readonly values = new Map<string, SubscriptionRecord>();

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    this.values.set(subscription.processorId, subscription);
  }

  async findByProcessorId(processorId: string): Promise<SubscriptionRecord | null> {
    return this.values.get(processorId) ?? null;
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]> {
    return Array.from(this.values.values()).filter((value) => value.customerProcessorId === customerProcessorId);
  }
}

class InMemoryInvoiceRepo implements StripeInvoiceProjectionRepository {
  readonly values = new Map<string, StripeInvoiceProjection>();

  async upsert(invoice: StripeInvoiceProjection): Promise<void> {
    this.values.set(invoice.processorId, invoice);
  }
}

function makeEvent(type: string, id: string): Stripe.Event {
  return {
    id: `evt_${type.replace(/[^a-z0-9]+/gi, "_")}`,
    object: "event",
    type,
    data: {
      object: {
        id,
      },
    },
  } as unknown as Stripe.Event;
}

function makeEventWithObject(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: `evt_${type.replace(/[^a-z0-9]+/gi, "_")}`,
    object: "event",
    type,
    data: {
      object,
    },
  } as unknown as Stripe.Event;
}

function createFakeStripe(): Stripe {
  const customers = new Map<string, Stripe.Customer>();
  const paymentMethods = new Map<string, Stripe.PaymentMethod>();
  const charges = new Map<string, Stripe.Charge>();
  const paymentIntents = new Map<string, Stripe.PaymentIntent>();
  const subscriptions = new Map<string, Stripe.Subscription>();
  const invoices = new Map<string, Stripe.Invoice>();

  customers.set("cus_1", {
    id: "cus_1",
    object: "customer",
    email: "user@example.com",
    metadata: {},
    invoice_settings: {
      default_payment_method: "pm_1",
    },
  } as Stripe.Customer);

  paymentMethods.set("pm_1", {
    id: "pm_1",
    object: "payment_method",
    customer: "cus_1",
    type: "card",
    card: {
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2030,
    },
  } as Stripe.PaymentMethod);

  charges.set("ch_1", {
    id: "ch_1",
    object: "charge",
    amount: 1250,
    amount_refunded: 250,
    currency: "usd",
    status: "succeeded",
    customer: "cus_1",
    payment_intent: "pi_1",
    receipt_url: "https://stripe.test/receipt",
    balance_transaction: "txn_1",
    payment_method_details: {
      type: "card",
    },
  } as Stripe.Charge);

  paymentIntents.set("pi_1", {
    id: "pi_1",
    object: "payment_intent",
    customer: "cus_1",
    amount: 1250,
    currency: "usd",
    amount_details: {
      tax: {
        total_tax_amount: 150,
      },
      line_items: {
        object: "list",
        data: [
          {
            id: "li_1",
            object: "payment_intent_amount_details_line_item",
            discount_amount: null,
            payment_method_options: null,
            product_code: null,
            product_name: "Base",
            quantity: 1,
            tax: {
              total_tax_amount: 100,
            },
            unit_cost: 1000,
            unit_of_measure: null,
          },
          {
            id: "li_2",
            object: "payment_intent_amount_details_line_item",
            discount_amount: null,
            payment_method_options: null,
            product_code: null,
            product_name: "Addon",
            quantity: 1,
            tax: {
              total_tax_amount: 50,
            },
            unit_cost: 250,
            unit_of_measure: null,
          },
        ],
        has_more: false,
        url: "/v1/payment_intents/pi_1/amount_details_line_items",
      },
    },
    status: "succeeded",
    latest_charge: "ch_1",
  } as Stripe.PaymentIntent);

  subscriptions.set("sub_1", {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1,
    current_period_end: 2,
    trial_end: null,
    pause_collection: null,
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          quantity: 1,
          price: {
            id: "price_1",
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription);

  invoices.set("in_1", {
    id: "in_1",
    object: "invoice",
    customer: "cus_1",
    subscription: "sub_1",
    status: "open",
    amount_due: 500,
    amount_paid: 0,
    currency: "usd",
    due_date: 3,
    status_transitions: {
      paid_at: null,
    },
  } as unknown as Stripe.Invoice);

  return {
    customers: {
      retrieve: async (id: string) => customers.get(id) as Stripe.Customer,
    },
    paymentMethods: {
      retrieve: async (id: string) => paymentMethods.get(id) as Stripe.PaymentMethod,
    },
    charges: {
      retrieve: async (id: string) => charges.get(id) as Stripe.Charge,
    },
    paymentIntents: {
      retrieve: async (id: string) => paymentIntents.get(id) as Stripe.PaymentIntent,
    },
    subscriptions: {
      retrieve: async (id: string) => subscriptions.get(id) as Stripe.Subscription,
    },
    invoices: {
      retrieve: async (id: string) => invoices.get(id) as Stripe.Invoice,
    },
  } as unknown as Stripe;
}

describe("stripe default webhook effects", () => {
  test("default effects map normalized webhook events to projection repository writes", async () => {
    const customerRepo = new InMemoryCustomerRepo();
    const paymentMethodRepo = new InMemoryPaymentMethodRepo();
    const chargeRepo = new InMemoryChargeRepo();
    const subscriptionRepo = new InMemorySubscriptionRepo();
    const invoiceRepo = new InMemoryInvoiceRepo();
    const stripe = createFakeStripe();

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe,
          repositories: {
            customers: customerRepo,
            paymentMethods: paymentMethodRepo,
            charges: chargeRepo,
            subscriptions: subscriptionRepo,
            invoices: invoiceRepo,
          },
        }),
      }),
    });

    await processor.process(makeEvent("customer.updated", "cus_1"));
    await processor.process(makeEvent("payment_method.updated", "pm_1"));
    await processor.process(makeEvent("charge.refunded", "ch_1"));
    await processor.process(makeEvent("invoice.payment_failed", "in_1"));
    await processor.process(makeEvent("customer.subscription.updated", "sub_1"));

    expect(customerRepo.values.get("cus_1")?.processorId).toBe("cus_1");
    expect(paymentMethodRepo.values.get("pm_1")?.isDefault).toBe(true);
    expect(chargeRepo.values.get("ch_1")?.refundTotal).toBe(250);
    expect(chargeRepo.values.get("ch_1")?.taxAmount).toBe(150);
    expect(chargeRepo.values.get("ch_1")?.totalTaxAmounts).toEqual([100, 50]);
    expect(invoiceRepo.values.get("in_1")?.status).toBe("open");
    expect(subscriptionRepo.values.get("sub_1")?.priceId).toBe("price_1");
  });

  test("default effects preserve idempotent projection writes for duplicate deliveries", async () => {
    const customerRepo = new InMemoryCustomerRepo();
    const chargeRepo = new InMemoryChargeRepo();
    const subscriptionRepo = new InMemorySubscriptionRepo();
    const invoiceRepo = new InMemoryInvoiceRepo();
    const stripe = createFakeStripe();

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe,
          repositories: {
            customers: customerRepo,
            charges: chargeRepo,
            subscriptions: subscriptionRepo,
            invoices: invoiceRepo,
          },
        }),
      }),
    });

    await processor.process(makeEvent("payment_intent.succeeded", "pi_1"));
    await processor.process(makeEvent("payment_intent.succeeded", "pi_1"));
    await processor.process(makeEvent("customer.updated", "cus_1"));
    await processor.process(makeEvent("customer.updated", "cus_1"));
    await processor.process(makeEvent("customer.subscription.updated", "sub_1"));
    await processor.process(makeEvent("customer.subscription.updated", "sub_1"));
    await processor.process(makeEvent("invoice.payment_failed", "in_1"));
    await processor.process(makeEvent("invoice.payment_failed", "in_1"));

    expect(customerRepo.values.size).toBe(1);
    expect(chargeRepo.values.size).toBe(1);
    expect(subscriptionRepo.values.size).toBe(1);
    expect(invoiceRepo.values.size).toBe(1);
  });

  test("default effects resolve connected account context per customer and prevent leakage", async () => {
    const customerRepo = new InMemoryCustomerRepo();
    const invoiceRepo = new InMemoryInvoiceRepo();
    const seenInvoiceOptions: Array<Stripe.RequestOptions | undefined> = [];

    const stripe = {
      customers: {
        retrieve: async (id: string, requestOptions?: Stripe.RequestOptions) => ({
          id,
          object: "customer",
          email: `${id}@example.com`,
          metadata: {},
          invoice_settings: {},
          requestOptions,
        } as unknown as Stripe.Customer),
      },
      invoices: {
        retrieve: async (id: string, requestOptions?: Stripe.RequestOptions) => {
          seenInvoiceOptions.push(requestOptions);
          return {
            id,
            object: "invoice",
            customer: id === "in_a" ? "cus_a" : "cus_b",
            status: "open",
            amount_due: 100,
            amount_paid: 0,
            status_transitions: {
              paid_at: null,
            },
          } as unknown as Stripe.Invoice;
        },
      },
    } as unknown as Stripe;

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe,
          repositories: {
            customers: customerRepo,
            invoices: invoiceRepo,
          },
        }),
      }),
    });

    const customerAUpdated = makeEvent("customer.updated", "cus_a");
    customerAUpdated.account = "acct_a";
    await processor.process(customerAUpdated);

    const customerBUpdated = makeEvent("customer.updated", "cus_b");
    customerBUpdated.account = "acct_b";
    await processor.process(customerBUpdated);

    await processor.process(makeEventWithObject("invoice.payment_failed", { id: "in_a", customer: "cus_a" }));
    await processor.process(makeEventWithObject("invoice.payment_failed", { id: "in_b", customer: "cus_b" }));

    expect(customerRepo.values.get("cus_a")?.connectedAccountId).toBe("acct_a");
    expect(customerRepo.values.get("cus_b")?.connectedAccountId).toBe("acct_b");
    expect(seenInvoiceOptions[0]?.stripeAccount).toBe("acct_a");
    expect(seenInvoiceOptions[1]?.stripeAccount).toBe("acct_b");
    expect(seenInvoiceOptions[1]?.stripeAccount).not.toBe("acct_a");
  });
});
