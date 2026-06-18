/**
 * onRenderTriggered 测试。
 *
 * 验证组件 render 依赖被写入时会收到包含 key/oldValue/newValue 的调试事件。
 */
import { describe, expect, it } from 'vitest'
import {
  nextTick,
  onRenderTriggered,
  ref,
  render,
  setReactiveScheduling,
  signal,
  useSetup,
  type FC,
} from '../src'

describe('onRenderTriggered', () => {
  it('receives debugger event when a render dependency triggers', async () => {
    setReactiveScheduling('sync')
    const events: any[] = []

    const Demo: FC = () => {
      const count = ref(0)
      onRenderTriggered(event => {
        events.push(event)
      })

      return (
        <button type="button" onClick={() => (count.value += 1)}>
          {count.value}
        </button>
      )
    }

    const container = document.createElement('div')
    render(<Demo />, container)

    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('0')

    button.click()
    await nextTick()

    expect(button.textContent).toBe('1')
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({
      type: 'set',
      key: 'value',
      oldValue: 0,
      newValue: 1,
    })
    expect(Array.isArray(events[0].path)).toBe(true)
  })

  it('uses the SignalHandle as target when a root signal triggers render', async () => {
    setReactiveScheduling('sync')
    const events: any[] = []
    type DemoState = { count: ReturnType<typeof signal<number>> }
    let count!: DemoState['count']

    const Demo: FC = () => {
      const state = useSetup(() => {
        count = signal(0)
        onRenderTriggered(event => {
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

    const container = document.createElement('div')
    render(<Demo />, container)

    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('0')

    button.click()
    await nextTick()

    expect(button.textContent).toBe('1')
    const signalEvent = events.find(event => event.target === count)
    expect(signalEvent).toMatchObject({
      type: 'set',
      key: 'value',
      oldValue: 0,
      newValue: 1,
    })
  })
})
