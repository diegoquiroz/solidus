# Release Manual (No Auto Publish)

This document explains how to produce a manual Solidus release when you are ready.

## Versioning policy

- Use SemVer.
- Before `1.0.0`, treat minor versions as feature delivery and patch versions as fixes/docs/tests.
- Keep public exports from `index.ts` and `packages/**/index.ts` backwards compatible unless a planned breaking release is announced.
- Record breaking changes in upgrade notes before publishing.

## Pre-release checklist

1. Ensure milestone task docs are up to date in `pay-gem-research/tasks/`.
2. Run required quality gates:
   - `bun run lint`
   - `bun run typecheck`
   - `bun test`
   - `bun run test:integration`
   - `bun run test:runtime`
3. Confirm docs are current:
   - `docs/runtime-compatibility.md`
   - `docs/express-webhooks.md`
   - `docs/webhook-operations-runbook.md`
   - `docs/migration-from-ad-hoc-stripe.md`

## Manual release steps

1. Decide version bump and update `package.json`.
2. Create release notes summarizing:
   - customer-facing API changes
   - migration steps
   - observability/runtime caveats
   - start from `docs/release-notes-and-upgrade-guide.md`
3. Create and push a git tag:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
4. Publish package manually (when approved):
   - `bun publish --access public`
5. Create GitHub release notes from tag and include upgrade guidance.

## Rollback guidance

- If a bad release is published, publish a follow-up patch with fix-forward changes.
- If migration issues appear, follow `docs/migration-from-ad-hoc-stripe.md` rollback toggle guidance.

## Notes for this milestone

- US-003 implementation prepared docs and workflow prerequisites.
- No package publish was executed as part of this milestone pass.
