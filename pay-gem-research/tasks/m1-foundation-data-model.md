# Milestone M1 Progress - Foundation and Data Model

Status: complete

## Task status

- M1-T1 Package skeleton and core contracts: complete
  - Package entrypoints created for `core`, `stripe`, `express`, `sequelize`, and `facade`.
  - Core interfaces and error taxonomy implemented.
  - Contract tests with fake adapters added.
  - Generated API docs published at `docs/core-contracts.api.md`.
- M1-T2 Sequelize schema and migrations: complete
  - Foundation schema artifacts added for customers, subscriptions, charges, payment methods, webhooks, and merchants.
  - Required idempotency/default constraints encoded in SQL templates.
  - Up/down migration templates and integration README added.
  - ERD and schema docs published at `packages/sequelize/docs/schema.md`.
- M1-T3 Registration API (`pay_customer` equivalent): complete
  - `registerCustomerModel` and registry primitives implemented.
  - Owner resolution guardrails and client-reference safety helpers implemented.
  - User model integration example included in generated docs.
  - Unit tests added for default selection and owner resolution failures.

## Verification

- `bun run docs:core`
- `bun test`
- `bun run typecheck`

Last verified: 2026-02-19
