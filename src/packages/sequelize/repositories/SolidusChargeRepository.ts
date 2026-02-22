import type { ChargeRecord, ChargeRepository } from "../../core/contracts.ts";
import type { SolidusCharge } from "../models/SolidusCharge.ts";

export class SolidusChargeRepository implements ChargeRepository {
  constructor(private model: typeof SolidusCharge) {}

  async upsert(charge: ChargeRecord): Promise<void> {
    await this.model.upsert({
      id: charge.id,
      processor: charge.processor,
      processorId: charge.processorId,
      customerProcessorId: charge.customerProcessorId,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      receiptUrl: charge.receiptUrl,
      taxAmount: charge.taxAmount,
      totalTaxAmounts: charge.totalTaxAmounts,
      refundTotal: charge.refundTotal,
      paymentMethodSnapshot: charge.paymentMethodSnapshot,
      rawPayload: charge.rawPayload,
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
      id: row.id,
      processor: row.processor,
      processorId: row.processorId,
      customerProcessorId: row.customerProcessorId,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      receiptUrl: row.receiptUrl ?? undefined,
      taxAmount: row.taxAmount ?? undefined,
      totalTaxAmounts: row.totalTaxAmounts ?? undefined,
      refundTotal: row.refundTotal ?? undefined,
      paymentMethodSnapshot: row.paymentMethodSnapshot ?? undefined,
      rawPayload: row.rawPayload,
    };
  }
}
