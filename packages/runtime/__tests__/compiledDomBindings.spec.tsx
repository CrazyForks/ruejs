// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import * as compiledRuntime from '../src/internal'

const step = compiledRuntime.signal(0)

const bind = <T,>(read: () => T, write: (value: T) => void): void => {
  let previous: T | undefined
  compiledRuntime.effect(() => {
    const next = read()
    if (Object.is(previous, next)) return
    previous = next
    write(next)
  })
}

const scalarBindings = compiledRuntime._$compiledRoot(() => {
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
  const getter = (target as any).__lookupGetter__(property) as (() => unknown) | undefined
  const setter = (target as any).__lookupSetter__(property) as
    | ((value: unknown) => void)
    | undefined
  expect(getter, `Missing getter for ${property}`).toBeTypeOf('function')
  expect(setter, `Missing setter for ${property}`).toBeTypeOf('function')

  let writes = 0
  Object.defineProperty(target, property, {
    configurable: true,
    get: () => getter?.call(target),
    set: value => {
      writes += 1
      setter?.call(target, value)
    },
  })
  return () => writes
}

afterEach(() => {
  compiledRuntime.setReactiveScheduling('frame')
  step.set(0)
  document.body.innerHTML = ''
})

describe('compiled scalar DOM bindings', () => {
  it('normalizes text and skips writes when raw values render identically', () => {
    compiledRuntime.setReactiveScheduling('sync')
    const source = compiledRuntime.signal<unknown>(null)
    let textContent: string | null = 'stale'
    let writes = 0
    const node = {
      get textContent() {
        return textContent
      },
      set textContent(value: string | null) {
        writes += 1
        textContent = value
      },
    }

    const binding = compiledRuntime._$compiledText(node, () => source.get())
    expect({ textContent, writes }).toEqual({ textContent: '', writes: 1 })

    source.set(false)
    source.set(undefined)
    expect({ textContent, writes }).toEqual({ textContent: '', writes: 1 })

    source.set(0)
    source.set('0')
    expect({ textContent, writes }).toEqual({ textContent: '0', writes: 2 })

    binding.dispose()
    source.set('after-dispose')
    expect({ textContent, writes }).toEqual({ textContent: '0', writes: 2 })
  })

  it('writes each binding only when its normalized value changes and stops after dispose', async () => {
    const host = document.createElement('main')
    document.body.appendChild(host)

    const handle = scalarBindings as unknown as {
      __rue_compiled_mount(parent: ParentNode): Node | null | undefined
      dispose(): void
    }
    const mounted = handle.__rue_compiled_mount(host)
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
