import { afterEach, describe, expect, it } from 'vitest'

import * as rueMain from '@rue-js/rue'
import { Slot, Template, h, render, setReactiveScheduling, type FC } from '@rue-js/rue'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('@rue-js/rue Slot and Template public entry', () => {
  it('exports Slot and Template from the default public entry', () => {
    expect(rueMain).toHaveProperty('Slot')
    expect(rueMain).toHaveProperty('Template')
    expect(rueMain.Slot).toBe(Slot)
    expect(rueMain.Template).toBe(Template)
  })

  it('renders Slot content through the default public entry', async () => {
    const Panel: FC<{ title?: any; item?: (props: { label: string }) => any }> = props => (
      <section>
        <header>
          <Slot source={props} name="title">
            Untitled
          </Slot>
        </header>
        <main>
          <Slot source={props}>Empty</Slot>
        </main>
        <footer>
          <Slot source={props} name="item" props={{ label: 'scoped value' }}>
            Missing scoped slot
          </Slot>
        </footer>
      </section>
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      <div>
        <Panel
          title={<strong data-testid="title">Named title</strong>}
          item={({ label }) => <em data-testid="scoped">{label}</em>}
        >
          <span data-testid="default">Body</span>
        </Panel>
        {h(Panel, null)}
      </div>,
      container,
    )
    await flush()

    const sections = Array.from(container.querySelectorAll('section'))
    expect(sections).toHaveLength(2)

    expect(sections[0]?.querySelector('[data-testid="title"]')?.textContent).toBe('Named title')
    expect(sections[0]?.querySelector('[data-testid="default"]')?.textContent).toBe('Body')
    expect(sections[0]?.querySelector('[data-testid="scoped"]')?.textContent).toBe('scoped value')

    expect(sections[1]?.querySelector('header')?.textContent).toBe('Untitled')
    expect(sections[1]?.querySelector('main')?.textContent).toBe('Empty')
    expect(sections[1]?.querySelector('footer')?.textContent).toBe('Missing scoped slot')
  })

  it('renders Template without inserting an element wrapper through the default public entry', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    render(h(Template, null, h('strong', null, 'A'), h('em', null, 'B')), host)
    await flush()

    expect(Array.from(host.children).map(node => node.tagName.toLowerCase())).toEqual(['strong', 'em'])
    expect(host.querySelector('span')).toBeNull()
    expect(host.textContent).toBe('AB')
  })
})