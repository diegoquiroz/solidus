import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import type {
  ChargeRecord,
  CustomerRecord,
  PaymentMethodRecord,
  SubscriptionRecord,
} from "../../core/contracts.ts";
import type { StripeAccountProjection } from "../../stripe/core-apis.ts";
import type { PersistedWebhookEvent } from "../../core/webhooks.ts";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
} from "../../core/webhooks.ts";
import {
  createSequelizeDelegatesFromModels,
  createSequelizeRepositoryBundle,
  createSequelizeRepositoryBundleFromModels,
  type InvoiceProjectionRecord,
  SequelizeChargeRepository,
  SequelizeCustomerRepository,
  SequelizeDbOutboxRepository,
  SequelizeIdempotencyRepository,
  SequelizeInvoiceProjectionRepository,
  SequelizePaymentMethodRepository,
  SequelizeStripeAccountProjectionRepository,
  SequelizeSubscriptionRepository,
  SequelizeWebhookEventRepository,
} from "../repositories.ts";

describe("sequelize customer repository", () => {
  test("customer repository supports upsert and owner lookup filtering", async () => {
    const rows = new Map<string, CustomerRecord>();
    const repository = new SequelizeCustomerRepository({
      async upsert(customer) {
        rows.set(`${customer.processor}:${customer.processorId}`, customer);
      },
      async findByOwner(input) {
        for (const value of rows.values()) {
          if (
            value.ownerType === input.ownerType
            && value.ownerId === input.ownerId
            && (input.processor === undefined || input.processor === value.processor)
          ) {
            return value;
          }
        }

        return null;
      },
    });

    await repository.save({
      id: "cus_local_1",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_123",
      email: "dev@example.com",
    });

    await repository.save({
      id: "cus_local_1",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_123",
      email: "updated@example.com",
    });

    await repository.save({
      id: "cus_local_2",
      ownerType: "User",
      ownerId: "42",
      processor: "adyen",
      processorId: "cus_alt_123",
      email: "alt@example.com",
    });

    const customer = await repository.findByOwner({
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
    });

    const customerWithoutProcessor = await repository.findByOwner({
      ownerType: "User",
      ownerId: "42",
    });

    const missing = await repository.findByOwner({
      ownerType: "Organization",
      ownerId: "42",
      processor: "stripe",
    });

    expect(customer?.processorId).toBe("cus_123");
    expect(customer?.email).toBe("updated@example.com");
    expect(customerWithoutProcessor).not.toBeNull();
    expect(missing).toBeNull();
  });
});

