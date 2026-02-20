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

export interface WebhookLogEntry {
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  processor: string;
  eventId: string;
  eventType?: string;
  status?: "queued" | "duplicate" | "processed" | "retrying" | "dead_letter" | "skipped";
  attemptCount?: number;
  lagMs?: number;
  error?: string;
  timestamp: Date;
}

export interface WebhookMetricSample {
  name: string;
  value: number;
  unit: "count" | "ms";
  tags?: Record<string, string>;
}

export interface WebhookObservabilityHooks {
  log?: (entry: WebhookLogEntry) => void | Promise<void>;
  metric?: (sample: WebhookMetricSample) => void | Promise<void>;
}

export interface WebhookPipeline {
  ingest(input: WebhookIngestInput): Promise<{ status: "queued" | "duplicate"; jobId?: string }>;
  processByEventId(input: { processor: string; eventId: string }): Promise<{
    status: "processed" | "retrying" | "dead_letter" | "skipped";
  }>;
  processQueueJob(job: QueueJob): Promise<void>;
}

export interface WebhookHealthDiagnostics {
  generatedAt: Date;
  pendingCount: number;
  retryingCount: number;
  deadLetterCount: number;
  oldestLagMs: number;
  warnings: readonly ("LAG_THRESHOLD_EXCEEDED" | "DEAD_LETTER_THRESHOLD_EXCEEDED")[];
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

function computeLagMs(receivedAt: Date, completedAt: Date): number {
  return Math.max(0, completedAt.getTime() - receivedAt.getTime());
}

async function emitLog(
  hooks: WebhookObservabilityHooks | undefined,
  entry: WebhookLogEntry,
): Promise<void> {
  if (hooks?.log === undefined) {
    return;
  }

  try {
    await hooks.log(entry);
  } catch {
    // Swallow observability hook failures to preserve webhook behavior.
  }
}

async function emitMetric(
  hooks: WebhookObservabilityHooks | undefined,
  sample: WebhookMetricSample,
): Promise<void> {
  if (hooks?.metric === undefined) {
    return;
  }

  try {
    await hooks.metric(sample);
  } catch {
    // Swallow observability hook failures to preserve webhook behavior.
  }
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
  observability?: WebhookObservabilityHooks;
}): WebhookPipeline {
  const now = options.now ?? (() => new Date());
  const retryPolicy = normalizeRetryPolicy(options.retryPolicy);

  async function processByEventId(input: { processor: string; eventId: string }): Promise<{
    status: "processed" | "retrying" | "dead_letter" | "skipped";
  }> {
    const event = await options.eventRepository.findByEventId(input);

    if (event === null || event.processedAt !== undefined || event.deadLetteredAt !== undefined) {
      const skippedAt = now();
      await emitLog(options.observability, {
        level: "info",
        event: "webhook.process.skipped",
        message: "Skipping webhook event that is missing or already completed.",
        processor: input.processor,
        eventId: input.eventId,
        status: "skipped",
        timestamp: skippedAt,
      });
      await emitMetric(options.observability, {
        name: "webhook.process.transition.count",
        value: 1,
        unit: "count",
        tags: {
          status: "skipped",
          processor: input.processor,
        },
      });
      return { status: "skipped" };
    }

    const startedAt = now();
    await emitLog(options.observability, {
      level: "info",
      event: "webhook.process.started",
      message: "Starting webhook event processing.",
      processor: input.processor,
      eventId: input.eventId,
      eventType: event.eventType,
      timestamp: startedAt,
    });
    await emitMetric(options.observability, {
      name: "webhook.process.started.count",
      value: 1,
      unit: "count",
      tags: {
        processor: input.processor,
        eventType: event.eventType,
      },
    });

    try {
      await options.processEvent(event);
      const processedAt = now();
      await options.eventRepository.markProcessed({
        processor: input.processor,
        eventId: input.eventId,
        processedAt,
      });
      const lagMs = computeLagMs(event.receivedAt, processedAt);
      await emitLog(options.observability, {
        level: "info",
        event: "webhook.process.processed",
        message: "Webhook event processed successfully.",
        processor: input.processor,
        eventId: input.eventId,
        eventType: event.eventType,
        status: "processed",
        attemptCount: event.attemptCount,
        lagMs,
        timestamp: processedAt,
      });
      await emitMetric(options.observability, {
        name: "webhook.process.transition.count",
        value: 1,
        unit: "count",
        tags: {
          status: "processed",
          processor: input.processor,
          eventType: event.eventType,
        },
      });
      await emitMetric(options.observability, {
        name: "webhook.lag.ms",
        value: lagMs,
        unit: "ms",
        tags: {
          status: "processed",
          processor: input.processor,
          eventType: event.eventType,
        },
      });
      return { status: "processed" };
    } catch (error: unknown) {
      const attemptCount = event.attemptCount + 1;
      const lastError = getErrorMessage(error);

      if (attemptCount >= retryPolicy.maxAttempts) {
        const deadLetteredAt = now();
        await options.eventRepository.markDeadLetter({
          processor: input.processor,
          eventId: input.eventId,
          attemptCount,
          deadLetteredAt,
          lastError,
        });
        const lagMs = computeLagMs(event.receivedAt, deadLetteredAt);
        await emitLog(options.observability, {
          level: "error",
          event: "webhook.process.dead_letter",
          message: "Webhook event moved to dead letter after max retries.",
          processor: input.processor,
          eventId: input.eventId,
          eventType: event.eventType,
          status: "dead_letter",
          attemptCount,
          lagMs,
          error: lastError,
          timestamp: deadLetteredAt,
        });
        await emitMetric(options.observability, {
          name: "webhook.process.transition.count",
          value: 1,
          unit: "count",
          tags: {
            status: "dead_letter",
            processor: input.processor,
            eventType: event.eventType,
          },
        });
        await emitMetric(options.observability, {
          name: "webhook.lag.ms",
          value: lagMs,
          unit: "ms",
          tags: {
            status: "dead_letter",
            processor: input.processor,
            eventType: event.eventType,
          },
        });
        return { status: "dead_letter" };
      }

      const retryMarkedAt = now();
      const retryAt = new Date(retryMarkedAt.getTime() + computeRetryDelayMs(attemptCount, retryPolicy));

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

      const lagMs = computeLagMs(event.receivedAt, retryMarkedAt);
      await emitLog(options.observability, {
        level: "warn",
        event: "webhook.process.retrying",
        message: "Webhook event failed and is scheduled for retry.",
        processor: input.processor,
        eventId: input.eventId,
        eventType: event.eventType,
        status: "retrying",
        attemptCount,
        lagMs,
        error: lastError,
        timestamp: retryMarkedAt,
      });
      await emitMetric(options.observability, {
        name: "webhook.process.transition.count",
        value: 1,
        unit: "count",
        tags: {
          status: "retrying",
          processor: input.processor,
          eventType: event.eventType,
        },
      });
      await emitMetric(options.observability, {
        name: "webhook.lag.ms",
        value: lagMs,
        unit: "ms",
        tags: {
          status: "retrying",
          processor: input.processor,
          eventType: event.eventType,
        },
      });

      return { status: "retrying" };
    }
  }

  return {
    async ingest(input: WebhookIngestInput): Promise<{ status: "queued" | "duplicate"; jobId?: string }> {
      const ingestReceivedAt = now();
      await emitLog(options.observability, {
        level: "info",
        event: "webhook.ingest.received",
        message: "Received webhook event for ingestion.",
        processor: input.processor,
        eventId: input.eventId,
        eventType: input.eventType,
        timestamp: ingestReceivedAt,
      });
      await emitMetric(options.observability, {
        name: "webhook.ingest.received.count",
        value: 1,
        unit: "count",
        tags: {
          processor: input.processor,
          eventType: input.eventType,
        },
      });

      const reservation = await options.idempotencyRepository.reserve({
        scope: webhookScope,
        key: `${input.processor}:${input.eventId}`,
      });

      if (reservation === "exists") {
        const duplicateAt = now();
        await emitLog(options.observability, {
          level: "info",
          event: "webhook.ingest.duplicate",
          message: "Webhook event ignored because it is a duplicate.",
          processor: input.processor,
          eventId: input.eventId,
          eventType: input.eventType,
          status: "duplicate",
          timestamp: duplicateAt,
        });
        await emitMetric(options.observability, {
          name: "webhook.ingest.transition.count",
          value: 1,
          unit: "count",
          tags: {
            status: "duplicate",
            processor: input.processor,
            eventType: input.eventType,
          },
        });
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
        const duplicateAt = now();
        await emitLog(options.observability, {
          level: "info",
          event: "webhook.ingest.duplicate",
          message: "Webhook event already persisted and is treated as duplicate.",
          processor: input.processor,
          eventId: input.eventId,
          eventType: input.eventType,
          status: "duplicate",
          timestamp: duplicateAt,
        });
        await emitMetric(options.observability, {
          name: "webhook.ingest.transition.count",
          value: 1,
          unit: "count",
          tags: {
            status: "duplicate",
            processor: input.processor,
            eventType: input.eventType,
          },
        });
        return { status: "duplicate" };
      }

      const queued = await options.queue.enqueue(
        createWebhookQueueJob({
          processor: input.processor,
          eventId: input.eventId,
        }),
      );

      const queuedAt = now();
      await emitLog(options.observability, {
        level: "info",
        event: "webhook.ingest.queued",
        message: "Webhook event persisted and queued for processing.",
        processor: input.processor,
        eventId: input.eventId,
        eventType: input.eventType,
        status: "queued",
        timestamp: queuedAt,
      });
      await emitMetric(options.observability, {
        name: "webhook.ingest.transition.count",
        value: 1,
        unit: "count",
        tags: {
          status: "queued",
          processor: input.processor,
          eventType: input.eventType,
        },
      });

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

export async function getWebhookHealthDiagnostics(options: {
  listEvents: () => Promise<readonly PersistedWebhookEvent[]>;
  now?: () => Date;
  lagWarningThresholdMs?: number;
  deadLetterWarningThreshold?: number;
}): Promise<WebhookHealthDiagnostics> {
  const now = options.now ?? (() => new Date());
  const lagWarningThresholdMs = options.lagWarningThresholdMs ?? 300_000;
  const deadLetterWarningThreshold = options.deadLetterWarningThreshold ?? 1;
  const generatedAt = now();
  const events = await options.listEvents();

  let pendingCount = 0;
  let retryingCount = 0;
  let deadLetterCount = 0;
  let oldestLagMs = 0;

  for (const event of events) {
    if (event.deadLetteredAt !== undefined) {
      deadLetterCount += 1;
      continue;
    }

    if (event.processedAt !== undefined) {
      continue;
    }

    if (event.nextAttemptAt === undefined) {
      pendingCount += 1;
    } else {
      retryingCount += 1;
    }

    const lagMs = computeLagMs(event.receivedAt, generatedAt);
    oldestLagMs = Math.max(oldestLagMs, lagMs);
  }

  const warnings: Array<"LAG_THRESHOLD_EXCEEDED" | "DEAD_LETTER_THRESHOLD_EXCEEDED"> = [];

  if (oldestLagMs >= lagWarningThresholdMs) {
    warnings.push("LAG_THRESHOLD_EXCEEDED");
  }

  if (deadLetterCount >= deadLetterWarningThreshold) {
    warnings.push("DEAD_LETTER_THRESHOLD_EXCEEDED");
  }

  return {
    generatedAt,
    pendingCount,
    retryingCount,
    deadLetterCount,
    oldestLagMs,
    warnings,
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
