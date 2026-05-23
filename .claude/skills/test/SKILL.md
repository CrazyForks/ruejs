---
name: test
description: Use when you need to run Rue tests. Supports unit, e2e, full, watch, and coverage workflows.
---

Run tests for the Rue codebase.

Arguments:

- $ARGUMENTS: Mode and optional Vitest pattern

Usage Examples:

- `/test unit useError`
- `/test e2e router`
- `/test watch renderable-normalize`
- `/test coverage signal`
- `/test full`

Modes:

- `(default)` or `unit` - Fastest focused path for most source changes
- `e2e` - Browser / app integration coverage
- `full` or `all` - Full test suite plus compat cleanup precheck
- `watch` - Watch mode for TDD
- `coverage` - Unit coverage run

Instructions:

1. Parse the first token as the mode. Treat the rest as the test pattern.
2. Map to commands:
   - `(default)` / `unit` → `pnpm run test-unit -- <pattern>`
   - `e2e` → `pnpm run test-e2e -- <pattern>`
   - `full` / `all` → `pnpm run test -- <pattern>`
   - `watch` → `pnpm run test-unit-watch -- <pattern>`
   - `coverage` → `pnpm run test-coverage-unit -- <pattern>`
3. If no pattern is provided, prefer the narrowest mode that still validates the touched area.
4. Report the failing files, assertions, and likely owning package.

Hard Rules:

1. Prefer `unit` unless the change clearly needs `e2e` or the full suite.
2. Avoid running the full suite without a reason; it is slower and noisier.

Common Mistakes:

- Running `full` when a unit pattern would have been enough
- Forgetting that `test-e2e` builds Rue global output first
- Assuming React release channels or `www` variants exist in this repo
