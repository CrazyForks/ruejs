import { afterEach, describe, expect, it } from 'vitest'

import * as Rue from '../src'

Rue.setReactiveScheduling('sync')

const mountedContainers: HTMLDivElement[] = []

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  for (const container of mountedContainers) {
    Rue.render(null as never, container)
  }
  mountedContainers.length = 0
  document.body.innerHTML = ''
})

describe('useState React compatibility', () => {
  it('returns values and applies React SetStateAction semantics', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    mountedContainers.push(container)

    const replacementObject = { label: 'second' }
    const replacementArray = ['second']
    const replacementFunction = () => 'second'
    let lazyInitializations = 0
    let renders = 0
    let firstSetter: ((value: number | ((previous: number) => number)) => void) | undefined
    let latestSetter: typeof firstSetter
    let setObject: ((value: typeof replacementObject) => void) | undefined
    let setArray: ((value: string[]) => void) | undefined
    let setFunction:
      | ((value: (() => string) | ((previous: () => string) => () => string)) => void)
      | undefined
    let currentObject: typeof replacementObject | undefined
    let currentArray: string[] | undefined

    const App = () => {
      renders += 1
      const [count, setCount] = Rue.useState(() => {
        lazyInitializations += 1
        return 0
      })
      const [object, updateObject] = Rue.useState({ label: 'first' })
      const [array, updateArray] = Rue.useState(['first'])
      const [fn, updateFunction] = Rue.useState<() => string>(() => () => 'first')

      firstSetter ??= setCount
      latestSetter = setCount
      setObject = updateObject
      setArray = updateArray
      setFunction = updateFunction
      currentObject = object
      currentArray = array

      return Rue.createCompiledComponent('output', {
        'data-testid': 'state',
        children: `${count}|${object.label}|${array.join(',')}|${fn()}`,
      })
    }
    Object.assign(App, { __rue_component_render_reactive_factory__: true })

    Rue.render(Rue.createCompiledComponent(App, null), container)
    await flush()

    expect(container.querySelector('[data-testid="state"]')?.textContent).toBe(
      '0|first|first|first',
    )
    expect(lazyInitializations).toBe(1)
    expect(typeof currentObject).toBe('object')
    expect(Array.isArray(currentArray)).toBe(true)

    firstSetter?.(previous => previous + 1)
    firstSetter?.(previous => previous + 1)
    setObject?.(replacementObject)
    setArray?.(replacementArray)
    setFunction?.(() => replacementFunction)
    await flush()

    expect(renders).toBeGreaterThan(1)
    expect(container.querySelector('[data-testid="state"]')?.textContent).toBe(
      '2|second|second|second',
    )
    expect(currentObject).toBe(replacementObject)
    expect(currentArray).toBe(replacementArray)
    expect(latestSetter).toBe(firstSetter)
    expect(lazyInitializations).toBe(1)
  })
})