describe("sequelize projection repositories", () => {
  test("payment method repository clears defaults and deletes records", async () => {
    const rows = new Map<string, PaymentMethodRecord>();
    const repository = new SequelizePaymentMethodRepository({
      async upsert(paymentMethod) {
        rows.set(paymentMethod.processorId, paymentMethod);
      },
      async clearDefaultForCustomer(customerProcessorId) {
        for (const [processorId, value] of rows.entries()) {
          if (value.customerProcessorId === customerProcessorId && value.isDefault) {
            rows.set(processorId, { ...value, isDefault: false });
          }
        }
      },
      async deleteByProcessorId(processorId) {
        rows.delete(processorId);
      },
      async listByCustomer(customerProcessorId) {
        return Array.from(rows.values()).filter((row) => row.customerProcessorId === customerProcessorId);
      },
    });

    await repository.upsert({
      id: "pm_local_1",
      processor: "stripe",
      processorId: "pm_1",
      customerProcessorId: "cus_1",
      methodType: "card",
      isDefault: true,
      rawPayload: {},
    });

    await repository.clearDefaultForCustomer("cus_1");
    await repository.deleteByProcessorId("pm_missing");

    const methods = await repository.listByCustomer("cus_1");
    expect(methods[0]?.isDefault).toBe(false);

    await repository.deleteByProcessorId("pm_1");
    expect((await repository.listByCustomer("cus_1")).length).toBe(0);
  });

  test("charge repository supports upsert updates and lookup misses", async () => {
    const rows = new Map<string, ChargeRecord>();
    const repository = new SequelizeChargeRepository({
      async upsert(charge) {
        rows.set(charge.processorId, charge);
      },
      async findByProcessorId(processorId) {
        return rows.get(processorId) ?? null;
      },
    });

    await repository.upsert({
      id: "ch_local_1",
      processor: "stripe",
      processorId: "ch_1",
      customerProcessorId: "cus_1",
      amount: 1000,
      currency: "usd",
      status: "succeeded",
      rawPayload: {},
    });

    await repository.upsert({
      id: "ch_local_1",
      processor: "stripe",
      processorId: "ch_1",
      customerProcessorId: "cus_1",
      amount: 1000,
      currency: "usd",
      status: "failed",
      rawPayload: { reason: "declined" },
    });

    expect((await repository.findByProcessorId("ch_1"))?.status).toBe("failed");
    expect(await repository.findByProcessorId("ch_missing")).toBeNull();
  });

  test("subscription repository supports upsert lookup and list behavior", async () => {
    const rows = new Map<string, SubscriptionRecord>();
    const repository = new SequelizeSubscriptionRepository({
      async upsert(subscription) {
        rows.set(subscription.processorId, subscription);
      },
      async findByProcessorId(processorId) {
        return rows.get(processorId) ?? null;
      },
      async listByCustomer(customerProcessorId) {
        return Array.from(rows.values()).filter((row) => row.customerProcessorId === customerProcessorId);
      },
    });

    await repository.upsert({
      id: "sub_local_1",
      processor: "stripe",
      processorId: "sub_1",
      customerProcessorId: "cus_1",
      status: "active",
      cancelAtPeriodEnd: false,
      rawPayload: {},
    });

    await repository.upsert({
      id: "sub_local_1",
      processor: "stripe",
      processorId: "sub_1",
      customerProcessorId: "cus_1",
      status: "past_due",
      cancelAtPeriodEnd: true,
      rawPayload: {},
    });

    await repository.upsert({
      id: "sub_local_2",
      processor: "stripe",
      processorId: "sub_2",
      customerProcessorId: "cus_2",
      status: "active",
      cancelAtPeriodEnd: false,
      rawPayload: {},
    });

    expect((await repository.findByProcessorId("sub_1"))?.status).toBe("past_due");
    expect((await repository.listByCustomer("cus_1")).length).toBe(1);
    expect(await repository.findByProcessorId("sub_missing")).toBeNull();
  });

  test("invoice repository supports upsert lookup and customer query", async () => {
    const rows = new Map<string, InvoiceProjectionRecord>();
    const repository = new SequelizeInvoiceProjectionRepository({
      async upsert(invoice) {
        rows.set(invoice.processorId, invoice);
      },
      async findByProcessorId(processorId) {
        return rows.get(processorId) ?? null;
      },
      async listByCustomer(customerProcessorId) {
        return Array.from(rows.values()).filter((row) => row.customerProcessorId === customerProcessorId);
      },
    });

    await repository.upsert({
      id: "in_local_1",
      processor: "stripe",
      processorId: "in_1",
      customerProcessorId: "cus_1",
      status: "open",
      amountDue: 3000,
      currency: "usd",
      rawPayload: {},
    });

    await repository.upsert({
      id: "in_local_1",
      processor: "stripe",
      processorId: "in_1",
      customerProcessorId: "cus_1",
      status: "paid",
      amountDue: 3000,
      amountPaid: 3000,
      currency: "usd",
      rawPayload: {},
    });

    await repository.upsert({
      id: "in_local_2",
      processor: "stripe",
      processorId: "in_2",
      customerProcessorId: "cus_2",
      status: "open",
      amountDue: 1200,
      currency: "usd",
      rawPayload: {},
    });

    expect((await repository.findByProcessorId("in_1"))?.status).toBe("paid");
    expect((await repository.listByCustomer("cus_1")).length).toBe(1);
    expect(await repository.findByProcessorId("in_missing")).toBeNull();
  });

  test("stripe account projection repository supports upsert and lookup", async () => {
    const rows = new Map<string, StripeAccountProjection>();
    const repository = new SequelizeStripeAccountProjectionRepository({
      async upsert(account) {
        rows.set(account.processorId, account);
      },
      async findByProcessorId(processorId) {
        return rows.get(processorId) ?? null;
      },
    });

    await repository.upsert({
      processor: "stripe",
      processorId: "acct_1",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      currentlyDue: [],
      eventuallyDue: ["external_account"],
      pastDue: [],
      pendingVerification: [],
      rawPayload: {
        id: "acct_1",
        object: "account",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: ["external_account"],
          past_due: [],
          pending_verification: [],
        },
      } as unknown as Stripe.Account,
    } as StripeAccountProjection);

    expect((await repository.findByProcessorId("acct_1"))?.payoutsEnabled).toBe(false);
    expect(await repository.findByProcessorId("acct_missing")).toBeNull();
  });
});

