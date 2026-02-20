import type Stripe from "stripe";
import {
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  createSolidusFacade,
  drainDbOutboxQueue,
  type DbOutboxRepository,
  type IdempotencyRepository,
  type PersistedWebhookEvent,
  type QueueJob,
  type WebhookEventRepository,
} from "../../index.ts";

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly keys = new Set<string>();

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    const scoped = `${input.scope}:${input.key}`;

    if (this.keys.has(scoped)) {
      return "exists";
    }

    this.keys.add(scoped);
    return "created";
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    this.keys.delete(`${input.scope}:${input.key}`);
  }
}

class InMemoryWebhookRepository implements WebhookEventRepository {
  private readonly events = new Map<string, PersistedWebhookEvent>();

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

    if (this.events.has(key)) {
      return "exists";
    }

    this.events.set(key, {
      id: `wh_${this.events.size + 1}`,
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
    return this.events.get(this.key(input)) ?? null;
  }

  async markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.processedAt = input.processedAt;
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
    }
  }
}

class InMemoryOutbox implements DbOutboxRepository {
  private readonly jobs: Array<{ id: string; job: QueueJob; runAt: Date }> = [];

  async enqueue(input: { job: QueueJob; runAt: Date }): Promise<{ jobId: string }> {
    const id = `job_${this.jobs.length + 1}`;
    this.jobs.push({ id, ...input });
    return { jobId: id };
  }

  async claimReady(input: { now: Date; limit: number }): Promise<readonly { id: string; job: QueueJob; runAt: Date }[]> {
    return this.jobs.filter((entry) => entry.runAt.getTime() <= input.now.getTime()).slice(0, input.limit);
  }

  async acknowledge(jobId: string): Promise<void> {
    const index = this.jobs.findIndex((entry) => entry.id === jobId);

    if (index >= 0) {
      this.jobs.splice(index, 1);
    }
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const stripe = {} as Stripe;
const facade = createSolidusFacade({ stripe });

const idempotencyRepository = new InMemoryIdempotencyRepository();
const eventRepository = new InMemoryWebhookRepository();
const outbox = new InMemoryOutbox();
const queue = createDbOutboxQueueAdapter({ outbox });

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository,
  eventRepository,
  queue,
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});

const enqueueResult = await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_example_1",
  eventType: "charge.succeeded",
  payload: {
    id: "evt_example_1",
    type: "charge.succeeded",
    data: {
      object: {
        id: "ch_1",
      },
    },
  },
});

assert(enqueueResult.status === "queued", "Example webhook should be queued.");
await drainDbOutboxQueue({ outbox, pipeline });

const persisted = await eventRepository.findByEventId({
  processor: "stripe",
  eventId: "evt_example_1",
});

assert(persisted?.processedAt instanceof Date, "Example webhook should be processed.");
console.log("Example app workflow smoke checks passed.");
