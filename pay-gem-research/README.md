# Pay Gem Research for Solidus

This directory captures research used to create a PRD for porting the Ruby `pay` gem into a Node/Bun/Deno-focused library (`solidus`) with:

- Provider: Stripe only
- Backend: Express only
- ORM: sequelize-typescript only

## Files

- `stripe-feature-inventory.md` - Stripe capability inventory from Pay docs + code.
- `stripe-webhook-map.md` - Detailed webhook event/handler mapping and side effects.
- `rails-to-node-porting-notes.md` - Rails-to-TypeScript architecture translation decisions.
- `solidus-prd.md` - Execution-ready PRD with milestones, tasks, and subtasks.

## Primary source repositories and docs

- Pay clone: `/Users/diego/Developer/clones/pay`
- Core docs used:
  - `/Users/diego/Developer/clones/pay/docs/stripe/1_overview.md`
  - `/Users/diego/Developer/clones/pay/docs/stripe/5_webhooks.md`
  - `/Users/diego/Developer/clones/pay/docs/6_subscriptions.md`
  - `/Users/diego/Developer/clones/pay/docs/7_webhooks.md`
- Core code used:
  - `/Users/diego/Developer/clones/pay/lib/pay/stripe.rb`
  - `/Users/diego/Developer/clones/pay/app/models/pay/stripe/customer.rb`
  - `/Users/diego/Developer/clones/pay/app/models/pay/stripe/subscription.rb`
  - `/Users/diego/Developer/clones/pay/app/controllers/pay/webhooks/stripe_controller.rb`

## External references used

- Stripe Node webhook signature verification via raw body (`constructEvent`) from Context7 on `/stripe/stripe-node`.
- Express middleware ordering and route-scoped middleware from Context7 on `/expressjs/express`.
- sequelize-typescript model/association patterns from Context7 on `/sequelize/sequelize-typescript`.
- Runtime compatibility confirmation references:
  - Bun Express compatibility docs: `https://bun.com/docs/guides/ecosystem/express`
  - Deno Node/npm compatibility docs: `https://docs.deno.com/runtime/fundamentals/node/`