describe("sequelize webhook and idempotency repositories", () => {
  test("idempotency repository reports conflicts until released", async () => {
    const keys = new Set<string>();
    const repository = new SequelizeIdempotencyRepository({
      async reserve(input) {
        const key = `${input.scope}:${input.key}`;

        if (keys.has(key)) {
          return "exists";
        }

        keys.add(key);
        return "created";
      },
      async release(input) {
        keys.delete(`${input.scope}:${input.key}`);
      },
    });

    expect(await repository.reserve({ scope: "webhook", key: "evt_1" })).toBe("created");
    expect(await repository.reserve({ scope: "webhook", key: "evt_1" })).toBe("exists");
    expect(await repository.reserve({ scope: "webhook", key: "evt_1" })).toBe("exists");

    await repository.release({ scope: "webhook", key: "evt_1" });
    expect(await repository.reserve({ scope: "webhook", key: "evt_1" })).toBe("created");
  });

  test("webhook repository persists once and tracks retry and dead-letter lifecycle", async () => {
    const rows = new Map<string, PersistedWebhookEvent>();
    const keyFor = (input: { processor: string; eventId: string }) => `${input.processor}:${input.eventId}`;
    const repository = new SequelizeWebhookEventRepository({
      async persist(event) {
        const key = keyFor(event);

        if (rows.has(key)) {
          return "exists";
        }

        rows.set(key, {
          id: `wh_${rows.size + 1}`,
          processor: event.processor,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: event.payload,
          attemptCount: 0,
          receivedAt: event.receivedAt,
        });

        return "created";
      },
      async findByEventId(input) {
        return rows.get(keyFor(input)) ?? null;
      },
      async markProcessed(input) {
        const value = rows.get(keyFor(input));

        if (value !== undefined) {
          rows.set(keyFor(input), { ...value, processedAt: input.processedAt });
        }
      },
      async markRetrying(input) {
        const value = rows.get(keyFor(input));

        if (value !== undefined) {
          rows.set(keyFor(input), {
            ...value,
            attemptCount: input.attemptCount,
            nextAttemptAt: input.nextAttemptAt,
            lastError: input.lastError,
          });
        }
      },
      async markDeadLetter(input) {
        const value = rows.get(keyFor(input));

        if (value !== undefined) {
          rows.set(keyFor(input), {
            ...value,
            attemptCount: input.attemptCount,
            deadLetteredAt: input.deadLetteredAt,
            lastError: input.lastError,
          });
        }
      },
    });

    const created = await repository.persist({
      processor: "stripe",
      eventId: "evt_1",
      eventType: "charge.succeeded",
      payload: {},
      receivedAt: new Date(),
    });

    const duplicate = await repository.persist({
      processor: "stripe",
      eventId: "evt_1",
      eventType: "charge.succeeded",
      payload: { duplicate: true },
      receivedAt: new Date(100),
    });

    await repository.markRetrying({
      processor: "stripe",
      eventId: "evt_1",
      attemptCount: 1,
      nextAttemptAt: new Date(1000),
      lastError: "retry",
    });
    await repository.markRetrying({
      processor: "stripe",
      eventId: "evt_1",
      attemptCount: 2,
      nextAttemptAt: new Date(2000),
      lastError: "retry-again",
    });
    await repository.markDeadLetter({
      processor: "stripe",
      eventId: "evt_1",
      attemptCount: 3,
      deadLetteredAt: new Date(3000),
      lastError: "exhausted",
    });

    const stored = await repository.findByEventId({ processor: "stripe", eventId: "evt_1" });
    expect(created).toBe("created");
    expect(duplicate).toBe("exists");
    expect(stored?.attemptCount).toBe(3);
    expect(stored?.nextAttemptAt?.getTime()).toBe(2000);
    expect(stored?.deadLetteredAt?.getTime()).toBe(3000);
    expect(stored?.lastError).toBe("exhausted");
  });

  test("db outbox repository enqueues, claims, and acknowledges jobs", async () => {
    const rows: Array<{ id: string; runAt: Date; job: { name: string; payload: unknown } }> = [];
    const repository = new SequelizeDbOutboxRepository({
      async enqueue(input) {
        const jobId = `job_${rows.length + 1}`;
        rows.push({ id: jobId, runAt: input.runAt, job: input.job });
        return { jobId };
      },
      async claimReady(input) {
        return rows.filter((row) => row.runAt.getTime() <= input.now.getTime()).slice(0, input.limit);
      },
      async acknowledge(jobId) {
        const index = rows.findIndex((row) => row.id === jobId);

        if (index >= 0) {
          rows.splice(index, 1);
        }
      },
    });

    await repository.enqueue({
      job: { name: "webhook.process", payload: { eventId: "evt_1" } },
      runAt: new Date(100),
    });

    const ready = await repository.claimReady({ now: new Date(100), limit: 10 });
    expect(ready.length).toBe(1);

    await repository.acknowledge(ready[0]!.id);
    expect((await repository.claimReady({ now: new Date(100), limit: 10 })).length).toBe(0);
  });
});

