# Release Notes and Upgrade Guide Template

Use this template when publishing the first stable release candidate.

## Release notes

- Version: `vX.Y.Z`
- Date: `YYYY-MM-DD`
- Highlights:
  - Runtime compatibility matrix for Node/Bun/Deno.
  - Webhook observability hooks and health diagnostics.
  - Facade API entrypoint via `createSolidusFacade`.

## Breaking changes

- List any breaking changes, or `None`.

## Upgrade steps

1. Upgrade package to target version.
2. Review runtime caveats in `docs/runtime-compatibility.md`.
3. Review operations updates in `docs/express-webhooks.md` and `docs/webhook-operations-runbook.md`.
4. For teams with custom Stripe wrappers, follow `docs/migration-from-ad-hoc-stripe.md`.

## Validation checklist

- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun run test:integration`
- `bun run test:runtime`
- `bun run test:example-app`
