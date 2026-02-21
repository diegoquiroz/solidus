import type Stripe from "stripe";
import type {
  ChargeRecord,
  ChargeRepository,
  CustomerRepository,
  CustomerRegistry,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../core/contracts.ts";
import { createOpaqueId } from "../core/opaque-id.ts";
import type {
  StripeAccountProjection,
  StripeAccountProjectionRepository,
  StripeCustomerProjection,
  StripeCustomerProjectionRepository,
} from "./core-apis.ts";
import { tryParseCheckoutClientReferenceId } from "./owner-linking.ts";
import type { StripeWebhookEffects } from "./webhooks.ts";

export interface StripeInvoiceProjection {
  id: string;
  processor: "stripe";
  processorId: string;
  customerProcessorId?: string;
  subscriptionProcessorId?: string;
  status: string;
  amountDue?: number;
  amountPaid?: number;
  currency?: string;
  dueAt?: Date;
  paidAt?: Date;
  rawPayload: Stripe.Invoice;
}

export interface StripeInvoiceProjectionRepository {
  upsert(invoice: StripeInvoiceProjection): Promise<void>;
  findByProcessorId?(processorId: string): Promise<StripeInvoiceProjection | null>;
}

export interface StripeDefaultWebhookEffectRepositories {
  customers?: StripeCustomerProjectionRepository;
  accounts?: StripeAccountProjectionRepository;
  paymentMethods?: PaymentMethodRepository;
  charges?: ChargeRepository;
  subscriptions?: SubscriptionRepository;
  invoices?: StripeInvoiceProjectionRepository;
  ownerCustomers?: CustomerRepository;
}

export interface StripeDefaultWebhookEffectsOptions {
  stripe: Stripe;
  repositories?: StripeDefaultWebhookEffectRepositories;
  customerRegistry?: CustomerRegistry;
  resolveRequestOptions?: (event: Stripe.Event) => Stripe.RequestOptions | undefined;
}

function getConnectedAccountId(requestOptions?: Stripe.RequestOptions): string | undefined {
  if (typeof requestOptions?.stripeAccount !== "string") {
    return undefined;
  }

  const stripeAccount = requestOptions.stripeAccount.trim();
  return stripeAccount.length > 0 ? stripeAccount : undefined;
}

function getEventObject(event: Stripe.Event): Record<string, unknown> {
  const object = event.data.object;

  if (typeof object !== "object" || object === null) {
    return {};
  }

  return object as unknown as Record<string, unknown>;
}

function getEventCustomerId(event: Stripe.Event): string | undefined {
  const object = getEventObject(event);

  if (typeof object.id === "string" && event.type.startsWith("customer.")) {
    return object.id;
  }

  if (typeof object.customer === "string" && object.customer.length > 0) {
    return object.customer;
  }

  return undefined;
}

async function resolveRequestOptions(input: {
  event: Stripe.Event;
  customerId?: string;
  customersRepository?: StripeCustomerProjectionRepository;
  resolveRequestOptions?: (event: Stripe.Event) => Stripe.RequestOptions | undefined;
}): Promise<Stripe.RequestOptions | undefined> {
  const explicit = input.resolveRequestOptions?.(input.event);
  const explicitStripeAccount = getConnectedAccountId(explicit);

  if (explicitStripeAccount !== undefined) {
    return {
      ...explicit,
      stripeAccount: explicitStripeAccount,
    };
  }

  if (explicit !== undefined) {
    return explicit;
  }

  if (typeof input.event.account === "string" && input.event.account.length > 0) {
    return {
      stripeAccount: input.event.account,
    };
  }

  const customerId = input.customerId ?? getEventCustomerId(input.event);

  if (customerId === undefined) {
    return undefined;
  }

  const customer = await input.customersRepository?.findByProcessorId(customerId);
  const connectedAccountId = customer?.connectedAccountId;

  if (typeof connectedAccountId === "string" && connectedAccountId.length > 0) {
    return {
      stripeAccount: connectedAccountId,
    };
  }

  return undefined;
}

function toDate(unixTime?: number | null): Date | undefined {
  if (unixTime === null || unixTime === undefined) {
    return undefined;
  }

  return new Date(unixTime * 1000);
}

function pickCustomerId(value: Stripe.Customer | string | Stripe.DeletedCustomer | null): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return undefined;
  }

  return value.id;
}

function pickPaymentIntentId(value: Stripe.PaymentIntent | string | null): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return undefined;
  }

  return value.id;
}

