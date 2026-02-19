import { describe, expect, test } from "bun:test";
import Stripe from "stripe";
import type {
  ChargeRecord,
  ChargeRepository,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../../core/contracts.ts";
import { ActionRequiredError, ProviderError } from "../../core/errors.ts";
import {
  type StripeCustomerProjection,
  type StripeCustomerProjectionRepository,
  createStripeCoreApi,
} from "../core-apis.ts";

class InMemoryCustomerRepo implements StripeCustomerProjectionRepository {
  readonly values: StripeCustomerProjection[] = [];

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    const index = this.values.findIndex((value) => value.processorId === customer.processorId);

    if (index === -1) {
      this.values.push(customer);
      return;
    }

    this.values[index] = customer;
  }
}

class InMemoryPaymentMethodRepo implements PaymentMethodRepository {
  readonly values: PaymentMethodRecord[] = [];

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    const index = this.values.findIndex((value) => value.processorId === paymentMethod.processorId);

    if (index === -1) {
      this.values.push(paymentMethod);
      return;
    }

    this.values[index] = paymentMethod;
  }

  async clearDefaultForCustomer(customerProcessorId: string): Promise<void> {
    for (const paymentMethod of this.values) {
      if (paymentMethod.customerProcessorId === customerProcessorId) {
        paymentMethod.isDefault = false;
      }
    }
  }

  async deleteByProcessorId(processorId: string): Promise<void> {
    const index = this.values.findIndex((value) => value.processorId === processorId);

    if (index !== -1) {
      this.values.splice(index, 1);
    }
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]> {
    return this.values.filter((value) => value.customerProcessorId === customerProcessorId);
  }
}

class InMemoryChargeRepo implements ChargeRepository {
  readonly values: ChargeRecord[] = [];

  async upsert(charge: ChargeRecord): Promise<void> {
    const index = this.values.findIndex((value) => value.processorId === charge.processorId);

    if (index === -1) {
      this.values.push(charge);
      return;
    }

    this.values[index] = charge;
  }

  async findByProcessorId(processorId: string): Promise<ChargeRecord | null> {
    return this.values.find((value) => value.processorId === processorId) ?? null;
  }
}

class InMemorySubscriptionRepo implements SubscriptionRepository {
  readonly values: SubscriptionRecord[] = [];

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    const index = this.values.findIndex((value) => value.processorId === subscription.processorId);

    if (index === -1) {
      this.values.push(subscription);
      return;
    }

    this.values[index] = subscription;
  }

  async findByProcessorId(processorId: string): Promise<SubscriptionRecord | null> {
    return this.values.find((value) => value.processorId === processorId) ?? null;
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]> {
    return this.values.filter((value) => value.customerProcessorId === customerProcessorId);
  }
}

