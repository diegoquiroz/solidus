BEGIN;

DROP INDEX IF EXISTS ux_webhook_outbox_job_idempotency_key;
DROP INDEX IF EXISTS ix_webhook_outbox_run_at;
DROP TABLE IF EXISTS webhook_outbox;

DROP INDEX IF EXISTS ix_webhooks_dead_lettered_at;
DROP INDEX IF EXISTS ix_webhooks_next_attempt_at;
DROP INDEX IF EXISTS ix_webhooks_merchant_received_at;
DROP INDEX IF EXISTS ux_webhooks_processor_event_id;
DROP TABLE IF EXISTS webhooks;

DROP INDEX IF EXISTS ix_invoices_subscription_processor;
DROP INDEX IF EXISTS ix_invoices_customer_due_at;
DROP INDEX IF EXISTS ux_invoices_processor_processor_id;
DROP TABLE IF EXISTS invoices;

DROP INDEX IF EXISTS ix_payment_methods_customer_processor;
DROP INDEX IF EXISTS ix_payment_methods_customer;
DROP INDEX IF EXISTS ux_payment_methods_default_customer;
DROP INDEX IF EXISTS ux_payment_methods_processor_processor_id;
DROP TABLE IF EXISTS payment_methods;

DROP INDEX IF EXISTS ix_charges_customer_processor;
DROP INDEX IF EXISTS ix_charges_customer;
DROP INDEX IF EXISTS ux_charges_processor_processor_id;
DROP TABLE IF EXISTS charges;

DROP INDEX IF EXISTS ix_subscriptions_customer_processor;
DROP INDEX IF EXISTS ix_subscriptions_customer;
DROP INDEX IF EXISTS ux_subscriptions_processor_processor_id;
DROP TABLE IF EXISTS subscriptions;

DROP INDEX IF EXISTS ix_customers_owner;
DROP INDEX IF EXISTS ux_customers_default_owner;
DROP INDEX IF EXISTS ux_customers_processor_processor_id;
DROP TABLE IF EXISTS customers;

DROP INDEX IF EXISTS ux_merchants_processor_processor_id;
DROP TABLE IF EXISTS merchants;

COMMIT;