describe("sequelize webhook adapter integration", () => {
  test("pipeline integration is deterministic for duplicate, retry, and dead-letter transitions", async () => {
    let unixTime = 10_000;
    const now = () => new Date(unixTime);
    const idempotencyKeys = new Set<string>();
    const events = new Map<string, PersistedWebhookEvent>();
    const outboxRows: Array<{ id: string; runAt: Date; job: { name: string; payload: unknown } }> = [];
    const eventKeyFor = (input: { processor: string; eventId: string }) => `${input.processor}:${input.eventId}`;

    const idempotencyRepository = new SequelizeIdempotencyRepository({
      async reserve(input) {
        const key = `${input.scope}:${input.key}`;

        if (idempotencyKeys.has(key)) {
          return "exists";
        }

        idempotencyKeys.add(key);
        return "created";
      },
      async release(input) {
        idempotencyKeys.delete(`${input.scope}:${input.key}`);
      },
    });

    const eventRepository = new SequelizeWebhookEventRepository({
      async persist(event) {
        const key = eventKeyFor(event);

        if (events.has(key)) {
          return "exists";
        }

        events.set(key, {
          id: `wh_${events.size + 1}`,
          processor: event.processor,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: event.payload,
          receivedAt: event.receivedAt,
          attemptCount: 0,
        });

        return "created";
      },
      async findByEventId(input) {
        return events.get(eventKeyFor(input)) ?? null;
      },
      async markProcessed(input) {
        const value = events.get(eventKeyFor(input));

        if (value !== undefined) {
          events.set(eventKeyFor(input), { ...value, processedAt: input.processedAt });
        }
      },
      async markRetrying(input) {
        const value = events.get(eventKeyFor(input));

        if (value !== undefined) {
          events.set(eventKeyFor(input), {
            ...value,
            attemptCount: input.attemptCount,
            nextAttemptAt: input.nextAttemptAt,
            lastError: input.lastError,
          });
        }
      },
      async markDeadLetter(input) {
        const value = events.get(eventKeyFor(input));

        if (value !== undefined) {
          events.set(eventKeyFor(input), {
            ...value,
            attemptCount: input.attemptCount,
            deadLetteredAt: input.deadLetteredAt,
            lastError: input.lastError,
          });
        }
      },
    });

    const outboxRepository = new SequelizeDbOutboxRepository({
      async enqueue(input) {
        const jobId = `job_${outboxRows.length + 1}`;
        outboxRows.push({ id: jobId, runAt: input.runAt, job: input.job });
        return { jobId };
      },
      async claimReady(input) {
        return outboxRows.filter((row) => row.runAt.getTime() <= input.now.getTime()).slice(0, input.limit);
      },
      async acknowledge(jobId) {
        const index = outboxRows.findIndex((row) => row.id === jobId);

        if (index >= 0) {
          outboxRows.splice(index, 1);
        }
      },
    });

    const queue = createDbOutboxQueueAdapter({
      outbox: outboxRepository,
      now,
    });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 100,
      },
      processEvent: async () => {
        throw new Error("always failing");
      },
    });

    const firstIngest = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_contract_1",
      eventType: "invoice.payment_failed",
      payload: { fixture: true },
      receivedAt: now(),
    });

    const duplicateIngest = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_contract_1",
      eventType: "invoice.payment_failed",
      payload: { fixture: true },
      receivedAt: now(),
    });

    unixTime = 10_010;
    await drainDbOutboxQueue({ outbox: outboxRepository, pipeline, now });

    const afterFirstAttempt = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_contract_1",
    });

    unixTime = 10_120;
    await drainDbOutboxQueue({ outbox: outboxRepository, pipeline, now });

    const afterDeadLetter = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_contract_1",
    });

    expect(firstIngest.status).toBe("queued");
    expect(duplicateIngest.status).toBe("duplicate");
    expect(afterFirstAttempt?.attemptCount).toBe(1);
    expect(afterFirstAttempt?.nextAttemptAt?.getTime()).toBe(10_110);
    expect(afterDeadLetter?.attemptCount).toBe(2);
    expect(afterDeadLetter?.deadLetteredAt?.getTime()).toBe(10_120);
  });
});

