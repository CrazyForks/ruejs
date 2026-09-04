import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import { createPersistentSidebarPlayground } from '../../../app/pages/site/persistentSidebarPlayground'
import {
  createMemoryHistory,
  createStaticHistory,
  mountContainer,
  waitForContent,
} from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('persistentSidebarPlayground actual', () => {
  it('updates the active link on route changes without replacing the sidebar nav', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'design',
          title: '设计',
          items: [
            { id: 'button', title: '按钮', href: '/design/button' },
            { id: 'tabs', title: '标签页', href: '/design/tabs' },
          ],
        },
      ],
      fallbackToRoute: true,
    })

    const router = createRouter({
      history: createMemoryHistory('/design/button'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getButtonLink = () =>
      container.querySelector<HTMLAnchorElement>('[data-rue-sidebar-href="/design/button"]')
    const getTabsLink = () =>
      container.querySelector<HTMLAnchorElement>('[data-rue-sidebar-href="/design/tabs"]')

    await waitForContent(() => {
      expect(getButtonLink()?.classList.contains('active')).toBe(true)
      expect(getTabsLink()?.classList.contains('active')).toBe(false)
    })

    const nav = container.querySelector('nav')

    await router.push('/design/tabs')

    await waitForContent(() => {
      expect(container.querySelector('nav')).toBe(nav)
      expect(getButtonLink()?.classList.contains('active')).toBe(false)
      expect(getTabsLink()?.classList.contains('active')).toBe(true)
      expect(getTabsLink()?.getAttribute('aria-current')).toBe('page')
    })

    expect(getButtonLink()?.getAttribute('href')).toBe('/design/button')
    getButtonLink()?.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    )
    await router.isReady()

    await waitForContent(() => {
      expect(router.currentPath.get()).toBe('/design/button')
      expect(getButtonLink()?.classList.contains('active')).toBe(true)
      expect(getTabsLink()?.classList.contains('active')).toBe(false)
    })
  })

  it('filters sidebar items by english ids and chinese titles while updating visible counts', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'design',
          title: '设计',
          items: [
            { id: 'button', title: '按钮' },
            { id: 'layout', title: '布局' },
          ],
        },
        {
          id: 'guide',
          title: '指南',
          items: [{ id: 'guide-intro', title: '介绍' }],
        },
      ],
      showCounts: true,
      fallbackToRoute: false,
    })

    const router = createRouter({
      history: createStaticHistory('/'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getTotalCount = () =>
      container.querySelector('.badge-neutral.badge-lg')?.textContent?.trim()
    const getSearchInput = () => container.querySelector('input.input') as HTMLInputElement | null

    await waitForContent(() => {
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).toContain('布局')
      expect(container.textContent).toContain('介绍')
      expect(getTotalCount()).toBe('3')
    })

    const input = getSearchInput()
    expect(input).not.toBeNull()
    input!.focus()
    expect(document.activeElement).toBe(input)

    input!.value = 'button'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(container.textContent).not.toContain('介绍')
      expect(getTotalCount()).toBe('1')
    })
    expect(getSearchInput()).toBe(input)
    expect(document.activeElement).toBe(input)

    input!.value = '介绍'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('介绍')
      expect(container.textContent).not.toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(getTotalCount()).toBe('1')
    })

    input!.value = 'zzz'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('未找到匹配条目')
      expect(getTotalCount()).toBe('0')
    })
  })

  it('ignores IME composition text until the final chinese value is committed', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'guide',
          title: '指南',
          items: [
            { id: 'guide-intro', title: '介绍' },
            { id: 'guide-layout', title: '布局' },
          ],
        },
      ],
      showCounts: true,
      fallbackToRoute: false,
    })

    const router = createRouter({
      history: createStaticHistory('/'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getSearchInput = () => container.querySelector('input.input') as HTMLInputElement | null
    const getTotalCount = () =>
      container.querySelector('.badge-neutral.badge-lg')?.textContent?.trim()

    await waitForContent(() => {
      expect(container.textContent).toContain('介绍')
      expect(container.textContent).toContain('布局')
      expect(getTotalCount()).toBe('2')
    })

    const input = getSearchInput()
    expect(input).not.toBeNull()

    input!.dispatchEvent(new Event('compositionstart', { bubbles: true, cancelable: true }))
    input!.value = 'jie'

    const compositionInputEvent = new Event('input', { bubbles: true, cancelable: true })
    Object.defineProperty(compositionInputEvent, 'inputType', { value: 'insertCompositionText' })

    input!.dispatchEvent(compositionInputEvent)

    await waitForContent(() => {
      expect(container.textContent).toContain('介绍')
      expect(container.textContent).toContain('布局')
      expect(getTotalCount()).toBe('2')
    })

    input!.value = '介绍'
    input!.dispatchEvent(new Event('compositionend', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('介绍')
      expect(container.textContent).not.toContain('布局')
      expect(getTotalCount()).toBe('1')
    })
  })

  it('does not keep unmatched nested menu items when only a group title matches', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'guide',
          title: '指南',
          items: [
            {
              id: 'group-components',
              title: '组件',
              children: [
                { id: 'button', title: '按钮' },
                { id: 'layout', title: '布局' },
              ],
            },
            {
              id: 'group-style',
              title: '样式',
              children: [{ id: 'color', title: '颜色' }],
            },
          ],
        },
      ],
      showCounts: true,
      fallbackToRoute: false,
    })

    const router = createRouter({
      history: createStaticHistory('/'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getSearchInput = () => container.querySelector('input.input') as HTMLInputElement | null
    const getTotalCount = () =>
      container.querySelector('.badge-neutral.badge-lg')?.textContent?.trim()

    await waitForContent(() => {
      expect(container.textContent).toContain('组件')
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).toContain('布局')
      expect(container.textContent).toContain('样式')
      expect(container.textContent).toContain('颜色')
      expect(getTotalCount()).toBe('3')
    })

    const input = getSearchInput()
    expect(input).not.toBeNull()

    input!.value = '组件'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('组件')
      expect(container.textContent).not.toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(container.textContent).not.toContain('样式')
      expect(container.textContent).not.toContain('颜色')
      expect(getTotalCount()).toBe('1')
    })
  })

  it('does not show a section when only the section title matches', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'design',
          title: '设计',
          items: [
            { id: 'button', title: '按钮' },
            { id: 'layout', title: '布局' },
          ],
        },
        {
          id: 'guide',
          title: '指南',
          items: [{ id: 'intro', title: '介绍' }],
        },
      ],
      showCounts: true,
      fallbackToRoute: false,
    })

    const router = createRouter({
      history: createStaticHistory('/'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getSearchInput = () => container.querySelector('input.input') as HTMLInputElement | null
    const getTotalCount = () =>
      container.querySelector('.badge-neutral.badge-lg')?.textContent?.trim()

    await waitForContent(() => {
      expect(container.textContent).toContain('设计')
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).toContain('布局')
      expect(container.textContent).toContain('介绍')
      expect(getTotalCount()).toBe('3')
    })

    const input = getSearchInput()
    expect(input).not.toBeNull()

    input!.value = '设计'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).not.toContain('设计')
      expect(container.textContent).not.toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(container.textContent).not.toContain('介绍')
      expect(container.textContent).toContain('未找到匹配条目')
      expect(getTotalCount()).toBe('0')
    })
  })

  it('clears stale nested menu nodes before a second search after reset', async () => {
    const Sidebar = createPersistentSidebarPlayground({
      sections: [
        {
          id: 'guide',
          title: '指南',
          items: [
            {
              id: 'group-components',
              title: '组件',
              children: [
                { id: 'button', title: '按钮' },
                { id: 'layout', title: '布局' },
              ],
            },
            {
              id: 'group-style',
              title: '样式',
              children: [{ id: 'color', title: '颜色' }],
            },
          ],
        },
      ],
      showCounts: true,
      fallbackToRoute: false,
    })

    const router = createRouter({
      history: createStaticHistory('/'),
      routes: [{ path: '/:path(.*)', component: (() => null) as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(
      <Sidebar>
        <div>content</div>
      </Sidebar>,
      container,
    )

    const getSearchInput = () => container.querySelector('input.input') as HTMLInputElement | null
    const getTotalCount = () =>
      container.querySelector('.badge-neutral.badge-lg')?.textContent?.trim()

    await waitForContent(() => {
      expect(container.textContent).toContain('组件')
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).toContain('布局')
      expect(container.textContent).toContain('样式')
      expect(container.textContent).toContain('颜色')
      expect(getTotalCount()).toBe('3')
    })

    const input = getSearchInput()
    expect(input).not.toBeNull()

    input!.value = '组件'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('组件')
      expect(container.textContent).not.toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(container.textContent).not.toContain('样式')
      expect(container.textContent).not.toContain('颜色')
      expect(getTotalCount()).toBe('1')
    })

    input!.value = ''
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('组件')
      expect(container.textContent).toContain('按钮')
      expect(container.textContent).toContain('布局')
      expect(container.textContent).toContain('样式')
      expect(container.textContent).toContain('颜色')
      expect(getTotalCount()).toBe('3')
    })

    input!.value = '颜色'
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).not.toContain('组件')
      expect(container.textContent).not.toContain('按钮')
      expect(container.textContent).not.toContain('布局')
      expect(container.textContent).toContain('样式')
      expect(container.textContent).toContain('颜色')
      expect(getTotalCount()).toBe('1')
    })
  })
})
