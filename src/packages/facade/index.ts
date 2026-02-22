import type Stripe from "stripe";
import type { CustomerRecord, CustomerRegistry, CustomerRepository } from "../core/contracts.ts";
import { ConfigurationError } from "../core/errors.ts";
import { createOpaqueId } from "../core/opaque-id.ts";
import type { StripeCoreApiOptions } from "../stripe/core-apis.ts";
import { createStripeCoreApi } from "../stripe/core-apis.ts";
import type { StripeDefaultWebhookEffectRepositories } from "../stripe/default-webhook-effects.ts";
import { createDefaultStripeWebhookEffects } from "../stripe/default-webhook-effects.ts";
import type {
  StripeWebhookEffects,
} from "../stripe/webhooks.ts";
import {
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
} from "../stripe/webhooks.ts";

export interface FacadePlaceholder {
  readonly package: "facade";
  readonly status: "not_implemented";
}

export interface SolidusFacadeOptions {
  stripe: Stripe;
  repositories?: StripeCoreApiOptions["repositories"];
  ownerCustomers?: CustomerRepository;
  customerRegistry?: CustomerRegistry;
  webhookRepositories?: Omit<
    StripeDefaultWebhookEffectRepositories,
    "customers" | "accounts" | "paymentMethods" | "charges" | "subscriptions" | "ownerCustomers"
  >;
  customerAttributeMapper?: StripeCoreApiOptions["customerAttributeMapper"];
  webhookEffects?: StripeWebhookEffects;
  webhookRegistration?: {
    enableDefaultEffects?: boolean;
    effects?: StripeWebhookEffects;
  };
}

export interface OwnerReference {
  ownerType: string;
  ownerId: string;
}

export interface SetOwnerStripeProcessorInput extends OwnerReference {
  customerId?: string;
  customer?: Parameters<ReturnType<typeof createStripeCoreApi>["customers"]["create"]>[0];
}

export interface ReconcileOwnerCustomerInput extends OwnerReference {
  customerId?: string;
  stripeAccount?: string;
}

export interface ReconcileOwnerSubscriptionsInput extends ReconcileOwnerCustomerInput {
  limit?: number;
}

export interface OwnerStripeProcessorAssignment {
  owner: OwnerReference;
  processor: "stripe";
  customerId: string;
  customer: Stripe.Customer;
  record?: CustomerRecord;
}

function buildReconcileEvent(stripeAccount?: string): Stripe.Event {
  return {
    id: "evt_solidus_convenience_reconcile",
    object: "event",
    type: "solidus.reconcile",
    account: stripeAccount,
    data: {
      object: {},
    },
  } as unknown as Stripe.Event;
}

async function resolveConnectedAccountId(input: {
  customerId: string;
  explicitStripeAccount?: string;
  findProjectionByProcessorId?: (processorId: string) => Promise<{
    connectedAccountId?: string;
  } | null>;
}): Promise<string | undefined> {
  if (typeof input.explicitStripeAccount === "string" && input.explicitStripeAccount.length > 0) {
    return input.explicitStripeAccount;
  }

  const projection = await input.findProjectionByProcessorId?.(input.customerId);
  const connectedAccountId = projection?.connectedAccountId;

  if (typeof connectedAccountId === "string" && connectedAccountId.length > 0) {
    return connectedAccountId;
  }

  return undefined;
}

