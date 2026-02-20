import type Stripe from "stripe";
import { ConfigurationError } from "../core/errors.ts";
import type { StripeCoreApiOptions } from "../stripe/core-apis.ts";
import { createStripeCoreApi } from "../stripe/core-apis.ts";
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
  customerAttributeMapper?: StripeCoreApiOptions["customerAttributeMapper"];
  webhookEffects?: StripeWebhookEffects;
}

export function createSolidusFacade(options: SolidusFacadeOptions) {
  const api = createStripeCoreApi({
    stripe: options.stripe,
    repositories: options.repositories,
    customerAttributeMapper: options.customerAttributeMapper,
  });

  const defaultHandlers = createStripeWebhookHandlers({
    effects: options.webhookEffects,
  });

  const webhookProcessor = createStripeWebhookProcessor({
    handlers: defaultHandlers,
  });

  return {
    api,
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
