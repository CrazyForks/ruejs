// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { createValueHooks } from '../../runtime-vapor/src/js-reactive/hooks/values'
import { ReactiveEffectRuntime, createEffect } from '../../runtime-vapor/src/reactive-kernel/effect'
import {
  createCustomRef,
  createReactive,
  createRef,
  isProxy as kernelIsProxy,
  isReactive as kernelIsReactive,
  isReadonly as kernelIsReadonly,
  isRef as kernelIsRef,
  toRaw as kernelToRaw,
  triggerRef as kernelTriggerRef,
} from '../../runtime-vapor/src/reactive-kernel/reactive'
import { createSignal } from '../../runtime-vapor/src/reactive-kernel/signal'
import {
  expectKernelScenarioParity,
  createReactiveKernelReference,
} from './runtimeVapor.ts-kernel-test-utils'

type SignalPath = string | readonly (string | number)[]

interface PathSignal<T> {
  get(): T
  getPath(path: SignalPath): unknown
  peek(): T
  peekPath(path: SignalPath): unknown
  set(value: T): void
  setPath(path: SignalPath, value: unknown): void
  triggerPath(path: SignalPath): void
  updatePath(path: SignalPath, updater: (current: unknown) => unknown): void
}

interface ScenarioProxyMetadata {
  readonly __isReactive__: boolean
  readonly __isReadonly__: boolean
  readonly __rue_path__: readonly PropertyKey[]
  readonly __rue_target__: unknown
  toJSON(): unknown
}

type ScenarioReactive<T> = T extends object ? T & ScenarioProxyMetadata : T

interface ScenarioCustomRefDefinition<T> {
  get?(this: ScenarioCustomRefDefinition<T>): T
  set?(this: ScenarioCustomRefDefinition<T>, value: T): void
  [key: PropertyKey]: unknown
}

interface ScenarioKernel {
  createCustomRef<T>(
    factory: (
      track: () => void,
      trigger: () => void,
    ) => ScenarioCustomRefDefinition<T> | null | undefined,
  ): { value: T }
  createEffect(callback: () => void): { dispose(): void }
  createReactive<T>(
    initial: T,
    options?: { readonly?: boolean; shallow?: boolean },
  ): T extends object ? ScenarioReactive<T> : { value: T }
  createRef<T>(initial: T): { value: T }
  createSignal<T>(initial: T): PathSignal<T>
  setReactiveScheduling(mode: 'sync' | 'microtask' | 'frame'): void
}

const createTypeScriptKernel = (): { kernel: ScenarioKernel; runtime: ReactiveEffectRuntime } => {
  const runtime = new ReactiveEffectRuntime()
  return {
    kernel: {
      createCustomRef: factory => createCustomRef(runtime, factory),
      createEffect: callback => createEffect(runtime, callback),
      createReactive: (initial, options) => createReactive(runtime, initial, options) as never,
      createRef: initial => createRef(runtime, initial),
      createSignal: initial => createSignal(runtime, initial),
      setReactiveScheduling: mode => runtime.setScheduling(mode),
    },
    runtime,
  }
}

const referenceKernel = createReactiveKernelReference() as unknown as ScenarioKernel

const runPathScenario = (kernel: ScenarioKernel): Record<string, unknown> => {
  kernel.setReactiveScheduling('sync')
  const signal = kernel.createSignal({
    left: { count: 1 },
    right: { count: 2 },
    items: ['a'],
  })
  const hits = { left: 0, right: 0, root: 0 }
  const effects = [
    kernel.createEffect(() => {
      hits.left += 1
      signal.getPath('left.count')
    }),
    kernel.createEffect(() => {
      hits.right += 1
      signal.getPath(['right', 'count'])
    }),
    kernel.createEffect(() => {
      hits.root += 1
      signal.get()
    }),
  ]

  signal.setPath('left.count', 3)
  const immutableRoot = signal.peek()
  signal.updatePath('items.0', current => `${String(current)}!`)
  signal.setPath('items.2.label', 'new')
  signal.triggerPath('right.count')

  for (const effect of effects) effect.dispose()
  return {
    hits,
    immutableLeft: immutableRoot.left.count,
    item0: signal.peekPath(['items', 0]),
    item2: signal.peekPath('items.2.label'),
    rootViaEmpty: signal.peekPath(''),
  }
}

