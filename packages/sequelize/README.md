# @solidus/sequelize (M1 artifacts)

Foundation schema artifacts for Solidus Sequelize integrations.

- Schema metadata: `packages/sequelize/src/schema.ts`
- SQL migrations: `packages/sequelize/migrations/templates`
- ERD and constraint docs: `packages/sequelize/docs/schema.md`

The M1 template now includes contract-aligned projection fields for:

- payment methods, charges, and subscriptions raw payload snapshots
- webhook lifecycle tracking (`attempt_count`, retry schedule, dead-letter markers)
- invoice projections (`invoices` table)
- durable webhook queue jobs (`webhook_outbox` table)
