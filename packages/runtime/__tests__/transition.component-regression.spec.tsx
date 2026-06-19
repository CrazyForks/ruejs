import { afterEach, describe, expect, it, vi } from 'vitest'

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
import {
  _$createComponent,
  _$vaporWithKey,
  renderAnchor as renderVaporAnchor,
  vapor as vaporRuntime,
  watchEffect as watchVaporEffect,
} from '../src/vapor'
import * as TransitionUtils from '../src/components/transitionUtils'
import { waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

const mountedContainers: HTMLDivElement[] = []

const mountTestContainer = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  mountedContainers.push(container)
  return container
}

afterEach(() => {
  for (const container of mountedContainers) {
    render(null as any, container)
  }
  mountedContainers.length = 0
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
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

    const container = mountTestContainer()

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
            items: Array.from(
              { length: setupState.count.value },
              (_, index) => [index + 1, index, index] as const,
            ),
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

    const container = mountTestContainer()

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
            items: Array.from(
              { length: setupState.count.value },
              (_, index) => [index + 1, index, index] as const,
            ),
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

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    expect(
      Array.from(
        container.querySelectorAll('span[data-testid^="single-step-"]'),
        el => el.textContent,
      ),
    ).toEqual(['Step 1', 'Step 2', 'Step 3'])

    ;(container.querySelector('#increment-single-count') as HTMLButtonElement).click()
    await flush()

    expect(
      Array.from(
        container.querySelectorAll('span[data-testid^="single-step-"]'),
        el => el.textContent,
      ),
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

    const container = mountTestContainer()

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

  it('keeps TransitionGroup children stable when inserting at the head', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:transition-group-head-insert:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3, 4, 5]),
          nextId: ref(6),
        })),
      ) as { items: { value: number[] }; nextId: { value: number } }

      return vapor(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('transition-group-head-anchor')

        button.id = 'insert-head'
        button.textContent = 'insert head'
        button.addEventListener('click', () => {
          const nextItems = setupState.items.value.slice()
          nextItems.splice(0, 0, setupState.nextId.value)
          setupState.items.value = nextItems
          setupState.nextId.value += 1
        })

        root.append(button, anchor)

        watchEffect(() => {
          renderAnchor(
            <TransitionGroup tag="ul" name="fade" type="transition" duration={1000}>
              {setupState.items.value.map(item => (
                <li data-testid={`head-item-${item}`} key={item}>
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

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    ;(container.querySelector('#insert-head') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '6x',
      '1x',
      '2x',
      '3x',
      '4x',
      '5x',
    ])
    expect(
      container
        .querySelector('[data-testid="head-item-6"]')
        ?.classList.contains('fade-enter-active'),
    ).toBe(true)
  })

  it('keeps the FLIP transform applied while enabling the move transition class', async () => {
    const moveTransforms: string[] = []
    const originalAddClass = TransitionUtils.addClass

    vi.spyOn(TransitionUtils, 'addClass').mockImplementation((el, cls) => {
      if (cls === 'fade-move') {
        moveTransforms.push(el.style.transform)
      }
      originalAddClass(el, cls)
    })

    const rect = (top: number): DOMRect =>
      ({
        x: 0,
        y: top,
        width: 100,
        height: 16,
        top,
        right: 100,
        bottom: top + 16,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement && this.tagName === 'LI' && this.parentElement) {
          const siblings = Array.from(this.parentElement.children).filter(
            child => child instanceof HTMLElement && !child.hasAttribute('data-rue-leaving'),
          )
          return rect(siblings.indexOf(this) * 24)
        }
        return rect(0)
      },
    )

    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:transition-group-move-order:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3]),
        })),
      ) as { items: { value: number[] } }

      return vapor(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('transition-group-move-anchor')

        button.id = 'reverse-move'
        button.textContent = 'reverse'
        button.addEventListener('click', () => {
          setupState.items.value = setupState.items.value.slice().reverse()
        })

        root.append(button, anchor)

        watchEffect(() => {
          renderAnchor(
            <TransitionGroup tag="ul" name="fade" type="transition" duration={1000}>
              {setupState.items.value.map(item => (
                <li data-testid={`move-item-${item}`} key={item}>
                  {item}
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

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    ;(container.querySelector('#reverse-move') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '3',
      '2',
      '1',
    ])
    expect(moveTransforms.some(value => value.startsWith('translate('))).toBe(true)
  })

  it('animates a compiled-style TransitionGroup insert', async () => {
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:compiled-transition-group:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3]),
          nextId: ref(4),
        })),
      ) as { items: { value: number[] }; nextId: { value: number } }

      return vaporRuntime(() => {
        const root = document.createElement('section')
        const button = document.createElement('button')
        const anchor = document.createComment('compiled-transition-group-anchor')

        button.id = 'compiled-insert'
        button.textContent = 'insert compiled'
        button.addEventListener('click', () => {
          const nextItems = setupState.items.value.slice()
          nextItems.splice(0, 0, setupState.nextId.value)
          setupState.items.value = nextItems
          setupState.nextId.value += 1
        })

        root.append(button, anchor)

        watchVaporEffect(() => {
          const slot = _$createComponent(TransitionGroup, {
            tag: 'ul',
            name: 'fade',
            type: 'transition',
            duration: 1000,
            children: setupState.items.value.map(item =>
              _$vaporWithKey(
                vaporRuntime(() => {
                  const fragment = document.createDocumentFragment()
                  const li = document.createElement('li')
                  li.dataset.testid = `compiled-item-${item}`
                  li.setAttribute('key', String(item))
                  li.textContent = String(item)
                  fragment.appendChild(li)
                  return fragment as any
                }),
                item,
              ),
            ),
          })
          renderVaporAnchor(slot, root as any, anchor as any)
        })

        return root as any
      })
    }

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '1',
      '2',
      '3',
    ])

    ;(container.querySelector('#compiled-insert') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '4',
      '1',
      '2',
      '3',
    ])
    expect(
      container
        .querySelector('[data-testid="compiled-item-4"]')
        ?.classList.contains('fade-enter-active'),
    ).toBe(true)
  })

  it('keeps TransitionGroup children stable through a component children wrapper', async () => {
    const Wrapper = (props: { children?: unknown }) => (
      <div data-testid="wrapper">{props.children}</div>
    )
    const Example = () => {
      const setupState = _$vaporWithHookId('useSetup:transition-group-wrapper-head-insert:0', () =>
        useSetup(() => ({
          items: ref<number[]>([1, 2, 3, 4, 5]),
          nextId: ref(6),
          activeTab: ref<'preview' | 'code'>('preview'),
        })),
      ) as {
        items: { value: number[] }
        nextId: { value: number }
        activeTab: { value: 'preview' | 'code' }
      }

      const insert = () => {
        const nextItems = setupState.items.value.slice()
        nextItems.splice(0, 0, setupState.nextId.value)
        setupState.items.value = nextItems
        setupState.nextId.value += 1
      }

      return (
        <Wrapper>
          <button id="insert-wrapper-head" onClick={insert}>
            insert head
          </button>
          {setupState.activeTab.value === 'preview' && (
            <TransitionGroup tag="ul" name="fade" type="transition" duration={1000}>
              {setupState.items.value.map(item => (
                <li data-testid={`wrapper-item-${item}`} key={item}>
                  {item}
                  <button type="button">x</button>
                </li>
              ))}
            </TransitionGroup>
          )}
        </Wrapper>
      )
    }

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    ;(container.querySelector('#insert-wrapper-head') as HTMLButtonElement).click()
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '6x',
      '1x',
      '2x',
      '3x',
      '4x',
      '5x',
    ])
    expect(
      container
        .querySelector('[data-testid="wrapper-item-6"]')
        ?.classList.contains('fade-enter-active'),
    ).toBe(true)
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

    const container = mountTestContainer()

    render(<Example />, container)
    await flush()

    expect(document.body.querySelector('#modal-panel')).toBeNull()

    ;(container.querySelector('#open') as HTMLButtonElement).click()
    await waitForContent(() => {
      expect(document.body.querySelector('#modal-panel')?.textContent).toBe('hello modal')
    })

    ;(document.body.querySelector('#modal-mask') as HTMLDivElement).click()
    await waitForContent(() => {
      expect(document.body.querySelector('#modal-panel')).toBeNull()
    })
  })
})
