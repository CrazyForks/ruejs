---
name: fix
description: Use when Rue code has lint or formatting issues, or when you want a quick pre-commit cleanup pass.
---

# Rue Lint and Formatting

## Instructions

1. Run `pnpm run oxlint-fix` to apply safe lint fixes.
2. Run `pnpm run format` to normalize formatting.
3. Run `pnpm run oxlint` to confirm no lint issues remain.
4. If the touched files are TypeScript-heavy, follow with `pnpm run check`.
5. Report any remaining manual fixes needed.

## Common Mistakes

- Assuming this repo uses Prettier or `yarn linc`
- Stopping after auto-fix without re-running lint
- Editing generated `dist` or `pkg` output instead of source files
