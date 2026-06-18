import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import { h, render, setReactiveScheduling } from '../src'
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
  it('records cleanup when the scoped child is unmounted', async () => {
    vi.useFakeTimers()
    setReactiveScheduling('sync')

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(OnScopeDispose as any, null), container)

    const unmountButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('卸载子作用域'),
    )

    expect(unmountButton).toBeTruthy()
    unmountButton?.click()
    await flush()

    const text = container.textContent?.replace(/\s+/g, '') ?? ''
    expect(text).toContain('子组件已卸载')
    expect(text).toContain('清理timer')
    expect(text).not.toContain('还没有清理记录')
  })
})
