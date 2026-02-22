import type { SolidusRepositories } from "../core/contracts.ts";
import type { StripeCoreRepositories } from "../stripe/core-apis.ts";
import type { WebhookEventRepository, DbOutboxRepository } from "../core/webhooks.ts";
import type { StripeInvoiceProjectionRepository } from "../stripe/default-webhook-effects.ts";
import type { SolidusModels } from "./initialize-models.ts";
import {
  SolidusCustomerRepository,
  SolidusPaymentMethodRepository,
  SolidusChargeRepository,
  SolidusSubscriptionRepository,
  SolidusInvoiceRepository,
  SolidusWebhookEventRepository,
  SolidusDbOutboxRepository,
  SolidusIdempotencyRepository,
  SolidusStripeCustomerRepository,
} from "./repositories/index.ts";

export interface WebhookRepositories {
  idempotencyRepository: import("../core/contracts.ts").IdempotencyRepository;
  eventRepository: WebhookEventRepository;
  outboxRepository: DbOutboxRepository;
}

export interface RepositoryBundle {
  core: SolidusRepositories;
  facade: StripeCoreRepositories;
  webhook: WebhookRepositories;
  invoices: StripeInvoiceProjectionRepository;
}

export function createRepositoryBundleFromSolidusModels(
  models: SolidusModels
): RepositoryBundle {
  const customers = new SolidusCustomerRepository(models.Customer);
  const idempotency = new SolidusIdempotencyRepository(models.IdempotencyKey);
  const stripeCustomers = new SolidusStripeCustomerRepository(models.StripeCustomer);
  const paymentMethods = new SolidusPaymentMethodRepository(models.PaymentMethod);
  const charges = new SolidusChargeRepository(models.Charge);
  const subscriptions = new SolidusSubscriptionRepository(models.Subscription);
  const invoices = new SolidusInvoiceRepository(models.Invoice);
  const eventRepository = new SolidusWebhookEventRepository(models.WebhookEvent);
  const outboxRepository = new SolidusDbOutboxRepository(models.WebhookOutbox);

  return {
    core: {
      customers,
      idempotency,
    },
    facade: {
      customers: stripeCustomers,
      accounts: undefined,
      paymentMethods,
      charges,
      subscriptions,
    },
    webhook: {
      idempotencyRepository: idempotency,
      eventRepository,
      outboxRepository,
    },
    invoices,
  };
}