function pickSubscriptionId(value: Stripe.Subscription | string | null): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return undefined;
  }

  return value.id;
}

function toCustomerProjection(input: {
  customer: Stripe.Customer;
  connectedAccountId?: string;
}): StripeCustomerProjection {
  return {
    processor: "stripe",
    processorId: input.customer.id,
    connectedAccountId: input.connectedAccountId,
    email: input.customer.email ?? undefined,
    metadata: input.customer.metadata,
    rawPayload: input.customer,
  };
}

function toPaymentMethodRecord(input: {
  paymentMethod: Stripe.PaymentMethod;
  id: string;
}): PaymentMethodRecord | null {
  const paymentMethod = input.paymentMethod;
  const customerId = pickCustomerId(paymentMethod.customer);

  if (customerId === undefined) {
    return null;
  }

  return {
    id: input.id,
    processor: "stripe",
    processorId: paymentMethod.id,
    customerProcessorId: customerId,
    methodType: paymentMethod.type ?? "unknown",
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    expMonth: paymentMethod.card?.exp_month,
    expYear: paymentMethod.card?.exp_year,
    isDefault: false,
    rawPayload: paymentMethod,
  };
}

function toSubscriptionRecord(input: {
  subscription: Stripe.Subscription;
  id: string;
}): SubscriptionRecord | null {
  const subscription = input.subscription;
  const firstItem = subscription.items.data[0];
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const customerProcessorId = pickCustomerId(subscription.customer);

  if (customerProcessorId === undefined) {
    return null;
  }

  return {
    id: input.id,
    processor: "stripe",
    processorId: subscription.id,
    customerProcessorId,
    status: subscription.status,
    priceId: firstItem?.price.id,
    quantity: firstItem?.quantity ?? undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: toDate(rawSubscription.current_period_start),
    currentPeriodEnd: toDate(rawSubscription.current_period_end),
    trialEndsAt: toDate(subscription.trial_end),
    pausedBehavior: subscription.pause_collection?.behavior,
    pausedResumesAt: toDate(subscription.pause_collection?.resumes_at),
    rawPayload: subscription,
  };
}