const runProxyScenario = (kernel: ScenarioKernel): Record<string, unknown> => {
  kernel.setReactiveScheduling('sync')
  const state = kernel.createReactive({
    left: { count: 1 },
    right: { count: 2 },
    items: [{ label: 'A' }],
  })
  let leftHits = 0
  let rightHits = 0
  const left = kernel.createEffect(() => {
    leftHits += 1
    void state.left.count
  })
  const right = kernel.createEffect(() => {
    rightHits += 1
    void state.right.count
  })
  const first = state.items[0]
  const identityIndex = state.items.indexOf(first)
  state.left.count = 10
  state.items.push({ label: 'B' })
  state.items.splice(0, 1)
  left.dispose()
  right.dispose()

  const primitive = kernel.createReactive('A')
  primitive.value = 'B'
  const readonly = kernel.createReactive({ values: ['b', 'a'] }, { readonly: true })
  const readonlyWrite = Reflect.set(readonly, 'extra', true)
  readonly.values.sort()

  return {
    identityIndex,
    leftHits,
    primitiveKeys: Reflect.ownKeys(primitive),
    primitiveValue: primitive.value,
    readonlyRaw: Reflect.get(readonly, '__rue_raw__'),
    readonlyWrite,
    rightHits,
    stateRaw: Reflect.get(state, '__rue_raw__'),
  }
}

describe('runtime-vapor TypeScript Signal paths', () => {
  it('matches an isolated kernel reference for immutable path writes and explicit triggers', () => {
    const candidate = runPathScenario(createTypeScriptKernel().kernel)
    const oracle = runPathScenario(referenceKernel)

    expectKernelScenarioParity(candidate, oracle, result => {
      const record = result as Record<string, unknown>
      expect(record.hits).toEqual({ left: 2, right: 2, root: 5 })
      expect(record.immutableLeft).toBe(3)
      expect(record.item0).toBe('a!')
      expect(record.item2).toBe('new')
    })
  })

  it('normalizes numeric string segments, treats empty paths as root, and tolerates missing values', () => {
    const { kernel } = createTypeScriptKernel()
    const signal = kernel.createSignal<unknown>({ items: ['a'] })

    expect(signal.getPath('items.0')).toBe('a')
    expect(signal.peekPath('items..0')).toBe('a')
    expect(signal.peekPath('missing.child')).toBeUndefined()
    signal.setPath('', { replaced: true })
    expect(signal.peek()).toEqual({ replaced: true })
    signal.setPath('items.2', 'extended')
    expect(signal.peekPath(['items', 2])).toBe('extended')
  })

  it('keeps unrelated path subscribers cold while deduping root and path subscriptions', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const signal = kernel.createSignal({ branch: { leaf: 1 }, sibling: 2 })
    let branchHits = 0
    let siblingHits = 0
    let duplicateHits = 0
    kernel.createEffect(() => {
      branchHits += 1
      signal.getPath('branch.leaf')
    })
    kernel.createEffect(() => {
      siblingHits += 1
      signal.getPath('sibling')
    })
    kernel.createEffect(() => {
      duplicateHits += 1
      signal.get()
      signal.getPath('branch.leaf')
    })

    signal.setPath('branch.leaf', 2)
    expect({ branchHits, duplicateHits, siblingHits }).toEqual({
      branchHits: 2,
      duplicateHits: 2,
      siblingHits: 1,
    })
  })
})

