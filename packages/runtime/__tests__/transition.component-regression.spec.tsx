import { afterEach, describe, expect, it } from 'vitest'

import {
  _$vaporKeyedList,
  _$vaporWithHookId,
  Teleport,
  Transition,
  TransitionGroup,
  render,
  renderAnchor,
  setReactiveScheduling,
  ref,
  useSetup,
  vapor,
  watchEffect,
} from '../src'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const waitForMacrotask = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('built-in transition component regressions', () => {
  it('updates a plain vapor list when inserting a new keyed item', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:plain-list-regression:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3]),
          nextId: ref(4),
        })),
      ) as { items: { value: number[] }; nextId: { value: number } }

      return vapor(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('plain-list-anchor')

        button.id = 'insert-plain'
        button.textContent = 'insert plain'
        button.addEventListener('click', () => {
          const nextItems = setupState.items.value.slice()
          nextItems.splice(1, 0, setupState.nextId.value)
          setupState.items.value = nextItems
          setupState.nextId.value += 1
        })

        root.append(button, anchor)

        watchEffect(() => {
          renderAnchor(
            <ul>
              {setupState.items.value.map(item => (
                <li data-testid={`plain-item-${item}`} key={item}>
                  {item}
                </li>
              ))}
            </ul>,
            root,
            anchor,
          )
        })

        return root
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Example />, container)
    await flush()

    expect(
      Array.from(container.querySelectorAll('[data-testid^="plain-item-"]'), el => el.textContent),
    ).toEqual(['1', '2', '3'])

    ;(container.querySelector('#insert-plain') as HTMLButtonElement).click()
    await flush()

    expect(
      Array.from(container.querySelectorAll('[data-testid^="plain-item-"]'), el => el.textContent),
    ).toEqual(['1', '4', '2', '3'])
  })

  it('keeps a second helper-backed keyed list append order stable after a sibling list reorders', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:sibling-keyed-lists:0', () =>
        useSetup(() => ({
          fruits: ref([
            { id: 1, name: 'Apple' },
            { id: 2, name: 'Banana' },
            { id: 3, name: 'Cherry' },
          ]),
          count: ref(3),
        })),
      ) as {
        fruits: { value: { id: number; name: string }[] }
        count: { value: number }
      }

      return vapor(() => {
        const root = document.createElement('section')
        const reverseButton = document.createElement('button')
        const incrementButton = document.createElement('button')
        const firstContainer = document.createElement('div')
        const secondContainer = document.createElement('div')
        const firstStart = document.createComment('first-list-start')
        const firstEnd = document.createComment('first-list-end')
        const secondStart = document.createComment('second-list-start')
        const secondEnd = document.createComment('second-list-end')
        let fruitElements = new Map<any, any>()
        let stepElements = new Map<any, any>()

        reverseButton.id = 'reverse-fruits'
        reverseButton.textContent = 'reverse fruits'
        reverseButton.addEventListener('click', () => {
          setupState.fruits.value = setupState.fruits.value.slice().reverse()
        })

        incrementButton.id = 'increment-count'
        incrementButton.textContent = 'increment count'
        incrementButton.addEventListener('click', () => {
          setupState.count.value += 1
        })

        firstContainer.append(firstStart, firstEnd)
        secondContainer.append(secondStart, secondEnd)
        root.append(reverseButton, incrementButton, firstContainer, secondContainer)

        watchEffect(() => {
          fruitElements = _$vaporKeyedList({
            items: setupState.fruits.value.map((fruit, index) => [fruit, index, index] as const),
            getKey: item => item[0].id,
            elements: fruitElements,
            parent: firstContainer,
            before: firstEnd,
            singleRoot: true,
            renderItem: (item, parent, start) => {
              const slot = vapor(() => {
                const fragment = document.createDocumentFragment()
                const element = document.createElement('span')
                element.dataset.testid = `fruit-${item[0].id}`
                element.textContent = item[0].name
                fragment.appendChild(element)
                return fragment as any
              })
              renderAnchor(slot, parent, start)
            },
          })

          stepElements = _$vaporKeyedList({
            items: Array.from({ length: setupState.count.value }, (_, index) => [
              index + 1,
              index,
              index,
            ] as const),
            getKey: item => item[0],
            elements: stepElements,
            parent: secondContainer,
            before: secondEnd,
            singleRoot: true,
            renderItem: (item, parent, start) => {
              const slot = vapor(() => {
                const fragment = document.createDocumentFragment()
                const element = document.createElement('span')
                element.dataset.testid = `step-${item[0]}`
                element.textContent = `Step ${item[0]}`
                fragment.appendChild(element)
                return fragment as any
              })
              renderAnchor(slot, parent, start)
            },
          })
        })

        return root
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Example />, container)
    await flush()

    expect(
      Array.from(container.querySelectorAll('span[data-testid^="step-"]'), el => el.textContent),
    ).toEqual(['Step 1', 'Step 2', 'Step 3'])

    ;(container.querySelector('#reverse-fruits') as HTMLButtonElement).click()
    await flush()

    expect(
      Array.from(container.querySelectorAll('span[data-testid^="step-"]'), el => el.textContent),
    ).toEqual(['Step 1', 'Step 2', 'Step 3'])

    ;(container.querySelector('#increment-count') as HTMLButtonElement).click()
    await flush()

    expect(
      Array.from(container.querySelectorAll('span[data-testid^="step-"]'), el => el.textContent),
    ).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4'])
  })

  it('keeps a helper-backed numeric keyed list append order stable on its own', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:single-helper-keyed-list:0', () =>
        useSetup(() => ({
          count: ref(3),
        })),
      ) as {
        count: { value: number }
      }

      return vapor(() => {
        const root = document.createElement('section')
        const incrementButton = document.createElement('button')
        const listContainer = document.createElement('div')
        const listStart = document.createComment('single-step-list-start')
        const listEnd = document.createComment('single-step-list-end')
        let stepElements = new Map<any, any>()

        incrementButton.id = 'increment-single-count'
        incrementButton.textContent = 'increment single count'
        incrementButton.addEventListener('click', () => {
          setupState.count.value += 1
        })

        listContainer.append(listStart, listEnd)
        root.append(incrementButton, listContainer)

        watchEffect(() => {
          stepElements = _$vaporKeyedList({
            items: Array.from({ length: setupState.count.value }, (_, index) => [
              index + 1,
              index,
              index,
            ] as const),
            getKey: item => item[0],
            elements: stepElements,
            parent: listContainer,
            before: listEnd,
            singleRoot: true,
            renderItem: (item, parent, start) => {
              const slot = vapor(() => {
                const fragment = document.createDocumentFragment()
                const element = document.createElement('span')
                element.dataset.testid = `single-step-${item[0]}`
                element.textContent = `Step ${item[0]}`
                fragment.appendChild(element)
                return fragment as any
              })
              renderAnchor(slot, parent, start)
            },
          })
        })

        return root
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Example />, container)
    await flush()

    expect(
      Array.from(container.querySelectorAll('span[data-testid^="single-step-"]'), el => el.textContent),
    ).toEqual(['Step 1', 'Step 2', 'Step 3'])

    ;(container.querySelector('#increment-single-count') as HTMLButtonElement).click()
    await flush()

    expect(
      Array.from(container.querySelectorAll('span[data-testid^="single-step-"]'), el => el.textContent),
    ).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4'])
  })

  it('keeps TransitionGroup children stable in a vapor-style stateful component update', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:transition-group-regression:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3]),
          nextId: ref(4),
        })),
      ) as { items: { value: number[] }; nextId: { value: number } }

      return vapor(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('transition-group-anchor')

        button.id = 'insert'
        button.textContent = 'insert'
        button.addEventListener('click', () => {
          const nextItems = setupState.items.value.slice()
          nextItems.splice(1, 0, setupState.nextId.value)
          setupState.items.value = nextItems
          setupState.nextId.value += 1
        })

        root.append(button, anchor)

        watchEffect(() => {
          renderAnchor(
            <TransitionGroup tag="ul" name="fade" type="transition" duration={1000}>
              {setupState.items.value.map(item => (
                <li data-testid={`item-${item}`} key={item}>
                  {item}
                  <button type="button">x</button>
                </li>
              ))}
            </TransitionGroup>,
            root,
            anchor,
          )
        })

        return root
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Example />, container)
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '1x',
      '2x',
      '3x',
    ])

    ;(container.querySelector('#insert') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '1x',
      '4x',
      '2x',
      '3x',
    ])
    expect(
      container.querySelector('[data-testid="item-4"]')?.classList.contains('fade-enter-active'),
    ).toBe(true)

    ;(container.querySelector('#insert') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li li'))).toHaveLength(0)
    expect(
      Array.from(container.querySelectorAll('li'), el => el.querySelectorAll('button').length),
    ).toEqual([1, 1, 1, 1, 1])
  })

  it('opens and closes a Teleport + Transition modal from vapor-style component state', async () => {
    const Modal = (props: { visible: boolean; onClose: () => void }) => (
      <Teleport to="body">
        <Transition name="fade" type="transition" duration={1000}>
          {props.visible ? (
            <div id="modal-mask" onClick={props.onClose}>
              <div id="modal-panel">hello modal</div>
            </div>
          ) : null}
        </Transition>
      </Teleport>
    )

    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:teleport-transition-regression:0', () =>
        useSetup(() => ({
          visible: ref(false),
        })),
      ) as { visible: { value: boolean } }

      return vapor(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('modal-anchor')

        button.id = 'open'
        button.textContent = 'open'
        button.addEventListener('click', () => {
          setupState.visible.value = true
        })

        root.append(button, anchor)

        watchEffect(() => {
          renderAnchor(
            <Modal
              visible={setupState.visible.value}
              onClose={() => {
                setupState.visible.value = false
              }}
            />,
            root,
            anchor,
          )
        })

        return root
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Example />, container)
    await flush()

    expect(document.body.querySelector('#modal-panel')).toBeNull()

    ;(container.querySelector('#open') as HTMLButtonElement).click()
    await flush()
    await waitForMacrotask()
    await flush()

    expect(document.body.querySelector('#modal-panel')?.textContent).toBe('hello modal')

    ;(document.body.querySelector('#modal-mask') as HTMLDivElement).click()
    await flush()

    expect(document.body.querySelector('#modal-panel')).toBeNull()
  })
})
