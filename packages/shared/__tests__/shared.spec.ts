// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { NO, extend } from '../src'

describe('@rue-js/shared', () => {
  it('provides a no-op predicate that always returns false', () => {
    expect(NO()).toBe(false)
    expect((NO as (...args: unknown[]) => boolean)('ignored', 1, null)).toBe(false)
  })

  it('shallowly merges truthy sources in order into a null-prototype object', () => {
    const nested = { count: 1 }
    const result = extend(
      null,
      {
        foo: 'first',
        nested,
      },
      undefined,
      false,
      0,
      {
        foo: 'second',
        bar: 2,
      },
    )

    expect(Object.getPrototypeOf(result)).toBe(null)
    expect(Object.keys(result)).toEqual(['foo', 'nested', 'bar'])
    expect(result.foo).toBe('second')
    expect(result.bar).toBe(2)
    expect(result.nested).toBe(nested)
  })

  it('copies enumerable source properties without inheriting source prototypes', () => {
    const proto = {
      inherited: 'copied',
    }
    const source = Object.create(proto)
    source.own = 'own'
    Object.defineProperty(source, 'hidden', {
      value: 'hidden',
      enumerable: false,
    })

    const result = extend(source)

    expect(Object.getPrototypeOf(result)).toBe(null)
    expect(Object.prototype.hasOwnProperty.call(result, 'own')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(result, 'inherited')).toBe(true)
    expect(result.own).toBe('own')
    expect(result.inherited).toBe('copied')
    expect('hidden' in result).toBe(false)
    expect('toString' in result).toBe(false)
  })

  it('keeps prototype-like keys as data properties on the null-prototype target', () => {
    const source = Object.create(null)
    source.__proto__ = {
      polluted: true,
    }
    source.constructor = 'constructor value'

    const result = extend(source)

    expect(Object.getPrototypeOf(result)).toBe(null)
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true)
    expect(result.__proto__).toEqual({
      polluted: true,
    })
    expect(result.constructor).toBe('constructor value')
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})