describe('runtime-vapor TypeScript Reactive Proxy', () => {
  it('matches an isolated kernel reference for nested branches, arrays and readonly behavior', () => {
    const candidate = runProxyScenario(createTypeScriptKernel().kernel)
    const oracle = runProxyScenario(referenceKernel)

    expectKernelScenarioParity(candidate, oracle, result => {
      const record = result as Record<string, unknown>
      expect(record.identityIndex).toBe(0)
      expect(record.leftHits).toBe(2)
      expect(record.rightHits).toBe(1)
      expect(record.primitiveKeys).toEqual([])
      expect(record.primitiveValue).toBe('B')
      expect(record.readonlyWrite).toBe(false)
    })
  })

  it('updates nested objects and array indexes without rerunning sibling consumers', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const state = kernel.createReactive({ user: { name: 'A' }, items: ['x', 'y'], other: 1 })
    let nestedHits = 0
    let arrayHits = 0
    let otherHits = 0
    kernel.createEffect(() => {
      nestedHits += 1
      void state.user.name
    })
    kernel.createEffect(() => {
      arrayHits += 1
      void state.items[0]
    })
    kernel.createEffect(() => {
      otherHits += 1
      void state.other
    })

    state.user.name = 'B'
    state.items[0] = 'z'
    expect({ arrayHits, nestedHits, otherHits }).toEqual({
      arrayHits: 2,
      nestedHits: 2,
      otherHits: 1,
    })
  })

  it('mirrors ownKeys, descriptors, stale children, and array length without Proxy invariant errors', () => {
    const { kernel } = createTypeScriptKernel()
    const state = kernel.createReactive({ child: { name: 'A' }, items: ['x', 'y'] })
    const child = state.child
    const items = state.items

    Reflect.set(state, 'extra', true)
    expect(Reflect.ownKeys(state)).toEqual(['child', 'items', 'extra'])
    expect(Object.getOwnPropertyDescriptor(state, 'extra')?.configurable).toBe(true)
    expect(Object.getOwnPropertyDescriptor(items, '0')?.configurable).toBe(true)
    expect(Object.getOwnPropertyDescriptor(items, 'length')?.configurable).toBe(false)
    expect(Reflect.ownKeys(items)).toContain('length')
    expect(Object.keys(items)).toEqual(['0', '1'])

    state.child = null as unknown as { name: string }
    expect(() => Reflect.ownKeys(child)).not.toThrow()
    expect(Reflect.ownKeys(child)).toEqual([])
    expect(Object.getOwnPropertyDescriptor(child, 'name')).toBeUndefined()

    const signal = Reflect.get(items, '__signal__') as PathSignal<unknown>
    signal.set({})
    expect(() => Reflect.ownKeys(items)).not.toThrow()
    expect(Reflect.ownKeys(items)).toContain('length')
  })

  it('returns equivalent nested proxies and unwraps proxy arguments for array identity methods', () => {
    const { kernel } = createTypeScriptKernel()
    const state = kernel.createReactive({ items: [{ label: 'A' }] })

    expect(state.items).not.toBe(state.items)
    expect(state.items[0]).not.toBe(state.items[0])
    expect(state.items.indexOf(state.items[0])).toBe(0)
    state.items.push(state.items[0])
    expect(Reflect.get(state, '__rue_raw__').items[1]).toBe(
      Reflect.get(state.items[0], '__rue_raw__'),
    )
  })

  it('writes array mutators immutably, tracks JSON.stringify, and survives proxy self-assignment', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const state = kernel.createReactive({ items: [{ label: 'A' }] })
    let json = ''
    let hits = 0
    kernel.createEffect(() => {
      hits += 1
      json = JSON.stringify(state.items)
    })

    const items = state.items
    state.items = items
    items.push({ label: 'B' })
    expect(items.splice(0, 1)).toHaveLength(1)
    expect(hits).toBeGreaterThanOrEqual(3)
    expect(json).toContain('B')
    expect(Reflect.get(state, '__rue_raw__').items).toHaveLength(1)
    expect(Reflect.ownKeys(items)).toContain('length')
    expect(() => Object.keys(items)).not.toThrow()
  })

  it('exposes primitive and nested metadata helpers without enumerating primitive value', () => {
    const { kernel } = createTypeScriptKernel()
    const primitive = kernel.createReactive('A')
    expect(Reflect.ownKeys(primitive)).toEqual([])
    primitive.value = 'B'
    expect(primitive.value).toBe('B')
    expect(Reflect.ownKeys(primitive)).toEqual([])

    const state = kernel.createReactive({ value: { nested: 'A' } })
    const value = state.value as typeof state.value & ScenarioProxyMetadata
    expect(value.__isReactive__).toBe(true)
    expect(value.__isReadonly__).toBe(false)
    expect(value.__rue_path__).toEqual(['value'])
    expect(value.__rue_target__).toEqual({ nested: 'A' })
    expect(value.toJSON()).toEqual({ nested: 'A' })
    expect(value.valueOf()).toEqual({ nested: 'A' })
    expect(value.toString()).toContain('nested')
  })

  it('reads primitive value accessors from the latest signal holder shape', () => {
    const { kernel } = createTypeScriptKernel()
    const primitive = kernel.createReactive('first')
    const signal = Reflect.get(primitive, '__signal__') as PathSignal<unknown>

    expect(primitive.value).toBe('first')
    signal.set('plain')
    expect(primitive.value).toBeUndefined()
    signal.set({ value: 'wrapped' })
    expect(primitive.value).toBe('wrapped')
  })

  it('binds methods to the latest raw holder and leaves function-valued properties callable', () => {
    const { kernel } = createTypeScriptKernel()
    const state = kernel.createReactive({
      x: 1,
      getX(this: { x: number }) {
        return this.x
      },
      callback: (value: number) => value + 1,
    })
    const getX = state.getX as () => number

    expect(getX()).toBe(1)
    state.x = 2
    expect(getX()).toBe(2)
    expect(state.callback(2)).toBe(3)
  })

  it('blocks deep readonly writes and runs all readonly array mutations on copies', () => {
    const { kernel } = createTypeScriptKernel()
    const state = kernel.createReactive({ items: ['b', 'a', 'c'] }, { readonly: true })
    const items = state.items
    const before = [...Reflect.get(state, '__rue_raw__').items]

    expect(Reflect.set(state, 'extra', true)).toBe(false)
    expect(Reflect.set(items, 0, 'z')).toBe(false)
    items.push('d')
    items.pop()
    items.shift()
    items.unshift('e')
    items.sort()
    items.reverse()
    items.fill('x')
    items.copyWithin(0, 1)

    expect(Reflect.get(state, '__rue_raw__').items).toEqual(before)
    expect(state.__isReadonly__).toBe(true)
  })

  it('keeps readonly TypedArray buffers unchanged across mutators and derived subarrays', () => {
    const { kernel } = createTypeScriptKernel()
    const state = kernel.createReactive({ buf: new Uint8Array([3, 1, 2, 4]) }, { readonly: true })
    const buf = state.buf

    buf.fill(9)
    buf.copyWithin(0, 1)
    buf.sort()
    buf.reverse()
    buf.set(new Uint8Array([9, 8]), 1)
    buf.subarray(1, 3).set(new Uint8Array([7, 6]))

    expect(Array.from(Reflect.get(state, '__rue_raw__').buf)).toEqual([3, 1, 2, 4])
  })

  it('distinguishes shallow writable and shallow readonly child behavior', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const shallow = kernel.createReactive({ child: { name: 'A' } }, { shallow: true })
    const shallowReadonly = kernel.createReactive(
      { child: { name: 'A' } },
      { readonly: true, shallow: true },
    )
    let hits = 0
    kernel.createEffect(() => {
      hits += 1
      void shallow.child.name
    })

    expect(Reflect.get(shallow.child, '__isReactive__')).toBeUndefined()
    shallow.child.name = 'B'
    expect(hits).toBe(1)
    expect(Reflect.set(shallowReadonly, 'child', { name: 'B' })).toBe(false)
    shallowReadonly.child.name = 'C'
    expect(shallowReadonly.child.name).toBe('C')
  })
})

