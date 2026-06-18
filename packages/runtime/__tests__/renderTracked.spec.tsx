/**
 * onRenderTracked 测试。
 *
 * 覆盖组件 render 读取 signal 时的 get 调试事件，以及 untrack 场景下不收集事件。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  nextTick,
  onRenderTracked,
  render,
  setReactiveScheduling,
  signal,
  untrack,
  useSetup,
  type FC,
} from '@rue-js/rue'

let activeContainer: HTMLElement | null = null

const settle = async () => {
  await nextTick()
  await Promise.resolve()
}

afterEach(() => {
  if (activeContainer) {
    render(null as any, activeContainer)
    activeContainer.remove()
    activeContainer = null
  }
  setReactiveScheduling('frame')
})

describe('onRenderTracked', () => {
  it('receives signal get events collected during component render', async () => {
    setReactiveScheduling('microtask')
    const count = signal(0)
    const events: any[] = []

    const App = () => {
      onRenderTracked(event => {
        events.push(event)
      })
      return <div>{count.get()}</div>
    }

    activeContainer = document.createElement('div')
    document.body.appendChild(activeContainer)

    render(<App />, activeContainer)
    await settle()

    expect(activeContainer.textContent).toBe('0')
    expect(events.some(event => event.target === count && event.type === 'get')).toBe(true)
    expect(events.some(event => event.key === 'value')).toBe(true)

    events.length = 0
    count.set(1)
    await settle()

    expect(activeContainer.textContent).toBe('1')
    expect(events.some(event => event.target === count && event.type === 'get')).toBe(true)
  })

  it('does not report reads inside untrack', async () => {
    setReactiveScheduling('microtask')
    const count = signal(0)
    const events: any[] = []

    const App = () => {
      onRenderTracked(event => {
        events.push(event)
      })
      return <div>{untrack(() => count.get())}</div>
    }

    activeContainer = document.createElement('div')
    document.body.appendChild(activeContainer)

    render(<App />, activeContainer)
    await settle()

    expect(activeContainer.textContent).toBe('0')
    expect(events).toHaveLength(0)
  })

  it('keeps the user signal handle as target when registered from useSetup', async () => {
    setReactiveScheduling('sync')
    const events: any[] = []
    type DemoState = { count: ReturnType<typeof signal<number>> }
    let count!: DemoState['count']

    const Demo: FC = () => {
      const state = useSetup(() => {
        count = signal(0)
        onRenderTracked(event => {
          events.push(event)
        })
        return { count }
      }) as DemoState

      return (
        <button type="button" onClick={() => state.count.set(state.count.peek() + 1)}>
          {state.count.get()}
        </button>
      )
    }

    activeContainer = document.createElement('div')
    document.body.appendChild(activeContainer)

    render(<Demo />, activeContainer)
    await settle()

    expect(activeContainer.textContent).toBe('0')
    expect(events.some(event => event.target === count && event.type === 'get')).toBe(true)

    events.length = 0
    activeContainer.querySelector('button')?.click()
    await settle()

    expect(activeContainer.textContent).toBe('1')
    expect(
      events.some(event => event.target === count && event.type === 'get' && event.key === 'value'),
    ).toBe(true)
  })
})
