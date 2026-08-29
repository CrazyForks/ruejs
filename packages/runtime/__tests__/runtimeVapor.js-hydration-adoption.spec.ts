// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createRue as createJsRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'

import '../src/dom'

type RuntimeLike = {
  createComponent(type: (props: any) => unknown, props?: unknown): unknown
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  free(): void
  renderAnchor(input: unknown, parent: Node, anchor: Node): void
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
      create: () => rustEntry.createRue(getDOMBridge()) as unknown as RuntimeLike,
    },
    {
      label: 'js',
      create: () => createJsRue(getDOMBridge(), jsFacade) as RuntimeLike,
    },
  ]
}

const exerciseAdoption = async (runtime: RuntimeLike) => {
  const parent = document.createElement('main')
  parent.innerHTML =
    '<section data-state="ssr"><input data-testid="draft"><button data-testid="action">SSR</button></section>'
  const adoptedRoot = parent.firstElementChild as HTMLElement & {
    __rue_hydrated_adopted?: boolean
  }
  adoptedRoot.__rue_hydrated_adopted = true
  const adoptedInput = adoptedRoot.querySelector<HTMLInputElement>('[data-testid="draft"]')!
  const adoptedButton = adoptedRoot.querySelector<HTMLButtonElement>('[data-testid="action"]')!
  adoptedInput.value = 'typed before hydration'
  const anchor = document.createComment('rue:hydrate:anchor')
  parent.append(anchor)
  const events: string[] = []

  const HydratedView = (props: Record<string, unknown>) =>
    runtime.createElement('section', { 'data-state': props.state }, [
      runtime.createElement('input', { 'data-testid': 'draft' }, []),
      runtime.createElement(
        'button',
        {
          'data-testid': 'action',
          onClick: () => events.push(`click:${String(props.state)}`),
        },
        [String(props.state)],
      ),
    ])

  runtime.renderAnchor(runtime.createComponent(HydratedView, { state: 'hydrated' }), parent, anchor)
  await settleRuntime()
  const firstRoot = parent.querySelector('section')
  const firstInput = parent.querySelector<HTMLInputElement>('[data-testid="draft"]')
  const firstButton = parent.querySelector<HTMLButtonElement>('[data-testid="action"]')
  firstButton?.click()
  const draftAfterAdoption = firstInput?.value

  runtime.renderAnchor(runtime.createComponent(HydratedView, { state: 'updated' }), parent, anchor)
  await settleRuntime()
  const secondRoot = parent.querySelector('section')
  const secondInput = parent.querySelector<HTMLInputElement>('[data-testid="draft"]')
  const secondButton = parent.querySelector<HTMLButtonElement>('[data-testid="action"]')
  secondButton?.click()

  runtime.renderAnchor(null, parent, anchor)
  await settleRuntime()

  return {
    events,
    adoptedRootRetained: firstRoot === adoptedRoot && secondRoot === adoptedRoot,
    adoptedInputRetained: firstInput === adoptedInput && secondInput === adoptedInput,
    adoptedButtonRetained: firstButton === adoptedButton && secondButton === adoptedButton,
    draftAfterAdoption,
    retainedDraft: secondInput?.value,
    updatedBeforeUnmount: {
      state: secondRoot?.getAttribute('data-state'),
      text: secondButton?.textContent,
    },
    afterUnmount: Array.from(parent.childNodes, node =>
      node instanceof Comment ? `<!--${node.data}-->` : (node as Element).outerHTML,
    ),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript hydration adoption parity', () => {
  it('keeps adopted DOM and input state live through component patch and unmount', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...(await exerciseAdoption(runtime)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor hydration adoption and input snapshot]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toEqual({
      label: 'rust',
      events: ['click:hydrated', 'click:updated'],
      adoptedRootRetained: true,
      adoptedInputRetained: true,
      adoptedButtonRetained: true,
      draftAfterAdoption: '',
      retainedDraft: '',
      updatedBeforeUnmount: { state: 'updated', text: 'updated' },
      afterUnmount: [
        '<section data-state="updated"><input data-testid="draft"><button data-testid="action">updated</button></section>',
        '<!--rue:hydrate:anchor-->',
      ],
    })
  })
})
