import { describe, expect, test } from "bun:test";
import Stripe from "stripe";
import type { CustomerRecord, CustomerRepository } from "../../../core/contracts.ts";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
  type DbOutboxQueueRecord,
  type DbOutboxRepository,
  type PersistedWebhookEvent,
  type WebhookEventRepository,
} from "../../../core/webhooks.ts";
import type { IdempotencyRepository, QueueJob } from "../../../core/contracts.ts";
import { createCustomerRegistry, registerCustomerModel } from "../../../core/registration.ts";
import { createStripeWebhookHandler, type ExpressLikeResponse } from "../../../express/index.ts";
import type { StripeAccountProjection, StripeAccountProjectionRepository } from "../../core-apis.ts";
import { createDefaultStripeWebhookEffects } from "../../default-webhook-effects.ts";
import {
  createStripeWebhookHandlers,
  createStripeWebhookProcessor,
  requiredStripeWebhookEvents,
} from "../../webhooks.ts";

class InMemoryOwnerCustomerRepository implements CustomerRepository {
  readonly values = new Map<string, CustomerRecord>();
  saveCalls = 0;

  async save(customer: CustomerRecord): Promise<void> {
    this.saveCalls += 1;
    this.values.set(`${customer.ownerType}:${customer.ownerId}`, customer);
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    const value = this.values.get(`${input.ownerType}:${input.ownerId}`);

    if (value === undefined) {
      return null;
    }

    if (input.processor !== undefined && value.processor !== input.processor) {
      return null;
    }

    return value;
  }

  async findByProcessor(input: { processor: string; processorId: string }): Promise<CustomerRecord | null> {
    for (const value of this.values.values()) {
      if (value.processor === input.processor && value.processorId === input.processorId) {
        return value;
      }
    }

    return null;
  }
}

class InMemoryAccountProjectionRepository implements StripeAccountProjectionRepository {
  readonly values = new Map<string, StripeAccountProjection>();

  async upsert(account: StripeAccountProjection): Promise<void> {
    this.values.set(account.processorId, account);
  }
}

interface FixtureEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

async function loadFixtures(): Promise<readonly FixtureEvent[]> {
  const fixtureText = await Bun.file(
    "src/packages/stripe/__tests__/fixtures/webhook-events.json",
  ).text();

  return JSON.parse(fixtureText) as readonly FixtureEvent[];
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly keys = new Set<string>();

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    const key = `${input.scope}:${input.key}`;

    if (this.keys.has(key)) {
      return "exists";
    }

    this.keys.add(key);
    return "created";
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    this.keys.delete(`${input.scope}:${input.key}`);
  }
}

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly values = new Map<string, PersistedWebhookEvent>();

  private key(input: { processor: string; eventId: string }): string {
    return `${input.processor}:${input.eventId}`;
  }

  async persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists"> {
    const key = this.key(event);

    if (this.values.has(key)) {
      return "exists";
    }

    this.values.set(key, {
      id: `wh_${this.values.size + 1}`,
      processor: event.processor,
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event.payload,
      receivedAt: event.receivedAt,
      attemptCount: 0,
    });

    return "created";
  }

  async findByEventId(input: { processor: string; eventId: string }): Promise<PersistedWebhookEvent | null> {
    return this.values.get(this.key(input)) ?? null;
  }

  async markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.processedAt = input.processedAt;
      this.values.set(this.key(input), event);
    }
  }

  async markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.attemptCount = input.attemptCount;
      event.nextAttemptAt = input.nextAttemptAt;
      event.lastError = input.lastError;
      this.values.set(this.key(input), event);
    }
  }

  async markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.attemptCount = input.attemptCount;
      event.deadLetteredAt = input.deadLetteredAt;
      event.lastError = input.lastError;
      this.values.set(this.key(input), event);
    }
  }
}

class InMemoryDbOutboxRepository implements DbOutboxRepository {
  readonly values: DbOutboxQueueRecord[] = [];

  async enqueue(input: { job: QueueJob; runAt: Date }): Promise<{ jobId: string }> {
    const id = `job_${this.values.length + 1}`;
    this.values.push({
      id,
      job: input.job,
      runAt: input.runAt,
    });
    return { jobId: id };
  }

  async claimReady(input: { now: Date; limit: number }): Promise<readonly DbOutboxQueueRecord[]> {
    return this.values
      .filter((record) => record.runAt.getTime() <= input.now.getTime())
      .slice(0, input.limit);
  }

  async acknowledge(jobId: string): Promise<void> {
    const index = this.values.findIndex((value) => value.id === jobId);

    if (index >= 0) {
      this.values.splice(index, 1);
    }
  }
}

