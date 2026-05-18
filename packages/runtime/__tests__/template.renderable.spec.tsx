import { afterEach, describe, expect, it } from 'vitest'

import {
  Template,
  h,
  render,
  renderAnchor,
  setReactiveScheduling,
  signal,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import { waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active =
    (globalThis as any).__rue_vapor_preferred ?? (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

const _flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Template renderable boundary', () => {
  it('renders children without inserting an element wrapper', async () => {
    const host = document.createElement('div')
    resetActiveRuntime()

    document.body.appendChild(host)

    render(h(Template, null, h('strong', null, 'A'), h('em', null, 'B')), host)

    await waitForContent(() => {
      expect(host.querySelector('span')).toBeNull()
      expect(host.textContent).toBe('AB')
    })
  })

  it('updates the same template instance in place when children change', async () => {
    const host = document.createElement('div')
    const label = signal('A')
    const showTail = signal(true)
    resetActiveRuntime()

    document.body.appendChild(host)

    const App: FC = () =>
      vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:component:anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            h(
              Template,
              null,
              h('strong', null, label.get()),
              showTail.get() ? h('em', null, 'tail') : null,
            ),
            root as any,
            anchor as any,
          )
        })

        return root as any
      }) as any

    render(h(App, null), host)

    await waitForContent(() => {
      expect(host.textContent).toBe('Atail')
    })

    label.set('B')
    showTail.set(false)

    await waitForContent(() => {
      expect(host.textContent).toBe('B')
    })
  })
})
