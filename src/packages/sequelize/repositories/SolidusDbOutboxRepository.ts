import type { DbOutboxRepository, DbOutboxQueueRecord } from "../../core/webhooks.ts";
import type { QueueJob } from "../../core/contracts.ts";
import type { SolidusWebhookOutbox } from "../models/SolidusWebhookOutbox.ts";

export class SolidusDbOutboxRepository implements DbOutboxRepository {
  constructor(private model: typeof SolidusWebhookOutbox) {}

  async enqueue(input: {
    job: QueueJob;
    runAt: Date;
  }): Promise<{ jobId: string }> {
    const created = await this.model.create({
      jobName: input.job.name,
      jobPayload: input.job.payload as Record<string, unknown>,
      jobIdempotencyKey: input.job.idempotencyKey,
      runAt: input.runAt,
    });

    return {
      jobId: created.id,
    };
  }

  async claimReady(input: {
    now: Date;
    limit: number;
  }): Promise<readonly DbOutboxQueueRecord[]> {
    const rows = await this.model.findAll({
      where: {},
    });

    const records = rows
      .filter((row) => row.runAt.getTime() <= input.now.getTime())
      .slice(0, input.limit)
      .map((row) => ({
        id: row.id,
        job: {
          name: row.jobName,
          payload: row.jobPayload,
          idempotencyKey: row.jobIdempotencyKey,
          runAt: row.runAt,
        } as QueueJob,
        runAt: row.runAt,
      }));

    return records;
  }

  async acknowledge(jobId: string): Promise<void> {
    await this.model.destroy({
      where: {
        id: jobId,
      },
    });
  }
}
