import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView } from '@rue-js/router'

import { render, setReactiveScheduling, useComponent } from '../src'
import { createTestRenderable } from './legacy-test-render'
import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'
import { createStaticHistory, mountContainer, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

defineSplitHomeExampleActualSpec({
  name: 'RenderCounter',
  route: '/examples/render-counter',
  importPage: () => import('../../../app/pages/examples/RenderCounter'),
  expectedTexts: ['渲染函数计数器', '渲染函数计数器', '+1', '重置'],
  interaction: async container => {
    await clickByText(container, '+1')
  },
  interactionExpectedTexts: ['1'],
})

afterEach(() => {
  vi.restoreAllMocks()
})

const counterValueText = (container: HTMLElement) =>
  container.querySelector('.text-3xl.font-bold.mb-3')?.textContent?.trim()

const nativeClickButtonByText = async (container: HTMLElement, label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    current => current.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

  expect(button).toBeTruthy()
  button?.click()
  await Promise.resolve()
}

const nativeClickTabByText = async (container: HTMLElement, label: string) => {
  const tab = Array.from(container.querySelectorAll('button[role="tab"]')).find(
    current => current.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

  expect(tab).toBeTruthy()
  tab?.click()
  await Promise.resolve()
}

describe('RenderCounter actual page interactions', () => {
  it('keeps the render-function counter reactive across repeated ref setter updates', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { default: Page } = await import('../../../app/pages/examples/RenderCounter')
    const container = mountContainer()

    render(createTestRenderable(Page as any, null), container)

    await waitForContent(() => {
      expect(counterValueText(container)).toBe('0')
    })
    expect(info).toHaveBeenLastCalledWith('watchEffect计数发生了变化：0')

    await nativeClickButtonByText(container, '+1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('1')
    })
    expect(info).toHaveBeenLastCalledWith('watchEffect计数发生了变化：1')

    await nativeClickButtonByText(container, '+1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('2')
    })
    expect(info).toHaveBeenLastCalledWith('watchEffect计数发生了变化：2')

    await nativeClickButtonByText(container, '-1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('1')
    })
    expect(info).toHaveBeenLastCalledWith('watchEffect计数发生了变化：1')

    await nativeClickButtonByText(container, '重置')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('0')
    })
    expect(info).toHaveBeenLastCalledWith('watchEffect计数发生了变化：0')
    expect(info).toHaveBeenCalledTimes(5)
  })

  it('keeps the counter reactive after the page is lazy-loaded through RouterView', async () => {
    const Empty = () => null
    const AsyncPage = useComponent(() => import('../../../app/pages/examples/RenderCounter'))
    const router = createRouter({
      history: createStaticHistory('/examples/render-counter'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/render-counter', component: AsyncPage as any },
      ],
    })
    const container = mountContainer()

    attachRouter(router)
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(counterValueText(container)).toBe('0')
    })

    await nativeClickButtonByText(container, '+1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('1')
    })

    await nativeClickButtonByText(container, '+1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('2')
    })
  })

  it('keeps the counter reactive after switching from preview to code and back', async () => {
    const { default: Page } = await import('../../../app/pages/examples/RenderCounter')
    const container = mountContainer()

    render(createTestRenderable(Page as any, null), container)

    await waitForContent(() => {
      expect(counterValueText(container)).toBe('0')
    })

    await nativeClickTabByText(container, '代码')
    await waitForContent(() => {
      expect(counterValueText(container)).toBeUndefined()
    })

    await nativeClickTabByText(container, '效果')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('0')
    })

    await nativeClickButtonByText(container, '+1')
    await waitForContent(() => {
      expect(counterValueText(container)).toBe('1')
    })
  })
})
