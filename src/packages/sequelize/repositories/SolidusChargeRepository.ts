import type { ChargeRecord, ChargeRepository } from "../../core/contracts.ts";
import type { SolidusCharge } from "../models/SolidusCharge.ts";

export class SolidusChargeRepository implements ChargeRepository {
  constructor(private model: typeof SolidusCharge) { }

  async upsert(charge: ChargeRecord): Promise<void> {
    const idValue = charge.id ? Number(charge.id) : undefined;
    await this.model.upsert({
      ...(idValue !== undefined && !Number.isNaN(idValue) ? { id: idValue } : {}),
      processorId: charge.processorId,
      customerId: Number(charge.customerId),
      subscriptionId: charge.subscriptionId ? Number(charge.subscriptionId) : null,
      amount: charge.amount,
      currency: charge.currency,
      applicationFeeAmount: charge.applicationFeeAmount,
      amountRefunded: charge.amountRefunded,
      metadata: charge.metadata,
      data: charge.data ?? {},
    });
  }

  async findByProcessorId(processorId: string): Promise<ChargeRecord | null> {
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
      processorId: row.processorId,
      customerId: String(row.customerId),
      subscriptionId: row.subscriptionId ? String(row.subscriptionId) : undefined,
      amount: row.amount,
      currency: row.currency ?? undefined,
      applicationFeeAmount: row.applicationFeeAmount ?? undefined,
      amountRefunded: row.amountRefunded ?? undefined,
      metadata: row.metadata ?? undefined,
      data: row.data ?? undefined,
    };
  }
}
