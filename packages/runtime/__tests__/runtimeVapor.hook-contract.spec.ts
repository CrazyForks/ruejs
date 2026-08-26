import { describe, expect, it } from 'vitest'

import * as rustRuntime from '@rue-js/runtime-vapor/vapor'

import {
  createRuntimeVaporBackend,
  exerciseHookEffectScheduling,
  exerciseHookSlots,
  exerciseStableHookIds,
  type RuntimeVaporHookModule,
} from './runtimeVapor.backend-test-utils'

const backends = [
  createRuntimeVaporBackend('current Rust/Wasm backend', rustRuntime as RuntimeVaporHookModule),
]

describe.each(backends)('runtime-vapor Hook contract: $label', backend => {
  it('keeps stateful slots stable and only recomputes dependency-bound values', () => {
    expect(exerciseHookSlots(backend)).toEqual({
      currentInstanceMatches: [true, true, true],
      currentInstanceRestored: true,
      refStable: true,
      refValue: 'persisted',
      memoStableForEqualDeps: true,
      memoChangesWithDeps: true,
      memoRuns: 2,
      setupStable: true,
      setupRuns: 1,
      signalStable: true,
      signalValue: 2,
      slotCount: 4,
    })
  })

  it('keeps compiler-provided Hook ids stable when call order changes', () => {
    expect(exerciseStableHookIds(backend)).toEqual({
      alphaStable: true,
      betaStable: true,
      values: ['alpha', 'beta'],
      slotCount: 2,
    })
  })

  it('runs cleanup before a scheduled rerun and again when the host is disposed', () => {
    expect(exerciseHookEffectScheduling(backend)).toEqual({
      initial: { runs: 1, cleanups: 0, queued: 0 },
      scheduled: { runs: 1, cleanups: 0, queued: 1 },
      flushed: { runs: 2, cleanups: 1, queued: 0 },
      disposed: { runs: 2, cleanups: 2, queued: 0 },
    })
  })
})
