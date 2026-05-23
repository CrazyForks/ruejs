---
name: flags
description: Use when you need to inspect Rue compile-time defines, build flags, or format-specific injected constants.
---

# Rue Build Flags

Arguments:

- $ARGUMENTS: Optional flag name or package / script hint

Rue has no central `pnpm flags` command. Inspect flags by reading the define declarations and their build-time injection points.

## Primary Files

| File                              | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `packages/global.d.ts`            | Source of truth for declared compile-time globals |
| `scripts/vite-package-builder.js` | Production build define values                    |
| `vite.config.ts`                  | Dev/test define values                            |

## Common Flags

- `__DEV__`
- `__TEST__`
- `__BROWSER__`
- `__GLOBAL__`
- `__ESM_BUNDLER__`
- `__ESM_BROWSER__`
- `__CJS__`
- `__SSR__`
- `__VERSION__`
- `__COMPAT__`
- `__FEATURE_*`

## Instructions

1. Look up the requested flag in `packages/global.d.ts`.
2. Check `scripts/vite-package-builder.js` to see which formats inject which value.
3. Check `vite.config.ts` if the question is about local dev or app behavior.
4. Search usages before changing the flag.
5. Explain whether the flag is compile-time only, build-format specific, or shared across dev/test and build.

## Common Mistakes

- Assuming React release channels or `__VARIANT__` behavior exist here
- Changing the declaration without changing the injected define value
- Treating compile-time globals as runtime toggles
