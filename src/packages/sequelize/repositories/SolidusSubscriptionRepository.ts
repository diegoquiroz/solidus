import type { SubscriptionRecord, SubscriptionRepository } from "../../core/contracts.ts";
import type { SolidusSubscription } from "../models/SolidusSubscription.ts";

export class SolidusSubscriptionRepository implements SubscriptionRepository {
  constructor(private model: typeof SolidusSubscription) { }

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    const idValue = subscription.id ? Number(subscription.id) : undefined;
    await this.model.upsert({
      ...(idValue !== undefined && !Number.isNaN(idValue) ? { id: idValue } : {}),
      customerId: Number(subscription.customerId),
      name: subscription.name,
      processorId: subscription.processorId,
      processorPlan: subscription.processorPlan,
      quantity: subscription.quantity,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      endsAt: subscription.endsAt,
      metered: subscription.metered,
      pauseBehavior: subscription.pauseBehavior,
      pauseStartsAt: subscription.pauseStartsAt,
      pauseResumesAt: subscription.pauseResumesAt,
      applicationFeePercent: subscription.applicationFeePercent,
      metadata: subscription.metadata,
      data: subscription.data ?? {},
      paymentMethodId: subscription.paymentMethodId,
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
      id: String(row.id),
      customerId: String(row.customerId),
      name: row.name,
      processorId: row.processorId,
      processorPlan: row.processorPlan,
      quantity: row.quantity,
      status: row.status,
      currentPeriodStart: row.currentPeriodStart ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      trialEndsAt: row.trialEndsAt ?? undefined,
      endsAt: row.endsAt ?? undefined,
      metered: row.metered ?? undefined,
      pauseBehavior: row.pauseBehavior ?? undefined,
      pauseStartsAt: row.pauseStartsAt ?? undefined,
      pauseResumesAt: row.pauseResumesAt ?? undefined,
      applicationFeePercent: row.applicationFeePercent ?? undefined,
      metadata: row.metadata ?? undefined,
      data: row.data ?? undefined,
      paymentMethodId: row.paymentMethodId ?? undefined,
    };
  }

  async listByCustomer(customerId: string): Promise<readonly SubscriptionRecord[]> {
    const rows = await this.model.findAll({
      where: {
        customer_id: Number(customerId),
      },
    });

    return rows.map((row) => ({
      id: String(row.id),
      customerId: String(row.customerId),
      name: row.name,
      processorId: row.processorId,
      processorPlan: row.processorPlan,
      quantity: row.quantity,
      status: row.status,
      currentPeriodStart: row.currentPeriodStart ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      trialEndsAt: row.trialEndsAt ?? undefined,
      endsAt: row.endsAt ?? undefined,
      metered: row.metered ?? undefined,
      pauseBehavior: row.pauseBehavior ?? undefined,
      pauseStartsAt: row.pauseStartsAt ?? undefined,
      pauseResumesAt: row.pauseResumesAt ?? undefined,
      applicationFeePercent: row.applicationFeePercent ?? undefined,
      metadata: row.metadata ?? undefined,
      data: row.data ?? undefined,
      paymentMethodId: row.paymentMethodId ?? undefined,
    }));
  }
}
