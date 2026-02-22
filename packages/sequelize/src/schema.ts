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
      description: "Merchants (connected accounts) linked to a payment processor.",
      columns: {
        id: { type: "BIGSERIAL" },
        owner_type: { type: "TEXT", nullable: false },
        owner_id: { type: "TEXT", nullable: false },
        processor: { type: "TEXT", nullable: false },
        processor_id: { type: "TEXT", nullable: true },
        default: { type: "BOOLEAN", nullable: true },
        data: { type: "JSONB", default: "'{}'::jsonb" },
        type: { type: "TEXT", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "INDEX (owner_type, owner_id)",
        "INDEX (owner_type, owner_id, processor)"
      ]
    },
    customers: {
      description: "Customer projections tied to an owner in the host application.",
      columns: {
        id: { type: "BIGSERIAL" },
        owner_type: { type: "TEXT", nullable: false },
        owner_id: { type: "TEXT", nullable: false },
        processor: { type: "TEXT", nullable: false },
        processor_id: { type: "TEXT", nullable: true },
        default: { type: "BOOLEAN", nullable: true },
        data: { type: "JSONB", default: "'{}'::jsonb" },
        stripe_account: { type: "TEXT", nullable: true },
        deleted_at: { type: "TIMESTAMPTZ", nullable: true },
        type: { type: "TEXT", nullable: true },
        object: { type: "JSONB", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "UNIQUE (owner_type, owner_id, deleted_at)"
      ]
    },
    payment_methods: {
      description: "Stored references to payment methods associated with customers.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)", nullable: false },
        processor_id: { type: "TEXT", nullable: false },
        default: { type: "BOOLEAN", nullable: true },
        payment_method_type: { type: "TEXT", nullable: true },
        data: { type: "JSONB", default: "'{}'::jsonb" },
        stripe_account: { type: "TEXT", nullable: true },
        type: { type: "TEXT", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (customer_id, processor_id)",
        "UNIQUE (customer_id) WHERE default"
      ]
    },
    subscriptions: {
      description: "Subscription projections for recurring billing.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)", nullable: false },
        name: { type: "TEXT", nullable: false },
        processor_id: { type: "TEXT", nullable: false },
        processor_plan: { type: "TEXT", nullable: false },
        quantity: { type: "INTEGER", default: "1" },
        status: { type: "TEXT", nullable: false },
        current_period_start: { type: "TIMESTAMPTZ", nullable: true },
        current_period_end: { type: "TIMESTAMPTZ", nullable: true },
        trial_ends_at: { type: "TIMESTAMPTZ", nullable: true },
        ends_at: { type: "TIMESTAMPTZ", nullable: true },
        metered: { type: "BOOLEAN", nullable: true },
        pause_behavior: { type: "TEXT", nullable: true },
        pause_starts_at: { type: "TIMESTAMPTZ", nullable: true },
        pause_resumes_at: { type: "TIMESTAMPTZ", nullable: true },
        application_fee_percent: { type: "DECIMAL(8,2)", nullable: true },
        metadata: { type: "JSONB", nullable: true },
        data: { type: "JSONB", default: "'{}'::jsonb" },
        stripe_account: { type: "TEXT", nullable: true },
        payment_method_id: { type: "TEXT", nullable: true },
        type: { type: "TEXT", nullable: true },
        object: { type: "JSONB", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (customer_id, processor_id)",
        "INDEX (metered)",
        "INDEX (pause_starts_at)"
      ]
    },
    charges: {
      description: "Charge projections used for reconciliation and support views.",
      columns: {
        id: { type: "BIGSERIAL" },
        customer_id: { type: "BIGINT", references: "customers(id)", nullable: false },
        subscription_id: { type: "BIGINT", references: "subscriptions(id)", nullable: true },
        processor_id: { type: "TEXT", nullable: false },
        amount: { type: "BIGINT", nullable: false },
        currency: { type: "TEXT", nullable: true },
        application_fee_amount: { type: "BIGINT", nullable: true },
        amount_refunded: { type: "BIGINT", nullable: true },
        metadata: { type: "JSONB", nullable: true },
        data: { type: "JSONB", default: "'{}'::jsonb" },
        stripe_account: { type: "TEXT", nullable: true },
        type: { type: "TEXT", nullable: true },
        object: { type: "JSONB", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (customer_id, processor_id)"
      ]
    },
    webhooks: {
      description: "Inbound webhook events with retry management.",
      columns: {
        id: { type: "BIGSERIAL" },
        processor: { type: "TEXT", nullable: true },
        event_id: { type: "TEXT", nullable: true },
        event_type: { type: "TEXT", nullable: true },
        event: { type: "JSONB", default: "'{}'::jsonb" },
        type: { type: "TEXT", nullable: true },
        attempt_count: { type: "INTEGER", default: "0" },
        received_at: { type: "TIMESTAMPTZ", nullable: false },
        processed_at: { type: "TIMESTAMPTZ", nullable: true },
        next_attempt_at: { type: "TIMESTAMPTZ", nullable: true },
        last_error: { type: "TEXT", nullable: true },
        dead_lettered_at: { type: "TIMESTAMPTZ", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "INDEX (processor)",
        "INDEX (event_type)",
        "INDEX (created_at)",
        "UNIQUE (processor, event_id)"
      ]
    }
  }
};
