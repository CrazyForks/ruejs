import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import { h, render, setReactiveScheduling } from '../src'
import NextTickDemo from '../../../app/pages/examples/NextTick'

afterEach(() => {
  document.body.innerHTML = ''
  setReactiveScheduling('sync')
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const waitForContent = async (assertion: () => void, attempts = 40) => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }

    await flush()
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  throw lastError
}

describe('nextTick demo actual page', () => {
  it('shows stale DOM synchronously and the updated DOM after nextTick', async () => {
    setReactiveScheduling('microtask')

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(NextTickDemo as any, null), container)
    await flush()

    const readText = () => container.textContent?.replace(/\s+/g, '') ?? ''

    expect(readText()).toContain('nextTick真实业务场景')
    expect(readText()).toContain('同步读取到的DOM文本')
    expect(readText()).toContain('尚未读取')

    const inspectButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('自增并读取 DOM'),
    )

    expect(inspectButton).toBeTruthy()
    inspectButton?.click()

    await waitForContent(() => {
      expect(readText()).toContain('同步读取到的DOM文本0')
      expect(readText()).toContain('awaitnextTick()后读取1')
      expect(readText()).toContain('nextTick()后读取DOM：1')
    })
  })
})
