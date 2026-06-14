import { afterEach, describe, expect, it } from 'vitest'

import { computed, ref, render, setReactiveScheduling, toValue } from '../src'
import { mountContainer, waitForContent } from './page-test-utils'
import { resetActiveRuntime } from './design-page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('component props reactivity', () => {
  it('keeps computed props live across a parent component boundary', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    let setPercent = (_value: number) => {}

    const Child = (props: { status: any; percent: any }) => (
      <span data-testid="child-status">
        {toValue(props.status)}:{toValue(props.percent)}
      </span>
    )

    const Parent = () => {
      const percent = ref(68)
      const status = computed(() =>
        percent.value >= 100 ? 'success' : percent.value > 80 ? 'active' : 'normal',
      )
      setPercent = value => {
        percent.value = value
      }

      return <Child status={status} percent={percent} />
    }

    render(<Parent />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('normal:68')
    })

    setPercent(100)

    await waitForContent(() => {
      expect(container.textContent).toContain('success:100')
    })
  })
})
