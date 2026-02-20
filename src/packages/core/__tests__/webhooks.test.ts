import { describe, expect, test } from "bun:test";
import type { IdempotencyRepository, QueueJob } from "../contracts.ts";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  drainDbOutboxQueue,
  type DbOutboxQueueRecord,
  type DbOutboxRepository,
  type PersistedWebhookEvent,
  getWebhookHealthDiagnostics,
  type WebhookLogEntry,
  type WebhookMetricSample,
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

  test("emits structured logs and metrics with transition fields", async () => {
    let unixTime = 2_000;
    const now = () => new Date(unixTime);
    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });
    const logs: WebhookLogEntry[] = [];
    const metrics: WebhookMetricSample[] = [];

    const pipeline = createPersistFirstWebhookPipeline({
      idempotencyRepository,
      eventRepository,
      queue,
      now,
      processEvent: async () => {
        unixTime = 2_125;
      },
      observability: {
        log(entry) {
          logs.push(entry);
        },
        metric(sample) {
          metrics.push(sample);
        },
      },
    });

    await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_obs",
      eventType: "charge.succeeded",
      payload: {},
      receivedAt: new Date(2_000),
    });

    await drainDbOutboxQueue({ outbox, pipeline, now });

    expect(logs.some((entry) => entry.event === "webhook.ingest.queued" && entry.status === "queued")).toBeTrue();
    expect(
      logs.some((entry) => entry.event === "webhook.process.processed" && entry.status === "processed" && entry.lagMs === 125),
    ).toBeTrue();

    expect(
      metrics.some((sample) => sample.name === "webhook.process.transition.count" && sample.tags?.status === "processed"),
    ).toBeTrue();
    expect(
      metrics.some(
        (sample) =>
          sample.name === "webhook.lag.ms" && sample.value === 125 && sample.unit === "ms" && sample.tags?.status === "processed",
      ),
    ).toBeTrue();
  });

  test("emits retry and dead-letter lag metrics", async () => {
    let unixTime = 10_000;
    const now = () => new Date(unixTime);
    const idempotencyRepository = new InMemoryIdempotencyRepository();
    const eventRepository = new InMemoryWebhookEventRepository();
    const outbox = new InMemoryDbOutboxRepository();
    const queue = createDbOutboxQueueAdapter({ outbox, now });
    const metrics: WebhookMetricSample[] = [];

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
        throw new Error("failing");
      },
      observability: {
        metric(sample) {
          metrics.push(sample);
        },
      },
    });

    await pipeline.ingest({
      processor: "stripe",
      eventId: "evt_obs_fail",
      eventType: "invoice.payment_failed",
      payload: {},
      receivedAt: new Date(10_000),
    });

    unixTime = 10_020;
    await drainDbOutboxQueue({ outbox, pipeline, now });
    unixTime = 10_150;
    await drainDbOutboxQueue({ outbox, pipeline, now });

    expect(
      metrics.some(
        (sample) =>
          sample.name === "webhook.lag.ms" && sample.tags?.status === "retrying" && sample.value === 20 && sample.unit === "ms",
      ),
    ).toBeTrue();
    expect(
      metrics.some(
        (sample) =>
          sample.name === "webhook.lag.ms"
          && sample.tags?.status === "dead_letter"
          && sample.value === 150
          && sample.unit === "ms",
      ),
    ).toBeTrue();
  });

  test("computes health diagnostics counts and warnings", async () => {
    const diagnostics = await getWebhookHealthDiagnostics({
      now: () => new Date(10_000),
      lagWarningThresholdMs: 2_000,
      deadLetterWarningThreshold: 1,
      listEvents: async () => [
        {
          id: "1",
          processor: "stripe",
          eventId: "evt_pending",
          eventType: "charge.succeeded",
          payload: {},
          attemptCount: 0,
          receivedAt: new Date(9_000),
        },
        {
          id: "2",
          processor: "stripe",
          eventId: "evt_retry",
          eventType: "invoice.payment_failed",
          payload: {},
          attemptCount: 2,
          receivedAt: new Date(7_000),
          nextAttemptAt: new Date(10_500),
        },
        {
          id: "3",
          processor: "stripe",
          eventId: "evt_dead",
          eventType: "customer.deleted",
          payload: {},
          attemptCount: 5,
          receivedAt: new Date(6_000),
          deadLetteredAt: new Date(9_500),
          lastError: "boom",
        },
        {
          id: "4",
          processor: "stripe",
          eventId: "evt_done",
          eventType: "charge.succeeded",
          payload: {},
          attemptCount: 1,
          receivedAt: new Date(5_000),
          processedAt: new Date(5_010),
        },
      ],
    });

    expect(diagnostics.pendingCount).toBe(1);
    expect(diagnostics.retryingCount).toBe(1);
    expect(diagnostics.deadLetterCount).toBe(1);
    expect(diagnostics.oldestLagMs).toBe(3_000);
    expect(diagnostics.warnings).toEqual(["LAG_THRESHOLD_EXCEEDED", "DEAD_LETTER_THRESHOLD_EXCEEDED"]);
  });
});
