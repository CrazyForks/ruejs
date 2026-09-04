import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import * as runtimeMain from '@rue-js/runtime'
import * as rueMain from '@rue-js/rue'
import type { FC } from '../src'
import { RUE_SLOT_BAG_PROP } from '../src/components/Slot'
import { waitForContent } from './page-test-utils'

import { createTestRenderable } from './legacy-test-render'
import { _$compiledMarkComponentRenderReactive } from '../src/internal'

runtimeMain.setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

let customElementId = 0

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const defineTag = (Ctor: CustomElementConstructor) => {
  customElementId += 1
  const tag = `rue-test-ce-${customElementId}`
  customElements.define(tag, Ctor)
  return tag
}

const Message: FC<{ label?: string }> = props => <p data-testid="msg">{props.label ?? 'hi'}</p>

const HookProbeChild: FC = () => {
  const host = runtimeMain.useHost()
  const shadowRoot = runtimeMain.useShadowRoot()

  return (
    <p data-testid="hook-probe">
      {`${host?.tagName.toLowerCase() ?? 'none'}|${shadowRoot ? 'shadow' : 'light'}`}
    </p>
  )
}

const HookProbe: FC = () => {
  return (
    <div>
      <HookProbeChild />
    </div>
  )
}

const SlotHost: FC = () => {
  return (
    <section data-testid="slot-host">
      <slot name="named"></slot>
      <slot></slot>
    </section>
  )
}

const EventEmitter: FC<Record<string, unknown>> = props => {
  const emit = runtimeMain.useEmit(props as any)

  return (
    <button data-testid="emit-btn" onClick={() => emit('change', 42, 'ok')}>
      emit
    </button>
  )
}

const ThemeContext = runtimeMain.createContext('fallback-theme')

const ContextSlotConsumer: FC<Record<string, unknown>> = props => {
  const theme = runtimeMain.useContext(ThemeContext)
  const Slot = runtimeMain.Slot

  return (
    <section data-testid="context-slot-consumer">
      <p data-testid="theme-value">{theme}</p>
      <Slot source={props} name="row" props={{ label: theme }}>
        <span data-testid="row-fallback">missing row</span>
      </Slot>
      <Slot source={props}>
        <span data-testid="default-fallback">missing default</span>
      </Slot>
    </section>
  )
}

const PropertyProbe: FC<Record<string, unknown>> = props => {
  const payload = props.payload as { label?: string; count?: number } | undefined
  const onPing = props.onPing as ((value: string) => void) | undefined

  return (
    <section data-testid="property-probe">
      <p data-testid="payload-value">
        {payload ? `${payload.label ?? 'none'}:${payload.count ?? 0}` : 'missing'}
      </p>
      <p data-testid="enabled-value">{String(props.enabled ?? 'unset')}</p>
      <button data-testid="ping-btn" onClick={() => onPing?.('from-ce')}>
        ping
      </button>
    </section>
  )
}

