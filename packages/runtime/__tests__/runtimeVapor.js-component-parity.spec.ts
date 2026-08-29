// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createRue as createJsRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'
import { REPEATABLE_MOUNT_FACTORY_KEY } from '../../runtime-vapor/dist/js-runtime/types.js'
import { h as createHighLevelElement, renderAnchor, vapor } from '../src/rue'

import '../src/dom'

type ComponentHost = {
  __hooks?: { states?: unknown[] }
  __rue_context_owner_parent__?: ComponentHost
  __rue_context_parent_instance__?: ComponentHost
  propsRO?: Record<string, unknown>
}

type HookCarrier = {
  getCurrentInstance(): ComponentHost | null | undefined
  useSetup<T>(factory: () => T): T
}

type RuntimeLike = {
  componentInstanceCount(): number
  componentWrapperCount(): number
  createComponent(type: (props: any) => unknown, props?: unknown): unknown
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  effectScopeCount(): number
  free(): void
  render(input: unknown, container: Element): void
  unmount(container: Element): void
}

const exerciseHighLevelCompatTree = async (runtime: RuntimeLike, hooks: HookCarrier) => {
  const container = document.createElement('main')
  const events: string[] = []
  const childHosts: ComponentHost[] = []
  const childSlots: object[] = []

  const Child = (props: Record<string, unknown>) => {
    childHosts.push(hooks.getCurrentInstance()!)
    childSlots.push(hooks.useSetup(() => ({})))
    return createHighLevelElement('em', { 'data-testid': 'deep-child' }, String(props.label))
  }
  const View = (props: Record<string, unknown>) =>
    createHighLevelElement(
      'section',
      { key: props.rootKey, 'data-revision': props.label },
      createHighLevelElement(
        'div',
        { 'data-testid': 'level-one' },
        createHighLevelElement(
          'article',
          { 'data-testid': 'level-two' },
          createHighLevelElement(
            props.controlTag as string,
            {
              key: 'control',
              'data-testid': 'level-three-control',
              value: props.label,
              onClick: () => events.push(String(props.label)),
            },
            String(props.label),
          ),
          createHighLevelElement(Child, { key: 'child', label: props.label }),
          props.extra
            ? createHighLevelElement('span', { key: 'extra', 'data-testid': 'extra' }, 'extra')
            : null,
        ),
      ),
    )

  runtime.render(
    runtime.createComponent(View, {
      rootKey: 'stable-root',
      controlTag: 'button',
      label: 'one',
      extra: true,
    }),
    container,
  )
  await settleRuntime()
  const first = {
    root: container.firstElementChild,
    levelOne: container.querySelector('[data-testid="level-one"]'),
    levelTwo: container.querySelector('[data-testid="level-two"]'),
    control: container.querySelector('[data-testid="level-three-control"]'),
    child: container.querySelector('[data-testid="deep-child"]'),
  }
  ;(first.control as HTMLButtonElement | null)?.click()

  runtime.render(
    runtime.createComponent(View, {
      rootKey: 'stable-root',
      controlTag: 'button',
      label: 'two',
      extra: false,
    }),
    container,
  )
  await settleRuntime()
  const stable = {
    root: container.firstElementChild,
    levelOne: container.querySelector('[data-testid="level-one"]'),
    levelTwo: container.querySelector('[data-testid="level-two"]'),
    control: container.querySelector('[data-testid="level-three-control"]'),
    child: container.querySelector('[data-testid="deep-child"]'),
  }
  const updatedHtml = stable.root?.outerHTML
  ;(stable.control as HTMLButtonElement | null)?.click()

  runtime.render(
    runtime.createComponent(View, {
      rootKey: 'stable-root',
      controlTag: 'a',
      label: 'three',
      extra: false,
    }),
    container,
  )
  await settleRuntime()
  const tagReplacement = container.querySelector('[data-testid="level-three-control"]')

  runtime.render(
    runtime.createComponent(View, {
      rootKey: 'replacement-root',
      controlTag: 'a',
      label: 'four',
      extra: false,
    }),
    container,
  )
  await settleRuntime()
  const keyedReplacement = container.firstElementChild

  const result = {
    events,
    stableRoot: first.root === stable.root,
    stableLevelOne: first.levelOne === stable.levelOne,
    stableLevelTwo: first.levelTwo === stable.levelTwo,
    stableControl: first.control === stable.control,
    stableChild: first.child === stable.child,
    stableChildInstance: childHosts.length >= 2 && childHosts[0] === childHosts[1],
    stableChildSlot: childSlots.length >= 2 && childSlots[0] === childSlots[1],
    updatedHtml,
    removedExtra: container.querySelector('[data-testid="extra"]') == null,
    replacedTag: tagReplacement !== stable.control && tagReplacement?.tagName.toLowerCase() === 'a',
    replacedKey: keyedReplacement !== stable.root,
  }
  runtime.unmount(container)
  return { ...result, afterUnmountScopes: runtime.effectScopeCount() }
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const settleRuntime = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createBackends = () => {
  const jsFacade = createReactiveFacade(rustEntry)
  return [
    {
      label: 'rust',
      hooks: rustEntry as unknown as HookCarrier,
      create: () => rustEntry.createRue(getDOMBridge()) as unknown as RuntimeLike,
    },
    {
      label: 'js',
      hooks: jsFacade.hooks as unknown as HookCarrier,
      create: () => createJsRue(getDOMBridge(), jsFacade) as RuntimeLike,
    },
  ]
}

const exerciseComponent = async (runtime: RuntimeLike, hooks: HookCarrier) => {
  const container = document.createElement('main')
  document.body.append(container)
  const events: string[] = []
  const hosts: ComponentHost[] = []
  const propsObjects: Record<string, unknown>[] = []
  const setupTokens: object[] = []

  const View = (props: Record<string, unknown>) => {
    events.push(`render:${String(props.label)}`)
    const host = hooks.getCurrentInstance()
    if (host) hosts.push(host)
    propsObjects.push(props)
    setupTokens.push(
      hooks.useSetup(() => {
        events.push('setup')
        return {}
      }),
    )
    const tag = props.branch === 'replacement' ? 'article' : 'section'
    return runtime.createElement(tag, { 'data-label': props.label }, [
      runtime.createElement('input', { 'data-testid': 'draft', value: 'abcdef' }, []),
      runtime.createElement(
        'button',
        {
          'data-testid': 'action',
          onClick: () => events.push(`click:${String(props.label)}`),
        },
        [String(props.label)],
      ),
    ])
  }

  runtime.render(runtime.createComponent(View, { label: 'one', branch: 'stable' }), container)
  await settleRuntime()
  const firstRoot = container.firstElementChild
  const firstInput = container.querySelector<HTMLInputElement>('[data-testid="draft"]')
  firstInput?.focus()
  firstInput?.setSelectionRange(2, 5)
  container.querySelector<HTMLButtonElement>('[data-testid="action"]')?.click()
  const mountedCounts = {
    instances: runtime.componentInstanceCount(),
    wrappers: runtime.componentWrapperCount(),
  }

  runtime.render(runtime.createComponent(View, { label: 'two', branch: 'stable' }), container)
  await settleRuntime()
  const secondRoot = container.firstElementChild
  const secondInput = container.querySelector<HTMLInputElement>('[data-testid="draft"]')
  const restoredInputState = {
    focused: document.activeElement === secondInput,
    selection: [secondInput?.selectionStart, secondInput?.selectionEnd],
  }
  container.querySelector<HTMLButtonElement>('[data-testid="action"]')?.click()

  runtime.render(
    runtime.createComponent(View, { label: 'replacement', branch: 'replacement' }),
    container,
  )
  await settleRuntime()
  const replacementRoot = container.firstElementChild
  const beforeUnmount = {
    html: container.innerHTML,
    counts: {
      instances: runtime.componentInstanceCount(),
      wrappers: runtime.componentWrapperCount(),
    },
  }

  runtime.unmount(container)

  return {
    events,
    mountedCounts,
    stableInstance: hosts.length === 3 && hosts.every(host => host === hosts[0]),
    stablePropsObject:
      propsObjects.length === 3 && propsObjects.every(props => props === propsObjects[0]),
    stableHookSlot:
      setupTokens.length === 3 && setupTokens.every(token => token === setupTokens[0]),
    hookSlotCount: hosts[0]?.__hooks?.states?.length,
    reusedRoot: firstRoot === secondRoot,
    reusedInput: firstInput === secondInput,
    retainedDraft: secondInput?.value,
    restoredInputState,
    replacedRoot: replacementRoot !== secondRoot,
    beforeUnmount,
    afterUnmount: {
      html: container.innerHTML,
      instances: runtime.componentInstanceCount(),
      wrappers: runtime.componentWrapperCount(),
    },
  }
}

const exerciseNestedComponent = async (runtime: RuntimeLike, hooks: HookCarrier) => {
  const container = document.createElement('main')
  const parentHosts: ComponentHost[] = []
  const childHosts: ComponentHost[] = []
  const parentSlots: object[] = []
  const childSlots: object[] = []

  const Child = (props: Record<string, unknown>) => {
    childHosts.push(hooks.getCurrentInstance()!)
    childSlots.push(hooks.useSetup(() => ({})))
    return runtime.createElement('strong', { 'data-child': props.value }, [String(props.value)])
  }
  const Parent = (props: Record<string, unknown>) => {
    parentHosts.push(hooks.getCurrentInstance()!)
    parentSlots.push(hooks.useSetup(() => ({})))
    return runtime.createComponent(Child, { value: props.value })
  }

  runtime.render(runtime.createComponent(Parent, { value: 'first' }), container)
  await settleRuntime()
  const firstChildRoot = container.firstElementChild
  runtime.render(runtime.createComponent(Parent, { value: 'second' }), container)
  await settleRuntime()
  const snapshot = {
    html: container.innerHTML,
    instanceCount: runtime.componentInstanceCount(),
    stableParent: parentHosts.length === 2 && parentHosts[0] === parentHosts[1],
    stableChild: childHosts.length === 2 && childHosts[0] === childHosts[1],
    stableParentSlot: parentSlots.length === 2 && parentSlots[0] === parentSlots[1],
    stableChildSlot: childSlots.length === 2 && childSlots[0] === childSlots[1],
    childParent:
      childHosts[1]?.__rue_context_owner_parent__ === parentHosts[1] ||
      childHosts[1]?.__rue_context_parent_instance__ === parentHosts[1],
    replacedLeafHost: firstChildRoot !== container.firstElementChild,
  }
  runtime.unmount(container)
  return { ...snapshot, afterUnmountInstances: runtime.componentInstanceCount() }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript component instance and patch parity', () => {
  it('keeps deeply nested h elements and child components stable until tag or key changes', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({
          label: backend.label,
          ...(await exerciseHighLevelCompatTree(runtime, backend.hooks)),
        })
      } finally {
        runtime.free()
      }
    }

    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      events: ['one', 'two'],
      stableRoot: true,
      stableLevelOne: true,
      stableLevelTwo: true,
      stableControl: true,
      stableChild: true,
      stableChildInstance: true,
      stableChildSlot: true,
      removedExtra: true,
      replacedTag: true,
      replacedKey: true,
      afterUnmountScopes: 0,
    })
    expect(results[0].updatedHtml).toContain('data-revision="two"')
    expect(results[0].updatedHtml).toContain('value="two"')
    expect(results[0].updatedHtml).toContain('>two</button>')
  })

  it('does not retain the retired h element reconstruction bridge in runtime-vapor source', () => {
    const sourceFiles = [
      '../../runtime-vapor/src/protocol.ts',
      '../../runtime-vapor/src/js-runtime/component.ts',
      '../../runtime-vapor/src/js-runtime/mount.ts',
      '../../runtime-vapor/src/js-runtime/props.ts',
    ]
    const source = sourceFiles
      .map(file => readFileSync(new URL(file, import.meta.url), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(
      /RUE_STABLE_COMPONENT_HOST_KEY|descendantDepth|patchStableElementChildren|readNativeElementHeadRecord/,
    )
  })

  it('keeps the owning runtime active while a component creates its subtree', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & { __rue?: RuntimeLike }
    const hadDefaultRuntime = Object.prototype.hasOwnProperty.call(runtimeGlobal, '__rue')
    const previousDefaultRuntime = runtimeGlobal.__rue

    try {
      for (const backend of createBackends()) {
        const runtime = backend.create()
        const unrelatedRuntime = backend.create()
        const container = document.createElement('main')
        try {
          runtimeGlobal.__rue = unrelatedRuntime
          const hadActiveRuntime = Object.prototype.hasOwnProperty.call(
            runtimeGlobal,
            '__rue_active',
          )
          const previousActiveRuntime = (runtimeGlobal as { __rue_active?: unknown }).__rue_active
          for (let index = 0; index < 4; index += 1) {
            unrelatedRuntime.createElement('aside', { 'data-burn': index }, [])
          }
          const View = () =>
            createHighLevelElement('section', { 'data-testid': 'active-runtime' }, 'active')

          expect(
            () => runtime.render(runtime.createComponent(View, null), container),
            backend.label,
          ).not.toThrow()
          await settleRuntime()
          expect(container.textContent, backend.label).toBe('active')
          expect(
            Object.prototype.hasOwnProperty.call(runtimeGlobal, '__rue_active'),
            backend.label,
          ).toBe(hadActiveRuntime)
          if (hadActiveRuntime) {
            expect((runtimeGlobal as { __rue_active?: unknown }).__rue_active, backend.label).toBe(
              previousActiveRuntime,
            )
          }
        } finally {
          runtime.free()
          unrelatedRuntime.free()
        }
      }
    } finally {
      if (hadDefaultRuntime) runtimeGlobal.__rue = previousDefaultRuntime
      else delete runtimeGlobal.__rue
    }
  })

  it('keeps deferred remounts on their runtime and replaces keyed child trees synchronously', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & { __rue?: RuntimeLike }
    const activeRuntimeGlobal = globalThis as typeof globalThis & { __rue_active?: RuntimeLike }
    const hadDefaultRuntime = Object.prototype.hasOwnProperty.call(runtimeGlobal, '__rue')
    const hadActiveRuntime = Object.prototype.hasOwnProperty.call(
      activeRuntimeGlobal,
      '__rue_active',
    )
    const previousDefaultRuntime = runtimeGlobal.__rue
    const previousActiveRuntime = activeRuntimeGlobal.__rue_active

    try {
      for (const backend of createBackends()) {
        const runtime = backend.create()
        const unrelatedRuntime = backend.create()
        const parent = document.createElement('main')
        const anchor = document.createComment('route-outlet')
        parent.append(anchor)
        try {
          runtimeGlobal.__rue = runtime
          activeRuntimeGlobal.__rue_active = runtime
          renderAnchor(
            vapor(() => document.createTextNode('first')),
            parent,
            anchor,
          )
          await settleRuntime()
          expect(parent.textContent, backend.label).toBe('first')

          renderAnchor(
            vapor(() => document.createTextNode('second')),
            parent,
            anchor,
          )
          runtimeGlobal.__rue = unrelatedRuntime
          activeRuntimeGlobal.__rue_active = unrelatedRuntime
          await settleRuntime()
          expect(parent.textContent, backend.label).toBe('second')

          runtimeGlobal.__rue = runtime
          activeRuntimeGlobal.__rue_active = runtime
          const PassThrough = ({ children }: { children?: unknown }) => children
          renderAnchor(
            createHighLevelElement(
              PassThrough as any,
              { key: 'route-a' },
              createHighLevelElement('span', null, 'route-a'),
            ),
            parent,
            anchor,
          )
          await settleRuntime()
          expect(parent.textContent, backend.label).toBe('route-a')

          renderAnchor(
            createHighLevelElement(
              PassThrough as any,
              { key: 'route-b' },
              createHighLevelElement('span', null, 'route-b'),
            ),
            parent,
            anchor,
          )
          expect(parent.textContent, backend.label).toBe('route-b')
        } finally {
          runtime.free()
          unrelatedRuntime.free()
        }
      }
    } finally {
      if (hadDefaultRuntime) runtimeGlobal.__rue = previousDefaultRuntime
      else delete runtimeGlobal.__rue
      if (hadActiveRuntime) activeRuntimeGlobal.__rue_active = previousActiveRuntime
      else delete activeRuntimeGlobal.__rue_active
    }
  })

  it('replays a repeatable component result after its original mount handle was consumed', async () => {
    for (const backend of createBackends()) {
      const runtime = backend.create()
      const container = document.createElement('main')
      try {
        const createResult = () =>
          runtime.createElement('section', { 'data-testid': 'stable-result' }, [
            'stable',
          ]) as Record<string, unknown>
        const stableResult = createResult()
        Object.defineProperty(stableResult, REPEATABLE_MOUNT_FACTORY_KEY, {
          configurable: true,
          enumerable: false,
          value: createResult,
        })
        const View = () => stableResult

        runtime.render(runtime.createComponent(View, { revision: 1 }), container)
        await settleRuntime()
        expect(container.textContent, backend.label).toBe('stable')

        expect(
          () => runtime.render(runtime.createComponent(View, { revision: 2 }), container),
          backend.label,
        ).not.toThrow()
        await settleRuntime()
        expect(container.textContent, backend.label).toBe('stable')
      } finally {
        runtime.free()
      }
    }
  })

  it('matches instance reuse, props patch, subtree replacement, events, and unmount', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({
          label: backend.label,
          ...(await exerciseComponent(runtime, backend.hooks)),
        })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor component event and DOM parity]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      events: ['render:one', 'setup', 'click:one', 'render:two', 'click:two', 'render:replacement'],
      mountedCounts: { instances: 1, wrappers: 1 },
      stableInstance: true,
      stablePropsObject: true,
      stableHookSlot: true,
      hookSlotCount: 1,
      reusedRoot: true,
      reusedInput: true,
      retainedDraft: 'abcdef',
      restoredInputState: { focused: true, selection: [2, 5] },
      replacedRoot: true,
      beforeUnmount: {
        html: '<article data-label="replacement"><input data-testid="draft"><button data-testid="action">replacement</button></article>',
        counts: { instances: 1, wrappers: 1 },
      },
      afterUnmount: { html: '', instances: 0, wrappers: 0 },
    })
  })

  it('keeps directly nested component identities and Hook carriers stable', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({
          label: backend.label,
          ...(await exerciseNestedComponent(runtime, backend.hooks)),
        })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor nested component carrier parity]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toEqual({
      label: 'rust',
      html: '<strong data-child="second">second</strong>',
      instanceCount: 2,
      stableParent: true,
      stableChild: true,
      stableParentSlot: true,
      stableChildSlot: true,
      childParent: true,
      replacedLeafHost: false,
      afterUnmountInstances: 0,
    })
  })
})
