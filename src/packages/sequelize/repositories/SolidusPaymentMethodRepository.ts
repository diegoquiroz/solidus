import type { PaymentMethodRecord, PaymentMethodRepository } from "../../core/contracts.ts";
import type { SolidusPaymentMethod } from "../models/SolidusPaymentMethod.ts";

export class SolidusPaymentMethodRepository implements PaymentMethodRepository {
  constructor(private model: typeof SolidusPaymentMethod) {}

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    await this.model.upsert({
      id: paymentMethod.id,
      processor: paymentMethod.processor,
      processorId: paymentMethod.processorId,
      customerProcessorId: paymentMethod.customerProcessorId,
      methodType: paymentMethod.methodType,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expMonth: paymentMethod.expMonth,
      expYear: paymentMethod.expYear,
      isDefault: paymentMethod.isDefault,
      rawPayload: paymentMethod.rawPayload,
    });
  }

  async clearDefaultForCustomer(customerProcessorId: string): Promise<void> {
    await this.model.update(
      { is_default: false },
      {
        where: {
          customer_processor_id: customerProcessorId,
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
      id: row.id,
      processor: row.processor,
      processorId: row.processorId,
      customerProcessorId: row.customerProcessorId,
      methodType: row.methodType,
      brand: row.brand ?? undefined,
      last4: row.last4 ?? undefined,
      expMonth: row.expMonth ?? undefined,
      expYear: row.expYear ?? undefined,
      isDefault: row.isDefault,
      rawPayload: row.rawPayload,
    };
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]> {
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
      methodType: row.methodType,
      brand: row.brand ?? undefined,
      last4: row.last4 ?? undefined,
      expMonth: row.expMonth ?? undefined,
      expYear: row.expYear ?? undefined,
      isDefault: row.isDefault,
      rawPayload: row.rawPayload,
    }));
  }
}
