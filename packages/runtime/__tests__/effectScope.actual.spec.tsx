import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import { h, render, setReactiveScheduling } from '../src'
import EffectScope from '../../../app/pages/examples/EffectScope'

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
  vi.useRealTimers()
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const clickButton = (container: HTMLElement, label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes(label),
  )
  expect(button).toBeTruthy()
  button?.click()
}

describe('effectScope actual page', () => {
  it('starts a scoped session and stops captured effects together', async () => {
    setReactiveScheduling('sync')

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(EffectScope as any, null), container)

    clickButton(container, '启动 scope')
    await flush()

    expect(container.textContent).toContain('scope: active')
    expect(container.textContent).toContain('count=1 doubled=2 scope=same')

    clickButton(container, 'count + 1')
    await flush()

    expect(container.textContent).toContain('count=2 doubled=4 scope=same')

    clickButton(container, '停止 scope')
    await flush()

    expect(container.textContent).toContain('scope: stopped')
    expect(container.textContent).toContain('onScopeDispose: interval 已清理')

    clickButton(container, 'count + 1')
    await flush()

    expect(container.textContent).toContain('count=2 doubled=4 scope=same')
    expect(container.textContent).not.toContain('doubled=6')
  })
})
