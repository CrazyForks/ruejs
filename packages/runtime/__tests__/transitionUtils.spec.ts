import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addClass,
  inferType,
  removeClass,
  resolveDuration,
  toMs,
  whenTransitionEnds,
} from '../src/components/transitionUtils'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('transitionUtils', () => {
  it('adds and removes whitespace-separated class lists', () => {
    const el = document.createElement('div')

    addClass(el, 'alpha   beta gamma')

    expect(Array.from(el.classList)).toEqual(['alpha', 'beta', 'gamma'])

    removeClass(el, 'beta gamma')

    expect(Array.from(el.classList)).toEqual(['alpha'])
  })

  it('parses CSS time lists and falls back to inline styles when computed durations are zero', () => {
    const el = document.createElement('div')

    el.style.transition = 'opacity 0.2s ease 0.1s, transform 50ms linear 25ms'
    el.style.animation = 'fade 20ms linear 10ms'

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0s',
      transitionDelay: '0s',
      animationDuration: '0s',
      animationDelay: '0s',
    } as CSSStyleDeclaration)

    expect(toMs('0.2s, 150ms, auto, invalid')).toBe(350)
    expect(inferType(el)).toBe('transition')
    expect(inferType(el, 'animation')).toBe('animation')
    expect(resolveDuration(el, undefined, undefined, 'enter')).toBe(375)
    expect(resolveDuration(el, 'animation', undefined, 'leave')).toBe(30)
    expect(resolveDuration(el, undefined, { enter: 40, leave: 90 }, 'leave')).toBe(90)
  })

  it('waits for the matching end event once and ignores bubbled child events', () => {
    const el = document.createElement('div')
    const child = document.createElement('span')
    const onEnd = vi.fn()

    el.appendChild(child)

    whenTransitionEnds(el, 'transition', 100, onEnd)

    child.dispatchEvent(new Event('transitionend', { bubbles: true }))
    expect(onEnd).not.toHaveBeenCalled()

    el.dispatchEvent(new Event('transitionend'))
    el.dispatchEvent(new Event('transitionend'))

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('falls back to the timeout when no end event is fired', () => {
    vi.useFakeTimers()

    const el = document.createElement('div')
    const onEnd = vi.fn()

    whenTransitionEnds(el, 'animation', 25, onEnd)

    vi.advanceTimersByTime(74)
    expect(onEnd).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})