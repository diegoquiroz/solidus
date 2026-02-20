# Sequelize + Express Production Hardening

This guide is the production path for Solidus deployments on Express + Sequelize.

## Deployment topology

- API tier: handles customer-facing requests and webhook ingestion.
- Database tier: stores projections, webhook event log, idempotency state, and outbox queue.
- Worker tier: drains outbox and performs async webhook processing.
- Optional replay job tier: controlled reprocessing for dead-letter recovery.

## Worker, retry, replay, and dead-letter policy

- Use `db-outbox` queue mode in production.
- Keep retry policy explicit (`maxAttempts`, `baseDelayMs`, `backoffMultiplier`, `maxDelayMs`).
- Mark max-attempt failures as dead-letter and alert on growth.
- Replay by event ID after root-cause fix; avoid broad blind replays.
- Track `webhook.process.transition.count` and `webhook.lag.ms` until backlog returns to baseline.

## Secret rotation

- Configure both old and new webhook secrets during rotation windows.
- Confirm verification success across both keys before removing old key.
- If signature failures rise, roll back by restoring the previous secret immediately.

## Live/test policy

- Keep `allowLiveEvents: true` in production.
- Set `allowTestEvents: false` in production unless your endpoint is explicitly mixed-mode.
- Run test traffic through separate endpoints when possible.

## Rollback toggles

- Feature toggle writes between legacy Stripe wrappers and Solidus facade methods.
- Toggle default webhook effects (`enableDefaultEffects`) if a faulty effect path needs isolation.
- Pause replay workers while triaging dead-letter spikes.
- Keep dual-secret config toggleable for emergency signature rollback.

## Incident checklist

- Confirm webhook route mount order (`createStripeWebhookRouter` before `express.json()`).
- Verify Stripe event delivery and required event subscriptions.
- Check retrying/dead-letter counts and oldest lag from diagnostics.
- Group failures by event type and error signature before replaying.
- Replay only affected events and observe transition metrics.

## Related docs

- Webhook operations runbook: `docs/webhook-operations-runbook.md`
- Express webhook integration details: `docs/express-webhooks.md`
- Canonical setup path: `docs/getting-started.md`
- Rails non-portable caveats: `docs/not-portable-from-rails.md`
