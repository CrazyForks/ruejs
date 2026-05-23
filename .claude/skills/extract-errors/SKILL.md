---
name: extract-errors
description: Use when diagnosing Rue runtime errors, decoding Vapor/Wasm trap stacks, or updating production error reference docs.
---

# Rue Error Diagnostics

Arguments:

- $ARGUMENTS: Optional stack text, stack file path, or short error description

## When to Use

- `RuntimeError: unreachable` from Rue Vapor / Wasm
- `RueWasmTrapError` diagnostics
- production error code or error reference updates
- when the user wants to map wasm offsets back to Rust source

## Instructions

1. Inspect the existing diagnostic path first:
   - `packages/runtime/src/hooks/useError.ts`
   - nearby tests such as `packages/runtime/__tests__/useError.browser.spec.ts`
2. If the stack contains wasm offsets like `0x2547b`, decode them with one of:
   - `pnpm run runtime-vapor-addr2line -- 0x2547b 0x39e4b`
   - `pnpm run runtime-vapor-addr2line -- --stack "<stack text>"`
   - `pnpm run runtime-vapor-addr2line -- --stack-file ./stack.txt`
3. If the issue is about production error docs, inspect `docs/error-reference/index.md` and the data source used by that page.
4. Report the decoded frames, the likely owning package, and the next source files to inspect.

## Requirements

- `wasm-tools` is required for `runtime-vapor-addr2line`
- The wasm stack must match the current `packages/runtime-vapor/pkg/*.wasm` build

## Common Mistakes

- Assuming React's `extract-errors` workflow exists in this repo
- Decoding offsets against a stale wasm build
- Editing generated `dist` output instead of runtime source or docs
