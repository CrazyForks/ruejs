---
name: compat-cleanup
description: Use when migrating away from legacy compat helpers, checking for removed compat symbols, or validating Renderable-first cleanup work in Rue.
---

# Rue Compat Cleanup

Arguments:

- $ARGUMENTS: Optional path, package name, or migration note

Use this skill when the task touches legacy compat helpers, old virtual-dom terminology, migration docs, package exports, or any work that should no longer rely on removed compat paths.

## What This Checks

The repository already has a dedicated cleanup script:

- `pnpm run check:compat-cleanup`

It scans `packages`, `docs`, and `app` for forbidden leftovers such as:

- removed compat imports like `@rue-js/runtime/compat` and `@rue-js/rue/compat`
- removed helpers like `renderCompat`, `renderBetweenCompat`, `renderAnchorCompat`, `renderStaticCompat`
- removed vnode-era symbols like `RueVNodeHandle`, `__rue_vnode_id`, `vnodeLike`
- legacy wording such as `VNode` or `虚拟 DOM`

## Primary Files

| File                                         | Purpose                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| `scripts/check-compat-cleanup.js`            | Central cleanup rule set                                |
| `docs/about/compat-policy.md`                | Policy for removed compat APIs                          |
| `docs/guide/migration/renderable-default.md` | Migration guidance toward default Renderable-first path |

## Instructions

1. Run `pnpm run check:compat-cleanup`.
2. If it fails, group findings by category:
   - removed compat import or export
   - legacy helper name
   - old virtual-dom terminology
3. Fix source files first, not generated output.
4. If docs are involved, align them with the current policy: compat paths are removed, not renamed.
5. Report the exact leftover symbols and the migration direction that should replace them.

## Common Migration Direction

- Remove explicit compat subpath imports entirely.
- Rewrite old render-function or vnode-era helpers to the default Renderable / children / raw node path.
- Avoid introducing new compatibility shells around already-removed APIs.

## Common Mistakes

- Treating compat as a temporary alias that still exists
- Updating docs but forgetting package exports or tests
- Editing `dist`, `pkg`, or generated output instead of source
- Replacing one removed compat helper with another historical alias
