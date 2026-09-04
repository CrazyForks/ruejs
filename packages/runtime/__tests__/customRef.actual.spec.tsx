import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CustomRefDemo from '../../../app/pages/examples/home-demos/CustomRefDemo'
import { click, flush, mountContainer } from './page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const sectionByHeading = (root: ParentNode, heading: string) => {
  const title = Array.from(root.querySelectorAll('h2')).find(
    element => element.textContent?.trim() === heading,
  )
  expect(title).not.toBeUndefined()
  return title!.closest('section')!
}

const buttonByText = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CustomRefDemo actual page', () => {
  it('makes debounce, manual trigger, conditional tracking, and watch interactions visible', async () => {
    vi.useFakeTimers()
    const container = mountContainer()
    resetActiveRuntime()
    render(<CustomRefDemo />, container)

    const debounce = sectionByHeading(container, '防抖 setter')
    const input = debounce.querySelector('input') as HTMLInputElement
    input.value = 'manual'
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await flush()

    expect(debounce.textContent).toContain('等待提交')
    expect(debounce.textContent).toContain('customRef 值vapor')
    expect(debounce.textContent).toContain('vapor runtime')
    expect(debounce.textContent).not.toContain('manual trigger')

    await vi.advanceTimersByTimeAsync(600)
    await flush()

    expect(debounce.textContent).toContain('已同步')
    expect(debounce.textContent).not.toContain('customRef 值vapor')
    expect(debounce.textContent).toContain('manual trigger')
    expect(debounce.textContent).not.toContain('debounced ref')

    const manual = sectionByHeading(container, '手动 triggerRef')
    expect(manual.textContent).toContain('effect #1 看到 value = 1')
    await click(buttonByText(manual, '仅运行 setter'))
    expect(manual.textContent).toContain('setter 暂存 2，还没有通知 effect')
    expect(manual.textContent).not.toContain('effect #2')

    await click(buttonByText(manual, '发布 triggerRef'))
    expect(manual.textContent).toContain('effect #2 看到 value = 2')

    const conditional = sectionByHeading(container, '条件 track')
    expect(conditional.textContent).toContain('effect #1 看到 1（未 track）')
    await click(buttonByText(conditional, '写入并 trigger'))
    expect(conditional.textContent).not.toContain('effect #2')

    await click(buttonByText(conditional, '开启 track'))
    expect(conditional.textContent).toContain('effect #2 看到 2（已 track）')
    await click(buttonByText(conditional, '写入并 trigger'))
    expect(conditional.textContent).toContain('effect #3 看到 3（已 track）')

    const watchSource = sectionByHeading(container, 'watch source')
    await click(buttonByText(watchSource, '更新 customRef'))
    expect(watchSource.textContent).toContain('watch(customRef) 收到：1 -> 2')
    expect(watchSource.textContent).toContain('watch([customRef, ref]) 收到：[1, A] -> [2, A]')

    await click(buttonByText(watchSource, '切换搭档 A'))
    expect(watchSource.textContent).toContain('watch([customRef, ref]) 收到：[2, A] -> [2, B]')
  })
})
