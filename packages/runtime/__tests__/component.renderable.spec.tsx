import { afterEach, describe, expect, it } from 'vitest'

import {
  Component,
  h,
  render,
  renderAnchor,
  setReactiveScheduling,
  signal,
  useApp,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import { waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Component renderable boundary', () => {
  it('mounts class components through portable component handles', async () => {
    const host = document.createElement('div')

    document.body.appendChild(host)

    class ClassShell {
      props: { label: string }

      constructor(props: { label: string }) {
        this.props = props
      }

      render() {
        return <span data-testid="class-shell">{this.props.label}</span>
      }
    }

    render(h(ClassShell as any, { label: 'class' }) as any, host)
    await flush()

    expect(host.querySelector('[data-testid="class-shell"]')?.textContent).toBe('class')
  })

  it('routes descendant render errors to class component error boundaries', async () => {
    const host = document.createElement('div')
    const thrown = new Error('boundary boom')
    let caught: unknown
    let catchCount = 0

    document.body.appendChild(host)

    class Boundary {
      props: { children?: unknown; onCatch?: () => void }
      state: { error: unknown | null }

      constructor(props: { children?: unknown; onCatch?: () => void }) {
        this.props = props
        this.state = { error: null }
      }

      static getDerivedStateFromError(error: unknown) {
        return { error }
      }

      componentDidCatch(error: unknown) {
        caught = error
        this.props.onCatch?.()
      }

      render() {
        return this.state.error ? null : this.props.children
      }
    }

    const Thrower = () => {
      throw thrown
    }

    render(
      h(Boundary as any, { onCatch: () => catchCount++ }, h(Thrower as any, null)) as any,
      host,
    )
    await flush()

    expect(caught).toBe(thrown)
    expect(catchCount).toBe(1)
    expect(host.textContent).toBe('')
  })

  it('renders a native element when is is a tag string', async () => {
    const host = document.createElement('div')

    document.body.appendChild(host)

    render(
      <component is="a" href="#docs" data-testid="link">
        docs
      </component>,
      host,
    )
    await flush()

    const link = host.querySelector('[data-testid="link"]') as HTMLAnchorElement | null

    expect(link?.tagName.toLowerCase()).toBe('a')
    expect(link?.getAttribute('href')).toBe('#docs')
    expect(host.textContent).toBe('docs')
  })

  it('renders nothing for missing or reserved dynamic targets', async () => {
    const host = document.createElement('div')

    document.body.appendChild(host)

    render(
      <section>
        <component is={null as any}>missing</component>
        <component is="component">reserved</component>
        <Component is={Component}>self</Component>
      </section>,
      host,
    )
    await flush()

    const section = host.querySelector('section')

    expect(section?.textContent).toBe('')
    expect(section?.children).toHaveLength(0)
  })

  it('switches the same dynamic component instance between native and component targets', async () => {
    const host = document.createElement('div')
    const asComponent = signal(false)
    const label = signal('alpha')

    document.body.appendChild(host)

    const StrongView: FC = props => <strong data-testid="strong">{props.children}</strong>

    const App: FC = () =>
      vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:component:anchor')

        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <component is={asComponent.get() ? StrongView : 'span'} data-testid="dynamic">
              {label.get()}
            </component>,
            root as any,
            anchor as any,
          )
        })

        return root as any
      }) as any

    render(<App />, host)
    await flush()

    expect(host.querySelector('[data-testid="dynamic"]')?.tagName.toLowerCase()).toBe('span')
    expect(host.textContent).toBe('alpha')

    asComponent.set(true)
    label.set('beta')
    await flush()

    expect(host.querySelector('[data-testid="strong"]')?.tagName.toLowerCase()).toBe('strong')
    expect(host.querySelector('[data-testid="dynamic"]')).toBeNull()
    expect(host.textContent).toBe('beta')
  })

  it('resolves registered string component names through useApp().component()', async () => {
    const host = document.createElement('div')

    document.body.appendChild(host)

    const CardView: FC = props => <article data-testid="card">{props.children}</article>
    const App: FC = () => <Component is="CardView">registered</Component>

    useApp(App).component('CardView', CardView).mount(host)

    await waitForContent(() => {
      expect(host.querySelector('[data-testid="card"]')?.tagName.toLowerCase()).toBe('article')
      expect(host.textContent).toBe('registered')
    })
  })

  it('updates wrapper props when a component renders svg children', async () => {
    const host = document.createElement('div')
    const active = signal(true)

    document.body.appendChild(host)

    const Shell: FC<{ active: boolean }> = props => (
      <div data-testid="shell" className={props.active ? 'on' : 'off'}>
        {props.children}
      </div>
    )

    const App: FC = () =>
      vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:component:anchor')

        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <Shell active={active.get()}>
              <svg data-testid="shell-icon" viewBox="0 0 10 10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" />
              </svg>
            </Shell>,
            root as any,
            anchor as any,
          )
        })

        return root as any
      }) as any

    render(<App />, host)
    await flush()

    expect((host.querySelector('[data-testid="shell"]') as HTMLElement).className).toContain('on')
    expect(host.querySelectorAll('[data-testid="shell-icon"]')).toHaveLength(1)

    active.set(false)
    await flush()

    expect((host.querySelector('[data-testid="shell"]') as HTMLElement).className).toContain('off')
    expect((host.querySelector('[data-testid="shell"]') as HTMLElement).className).not.toContain(
      'on',
    )
    expect(host.querySelectorAll('[data-testid="shell-icon"]')).toHaveLength(1)
  })

  it('replays renderable props nested inside component handles on the same anchor', async () => {
    const host = document.createElement('div')
    const iconTone = signal<'mail' | 'bell'>('mail')

    document.body.appendChild(host)

    const MailGlyph: FC = () => (
      <svg data-testid="mail-icon" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1" y="2" width="8" height="6" rx="1" />
      </svg>
    )

    const BellGlyph: FC = () => (
      <svg data-testid="bell-icon" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M5 1.5a2.5 2.5 0 0 1 2.5 2.5c0 2 .8 2.8.8 2.8H1.7S2.5 6 2.5 4A2.5 2.5 0 0 1 5 1.5Z" />
      </svg>
    )

    const IconShell: FC<{ icon: any; label: string }> = props => (
      <button data-testid="icon-shell">
        {props.icon}
        <span>{props.label}</span>
      </button>
    )

    const App: FC = () =>
      vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:component:renderable-prop-anchor')

        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <IconShell
              icon={iconTone.get() === 'mail' ? <MailGlyph /> : <BellGlyph />}
              label="channel"
            />,
            root as any,
            anchor as any,
          )
        })

        return root as any
      }) as any

    render(<App />, host)
    await flush()

    expect(host.querySelector('[data-testid="mail-icon"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="bell-icon"]')).toBeNull()
    expect(host.textContent).toContain('channel')

    iconTone.set('bell')
    await flush()

    expect(host.querySelector('[data-testid="mail-icon"]')).toBeNull()
    expect(host.querySelector('[data-testid="bell-icon"]')).toBeTruthy()
    expect(host.textContent).toContain('channel')
  })
})
