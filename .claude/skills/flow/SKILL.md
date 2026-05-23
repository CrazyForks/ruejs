---
name: flow
description: Use when you need type checking in Rue. This repo uses TypeScript checking, not Flow.
---

# Rue Type Checking

Rue does not use Flow. Keep this skill as the type-check entry point, but route all checks through the repo's TypeScript workflow.

Arguments:

- $ARGUMENTS: Optional note about the package, path, or type problem

## Instructions

1. Run `pnpm run check` for the main repository type check.
2. If the issue involves declaration output or package publishing surfaces, run `pnpm run build-dts`.
3. Report type errors with file locations and the likely owning package.
4. If a failing type check is tied to tests, pair it with the narrowest relevant `/test` run.

## Common Mistakes

- Trying to run `yarn flow` in a TypeScript repo
- Looking for Flow suppressions like `$FlowFixMe`
- Editing generated `.d.ts` or `dist` output instead of source
