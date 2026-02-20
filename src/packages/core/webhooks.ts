import type { IdempotencyRepository, QueueAdapter, QueueJob } from "./contracts.ts";

export interface PersistedWebhookEvent {
  id: string;
  processor: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  attemptCount: number;
  receivedAt: Date;
  processedAt?: Date;
  nextAttemptAt?: Date;
  lastError?: string;
  deadLetteredAt?: Date;
}

export interface WebhookEventRepository {
  persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists">;
  findByEventId(input: { processor: string; eventId: string }): Promise<PersistedWebhookEvent | null>;
  markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void>;
  markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void>;
  markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void>;
}

export interface DbOutboxQueueRecord {
  id: string;
  job: QueueJob;
  runAt: Date;
}

export interface DbOutboxRepository {
  enqueue(input: { job: QueueJob; runAt: Date }): Promise<{ jobId: string }>;
  claimReady(input: { now: Date; limit: number }): Promise<readonly DbOutboxQueueRecord[]>;
  acknowledge(jobId: string): Promise<void>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface WebhookIngestInput {
  processor: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  receivedAt?: Date;
}

export interface WebhookPipeline {
  ingest(input: WebhookIngestInput): Promise<{ status: "queued" | "duplicate"; jobId?: string }>;
  processByEventId(input: { processor: string; eventId: string }): Promise<{
    status: "processed" | "retrying" | "dead_letter" | "skipped";
  }>;
  processQueueJob(job: QueueJob): Promise<void>;
}

const webhookScope = "webhook";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown webhook processing failure.";
}

function createWebhookQueueJob(input: { processor: string; eventId: string; runAt?: Date }): QueueJob {
  return {
    name: "webhook.process",
    payload: {
      processor: input.processor,
      eventId: input.eventId,
    },
    idempotencyKey: `${input.processor}:${input.eventId}`,
    runAt: input.runAt,
  };
}

function normalizeRetryPolicy(policy?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxAttempts: policy?.maxAttempts ?? 5,
    baseDelayMs: policy?.baseDelayMs ?? 500,
    backoffMultiplier: policy?.backoffMultiplier ?? 2,
    maxDelayMs: policy?.maxDelayMs ?? 30_000,
  };
}

function computeRetryDelayMs(attemptCount: number, retryPolicy: RetryPolicy): number {
  const exponent = Math.max(0, attemptCount - 1);
  const delay = retryPolicy.baseDelayMs * retryPolicy.backoffMultiplier ** exponent;
  return Math.min(delay, retryPolicy.maxDelayMs);
}

export function createInlineQueueAdapter(options: {
  run(job: QueueJob): Promise<void>;
}): QueueAdapter {
  let sequence = 0;

  return {
    async enqueue(job: QueueJob): Promise<{ jobId: string }> {
      sequence += 1;
      await options.run(job);
      return { jobId: `inline-${sequence}` };
    },
  };
}

export function createDbOutboxQueueAdapter(options: {
  outbox: DbOutboxRepository;
  now?: () => Date;
}): QueueAdapter {
  const now = options.now ?? (() => new Date());

  return {
    async enqueue(job: QueueJob): Promise<{ jobId: string }> {
      const runAt = job.runAt ?? now();
      return options.outbox.enqueue({ job, runAt });
    },
  };
}

export function createPersistFirstWebhookPipeline(options: {
  idempotencyRepository: IdempotencyRepository;
  eventRepository: WebhookEventRepository;
  queue: QueueAdapter;
  processEvent(event: PersistedWebhookEvent): Promise<void>;
  retryPolicy?: Partial<RetryPolicy>;
  now?: () => Date;
}): WebhookPipeline {
  const now = options.now ?? (() => new Date());
  const retryPolicy = normalizeRetryPolicy(options.retryPolicy);

  async function processByEventId(input: { processor: string; eventId: string }): Promise<{
    status: "processed" | "retrying" | "dead_letter" | "skipped";
  }> {
    const event = await options.eventRepository.findByEventId(input);

    if (event === null || event.processedAt !== undefined || event.deadLetteredAt !== undefined) {
      return { status: "skipped" };
    }

    try {
      await options.processEvent(event);
      await options.eventRepository.markProcessed({
        processor: input.processor,
        eventId: input.eventId,
        processedAt: now(),
      });
      return { status: "processed" };
    } catch (error: unknown) {
      const attemptCount = event.attemptCount + 1;
      const lastError = getErrorMessage(error);

      if (attemptCount >= retryPolicy.maxAttempts) {
        await options.eventRepository.markDeadLetter({
          processor: input.processor,
          eventId: input.eventId,
          attemptCount,
          deadLetteredAt: now(),
          lastError,
        });
        return { status: "dead_letter" };
      }

      const retryAt = new Date(now().getTime() + computeRetryDelayMs(attemptCount, retryPolicy));

      await options.eventRepository.markRetrying({
        processor: input.processor,
        eventId: input.eventId,
        attemptCount,
        nextAttemptAt: retryAt,
        lastError,
      });

      await options.queue.enqueue(createWebhookQueueJob({
        processor: input.processor,
        eventId: input.eventId,
        runAt: retryAt,
      }));

      return { status: "retrying" };
    }
  }

  return {
    async ingest(input: WebhookIngestInput): Promise<{ status: "queued" | "duplicate"; jobId?: string }> {
      const reservation = await options.idempotencyRepository.reserve({
        scope: webhookScope,
        key: `${input.processor}:${input.eventId}`,
      });

      if (reservation === "exists") {
        return { status: "duplicate" };
      }

      const receivedAt = input.receivedAt ?? now();
      const persistResult = await options.eventRepository.persist({
        processor: input.processor,
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload,
        receivedAt,
      });

      if (persistResult === "exists") {
        return { status: "duplicate" };
      }

      const queued = await options.queue.enqueue(
        createWebhookQueueJob({
          processor: input.processor,
          eventId: input.eventId,
        }),
      );

      return {
        status: "queued",
        jobId: queued.jobId,
      };
    },

    processByEventId,

    async processQueueJob(job: QueueJob): Promise<void> {
      if (job.name !== "webhook.process") {
        return;
      }

      if (typeof job.payload !== "object" || job.payload === null) {
        return;
      }

      const payload = job.payload as { processor?: unknown; eventId?: unknown };

      if (typeof payload.processor !== "string" || typeof payload.eventId !== "string") {
        return;
      }

      await processByEventId({
        processor: payload.processor,
        eventId: payload.eventId,
      });
    },
  };
}

export async function drainDbOutboxQueue(options: {
  outbox: DbOutboxRepository;
  pipeline: WebhookPipeline;
  now?: () => Date;
  limit?: number;
}): Promise<number> {
  const now = options.now ?? (() => new Date());
  const limit = options.limit ?? 100;
  const jobs = await options.outbox.claimReady({ now: now(), limit });

  for (const job of jobs) {
    await options.pipeline.processQueueJob(job.job);
    await options.outbox.acknowledge(job.id);
  }

  return jobs.length;
}
