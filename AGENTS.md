# AGENTS.md

Guidance for coding agents working in this repository.

## Project Purpose

- This project exists to mirror the Rails `pay` gem behavior and patterns as closely as possible, adapted to this TypeScript/Bun codebase.
- When making product or architecture decisions, prefer `pay`-compatible semantics over local invention unless the task explicitly calls for divergence.
- Keep model semantics aligned with `pay`: owner identity lives in owner fields, processor identity lives in processor fields, and surrogate row IDs should stay opaque/non-semantic.
- If a behavior differs from `pay`, document the rationale in tests or PR descriptions so the divergence is intentional and reviewable.

## Project Snapshot

- Runtime/package manager: Bun.
- Language: TypeScript with strict mode enabled.
- Public entrypoint: `index.ts` re-exporting package modules.
- Source of truth lives under `src/packages/**`.
- Thin compatibility exports live under `packages/**/index.ts`.

## Agent Priorities

- Keep changes minimal and local.
- Reuse existing patterns before introducing new abstractions.
- Preserve existing API shapes unless the task explicitly requires a breaking change.
- Prefer clarity over cleverness.

## Cursor / Copilot Rules

Checked in this repo:

- Cursor rules found: `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`.
- `.cursorrules` file: not present.
- `.github/copilot-instructions.md`: not present.

Required behavior from Cursor rule:

- Use Bun instead of Node/npm/pnpm/yarn/vite tooling.
- Prefer `bun <file>` over `node <file>`.
- Prefer `bun install` for dependencies.
- Prefer `bun test` for tests.
- Prefer `bun run <script>` for package scripts.
- Prefer `bunx <pkg> <cmd>` over `npx`.
- Bun loads `.env` automatically; do not add `dotenv` unless explicitly required.

## Setup And Core Commands

- Install deps: `bun install`
- Run package entrypoint: `bun run index.ts`
- Typecheck: `bun run typecheck`
- Lint (same as typecheck in this repo): `bun run lint`
- Generate docs: `bun run docs:core`

No dedicated build script currently exists in `package.json`.
If a task needs bundling, align with Bun tooling and existing repo conventions.

## Test Commands

Run all tests:

- `bun test`

Run tests matching a filename/pattern:

- `bun test registration.test.ts`
- `bun test packages/sequelize/test/m1-foundation-data-model.artifacts.test.ts`

Run a single test by name regex:

- `bun test --test-name-pattern "normalizes client reference ids"`
- `bun test src/packages/core/__tests__/registration.test.ts --test-name-pattern "fails when multiple defaults"`

Useful test flags:

- Fail fast: `bun test --bail`
- Rerun flaky suites: `bun test --rerun-each 5`
- Coverage: `bun test --coverage`

## Repository Map

- `index.ts`: top-level re-exports.
- `src/packages/core/**`: domain contracts, errors, registration helpers.
- `src/packages/{stripe,express,facade,sequelize}/index.ts`: package adapters/placeholders.
- `packages/**`: re-export surface and Sequelize migration/schema artifacts.
- `scripts/generate-core-api-docs.ts`: docs generator writing to `docs/core-contracts.api.md`.

## Style Guidelines

### Imports And Exports

- Use ESM imports/exports only.
- In `src/**`, prefer explicit `.ts` extensions for local imports.
- Use `import type` for type-only imports.
- Keep import groups compact: external first, then internal.
- Re-export through package `index.ts` files to preserve public API boundaries.

### TypeScript And Types

- Maintain strict typing (`tsconfig.json` has `strict: true`).
- Prefer explicit interfaces/types for public contracts.
- Use generics where they preserve API intent (see registry contracts).
- Avoid `any`; use `unknown` plus narrowing when type is uncertain.
- Encode constrained values with literal unions when practical.
- Keep optional fields intentionally optional (`?`) rather than nullable unless both states are meaningful.

### Naming Conventions

- Types/interfaces/classes: `PascalCase`.
- Functions/variables/methods: `camelCase`.
- Constants that are truly constant values: `camelCase` in this codebase unless external conventions require otherwise.
- Test descriptions should be explicit behavior statements.
- Error codes are uppercase underscore strings (e.g. `CONFIGURATION_ERROR`).

### Formatting And Layout

- Follow existing file style; there is no repo formatter config.
- Use semicolons in TypeScript source under `src/**`.
- Prefer single responsibility functions over long procedural blocks.
- Keep line wrapping readable; break long argument lists onto multiple lines.
- Avoid unnecessary comments; code should be self-descriptive.

### Error Handling

- Prefer domain-specific errors from `src/packages/core/errors.ts`.
- Include actionable messages.
- Add structured `details` when it improves diagnostics.
- Preserve causal chains using `cause` when wrapping lower-level failures.
- Throw `ConfigurationError` for invalid setup/state.
- Throw `ActionRequiredError` for user/data remediation paths.
- Throw `IdempotencyConflictError` for duplicate reservation/registration semantics.

### Async And IO

- Use async/await consistently.
- Keep repository/adapter contracts Promise-based.
- For file operations in scripts, prefer Bun APIs (`Bun.file`, `Bun.write`, `Bun.$`).

### Testing Conventions

- Use Bun test APIs: `import { describe, test, expect } from "bun:test"`.
- Co-locate core tests under `src/packages/**/__tests__`.
- Keep tests behavior-focused and deterministic.
- Prefer small fakes over heavyweight mocks for contract tests.
- Assert both success paths and constraint/error behavior.

## Change Checklist For Agents

- Run `bun run typecheck` after TypeScript changes.
- Run targeted tests first, then `bun test` for broad impact.
- If contracts or exported APIs change, update docs via `bun run docs:core` when relevant.
- Keep `index.ts` and `packages/**/index.ts` re-exports aligned with new modules.
- Do not introduce Node/npm-specific tooling when Bun equivalents exist.

## Notes On Current Linting

- `lint` currently maps to TypeScript no-emit checks.
- There is no ESLint/Prettier config committed.
- Treat `bun run lint` and `bun run typecheck` as required quality gates.

## When In Doubt

- Mirror the nearest existing pattern in the same package.
- Prefer additive changes over broad refactors.
- Keep public API stable and typed.
- Leave concise rationale in PR descriptions when behavior changes.
