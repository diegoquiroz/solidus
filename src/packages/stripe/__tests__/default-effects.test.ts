import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import type {
  ChargeRecord,
  ChargeRepository,
  CustomerRecord,
  CustomerRepository,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../../core/contracts.ts";
import { createCustomerRegistry, registerCustomerModel } from "../../core/registration.ts";
import type {
  StripeAccountProjection,
  StripeAccountProjectionRepository,
  StripeCustomerProjection,
  StripeCustomerProjectionRepository,
} from "../core-apis.ts";
import {
  type StripeInvoiceProjection,
  type StripeInvoiceProjectionRepository,
  createDefaultStripeWebhookEffects,
} from "../default-webhook-effects.ts";
import {
  CheckoutOwnerMismatchError,
  MalformedCheckoutClientReferenceError,
  UnknownCheckoutClientReferenceModelError,
} from "../errors.ts";
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

class InMemoryOwnerCustomerRepo implements CustomerRepository {
  readonly values = new Map<string, CustomerRecord>();
  saveCalls = 0;

  async save(customer: CustomerRecord): Promise<void> {
    this.saveCalls += 1;
    this.values.set(`${customer.ownerType}:${customer.ownerId}`, customer);
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    const value = this.values.get(`${input.ownerType}:${input.ownerId}`);

    if (value === undefined) {
      return null;
    }

    if (input.processor !== undefined && value.processor !== input.processor) {
      return null;
    }

    return value;
  }

  async findByProcessor(input: { processor: string; processorId: string }): Promise<CustomerRecord | null> {
    for (const value of this.values.values()) {
      if (value.processor === input.processor && value.processorId === input.processorId) {
        return value;
      }
    }

    return null;
  }
}

class InMemoryAccountRepo implements StripeAccountProjectionRepository {
  readonly values = new Map<string, StripeAccountProjection>();

  async upsert(account: StripeAccountProjection): Promise<void> {
    this.values.set(account.processorId, account);
  }

  async findByProcessorId(processorId: string): Promise<StripeAccountProjection | null> {
    return this.values.get(processorId) ?? null;
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
  const accounts = new Map<string, Stripe.Account>();

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

  accounts.set("acct_1", {
    id: "acct_1",
    object: "account",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements: {
      currently_due: ["business_profile.mcc"],
      eventually_due: ["external_account"],
      past_due: [],
      pending_verification: [],
      disabled_reason: "requirements.past_due",
    },
  } as unknown as Stripe.Account);

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
    accounts: {
      retrieve: async (id: string) => accounts.get(id) as Stripe.Account,
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

  test("default effects link checkout owners for completed and async checkout events", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await processor.process(
      makeEventWithObject("checkout.session.completed", {
        id: "cs_complete",
        client_reference_id: "User:42",
        customer: "cus_1",
      }),
    );

    await processor.process(
      makeEventWithObject("checkout.session.async_payment_succeeded", {
        id: "cs_async",
        client_reference_id: "User:42",
        customer: "cus_1",
      }),
    );

    expect(ownerRepo.values.get("User:42")?.processorId).toBe("cus_1");
    expect(ownerRepo.saveCalls).toBe(1);
  });

  test("default effects keep checkout linking idempotent on replay", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    const event = makeEventWithObject("checkout.session.completed", {
      id: "cs_replay",
      client_reference_id: "User:42",
      customer: "cus_1",
    });
    await processor.process(event);
    await processor.process(event);

    expect(ownerRepo.values.get("User:42")?.processorId).toBe("cus_1");
    expect(ownerRepo.saveCalls).toBe(1);
  });

  test("default effects keep checkout + payment_intent replay writes idempotent", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const chargeRepo = new InMemoryChargeRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
            charges: chargeRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await processor.process(
      makeEventWithObject("checkout.session.completed", {
        id: "cs_with_payment_intent",
        client_reference_id: "User:42",
        customer: "cus_1",
        payment_intent: "pi_1",
      }),
    );

    await processor.process(makeEvent("payment_intent.succeeded", "pi_1"));

    expect(ownerRepo.values.get("User:42")?.processorId).toBe("cus_1");
    expect(ownerRepo.saveCalls).toBe(1);
    expect(chargeRepo.values.size).toBe(1);
    expect(chargeRepo.values.get("ch_1")?.processorId).toBe("ch_1");
  });

  test("default effects resolve default model for bare checkout references", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await processor.process(
      makeEventWithObject("checkout.session.completed", {
        id: "cs_bare_ref",
        client_reference_id: "42",
        customer: "cus_1",
      }),
    );

    expect(ownerRepo.values.get("User:42")?.processorId).toBe("cus_1");
  });

  test("default effects skip owner linking when checkout reference or customer is missing", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await processor.process(
      makeEventWithObject("checkout.session.completed", {
        id: "cs_missing_ref",
        customer: "cus_1",
      }),
    );
    await processor.process(
      makeEventWithObject("checkout.session.async_payment_succeeded", {
        id: "cs_missing_customer",
        client_reference_id: "User:42",
      }),
    );

    expect(ownerRepo.values.size).toBe(0);
    expect(ownerRepo.saveCalls).toBe(0);
  });

  test("default effects reject malformed and unknown checkout client references", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await expect(
      processor.process(
        makeEventWithObject("checkout.session.completed", {
          id: "cs_bad",
          client_reference_id: "User:",
          customer: "cus_1",
        }),
      ),
    ).rejects.toBeInstanceOf(MalformedCheckoutClientReferenceError);

    await expect(
      processor.process(
        makeEventWithObject("checkout.session.completed", {
          id: "cs_unknown",
          client_reference_id: "Team:99",
          customer: "cus_1",
        }),
      ),
    ).rejects.toBeInstanceOf(UnknownCheckoutClientReferenceModelError);
  });

  test("default effects enforce owner mismatch guardrails", async () => {
    const ownerRepo = new InMemoryOwnerCustomerRepo();
    await ownerRepo.save({
      id: "stripe_owner_User_42",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_existing",
    });
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: createFakeStripe(),
          repositories: {
            ownerCustomers: ownerRepo,
          },
          customerRegistry,
        }),
      }),
    });

    await expect(
      processor.process(
        makeEventWithObject("checkout.session.completed", {
          id: "cs_mismatch",
          client_reference_id: "User:42",
          customer: "cus_1",
        }),
      ),
    ).rejects.toBeInstanceOf(CheckoutOwnerMismatchError);
  });

  test("default effects sync connected account projections from account.updated transitions", async () => {
    const accountRepo = new InMemoryAccountRepo();
    const stripe = {
      accounts: {
        retrieve: async (id: string) => {
          if (id === "acct_1") {
            return {
              id,
              object: "account",
              charges_enabled: true,
              payouts_enabled: false,
              details_submitted: true,
              requirements: {
                currently_due: [],
                eventually_due: [],
                past_due: ["external_account"],
                pending_verification: ["company.tax_id"],
                disabled_reason: "requirements.past_due",
              },
            } as unknown as Stripe.Account;
          }

          return {
            id,
            object: "account",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements: {
              currently_due: [],
              eventually_due: [],
              past_due: [],
              pending_verification: [],
            },
          } as unknown as Stripe.Account;
        },
      },
    } as unknown as Stripe;

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe,
          repositories: {
            accounts: accountRepo,
          },
        }),
      }),
    });

    await processor.process(makeEvent("account.updated", "acct_1"));
    await processor.process(makeEvent("account.updated", "acct_2"));

    expect(accountRepo.values.get("acct_1")?.payoutsEnabled).toBe(false);
    expect(accountRepo.values.get("acct_1")?.pastDue).toEqual(["external_account"]);
    expect(accountRepo.values.get("acct_2")?.payoutsEnabled).toBe(true);
    expect(accountRepo.values.get("acct_2")?.pastDue).toEqual([]);
  });
});