class InMemorySequelizeModel {
  private readonly rows: Array<Record<string, unknown>> = [];
  private sequence = 0;

  constructor(
    private readonly uniqueConstraints: readonly (readonly string[])[] = [],
  ) {}

  async upsert(values: Record<string, unknown>): Promise<void> {
    const index = this.findUniqueMatch(values);

    if (index >= 0) {
      this.rows[index] = {
        ...this.rows[index],
        ...values,
      };
      return;
    }

    this.rows.push({ ...values });
  }

  async create(values: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.findUniqueMatch(values) >= 0) {
      const error = new Error("unique constraint") as Error & { name: string; code: string };
      error.name = "SequelizeUniqueConstraintError";
      error.code = "23505";
      throw error;
    }

    const row = {
      id: typeof values.id === "string" ? values.id : `row_${++this.sequence}`,
      ...values,
    };

    this.rows.push(row);
    return { ...row };
  }

  async findOne(input: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const match = this.rows.find((row) => this.matchesWhere(row, input.where));
    return match === undefined ? null : { ...match };
  }

  async findAll(input: { where: Record<string, unknown> }): Promise<readonly Record<string, unknown>[]> {
    return this.rows.filter((row) => this.matchesWhere(row, input.where)).map((row) => ({ ...row }));
  }

  async update(values: Record<string, unknown>, input: { where: Record<string, unknown> }): Promise<void> {
    for (let index = 0; index < this.rows.length; index += 1) {
      if (this.matchesWhere(this.rows[index]!, input.where)) {
        this.rows[index] = {
          ...this.rows[index],
          ...values,
        };
      }
    }
  }

  async destroy(input: { where: Record<string, unknown> }): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.matchesWhere(this.rows[index]!, input.where)) {
        this.rows.splice(index, 1);
      }
    }
  }

  private findUniqueMatch(values: Record<string, unknown>): number {
    for (const fields of this.uniqueConstraints) {
      const index = this.rows.findIndex((row) => fields.every((field) => row[field] === values[field]));

      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  private matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    for (const [field, value] of Object.entries(where)) {
      if (row[field] !== value) {
        return false;
      }
    }

    return true;
  }
}

