---
name: feature-flags
description: Use when adding or updating Rue compile-time feature flags, build defines, or compatibility switches.
---

# Rue Compile-Time Feature Flags

Rue does not use React-style release channels, `@gate` pragmas, or `__VARIANT__` forks. In this repo, "feature flags" usually means compile-time globals injected by the build.

## Flag Files

| File                              | Purpose                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `packages/global.d.ts`            | Declares compile-time globals such as `__DEV__`, `__COMPAT__`, and `__FEATURE_*` |
| `scripts/vite-package-builder.js` | Assigns define values for build formats                                          |
| `vite.config.ts`                  | Dev/test-side define values used by the app workspace                            |

## Known Feature Defines

- `__COMPAT__`
- `__FEATURE_PROD_DEVTOOLS__`
- `__FEATURE_SUSPENSE__`
- `__FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__`

## Adding or Changing a Flag

1. Add or update the declaration in `packages/global.d.ts`.
2. Add or update the corresponding define in `scripts/vite-package-builder.js`.
3. If dev/test behavior must match, update `vite.config.ts` too.
4. Search for usages and update guarded code paths plus tests.
5. If the change affects compat cleanup or public migration behavior, run `pnpm run check:compat-cleanup`.

## Debugging a Flagged Behavior

1. Confirm the flag is declared in `packages/global.d.ts`.
2. Confirm the build injects a value in `scripts/vite-package-builder.js`.
3. Check whether the dev server uses a different define in `vite.config.ts`.
4. Run the narrowest relevant test path with `/test`.

## Common Mistakes

- Inventing React-style fork files or `@gate` pragmas
- Changing `packages/global.d.ts` without changing the injected build define
- Forgetting that bundler builds may use placeholder replacements such as `__RUE_*__`
- Treating compile-time defines like runtime state that can be toggled in the browser
