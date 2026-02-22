import type { PaymentMethodRecord, PaymentMethodRepository } from "../../core/contracts.ts";
import type { SolidusPaymentMethod } from "../models/SolidusPaymentMethod.ts";

export class SolidusPaymentMethodRepository implements PaymentMethodRepository {
  constructor(private model: typeof SolidusPaymentMethod) { }

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    const idValue = paymentMethod.id ? Number(paymentMethod.id) : undefined;
    await this.model.upsert({
      ...(idValue !== undefined && !Number.isNaN(idValue) ? { id: idValue } : {}),
      processorId: paymentMethod.processorId,
      default: paymentMethod.default,
      data: paymentMethod.data ?? {},
    });
  }

  async clearDefaultForCustomer(customerId: string): Promise<void> {
    await this.model.update(
      { default: false },
      {
        where: {
          customer_id: Number(customerId),
        },
      }
    );
  }

  async deleteByProcessorId(processorId: string): Promise<void> {
    await this.model.destroy({
      where: {
        processor_id: processorId,
      },
    });
  }

  async findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null> {
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
      default: row.default ?? undefined,
      data: row.data ?? undefined,
    };
  }

  async listByCustomer(customerId: string): Promise<readonly PaymentMethodRecord[]> {
    const rows = await this.model.findAll({
      where: {
        customer_id: Number(customerId),
      },
    });

    return rows.map((row) => ({
      id: String(row.id),
      processorId: row.processorId,
      default: row.default ?? undefined,
      data: row.data ?? undefined,
    }));
  }
}