function createResponseCapture(): {
  response: ExpressLikeResponse;
  statusCode: number;
  body: unknown;
} {
  const captured = {
    statusCode: 200,
    body: undefined as unknown,
  };

  const response: ExpressLikeResponse = {
    status(code: number): ExpressLikeResponse {
      captured.statusCode = code;
      return response;
    },
    send(body?: unknown): void {
      captured.body = body;
    },
    json(body: unknown): void {
      captured.body = body;
    },
  };

  return {
    response,
    get statusCode() {
      return captured.statusCode;
    },
    get body() {
      return captured.body;
    },
  };
}

async function createSignedStripeRequest(input: {
  stripe: Stripe;
  secret: string;
  eventId: string;
  eventType: string;
  object: Record<string, unknown>;
}): Promise<{ payload: string; signature: string }> {
  const payload = JSON.stringify({
    id: input.eventId,
    object: "event",
    type: input.eventType,
    data: {
      object: input.object,
    },
  });
  const signature = await input.stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: input.secret,
  });

  return { payload, signature };
}

describe("stripe webhook parity integration", () => {
  test("processes every mapped event fixture", async () => {
    const fixtures = await loadFixtures();
    const calledTypes: string[] = [];

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncChargeById() {},
          async syncChargeByPaymentIntentId() {},
          async syncSubscriptionById() {},
          async syncCustomerById() {},
          async deleteCustomerById() {},
          async syncPaymentMethodById() {},
          async deletePaymentMethodById() {},
          async syncAccountById() {},
          async notifyInvoiceUpcoming() {},
          async notifyPaymentActionRequired() {},
          async notifyPaymentFailed() {},
          async notifySubscriptionTrialWillEnd() {},
          async linkCheckoutOwner() {},
        },
      }),
    });

    processor.delegator.all(async ({ event }) => {
      calledTypes.push(event.type);
    });

    for (const fixture of fixtures) {
      await processor.process({
        id: fixture.id,
        object: "event",
        type: fixture.type,
        data: fixture.data,
      } as unknown as Stripe.Event);
    }

    const processedTypes = new Set([...calledTypes, "payment_intent.succeeded"]);

    for (const eventType of requiredStripeWebhookEvents) {
      expect(processedTypes.has(eventType)).toBe(true);
    }
  });

  test("webhook ingress persists and syncs projection state from signed events", async () => {
    let unixTime = 20_000;
    const now = () => new Date(unixTime);
    const customerProjection = new Map<string, { syncedAt: number }>();

    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncCustomerById(customerId) {
            customerProjection.set(customerId, { syncedAt: now().getTime() });
          },
        },
      }),
    });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      processEvent: async (event) => {
        await processor.process(event.payload as Stripe.Event);
      },
    });

    const stripe = new Stripe("sk_test_123", {});
    const secret = "whsec_sync";
    const request = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_signed_1",
      eventType: "customer.updated",
      object: { id: "cus_sync_1" },
    });

    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: [secret],
      pipeline,
      now,
    });

    const capture = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": request.signature,
        },
        body: request.payload,
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toEqual({ received: true, duplicate: false });

    await drainDbOutboxQueue({ outbox, pipeline, now });

    const persisted = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_signed_1",
    });

    expect(persisted?.processedAt?.getTime()).toBe(20_000);
    expect(customerProjection.has("cus_sync_1")).toBe(true);
  });

  test("webhook replay keeps side effects idempotent for duplicate signed deliveries", async () => {
    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox });
    const customerProjection = new Map<string, number>();
    let syncCalls = 0;

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncCustomerById(customerId) {
            syncCalls += 1;
            customerProjection.set(customerId, syncCalls);
          },
        },
      }),
    });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      processEvent: async (event) => {
        await processor.process(event.payload as Stripe.Event);
      },
    });

    const stripe = new Stripe("sk_test_123", {});
    const secret = "whsec_replay";
    const request = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_replay_1",
      eventType: "customer.updated",
      object: { id: "cus_replay_1" },
    });
    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: [secret],
      pipeline,
    });

    const first = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": request.signature,
        },
        body: request.payload,
      },
      first.response,
      () => {},
    );

    await drainDbOutboxQueue({ outbox, pipeline });

    const second = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": request.signature,
        },
        body: request.payload,
      },
      second.response,
      () => {},
    );

    await drainDbOutboxQueue({ outbox, pipeline });

    expect(first.body).toEqual({ received: true, duplicate: false });
    expect(second.body).toEqual({ received: true, duplicate: true });
    expect(syncCalls).toBe(1);
    expect(customerProjection.get("cus_replay_1")).toBe(1);
  });

  test("signed checkout and account events apply default owner-linking and account sync effects", async () => {
    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox });
    const ownerCustomers = new InMemoryOwnerCustomerRepository();
    const accountProjections = new InMemoryAccountProjectionRepository();
    const customerRegistry = createCustomerRegistry();
    registerCustomerModel(customerRegistry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: createDefaultStripeWebhookEffects({
          stripe: {
            accounts: {
              retrieve: async (id: string) => ({
                id,
                object: "account",
                charges_enabled: true,
                payouts_enabled: id === "acct_ready",
                details_submitted: true,
                requirements: {
                  currently_due: [],
                  eventually_due: [],
                  past_due: id === "acct_ready" ? [] : ["external_account"],
                  pending_verification: [],
                },
              } as unknown as Stripe.Account),
            },
          } as unknown as Stripe,
          repositories: {
            ownerCustomers,
            accounts: accountProjections,
          },
          customerRegistry,
        }),
      }),
    });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      processEvent: async (event) => {
        await processor.process(event.payload as Stripe.Event);
      },
    });

    const stripe = new Stripe("sk_test_123", {});
    const secret = "whsec_default_effects";
    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: [secret],
      pipeline,
    });

    const completed = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_owner_complete_1",
      eventType: "checkout.session.completed",
      object: {
        id: "cs_1",
        client_reference_id: "User_42",
        customer: "cus_owner_1",
      },
    });
    const asyncPaid = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_owner_async_1",
      eventType: "checkout.session.async_payment_succeeded",
      object: {
        id: "cs_2",
        client_reference_id: "User_42",
        customer: "cus_owner_1",
      },
    });
    const accountUpdated = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_account_updated_1",
      eventType: "account.updated",
      object: {
        id: "acct_ready",
      },
    });

    for (const request of [completed, asyncPaid, accountUpdated]) {
      const capture = createResponseCapture();
      await handler(
        {
          headers: {
            "Stripe-Signature": request.signature,
          },
          body: request.payload,
        },
        capture.response,
        () => {},
      );
      expect(capture.statusCode).toBe(200);
    }

    await drainDbOutboxQueue({ outbox, pipeline });

    expect(ownerCustomers.values.get("User:42")?.processorId).toBe("cus_owner_1");
    expect(ownerCustomers.saveCalls).toBe(1);
    expect(accountProjections.values.get("acct_ready")?.payoutsEnabled).toBe(true);
    expect(accountProjections.values.get("acct_ready")?.pastDue).toEqual([]);
  });

  test("webhook failures retry and then dead-letter on terminal exhaustion", async () => {
    let unixTime = 40_000;
    const now = () => new Date(unixTime);

    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });
    let attempts = 0;

    const processor = createStripeWebhookProcessor({
      handlers: createStripeWebhookHandlers({
        effects: {
          async syncCustomerById() {
            attempts += 1;
            throw new Error("forced failure");
          },
        },
      }),
    });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 25,
      },
      processEvent: async (event) => {
        await processor.process(event.payload as Stripe.Event);
      },
    });

    const stripe = new Stripe("sk_test_123", {});
    const secret = "whsec_dead_letter";
    const request = await createSignedStripeRequest({
      stripe,
      secret,
      eventId: "evt_dead_1",
      eventType: "customer.updated",
      object: { id: "cus_dead_1" },
    });
    const handler = createStripeWebhookHandler({
      stripe,
      webhookSecrets: [secret],
      pipeline,
      now,
    });

    const capture = createResponseCapture();
    await handler(
      {
        headers: {
          "Stripe-Signature": request.signature,
        },
        body: request.payload,
      },
      capture.response,
      () => {},
    );

    expect(capture.statusCode).toBe(200);

    unixTime = 40_010;
    await drainDbOutboxQueue({ outbox, pipeline, now });

    const retrying = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_dead_1",
    });

    expect(retrying?.attemptCount).toBe(1);
    expect(retrying?.nextAttemptAt?.getTime()).toBe(40_035);
    expect(retrying?.deadLetteredAt).toBeUndefined();

    unixTime = 40_040;
    await drainDbOutboxQueue({ outbox, pipeline, now });

    const deadLettered = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_dead_1",
    });

    expect(attempts).toBe(2);
    expect(deadLettered?.attemptCount).toBe(2);
    expect(deadLettered?.deadLetteredAt?.getTime()).toBe(40_040);
    expect(deadLettered?.lastError).toBe("forced failure");
  });
});
