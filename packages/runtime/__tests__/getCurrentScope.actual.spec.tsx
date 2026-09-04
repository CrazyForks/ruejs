import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import { render, setReactiveScheduling } from '../src'
import { createTestRenderable } from './legacy-test-render'
import GetCurrentScope from '../../../app/pages/examples/GetCurrentScope'

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
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

describe('getCurrentScope actual page', () => {
  it('keeps event handlers outside active scope and stops the captured scope on unmount', async () => {
    setReactiveScheduling('sync')

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(createTestRenderable(GetCurrentScope as any, null), container)

    clickButton(container, '事件中读取')
    await flush()

    expect(container.textContent).toContain(
      '事件处理器默认没有 active scope，getCurrentScope() 返回 undefined',
    )

    clickButton(container, '卸载 probe')
    await flush()

    expect(container.textContent).toContain('onScopeDispose: probe 卸载，scope 清理回调已执行')

    clickButton(container, 'scope.run()')
    await flush()

    expect(container.textContent).toContain('没有可用的 active scope，请先挂载 probe')
    expect(container.textContent).not.toContain('scope.run(): 临时恢复了 probe 的 active scope')
  })
})
