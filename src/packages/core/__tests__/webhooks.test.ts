import { describe, expect, test } from "bun:test";
import type { IdempotencyRepository, QueueJob } from "../contracts.ts";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
  type DbOutboxQueueRecord,
  type DbOutboxRepository,
  type PersistedWebhookEvent,
  type WebhookEventRepository,
} from "../webhooks.ts";

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

describe("persist-first webhook pipeline", () => {
  test("deduplicates duplicate events by processor and event id", async () => {
    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox });
    const processedEventIds: string[] = [];

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      processEvent: async (event) => {
        processedEventIds.push(event.eventId);
      },
    });

    const first = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_1",
      eventType: "charge.succeeded",
      payload: {},
    });

    const second = await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_1",
      eventType: "charge.succeeded",
      payload: {},
    });

    expect(first.status).toBe("queued");
    expect(second.status).toBe("duplicate");

    await drainDbOutboxQueue({ outbox, pipeline });

    expect(processedEventIds).toEqual(["evt_1"]);
  });

  test("retries with exponential backoff on transient failures", async () => {
    let unixTime = 1_000;
    const now = () => new Date(unixTime);

    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });
    let callCount = 0;

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      retryPolicy: {
        maxAttempts: 5,
        baseDelayMs: 100,
      },
      processEvent: async () => {
        callCount += 1;

        if (callCount < 2) {
          throw new Error("transient failure");
        }
      },
    });

    await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_retry",
      eventType: "invoice.payment_failed",
      payload: {},
      receivedAt: now(),
    });

    await drainDbOutboxQueue({ outbox, pipeline, now });

    const persisted = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_retry",
    });

    expect(callCount).toBe(1);
    expect(persisted?.attemptCount).toBe(1);
    expect(persisted?.nextAttemptAt?.getTime()).toBe(1_100);

    unixTime = 1_100;
    await drainDbOutboxQueue({ outbox, pipeline, now });

    const retried = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_retry",
    });

    expect(callCount).toBe(2);
    expect(retried?.processedAt?.getTime()).toBe(1_100);
  });

  test("moves failing events to dead letter after max retries", async () => {
    let unixTime = 5_000;
    const now = () => new Date(unixTime);

    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 50,
      },
      processEvent: async () => {
        throw new Error("permanent failure");
      },
    });

    await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_dead",
      eventType: "customer.deleted",
      payload: {},
      receivedAt: now(),
    });

    await drainDbOutboxQueue({ outbox, pipeline, now });
    unixTime = 5_050;
    await drainDbOutboxQueue({ outbox, pipeline, now });

    const deadLettered = await eventRepository.findByEventId({
      processor: "stripe",
      eventId: "evt_dead",
    });

    expect(deadLettered?.deadLetteredAt?.getTime()).toBe(5_050);
    expect(deadLettered?.attemptCount).toBe(2);
  });
});
