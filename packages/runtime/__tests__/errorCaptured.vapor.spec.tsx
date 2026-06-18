/**
 * onErrorCaptured Vapor update tests.
 *
 * Covers setup errors thrown by components mounted from a reactive Vapor branch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { h, onError, onErrorCaptured, ref, render, setReactiveScheduling, type FC } from '../src'
import { waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const clickByText = async (root: ParentNode, label: string) => {
  const button = Array.from(root.querySelectorAll('button')).find(
    current => current.textContent?.trim() === label,
  )
  expect(button).toBeTruthy()
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('onErrorCaptured Vapor updates', () => {
  it('captures setup errors from descendants mounted by reactive branches', async () => {
    const container = document.createElement('div')
    const globalError = vi.fn()
    const stopGlobalError = onError(globalError)

    const Broken: FC<{ crash: boolean }> = props => {
      if (props.crash) {
        throw new Error('vapor setup child failure')
      }
      return <span>ok</span>
    }

    const Parent: FC = () => {
      const crash = ref(false)
      const capturedCount = ref(0)

      onErrorCaptured(() => {
        crash.value = false
        capturedCount.value += 1
        return false
      })

      return (
        <section>
          <button
            onClick={() => {
              crash.value = true
            }}
          >
            trigger
          </button>
          <span>captured {capturedCount.value}</span>
          {crash.value ? <Broken crash={true} /> : <Broken crash={false} />}
        </section>
      )
    }

    render(h(Parent, null), container)

    await waitForContent(() => {
      expect(container.textContent).toContain('captured 0')
    })
    await clickByText(container, 'trigger')
    await waitForContent(() => {
      expect(container.textContent).toContain('captured 1')
    })

    expect(globalError).not.toHaveBeenCalled()
    stopGlobalError?.()
  })

  it('recovers captured null component renders across repeated triggers', async () => {
    const container = document.createElement('div')
    const globalError = vi.fn()
    const stopGlobalError = onError(globalError)

    const Broken: FC<{ crash: boolean }> = props => {
      if (props.crash) {
        throw new Error('repeated vapor child failure')
      }
      return <span>child ok</span>
    }

    const Parent: FC = () => {
      const crash = ref(false)
      const capturedCount = ref(0)
      const lastMessage = ref('')

      onErrorCaptured(error => {
        crash.value = false
        lastMessage.value = error instanceof Error ? error.message : String(error)
        capturedCount.value += 1
        return false
      })

      return (
        <section>
          <button
            onClick={() => {
              crash.value = true
            }}
          >
            trigger
          </button>
          <span>captured {capturedCount.value}</span>
          <span>last {lastMessage.value || 'none'}</span>
          {crash.value ? <Broken crash={true} /> : <Broken crash={false} />}
        </section>
      )
    }

    render(h(Parent, null), container)

    await waitForContent(() => {
      expect(container.textContent).toContain('captured 0')
      expect(container.textContent).toContain('child ok')
    })

    for (let index = 0; index < 5; index += 1) {
      await clickByText(container, 'trigger')
    }

    await waitForContent(() => {
      const text = container.textContent ?? ''
      expect(text).toContain('captured 5')
      expect(text).toContain('last repeated vapor child failure')
      expect(text).toContain('child ok')
      expect(text).not.toContain('insertBefore')
    })

    expect(globalError).not.toHaveBeenCalled()
    stopGlobalError?.()
  })
})
