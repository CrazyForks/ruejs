import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTransitionRunner } from '../src/components/BaseTransition'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createTransitionRunner', () => {
  it('applies appear classes and clears them after the transition ends', () => {
    const el = document.createElement('div')
    let scheduledFrame: FrameRequestCallback | undefined

    const onBeforeEnter = vi.fn()
    const onBeforeAppear = vi.fn()
    const onAfterEnter = vi.fn()
    const onAfterAppear = vi.fn()
    const onDone = vi.fn()

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      scheduledFrame = callback
      return 1
    })

    const { runEnter } = createTransitionRunner({
      name: 'fade',
      type: 'transition',
      duration: 100,
      appear: true,
      appearFromClass: 'fade-appear-from',
      appearActiveClass: 'fade-appear-active',
      appearToClass: 'fade-appear-to',
      onBeforeEnter,
      onBeforeAppear,
      onAfterEnter,
      onAfterAppear,
    })

    runEnter(el, 'appear', onDone)

    expect(onBeforeEnter).toHaveBeenCalledWith(el)
    expect(onBeforeAppear).toHaveBeenCalledWith(el)
    expect(el.classList.contains('fade-appear-from')).toBe(true)
    expect(el.classList.contains('fade-appear-active')).toBe(true)
    expect(el.classList.contains('fade-appear-to')).toBe(false)

    scheduledFrame?.(0)

    expect(el.classList.contains('fade-appear-from')).toBe(false)
    expect(el.classList.contains('fade-appear-active')).toBe(true)
    expect(el.classList.contains('fade-appear-to')).toBe(true)

    el.dispatchEvent(new Event('transitionend'))

    expect(onAfterEnter).toHaveBeenCalledWith(el)
    expect(onAfterAppear).toHaveBeenCalledWith(el)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('fade-appear-active')).toBe(false)
    expect(el.classList.contains('fade-appear-to')).toBe(false)
  })

  it('delegates leave completion to the user hook when css is disabled', () => {
    const el = document.createElement('div')
    const onBeforeLeave = vi.fn()
    const onAfterLeave = vi.fn()
    const onDone = vi.fn()
    let finishLeave = () => {}

    const { runLeave } = createTransitionRunner({
      css: false,
      duration: 0,
      onBeforeLeave,
      onLeave: (_el, done) => {
        finishLeave = done
      },
      onAfterLeave,
    })

    runLeave(el, onDone)

    expect(onBeforeLeave).toHaveBeenCalledWith(el)
    expect(onAfterLeave).not.toHaveBeenCalled()
    expect(el.className).toBe('')

    finishLeave()

    expect(onAfterLeave).toHaveBeenCalledWith(el)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
