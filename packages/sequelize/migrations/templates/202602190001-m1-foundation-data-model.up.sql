BEGIN;

CREATE TABLE merchants (
  id BIGSERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  processor TEXT NOT NULL,
  processor_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_merchants_owner ON merchants (owner_type, owner_id);
CREATE INDEX ix_merchants_owner_processor ON merchants (owner_type, owner_id, processor);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  processor TEXT NOT NULL,
  processor_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_account TEXT,
  deleted_at TIMESTAMPTZ,
  email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_customers_processor_processor_id ON customers (processor, processor_id);
CREATE INDEX ix_customers_owner ON customers (owner_type, owner_id);
CREATE UNIQUE INDEX ux_customers_default_owner ON customers (owner_type, owner_id) WHERE is_default;

CREATE TABLE payment_methods (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  processor_id TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  method_type TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_payment_methods_customer_processor ON payment_methods (customer_id, processor_id);
CREATE UNIQUE INDEX ux_payment_methods_default_customer ON payment_methods (customer_id) WHERE is_default;

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  processor_plan TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metered BOOLEAN,
  pause_behavior TEXT,
  pause_starts_at TIMESTAMPTZ,
  pause_resumes_at TIMESTAMPTZ,
  application_fee_percent DECIMAL(8,2),
  metadata JSONB,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_account TEXT,
  payment_method_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_subscriptions_customer_processor ON subscriptions (customer_id, processor_id);
CREATE INDEX ix_subscriptions_metered ON subscriptions (metered);
CREATE INDEX ix_subscriptions_pause_starts_at ON subscriptions (pause_starts_at);

CREATE TABLE charges (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  processor_id TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT,
  application_fee_amount BIGINT,
  amount_refunded BIGINT,
  metadata JSONB,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_charges_customer_processor ON charges (customer_id, processor_id);

CREATE TABLE webhooks (
  id BIGSERIAL PRIMARY KEY,
  processor TEXT,
  event_type TEXT,
  event JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_webhooks_processor ON webhooks (processor);
CREATE INDEX ix_webhooks_event_type ON webhooks (event_type);
CREATE INDEX ix_webhooks_created_at ON webhooks (created_at);

COMMIT;
