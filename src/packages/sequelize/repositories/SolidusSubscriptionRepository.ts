import type { SubscriptionRecord, SubscriptionRepository } from "../../core/contracts.ts";
import type { SolidusSubscription } from "../models/SolidusSubscription.ts";

export class SolidusSubscriptionRepository implements SubscriptionRepository {
  constructor(private model: typeof SolidusSubscription) {}

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    await this.model.upsert({
      id: subscription.id,
      processor: subscription.processor,
      processorId: subscription.processorId,
      customerProcessorId: subscription.customerProcessorId,
      status: subscription.status,
      priceId: subscription.priceId,
      quantity: subscription.quantity ?? 1,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      pausedBehavior: subscription.pausedBehavior,
      pausedResumesAt: subscription.pausedResumesAt,
      rawPayload: subscription.rawPayload,
    });
  }

  async findByProcessorId(processorId: string): Promise<SubscriptionRecord | null> {
    const row = await this.model.findOne({
      where: {
        processor_id: processorId,
      },
    });

    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      processor: row.processor,
      processorId: row.processorId,
      customerProcessorId: row.customerProcessorId,
      status: row.status,
      priceId: row.priceId ?? undefined,
      quantity: row.quantity,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodStart: row.currentPeriodStart ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      trialEndsAt: row.trialEndsAt ?? undefined,
      pausedBehavior: row.pausedBehavior ?? undefined,
      pausedResumesAt: row.pausedResumesAt ?? undefined,
      rawPayload: row.rawPayload,
    };
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]> {
    const rows = await this.model.findAll({
      where: {
        customer_processor_id: customerProcessorId,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      processor: row.processor,
      processorId: row.processorId,
      customerProcessorId: row.customerProcessorId,
      status: row.status,
      priceId: row.priceId ?? undefined,
      quantity: row.quantity,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodStart: row.currentPeriodStart ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      trialEndsAt: row.trialEndsAt ?? undefined,
      pausedBehavior: row.pausedBehavior ?? undefined,
      pausedResumesAt: row.pausedResumesAt ?? undefined,
      rawPayload: row.rawPayload,
    }));
  }
}
