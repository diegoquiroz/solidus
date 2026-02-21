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

  async findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null> {
    return this.values.find((value) => value.processorId === processorId) ?? null;
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

  async findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null> {
    return this.values.find((value) => value.processorId === processorId) ?? null;
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
  const accounts = new Map<string, Stripe.Account>();

  let lastSubscriptionCreateParams: Stripe.SubscriptionCreateParams | undefined;
  let lastSubscriptionUpdateParams: Stripe.SubscriptionUpdateParams | undefined;
  let lastCheckoutCreateParams: Stripe.Checkout.SessionCreateParams | undefined;
  let lastBillingPortalCreateParams: Stripe.BillingPortal.SessionCreateParams | undefined;
  let lastMeterEventParams: Record<string, unknown> | undefined;
  let lastTransferCreateParams: Stripe.TransferCreateParams | undefined;
  let lastInvoicePreviewParams: Stripe.InvoiceCreatePreviewParams | undefined;

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
    if (params.amount === 4100) {
      throw {
        type: "StripeCardError",
        code: "authentication_required",
        message: "Authentication required",
        payment_intent: {
          id: "pi_action",
          client_secret: "pi_action_secret",
          status: "requires_action",
        },
      };
    }

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
      amount_details: params.amount_details as Stripe.PaymentIntent.AmountDetails | undefined,
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
    lastSubscriptionCreateParams = params;

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
    lastSubscriptionUpdateParams = params;

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

  const previewInvoice = async (
    params: Stripe.InvoiceCreatePreviewParams,
  ): Promise<Stripe.Invoice> => {
    lastInvoicePreviewParams = params;

    return {
      id: "in_preview_1",
      object: "invoice",
      customer: params.customer ?? null,
      subscription: params.subscription ?? null,
      status: "draft",
      amount_due: 0,
      amount_paid: 0,
      currency: "usd",
    } as unknown as Stripe.Invoice;
  };

  const createCheckoutSession = async (
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> => {
    lastCheckoutCreateParams = params;

    return {
      id: `cs_${Date.now()}`,
      object: "checkout.session",
      mode: params.mode,
      customer: params.customer ?? null,
      customer_email: params.customer_email ?? null,
      success_url: params.success_url ?? null,
      cancel_url: params.cancel_url ?? null,
      return_url: params.return_url ?? null,
      metadata: (params.metadata ?? {}) as Stripe.Metadata,
      url: "https://stripe.test/checkout/session",
    } as Stripe.Checkout.Session;
  };

  const createBillingPortalSession = async (
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session> => {
    lastBillingPortalCreateParams = params;

    return {
      id: "bps_1",
      object: "billing_portal.session",
      customer: params.customer,
      return_url: params.return_url ?? null,
      url: "https://stripe.test/billing-portal/session",
    } as Stripe.BillingPortal.Session;
  };

  const createMeterEvent = async (params: {
    event_name: string;
    payload: Record<string, string>;
    identifier?: string;
    timestamp?: number;
  }): Promise<{ id: string; event_name: string }> => {
    lastMeterEventParams = params;

    return {
      id: "mev_1",
      event_name: params.event_name,
    };
  };

  const createAccount = async (params: Stripe.AccountCreateParams): Promise<Stripe.Account> => {
    const account = {
      id: `acct_${accounts.size + 1}`,
      object: "account",
      type: params.type ?? "express",
      email: params.email ?? null,
      metadata: (params.metadata ?? {}) as Stripe.Metadata,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      requirements: {
        currently_due: ["external_account"],
      },
    } as Stripe.Account;

    accounts.set(account.id, account);
    return account;
  };

  const retrieveAccount = async (id: string): Promise<Stripe.Account> => {
    const account = accounts.get(id);

    if (!account) {
      throw { type: "StripeInvalidRequestError", code: "resource_missing", message: "Missing" };
    }

    return account;
  };

  const createAccountLink = async (
    params: Stripe.AccountLinkCreateParams,
  ): Promise<Stripe.AccountLink> => {
    return {
      object: "account_link",
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 600,
      url: `https://stripe.test/account-link/${params.account}`,
    } as Stripe.AccountLink;
  };

  const createLoginLink = async (_id: string): Promise<Stripe.LoginLink> => {
    return {
      object: "login_link",
      created: Math.floor(Date.now() / 1000),
      url: "https://stripe.test/login-link",
    } as Stripe.LoginLink;
  };

  const createTransfer = async (params: Stripe.TransferCreateParams): Promise<Stripe.Transfer> => {
    lastTransferCreateParams = params;

    return {
      id: "tr_1",
      object: "transfer",
      amount: params.amount,
      currency: params.currency,
      destination: params.destination as string,
      metadata: (params.metadata ?? {}) as Stripe.Metadata,
    } as Stripe.Transfer;
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
    checkout: {
      sessions: {
        create: createCheckoutSession,
      },
    },
    billingPortal: {
      sessions: {
        create: createBillingPortalSession,
      },
    },
    billing: {
      meterEvents: {
        create: createMeterEvent,
      },
    },
    accounts: {
      create: createAccount,
      retrieve: retrieveAccount,
      createLoginLink,
    },
    accountLinks: {
      create: createAccountLink,
    },
    transfers: {
      create: createTransfer,
    },
    invoices: {
      list: listInvoices,
      createPreview: previewInvoice,
      pay: async (_id: string) => ({ id: "in_1", object: "invoice" }) as Stripe.Invoice,
    },
    __testState: {
      getLastSubscriptionCreateParams: () => lastSubscriptionCreateParams,
      getLastSubscriptionUpdateParams: () => lastSubscriptionUpdateParams,
      getLastCheckoutCreateParams: () => lastCheckoutCreateParams,
      getLastBillingPortalCreateParams: () => lastBillingPortalCreateParams,
      getLastMeterEventParams: () => lastMeterEventParams,
      getLastTransferCreateParams: () => lastTransferCreateParams,
      getLastInvoicePreviewParams: () => lastInvoicePreviewParams,
    },
  } as unknown as Stripe;
}

type FakeStripeWithState = Stripe & {
  __testState: {
    getLastSubscriptionCreateParams(): Stripe.SubscriptionCreateParams | undefined;
    getLastSubscriptionUpdateParams(): Stripe.SubscriptionUpdateParams | undefined;
    getLastCheckoutCreateParams(): Stripe.Checkout.SessionCreateParams | undefined;
    getLastBillingPortalCreateParams(): Stripe.BillingPortal.SessionCreateParams | undefined;
    getLastMeterEventParams(): Record<string, unknown> | undefined;
    getLastTransferCreateParams(): Stripe.TransferCreateParams | undefined;
    getLastInvoicePreviewParams(): Stripe.InvoiceCreatePreviewParams | undefined;
  };
};

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

  test("updates payment method with Pay update_payment_method semantics", async () => {
    const paymentMethodRepo = new InMemoryPaymentMethodRepo();
    const api = createStripeCoreApi({
      stripe: createFakeStripe(),
      repositories: { paymentMethods: paymentMethodRepo },
    });

    await api.customers.create({ email: "pm-update@example.com" });
    await api.paymentMethods.add({
      customerId: "cus_1",
      paymentMethodId: "pm_old",
      setAsDefault: true,
    });

    const updated = await api.customers.updatePaymentMethod({
      customerId: "cus_1",
      paymentMethodId: "pm_new",
    });
    const customer = await api.customers.retrieve("cus_1");
    const methods = await paymentMethodRepo.listByCustomer("cus_1");

    expect(updated.processorId).toBe("pm_new");
    expect(updated.isDefault).toBe(true);
    expect(customer.invoice_settings.default_payment_method).toBe("pm_new");
    expect(methods.find((value) => value.processorId === "pm_old")?.isDefault).toBe(false);
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

  test("normalizes charge tax fields for no-tax payloads", async () => {
    const api = createStripeCoreApi({ stripe: createFakeStripe() });

    await api.customers.create({ email: "tax-none@example.com" });
    await api.paymentMethods.add({ customerId: "cus_1", paymentMethodId: "pm_1" });

    const charge = await api.charges.charge({
      customerId: "cus_1",
      amount: 1200,
      currency: "usd",
      paymentMethodId: "pm_1",
    });

    expect(charge.taxAmount).toBeUndefined();
    expect(charge.totalTaxAmounts).toBeUndefined();
  });

  test("normalizes charge tax fields for single-tax payloads", async () => {
    const api = createStripeCoreApi({ stripe: createFakeStripe() });

    await api.customers.create({ email: "tax-single@example.com" });
    await api.paymentMethods.add({ customerId: "cus_1", paymentMethodId: "pm_1" });

    const charge = await api.charges.charge({
      customerId: "cus_1",
      amount: 1200,
      currency: "usd",
      paymentMethodId: "pm_1",
      stripeOptions: {
        amount_details: {
          tax: { total_tax_amount: 125 },
          line_items: [
            {
              product_name: "Plan",
              quantity: 1,
              unit_cost: 1200,
              tax: { total_tax_amount: 125 },
            },
          ],
        },
      },
    });

    expect(charge.taxAmount).toBe(125);
    expect(charge.totalTaxAmounts).toEqual([125]);
  });

  test("normalizes charge tax fields for multiple-tax payloads", async () => {
    const api = createStripeCoreApi({ stripe: createFakeStripe() });

    await api.customers.create({ email: "tax-multi@example.com" });
    await api.paymentMethods.add({ customerId: "cus_1", paymentMethodId: "pm_1" });

    const charge = await api.charges.charge({
      customerId: "cus_1",
      amount: 1200,
      currency: "usd",
      paymentMethodId: "pm_1",
      stripeOptions: {
        amount_details: {
          tax: { total_tax_amount: 200 },
          line_items: [
            {
              product_name: "Item A",
              quantity: 1,
              unit_cost: 700,
              tax: { total_tax_amount: 80 },
            },
            {
              product_name: "Item B",
              quantity: 1,
              unit_cost: 500,
              tax: { total_tax_amount: 120 },
            },
          ],
        },
      },
    });

    expect(charge.taxAmount).toBe(200);
    expect(charge.totalTaxAmounts).toEqual([80, 120]);
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

  test("creates checkout sessions for payment, setup, and subscription", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    const paymentSession = await api.checkout.createPaymentSession({
      customerId: "cus_1",
      successUrl: "https://app.example/success",
      cancelUrl: "https://app.example/cancel?flow=checkout",
      lineItems: [{ price: "price_basic", quantity: 1 }],
      stripeOptions: {
        automatic_tax: { enabled: true },
      },
    });

    const setupSession = await api.checkout.createSetupSession({
      customerId: "cus_1",
      successUrl: "https://app.example/setup/success",
      cancelUrl: "https://app.example/setup/cancel",
      returnUrl: "https://app.example/setup/return",
    });

    const subscriptionSession = await api.checkout.createSubscriptionSession({
      customerId: "cus_1",
      successUrl: "https://app.example/subscription/success",
      cancelUrl: "https://app.example/subscription/cancel",
      lineItems: [{ price: "price_metered", quantity: 1 }],
      stripeOptions: {
        automatic_tax: { enabled: true },
      },
    });

    const withSessionId = api.checkout.withSessionIdUrls({
      successUrl: "https://app.example/success",
      cancelUrl: "https://app.example/cancel?flow=checkout",
      returnUrl: "https://app.example/return",
    });
    const appendedOnce = api.checkout.appendSessionIdToUrl("https://app.example/success");
    const appendedTwice = api.checkout.appendSessionIdToUrl(appendedOnce);

    expect(paymentSession.mode).toBe("payment");
    expect(setupSession.mode).toBe("setup");
    expect(subscriptionSession.mode).toBe("subscription");
    expect(withSessionId.successUrl).toContain("stripe_checkout_session_id={CHECKOUT_SESSION_ID}");
    expect(withSessionId.cancelUrl).toContain("flow=checkout&stripe_checkout_session_id={CHECKOUT_SESSION_ID}");
    expect(withSessionId.returnUrl).toContain("stripe_checkout_session_id={CHECKOUT_SESSION_ID}");
    expect(appendedTwice).toBe(appendedOnce);
    expect(stripe.__testState.getLastCheckoutCreateParams()?.automatic_tax?.enabled).toBe(true);
  });

  test("creates checkout charge sessions with Pay checkout_charge defaults", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    const session = await api.checkout.checkoutCharge({
      customerId: "cus_1",
      successUrl: "https://app.example/charge/success",
      cancelUrl: "https://app.example/charge/cancel",
      amount: 1500,
      name: "One-time add-on",
    });

    const lastParams = stripe.__testState.getLastCheckoutCreateParams();
    const firstLineItem = lastParams?.line_items?.[0] as Stripe.Checkout.SessionCreateParams.LineItem;

    expect(session.mode).toBe("payment");
    expect(firstLineItem.price_data?.currency).toBe("usd");
    expect(firstLineItem.price_data?.product_data?.name).toBe("One-time add-on");
    expect(firstLineItem.price_data?.unit_amount).toBe(1500);
    expect(firstLineItem.quantity).toBe(1);
  });

  test("creates billing portal sessions and meter events", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    const portalSession = await api.billingPortal.createSession({
      customerId: "cus_1",
      returnUrl: "https://app.example/billing",
    });

    const meterEvent = await api.meters.createEvent({
      eventName: "tokens_used",
      payload: {
        stripe_customer_id: "cus_1",
        value: "42",
      },
    });

    expect(portalSession.customer).toBe("cus_1");
    expect(stripe.__testState.getLastBillingPortalCreateParams()?.return_url).toBe(
      "https://app.example/billing",
    );
    expect(meterEvent).toMatchObject({ id: "mev_1" });
    expect(stripe.__testState.getLastMeterEventParams()).toMatchObject({ event_name: "tokens_used" });
  });

  test("supports connect account workflows", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    const account = await api.connect.createAccount({
      type: "express",
      country: "US",
      email: "connect@example.com",
    });

    const retrieved = await api.connect.retrieveAccount(account.id);
    const link = await api.connect.createAccountLink({
      accountId: account.id,
      refreshUrl: "https://app.example/connect/refresh",
      returnUrl: "https://app.example/connect/return",
    });
    const loginLink = await api.connect.createLoginLink({ accountId: account.id });
    const transfer = await api.connect.createTransfer({
      amount: 700,
      currency: "usd",
      destinationAccountId: account.id,
      transferGroup: "order_123",
    });

    expect(retrieved.id).toBe(account.id);
    expect(link.object).toBe("account_link");
    expect(loginLink.object).toBe("login_link");
    expect(transfer.destination).toBe(account.id);
    expect(stripe.__testState.getLastTransferCreateParams()?.transfer_group).toBe("order_123");
  });

  test("includes continuation details for action required errors", async () => {
    const api = createStripeCoreApi({ stripe: createFakeStripe() });
    await api.customers.create({ email: "sca@example.com" });

    try {
      await api.charges.charge({
        customerId: "cus_1",
        amount: 4100,
        currency: "usd",
      });
      throw new Error("Expected charge to require action");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ActionRequiredError);

      const actionRequiredError = error as ActionRequiredError;
      expect(actionRequiredError.details?.paymentIntentId).toBe("pi_action");
      expect(actionRequiredError.details?.clientSecret).toBe("pi_action_secret");
      expect(actionRequiredError.details?.recommendedNextAction).toBe(
        "confirm_payment_with_client_secret",
      );
    }
  });

  test("runs subscription lifecycle and state helpers", async () => {
    const subscriptionRepo = new InMemorySubscriptionRepo();
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({
      stripe,
      repositories: { subscriptions: subscriptionRepo },
    });

    await api.customers.create({ email: "sub@example.com" });

    const created = await api.subscriptions.create({
      customerId: "cus_1",
      priceId: "price_basic",
      quantity: 1,
      stripeOptions: {
        automatic_tax: { enabled: true },
      },
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
    expect(stripe.__testState.getLastSubscriptionCreateParams()?.automatic_tax?.enabled).toBe(true);
  });

  test("previews invoices for customer and subscription", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    await api.customers.previewInvoice({
      customerId: "cus_1",
    });

    expect(stripe.__testState.getLastInvoicePreviewParams()?.customer).toBe("cus_1");

    const preview = await api.subscriptions.previewInvoice({
      subscriptionId: "sub_1",
    });

    expect(stripe.__testState.getLastInvoicePreviewParams()?.subscription).toBe("sub_1");
    expect(preview.object).toBe("invoice");
  });

  test("keeps paused subscriptions active across cancel and resume transitions", async () => {
    const stripe = createFakeStripe();
    const api = createStripeCoreApi({ stripe });

    await api.customers.create({ email: "paused-lifecycle@example.com" });
    const created = await api.subscriptions.create({ customerId: "cus_1", priceId: "price_basic" });

    const paused = await api.subscriptions.pause({
      subscriptionId: created.processorId,
      behavior: "keep_as_draft",
    });

    expect(api.state.paused(paused)).toBe(true);
    expect(api.state.active(paused)).toBe(true);

    const cancelAtPeriodEnd = await api.subscriptions.cancel(created.processorId);

    expect(cancelAtPeriodEnd.cancelAtPeriodEnd).toBe(true);
    expect(api.state.paused(cancelAtPeriodEnd)).toBe(true);
    expect(api.state.onGracePeriod(cancelAtPeriodEnd)).toBe(true);
    expect(api.state.active(cancelAtPeriodEnd)).toBe(true);

    const resumed = await api.subscriptions.resume(created.processorId);
    expect(resumed.cancelAtPeriodEnd).toBe(false);
    expect(api.state.paused(resumed)).toBe(true);
    expect(api.state.active(resumed)).toBe(true);

    const unpaused = await api.subscriptions.unpause(created.processorId);
    expect(api.state.paused(unpaused)).toBe(false);
    expect(api.state.active(unpaused)).toBe(true);
  });

  test("treats paused subscriptions as inactive after immediate cancellation", async () => {
    const stripe = createFakeStripe();
    const api = createStripeCoreApi({ stripe });

    await api.customers.create({ email: "paused-canceled@example.com" });
    const created = await api.subscriptions.create({ customerId: "cus_1", priceId: "price_basic" });
    const paused = await api.subscriptions.pause({
      subscriptionId: created.processorId,
      behavior: "void",
    });

    expect(api.state.active(paused)).toBe(true);

    const canceledNow = await api.subscriptions.cancelNow(created.processorId);
    expect(api.state.paused(canceledNow)).toBe(true);
    expect(api.state.subscribed(canceledNow)).toBe(false);
    expect(api.state.active(canceledNow)).toBe(false);
  });

  test("defaults pause behavior to void when omitted", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    await api.customers.create({ email: "paused-default@example.com" });
    const created = await api.subscriptions.create({ customerId: "cus_1", priceId: "price_basic" });
    const paused = await api.subscriptions.pause({
      subscriptionId: created.processorId,
    });

    expect(paused.pausedBehavior).toBe("void");
    expect(stripe.__testState.getLastSubscriptionUpdateParams()?.pause_collection).toEqual({
      behavior: "void",
      resumes_at: undefined,
    });
  });

  test("passes explicit pause behavior and resume date to Stripe", async () => {
    const stripe = createFakeStripe() as FakeStripeWithState;
    const api = createStripeCoreApi({ stripe });

    await api.customers.create({ email: "paused-explicit@example.com" });
    const created = await api.subscriptions.create({ customerId: "cus_1", priceId: "price_basic" });
    const resumesAt = new Date("2026-01-01T00:00:00.000Z");

    const paused = await api.subscriptions.pause({
      subscriptionId: created.processorId,
      behavior: "keep_as_draft",
      resumesAt,
    });

    expect(paused.pausedBehavior).toBe("keep_as_draft");
    expect(stripe.__testState.getLastSubscriptionUpdateParams()?.pause_collection).toEqual({
      behavior: "keep_as_draft",
      resumes_at: 1767225600,
    });
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
