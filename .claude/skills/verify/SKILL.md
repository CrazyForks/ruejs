---
name: verify
description: Use when you want to validate Rue changes before finishing, especially across lint, typecheck, tests, and compat cleanup.
---

# Rue Verification

Run the validation steps that match the touched area.

Arguments:

- $ARGUMENTS: Optional test mode and pattern hint

## Instructions

Run these first in sequence:

1. Run `pnpm run format-check`.
2. Run `pnpm run oxlint`.
3. Use `/flow` for the repo type check.

Then run the narrowest relevant test command:

1. Use `/test unit <pattern>` for most runtime / package source changes.
2. Use `/test e2e <pattern>` when app, router, or browser integration behavior changed.
3. Use `/test full <pattern>` only when changes cross multiple packages or verification needs to match CI breadth.

Additional checks when relevant:

1. Run `pnpm run check:compat-cleanup` if the change touches compat removals, historical render helpers, docs migration text, or package exports.
2. Run `pnpm run release-check` for release or packaging work.

If all pass, show a concise success summary. On failure, stop immediately and report the first blocking issue with suggested next steps.
