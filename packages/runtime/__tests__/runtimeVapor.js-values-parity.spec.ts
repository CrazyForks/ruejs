import { describe, expect, it } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createReactiveKernel } from '../../runtime-vapor/dist/reactive-kernel/index.js'

const reactiveKernel = createReactiveKernel()

type HookHost = {
  __hooks?: {
    index?: number
  }
}

type ValueModule = {
  isProxy(value: unknown): boolean
  isReactive(value: unknown): boolean
  isReadonly(value: unknown): boolean
  isRef(value: unknown): boolean
  propsReactive<T>(initial: T, forceGlobal?: boolean): T
  reactive<T>(initial: T, options?: unknown, forceGlobal?: boolean): T
  readonly<T>(initial: T, forceGlobal?: boolean): T
  ref<T>(initial: T, options?: unknown, forceGlobal?: boolean): { value: T }
  shallowReactive<T>(initial: T, options?: unknown, forceGlobal?: boolean): T
  shallowReadonly<T>(initial: T, forceGlobal?: boolean): T
  toRaw<T>(value: unknown): T
  unref<T>(value: T | { value: T }): T
}

type ValueBackend = {
  label: string
  module: ValueModule
  renderHooks<T>(host: HookHost, render: () => T): T
}

const createJsBackend = (): ValueBackend => {
  const hooks = createReactiveFacade(reactiveKernel).hooks as unknown as ValueModule & {
    renderHooks<T>(host: HookHost, render: () => T): T
  }
  return {
    label: 'shared JS Hook backend',
    module: hooks,
    renderHooks: hooks.renderHooks,
  }
}

const exerciseValues = (backend: ValueBackend) => {
  const { module } = backend
  const raw = {
    nested: { count: 1 },
    items: [{ id: 1 }],
  }
  const deep = module.reactive(raw, undefined, true)
  const shallow = module.shallowReactive(raw, undefined, true)
  const locked = module.readonly(raw, true)
  const shallowLocked = module.shallowReadonly(raw, true)
  const props = module.propsReactive(raw, true)
  const numberRef = module.ref(1, undefined, true)
  const undefinedRef = module.ref(undefined, undefined, true)
  const deepArray = module.reactive(raw.items, undefined, true)
  const shallowArray = module.shallowReactive(raw.items, undefined, true)
  const taggedFunction = Object.assign(() => undefined, {
    __isReactive__: true,
    __isReadonly__: true,
    __rue_ref__: true,
    value: 1,
  })

  const host: HookHost = {}
  const render = () =>
    backend.renderHooks(host, () => ({
      reactive: module.reactive({ count: 1 }),
      readonly: module.readonly({ count: 1 }),
      ref: module.ref(1),
    }))
  const firstRender = render()
  const secondRender = render()

  const shallowOptions: Record<string, unknown> = {}
  module.shallowReactive({}, shallowOptions, true)

  return {
    primitives: [null, undefined, false, 0, -0, Number.NaN, 'value'].map(value => ({
      proxy: module.isProxy(value),
      reactive: module.isReactive(value),
      readonly: module.isReadonly(value),
      ref: module.isRef(value),
      rawStable: Object.is(module.toRaw(value), value),
      unrefStable: Object.is(module.unref(value as never), value),
    })),
    taggedFunction: {
      proxy: module.isProxy(taggedFunction),
      reactive: module.isReactive(taggedFunction),
      readonly: module.isReadonly(taggedFunction),
      ref: module.isRef(taggedFunction),
      rawStable: module.toRaw(taggedFunction) === taggedFunction,
      unrefStable: module.unref(taggedFunction as never) === taggedFunction,
    },
    deep: {
      reactive: module.isReactive(deep),
      proxy: module.isProxy(deep),
      readonly: module.isReadonly(deep),
      nestedReactive: module.isReactive(deep.nested),
      rawStable: module.toRaw(deep) === raw,
    },
    shallow: {
      reactive: module.isReactive(shallow),
      proxy: module.isProxy(shallow),
      nestedReactive: module.isReactive(shallow.nested),
      rawStable: module.toRaw(shallow) === raw,
      optionWasNormalized: shallowOptions.shallow === true,
    },
    readonly: {
      reactive: module.isReactive(locked),
      proxy: module.isProxy(locked),
      readonly: module.isReadonly(locked),
      nestedReadonly: module.isReadonly(locked.nested),
      rawStable: module.toRaw(locked) === raw,
    },
    shallowReadonly: {
      reactive: module.isReactive(shallowLocked),
      readonly: module.isReadonly(shallowLocked),
      nestedReadonly: module.isReadonly(shallowLocked.nested),
      rawStable: module.toRaw(shallowLocked) === raw,
    },
    props: {
      reactive: module.isReactive(props),
      proxy: module.isProxy(props),
      readonly: module.isReadonly(props),
      nestedReactive: module.isReactive(props.nested),
    },
    arrays: {
      deepArray: Array.isArray(deepArray),
      deepItemReactive: module.isReactive(deepArray[0]),
      shallowArray: Array.isArray(shallowArray),
      shallowItemReactive: module.isReactive(shallowArray[0]),
    },
    ref: {
      reactive: module.isReactive(numberRef),
      proxy: module.isProxy(numberRef),
      ref: module.isRef(numberRef),
      readonly: module.isReadonly(numberRef),
      rawValue: Object.is(module.toRaw(numberRef), 1),
      unrefValue: Object.is(module.unref(numberRef), 1),
      undefinedUnrefReturnsWrapper: module.unref(undefinedRef) === undefinedRef,
      undefinedRawReturnsHolder:
        module.toRaw(undefinedRef) === Reflect.get(undefinedRef, '__rue_raw__'),
    },
    repeatedWrapping: {
      globalReactiveCreatesNewProxy: module.reactive(raw, undefined, true) !== deep,
      proxyWrappingKeepsPreviousProxyAsRaw:
        module.toRaw(module.reactive(deep, undefined, true)) === deep,
      nestedReadsCreateEquivalentProxies: deep.nested !== deep.nested,
    },
    hookIdentity: {
      reactive: firstRender.reactive === secondRender.reactive,
      readonly: firstRender.readonly === secondRender.readonly,
      ref: firstRender.ref === secondRender.ref,
      slotCount: host.__hooks?.index,
    },
  }
}

