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
    data: {
      email: input.customer.email,
      metadata: input.customer.metadata,
    },
  };
}

function toPaymentMethodRecord(input: {
  paymentMethod: Stripe.PaymentMethod;
  id: string;
  customerId: string;
}): PaymentMethodRecord & { customerId: string } {
  const paymentMethod = input.paymentMethod;

  return {
    id: input.id,
    customerId: input.customerId,
    processorId: paymentMethod.id,
    default: false,
    data: {
      type: paymentMethod.type,
      card: paymentMethod.card,
    },
  };
}

function toSubscriptionRecord(input: {
  subscription: Stripe.Subscription;
  id: string;
  customerId: string;
}): SubscriptionRecord {
  const subscription = input.subscription;
  const firstItem = subscription.items.data[0];
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  return {
    id: input.id,
    customerId: input.customerId,
    name: firstItem?.price.product?.toString() ?? 'default',
    processorId: subscription.id,
    processorPlan: firstItem?.price.id ?? '',
    quantity: firstItem?.quantity ?? 1,
    status: subscription.status,
    currentPeriodStart: toDate(rawSubscription.current_period_start),
    currentPeriodEnd: toDate(rawSubscription.current_period_end),
    trialEndsAt: toDate(subscription.trial_end),
    endsAt: toDate(subscription.ended_at),
    metered: firstItem?.price.recurring?.usage_type === 'metered',
    pauseBehavior: subscription.pause_collection?.behavior,
    pauseStartsAt: undefined,
    pauseResumesAt: toDate(subscription.pause_collection?.resumes_at),
    data: {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
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
  customerId: string;
}): ChargeRecord {
  return {
    id: input.id,
    processorId: input.charge.id,
    customerId: input.customerId,
    amount: input.charge.amount,
    currency: input.charge.currency,
    amountRefunded: input.charge.amount_refunded ?? undefined,
    applicationFeeAmount: input.charge.application_fee_amount ?? undefined,
    data: {
      charge: input.charge,
      paymentIntent: input.paymentIntent,
      receiptUrl: input.charge.receipt_url,
      paymentMethodSnapshot: input.charge.payment_method_details,
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

      if (repositories.paymentMethods === undefined || repositories.ownerCustomers === undefined) {
        return;
      }

      // Look up internal customer ID from Stripe customer ID
      const internalCustomer = await repositories.ownerCustomers.findByProcessor({
        processor: "stripe",
        processorId: customerId,
      });

      if (internalCustomer === null) {
        return;
      }

      const defaultPaymentMethodId =
        typeof customer.invoice_settings.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings.default_payment_method?.id;

      await repositories.paymentMethods.clearDefaultForCustomer(internalCustomer.id);

      if (defaultPaymentMethodId === undefined) {
        return;
      }

      const paymentMethod = await options.stripe.paymentMethods.retrieve(defaultPaymentMethodId, requestOptions);
      const existing = await repositories.paymentMethods.findByProcessorId(defaultPaymentMethodId);
      const record = toPaymentMethodRecord({
        paymentMethod,
        id: existing?.id ?? createOpaqueId(),
        customerId: internalCustomer.id,
      });

      if (record === null) {
        return;
      }

      await repositories.paymentMethods.upsert({
        ...record,
        default: true,
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

      // Look up internal customer record to get the internal ID
      const internalCustomer = await repositories.ownerCustomers?.findByProcessor({
        processor: "stripe",
        processorId: customerId,
      });

      const internalCustomerId = internalCustomer?.id;

      if (repositories.subscriptions !== undefined && internalCustomerId !== undefined) {
        const subscriptions = await repositories.subscriptions.listByCustomer(internalCustomerId);

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

      if (repositories.paymentMethods !== undefined && internalCustomerId !== undefined) {
        const paymentMethods = await repositories.paymentMethods.listByCustomer(internalCustomerId);

        for (const paymentMethod of paymentMethods) {
          await repositories.paymentMethods.deleteByProcessorId(paymentMethod.processorId);
        }
      }

      await repositories.customers.upsert({
        processor: "stripe",
        processorId: customerId,
        connectedAccountId: existingCustomer?.connectedAccountId,
        data: existingCustomer?.data,
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
      const stripeCustomerId = pickCustomerId(paymentMethod.customer);

      if (stripeCustomerId === undefined) {
        return;
      }

      // Look up internal customer ID from Stripe customer ID
      const internalCustomer = await repositories.ownerCustomers?.findByProcessor({
        processor: "stripe",
        processorId: stripeCustomerId,
      });

      if (internalCustomer === undefined || internalCustomer === null) {
        return;
      }

      const recordId = existing?.id ?? createOpaqueId();
      const record = toPaymentMethodRecord({
        paymentMethod,
        id: recordId,
        customerId: internalCustomer.id,
      });

      const customer = await options.stripe.customers.retrieve(stripeCustomerId, requestOptions) as Stripe.Customer;
      const defaultPaymentMethodId =
        typeof customer.invoice_settings.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings.default_payment_method?.id;

      await repositories.paymentMethods.clearDefaultForCustomer(internalCustomer.id);
      await repositories.paymentMethods.upsert({
        ...record,
        id: recordId,
        default: defaultPaymentMethodId === record.processorId,
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
      const stripeCustomerId = pickCustomerId(charge.customer);

      if (stripeCustomerId === undefined) {
        return;
      }

      // Look up internal customer ID from Stripe customer ID
      const internalCustomer = await repositories.ownerCustomers?.findByProcessor({
        processor: "stripe",
        processorId: stripeCustomerId,
      });

      if (internalCustomer === undefined || internalCustomer === null) {
        return;
      }

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
        customerId: internalCustomer.id,
      });

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
      const stripeCustomerId = pickCustomerId(charge.customer);

      if (stripeCustomerId === undefined) {
        return;
      }

      // Look up internal customer ID from Stripe customer ID
      const internalCustomer = await repositories.ownerCustomers?.findByProcessor({
        processor: "stripe",
        processorId: stripeCustomerId,
      });

      if (internalCustomer === undefined || internalCustomer === null) {
        return;
      }

      const existing = await repositories.charges.findByProcessorId(chargeId);
      const record = toChargeRecord({
        charge,
        paymentIntent,
        id: existing?.id ?? createOpaqueId(),
        customerId: internalCustomer.id,
      });

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
      const stripeCustomerId = pickCustomerId(subscription.customer);

      if (stripeCustomerId === undefined) {
        return;
      }

      // Look up internal customer ID from Stripe customer ID
      const internalCustomer = await repositories.ownerCustomers?.findByProcessor({
        processor: "stripe",
        processorId: stripeCustomerId,
      });

      if (internalCustomer === undefined || internalCustomer === null) {
        return;
      }

      const existing = await repositories.subscriptions.findByProcessorId(subscriptionId);
      const record = toSubscriptionRecord({
        subscription,
        id: existing?.id ?? createOpaqueId(),
        customerId: internalCustomer.id,
      });

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
