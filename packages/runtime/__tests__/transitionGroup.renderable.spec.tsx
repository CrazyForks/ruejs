import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  _$vaporWithHookId,
  TransitionGroup,
  render,
  renderAnchor,
  ref,
  setReactiveScheduling,
  signal,
  useSetup,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import {
  _$createComponent,
  _$vaporWithKey,
  renderAnchor as renderVaporAnchor,
  vapor as vaporRuntime,
  watchEffect as watchVaporEffect,
} from '../src/vapor'

setReactiveScheduling('sync')

let activeContainer: HTMLDivElement | null = null

afterEach(() => {
  if (activeContainer) {
    render(null as any, activeContainer)
    activeContainer = null
  }
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('TransitionGroup renderable boundary', () => {
  it('updates keyed children without leaving stale DOM behind', async () => {
    const items = signal(['a', 'b', 'c'])
    const ListHarness: FC = () =>
      vapor(() => {
        const root = document.createElement('section')
        const anchor = document.createComment('transition-group-anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <ul>
              <TransitionGroup name="fade" duration={0}>
                {items.get().map((item: string) => (
                  <li data-testid={`item-${item}`} key={item}>
                    {item}
                  </li>
                ))}
              </TransitionGroup>
            </ul>,
            root,
            anchor,
          )
        })

        return root
      }) as any

    const container = document.createElement('div')
    activeContainer = container
    document.body.appendChild(container)

    render(<ListHarness />, container)
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      'a',
      'b',
      'c',
    ])

    items.set(['b', 'd'])
    await flush()

    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual(['b', 'd'])
    expect(container.querySelector('[data-testid="item-a"]')).toBeNull()
    expect(container.querySelector('[data-testid="item-c"]')).toBeNull()

    items.set(['b', 'e', 'd'])
    await flush()

    expect(Array.from(container.querySelectorAll(':scope li li')).length).toBe(0)
    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      'b',
      'e',
      'd',
    ])
  })

  it('keeps repeated same-slot insertions flat in tag mode without transition timing', async () => {
    const items = signal([1, 2, 3])
    const ListHarness: FC = () =>
      vapor(() => {
        const root = document.createElement('section')
        const anchor = document.createComment('transition-group-repeat-anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <TransitionGroup tag="ul" name="fade" duration={0}>
              {items.get().map((item: number) => (
                <li data-testid={`repeat-item-${item}`} key={item}>
                  {item}
                </li>
              ))}
            </TransitionGroup>,
            root,
            anchor,
          )
        })

        return root
      }) as any

    const container = document.createElement('div')
    activeContainer = container
    document.body.appendChild(container)

    render(<ListHarness />, container)
    await flush()

    items.set([1, 4, 2, 3])
    await flush()
    items.set([1, 5, 4, 2, 3])
    await flush()

    expect(Array.from(container.querySelectorAll('li li'))).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '1',
      '5',
      '4',
      '2',
      '3',
    ])
  })

  it('plain keyed ul also stays flat for repeated same-slot insertions', async () => {
    const items = signal([1, 2, 3])
    const ListHarness: FC = () =>
      vapor(() => {
        const root = document.createElement('section')
        const anchor = document.createComment('plain-repeat-anchor')
        root.appendChild(anchor)

        watchEffect(() => {
          renderAnchor(
            <ul>
              {items.get().map((item: number) => (
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
      }) as any

    const container = document.createElement('div')
    activeContainer = container
    document.body.appendChild(container)

    render(<ListHarness />, container)
    await flush()

    items.set([1, 4, 2, 3])
    await flush()
    items.set([1, 5, 4, 2, 3])
    await flush()

    expect(Array.from(container.querySelectorAll('li li'))).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('li'), el => el.textContent)).toEqual([
      '1',
      '5',
      '4',
      '2',
      '3',
    ])
  })

  it('ignores stale FLIP work during consecutive reorders and preserves keyed DOM identity', async () => {
    const rectReads = new Map<string, number>()
    const classAdd = vi.spyOn(DOMTokenList.prototype, 'add')
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement && this.tagName === 'LI' && this.parentElement) {
          const key = this.textContent ?? ''
          rectReads.set(key, (rectReads.get(key) ?? 0) + 1)
          const index = Array.from(this.parentElement.children).indexOf(this)
          return {
            x: index * 10,
            y: 0,
            width: 10,
            height: 10,
            top: 0,
            right: index * 10 + 10,
            bottom: 10,
            left: index * 10,
            toJSON: () => ({}),
          } as DOMRect
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        } as DOMRect
      },
    )
    const ListHarness: FC = () => {
      const setupState = _$vaporWithHookId('useSetup:transition-group-stale-flip:0', () =>
        useSetup(() => ({ items: ref(['a', 'b', 'c']) })),
      ) as { items: { value: string[] } }

      return vaporRuntime(() => {
        const root = document.createElement('section')
        const reorder = document.createElement('button')
        const anchor = document.createComment('transition-group-stale-flip-anchor')
        const children = new Map(
          ['a', 'b', 'c'].map(item => [
            item,
            _$vaporWithKey(
              vaporRuntime(() => {
                const fragment = document.createDocumentFragment()
                const li = document.createElement('li')
                li.setAttribute('key', item)
                li.dataset.testid = `moving-item-${item}`
                li.textContent = item
                fragment.appendChild(li)
                return fragment as any
              }),
              item,
            ),
          ]),
        )
        reorder.id = 'consecutive-reorder'
        reorder.addEventListener('click', () => {
          setupState.items.value = ['c', 'a', 'b']
          setupState.items.value = ['b', 'c', 'a']
        })
        root.append(reorder, anchor)

        watchVaporEffect(() => {
          const slot = _$createComponent(TransitionGroup, {
            tag: 'ul',
            name: 'move',
            duration: 0,
            children: setupState.items.value.map(item => children.get(item)),
          })
          renderVaporAnchor(slot, root as any, anchor as any)
        })

        return root as any
      }) as any
    }

    const container = document.createElement('div')
    activeContainer = container
    document.body.appendChild(container)

    render(<ListHarness />, container)
    await flush()

    rectReads.clear()
    ;(container.querySelector('#consecutive-reorder') as HTMLButtonElement).click()
    await flush()

    const finalElements = Array.from(container.querySelectorAll<HTMLLIElement>('li'))
    expect(finalElements.map(el => el.textContent)).toEqual(['b', 'c', 'a'])
    expect(finalElements.map(el => el.dataset.rueKey)).toEqual(['b', 'c', 'a'])
    expect(new Set(finalElements).size).toBe(3)
    expect(rectReads).toEqual(
      new Map([
        ['a', 1],
        ['b', 1],
        ['c', 1],
      ]),
    )
    expect(classAdd.mock.calls.filter(tokens => tokens.includes('move-move'))).toHaveLength(3)
  })
})