describe('useCustomElement', () => {
  it('uses only the compiled runtime ABI in production', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/runtime/src/custom-elements.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/@rue-js\/runtime-vapor|runtime\.vapor|\brenderAnchor\b/)
  })
  it('is exported from the runtime and rue public entries', () => {
    expect(runtimeMain).toHaveProperty('useCustomElement')
    expect(rueMain).toHaveProperty('useCustomElement')
  })

  it('mounts into shadow root by default and updates after attribute changes', async () => {
    const tag = defineTag(
      runtimeMain.useCustomElement(Message, {
        styles: [':host { display: block; }', 'p { color: red; }'],
      }),
    )

    const el = document.createElement(tag)
    el.setAttribute('label', 'hello')
    document.body.appendChild(el)
    await flush()

    expect(el.shadowRoot).not.toBeNull()
    expect(el.shadowRoot?.querySelector('[data-testid="msg"]')?.textContent).toBe('hello')
    expect(el.shadowRoot?.querySelectorAll('style[data-rue-ce-style]')).toHaveLength(2)

    el.setAttribute('label', 'world')
    await flush()

    expect(el.shadowRoot?.querySelector('[data-testid="msg"]')?.textContent).toBe('world')

    el.remove()
    await flush()

    expect(el.shadowRoot?.querySelector('[data-testid="msg"]')).toBeNull()
  })

  it('supports light DOM mounting and props bag updates', async () => {
    const tag = defineTag(rueMain.useCustomElement(Message, { shadowRoot: false }))

    const el = document.createElement(tag) as HTMLElement & {
      props: Record<string, unknown>
    }

    el.props = { label: 'from-props' }
    document.body.appendChild(el)
    await flush()

    expect(el.shadowRoot).toBeNull()
    expect(el.querySelector('[data-testid="msg"]')?.textContent).toBe('from-props')

    el.props = { label: 'next' }
    await flush()

    expect(el.querySelector('[data-testid="msg"]')?.textContent).toBe('next')
  })

  it('updates props and restores the default content when attributes clear', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(Message, { shadowRoot: false }))
    const el = document.createElement(tag)

    el.setAttribute('label', 'one')
    document.body.appendChild(el)
    await flush()

    const first = el.querySelector('[data-testid="msg"]')
    expect(first?.textContent).toBe('one')

    el.setAttribute('label', 'two')
    await flush()

    const second = el.querySelector('[data-testid="msg"]')
    expect(second?.textContent).toBe('two')

    el.removeAttribute('label')

    await waitForContent(() => {
      const third = el.querySelector('[data-testid="msg"]')
      expect(third).not.toBeNull()
      expect(third?.textContent).toBe('hi')
      expect(el.querySelectorAll('[data-testid="msg"]')).toHaveLength(1)
    })
  })

  it('exposes host and shadow root hooks inside the custom element subtree', async () => {
    const shadowTag = defineTag(runtimeMain.useCustomElement(HookProbe))
    const shadowEl = document.createElement(shadowTag)
    document.body.appendChild(shadowEl)
    await flush()

    expect(shadowEl.shadowRoot?.querySelector('[data-testid="hook-probe"]')?.textContent).toBe(
      `${shadowTag}|shadow`,
    )

    const lightTag = defineTag(runtimeMain.useCustomElement(HookProbe, { shadowRoot: false }))
    const lightEl = document.createElement(lightTag)
    document.body.appendChild(lightEl)
    await flush()

    expect(lightEl.querySelector('[data-testid="hook-probe"]')?.textContent).toBe(
      `${lightTag}|light`,
    )
  })

  it('keeps host and shadow root hooks scoped per custom element instance after both mount', async () => {
    const shadowTag = defineTag(runtimeMain.useCustomElement(HookProbe))
    const lightTag = defineTag(runtimeMain.useCustomElement(HookProbe, { shadowRoot: false }))
    const shadowEl = document.createElement(shadowTag)
    const lightEl = document.createElement(lightTag)

    document.body.appendChild(shadowEl)
    await waitForContent(() => {
      expect(shadowEl.shadowRoot?.querySelector('[data-testid="hook-probe"]')?.textContent).toBe(
        `${shadowTag}|shadow`,
      )
    })

    document.body.appendChild(lightEl)

    await waitForContent(() => {
      expect(shadowEl.shadowRoot?.querySelector('[data-testid="hook-probe"]')?.textContent).toBe(
        `${shadowTag}|shadow`,
      )
      expect(lightEl.querySelector('[data-testid="hook-probe"]')?.textContent).toBe(
        `${lightTag}|light`,
      )
    })
  })

  it('projects native slots from host light DOM into the shadow root', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(SlotHost))
    const el = document.createElement(tag)
    const named = document.createElement('span')
    const plain = document.createElement('span')

    named.setAttribute('slot', 'named')
    named.textContent = 'named-content'
    plain.textContent = 'plain-content'
    el.append(named, plain)
    document.body.appendChild(el)
    await flush()

    const namedSlot = el.shadowRoot?.querySelector('slot[name="named"]') as HTMLSlotElement | null
    const defaultSlot = el.shadowRoot?.querySelector('slot:not([name])') as HTMLSlotElement | null

    expect(namedSlot).not.toBeNull()
    expect(defaultSlot).not.toBeNull()
    expect(namedSlot?.assignedNodes()).toContain(named)
    expect(defaultSlot?.assignedNodes()).toContain(plain)
  })

  it('bridges emitted events to host CustomEvent listeners', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(EventEmitter))
    const el = document.createElement(tag)
    const handler = vi.fn()

    el.addEventListener('change', handler)
    document.body.appendChild(el)
    await flush()

    el.shadowRoot
      ?.querySelector('[data-testid="emit-btn"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event).toBeInstanceOf(CustomEvent)
    expect(event.detail).toEqual([42, 'ok'])
    expect(event.bubbles).toBe(true)
    expect(event.composed).toBe(true)
  })

  it('passes scoped slots and context across a Rue-rendered custom element boundary', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(ContextSlotConsumer, { shadowRoot: false }))
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Parent: FC = () => (
      <ThemeContext.Provider value="outer-theme">
        {
          createTestRenderable(tag as any, {
            props: {
              [RUE_SLOT_BAG_PROP]: {
                default: <i data-testid="default-slot">default from parent</i>,
                row: ({ label }: { label: string }) => <b data-testid="row-slot">{label}</b>,
              },
            },
          }) as any
        }
      </ThemeContext.Provider>
    )

    runtimeMain.render(createTestRenderable(Parent, null) as any, container as any)
    await flush()

    const host = container.querySelector(tag)
    expect(host?.querySelector('[data-testid="theme-value"]')?.textContent).toBe('outer-theme')
    expect(host?.querySelector('[data-testid="row-slot"]')?.textContent).toBe('outer-theme')
    expect(host?.querySelector('[data-testid="default-slot"]')?.textContent).toBe(
      'default from parent',
    )
    expect(host?.querySelector('[data-testid="row-fallback"]')).toBeNull()
    expect(host?.querySelector('[data-testid="default-fallback"]')).toBeNull()
  })

  it('renders fallback context and fallback slots when no Rue parent bridge exists', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(ContextSlotConsumer, { shadowRoot: false }))
    const el = document.createElement(tag)

    document.body.appendChild(el)
    await flush()

    expect(el.querySelector('[data-testid="theme-value"]')?.textContent).toBe('fallback-theme')
    expect(el.querySelector('[data-testid="row-fallback"]')?.textContent).toBe('missing row')
    expect(el.querySelector('[data-testid="default-fallback"]')?.textContent).toBe(
      'missing default',
    )
  })

  it('syncs complex DOM properties into mounted custom elements and clears removed values', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(PropertyProbe, { shadowRoot: false }))
    const el = document.createElement(tag) as HTMLElement & {
      payload?: { label?: string; count?: number }
      enabled?: boolean
      onPing?: (value: string) => void
    }
    const handler = vi.fn()

    document.body.appendChild(el)
    await flush()

    expect(el.querySelector('[data-testid="payload-value"]')?.textContent).toBe('missing')
    expect(el.querySelector('[data-testid="enabled-value"]')?.textContent).toBe('unset')

    runtimeMain._$setProperty(el, 'payload', { label: 'object', count: 3 })
    runtimeMain._$setProperty(el, 'enabled', true)
    runtimeMain._$setProperty(el, 'onPing', handler)

    await waitForContent(() => {
      expect(el.querySelector('[data-testid="payload-value"]')?.textContent).toBe('object:3')
      expect(el.querySelector('[data-testid="enabled-value"]')?.textContent).toBe('true')
    })

    expect(el.hasAttribute('payload')).toBe(false)
    ;(el.querySelector('[data-testid="ping-btn"]') as HTMLButtonElement | null)?.click()
    expect(handler).toHaveBeenCalledWith('from-ce')

    runtimeMain._$setProperty(el, 'payload', null)
    runtimeMain._$setProperty(el, 'enabled', false)
    runtimeMain._$setProperty(el, 'onPing', undefined)

    await waitForContent(() => {
      expect(el.querySelector('[data-testid="payload-value"]')?.textContent).toBe('missing')
      expect(el.querySelector('[data-testid="enabled-value"]')?.textContent).toBe('unset')
    })
    expect('payload' in el).toBe(false)
    expect('enabled' in el).toBe(false)
    expect('onPing' in el).toBe(false)
  })

  it('updates bridged context and scoped slot props when the Rue parent rerenders', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(ContextSlotConsumer, { shadowRoot: false }))
    const container = document.createElement('div')
    const theme = runtimeMain.ref('theme-a')
    const showRow = runtimeMain.ref(true)
    document.body.appendChild(container)

    const Parent: FC = () => (
      <section>
        <button
          data-testid="theme-toggle"
          onClick={() => {
            theme.value = theme.value === 'theme-a' ? 'theme-b' : 'theme-a'
          }}
        >
          theme
        </button>
        <button
          data-testid="slot-toggle"
          onClick={() => {
            showRow.value = !showRow.value
          }}
        >
          slot
        </button>
        <ThemeContext.Provider value={theme.value}>
          {
            createTestRenderable(tag as any, {
              props: {
                [RUE_SLOT_BAG_PROP]: {
                  default: <i data-testid="default-slot">default:{theme.value}</i>,
                  row: showRow.value
                    ? ({ label }: { label: string }) => (
                        <b data-testid="row-slot">
                          {label}:{theme.value}
                        </b>
                      )
                    : undefined,
                },
              },
            }) as any
          }
        </ThemeContext.Provider>
      </section>
    )

    runtimeMain.render(<Parent />, container as any)
    await flush()

    const findHost = () => container.querySelector(tag)
    expect(findHost()?.querySelector('[data-testid="theme-value"]')?.textContent).toBe('theme-a')
    expect(findHost()?.querySelector('[data-testid="row-slot"]')?.textContent).toBe(
      'theme-a:theme-a',
    )
    expect(findHost()?.querySelector('[data-testid="default-slot"]')?.textContent).toBe(
      'default:theme-a',
    )

    ;(container.querySelector('[data-testid="theme-toggle"]') as HTMLButtonElement | null)?.click()

    await waitForContent(() => {
      const host = findHost()
      expect(host?.querySelector('[data-testid="theme-value"]')?.textContent).toBe('theme-b')
      expect(host?.querySelector('[data-testid="row-slot"]')?.textContent).toBe('theme-b:theme-b')
      expect(host?.querySelector('[data-testid="default-slot"]')?.textContent).toBe(
        'default:theme-b',
      )
    })

    ;(container.querySelector('[data-testid="slot-toggle"]') as HTMLButtonElement | null)?.click()

    await waitForContent(() => {
      const host = findHost()
      expect(host?.querySelector('[data-testid="row-slot"]')).toBeNull()
      expect(host?.querySelector('[data-testid="row-fallback"]')?.textContent).toBe('missing row')
      expect(host?.querySelector('[data-testid="default-slot"]')?.textContent).toBe(
        'default:theme-b',
      )
    })
  })

  it('patches a directly returned h custom-element host in place', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(Message, { shadowRoot: false }))
    const container = document.createElement('div')
    const label = runtimeMain.signal('one')
    const CompatHost = _$compiledMarkComponentRenderReactive((() =>
      createTestRenderable(tag as any, { key: 'stable-host', label: label.get() })) as FC)

    document.body.appendChild(container)
    runtimeMain.render(createTestRenderable(CompatHost, null) as any, container as any)
    await flush()

    const firstHost = container.querySelector(tag)
    expect(firstHost?.querySelector('[data-testid="msg"]')?.textContent).toBe('one')

    label.set('two')
    await flush()

    expect(container.querySelector(tag)).toBe(firstHost)
    expect(firstHost?.querySelector('[data-testid="msg"]')?.textContent).toBe('two')
  })

  it('preserves context through nested custom element boundaries', async () => {
    const innerTag = defineTag(
      runtimeMain.useCustomElement(ContextSlotConsumer, { shadowRoot: false }),
    )
    const OuterBridge: FC = () => {
      const theme = runtimeMain.useContext(ThemeContext)

      return (
        <section data-testid="outer-bridge">
          <p data-testid="outer-theme">{theme}</p>
          {
            createTestRenderable(innerTag as any, {
              props: {
                [RUE_SLOT_BAG_PROP]: {
                  row: ({ label }: { label: string }) => (
                    <strong data-testid="nested-row">nested:{label}</strong>
                  ),
                },
              },
            }) as any
          }
        </section>
      )
    }
    const outerTag = defineTag(runtimeMain.useCustomElement(OuterBridge, { shadowRoot: false }))
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Parent: FC = () => (
      <ThemeContext.Provider value="deep-theme">
        {createTestRenderable(outerTag as any, null) as any}
      </ThemeContext.Provider>
    )

    runtimeMain.render(<Parent />, container as any)
    await flush()

    const outerHost = container.querySelector(outerTag)
    const innerHost = outerHost?.querySelector(innerTag)
    expect(outerHost?.querySelector('[data-testid="outer-theme"]')?.textContent).toBe('deep-theme')
    expect(innerHost?.querySelector('[data-testid="theme-value"]')?.textContent).toBe('deep-theme')
    expect(innerHost?.querySelector('[data-testid="nested-row"]')?.textContent).toBe(
      'nested:deep-theme',
    )
  })

  it('mounts custom elements inside a parent Rue render without rebinding the wasm DOM adapter', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(Message, { shadowRoot: false }))
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Parent: FC = () => createTestRenderable(tag as any, { label: 'nested-host' }) as any

    expect(() => {
      runtimeMain.render(createTestRenderable(Parent, null) as any, container as any)
    }).not.toThrow()

    await flush()

    expect(container.querySelector(tag)?.querySelector('[data-testid="msg"]')?.textContent).toBe(
      'nested-host',
    )
  })

  it('mounts custom elements inside a parent Rue app mount without triggering a nested wasm mount crash', async () => {
    const tag = defineTag(runtimeMain.useCustomElement(Message, { shadowRoot: false }))
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Parent: FC = () => (
      <section>
        <p>outer-app</p>
        {createTestRenderable(tag as any, { label: 'mounted-host' }) as any}
      </section>
    )

    expect(() => {
      runtimeMain.useApp(Parent).mount(container as any)
    }).not.toThrow()

    await flush()

    expect(container.querySelector(tag)?.querySelector('[data-testid="msg"]')?.textContent).toBe(
      'mounted-host',
    )
  })
})
