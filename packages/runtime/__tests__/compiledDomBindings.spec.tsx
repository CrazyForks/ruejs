// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { effect, signal } from '../../runtime-vapor/dist/compiled.js'
import { _$compiledRoot } from '../src/compiled-root'

const step = signal(0)

const bind = <T,>(read: () => T, write: (value: T) => void): void => {
  let previous: T | undefined
  effect(() => {
    const next = read()
    if (Object.is(previous, next)) return
    previous = next
    write(next)
  })
}

const ScalarBindings = () =>
  _$compiledRoot(() => {
    const root = document.createElement('section')
    const text = document.createElement('span')
    const input = document.createElement('input')
    text.dataset.binding = 'text'
    input.dataset.binding = 'input'
    root.append(text, input)

    bind(
      () => (step.get() < 2 ? 'idle' : 'ready'),
      value => {
        root.className = value
      },
    )
    bind(
      () => String(step.get() < 2 ? 'color:red' : 'color:blue'),
      value => {
        root.style.cssText = value
      },
    )
    bind(
      () => (step.get() < 2 ? 'present' : null),
      value => {
        if (value == null) root.removeAttribute('title')
        else root.setAttribute('title', String(value))
      },
    )
    bind(
      () => String(step.get() < 2 ? 'first' : 'second'),
      value => {
        text.textContent = value
      },
    )
    bind(
      () => String(step.get() < 2 ? 'one' : 'two'),
      value => {
        input.value = value
      },
    )
    bind(
      () => Boolean(step.get() >= 2),
      value => {
        input.checked = value
      },
    )
    bind(
      () => Boolean(step.get() >= 2),
      value => {
        input.disabled = value
      },
    )

    return root
  })

const flushCompiledEffects = async (): Promise<void> => {
  const waitForScheduler = (): Promise<void> =>
    typeof requestAnimationFrame === 'function'
      ? new Promise(resolve => requestAnimationFrame(() => resolve()))
      : Promise.resolve()

  await waitForScheduler()
  await waitForScheduler()
  await waitForScheduler()
}

const trackPropertyWrites = (target: object, property: string): (() => number) => {
  let owner: object | null = target
  let descriptor: PropertyDescriptor | undefined
  while (owner && descriptor === undefined) {
    descriptor = Object.getOwnPropertyDescriptor(owner, property)
    owner = Object.getPrototypeOf(owner)
  }
  if (!descriptor?.get || !descriptor.set) {
    throw new Error(`Missing writable descriptor for ${property}`)
  }

  let writes = 0
  Object.defineProperty(target, property, {
    configurable: true,
    get: () => descriptor.get?.call(target),
    set: value => {
      writes += 1
      descriptor.set?.call(target, value)
    },
  })
  return () => writes
}

afterEach(() => {
  step.set(0)
  document.body.innerHTML = ''
})

describe('compiled scalar DOM bindings', () => {
  it('writes each binding only when its normalized value changes and stops after dispose', async () => {
    const host = document.createElement('main')
    document.body.appendChild(host)

    const handle = ScalarBindings() as unknown as {
      __rue_vapor_setup(parent: ParentNode): Node | null | undefined
      dispose(): void
    }
    const mounted = handle.__rue_vapor_setup(host)
    if (!(mounted instanceof HTMLElement)) throw new Error('Expected a compiled HTMLElement root')
    host.appendChild(mounted)

    const text = mounted.querySelector<HTMLElement>('[data-binding="text"]')
    const input = mounted.querySelector<HTMLInputElement>('[data-binding="input"]')
    if (!text || !input) throw new Error('Expected binding targets')

    const classWrites = trackPropertyWrites(mounted, 'className')
    const styleWrites = trackPropertyWrites(mounted.style, 'cssText')
    const textWrites = trackPropertyWrites(text, 'textContent')
    const valueWrites = trackPropertyWrites(input, 'value')
    const checkedWrites = trackPropertyWrites(input, 'checked')
    const disabledWrites = trackPropertyWrites(input, 'disabled')
    const originalSetAttribute = mounted.setAttribute.bind(mounted)
    const originalRemoveAttribute = mounted.removeAttribute.bind(mounted)
    let titleWrites = 0
    mounted.setAttribute = (name, value) => {
      if (name === 'title') titleWrites += 1
      originalSetAttribute(name, value)
    }
    mounted.removeAttribute = name => {
      if (name === 'title') titleWrites += 1
      originalRemoveAttribute(name)
    }

    expect(host.innerHTML).toContain('class="idle"')
    expect(text.textContent).toBe('first')
    expect(input.value).toBe('one')
    expect(input.checked).toBe(false)
    expect(input.disabled).toBe(false)

    step.set(1)
    await flushCompiledEffects()

    expect({
      class: classWrites(),
      style: styleWrites(),
      title: titleWrites,
      text: textWrites(),
      value: valueWrites(),
      checked: checkedWrites(),
      disabled: disabledWrites(),
    }).toEqual({ class: 0, style: 0, title: 0, text: 0, value: 0, checked: 0, disabled: 0 })

    step.set(2)
    await flushCompiledEffects()

    expect({
      class: classWrites(),
      style: styleWrites(),
      title: titleWrites,
      text: textWrites(),
      value: valueWrites(),
      checked: checkedWrites(),
      disabled: disabledWrites(),
    }).toEqual({ class: 1, style: 1, title: 1, text: 1, value: 1, checked: 1, disabled: 1 })
    expect(mounted.className).toBe('ready')
    expect(mounted.getAttribute('style')).toContain('color: blue')
    expect(mounted.hasAttribute('title')).toBe(false)
    expect(text.textContent).toBe('second')
    expect(input.value).toBe('two')
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)

    handle.dispose()
    expect(host.innerHTML).toBe('')

    step.set(3)
    await flushCompiledEffects()

    expect({
      class: classWrites(),
      style: styleWrites(),
      title: titleWrites,
      text: textWrites(),
      value: valueWrites(),
      checked: checkedWrites(),
      disabled: disabledWrites(),
    }).toEqual({ class: 1, style: 1, title: 1, text: 1, value: 1, checked: 1, disabled: 1 })
  })
})
