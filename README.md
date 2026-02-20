# @diegoquiroz/solidus

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Quickstart

Start with one canonical setup path: `docs/getting-started.md`.

## Pay parity docs

- Machine-readable Stripe parity matrix: `docs/pay-stripe-parity-matrix.json`
- Parity sign-off checklist (US-014): `docs/pay-parity-signoff-checklist.md`
- Pay-style domain guides:
  - `docs/pay-customers.md`
  - `docs/pay-payment-methods.md`
  - `docs/pay-charges.md`
  - `docs/pay-subscriptions.md`
  - `docs/pay-webhooks.md`
- Rails-specific gaps and intentional non-portable behavior: `docs/not-portable-from-rails.md`
- Sequelize + Express production hardening: `docs/sequelize-express-production-hardening.md`

## Runtime compatibility

Solidus includes runtime smoke checks for Node.js, Bun, and Deno.

See `docs/runtime-compatibility.md` for the supported version matrix, caveats, and runtime test commands.

## Facade and release docs

- Facade API: `docs/facade-api.md`
- Migration guide: `docs/migration-from-ad-hoc-stripe.md`
- Manual release process: `docs/release-manual.md`
- Release notes + upgrade guide template: `docs/release-notes-and-upgrade-guide.md`
