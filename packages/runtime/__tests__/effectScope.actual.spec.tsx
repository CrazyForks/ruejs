import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import {
  createOwner,
  disposeOwner,
  effect,
  onCleanup as registerCleanup,
  registerOwnerLifecycle,
  runWithOwner,
  setReactiveScheduling,
  signal as createCompiledSignal,
} from '../src/reactive-core'
import { render } from '../src'
import EffectScope from '../../../app/pages/examples/EffectScope'
import { createTestRenderable } from './legacy-test-render'

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  setReactiveScheduling('frame')
  vi.useRealTimers()
})

const clickButton = (container: HTMLElement, label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes(label),
  )
  expect(button).toBeTruthy()
  button?.click()
}

describe('compiled owner effect scope', () => {
  it('disposes child effects before parent cleanup and preserves lifecycle order', () => {
    setReactiveScheduling('sync')
    const events: string[] = []
    const count = createCompiledSignal(0)
    const parent = createOwner()

    runWithOwner(parent, () => {
      registerOwnerLifecycle('beforeUnmount', () => events.push('parent:before-unmount'))
      registerOwnerLifecycle('unmounted', () => events.push('parent:unmounted'))
      registerCleanup(() => events.push('parent:cleanup'))
      const child = createOwner()
      runWithOwner(child, () => {
        registerOwnerLifecycle('beforeUnmount', () => events.push('child:before-unmount'))
        registerOwnerLifecycle('unmounted', () => events.push('child:unmounted'))
        effect(() => {
          events.push(`child:effect:${count.get()}`)
          registerCleanup(() => events.push('child:effect-cleanup'))
        })
        registerCleanup(() => events.push('child:cleanup'))
      })
    })

    count.set(1)
    disposeOwner(parent)
    count.set(2)

    expect(events).toEqual([
      'child:effect:0',
      'child:effect-cleanup',
      'child:effect:1',
      'parent:before-unmount',
      'child:before-unmount',
      'child:effect-cleanup',
      'child:cleanup',
      'child:unmounted',
      'parent:cleanup',
      'parent:unmounted',
    ])
  })

  it('can stop and restart the actual page scope within the same second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T08:00:00.000Z'))
    setReactiveScheduling('sync')

    const container = document.createElement('div')
    document.body.appendChild(container)
    render(createTestRenderable(EffectScope as any, null), container)

    clickButton(container, '启动 scope')
    clickButton(container, '停止 scope')
    clickButton(container, '启动 scope')
    expect(container.textContent).toContain('scope: active')
    expect(container.textContent).toContain('count=1 doubled=2 scope=same')

    vi.advanceTimersByTime(1000)
    expect(container.textContent).toContain('cleanup timer1')

    clickButton(container, '停止 scope')
    expect(container.textContent).toContain('scope: stopped')
    clickButton(container, 'count + 1')
    expect(container.textContent).toContain('源 signal2')
    expect(container.textContent).toContain('count=1 doubled=2 scope=same')
    vi.advanceTimersByTime(1000)
    expect(container.textContent).toContain('cleanup timer1')

    clickButton(container, '启动 scope')
    expect(container.textContent).toContain('scope: active')
    expect(container.textContent).toContain('count=2 doubled=4 scope=same')
    expect(container.textContent).toContain('cleanup timer0')
    vi.advanceTimersByTime(1000)
    expect(container.textContent).toContain('cleanup timer1')

    clickButton(container, '停止 scope')
    expect(container.textContent).toContain('scope: stopped')
    expect(vi.getTimerCount()).toBe(0)
  })
})
