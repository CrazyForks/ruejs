import { afterEach, describe, expect, it } from 'vitest'

import { Slot, h, render, setReactiveScheduling, type FC } from '../src'
import { RUE_SLOT_BAG_PROP } from '../src/components/Slot'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const mount = (view: any) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  render(view, container)
  return container
}

describe('Slot renderable boundary', () => {
  it('renders default, named, fallback, and scoped slot content', async () => {
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

    const container = mount(
      <div>
        <Panel
          title={<strong data-testid="title">Named title</strong>}
          item={({ label }) => <em data-testid="scoped">{label}</em>}
        >
          <span data-testid="default">Body</span>
        </Panel>
        {h(Panel, null)}
      </div>,
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

  it('prefers slot bag entries over same-name plain props when source is explicit', async () => {
    const BagPanel: FC<Record<string, unknown>> = props => (
      <section>
        <header>
          <Slot source={props} name="title">
            Untitled
          </Slot>
        </header>
        <small>
          <Slot source={props} name="subtitle">
            No subtitle
          </Slot>
        </small>
      </section>
    )

    const container = mount(
      <div>
        <BagPanel
          title={<span data-testid="plain-title">Plain title</span>}
          subtitle={<span data-testid="plain-subtitle">Plain subtitle</span>}
          {...{
            [RUE_SLOT_BAG_PROP]: {
              title: <strong data-testid="bag-title">Bag title</strong>,
            },
          }}
        />
      </div>,
    )
    await flush()

    const sections = Array.from(container.querySelectorAll('section'))
    expect(sections).toHaveLength(1)

    expect(sections[0]?.querySelector('[data-testid="bag-title"]')?.textContent).toBe('Bag title')
    expect(sections[0]?.querySelector('[data-testid="plain-title"]')).toBeNull()
    expect(sections[0]?.querySelector('[data-testid="plain-subtitle"]')?.textContent).toBe(
      'Plain subtitle',
    )
  })
})