describe("sequelize model default path", () => {
  test("bundle from models provides end-to-end default repository behavior", async () => {
    const bundle = createSequelizeRepositoryBundleFromModels({
      customers: new InMemorySequelizeModel([["processor", "processorId"]]),
      idempotency: new InMemorySequelizeModel([["scope", "key"]]),
      stripeCustomers: new InMemorySequelizeModel([["processorId"]]),
      stripeAccounts: new InMemorySequelizeModel([["processorId"]]),
      paymentMethods: new InMemorySequelizeModel([["processorId"]]),
      charges: new InMemorySequelizeModel([["processorId"]]),
      subscriptions: new InMemorySequelizeModel([["processorId"]]),
      invoices: new InMemorySequelizeModel([["processorId"]]),
      webhookEvents: new InMemorySequelizeModel([["processor", "eventId"]]),
      outbox: new InMemorySequelizeModel(),
    });

    await bundle.core.customers.save({
      id: "cus_local_1",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_123",
      email: "user@example.com",
    });
    expect(
      (await bundle.core.customers.findByOwner({ ownerType: "User", ownerId: "42", processor: "stripe" }))
        ?.processorId,
    ).toBe("cus_123");

    expect(await bundle.core.idempotency.reserve({ scope: "webhook", key: "evt_1" })).toBe("created");
    expect(await bundle.core.idempotency.reserve({ scope: "webhook", key: "evt_1" })).toBe("exists");

    await bundle.facade.paymentMethods?.upsert({
      id: "pm_local_1",
      processor: "stripe",
      processorId: "pm_1",
      customerProcessorId: "cus_123",
      methodType: "card",
      isDefault: true,
      rawPayload: {},
    });
    await bundle.facade.paymentMethods?.clearDefaultForCustomer("cus_123");

    const methods = await bundle.facade.paymentMethods?.listByCustomer("cus_123");
    expect(methods?.[0]?.isDefault).toBe(false);

    const queue = createDbOutboxQueueAdapter({
      outbox: bundle.webhook.outboxRepository,
      now: () => new Date(100),
    });
    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository: bundle.webhook.idempotencyRepository,
      eventRepository: bundle.webhook.eventRepository,
      queue,
      processEvent: async () => {
        return;
      },
    });

    const first = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_default_1",
      eventType: "customer.updated",
      payload: {},
      receivedAt: new Date(100),
    });
    const replay = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_default_1",
      eventType: "customer.updated",
      payload: {},
      receivedAt: new Date(100),
    });

    await drainDbOutboxQueue({
      outbox: bundle.webhook.outboxRepository,
      pipeline,
      now: () => new Date(100),
    });

    const persisted = await bundle.webhook.eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_default_1",
    });

    expect(first.status).toBe("queued");
    expect(replay.status).toBe("duplicate");
    expect(persisted?.processedAt).toBeInstanceOf(Date);
  });

  test("delegates from models fall back to in-memory idempotency when no model is provided", async () => {
    const delegates = createSequelizeDelegatesFromModels({
      customers: new InMemorySequelizeModel([["processor", "processorId"]]),
      stripeCustomers: new InMemorySequelizeModel([["processorId"]]),
      stripeAccounts: new InMemorySequelizeModel([["processorId"]]),
      paymentMethods: new InMemorySequelizeModel([["processorId"]]),
      charges: new InMemorySequelizeModel([["processorId"]]),
      subscriptions: new InMemorySequelizeModel([["processorId"]]),
      invoices: new InMemorySequelizeModel([["processorId"]]),
      webhookEvents: new InMemorySequelizeModel([["processor", "eventId"]]),
      outbox: new InMemorySequelizeModel(),
    });

    expect(await delegates.idempotency.reserve({ scope: "checkout", key: "owner:42" })).toBe("created");
    expect(await delegates.idempotency.reserve({ scope: "checkout", key: "owner:42" })).toBe("exists");
    await delegates.idempotency.release({ scope: "checkout", key: "owner:42" });
    expect(await delegates.idempotency.reserve({ scope: "checkout", key: "owner:42" })).toBe("created");
  });
});

describe("sequelize repository bundle", () => {
  test("repository bundle exposes facade and webhook wiring shape", async () => {
    const customers = new Map<string, CustomerRecord>();
    const bundle = createSequelizeRepositoryBundle({
      customers: {
        async upsert(customer) {
          customers.set(customer.processorId, customer);
        },
        async findByOwner(input) {
          for (const value of customers.values()) {
            if (value.ownerType === input.ownerType && value.ownerId === input.ownerId) {
              return value;
            }
          }

          return null;
        },
      },
      idempotency: {
        async reserve() {
          return "created";
        },
        async release() {
          return;
        },
      },
      stripeCustomers: {
        async upsert() {
          return;
        },
      },
      stripeAccounts: {
        async upsert() {
          return;
        },
      },
      paymentMethods: {
        async upsert() {
          return;
        },
        async clearDefaultForCustomer() {
          return;
        },
        async deleteByProcessorId() {
          return;
        },
        async listByCustomer() {
          return [];
        },
      },
      charges: {
        async upsert() {
          return;
        },
        async findByProcessorId() {
          return null;
        },
      },
      subscriptions: {
        async upsert() {
          return;
        },
        async findByProcessorId() {
          return null;
        },
        async listByCustomer() {
          return [];
        },
      },
      invoices: {
        async upsert() {
          return;
        },
        async findByProcessorId() {
          return null;
        },
        async listByCustomer() {
          return [];
        },
      },
      webhookEvents: {
        async persist() {
          return "created";
        },
        async findByEventId() {
          return null;
        },
        async markProcessed() {
          return;
        },
        async markRetrying() {
          return;
        },
        async markDeadLetter() {
          return;
        },
      },
      outbox: {
        async enqueue() {
          return { jobId: "job_1" };
        },
        async claimReady() {
          return [];
        },
        async acknowledge() {
          return;
        },
      },
    });

    await bundle.core.customers.save({
      id: "cus_local_1",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_123",
    });

    const found = await bundle.core.customers.findByOwner({ ownerType: "User", ownerId: "42" });

    expect(bundle.facade.paymentMethods).toBeDefined();
    expect(bundle.facade.accounts).toBeDefined();
    expect(bundle.webhook.eventRepository).toBeDefined();
    expect(found?.processorId).toBe("cus_123");
  });
});
