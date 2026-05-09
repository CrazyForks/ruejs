import { afterEach, describe, expect, it } from 'vitest'

import { h, ref, render, setReactiveScheduling } from '../src'
import { _$createComponent, renderAnchor, vapor, watchEffect } from '../src/vapor'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const VaporEntryChild = (props: { label: string }) => {
  return vapor(() => {
    const root = document.createElement('div')
    const text = document.createElement('span')
    text.dataset.testid = 'vapor-entry-value'
    root.appendChild(text)

    watchEffect(() => {
      text.textContent = props.label
    })

    return root
  })
}

const VaporEntryApp = () => {
  const label = ref('alpha')

  return vapor(() => {
    const root = document.createElement('section')
    const button = document.createElement('button')
    const anchor = document.createComment('vapor-entry-anchor')

    button.dataset.testid = 'vapor-entry-toggle'
    button.addEventListener('click', () => {
      label.value = label.value === 'alpha' ? 'beta' : 'alpha'
    })

    root.append(button, anchor)

    watchEffect(() => {
      button.textContent = label.value
      renderAnchor(_$createComponent(VaporEntryChild, { label: label.value }), root, anchor)
    })

    return root
  })
}

describe('vapor entry interop', () => {
  it('mounts vapor-entry portable handles through the default runtime', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(VaporEntryApp, null) as any, container as any)
    await flush()

    expect(container.querySelector('[data-testid="vapor-entry-value"]')?.textContent).toBe('alpha')

    ;(container.querySelector('[data-testid="vapor-entry-toggle"]') as HTMLButtonElement).click()
    await flush()

    expect(container.querySelector('[data-testid="vapor-entry-value"]')?.textContent).toBe('beta')
  })

  it('mounts a vapor portable component handle with children through renderAnchor', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Child = () => <span data-testid="anchor-child">child</span>
    const Shell = (props: { children?: unknown }) => (
      <section data-testid="anchor-shell">{props.children}</section>
    )

    const App = () =>
      vapor(() => {
        const root = document.createElement('div')
        const anchor = document.createComment('anchor-with-children')

        root.append(anchor)

        renderAnchor(
          _$createComponent(Shell, {
            children: _$createComponent(Child, null),
          }),
          root,
          anchor,
        )

        return root
      })

    render(h(App, null) as any, container as any)
    await flush()

    expect(container.querySelector('[data-testid="anchor-shell"]')?.textContent).toBe('child')
    expect(container.querySelector('[data-testid="anchor-child"]')?.textContent).toBe('child')
  })
})
