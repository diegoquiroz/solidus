# Milestone M5 Progress - Runtime Compatibility, Observability, and Release

Status: in_progress (US-003 prepared; manual publish pending)

## User story status

- US-001 Harden Node, Bun, and Deno compatibility: complete
  - Added runtime smoke scripts in `package.json` (`test:runtime:node`, `test:runtime:bun`, `test:runtime:deno`, `test:runtime`).
  - Added runtime smoke suite in `scripts/runtime/smoke.ts` and CI runtime matrix in `.github/workflows/runtime-matrix.yml`.
  - Isolated runtime payload conversion in `src/packages/stripe/runtime-payload.ts` and updated webhook verification path in `src/packages/stripe/webhooks.ts`.
  - Added payload conversion coverage in `src/packages/stripe/__tests__/webhooks.test.ts`.
  - Published compatibility matrix and caveats in `docs/runtime-compatibility.md`; linked from `README.md`.
- US-002 Implement observability and operations support: complete
  - Added optional `observability.log` and `observability.metric` hooks to the webhook pipeline in `src/packages/core/webhooks.ts`.
  - Emitted ingest/process transition metrics and webhook lag metric (`webhook.lag.ms`) for `processed`, `retrying`, and `dead_letter` paths.
  - Added `getWebhookHealthDiagnostics` helper in `src/packages/core/webhooks.ts` for pending/retrying/dead-letter counts and lag-based warnings.
  - Added smoke tests for structured log fields and metric emission in `src/packages/core/__tests__/webhooks.test.ts`.
  - Expanded operations docs in `docs/express-webhooks.md` and `docs/webhook-operations-runbook.md`, including secret rotation and outage handling playbooks.
- US-003 Finalize packaging and release process: in_progress
  - Finalized facade package entrypoint with `createSolidusFacade` in `src/packages/facade/index.ts` and coverage in `src/packages/facade/__tests__/index.test.ts`.
  - Published migration guide from ad hoc Stripe integrations in `docs/migration-from-ad-hoc-stripe.md`.
  - Published manual release process and versioning policy in `docs/release-manual.md` (no release executed yet).
  - Added release notes + upgrade guide template in `docs/release-notes-and-upgrade-guide.md`.
  - Added end-to-end example app smoke workflow in `.github/workflows/example-app.yml` with `scripts/example-app/smoke.ts` and `bun run test:example-app`.
  - Remaining manual step: publish first stable release candidate when explicitly approved.

## Verification

- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun run test:integration`
- `bun run test:runtime:node`
- `bun run test:runtime:bun`
- `bun run test:runtime:deno`
- `bun run test:example-app`
- `bun test src/packages/facade/__tests__/index.test.ts`

Last verified: 2026-02-19
