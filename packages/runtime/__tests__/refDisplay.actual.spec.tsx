import { afterEach, describe, expect, it } from 'vitest'

import { computed, customRef, ref, render, setReactiveScheduling, signal } from '@rue-js/rue'

setReactiveScheduling('sync')

const flush = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Ref values at final JSX display boundaries', () => {
  it('unwraps final JSX ref values and tracks updates', async () => {
    let count: ReturnType<typeof ref<string>> | undefined
    let conditional: ReturnType<typeof ref<string>> | undefined
    let enabled: ReturnType<typeof ref<boolean>> | undefined
    let arrayValue: ReturnType<typeof ref<Array<unknown>>> | undefined
    let customized: ReturnType<typeof customRef<string>> | undefined
    let receivedProp: unknown

    const Child = (props: { value: ReturnType<typeof ref<string>> }) => {
      receivedProp = props.value
      return <output data-testid="prop">{props.value}</output>
    }

    const App = () => {
      const countRef = ref('one')
      const conditionalRef = ref('shown')
      const enabledRef = ref(true)
      const arrayRef = ref<Array<unknown>>([ref('nested'), ['tail']])
      const derived = computed(() => `computed:${countRef.value}`)
      let customValue = 'custom:one'
      const custom = customRef<string>((track, trigger) => ({
        get() {
          track()
          return customValue
        },
        set(value) {
          customValue = value
          trigger()
        },
      }))

      count = countRef
      conditional = conditionalRef
      enabled = enabledRef
      arrayValue = arrayRef
      customized = custom

      return (
        <main>
          <output data-testid="direct">{countRef}</output>
          <output data-testid="computed">{derived}</output>
          <output data-testid="custom">{custom}</output>
          <output data-testid="conditional">{enabledRef.value ? conditionalRef : 'off'}</output>
          <output data-testid="array">{['head:', [countRef], ':', arrayRef]}</output>
          <Child value={countRef} />
          <output data-testid="attribute" data-ref={countRef as unknown as string}>
            explicit:{countRef.value}
          </output>
        </main>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    render(<App />, container)
    await flush()

    if (!count || !conditional || !enabled || !arrayValue || !customized) {
      throw new Error('App setup did not expose its Ref handles')
    }

    const text = (testId: string) =>
      container.querySelector(`[data-testid="${testId}"]`)?.textContent
    const attribute = () =>
      container.querySelector('[data-testid="attribute"]')?.getAttribute('data-ref')

    expect(text('direct')).toBe('one')
    expect(text('computed')).toBe('computed:one')
    expect(text('custom')).toBe('custom:one')
    expect(text('conditional')).toBe('shown')
    expect(text('array')).toBe('head:one:nestedtail')
    expect(receivedProp).toBe(count)
    expect(text('prop')).toBe('one')
    expect(text('attribute')).toBe('explicit:one')
    expect(attribute()).not.toBe('one')

    count.value = 'two'
    conditional.value = 'updated'
    arrayValue.value = [ref('next'), ['array']]
    customized.value = 'custom:two'
    await flush()

    expect({
      direct: text('direct'),
      computed: text('computed'),
      custom: text('custom'),
      conditional: text('conditional'),
      array: text('array'),
      prop: text('prop'),
      attributeText: text('attribute'),
    }).toEqual({
      direct: 'two',
      computed: 'computed:two',
      custom: 'custom:two',
      conditional: 'updated',
      array: 'head:two:nextarray',
      prop: 'two',
      attributeText: 'explicit:two',
    })
    expect(receivedProp).toBe(count)
    expect(attribute()).not.toBe('two')

    enabled.value = false
    await flush()
    expect(text('conditional')).toBe('off')
  })

  it('does not auto-unwrap signals or ordinary value objects', () => {
    const container = document.createElement('div')
    const bareSignal = signal('signal')
    const plainValueObject = { value: 'plain' }

    expect(() => render(<div>{bareSignal as never}</div>, container)).toThrow(/not mountable/)
    expect(() => render(<div>{plainValueObject as never}</div>, container)).toThrow(/not mountable/)
  })
})
