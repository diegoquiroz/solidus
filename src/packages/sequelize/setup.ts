import { Sequelize } from "sequelize";
import Stripe from "stripe";
import {
  initializeSolidusModels,
  type SolidusModels,
} from "./initialize-models.ts";
import {
  createRepositoryBundleFromSolidusModels,
  type RepositoryBundle,
} from "./auto-wire.ts";
import { Solidus, type SolidusFacade } from "../core/global-facade.ts";
import { createSolidusFacade } from "../facade/index.ts";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  type WebhookPipeline,
} from "../core/webhooks.ts";
import {
  createStripeWebhookHandler,
  createStripeWebhookRawBodyMiddleware,
  type ExpressLikeHandler,
} from "../express/index.ts";
import type { QueueAdapter } from "../core/contracts.ts";

export interface SetupSolidusOptions {
  sequelize: Sequelize;
  stripe: Stripe;
  webhookSecret: string;
  tablePrefix?: string;
  schema?: string;
  queueAdapter?: QueueAdapter;
}

export interface SetupSolidusResult {
  models: SolidusModels;
  repositories: RepositoryBundle;
  facade: SolidusFacade;
  api: SolidusFacade["api"];
  webhooks: SolidusFacade["webhooks"];
  convenience: SolidusFacade["convenience"];
  pipeline: WebhookPipeline;
  express: {
    webhookRouter: ExpressLikeHandler | ExpressLikeHandler[];
  };
}

export async function setupSolidus(
  options: SetupSolidusOptions,
): Promise<SetupSolidusResult> {
  const { sequelize, stripe, tablePrefix, schema } = options;

  // 1. Initialize models
  const models = initializeSolidusModels(sequelize, { tablePrefix, schema });

  // 2. Create repository bundle
  const repositories = createRepositoryBundleFromSolidusModels(models);

  // 3. Configure global facade
  Solidus.configure({
    createFacade: createSolidusFacade,
    stripe,
    models,
    // We pass the repositories explicitly to ensure they are used
    repositories: repositories.facade,
    ownerCustomers: repositories.core.customers,
    webhookRepositories: {
      invoices: repositories.invoices,
    },
  });

  const facade = Solidus.getFacade();

  // 4. Create Webhook Pipeline
  const queueAdapter =
    options.queueAdapter ??
    createDbOutboxQueueAdapter({
      outbox: repositories.webhook.outboxRepository,
    });

  const pipeline = createPersistFirstWebhookPipeline({
    idempotencyRepository: repositories.webhook.idempotencyRepository,
    eventRepository: repositories.webhook.eventRepository,
    queue: queueAdapter,
    processEvent: async (persistedEvent) => {
      // The persisted event payload is unknown, cast it to Stripe.Event
      const event = persistedEvent.payload as Stripe.Event;
      await facade.webhooks.process(event);
    },
  });

  // 5. Create Express Webhook Router (Handler + Middleware)
  // We use an array to combine middleware and handler, which Express supports for routers/handlers
  const webhookHandler = createStripeWebhookHandler({
    stripe,
    webhookSecrets: [options.webhookSecret],
    pipeline,
  });

  const rawBodyMiddleware = createStripeWebhookRawBodyMiddleware();

  // 6. Return everything needed
  return {
    models,
    repositories,
    facade,
    api: facade.api,
    webhooks: facade.webhooks,
    convenience: facade.convenience,
    pipeline,
    express: {
      webhookRouter: [rawBodyMiddleware, webhookHandler],
    },
  };
}
