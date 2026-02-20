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
        metadata: { type: "JSONB", default: "'{}'::jsonb" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "UNIQUE (owner_type, owner_id) WHERE is_default",
        "INDEX (owner_type, owner_id)"
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
        customer_processor_id: { type: "TEXT" },
        status: { type: "TEXT" },
        plan_code: { type: "TEXT" },
        price_id: { type: "TEXT", nullable: true },
        quantity: { type: "INTEGER", default: "1" },
        cancel_at_period_end: { type: "BOOLEAN", default: "FALSE" },
        current_period_start: { type: "TIMESTAMPTZ", nullable: true },
        current_period_end: { type: "TIMESTAMPTZ", nullable: true },
        trial_ends_at: { type: "TIMESTAMPTZ", nullable: true },
        paused_behavior: { type: "TEXT", nullable: true },
        paused_resumes_at: { type: "TIMESTAMPTZ", nullable: true },
        raw_payload: { type: "JSONB" },
        canceled_at: { type: "TIMESTAMPTZ", nullable: true },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "INDEX (customer_id)",
        "INDEX (customer_processor_id)"
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
        customer_processor_id: { type: "TEXT" },
        amount: { type: "BIGINT" },
        currency: { type: "TEXT" },
        status: { type: "TEXT" },
        captured_at: { type: "TIMESTAMPTZ", nullable: true },
        receipt_url: { type: "TEXT", nullable: true },
        tax_amount: { type: "BIGINT", nullable: true },
        total_tax_amounts: { type: "JSONB", nullable: true },
        refund_total: { type: "BIGINT", nullable: true },
        payment_method_snapshot: { type: "JSONB", nullable: true },
        raw_payload: { type: "JSONB" },
        metadata: { type: "JSONB", default: "'{}'::jsonb" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "INDEX (customer_id)",
        "INDEX (customer_processor_id)"
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
        customer_processor_id: { type: "TEXT" },
        method_type: { type: "TEXT" },
        brand: { type: "TEXT", nullable: true },
        last4: { type: "TEXT", nullable: true },
        exp_month: { type: "INTEGER", nullable: true },
        exp_year: { type: "INTEGER", nullable: true },
        is_default: { type: "BOOLEAN", default: "FALSE" },
        metadata: { type: "JSONB", default: "'{}'::jsonb" },
        raw_payload: { type: "JSONB" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "UNIQUE (customer_id) WHERE is_default",
        "INDEX (customer_id)",
        "INDEX (customer_processor_id)"
      ]
    },
    invoices: {
      description: "Invoice projections for upcoming and payment lifecycle events.",
      columns: {
        id: { type: "BIGSERIAL" },
        merchant_id: { type: "BIGINT", references: "merchants(id)" },
        processor: { type: "TEXT" },
        processor_id: { type: "TEXT" },
        customer_processor_id: { type: "TEXT", nullable: true },
        subscription_processor_id: { type: "TEXT", nullable: true },
        status: { type: "TEXT" },
        amount_due: { type: "BIGINT", nullable: true },
        amount_paid: { type: "BIGINT", nullable: true },
        currency: { type: "TEXT", nullable: true },
        due_at: { type: "TIMESTAMPTZ", nullable: true },
        paid_at: { type: "TIMESTAMPTZ", nullable: true },
        raw_payload: { type: "JSONB" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, processor_id)",
        "INDEX (customer_processor_id, due_at DESC)",
        "INDEX (subscription_processor_id)"
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
        attempt_count: { type: "INTEGER", default: "0" },
        next_attempt_at: { type: "TIMESTAMPTZ", nullable: true },
        last_error: { type: "TEXT", nullable: true },
        dead_lettered_at: { type: "TIMESTAMPTZ", nullable: true },
        failure_count: { type: "INTEGER", default: "0" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "UNIQUE (processor, event_id)",
        "INDEX (merchant_id, received_at DESC)",
        "INDEX (next_attempt_at)",
        "INDEX (dead_lettered_at)"
      ]
    },
    webhook_outbox: {
      description: "Durable queue for deferred webhook processing jobs.",
      columns: {
        id: { type: "BIGSERIAL" },
        merchant_id: { type: "BIGINT", references: "merchants(id)", nullable: true },
        job_name: { type: "TEXT" },
        job_payload: { type: "JSONB" },
        job_idempotency_key: { type: "TEXT", nullable: true },
        run_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
        updated_at: { type: "TIMESTAMPTZ", default: "NOW()" }
      },
      indexes: [
        "INDEX (run_at)",
        "UNIQUE (job_idempotency_key) WHERE job_idempotency_key IS NOT NULL"
      ]
    }
  }
};
