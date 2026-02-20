# Pay-style Webhooks

This guide covers persist-first Stripe webhook ingestion and Pay-style default effects.

## Copy-ready Express mount

```ts
app.use(
  "/solidus",
  createStripeWebhookRouter({
    express,
    stripe,
    webhookSecrets: [process.env.STRIPE_WEBHOOK_SECRET!],
    pipeline,
    routePath: "/webhooks/stripe",
  }),
);

app.use(express.json());
```

## Copy-ready default effects setup

```ts
const facade = createSolidusFacade({
  stripe,
  repositories,
  webhookRepositories,
  webhookRegistration: {
    enableDefaultEffects: true,
  },
});
```

## Migration callouts

- Keep webhook route mounted before `express.json()` or signature verification will fail.
- Default effects are additive and can be overridden without forking internals.
- Persist-first mode + idempotency repositories are required for safe replay and duplicate delivery handling.

## Related docs

- Event coverage matrix: `docs/stripe-webhook-coverage-matrix.md`
- Express webhook details and event mode policy: `docs/express-webhooks.md`
- Operations, retry, dead-letter, replay: `docs/webhook-operations-runbook.md`
- Checkout owner-linking behavior: `docs/getting-started.md`
- Stripe Connect account sync parity (`account.updated`): `docs/stripe-connect-parity-checklist.md`
- Rails portability caveats: `docs/not-portable-from-rails.md`
