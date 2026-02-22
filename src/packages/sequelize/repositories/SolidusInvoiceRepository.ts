import type { StripeInvoiceProjectionRepository, StripeInvoiceProjection } from "../../stripe/default-webhook-effects.ts";
import type { SolidusInvoice } from "../models/SolidusInvoice.ts";

export class SolidusInvoiceRepository implements StripeInvoiceProjectionRepository {
  constructor(private model: typeof SolidusInvoice) {}

  async upsert(invoice: StripeInvoiceProjection): Promise<void> {
    await this.model.upsert({
      id: invoice.id,
      processor: invoice.processor,
      processorId: invoice.processorId,
      customerProcessorId: invoice.customerProcessorId,
      subscriptionProcessorId: invoice.subscriptionProcessorId,
      status: invoice.status,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      rawPayload: invoice.rawPayload,
    });
  }

  async findByProcessorId(processorId: string): Promise<StripeInvoiceProjection | null> {
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
      processor: row.processor as "stripe",
      processorId: row.processorId,
      customerProcessorId: row.customerProcessorId ?? undefined,
      subscriptionProcessorId: row.subscriptionProcessorId ?? undefined,
      status: row.status,
      amountDue: row.amountDue ?? undefined,
      amountPaid: row.amountPaid ?? undefined,
      currency: row.currency ?? undefined,
      dueAt: row.dueAt ?? undefined,
      paidAt: row.paidAt ?? undefined,
      rawPayload: row.rawPayload as unknown as import("stripe").default.Invoice,
    };
  }
}
