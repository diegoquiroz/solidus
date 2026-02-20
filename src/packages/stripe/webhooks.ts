import Stripe from "stripe";
import { ConfigurationError, SignatureVerificationError } from "../core/errors.ts";

const stripeNamespace = "stripe";

export const requiredStripeWebhookEvents = [
  "charge.succeeded",
  "charge.refunded",
  "charge.updated",
  "payment_intent.succeeded",
  "invoice.upcoming",
  "invoice.payment_action_required",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "customer.updated",
  "customer.deleted",
  "payment_method.attached",
  "payment_method.updated",
  "payment_method.card_automatically_updated",
  "payment_method.detached",
  "account.updated",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export type RequiredStripeWebhookEventType = typeof requiredStripeWebhookEvents[number];

export interface StripeWebhookEventDiagnostics {
  missingRequiredEvents: readonly string[];
  configuredEvents: readonly string[];
}

export interface StripeWebhookSubscriberContext {
  eventName: string;
  event: Stripe.Event;
  suppressed: boolean;
}

export type StripeWebhookSubscriber = (context: StripeWebhookSubscriberContext) => Promise<void> | void;

type StripeWebhookHandlerResult = {
  suppressSubscribers?: boolean;
};

type StripeWebhookHandler = (event: Stripe.Event) => Promise<StripeWebhookHandlerResult | void>;

function normalizeEventName(name: string): string {
  return name.startsWith(`${stripeNamespace}.`) ? name : `${stripeNamespace}.${name}`;
}

function getObjectId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function getObject(value: Stripe.Event): Record<string, unknown> {
  const object = value.data.object;

  if (typeof object !== "object" || object === null) {
    return {};
  }

  return object as unknown as Record<string, unknown>;
}

export function diagnoseStripeWebhookEvents(configuredEvents: readonly string[]): StripeWebhookEventDiagnostics {
  const normalizedConfigured = new Set(configuredEvents.map((eventName) => eventName.trim()));
  const missingRequiredEvents = requiredStripeWebhookEvents.filter(
    (eventName) => !normalizedConfigured.has(eventName),
  );

  return {
    missingRequiredEvents,
    configuredEvents,
  };
}

export async function verifyStripeWebhookEvent(input: {
  stripe: Stripe;
  payload: string | Uint8Array;
  signatureHeader?: string;
  webhookSecrets: readonly string[];
}): Promise<Stripe.Event> {
  if (input.signatureHeader === undefined || input.signatureHeader.trim().length === 0) {
    throw new SignatureVerificationError("Stripe-Signature header is required for webhook verification.", {
      details: {
        provider: "stripe",
      },
    });
  }

  if (input.webhookSecrets.length === 0) {
    throw new ConfigurationError("At least one Stripe webhook signing secret is required.", {
      details: {
        provider: "stripe",
      },
    });
  }

  if (typeof input.payload !== "string" && !(input.payload instanceof Uint8Array)) {
    throw new SignatureVerificationError(
      "Stripe webhook payload must be raw body bytes. Ensure route-local express.raw middleware runs first.",
      {
        details: {
          provider: "stripe",
          reason: "parsed_body",
        },
      },
    );
  }

  const payload =
    typeof input.payload === "string" ? input.payload : Buffer.from(input.payload);

  let lastError: unknown;

  for (const secret of input.webhookSecrets) {
    if (secret.trim().length === 0) {
      continue;
    }

    try {
      return await input.stripe.webhooks.constructEventAsync(payload, input.signatureHeader, secret);
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw new SignatureVerificationError(
    "Stripe webhook signature verification failed for all configured webhook secrets.",
    {
      cause: lastError,
      details: {
        provider: "stripe",
        secretsTried: input.webhookSecrets.length,
      },
    },
  );
}

export function createStripeWebhookDelegator() {
  const subscribers = new Map<string, Set<StripeWebhookSubscriber>>();
  const allSubscribers = new Set<StripeWebhookSubscriber>();

  return {
    subscribe(eventName: string, subscriber: StripeWebhookSubscriber): () => void {
      const normalized = normalizeEventName(eventName);
      const handlers = subscribers.get(normalized) ?? new Set<StripeWebhookSubscriber>();
      handlers.add(subscriber);
      subscribers.set(normalized, handlers);

      return () => {
        handlers.delete(subscriber);
      };
    },

    unsubscribe(eventName: string, subscriber?: StripeWebhookSubscriber): void {
      const normalized = normalizeEventName(eventName);
      const handlers = subscribers.get(normalized);

      if (handlers === undefined) {
        return;
      }

      if (subscriber === undefined) {
        handlers.clear();
      } else {
        handlers.delete(subscriber);
      }
    },

    all(subscriber: StripeWebhookSubscriber): () => void {
      allSubscribers.add(subscriber);

      return () => {
        allSubscribers.delete(subscriber);
      };
    },

    listening(eventName: string): boolean {
      const normalized = normalizeEventName(eventName);
      return allSubscribers.size > 0 || (subscribers.get(normalized)?.size ?? 0) > 0;
    },

    async publish(context: StripeWebhookSubscriberContext): Promise<void> {
      const handlers = subscribers.get(context.eventName);

      if (handlers !== undefined) {
        for (const handler of handlers) {
          await handler(context);
        }
      }

      for (const handler of allSubscribers) {
        await handler(context);
      }
    },
  };
}

export interface StripeWebhookEffects {
  syncChargeById?(chargeId: string, event: Stripe.Event): Promise<void>;
  syncChargeByPaymentIntentId?(paymentIntentId: string, event: Stripe.Event): Promise<void>;
  syncSubscriptionById?(subscriptionId: string, event: Stripe.Event): Promise<void>;
  syncCustomerById?(customerId: string, event: Stripe.Event): Promise<void>;
  deleteCustomerById?(customerId: string, event: Stripe.Event): Promise<void>;
  syncPaymentMethodById?(paymentMethodId: string, event: Stripe.Event): Promise<void>;
  deletePaymentMethodById?(paymentMethodId: string, event: Stripe.Event): Promise<void>;
  syncAccountById?(accountId: string, event: Stripe.Event): Promise<void>;
  notifyInvoiceUpcoming?(invoiceId: string, event: Stripe.Event): Promise<void>;
  notifyPaymentActionRequired?(input: {
    invoiceId: string;
    paymentIntentId?: string;
    event: Stripe.Event;
  }): Promise<void>;
  notifyPaymentFailed?(invoiceId: string, event: Stripe.Event): Promise<void>;
  notifySubscriptionTrialWillEnd?(subscriptionId: string, event: Stripe.Event): Promise<void>;
  linkCheckoutOwner?(input: {
    clientReferenceId: string;
    customerId: string;
    event: Stripe.Event;
  }): Promise<void>;
}

export function createStripeWebhookHandlers(input: {
  effects?: StripeWebhookEffects;
}): Readonly<Record<RequiredStripeWebhookEventType, StripeWebhookHandler>> {
  const effects = input.effects ?? {};

  const handlers: Readonly<Record<RequiredStripeWebhookEventType, StripeWebhookHandler>> = {
    "charge.succeeded": async (event) => {
      const chargeId = getObjectId(event.data.object);

      if (chargeId !== undefined) {
        await effects.syncChargeById?.(chargeId, event);
      }
    },

    "charge.refunded": async (event) => {
      const chargeId = getObjectId(event.data.object);

      if (chargeId !== undefined) {
        await effects.syncChargeById?.(chargeId, event);
      }
    },

    "charge.updated": async (event) => {
      const chargeId = getObjectId(event.data.object);

      if (chargeId !== undefined) {
        await effects.syncChargeById?.(chargeId, event);
      }
    },

    "payment_intent.succeeded": async (event) => {
      const paymentIntentId = getObjectId(event.data.object);

      if (paymentIntentId !== undefined) {
        await effects.syncChargeByPaymentIntentId?.(paymentIntentId, event);
      }

      return {
        suppressSubscribers: true,
      };
    },

    "invoice.upcoming": async (event) => {
      const invoiceId = getObjectId(event.data.object);

      if (invoiceId !== undefined) {
        await effects.notifyInvoiceUpcoming?.(invoiceId, event);
      }
    },

    "invoice.payment_action_required": async (event) => {
      const object = getObject(event);
      const invoiceId = getObjectId(event.data.object);

      if (invoiceId === undefined) {
        return;
      }

      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : undefined;

      await effects.notifyPaymentActionRequired?.({
        invoiceId,
        paymentIntentId,
        event,
      });
    },

    "invoice.payment_failed": async (event) => {
      const invoiceId = getObjectId(event.data.object);

      if (invoiceId !== undefined) {
        await effects.notifyPaymentFailed?.(invoiceId, event);
      }
    },

    "customer.subscription.created": async (event) => {
      const subscriptionId = getObjectId(event.data.object);

      if (subscriptionId !== undefined) {
        await effects.syncSubscriptionById?.(subscriptionId, event);
      }
    },

    "customer.subscription.updated": async (event) => {
      const subscriptionId = getObjectId(event.data.object);

      if (subscriptionId !== undefined) {
        await effects.syncSubscriptionById?.(subscriptionId, event);
      }
    },

    "customer.subscription.deleted": async (event) => {
      const subscriptionId = getObjectId(event.data.object);

      if (subscriptionId !== undefined) {
        await effects.syncSubscriptionById?.(subscriptionId, event);
      }
    },

    "customer.subscription.trial_will_end": async (event) => {
      const subscriptionId = getObjectId(event.data.object);

      if (subscriptionId === undefined) {
        return;
      }

      await effects.syncSubscriptionById?.(subscriptionId, event);
      await effects.notifySubscriptionTrialWillEnd?.(subscriptionId, event);
    },

    "customer.updated": async (event) => {
      const customerId = getObjectId(event.data.object);

      if (customerId !== undefined) {
        await effects.syncCustomerById?.(customerId, event);
      }
    },

    "customer.deleted": async (event) => {
      const customerId = getObjectId(event.data.object);

      if (customerId !== undefined) {
        await effects.deleteCustomerById?.(customerId, event);
      }
    },

    "payment_method.attached": async (event) => {
      const paymentMethodId = getObjectId(event.data.object);

      if (paymentMethodId !== undefined) {
        await effects.syncPaymentMethodById?.(paymentMethodId, event);
      }
    },

    "payment_method.updated": async (event) => {
      const paymentMethodId = getObjectId(event.data.object);

      if (paymentMethodId !== undefined) {
        await effects.syncPaymentMethodById?.(paymentMethodId, event);
      }
    },

    "payment_method.card_automatically_updated": async (event) => {
      const paymentMethodId = getObjectId(event.data.object);

      if (paymentMethodId !== undefined) {
        await effects.syncPaymentMethodById?.(paymentMethodId, event);
      }
    },

    "payment_method.detached": async (event) => {
      const paymentMethodId = getObjectId(event.data.object);

      if (paymentMethodId !== undefined) {
        await effects.deletePaymentMethodById?.(paymentMethodId, event);
      }
    },

    "account.updated": async (event) => {
      const accountId = getObjectId(event.data.object);

      if (accountId !== undefined) {
        await effects.syncAccountById?.(accountId, event);
      }
    },

    "checkout.session.completed": async (event) => {
      const object = getObject(event);

      const clientReferenceId =
        typeof object.client_reference_id === "string" ? object.client_reference_id : undefined;
      const customerId = typeof object.customer === "string" ? object.customer : undefined;
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : undefined;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : undefined;

      if (clientReferenceId !== undefined && customerId !== undefined) {
        await effects.linkCheckoutOwner?.({
          clientReferenceId,
          customerId,
          event,
        });
      }

      if (paymentIntentId !== undefined) {
        await effects.syncChargeByPaymentIntentId?.(paymentIntentId, event);
      }

      if (subscriptionId !== undefined) {
        await effects.syncSubscriptionById?.(subscriptionId, event);
      }
    },

    "checkout.session.async_payment_succeeded": async (event) => {
      const object = getObject(event);
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : undefined;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : undefined;

      if (paymentIntentId !== undefined) {
        await effects.syncChargeByPaymentIntentId?.(paymentIntentId, event);
      }

      if (subscriptionId !== undefined) {
        await effects.syncSubscriptionById?.(subscriptionId, event);
      }
    },
  };

  return handlers;
}

export function createStripeWebhookProcessor(input: {
  handlers?: Readonly<Record<RequiredStripeWebhookEventType, StripeWebhookHandler>>;
  delegator?: ReturnType<typeof createStripeWebhookDelegator>;
}) {
  const handlers = input.handlers ?? createStripeWebhookHandlers({});
  const delegator = input.delegator ?? createStripeWebhookDelegator();

  return {
    async process(event: Stripe.Event): Promise<void> {
      const eventType = event.type as RequiredStripeWebhookEventType;
      const handler = handlers[eventType];

      if (handler === undefined) {
        return;
      }

      const result = await handler(event);
      const suppressed = result?.suppressSubscribers === true;
      const eventName = normalizeEventName(event.type);

      if (!suppressed) {
        await delegator.publish({
          event,
          eventName,
          suppressed,
        });
      }
    },
    delegator,
  };
}
