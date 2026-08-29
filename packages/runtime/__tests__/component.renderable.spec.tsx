import { afterEach, describe, expect, it } from 'vitest'

import {
  Component,
  Teleport,
  h,
  render,
  renderAnchor,
  setReactiveScheduling,
  signal,
  useSetup,
  useState,
  useApp,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import {
  _$createComponent,
  _$vaporMarkComponentRenderReactive,
  _$vaporWithHookId,
} from '../src/vapor'
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
  it('tracks an explicitly marked portable JSX render closure', async () => {
    const host = document.createElement('div')
    const active = signal(false)
    const Preview = _$vaporMarkComponentRenderReactive((() =>
      h(
        'button',
        {
          'data-testid': 'reactive-preview',
          onClick: () => active.set(!active.get()),
        },
        active.get() ? 'active' : 'idle',
      )) as FC)

    document.body.appendChild(host)
    render(h(Preview, null) as any, host)
    await flush()

    const button = host.querySelector('[data-testid="reactive-preview"]') as HTMLButtonElement
    expect(button.textContent).toBe('idle')

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(host.querySelector('[data-testid="reactive-preview"]')?.textContent).toBe('active')
  })

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

  it('keeps ref props read by h-created child components live across updates', async () => {
    const host = document.createElement('div')
    let setCount: (value: number | ((ref: { value: number }) => number | void)) => void = () => {}

    document.body.appendChild(host)

    const CounterValue: FC<{ count: { value: number } }> = props =>
      vapor(() => {
        const root = document.createElement('span')
        const anchor = document.createComment('rue:counter-value')

        root.setAttribute('data-testid', 'counter-value')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(props.count.value, root as any, anchor as any)
        })

        return root as any
      }) as any

    const App: FC = () => {
      const [count, updateCount] = useState(0, { kind: 'ref' })
      setCount = updateCount

      return h('section', null, h(CounterValue, { count }))
    }

    render(h(App, null), host)
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('0')

    setCount(ref => {
      ref.value += 1
    })
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('1')

    setCount(ref => {
      ref.value += 1
    })
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('2')

    setCount(0)
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('0')
  })

  it('preserves nested component setup state when a parent JSX host rerenders', async () => {
    const host = document.createElement('div')
    const target = document.createElement('aside')

    document.body.append(host, target)

    const FormatPicker: FC<{ color: string }> = props => {
      const format = useSetup(() => signal('hex'))
      return (
        <div data-testid="format-picker" data-color={props.color}>
          <Teleport to={target}>
            <button data-testid="format" onClick={() => format.set('rgb')}>
              {format.get()}
            </button>
          </Teleport>
        </div>
      )
    }

    const Parent: FC = () => {
      const color = useSetup(() => signal('#1677ff'))
      return (
        <section>
          <button data-testid="update-color" onClick={() => color.set('#22c55e')}>
            update
          </button>
          <FormatPicker color={color.get()} />
        </section>
      )
    }

    render(<Parent />, host)
    await flush()

    ;(target.querySelector('[data-testid="format"]') as HTMLButtonElement).click()
    await flush()
    expect(target.textContent).toBe('rgb')

    ;(host.querySelector('[data-testid="update-color"]') as HTMLButtonElement).click()
    await flush()

    expect(host.querySelector('[data-testid="format-picker"]')?.getAttribute('data-color')).toBe(
      '#22c55e',
    )
    expect(target.textContent).toBe('rgb')
  })

  it('replays component children after a props.children branch is unmounted and shown again', async () => {
    const host = document.createElement('div')
    const showingPreview = signal(true)

    document.body.appendChild(host)

    const CounterValue: FC<{ count: { value: number } }> = props =>
      vapor(() => {
        const root = document.createElement('span')
        const anchor = document.createComment('rue:counter-value')

        root.setAttribute('data-testid', 'counter-value')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(props.count.value, root as any, anchor as any)
        })

        return root as any
      }) as any

    const CounterDemo: FC = () => {
      const setupState = _$vaporWithHookId('useSetup:counter-demo', () =>
        useSetup(() => {
          const [count, setCount] = _$vaporWithHookId('useState:counter-demo', () =>
            useState(0, { kind: 'ref' }),
          )
          _$vaporWithHookId('useSetup:counter-demo-watch', () =>
            useSetup(() => {
              _$vaporWithHookId('watchEffect:counter-demo', () =>
                watchEffect(() => {
                  void count.value
                }),
              )
            }),
          )

          return { count, setCount }
        }),
      )
      const { count, setCount } = setupState

      return h(
        'div',
        null,
        h(CounterValue, { count }),
        h(
          'button',
          {
            onClick: () =>
              setCount(value => {
                value.value += 1
              }),
          },
          '+1',
        ),
      )
    }

    const renderPlaygroundContent = (props: { children?: unknown }) => {
      const content = showingPreview.get() ? (
        <section data-testid="preview">{props.children}</section>
      ) : (
        <section data-testid="code">code</section>
      )

      return vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:playground-content')

        root.appendChild(anchor)
        renderAnchor(_$createComponent(MockSidebar, { children: content }), root as any, anchor)

        return root as any
      }) as any
    }

    const PreviewSwitcher: FC = props =>
      vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:preview-switcher')

        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(renderPlaygroundContent(props), root as any, anchor as any)
        })

        return root as any
      }) as any

    const MockSidebar: FC = props => <div data-testid="mock-sidebar">{props.children}</div>

    const ExamplePage: FC = () => {
      const child = _$createComponent(CounterDemo, {})

      return vapor(() => {
        const root = document.createDocumentFragment()
        const anchor = document.createComment('rue:compiled-page')

        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(_$createComponent(PreviewSwitcher, { children: child }), root as any, anchor)
        })

        return root as any
      }) as any
    }

    render(<ExamplePage />, host)
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('0')

    ;(host.querySelector('button') as HTMLButtonElement).click()
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('1')

    showingPreview.set(false)
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')).toBeNull()
    expect(host.querySelector('[data-testid="code"]')?.textContent).toBe('code')

    showingPreview.set(true)
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('0')

    ;(host.querySelector('button') as HTMLButtonElement).click()
    await flush()

    expect(host.querySelector('[data-testid="counter-value"]')?.textContent).toBe('1')
  })
})
