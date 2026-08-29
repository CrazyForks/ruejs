import { describe, expect, it } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createReactiveKernel } from '../../runtime-vapor/dist/reactive-kernel/index.js'

const reactiveKernel = createReactiveKernel()

type HookHost = {
  __hooks?: {
    states?: unknown[]
    index?: number
  }
}

type HookContextModule = {
  getCurrentInstance(): HookHost | null | undefined
  useSetup<T>(factory: () => T): T
  vaporWithHookId<T>(id: string, runner: () => T): T
}

type HookContextBackend = {
  label: string
  module: HookContextModule
  renderHooks<T>(host: HookHost, render: () => T): T
}

const createJsBackend = (): HookContextBackend => {
  const facade = createReactiveFacade(reactiveKernel)
  const hooks = (
    facade as unknown as {
      hooks: HookContextModule & Pick<HookContextBackend, 'renderHooks'>
    }
  ).hooks
  return {
    label: 'shared JS facade backend',
    module: hooks,
    renderHooks: hooks.renderHooks,
  }
}

const exerciseHookContext = (backend: HookContextBackend) => {
  const { module } = backend
  const outer: HookHost = {}
  const child: HookHost = {}
  const failing: HookHost = {}
  const stableIds: HookHost = {}
  const events: string[] = []
  let outsideRuns = 0
  let failingRuns = 0

  const outsideFirst = module.useSetup(() => ({ run: ++outsideRuns }))
  const outsideSecond = module.useSetup(() => ({ run: ++outsideRuns }))

  const renderOuter = () =>
    backend.renderHooks(outer, () => {
      events.push(`outer:current:${module.getCurrentInstance() === outer}`)
      const first = module.useSetup(() => {
        events.push('outer:first:setup')
        const childValue = backend.renderHooks(child, () => {
          events.push(`child:current:${module.getCurrentInstance() === child}`)
          return module.useSetup(() => {
            events.push('child:setup')
            return { value: 'child' }
          })
        })
        events.push(`outer:after-child:${module.getCurrentInstance() === outer}`)
        events.push(`outer:child-value:${childValue.value}`)

        try {
          backend.renderHooks(failing, () =>
            module.useSetup(() => {
              failingRuns += 1
              events.push(`failing:setup:${failingRuns}`)
              throw new Error('nested setup boom')
            }),
          )
        } catch (error) {
          events.push(`outer:caught:${String(error)}`)
        }
        events.push(`outer:after-error:${module.getCurrentInstance() === outer}`)
        return { value: 'outer-first' }
      })
      const second = module.useSetup(() => {
        events.push('outer:second:setup')
        return { value: 'outer-second' }
      })
      return { first, second }
    })

  const firstRender = renderOuter()
  const secondRender = renderOuter()

  try {
    backend.renderHooks(failing, () =>
      module.useSetup(() => {
        failingRuns += 1
        events.push(`failing:setup:${failingRuns}`)
        throw new Error('nested setup boom')
      }),
    )
  } catch (error) {
    events.push(`root:caught:${String(error)}`)
  }

  const firstIds = backend.renderHooks(stableIds, () => ({
    alpha: module.vaporWithHookId('alpha', () => module.useSetup(() => ({ value: 'alpha' }))),
    beta: module.vaporWithHookId('beta', () => module.useSetup(() => ({ value: 'beta' }))),
  }))
  const reorderedIds = backend.renderHooks(stableIds, () => ({
    beta: module.vaporWithHookId('beta', () => module.useSetup(() => ({ value: 'new-beta' }))),
    alpha: module.vaporWithHookId('alpha', () => module.useSetup(() => ({ value: 'new-alpha' }))),
  }))

  return {
    events,
    outsideRuns,
    outsideValues: [outsideFirst.run, outsideSecond.run],
    outsideValuesAreDistinct: outsideFirst !== outsideSecond,
    firstSlotStable: firstRender.first === secondRender.first,
    secondSlotStable: firstRender.second === secondRender.second,
    outerSlotCount: outer.__hooks?.states?.length,
    childSlotCount: child.__hooks?.states?.length,
    failingSlotCount: failing.__hooks?.states?.length ?? 0,
    failingRuns,
    stableIdSlots: stableIds.__hooks?.states?.length,
    stableIdsKeepIdentity:
      firstIds.alpha === reorderedIds.alpha && firstIds.beta === reorderedIds.beta,
    stableIdValues: [reorderedIds.alpha.value, reorderedIds.beta.value],
    currentInstanceRestored: module.getCurrentInstance() == null,
  }
}

const expectedSnapshot = {
  events: [
    'outer:current:true',
    'outer:first:setup',
    'child:current:true',
    'child:setup',
    'outer:after-child:true',
    'outer:child-value:child',
    'failing:setup:1',
    'outer:caught:Error: nested setup boom',
    'outer:after-error:true',
    'outer:second:setup',
    'outer:current:true',
    'failing:setup:2',
    'root:caught:Error: nested setup boom',
  ],
  outsideRuns: 2,
  outsideValues: [1, 2],
  outsideValuesAreDistinct: true,
  firstSlotStable: true,
  secondSlotStable: true,
  outerSlotCount: 2,
  childSlotCount: 1,
  failingSlotCount: 1,
  failingRuns: 2,
  stableIdSlots: 2,
  stableIdsKeepIdentity: true,
  stableIdValues: ['alpha', 'beta'],
  currentInstanceRestored: true,
}

describe('runtime-vapor JS Hook context parity', () => {
  it('preserves the mapped nested setup, error, repeat-render, and outside-setup contract', () => {
    const snapshot = exerciseHookContext(createJsBackend())
    console.info('[runtime-vapor hook context] shared JS facade backend', snapshot.events)
    expect(snapshot).toEqual(expectedSnapshot)
  })

  it('isolates current-instance stacks between facade factories', () => {
    const first = createJsBackend()
    const second = createJsBackend()
    const firstHost = {}
    const secondHost = {}

    expect(() =>
      first.renderHooks(firstHost, () => {
        expect(first.module.getCurrentInstance()).toBe(firstHost)
        expect(second.module.getCurrentInstance()).toBeNull()
        second.renderHooks(secondHost, () => {
          expect(first.module.getCurrentInstance()).toBe(firstHost)
          expect(second.module.getCurrentInstance()).toBe(secondHost)
          throw new Error('isolated stack boom')
        })
      }),
    ).toThrow('isolated stack boom')
    expect(first.module.getCurrentInstance()).toBeNull()
    expect(second.module.getCurrentInstance()).toBeNull()
  })
})
