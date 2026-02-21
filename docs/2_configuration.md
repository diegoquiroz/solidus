# Configuring Solidus

Solidus needs Stripe credentials and webhook configuration.

## Required environment variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Common optional variables in app integrations:

- `BILLING_CHECKOUT_SUCCESS_URL`
- `BILLING_CHECKOUT_CANCEL_URL`
- `BILLING_PLANS_CACHE_TTL_SECONDS`

## Webhook mode policy

Use mode policy to prevent test-mode events in production:

```ts
eventModePolicy: {
  allowLiveEvents: true,
  allowTestEvents: process.env.NODE_ENV !== "production",
}
```

## App-level configuration tips

- Keep webhook secrets rotatable (array support).
- Mount webhook router before global `express.json()`.
- Use DB-backed outbox drainers in production workers.

## Next

See [Customers](3_customers.md).