describe('runtime-vapor TypeScript Ref family and value Hooks', () => {
  it('supports primitive, array, object, nested object, and nested array ref values', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const primitive = kernel.createRef(1)
    primitive.value = 2
    expect(primitive.value).toBe(2)

    const array = kernel.createRef([1, 2])
    expect(array.value).toEqual([1, 2])
    array.value = []
    expect(array.value).toEqual([])

    const object = kernel.createRef({ user: { name: 'A' }, items: ['x'] })
    let nestedHits = 0
    let arrayHits = 0
    kernel.createEffect(() => {
      nestedHits += 1
      void object.value.user.name
    })
    kernel.createEffect(() => {
      arrayHits += 1
      void object.value.items[0]
    })
    object.value.user.name = 'B'
    object.value.items[0] = 'z'
    expect({ arrayHits, nestedHits }).toEqual({ arrayHits: 2, nestedHits: 2 })
  })

  it('tracks and triggers custom refs only when the factory requests it', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    let value = 1
    let manualTrigger: () => void = () => undefined
    const tracked = kernel.createCustomRef<number>((track, trigger) => {
      manualTrigger = trigger
      return {
        get() {
          track()
          return value
        },
        set(next: number) {
          value = next
        },
      }
    })
    const seen: number[] = []
    kernel.createEffect(() => seen.push(tracked.value))
    tracked.value = 2
    expect(seen).toEqual([1])
    manualTrigger()
    expect(seen).toEqual([1, 2])
  })

  it('uses the custom-ref definition as getter/setter receiver and allows setters to trigger', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const custom = kernel.createCustomRef<number>((track, trigger) => ({
      current: 1,
      get() {
        track()
        return this.current as number
      },
      set(next: number) {
        this.current = next
        trigger()
      },
    }))
    const seen: number[] = []
    kernel.createEffect(() => seen.push(custom.value))

    custom.value = 2
    expect(seen).toEqual([1, 2])
    expect(custom.value).toBe(2)
  })

  it('does not subscribe a custom ref whose getter omits track', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    let value = 1
    const custom = kernel.createCustomRef<number>((_track, trigger) => ({
      get: () => value,
      set(next: number) {
        value = next
        trigger()
      },
    }))
    const seen: number[] = []
    kernel.createEffect(() => seen.push(custom.value))
    custom.value = 2
    expect(seen).toEqual([1])
  })

  it('hides custom-ref metadata and handles missing or non-object definitions', () => {
    const { kernel } = createTypeScriptKernel()
    const custom = kernel.createCustomRef<number>(() => ({}))
    const nullRef = kernel.createCustomRef<number>(() => null)

    expect(Object.keys(custom)).toEqual(['value'])
    expect(Reflect.get(custom, '__rue_ref__')).toBe(true)
    expect(Reflect.has(custom, '__signal__')).toBe(false)
    expect(Object.getOwnPropertyDescriptor(custom, '__rue_ref__')).toMatchObject({
      configurable: false,
      enumerable: false,
    })
    expect(Object.getOwnPropertyDescriptor(custom, '__rue_trigger_ref__')).toMatchObject({
      configurable: true,
      enumerable: false,
    })
    expect(custom.value).toBeUndefined()
    custom.value = 1
    expect(custom.value).toBeUndefined()
    expect(nullRef.value).toBeUndefined()
  })

  it('cooperates with value Hooks markers, raw identity, readonly and triggerRef', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const values = createValueHooks({
      reactiveRuntime: kernel,
      useSetup: factory => factory(),
    })
    const state = values.hooks.reactive({ count: 1 }, undefined, true)
    const readonly = values.hooks.readonly({ count: 1 }, true)
    const ref = values.hooks.ref(1, undefined, true)
    let hits = 0
    kernel.createEffect(() => {
      hits += 1
      void ref.value
    })

    expect(values.hooks.isReactive(state)).toBe(true)
    expect(values.hooks.isProxy(state)).toBe(true)
    expect(values.hooks.isReadonly(readonly)).toBe(true)
    expect(values.hooks.isRef(ref)).toBe(true)
    expect(values.hooks.toRaw(state)).toEqual({ count: 1 })
    expect(values.hooks.toRaw(ref)).toBe(1)
    values.facade.triggerRef(ref)
    expect(hits).toBe(2)
  })

  it('provides kernel-native proxy/ref predicates, raw reads, and manual ref triggers', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const state = kernel.createReactive({ count: 1 })
    const readonly = kernel.createReactive({ count: 1 }, { readonly: true })
    const ref = kernel.createRef(1)
    let hits = 0
    kernel.createEffect(() => {
      hits += 1
      void ref.value
    })

    expect(kernelIsReactive(state)).toBe(true)
    expect(kernelIsProxy(state)).toBe(true)
    expect(kernelIsReadonly(readonly)).toBe(true)
    expect(kernelIsRef(ref)).toBe(true)
    expect(kernelToRaw(state)).toEqual({ count: 1 })
    expect(kernelToRaw(ref)).toBe(1)
    kernelTriggerRef(ref)
    expect(hits).toBe(2)
  })
})
