import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import { render, setReactiveScheduling } from '../src'
import { createTestRenderable } from './legacy-test-render'
import OnScopeDispose from '../../../app/pages/examples/OnScopeDispose'

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  setReactiveScheduling('sync')
  vi.useRealTimers()
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('onScopeDispose actual page', () => {
  it('records every cleanup across rapid remounts without duplicate keys', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T08:00:00.000Z'))
    setReactiveScheduling('sync')

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(createTestRenderable(OnScopeDispose as any, null), container)

    const findToggleButton = (label: string) =>
      Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(label),
      )

    expect(vi.getTimerCount()).toBe(1)
    expect(() => findToggleButton('卸载子作用域')?.click()).not.toThrow()
    await flush()
    expect(vi.getTimerCount()).toBe(0)

    expect(() => findToggleButton('重新挂载子作用域')?.click()).not.toThrow()
    await flush()
    expect(vi.getTimerCount()).toBe(1)

    expect(() => findToggleButton('卸载子作用域')?.click()).not.toThrow()
    await flush()
    expect(vi.getTimerCount()).toBe(0)

    const text = container.textContent?.replace(/\s+/g, '') ?? ''
    expect(text).toContain('子组件已卸载')
    expect(container.querySelectorAll('[data-cleanup-log]')).toHaveLength(2)
    expect(text.match(/清理timer/g)).toHaveLength(2)
    expect(text).not.toContain('还没有清理记录')
  })
})
