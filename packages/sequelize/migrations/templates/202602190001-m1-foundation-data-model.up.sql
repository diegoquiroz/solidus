BEGIN;

CREATE TABLE merchants (
  id BIGSERIAL PRIMARY KEY,
  processor TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_merchants_processor_processor_id
  ON merchants (processor, processor_id);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  email TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_customers_processor_processor_id
  ON customers (processor, processor_id);

CREATE UNIQUE INDEX ux_customers_default_owner
  ON customers (owner_type, owner_id)
  WHERE is_default;

CREATE INDEX ix_customers_owner
  ON customers (owner_type, owner_id);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_subscriptions_processor_processor_id
  ON subscriptions (processor, processor_id);

CREATE INDEX ix_subscriptions_customer
  ON subscriptions (customer_id);

CREATE TABLE charges (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  captured_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_charges_processor_processor_id
  ON charges (processor, processor_id);

CREATE INDEX ix_charges_customer
  ON charges (customer_id);

CREATE TABLE payment_methods (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  method_type TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  expires_month INTEGER,
  expires_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_payment_methods_processor_processor_id
  ON payment_methods (processor, processor_id);

CREATE UNIQUE INDEX ux_payment_methods_default_customer
  ON payment_methods (customer_id)
  WHERE is_default;

CREATE INDEX ix_payment_methods_customer
  ON payment_methods (customer_id);

CREATE TABLE webhooks (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_webhooks_processor_event_id
  ON webhooks (processor, event_id);

CREATE INDEX ix_webhooks_merchant_received_at
  ON webhooks (merchant_id, received_at DESC);

COMMIT;
