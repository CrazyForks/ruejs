import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  Transition,
  render,
  renderAnchor,
  setReactiveScheduling,
  signal,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import { nextFrame } from '../src/components/transitionUtils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createTransitionChild = (label: string) => (
  <strong data-testid={`transition-${label}`}>{label}</strong>
)

describe('Transition renderable boundary', () => {
  it('falls back when requestAnimationFrame is delayed', () => {
    vi.useFakeTimers()

    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => 1)

    const fn = vi.fn()
    nextFrame(fn)

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(34)

    expect(fn).toHaveBeenCalledTimes(1)

    requestAnimationFrameSpy.mockRestore()
    vi.useRealTimers()
  })

  it('applies enter classes to the mounted DOM node when array-backed children become visible', async () => {
    const visible = signal(false)

    const Harness: FC = () =>
      vapor(() => {
        const root = document.createElement('section')
        const anchor = document.createComment('transition-enter-anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <Transition name="modal" type="transition" duration={1000}>
              {visible.get() ? [createTransitionChild('enter')] : []}
            </Transition>,
            root,
            anchor,
          )
        })

        return root
      }) as any

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Harness />, container)
    await flush()

    visible.set(true)
    await flush()

    const node = container.querySelector('[data-testid="transition-enter"]') as HTMLElement | null
    expect(node).not.toBeNull()
    expect(node?.classList.contains('modal-enter-active')).toBe(true)
  })

  it('mounts array-backed children and clears stale DOM when hidden', async () => {
    const visible = signal(true)

    const Harness: FC = () =>
      vapor(() => {
        const root = document.createElement('section')
        const anchor = document.createComment('transition-anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <Transition duration={0}>
              {visible.get() ? [createTransitionChild('a')] : []}
            </Transition>,
            root,
            anchor,
          )
        })

        return root
      }) as any

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Harness />, container)
    await flush()

    expect(Array.from(container.querySelectorAll('strong'), el => el.textContent)).toEqual(['a'])

    visible.set(false)
    await flush()

    expect(container.querySelector('strong')).toBeNull()
  })

  it.each(['default', 'out-in', 'in-out'] as const)(
    'cancels a stale enter during a rapid %s mode switch',
    async mode => {
      const visible = signal(false)
      const onAfterEnter = vi.fn()
      const onEnterCancelled = vi.fn()
      let finishEnter = () => {}

      const Harness: FC = () =>
        vapor(() => {
          const root = document.createElement('section')
          const anchor = document.createComment('transition-mode-anchor')
          root.appendChild(anchor)

          watchEffect(() => {
            renderAnchor(
              <Transition
                mode={mode}
                css={false}
                onEnter={(_el, done) => {
                  finishEnter = done
                }}
                onAfterEnter={onAfterEnter}
                onEnterCancelled={onEnterCancelled}
                onLeave={(_el, done) => done()}
              >
                {visible.get() ? createTransitionChild(mode) : null}
              </Transition>,
              root,
              anchor,
            )
          })

          return root
        }) as any

      const container = document.createElement('div')
      document.body.appendChild(container)
      render(<Harness />, container)
      await flush()

      visible.set(true)
      await flush()
      visible.set(false)
      await flush()
      finishEnter()

      expect(onEnterCancelled).toHaveBeenCalledTimes(1)
      expect(onAfterEnter).not.toHaveBeenCalled()
      expect(container.querySelector('strong')).toBeNull()
    },
  )

  it('cancels an active enter when Transition is unmounted', async () => {
    const onAfterEnter = vi.fn()
    const onEnterCancelled = vi.fn()
    let finishEnter = () => {}

    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <Transition
        css={false}
        onEnter={(_el, done) => {
          finishEnter = done
        }}
        onAfterEnter={onAfterEnter}
        onEnterCancelled={onEnterCancelled}
      >
        <strong>active</strong>
      </Transition>,
      container,
    )
    await flush()

    render(null as any, container)
    finishEnter()

    expect(onEnterCancelled).toHaveBeenCalledTimes(1)
    expect(onAfterEnter).not.toHaveBeenCalled()
  })
})
