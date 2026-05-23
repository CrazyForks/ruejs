---
name: vapor-debug
description: Use when debugging Rue Vapor / Wasm failures, especially unreachable traps, stale wasm stacks, or runtime-vapor rendering issues.
---

# Rue Vapor Debug

Arguments:

- $ARGUMENTS: Optional stack text, address list, stack file path, or short runtime symptom

Use this skill when the issue points to `runtime-vapor`, Wasm stack traces, `RuntimeError: unreachable`, `RueWasmTrapError`, or Vapor-specific rendering failures.

## Primary Files

| File                                                                  | Purpose                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `scripts/runtime-vapor-addr2line.js`                                  | Decode wasm offsets back to source frames                      |
| `packages/runtime/src/hooks/useError.ts`                              | Rewrites raw unreachable traps into actionable Rue diagnostics |
| `packages/runtime/__tests__/useError.browser.spec.ts`                 | Browser-side expectations for Vapor trap reporting             |
| `packages/runtime/__tests__/runtimeVapor.unreachableBoundary.spec.ts` | Runtime-level unreachable trap handling                        |

## First Questions

1. Is the failure a raw `RuntimeError: unreachable` or already a `RueWasmTrapError`?
2. Does the stack contain wasm offsets like `0x2547b`?
3. Is the current wasm file the same build that produced the stack?
4. Did the issue start after changing compiled render output, props spreading, or pretransformed `rue-design` code?

## Instructions

1. Inspect the current diagnostic path in `packages/runtime/src/hooks/useError.ts`.
2. If the stack contains wasm offsets, decode them with one of:
   - `pnpm run runtime-vapor-addr2line -- 0x2547b 0x39e4b`
   - `pnpm run runtime-vapor-addr2line -- --stack "<stack text>"`
   - `pnpm run runtime-vapor-addr2line -- --stack-file ./stack.txt`
3. If addr2line reports no matching DWARF frames, rebuild or restart the relevant app/runtime flow and reproduce the stack against the fresh wasm file.
4. If the error matches the common unreachable trap case, check whether compiled render code mutated a props-derived or computed object during render.
5. If the issue came from pretransformed `rue-design` source, check whether `/* RUE_VAPOR_TRANSFORMED */` is missing and causing double Vapor transforms.
6. Validate with the narrowest relevant test or reproduction path after the suspected fix.

## Requirements

- `wasm-tools` must be installed for addr2line support
- the decoded stack must match the current `packages/runtime-vapor/pkg/*.wasm` build

## Common Mistakes

- Debugging with a stale wasm artifact
- Treating `RueWasmTrapError` as the root cause instead of the rewritten diagnostic shell
- Editing generated wasm or `pkg` output instead of source Rust / TS code
- Missing the common props mutation case in compiled render code
