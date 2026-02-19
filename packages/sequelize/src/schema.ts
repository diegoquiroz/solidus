export type ColumnSpec = {
  type: string;
  nullable?: boolean;
  default?: string;
  references?: string;
};

export type TableSpec = {
  description: string;
  columns: Record<string, ColumnSpec>;
  indexes: string[];
};

export type SchemaSpec = {
  tables: Record<string, TableSpec>;
};

export const m1FoundationSchema: SchemaSpec = {
  tables: {
    merchants: {
      description: "Billing account owners linked to a payment processor account.",
      columns: {
        id: { type: "BIGSERIAL" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        name: { type: "TEXT", nullable: false },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)"
      ]
    },
    customers: {
      description: "Customer projections tied to an owner in the host application.",
      columns: {
        id: { type: "BIGSERIAL" },
        owner_type: { type: "TEXT" },
        owner_id: { type: "TEXT" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        email: { type: "TEXT", nullable: true },
        is_default: { type: "BOOLEAN", default: "FALSE" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "UNIQUE (owner_type, owner_id) WHERE is_default"
      ]
    },
    subscriptions: {
      description: "Subscription projections for recurring billing.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        status: { type: "TEXT" },
        plan_code: { type: "TEXT" },
        current_period_end: { type: "TIMESTAMPTZ", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "INDEX (customer_id)"
      ]
    },
    charges: {
      description: "Charge projections used for reconciliation and support views.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        amount: { type: "BIGINT" },
        currency: { type: "TEXT" },
        status: { type: "TEXT" },
        captured_at: { type: "TIMESTAMPTZ", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "INDEX (customer_id)"
      ]
    },
    payment_methods: {
      description: "Stored references to payment methods associated with customers.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        method_type: { type: "TEXT" },
        brand: { type: "TEXT", nullable: true },
        last4: { type: "TEXT", nullable: true },
        is_default: { type: "BOOLEAN", default: "FALSE" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "UNIQUE (customer_id) WHERE is_default"
      ]
    },
    webhooks: {
      description: "Inbound webhook events with idempotency protection.",
      columns: {
        id: { type: "BIGSERIAL" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        event_id: { type: "TEXT" },
        event_type: { type: "TEXT" },
        payload: { type: "JSONB" },
        received_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        processed_at: { type: "TIMESTAMPTZ", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, event_id)",
        "INDEX (merchant_id, received_at DESC)"
      ]
    }
  }
};