function createFakeStripe(): Stripe {
  const customers = new Map<string, Stripe.Customer>();
  const paymentMethods = new Map<string, Stripe.PaymentMethod>();
  const paymentIntents = new Map<string, Stripe.PaymentIntent>();
  const charges = new Map<string, Stripe.Charge>();
  const subscriptions = new Map<string, Stripe.Subscription>();

  const createCustomer = async (params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> => {
    const customer = {
      id: `cus_${customers.size + 1}`,
      object: "customer",
      email: params.email ?? null,
      name: params.name ?? null,
      metadata: (params.metadata ?? {}) as Stripe.Metadata,
      invoice_settings: {
        default_payment_method: null,
      },
    } as Stripe.Customer;
    customers.set(customer.id, customer);
    return customer;
  };

  const retrieveCustomer = async (id: string): Promise<Stripe.Customer> => {
    const customer = customers.get(id);

    if (!customer) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return customer;
  };

  const updateCustomer = async (
    id: string,
    params: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> => {
    const customer = await retrieveCustomer(id);
    customer.email = params.email ?? customer.email;
    customer.name = params.name ?? customer.name;

    if (params.metadata) {
      customer.metadata = params.metadata as Stripe.Metadata;
    }

    if (params.invoice_settings?.default_payment_method) {
      customer.invoice_settings.default_payment_method =
        params.invoice_settings.default_payment_method;
    }

    customers.set(customer.id, customer);
    return customer;
  };

  const attachPaymentMethod = async (
    paymentMethodId: string,
    params: Stripe.PaymentMethodAttachParams,
  ): Promise<Stripe.PaymentMethod> => {
    const paymentMethod = {
      id: paymentMethodId,
      object: "payment_method",
      customer: params.customer,
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2030,
      },
    } as Stripe.PaymentMethod;

    paymentMethods.set(paymentMethod.id, paymentMethod);
    return paymentMethod;
  };

  const updatePaymentMethod = async (
    paymentMethodId: string,
    _params: Stripe.PaymentMethodUpdateParams,
  ): Promise<Stripe.PaymentMethod> => {
    const paymentMethod = paymentMethods.get(paymentMethodId);

    if (!paymentMethod) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return paymentMethod;
  };

  const retrievePaymentMethod = async (paymentMethodId: string): Promise<Stripe.PaymentMethod> => {
    const paymentMethod = paymentMethods.get(paymentMethodId);

    if (!paymentMethod) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return paymentMethod;
  };

  const detachPaymentMethod = async (paymentMethodId: string): Promise<Stripe.PaymentMethod> => {
    const paymentMethod = await retrievePaymentMethod(paymentMethodId);
    paymentMethods.delete(paymentMethodId);
    return paymentMethod;
  };

  const createPaymentIntent = async (
    params: Stripe.PaymentIntentCreateParams,
  ): Promise<Stripe.PaymentIntent> => {
    if (params.amount === 4000) {
      throw { type: "StripeCardError", code: "card_declined", message: "Declined" };
    }

    const id = `pi_${paymentIntents.size + 1}`;
    const chargeId = `ch_${charges.size + 1}`;
    const charge = {
      id: chargeId,
      object: "charge",
      amount: params.amount,
      amount_refunded: 0,
      amount_captured: params.capture_method === "manual" ? 0 : params.amount,
      balance_transaction: "txn_1",
      receipt_url: "https://stripe.test/receipt",
      payment_method_details: {
        type: "card",
      },
    } as Stripe.Charge;

    const paymentIntent = {
      id,
      object: "payment_intent",
      customer: params.customer as string,
      amount: params.amount,
      currency: params.currency,
      status: params.capture_method === "manual" ? "requires_capture" : "succeeded",
      latest_charge: chargeId,
      payment_method: params.payment_method,
    } as Stripe.PaymentIntent;

    charges.set(chargeId, charge);
    paymentIntents.set(id, paymentIntent);

    return paymentIntent;
  };

  const capturePaymentIntent = async (
    id: string,
    _params: Stripe.PaymentIntentCaptureParams,
  ): Promise<Stripe.PaymentIntent> => {
    const paymentIntent = paymentIntents.get(id);

    if (!paymentIntent) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    paymentIntent.status = "succeeded";
    paymentIntents.set(id, paymentIntent);
    return paymentIntent;
  };

  const retrievePaymentIntent = async (id: string): Promise<Stripe.PaymentIntent> => {
    const paymentIntent = paymentIntents.get(id);

    if (!paymentIntent) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return paymentIntent;
  };

  const retrieveCharge = async (id: string): Promise<Stripe.Charge> => {
    const charge = charges.get(id);

    if (!charge) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return charge;
  };

  const createRefund = async (params: Stripe.RefundCreateParams): Promise<Stripe.Refund> => {
    const paymentIntent = await retrievePaymentIntent(params.payment_intent as string);
    const charge = await retrieveCharge(paymentIntent.latest_charge as string);
    charge.amount_refunded += params.amount ?? paymentIntent.amount;
    charges.set(charge.id, charge);

    return {
      id: "re_1",
      object: "refund",
      amount: params.amount ?? paymentIntent.amount,
    } as Stripe.Refund;
  };

  const createSubscription = async (
    params: Stripe.SubscriptionCreateParams,
  ): Promise<Stripe.Subscription> => {
    const subscription = {
      id: `sub_${subscriptions.size + 1}`,
      object: "subscription",
      customer: params.customer,
      status: "active",
      cancel_at_period_end: false,
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60,
      trial_end: null,
      pause_collection: null,
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            object: "subscription_item",
            quantity: params.items?.[0]?.quantity,
            price: {
              id: (params.items?.[0] as { price?: string } | undefined)?.price ?? "price_default",
            },
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    subscriptions.set(subscription.id, subscription);
    return subscription;
  };

  const retrieveSubscription = async (id: string): Promise<Stripe.Subscription> => {
    const subscription = subscriptions.get(id);

    if (!subscription) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return subscription;
  };

  const updateSubscription = async (
    id: string,
    params: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> => {
    const subscription = await retrieveSubscription(id);
    subscription.cancel_at_period_end = params.cancel_at_period_end ?? subscription.cancel_at_period_end;

    if (params.pause_collection !== undefined) {
      subscription.pause_collection = params.pause_collection as Stripe.Subscription.PauseCollection;
    }

    const firstItem = subscription.items.data[0];

    if (params.items?.[0]?.quantity !== undefined && firstItem) {
      firstItem.quantity = params.items[0].quantity;
    }

    if (params.items?.[0]?.price !== undefined && firstItem) {
      firstItem.price.id = params.items[0].price;
    }

    subscriptions.set(id, subscription);
    return subscription;
  };

  const cancelSubscription = async (id: string): Promise<Stripe.Subscription> => {
    const subscription = await retrieveSubscription(id);
    subscription.status = "canceled";
    subscriptions.set(id, subscription);
    return subscription;
  };

  const listInvoices = async (): Promise<Stripe.ApiList<Stripe.Invoice>> => {
    return {
      object: "list",
      data: [
        {
          id: "in_1",
          object: "invoice",
        },
      ],
      has_more: false,
      url: "/v1/invoices",
    } as Stripe.ApiList<Stripe.Invoice>;
  };

  return {
    customers: {
      create: createCustomer,
      retrieve: retrieveCustomer,
      update: updateCustomer,
      list: async (params: Stripe.CustomerListParams) => {
        const data = Array.from(customers.values()).filter((customer) => customer.email === params.email);
        return {
          object: "list",
          data,
          has_more: false,
          url: "/v1/customers",
        } as Stripe.ApiList<Stripe.Customer>;
      },
    },
    paymentMethods: {
      attach: attachPaymentMethod,
      update: updatePaymentMethod,
      retrieve: retrievePaymentMethod,
      detach: detachPaymentMethod,
    },
    paymentIntents: {
      create: createPaymentIntent,
      capture: capturePaymentIntent,
      retrieve: retrievePaymentIntent,
    },
    charges: {
      retrieve: retrieveCharge,
    },
    refunds: {
      create: createRefund,
    },
    subscriptions: {
      create: createSubscription,
      retrieve: retrieveSubscription,
      update: updateSubscription,
      cancel: cancelSubscription,
    },
    invoices: {
      list: listInvoices,
      pay: async (_id: string) => ({ id: "in_1", object: "invoice" }) as Stripe.Invoice,
    },
  } as unknown as Stripe;
}

describe("stripe core APIs", () => {
  test("creates, updates, and reconciles customers", async () => {
    const customerRepo = new InMemoryCustomerRepo();
    const api = createStripeCoreApi({
      stripe: createFakeStripe(),
      repositories: { customers: customerRepo },
      customerAttributeMapper: () => ({ source: "solidus" }),
    });

    const created = await api.customers.create({
      email: "user@example.com",
      name: "User",
    });
    const updated = await api.customers.update(created.id, {
      name: "Updated User",
    });
    const reconciled = await api.customers.reconcileByEmail({ email: "user@example.com" });

    expect(updated.name).toBe("Updated User");
    expect(reconciled.length).toBe(1);
    expect(customerRepo.values[0]?.processorId).toBe(created.id);
  });

  test("manages payment methods and default switching", async () => {
    const paymentMethodRepo = new InMemoryPaymentMethodRepo();
    const api = createStripeCoreApi({
      stripe: createFakeStripe(),
      repositories: { paymentMethods: paymentMethodRepo },
    });

    await api.customers.create({ email: "pm@example.com" });
    const first = await api.paymentMethods.add({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      setAsDefault: true,
    });
    await api.paymentMethods.add({
      customerId: "cus_1",
      paymentMethodId: "pm_2",
      setAsDefault: false,
    });
    await api.paymentMethods.setDefault({ customerId: "cus_1", paymentMethodId: "pm_2" });
    await api.paymentMethods.detach("pm_1");

    const methods = await paymentMethodRepo.listByCustomer("cus_1");
    expect(first.brand).toBe("visa");
    expect(methods.length).toBe(1);
    expect(methods[0]?.processorId).toBe("pm_2");
    expect(methods[0]?.isDefault).toBe(true);
  });

  test("creates charges, supports capture and refund", async () => {
    const chargeRepo = new InMemoryChargeRepo();
    const api = createStripeCoreApi({
      stripe: createFakeStripe(),
      repositories: { charges: chargeRepo },
    });

    await api.customers.create({ email: "charge@example.com" });
    await api.paymentMethods.add({ customerId: "cus_1", paymentMethodId: "pm_1" });

    const charged = await api.charges.charge({
      customerId: "cus_1",
      amount: 1200,
      currency: "usd",
      paymentMethodId: "pm_1",
    });

    const authorized = await api.charges.authorize({
      customerId: "cus_1",
      amount: 2400,
      currency: "usd",
      paymentMethodId: "pm_1",
    });

    const captured = await api.charges.capture({ paymentIntentId: "pi_2" });
    const refunded = await api.charges.refund({ paymentIntentId: "pi_1", amount: 200 });

    expect(charged.receiptUrl).toBe("https://stripe.test/receipt");
    expect(authorized.status).toBe("requires_capture");
    expect(captured.status).toBe("succeeded");
    expect(refunded.refundTotal).toBe(200);
    expect(chargeRepo.values.length).toBeGreaterThan(0);
  });

  test("wraps provider errors from stripe", async () => {
    const api = createStripeCoreApi({ stripe: createFakeStripe() });
    await api.customers.create({ email: "error@example.com" });

    await expect(
      api.charges.charge({
        customerId: "cus_1",
        amount: 4000,
        currency: "usd",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  test("runs subscription lifecycle and state helpers", async () => {
    const subscriptionRepo = new InMemorySubscriptionRepo();
    const api = createStripeCoreApi({
      stripe: createFakeStripe(),
      repositories: { subscriptions: subscriptionRepo },
    });

    await api.customers.create({ email: "sub@example.com" });

    const created = await api.subscriptions.create({
      customerId: "cus_1",
      priceId: "price_basic",
      quantity: 1,
    });

    const canceled = await api.subscriptions.cancel(created.processorId);
    const resumed = await api.subscriptions.resume(created.processorId);
    const swapped = await api.subscriptions.swap({
      subscriptionId: created.processorId,
      priceId: "price_pro",
      quantity: 2,
    });
    const changed = await api.subscriptions.changeQuantity({
      subscriptionId: created.processorId,
      quantity: 5,
    });
    const paused = await api.subscriptions.pause({
      subscriptionId: created.processorId,
      behavior: "void",
    });
    const unpaused = await api.subscriptions.unpause(created.processorId);
    const invoices = await api.subscriptions.payOpenInvoices("cus_1");
    const retryInvoices = await api.subscriptions.retryFailedPayment(created.processorId);

    expect(canceled.cancelAtPeriodEnd).toBe(true);
    expect(resumed.cancelAtPeriodEnd).toBe(false);
    expect(swapped.priceId).toBe("price_pro");
    expect(changed.quantity).toBe(5);
    expect(api.state.paused(paused)).toBe(true);
    expect(api.state.paused(unpaused)).toBe(false);
    expect(api.state.subscribed(unpaused)).toBe(true);
    expect(api.state.active(unpaused)).toBe(true);
    expect(api.state.billingPeriod(unpaused).endsAt).toBeDefined();
    expect(invoices.length).toBe(1);
    expect(retryInvoices.length).toBe(1);
    expect(subscriptionRepo.values.length).toBeGreaterThan(0);
  });

  test("throws action required when swapping item-less subscriptions", async () => {
    const stripe = createFakeStripe();
    const api = createStripeCoreApi({ stripe });
    await api.customers.create({ email: "empty-sub@example.com" });

    await api.subscriptions.create({ customerId: "cus_1", priceId: "price_basic" });

    const rawStripe = stripe as unknown as {
      subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
    };

    const subscription = await rawStripe.subscriptions.retrieve("sub_1");
    subscription.items.data = [];

    await expect(
      api.subscriptions.swap({ subscriptionId: "sub_1", priceId: "price_next" }),
    ).rejects.toBeInstanceOf(ActionRequiredError);
  });
});