function toInvoiceProjection(input: {
  invoice: Stripe.Invoice;
  id: string;
}): StripeInvoiceProjection {
  const invoice = input.invoice;
  const customerProcessorId = pickCustomerId(invoice.customer);
  const subscriptionProcessorId = pickSubscriptionId(
    (invoice as Stripe.Invoice & { subscription?: Stripe.Subscription | string | null }).subscription ?? null,
  );

  return {
    id: input.id,
    processor: "stripe",
    processorId: invoice.id,
    customerProcessorId,
    subscriptionProcessorId,
    status: invoice.status ?? "unknown",
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency ?? undefined,
    dueAt: toDate(invoice.due_date),
    paidAt: toDate(invoice.status_transitions?.paid_at),
    rawPayload: invoice,
  };
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toAccountProjection(account: Stripe.Account): StripeAccountProjection {
  return {
    processor: "stripe",
    processorId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    disabledReason: account.requirements?.disabled_reason ?? undefined,
    currentlyDue: toStringArray(account.requirements?.currently_due),
    eventuallyDue: toStringArray(account.requirements?.eventually_due),
    pastDue: toStringArray(account.requirements?.past_due),
    pendingVerification: toStringArray(account.requirements?.pending_verification),
    rawPayload: account,
  };
}

function toChargeRecord(input: {
  charge: Stripe.Charge;
  paymentIntent: Stripe.PaymentIntent | null;
  id: string;
}): ChargeRecord | null {
  const customerProcessorId =
    pickCustomerId(input.paymentIntent?.customer ?? null) ?? pickCustomerId(input.charge.customer);

  if (customerProcessorId === undefined) {
    return null;
  }

  const taxAmount = input.paymentIntent?.amount_details?.tax?.total_tax_amount ?? undefined;
  const lineItems = input.paymentIntent?.amount_details?.line_items;
  const lineItemTaxAmounts = (Array.isArray(lineItems) ? lineItems : lineItems?.data)
    ?.map((lineItem) => lineItem.tax?.total_tax_amount)
    .filter((value): value is number => typeof value === "number");

  return {
    id: input.id,
    processor: "stripe",
    processorId: input.charge.id,
    customerProcessorId,
    amount: input.charge.amount,
    currency: input.charge.currency,
    status: input.paymentIntent?.status ?? input.charge.status ?? "unknown",
    receiptUrl: input.charge.receipt_url ?? undefined,
    taxAmount,
    totalTaxAmounts: lineItemTaxAmounts && lineItemTaxAmounts.length > 0 ? lineItemTaxAmounts : undefined,
    refundTotal: input.charge.amount_refunded,
    paymentMethodSnapshot: input.charge.payment_method_details ?? undefined,
    rawPayload: {
      charge: input.charge,
      paymentIntent: input.paymentIntent,
    },
  };
}

function isActiveStripeSubscriptionStatus(status: string): boolean {
  return status === "trialing"
    || status === "active"
    || status === "past_due"
    || status === "unpaid"
    || status === "paused";
}

export function createDefaultStripeWebhookEffects(
  options: StripeDefaultWebhookEffectsOptions,
): StripeWebhookEffects {
  const repositories = options.repositories ?? {};

  return {
    async syncCustomerById(customerId, event) {
      if (repositories.customers === undefined) {
        return;
      }

      const existingCustomer = await repositories.customers.findByProcessorId(customerId);

      if (existingCustomer === null) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customerId,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const customer = await options.stripe.customers.retrieve(customerId, requestOptions) as Stripe.Customer;
      await repositories.customers.upsert(toCustomerProjection({
        customer,
        connectedAccountId: getConnectedAccountId(requestOptions) ?? existingCustomer.connectedAccountId,
      }));

      if (repositories.paymentMethods === undefined) {
        return;
      }

      const defaultPaymentMethodId =
        typeof customer.invoice_settings.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings.default_payment_method?.id;

      await repositories.paymentMethods.clearDefaultForCustomer(customerId);

      if (defaultPaymentMethodId === undefined) {
        return;
      }

      const paymentMethod = await options.stripe.paymentMethods.retrieve(defaultPaymentMethodId, requestOptions);
      const existing = await repositories.paymentMethods.findByProcessorId(defaultPaymentMethodId);
      const record = toPaymentMethodRecord({
        paymentMethod,
        id: existing?.id ?? createOpaqueId(),
      });

      if (record === null) {
        return;
      }

      await repositories.paymentMethods.upsert({
        ...record,
        isDefault: true,
      });
    },

    async deleteCustomerById(customerId, event) {
      if (repositories.customers === undefined) {
        return;
      }

      const existingCustomer = await repositories.customers.findByProcessorId(customerId);

      if (existingCustomer === null) {
        return;
      }

      if (repositories.subscriptions !== undefined) {
        const subscriptions = await repositories.subscriptions.listByCustomer(customerId);

        for (const subscription of subscriptions) {
          if (!isActiveStripeSubscriptionStatus(subscription.status)) {
            continue;
          }

          await repositories.subscriptions.upsert({
            ...subscription,
            status: "canceled",
            currentPeriodEnd: new Date(),
          });
        }
      }

      if (repositories.paymentMethods !== undefined) {
        const paymentMethods = await repositories.paymentMethods.listByCustomer(customerId);

        for (const paymentMethod of paymentMethods) {
          await repositories.paymentMethods.deleteByProcessorId(paymentMethod.processorId);
        }
      }

      await repositories.customers.upsert({
        processor: "stripe",
        processorId: customerId,
        connectedAccountId: existingCustomer?.connectedAccountId,
        email: existingCustomer?.email,
        metadata: existingCustomer?.metadata,
        rawPayload: event.data.object as Stripe.Customer,
      });
    },

    async syncAccountById(accountId) {
      if (repositories.accounts === undefined) {
        return;
      }

      const account = await options.stripe.accounts.retrieve(accountId);
      await repositories.accounts.upsert(toAccountProjection(account));
    },

    async syncPaymentMethodById(paymentMethodId, event) {
      if (repositories.paymentMethods === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const paymentMethod = await options.stripe.paymentMethods.retrieve(paymentMethodId, requestOptions);
      const existing = await repositories.paymentMethods.findByProcessorId(paymentMethodId);
      const record = toPaymentMethodRecord({
        paymentMethod,
        id: existing?.id ?? createOpaqueId(),
      });

      if (record === null) {
        return;
      }

      const customer = await options.stripe.customers.retrieve(record.customerProcessorId, requestOptions) as Stripe.Customer;
      const defaultPaymentMethodId =
        typeof customer.invoice_settings.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings.default_payment_method?.id;

      await repositories.paymentMethods.clearDefaultForCustomer(record.customerProcessorId);
      await repositories.paymentMethods.upsert({
        ...record,
        isDefault: defaultPaymentMethodId === record.processorId,
      });
    },

    async deletePaymentMethodById(paymentMethodId) {
      await repositories.paymentMethods?.deleteByProcessorId(paymentMethodId);
    },

    async syncChargeById(chargeId, event) {
      if (repositories.charges === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const charge = await options.stripe.charges.retrieve(chargeId, requestOptions);
      const paymentIntentId = pickPaymentIntentId(charge.payment_intent);
      const paymentIntent =
        paymentIntentId === undefined
          ? null
          : await options.stripe.paymentIntents.retrieve(paymentIntentId, requestOptions);
      const existing = await repositories.charges.findByProcessorId(chargeId);
      const record = toChargeRecord({
        charge,
        paymentIntent,
        id: existing?.id ?? createOpaqueId(),
      });

      if (record === null) {
        return;
      }

      await repositories.charges.upsert(record);
    },

    async syncChargeByPaymentIntentId(paymentIntentId, event) {
      if (repositories.charges === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const paymentIntent = await options.stripe.paymentIntents.retrieve(paymentIntentId, requestOptions);

      if (paymentIntent.latest_charge === null) {
        return;
      }

      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;
      const charge = await options.stripe.charges.retrieve(chargeId, requestOptions);
      const existing = await repositories.charges.findByProcessorId(chargeId);
      const record = toChargeRecord({
        charge,
        paymentIntent,
        id: existing?.id ?? createOpaqueId(),
      });

      if (record === null) {
        return;
      }

      await repositories.charges.upsert(record);
    },

    async syncSubscriptionById(subscriptionId, event) {
      if (repositories.subscriptions === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const subscription = await options.stripe.subscriptions.retrieve(subscriptionId, requestOptions);
      const existing = await repositories.subscriptions.findByProcessorId(subscriptionId);
      const record = toSubscriptionRecord({
        subscription,
        id: existing?.id ?? createOpaqueId(),
      });

      if (record === null) {
        return;
      }

      await repositories.subscriptions.upsert(record);
    },

    async notifyInvoiceUpcoming(invoiceId, event) {
      if (repositories.invoices === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const invoice = await options.stripe.invoices.retrieve(invoiceId, requestOptions);
      const existing = await repositories.invoices.findByProcessorId?.(invoiceId);
      await repositories.invoices.upsert(toInvoiceProjection({
        invoice,
        id: existing?.id ?? createOpaqueId(),
      }));
    },

    async notifyPaymentActionRequired({ invoiceId, event }) {
      if (repositories.invoices === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const invoice = await options.stripe.invoices.retrieve(invoiceId, requestOptions);
      const existing = await repositories.invoices.findByProcessorId?.(invoiceId);
      await repositories.invoices.upsert(toInvoiceProjection({
        invoice,
        id: existing?.id ?? createOpaqueId(),
      }));
    },

    async notifyPaymentFailed(invoiceId, event) {
      if (repositories.invoices === undefined) {
        return;
      }

      const requestOptions = await resolveRequestOptions({
        event,
        customersRepository: repositories.customers,
        resolveRequestOptions: options.resolveRequestOptions,
      });
      const invoice = await options.stripe.invoices.retrieve(invoiceId, requestOptions);
      const existing = await repositories.invoices.findByProcessorId?.(invoiceId);
      await repositories.invoices.upsert(toInvoiceProjection({
        invoice,
        id: existing?.id ?? createOpaqueId(),
      }));
    },

    async linkCheckoutOwner(input) {
      if (repositories.ownerCustomers === undefined || options.customerRegistry === undefined) {
        return;
      }

      const parsed = tryParseCheckoutClientReferenceId({
        clientReferenceId: input.clientReferenceId,
        customerRegistry: options.customerRegistry,
      });

      if (parsed === null) {
        return;
      }

      const existing = await repositories.ownerCustomers.findByOwner({
        ownerType: parsed.modelName,
        ownerId: parsed.ownerId,
        processor: "stripe",
      });

      if (existing?.processorId === input.customerId) {
        return;
      }

      const byProcessor = await repositories.ownerCustomers.findByProcessor({
        processor: "stripe",
        processorId: input.customerId,
      });

      await repositories.ownerCustomers.save({
        id: existing?.id ?? byProcessor?.id ?? createOpaqueId(),
        ownerType: parsed.modelName,
        ownerId: parsed.ownerId,
        processor: "stripe",
        processorId: input.customerId,
      });
    },
  };
}