const expectedSnapshot = {
  primitives: Array.from({ length: 7 }, () => ({
    proxy: false,
    reactive: false,
    readonly: false,
    ref: false,
    rawStable: true,
    unrefStable: true,
  })),
  taggedFunction: {
    proxy: false,
    reactive: false,
    readonly: false,
    ref: false,
    rawStable: true,
    unrefStable: true,
  },
  deep: {
    reactive: true,
    proxy: true,
    readonly: false,
    nestedReactive: true,
    rawStable: true,
  },
  shallow: {
    reactive: true,
    proxy: true,
    nestedReactive: false,
    rawStable: true,
    optionWasNormalized: true,
  },
  readonly: {
    reactive: true,
    proxy: true,
    readonly: true,
    nestedReadonly: true,
    rawStable: true,
  },
  shallowReadonly: {
    reactive: true,
    readonly: true,
    nestedReadonly: false,
    rawStable: true,
  },
  props: {
    reactive: true,
    proxy: true,
    readonly: true,
    nestedReactive: false,
  },
  arrays: {
    deepArray: true,
    deepItemReactive: true,
    shallowArray: true,
    shallowItemReactive: false,
  },
  ref: {
    reactive: true,
    proxy: false,
    ref: true,
    readonly: false,
    rawValue: true,
    unrefValue: true,
    undefinedUnrefReturnsWrapper: true,
    undefinedRawReturnsHolder: true,
  },
  repeatedWrapping: {
    globalReactiveCreatesNewProxy: true,
    proxyWrappingKeepsPreviousProxyAsRaw: true,
    nestedReadsCreateEquivalentProxies: true,
  },
  hookIdentity: {
    reactive: true,
    readonly: true,
    ref: true,
    slotCount: 3,
  },
}

describe('runtime-vapor JS value Hook parity', () => {
  it('preserves the mapped value, proxy, wrapping, and identity matrix', () => {
    const snapshot = exerciseValues(createJsBackend())
    console.info('[runtime-vapor values] shared JS Hook backend', snapshot)
    expect(snapshot).toEqual(expectedSnapshot)
  })
})
