import Stripe from "stripe";
import type {
  ChargeRecord,
  ChargeRepository,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../core/contracts.ts";
import { ActionRequiredError, ConfigurationError } from "../core/errors.ts";
import { mapStripeError } from "./errors.ts";

export interface StripeCustomerProjection {
  processor: "stripe";
  processorId: string;
  connectedAccountId?: string;
  email?: string;
  metadata?: Record<string, string>;
  rawPayload: Stripe.Customer;
}

export interface StripeCustomerProjectionRepository {
  upsert(customer: StripeCustomerProjection): Promise<void>;
  findByProcessorId?(processorId: string): Promise<StripeCustomerProjection | null>;
}

export interface StripeAccountProjection {
  processor: "stripe";
  processorId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason?: string;
  currentlyDue: readonly string[];
  eventuallyDue: readonly string[];
  pastDue: readonly string[];
  pendingVerification: readonly string[];
  rawPayload: Stripe.Account;
}

export interface StripeAccountProjectionRepository {
  upsert(account: StripeAccountProjection): Promise<void>;
  findByProcessorId?(processorId: string): Promise<StripeAccountProjection | null>;
}

export interface StripeCoreRepositories {
  customers?: StripeCustomerProjectionRepository;
  accounts?: StripeAccountProjectionRepository;
  paymentMethods?: PaymentMethodRepository;
  charges?: ChargeRepository;
  subscriptions?: SubscriptionRepository;
}

export interface StripeCustomerCreateInput {
  email?: string;
  name?: string;
  metadata?: Stripe.MetadataParam;
  description?: string;
}

export interface StripeCustomerUpdateInput {
  email?: string;
  name?: string;
  metadata?: Stripe.Emptyable<Stripe.MetadataParam>;
  description?: Stripe.Emptyable<string>;
}

export interface StripeCustomerReconcileInput {
  email: string;
  limit?: number;
}

export interface StripePaymentMethodInput {
  customerId: string;
  paymentMethodId: string;
}

export interface StripeSetDefaultPaymentMethodInput extends StripePaymentMethodInput {
  syncCustomerInvoiceSettings?: boolean;
}

export interface StripeUpdatePaymentMethodInput extends StripePaymentMethodInput {}

export interface StripeChargeInput {
  customerId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Stripe.MetadataParam;
  stripeOptions?: Omit<
    Stripe.PaymentIntentCreateParams,
    "customer" | "amount" | "currency" | "confirm" | "capture_method" | "payment_method"
  >;
}

export interface StripeCaptureInput {
  paymentIntentId: string;
  amountToCapture?: number;
}

export interface StripeRefundInput {
  paymentIntentId: string;
  amount?: number;
  reason?: Stripe.RefundCreateParams.Reason;
  metadata?: Stripe.MetadataParam;
}

export interface StripeSubscriptionCreateInput {
  customerId: string;
  priceId?: string;
  items?: Stripe.SubscriptionCreateParams.Item[];
  quantity?: number;
  trialPeriodDays?: number;
  metadata?: Stripe.MetadataParam;
  stripeOptions?: Omit<Stripe.SubscriptionCreateParams, "customer" | "items" | "metadata">;
}

export interface StripeCustomerPreviewInvoiceInput {
  customerId: string;
  stripeOptions?: Omit<Stripe.InvoiceCreatePreviewParams, "customer">;
}

export interface StripeSubscriptionPreviewInvoiceInput {
  subscriptionId: string;
  stripeOptions?: Omit<Stripe.InvoiceCreatePreviewParams, "subscription">;
}

export interface StripeCheckoutUrls {
  successUrl?: string;
  cancelUrl?: string;
  returnUrl?: string;
}

interface StripeCheckoutSessionInputBase {
  customerId?: string;
  customerEmail?: string;
  metadata?: Stripe.MetadataParam;
  applySessionIdToUrls?: boolean;
}

export interface StripeCheckoutPaymentSessionInput extends StripeCheckoutSessionInputBase {
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeOptions?: Omit<
    Stripe.Checkout.SessionCreateParams,
    "mode" | "success_url" | "cancel_url" | "line_items" | "customer" | "customer_email" | "metadata"
  >;
}

export interface StripeCheckoutSetupSessionInput extends StripeCheckoutSessionInputBase {
  successUrl: string;
  cancelUrl?: string;
  returnUrl?: string;
  stripeOptions?: Omit<
    Stripe.Checkout.SessionCreateParams,
    "mode" | "success_url" | "cancel_url" | "return_url" | "customer" | "customer_email" | "metadata"
  >;
}

export interface StripeCheckoutSubscriptionSessionInput extends StripeCheckoutSessionInputBase {
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeOptions?: Omit<
    Stripe.Checkout.SessionCreateParams,
    "mode" | "success_url" | "cancel_url" | "line_items" | "customer" | "customer_email" | "metadata"
  >;
}

export interface StripeCheckoutChargeSessionInput extends StripeCheckoutSessionInputBase {
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  amount: number;
  name: string;
  quantity?: number;
  currency?: string;
  stripeOptions?: Omit<
    Stripe.Checkout.SessionCreateParams,
    "mode" | "success_url" | "cancel_url" | "line_items" | "customer" | "customer_email" | "metadata"
  >;
}

export interface StripeBillingPortalSessionInput {
  customerId: string;
  returnUrl?: string;
  stripeOptions?: Omit<Stripe.BillingPortal.SessionCreateParams, "customer" | "return_url">;
}

type StripeMeterEventCreateParams = Parameters<Stripe.Billing.MeterEventsResource["create"]>[0];
type StripeMeterEventResponse = Awaited<ReturnType<Stripe.Billing.MeterEventsResource["create"]>>;

export interface StripeMeterEventInput {
  eventName: string;
  payload: StripeMeterEventCreateParams["payload"];
  identifier?: string;
  timestamp?: number;
  stripeOptions?: Omit<StripeMeterEventCreateParams, "event_name" | "payload" | "identifier" | "timestamp">;
}

export interface StripeConnectCreateAccountInput {
  type?: Stripe.AccountCreateParams.Type;
  country?: string;
  email?: string;
  capabilities?: Stripe.AccountCreateParams.Capabilities;
  metadata?: Stripe.MetadataParam;
  stripeOptions?: Omit<Stripe.AccountCreateParams, "type" | "country" | "email" | "capabilities" | "metadata">;
}

export interface StripeConnectAccountLinkInput {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type?: Stripe.AccountLinkCreateParams.Type;
  collect?: Stripe.AccountLinkCreateParams.Collect;
  stripeOptions?: Omit<
    Stripe.AccountLinkCreateParams,
    "account" | "refresh_url" | "return_url" | "type" | "collect"
  >;
}

export interface StripeConnectLoginLinkInput {
  accountId: string;
  stripeOptions?: Stripe.AccountCreateLoginLinkParams;
}

export interface StripeConnectTransferInput {
  amount: number;
  currency: string;
  destinationAccountId: string;
  description?: string;
  metadata?: Stripe.MetadataParam;
  sourceTransaction?: string;
  transferGroup?: string;
  stripeOptions?: Omit<
    Stripe.TransferCreateParams,
    "amount" | "currency" | "destination" | "description" | "metadata" | "source_transaction" | "transfer_group"
  >;
}

export interface StripeSubscriptionSwapInput {
  subscriptionId: string;
  priceId: string;
  quantity?: number;
  prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
}

export interface StripeSubscriptionQuantityInput {
  subscriptionId: string;
  quantity: number;
  prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
}

export interface StripePauseSubscriptionInput {
  subscriptionId: string;
  behavior?: "void" | "keep_as_draft" | "mark_uncollectible";
  resumesAt?: Date;
}

export interface StripeCoreApiOptions {
  stripe: Stripe;
  repositories?: StripeCoreRepositories;
  customerAttributeMapper?: (
    input: StripeCustomerCreateInput | StripeCustomerUpdateInput,
  ) => Record<string, string>;
}

function toDate(unixTime?: number | null): Date | undefined {
  if (unixTime === null || unixTime === undefined) {
    return undefined;
  }

  return new Date(unixTime * 1000);
}

function appendCheckoutSessionId(url: string): string {
  if (url.includes("stripe_checkout_session_id=")) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}stripe_checkout_session_id={CHECKOUT_SESSION_ID}`;
}

function withCheckoutSessionIdUrls(urls: StripeCheckoutUrls): StripeCheckoutUrls {
  return {
    successUrl: urls.successUrl === undefined ? undefined : appendCheckoutSessionId(urls.successUrl),
    cancelUrl: urls.cancelUrl === undefined ? undefined : appendCheckoutSessionId(urls.cancelUrl),
    returnUrl: urls.returnUrl === undefined ? undefined : appendCheckoutSessionId(urls.returnUrl),
  };
}

function normalizePaymentMethod(
  paymentMethod: Stripe.PaymentMethod,
  customerId: string,
  isDefault: boolean,
): PaymentMethodRecord {
  return {
    id: `stripe_pm_${paymentMethod.id}`,
    processor: "stripe",
    processorId: paymentMethod.id,
    customerProcessorId: customerId,
    methodType: paymentMethod.type ?? "unknown",
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    expMonth: paymentMethod.card?.exp_month,
    expYear: paymentMethod.card?.exp_year,
    isDefault,
    rawPayload: paymentMethod,
  };
}

function toSubscriptionRecord(subscription: Stripe.Subscription): SubscriptionRecord {
  const firstItem = subscription.items.data[0];
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  return {
    id: `stripe_sub_${subscription.id}`,
    processor: "stripe",
    processorId: subscription.id,
    customerProcessorId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
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

function getPaymentMethodSnapshot(
  paymentIntent: Stripe.PaymentIntent,
  charge: Stripe.Charge | null,
): Record<string, unknown> | undefined {
  if (charge !== null && charge.payment_method_details !== null) {
    return {
      type: charge.payment_method_details.type,
      details: charge.payment_method_details,
    };
  }

  if (typeof paymentIntent.payment_method === "string") {
    return {
      paymentMethodId: paymentIntent.payment_method,
    };
  }

  if (paymentIntent.payment_method && typeof paymentIntent.payment_method === "object") {
    return {
      paymentMethodId: paymentIntent.payment_method.id,
      type: paymentIntent.payment_method.type,
    };
  }

  return undefined;
}

function toChargeRecord(
  paymentIntent: Stripe.PaymentIntent,
  charge: Stripe.Charge | null,
): ChargeRecord {
  const customerId =
    typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;

  if (customerId === undefined) {
    throw new ConfigurationError("Stripe PaymentIntent is missing a customer id.", {
      details: { paymentIntentId: paymentIntent.id },
    });
  }

  const taxAmount = paymentIntent.amount_details?.tax?.total_tax_amount ?? undefined;
  const lineItems = paymentIntent.amount_details?.line_items;
  const lineItemTaxAmounts = (Array.isArray(lineItems) ? lineItems : lineItems?.data)
    ?.map((lineItem) => lineItem.tax?.total_tax_amount)
    .filter((value): value is number => typeof value === "number");

  return {
    id: `stripe_charge_${charge?.id ?? paymentIntent.id}`,
    processor: "stripe",
    processorId: charge?.id ?? paymentIntent.id,
    customerProcessorId: customerId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    receiptUrl: charge?.receipt_url ?? undefined,
    taxAmount,
    totalTaxAmounts: lineItemTaxAmounts && lineItemTaxAmounts.length > 0 ? lineItemTaxAmounts : undefined,
    refundTotal: charge?.amount_refunded,
    paymentMethodSnapshot: getPaymentMethodSnapshot(paymentIntent, charge),
    rawPayload: {
      paymentIntent,
      charge,
    },
  };
}

function pickCustomerIdFromPaymentMethod(paymentMethod: Stripe.PaymentMethod): string {
  if (typeof paymentMethod.customer === "string") {
    return paymentMethod.customer;
  }

  if (paymentMethod.customer && typeof paymentMethod.customer === "object") {
    return paymentMethod.customer.id;
  }

  throw new ConfigurationError("Stripe PaymentMethod is not attached to a customer.", {
    details: { paymentMethodId: paymentMethod.id },
  });
}

async function resolveLatestCharge(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
): Promise<Stripe.Charge | null> {
  if (paymentIntent.latest_charge === null) {
    return null;
  }

  if (typeof paymentIntent.latest_charge === "string") {
    return stripe.charges.retrieve(paymentIntent.latest_charge);
  }

  return paymentIntent.latest_charge;
}

async function updateSubscriptionAndPersist(
  stripe: Stripe,
  repositories: StripeCoreRepositories,
  subscriptionId: string,
  update: Stripe.SubscriptionUpdateParams,
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.update(subscriptionId, update);
  await repositories.subscriptions?.upsert(toSubscriptionRecord(subscription));
  return subscription;
}

export function createStripeCoreApi(options: StripeCoreApiOptions) {
  const repositories = options.repositories ?? {};

  const customers = {
    async create(input: StripeCustomerCreateInput): Promise<Stripe.Customer> {
      try {
        const metadata = {
          ...input.metadata,
          ...options.customerAttributeMapper?.(input),
        };

        const customer = await options.stripe.customers.create({
          email: input.email,
          name: input.name,
          description: input.description,
          metadata,
        });

        await repositories.customers?.upsert({
          processor: "stripe",
          processorId: customer.id,
          email: customer.email ?? undefined,
          metadata: customer.metadata,
          rawPayload: customer,
        });

        return customer;
      } catch (error: unknown) {
        throw mapStripeError(error, "customers.create");
      }
    },

    async retrieve(
      customerId: string,
      requestOptions?: Stripe.RequestOptions,
    ): Promise<Stripe.Customer> {
      try {
        return await options.stripe.customers.retrieve(customerId, requestOptions) as Stripe.Customer;
      } catch (error: unknown) {
        throw mapStripeError(error, "customers.retrieve");
      }
    },

    async update(customerId: string, input: StripeCustomerUpdateInput): Promise<Stripe.Customer> {
      try {
        const metadata = {
          ...(input.metadata ?? {}),
          ...options.customerAttributeMapper?.(input),
        };

        const customer = await options.stripe.customers.update(customerId, {
          email: input.email,
          name: input.name,
          description: input.description ?? undefined,
          metadata,
        });

        await repositories.customers?.upsert({
          processor: "stripe",
          processorId: customer.id,
          email: customer.email ?? undefined,
          metadata: customer.metadata,
          rawPayload: customer,
        });

        return customer;
      } catch (error: unknown) {
        throw mapStripeError(error, "customers.update");
      }
    },

    async updatePaymentMethod(input: StripeUpdatePaymentMethodInput): Promise<PaymentMethodRecord> {
      return paymentMethods.add({
        customerId: input.customerId,
        paymentMethodId: input.paymentMethodId,
        setAsDefault: true,
      });
    },

    async previewInvoice(input: StripeCustomerPreviewInvoiceInput): Promise<Stripe.Invoice> {
      try {
        return await options.stripe.invoices.createPreview({
          customer: input.customerId,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "invoices.createPreview(customer)");
      }
    },

    async reconcileByEmail(input: StripeCustomerReconcileInput): Promise<readonly Stripe.Customer[]> {
      try {
        const response = await options.stripe.customers.list({
          email: input.email,
          limit: input.limit ?? 10,
        });

        return response.data;
      } catch (error: unknown) {
        throw mapStripeError(error, "customers.list");
      }
    },

    async reconcileByProcessorId(
      customerId: string,
      requestOptions?: Stripe.RequestOptions,
    ): Promise<Stripe.Customer> {
      return customers.retrieve(customerId, requestOptions);
    },
  };

  const paymentMethods = {
    async add(
      input: StripePaymentMethodInput & { setAsDefault?: boolean },
    ): Promise<PaymentMethodRecord> {
      try {
        const attached = await options.stripe.paymentMethods.attach(input.paymentMethodId, {
          customer: input.customerId,
        });

        let isDefault = false;

        if (input.setAsDefault) {
          await paymentMethods.setDefault({
            customerId: input.customerId,
            paymentMethodId: input.paymentMethodId,
          });
          isDefault = true;
        }

        const record = normalizePaymentMethod(attached, input.customerId, isDefault);
        await repositories.paymentMethods?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentMethods.attach");
      }
    },

    async update(
      paymentMethodId: string,
      update: Stripe.PaymentMethodUpdateParams,
    ): Promise<PaymentMethodRecord> {
      try {
        const paymentMethod = await options.stripe.paymentMethods.update(paymentMethodId, update);
        const customerId = pickCustomerIdFromPaymentMethod(paymentMethod);
        const record = normalizePaymentMethod(paymentMethod, customerId, false);
        await repositories.paymentMethods?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentMethods.update");
      }
    },

    async setDefault(input: StripeSetDefaultPaymentMethodInput): Promise<void> {
      try {
        if (input.syncCustomerInvoiceSettings ?? true) {
          await options.stripe.customers.update(input.customerId, {
            invoice_settings: {
              default_payment_method: input.paymentMethodId,
            },
          });
        }

        await repositories.paymentMethods?.clearDefaultForCustomer(input.customerId);

        const paymentMethod = await options.stripe.paymentMethods.retrieve(input.paymentMethodId);

        await repositories.paymentMethods?.upsert(
          normalizePaymentMethod(paymentMethod, input.customerId, true),
        );
      } catch (error: unknown) {
        throw mapStripeError(error, "customers.update(default_payment_method)");
      }
    },

    async detach(paymentMethodId: string): Promise<void> {
      try {
        await options.stripe.paymentMethods.detach(paymentMethodId);
        await repositories.paymentMethods?.deleteByProcessorId(paymentMethodId);
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentMethods.detach");
      }
    },
  };

  const charges = {
    async charge(input: StripeChargeInput): Promise<ChargeRecord> {
      try {
        const paymentIntent = await options.stripe.paymentIntents.create({
          amount: input.amount,
          currency: input.currency,
          customer: input.customerId,
          payment_method: input.paymentMethodId,
          confirm: true,
          capture_method: "automatic",
          description: input.description,
          metadata: input.metadata,
          ...input.stripeOptions,
        });

        const latestCharge = await resolveLatestCharge(options.stripe, paymentIntent);
        const record = toChargeRecord(paymentIntent, latestCharge);
        await repositories.charges?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentIntents.create(charge)");
      }
    },

    async authorize(input: StripeChargeInput): Promise<ChargeRecord> {
      try {
        const paymentIntent = await options.stripe.paymentIntents.create({
          amount: input.amount,
          currency: input.currency,
          customer: input.customerId,
          payment_method: input.paymentMethodId,
          confirm: true,
          capture_method: "manual",
          description: input.description,
          metadata: input.metadata,
          ...input.stripeOptions,
        });

        const latestCharge = await resolveLatestCharge(options.stripe, paymentIntent);
        const record = toChargeRecord(paymentIntent, latestCharge);
        await repositories.charges?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentIntents.create(authorize)");
      }
    },

    async capture(input: StripeCaptureInput): Promise<ChargeRecord> {
      try {
        const paymentIntent = await options.stripe.paymentIntents.capture(input.paymentIntentId, {
          amount_to_capture: input.amountToCapture,
        });
        const latestCharge = await resolveLatestCharge(options.stripe, paymentIntent);
        const record = toChargeRecord(paymentIntent, latestCharge);
        await repositories.charges?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "paymentIntents.capture");
      }
    },

    async refund(input: StripeRefundInput): Promise<ChargeRecord> {
      try {
        await options.stripe.refunds.create({
          payment_intent: input.paymentIntentId,
          amount: input.amount,
          reason: input.reason,
          metadata: input.metadata,
        });

        const paymentIntent = await options.stripe.paymentIntents.retrieve(input.paymentIntentId);
        const latestCharge = await resolveLatestCharge(options.stripe, paymentIntent);
        const record = toChargeRecord(paymentIntent, latestCharge);
        await repositories.charges?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "refunds.create");
      }
    },
  };

  const subscriptions = {
    async create(input: StripeSubscriptionCreateInput): Promise<SubscriptionRecord> {
      try {
        const items =
          input.items ??
          (input.priceId === undefined
            ? undefined
            : [
                {
                  price: input.priceId,
                  quantity: input.quantity,
                },
              ]);

        if (items === undefined || items.length === 0) {
          throw new ConfigurationError(
            "Subscription create requires a priceId or at least one Stripe item.",
          );
        }

        const subscription = await options.stripe.subscriptions.create({
          customer: input.customerId,
          items,
          trial_period_days: input.trialPeriodDays,
          metadata: input.metadata,
          ...input.stripeOptions,
        });

        const record = toSubscriptionRecord(subscription);
        await repositories.subscriptions?.upsert(record);
        return record;
      } catch (error: unknown) {
        if (error instanceof ConfigurationError) {
          throw error;
        }

        throw mapStripeError(error, "subscriptions.create");
      }
    },

    async cancel(subscriptionId: string): Promise<SubscriptionRecord> {
      const subscription = await updateSubscriptionAndPersist(
        options.stripe,
        repositories,
        subscriptionId,
        { cancel_at_period_end: true },
      );

      return toSubscriptionRecord(subscription);
    },

    async cancelNow(subscriptionId: string): Promise<SubscriptionRecord> {
      try {
        const subscription = await options.stripe.subscriptions.cancel(subscriptionId);
        const record = toSubscriptionRecord(subscription);
        await repositories.subscriptions?.upsert(record);
        return record;
      } catch (error: unknown) {
        throw mapStripeError(error, "subscriptions.cancel");
      }
    },

    async resume(subscriptionId: string): Promise<SubscriptionRecord> {
      const subscription = await updateSubscriptionAndPersist(
        options.stripe,
        repositories,
        subscriptionId,
        {
          cancel_at_period_end: false,
        },
      );

      return toSubscriptionRecord(subscription);
    },

    async swap(input: StripeSubscriptionSwapInput): Promise<SubscriptionRecord> {
      try {
        const existing = await options.stripe.subscriptions.retrieve(input.subscriptionId);
        const item = existing.items.data[0];

        if (item === undefined) {
          throw new ActionRequiredError("Subscription has no items to swap.", {
            details: { subscriptionId: input.subscriptionId },
          });
        }

        const subscription = await updateSubscriptionAndPersist(
          options.stripe,
          repositories,
          input.subscriptionId,
          {
            items: [
              {
                id: item.id,
                price: input.priceId,
                quantity: input.quantity,
              },
            ],
            proration_behavior: input.prorationBehavior,
          },
        );

        return toSubscriptionRecord(subscription);
      } catch (error: unknown) {
        if (error instanceof ActionRequiredError) {
          throw error;
        }

        throw mapStripeError(error, "subscriptions.update(swap)");
      }
    },

    async changeQuantity(input: StripeSubscriptionQuantityInput): Promise<SubscriptionRecord> {
      try {
        const existing = await options.stripe.subscriptions.retrieve(input.subscriptionId);
        const item = existing.items.data[0];

        if (item === undefined) {
          throw new ActionRequiredError("Subscription has no items for quantity updates.", {
            details: { subscriptionId: input.subscriptionId },
          });
        }

        const subscription = await updateSubscriptionAndPersist(
          options.stripe,
          repositories,
          input.subscriptionId,
          {
            items: [
              {
                id: item.id,
                quantity: input.quantity,
              },
            ],
            proration_behavior: input.prorationBehavior,
          },
        );

        return toSubscriptionRecord(subscription);
      } catch (error: unknown) {
        if (error instanceof ActionRequiredError) {
          throw error;
        }

        throw mapStripeError(error, "subscriptions.update(changeQuantity)");
      }
    },

    async pause(input: StripePauseSubscriptionInput): Promise<SubscriptionRecord> {
      const subscription = await updateSubscriptionAndPersist(
        options.stripe,
        repositories,
        input.subscriptionId,
        {
          pause_collection: {
            behavior: input.behavior ?? "void",
            resumes_at:
              input.resumesAt === undefined ? undefined : Math.floor(input.resumesAt.getTime() / 1000),
          },
        },
      );

      return toSubscriptionRecord(subscription);
    },

    async unpause(subscriptionId: string): Promise<SubscriptionRecord> {
      const subscription = await updateSubscriptionAndPersist(
        options.stripe,
        repositories,
        subscriptionId,
        {
          pause_collection: null,
        },
      );

      return toSubscriptionRecord(subscription);
    },

    async retryFailedPayment(subscriptionId: string): Promise<readonly Stripe.Invoice[]> {
      try {
        const invoices = await options.stripe.invoices.list({
          subscription: subscriptionId,
          status: "open",
          limit: 1,
        });

        if (invoices.data[0] !== undefined) {
          await options.stripe.invoices.pay(invoices.data[0].id);
        }

        return invoices.data;
      } catch (error: unknown) {
        throw mapStripeError(error, "invoices.pay(retryFailedPayment)");
      }
    },

    async payOpenInvoices(customerId: string): Promise<readonly Stripe.Invoice[]> {
      try {
        const invoices = await options.stripe.invoices.list({
          customer: customerId,
          status: "open",
          limit: 100,
        });

        for (const invoice of invoices.data) {
          await options.stripe.invoices.pay(invoice.id);
        }

        return invoices.data;
      } catch (error: unknown) {
        throw mapStripeError(error, "invoices.pay(payOpenInvoices)");
      }
    },

    async previewInvoice(input: StripeSubscriptionPreviewInvoiceInput): Promise<Stripe.Invoice> {
      try {
        return await options.stripe.invoices.createPreview({
          subscription: input.subscriptionId,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "invoices.createPreview(subscription)");
      }
    },
  };

  const checkout = {
    appendSessionIdToUrl(url: string): string {
      return appendCheckoutSessionId(url);
    },

    withSessionIdUrls(urls: StripeCheckoutUrls): StripeCheckoutUrls {
      return withCheckoutSessionIdUrls(urls);
    },

    async createPaymentSession(input: StripeCheckoutPaymentSessionInput): Promise<Stripe.Checkout.Session> {
      try {
        const urls = input.applySessionIdToUrls === false
          ? { successUrl: input.successUrl, cancelUrl: input.cancelUrl }
          : withCheckoutSessionIdUrls({ successUrl: input.successUrl, cancelUrl: input.cancelUrl });

        return await options.stripe.checkout.sessions.create({
          mode: "payment",
          success_url: urls.successUrl,
          cancel_url: urls.cancelUrl,
          line_items: input.lineItems,
          customer: input.customerId,
          customer_email: input.customerEmail,
          metadata: input.metadata,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "checkout.sessions.create(payment)");
      }
    },

    async createSetupSession(input: StripeCheckoutSetupSessionInput): Promise<Stripe.Checkout.Session> {
      try {
        const urls = input.applySessionIdToUrls === false
          ? {
              successUrl: input.successUrl,
              cancelUrl: input.cancelUrl,
              returnUrl: input.returnUrl,
            }
          : withCheckoutSessionIdUrls({
              successUrl: input.successUrl,
              cancelUrl: input.cancelUrl,
              returnUrl: input.returnUrl,
            });

        return await options.stripe.checkout.sessions.create({
          mode: "setup",
          success_url: urls.successUrl,
          cancel_url: urls.cancelUrl,
          return_url: urls.returnUrl,
          customer: input.customerId,
          customer_email: input.customerEmail,
          metadata: input.metadata,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "checkout.sessions.create(setup)");
      }
    },

    async createSubscriptionSession(
      input: StripeCheckoutSubscriptionSessionInput,
    ): Promise<Stripe.Checkout.Session> {
      try {
        const urls = input.applySessionIdToUrls === false
          ? { successUrl: input.successUrl, cancelUrl: input.cancelUrl }
          : withCheckoutSessionIdUrls({ successUrl: input.successUrl, cancelUrl: input.cancelUrl });

        return await options.stripe.checkout.sessions.create({
          mode: "subscription",
          success_url: urls.successUrl,
          cancel_url: urls.cancelUrl,
          line_items: input.lineItems,
          customer: input.customerId,
          customer_email: input.customerEmail,
          metadata: input.metadata,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "checkout.sessions.create(subscription)");
      }
    },

    async checkoutCharge(input: StripeCheckoutChargeSessionInput): Promise<Stripe.Checkout.Session> {
      return checkout.createPaymentSession({
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        metadata: input.metadata,
        applySessionIdToUrls: input.applySessionIdToUrls,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        lineItems: [
          {
            price_data: {
              currency: input.currency ?? "usd",
              product_data: {
                name: input.name,
              },
              unit_amount: input.amount,
            },
            quantity: input.quantity ?? 1,
          },
        ],
        stripeOptions: input.stripeOptions,
      });
    },
  };

  const billingPortal = {
    async createSession(input: StripeBillingPortalSessionInput): Promise<Stripe.BillingPortal.Session> {
      try {
        return await options.stripe.billingPortal.sessions.create({
          customer: input.customerId,
          return_url: input.returnUrl,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "billingPortal.sessions.create");
      }
    },
  };

  const meters = {
    async createEvent(input: StripeMeterEventInput): Promise<StripeMeterEventResponse> {
      try {
        return await options.stripe.billing.meterEvents.create({
          event_name: input.eventName,
          payload: input.payload,
          identifier: input.identifier,
          timestamp: input.timestamp,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "billing.meterEvents.create");
      }
    },
  };

  const connect = {
    async createAccount(input: StripeConnectCreateAccountInput): Promise<Stripe.Account> {
      try {
        return await options.stripe.accounts.create({
          type: input.type,
          country: input.country,
          email: input.email,
          capabilities: input.capabilities,
          metadata: input.metadata,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "accounts.create");
      }
    },

    async retrieveAccount(accountId: string): Promise<Stripe.Account> {
      try {
        return await options.stripe.accounts.retrieve(accountId);
      } catch (error: unknown) {
        throw mapStripeError(error, "accounts.retrieve");
      }
    },

    async createAccountLink(input: StripeConnectAccountLinkInput): Promise<Stripe.AccountLink> {
      try {
        return await options.stripe.accountLinks.create({
          account: input.accountId,
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
          type: input.type ?? "account_onboarding",
          collect: input.collect,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "accountLinks.create");
      }
    },

    async createLoginLink(input: StripeConnectLoginLinkInput): Promise<Stripe.LoginLink> {
      try {
        return await options.stripe.accounts.createLoginLink(input.accountId, {
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "accounts.createLoginLink");
      }
    },

    async createTransfer(input: StripeConnectTransferInput): Promise<Stripe.Transfer> {
      try {
        return await options.stripe.transfers.create({
          amount: input.amount,
          currency: input.currency,
          destination: input.destinationAccountId,
          description: input.description,
          metadata: input.metadata,
          source_transaction: input.sourceTransaction,
          transfer_group: input.transferGroup,
          ...input.stripeOptions,
        });
      } catch (error: unknown) {
        throw mapStripeError(error, "transfers.create");
      }
    },
  };

  const state = {
    subscribed(subscription: SubscriptionRecord): boolean {
      return ![
        "canceled",
        "incomplete_expired",
        "unpaid",
      ].includes(subscription.status);
    },

    onTrial(subscription: SubscriptionRecord, now = new Date()): boolean {
      return subscription.status === "trialing" && (subscription.trialEndsAt?.getTime() ?? 0) > now.getTime();
    },

    onGracePeriod(subscription: SubscriptionRecord, now = new Date()): boolean {
      if (!subscription.cancelAtPeriodEnd || subscription.currentPeriodEnd === undefined) {
        return false;
      }

      return subscription.currentPeriodEnd.getTime() > now.getTime();
    },

    paused(subscription: SubscriptionRecord): boolean {
      return subscription.pausedBehavior !== undefined;
    },

    active(subscription: SubscriptionRecord, now = new Date()): boolean {
      if (state.onTrial(subscription, now)) {
        return true;
      }

      return subscription.status === "active" || state.onGracePeriod(subscription, now);
    },

    billingPeriod(subscription: SubscriptionRecord): {
      startsAt?: Date;
      endsAt?: Date;
    } {
      return {
        startsAt: subscription.currentPeriodStart,
        endsAt: subscription.currentPeriodEnd,
      };
    },
  };

  return {
    customers,
    paymentMethods,
    charges,
    subscriptions,
    checkout,
    billingPortal,
    meters,
    connect,
    state,
  };
}
