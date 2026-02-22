import type { SolidusRepositories } from "../core/contracts.ts";
import type { StripeCoreRepositories } from "../stripe/core-apis.ts";
import type { WebhookEventRepository } from "../core/webhooks.ts";
import type { SolidusModels } from "./initialize-models.ts";
import {
  SolidusCustomerRepository,
  SolidusPaymentMethodRepository,
  SolidusChargeRepository,
  SolidusSubscriptionRepository,
  SolidusWebhookEventRepository,
  SolidusIdempotencyRepository,
  SolidusStripeCustomerRepository,
} from "./repositories/index.ts";

export interface WebhookRepositories {
  idempotencyRepository: import("../core/contracts.ts").IdempotencyRepository;
  eventRepository: WebhookEventRepository;
}

export interface RepositoryBundle {
  core: SolidusRepositories;
  facade: StripeCoreRepositories;
  webhook: WebhookRepositories;
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
  const eventRepository = new SolidusWebhookEventRepository(models.WebhookEvent);

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
    },
  };
}
