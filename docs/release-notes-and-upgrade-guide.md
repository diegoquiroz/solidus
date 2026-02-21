# Release Notes and Upgrade Guide (fill-gaps-v1)

## Release notes

- Version: `v1.0.0-rc.1` (release candidate template for fill-gaps-v1)
- Date: `2026-02-20`
- Scope: Milestones M1-M4 in `projects/fill-gaps-v1`
- Highlights:
  - First-party Sequelize repositories and aligned schema artifacts are now documented and tested.
  - Default Stripe webhook effects are available through additive facade/express registration.
  - Pay parity corrections from v1 scope are implemented (paused semantics, pause defaults, event mode gating, tax mapping).
  - Webhook runbook and observability checklist are updated for replay, retry, and dead-letter triage.

## Breaking changes

- None documented for fill-gaps-v1. Changes are additive and keep prior extension points available.

## Upgrade steps

1. Upgrade package to the target release.
2. Apply Sequelize adapter setup:

```ts
import Stripe from "stripe";
import { createSolidusFacade } from "@diegoquiroz/solidus";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const facade = createSolidusFacade({
  stripe,
  repositories,
  webhookRepositories,
  webhookRegistration: {
    enableDefaultEffects: true,
    effects: {
      async notifySubscriptionTrialWillEnd(subscriptionId) {
        console.log("trial ending", subscriptionId);
      },
    },
  },
});
```

3. Enable webhook ingestion with persist-first processing and explicit event mode policy for your environment (`docs/express-webhooks.md`).
4. Review migration mapping for existing Stripe wrappers (`docs/migration-from-ad-hoc-stripe.md`).
5. Review operations guidance for replay/dead-letter handling (`docs/webhook-operations-runbook.md`).
6. Review Rails portability caveats and intentional differences (`docs/not-portable-from-rails.md`).

## Pay parity delta (v1)

| Gap from parity plan | v1 status | Source of truth |
| --- | --- | --- |
| First-party persistence layer (Sequelize repositories + schema parity) | Closed | `projects/fill-gaps-v1/m1-sequelize-parity.tasks.json` |
| Default webhook effects for projection sync | Closed | `projects/fill-gaps-v1/m2-default-webhook-effects.tasks.json` |
| Turnkey facade/express default-effects wiring | Closed | `projects/fill-gaps-v1/m2-default-webhook-effects.tasks.json` |
| Owner-centric convenience APIs (`set payment processor` + sync helpers) | Closed | `docs/facade-api.md`, `projects/fill-gaps-v1/m2-default-webhook-effects.tasks.json` |
| Per-customer connected-account context propagation | Closed | `projects/fill-gaps-v1/m2-default-webhook-effects.tasks.json` |
| Paused subscription active-state semantics | Closed | `docs/stripe-core-apis.md`, `projects/fill-gaps-v1/m3-stripe-parity-corrections.tasks.json` |
| Pause API default behavior parity (`behavior: "void"`) | Closed | `docs/stripe-core-apis.md`, `projects/fill-gaps-v1/m3-stripe-parity-corrections.tasks.json` |
| Webhook live/test event gating policy | Closed | `docs/express-webhooks.md`, `projects/fill-gaps-v1/m3-stripe-parity-corrections.tasks.json` |
| Charge tax projection mapping correctness | Closed | `docs/stripe-core-apis.md`, `projects/fill-gaps-v1/m3-stripe-parity-corrections.tasks.json` |

## Known limitations and compatibility notes

- Provider/framework scope in v1 remains Stripe + Express + Sequelize-first setup; non-Stripe providers and non-Express frameworks are out of this milestone scope.
- Existing integrations that rely on custom webhook effects can keep them; default effects are opt-in (`enableDefaultEffects`) and additive.
- Webhook event mode defaults remain backward-compatible (`allowLiveEvents: true`, `allowTestEvents: true`); production deployments should explicitly disable test events where required.
- Customer registration does not auto-link existing Stripe customers; use explicit reconciliation flows (`customers.reconcileByEmail` or `customers.reconcileByProcessorId`).
- `createFacadePlaceholder` remains available for compatibility with earlier milestone artifacts; new integrations should use `createSolidusFacade`.
- Rails callback/migration conventions are not first-party portable in this scope; see `docs/not-portable-from-rails.md`.

## Reference docs published for parity milestones

- Canonical quickstart: `docs/getting-started.md`
- Pay parity matrix (machine-readable): `docs/pay-stripe-parity-matrix.json`
- Pay parity sign-off checklist (US-014): `docs/pay-parity-signoff-checklist.md`
- Pay-style domain docs:
  - `docs/3_customers.md`
  - `docs/4_payment_methods.md`
  - `docs/5_charges.md`
  - `docs/6_subscriptions.md`
  - `docs/7_webhooks.md`
- Sequelize + Express production hardening: `docs/sequelize-express-production-hardening.md`

## Validation checklist

- `bun test`
- `bun run test:integration`
- `bun run test:example-app`
- `bun run test:runtime`
