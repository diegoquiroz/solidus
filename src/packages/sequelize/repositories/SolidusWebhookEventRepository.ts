import type { WebhookEventRepository, PersistedWebhookEvent } from "../../core/webhooks.ts";
import type { SolidusWebhookEvent } from "../models/SolidusWebhookEvent.ts";

export class SolidusWebhookEventRepository implements WebhookEventRepository {
  constructor(private model: typeof SolidusWebhookEvent) {}

  async persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists"> {
    try {
      await this.model.create({
        processor: event.processor,
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
        receivedAt: event.receivedAt,
        attemptCount: 0,
      });

      return "created";
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        return "exists";
      }

      throw error;
    }
  }

  async findByEventId(input: {
    processor: string;
    eventId: string;
  }): Promise<PersistedWebhookEvent | null> {
    const row = await this.model.findOne({
      where: {
        processor: input.processor,
        event_id: input.eventId,
      },
    });

    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      processor: row.processor,
      eventId: row.eventId,
      eventType: row.eventType,
      payload: row.payload,
      attemptCount: row.attemptCount,
      receivedAt: row.receivedAt,
      processedAt: row.processedAt ?? undefined,
      nextAttemptAt: row.nextAttemptAt ?? undefined,
      lastError: row.lastError ?? undefined,
      deadLetteredAt: row.deadLetteredAt ?? undefined,
    };
  }

  async markProcessed(input: {
    processor: string;
    eventId: string;
    processedAt: Date;
  }): Promise<void> {
    await this.model.update(
      { processed_at: input.processedAt },
      {
        where: {
          processor: input.processor,
          event_id: input.eventId,
        },
      }
    );
  }

  async markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void> {
    await this.model.update(
      {
        attempt_count: input.attemptCount,
        next_attempt_at: input.nextAttemptAt,
        last_error: input.lastError,
      },
      {
        where: {
          processor: input.processor,
          event_id: input.eventId,
        },
      }
    );
  }

  async markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void> {
    await this.model.update(
      {
        attempt_count: input.attemptCount,
        dead_lettered_at: input.deadLetteredAt,
        last_error: input.lastError,
      },
      {
        where: {
          processor: input.processor,
          event_id: input.eventId,
        },
      }
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const candidate = error as {
      name?: string;
      code?: string | number;
      original?: { code?: string | number };
      parent?: { code?: string | number };
    };

    if (typeof candidate.name === "string" && candidate.name.includes("UniqueConstraint")) {
      return true;
    }

    const code = candidate.code ?? candidate.original?.code ?? candidate.parent?.code;
    return code === "23505" || code === "SQLITE_CONSTRAINT" || code === 19;
  }
}
