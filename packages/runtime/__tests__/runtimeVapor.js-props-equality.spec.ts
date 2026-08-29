import { describe, expect, it } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createReactiveKernel } from '../../runtime-vapor/dist/reactive-kernel/index.js'

const reactiveKernel = createReactiveKernel()

type PropsModule = {
  propsReactive<T>(initial: T, forceGlobal?: boolean): T
}

type EqualityCase = {
  label: string
  equal: boolean
  createPair(): readonly [unknown, unknown]
}

const mountHandle = (id: number) => ({ __rue_mount_id: id })

const blockFactory = () => Object.assign(() => null, { kind: 'block-factory' })

const equalityCases: EqualityCase[] = [
  { label: 'NaN uses Object.is', equal: true, createPair: () => [Number.NaN, Number.NaN] },
  { label: '-0 differs from +0', equal: false, createPair: () => [-0, 0] },
  {
    label: 'the same object reference is equal',
    equal: true,
    createPair: () => {
      const value = { nested: true }
      return [value, value]
    },
  },
  {
    label: 'plain objects compare shallow scalar fields',
    equal: true,
    createPair: () => [{ value: 1 }, { value: 1 }],
  },
  {
    label: 'missing keys differ from present undefined keys',
    equal: false,
    createPair: () => [{ value: undefined }, { missing: undefined }],
  },
  {
    label: 'shared nested references compare equal',
    equal: true,
    createPair: () => {
      const nested = { value: 1 }
      return [{ nested }, { nested }]
    },
  },
  {
    label: 'distinct nested references do not compare deeply',
    equal: false,
    createPair: () => [{ nested: { value: 1 } }, { nested: { value: 1 } }],
  },
  {
    label: 'ordinary arrays retain reference equality',
    equal: false,
    createPair: () => [[1], [1]],
  },
  {
    label: 'mount handles compare by mount id',
    equal: true,
    createPair: () => [mountHandle(7), mountHandle(7)],
  },
  {
    label: 'nested singleton renderables normalize to mount identity',
    equal: true,
    createPair: () => [[[[mountHandle(9)]]], mountHandle(9)],
  },
  {
    label: 'different mount ids are not equal',
    equal: false,
    createPair: () => [mountHandle(10), mountHandle(11)],
  },
  {
    label: 'DOM wrappers normalize to node identity',
    equal: true,
    createPair: () => {
      const node = document.createElement('span')
      return [{ nodes: [node] }, node]
    },
  },
  {
    label: 'block factory singletons retain function identity',
    equal: true,
    createPair: () => {
      const factory = blockFactory()
      return [[factory], factory]
    },
  },
  {
    label: 'portable components compare type and shallow props',
    equal: true,
    createPair: () => {
      const type = () => null
      return [
        { __rue_component_type: type, props: { id: 1 } },
        { __rue_component_type: type, props: { id: 1 } },
      ]
    },
  },
  {
    label: 'portable component prop changes are observable',
    equal: false,
    createPair: () => {
      const type = () => null
      return [
        { __rue_component_type: type, props: { id: 1 } },
        { __rue_component_type: type, props: { id: 2 } },
      ]
    },
  },
]

const exercisePropsEquality = (module: PropsModule) => {
  reactiveKernel.setReactiveScheduling('sync')
  return equalityCases.map(testCase => {
    const [previous, next] = testCase.createPair()
    const props = module.propsReactive(previous, true) as {
      __signal__: {
        get(): unknown
        set(value: unknown): void
      }
    }
    const signal = props.__signal__
    let runs = 0
    const effect = reactiveKernel.createEffect(() => {
      signal.get()
      runs += 1
    })
    signal.set(next)
    effect.dispose()
    return {
      label: testCase.label,
      equal: runs === 1,
      runs,
    }
  })
}

const expectedMatrix = equalityCases.map(({ label, equal }) => ({
  label,
  equal,
  runs: equal ? 1 : 2,
}))

describe('runtime-vapor JS props equality parity', () => {
  it('preserves callback identity and metadata for shallow reactive props', () => {
    const hooks = createReactiveFacade(reactiveKernel).hooks as PropsModule
    const callback = Object.assign(() => 'preview', {
      __rue_component_render_reactive_factory__: true,
    })
    const props = hooks.propsReactive({ callback }, true) as { callback: typeof callback }

    expect(props.callback).toBe(callback)
    expect(props.callback.__rue_component_render_reactive_factory__).toBe(true)
  })

  it('preserves the mapped Object.is and renderable identity matrix in the JS Hook layer', () => {
    const hooks = createReactiveFacade(reactiveKernel).hooks as PropsModule
    const matrix = exercisePropsEquality(hooks)
    console.info('[runtime-vapor props equality] shared JS Hook backend', matrix)
    expect(matrix).toEqual(expectedMatrix)
  })
})