export function createSolidusFacade(options: SolidusFacadeOptions) {
  const api = createStripeCoreApi({
    stripe: options.stripe,
    repositories: options.repositories,
    customerAttributeMapper: options.customerAttributeMapper,
  });

  const defaultEffects = options.webhookRegistration?.enableDefaultEffects === false
    ? {}
    : createDefaultStripeWebhookEffects({
        stripe: options.stripe,
        repositories: {
          customers: options.repositories?.customers,
          accounts: options.repositories?.accounts,
          paymentMethods: options.repositories?.paymentMethods,
          charges: options.repositories?.charges,
          subscriptions: options.repositories?.subscriptions,
          invoices: options.webhookRepositories?.invoices,
          ownerCustomers: options.ownerCustomers,
        },
        customerRegistry: options.customerRegistry,
      });

  const defaultHandlers = createStripeWebhookHandlers({
    effects: {
      ...defaultEffects,
      ...options.webhookEffects,
      ...options.webhookRegistration?.effects,
    },
  });

  const webhookProcessor = createStripeWebhookProcessor({
    handlers: defaultHandlers,
  });

  const convenience = {
    async setOwnerStripeProcessor(input: SetOwnerStripeProcessorInput): Promise<OwnerStripeProcessorAssignment> {
      const owner = {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      };

      const existingOwnerCustomer = await options.ownerCustomers?.findByOwner({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        processor: "stripe",
      });

      let customerId = input.customerId;

      if (customerId === undefined) {
        customerId = existingOwnerCustomer?.processorId;
      }

      const customer =
        customerId === undefined
          ? await api.customers.create(input.customer ?? {})
          : await api.customers.reconcileByProcessorId(customerId);

      const record: CustomerRecord | undefined = options.ownerCustomers === undefined
        ? undefined
        : {
            id: existingOwnerCustomer?.id ?? createOpaqueId(),
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            processor: "stripe",
            processorId: customer.id,
          };

      const ownerCustomers = options.ownerCustomers;
      if (record !== undefined && ownerCustomers !== undefined) {
        await ownerCustomers.save(record);
      }

      return {
        owner,
        processor: "stripe",
        customerId: customer.id,
        customer,
        record,
      };
    },

    async syncCustomer(input: ReconcileOwnerCustomerInput): Promise<Stripe.Customer | null> {
      const customerId =
        input.customerId
        ?? (await options.ownerCustomers?.findByOwner({
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          processor: "stripe",
        }))?.processorId;

      if (customerId === undefined) {
        return null;
      }

      const connectedAccountId = await resolveConnectedAccountId({
        customerId,
        explicitStripeAccount: input.stripeAccount,
        findProjectionByProcessorId: options.repositories?.customers?.findByProcessorId?.bind(options.repositories.customers),
      });
      const event = buildReconcileEvent(connectedAccountId);
      const requestOptions =
        connectedAccountId === undefined ? undefined : { stripeAccount: connectedAccountId };
      await defaultEffects.syncCustomerById?.(customerId, event);
      return api.customers.reconcileByProcessorId(customerId, requestOptions);
    },

    async syncSubscriptions(
      input: ReconcileOwnerSubscriptionsInput,
    ): Promise<readonly Stripe.Subscription[]> {
      const customerId =
        input.customerId
        ?? (await options.ownerCustomers?.findByOwner({
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          processor: "stripe",
        }))?.processorId;

      if (customerId === undefined) {
        return [];
      }

      const connectedAccountId = await resolveConnectedAccountId({
        customerId,
        explicitStripeAccount: input.stripeAccount,
        findProjectionByProcessorId: options.repositories?.customers?.findByProcessorId?.bind(options.repositories.customers),
      });
      const requestOptions =
        connectedAccountId === undefined ? undefined : { stripeAccount: connectedAccountId };
      const subscriptions = await options.stripe.subscriptions.list({
        customer: customerId,
        limit: input.limit ?? 100,
      }, requestOptions);
      const event = buildReconcileEvent(connectedAccountId);

      for (const subscription of subscriptions.data) {
        await defaultEffects.syncSubscriptionById?.(subscription.id, event);
      }

      return subscriptions.data;
    },
  };

  return {
    api,
    convenience,
    webhooks: {
      process: webhookProcessor.process,
      delegator: webhookProcessor.delegator,
    },
  };
}

export function createFacadePlaceholder(): FacadePlaceholder {
  return {
    package: "facade",
    status: "not_implemented",
  };
}

export function assertFacadeImplemented(): never {
  throw new ConfigurationError("Facade package is not implemented yet.");
}
