# Sequelize schema (M1 foundation)

This package provides SQL-first schema artifacts for durable billing projections.

## Entity relationship diagram

```mermaid
erDiagram
  merchants ||--o{ customers : owns
  merchants ||--o{ subscriptions : scopes
  merchants ||--o{ charges : scopes
  merchants ||--o{ payment_methods : scopes
  merchants ||--o{ webhooks : receives
  customers ||--o{ subscriptions : has
  customers ||--o{ charges : has
  customers ||--o{ payment_methods : stores

  merchants {
    bigint id PK
    text processor
    text processor_id
  }

  customers {
    bigint id PK
    text owner_type
    text owner_id
    bigint merchant_id FK
    text processor
    text processor_id
    boolean is_default
  }

  subscriptions {
    bigint id PK
    bigint customer_id FK
    bigint merchant_id FK
    text processor
    text processor_id
  }

  charges {
    bigint id PK
    bigint customer_id FK
    bigint merchant_id FK
    text processor
    text processor_id
  }

  payment_methods {
    bigint id PK
    bigint customer_id FK
    bigint merchant_id FK
    text processor
    text processor_id
    boolean is_default
  }

  webhooks {
    bigint id PK
    bigint merchant_id FK
    text processor
    text event_id
  }
```

## Required constraints

- Unique processor resource identity:
  - `merchants(processor, processor_id)`
  - `customers(processor, processor_id)`
  - `subscriptions(processor, processor_id)`
  - `charges(processor, processor_id)`
  - `payment_methods(processor, processor_id)`
- One default customer per owner: `customers(owner_type, owner_id) WHERE is_default`
- One default payment method per customer: `payment_methods(customer_id) WHERE is_default`
- Webhook idempotency: `webhooks(processor, event_id)`

## Migration artifacts

- Up migration: `packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.up.sql`
- Down migration: `packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.down.sql`
