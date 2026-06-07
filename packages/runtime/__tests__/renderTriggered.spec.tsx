/**
 * onRenderTriggered 测试。
 *
 * 验证组件 render 依赖被写入时会收到包含 key/oldValue/newValue 的调试事件。
 */
import { describe, expect, it } from 'vitest'
import { nextTick, onRenderTriggered, ref, render, setReactiveScheduling, type FC } from '../src'

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
})
