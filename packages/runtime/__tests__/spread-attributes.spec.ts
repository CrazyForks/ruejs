import { describe, expect, it } from 'vitest'
import { spreadAttributes } from '../src/dom'
import { flush } from './page-test-utils'

describe('spreadAttributes', () => {
  it('keeps independent spread calls on the same element from removing each other', async () => {
    const el = document.createElement('label')

    spreadAttributes(el as any, { 'data-testid': 'root', title: 'Root' })
    spreadAttributes(el as any, {
      'aria-required': undefined,
      'aria-invalid': undefined,
    })

    expect(el.getAttribute('data-testid')).toBe('root')
    expect(el.getAttribute('title')).toBe('Root')
    expect(el.hasAttribute('aria-required')).toBe(false)

    await flush()

    spreadAttributes(el as any, { 'aria-required': 'true', 'aria-invalid': undefined })

    expect(el.getAttribute('data-testid')).toBe('root')
    expect(el.getAttribute('aria-required')).toBe('true')
    expect(el.hasAttribute('aria-invalid')).toBe(false)
  })

  it('still removes stale keys for a single spread source', async () => {
    const el = document.createElement('button')

    spreadAttributes(el as any, { title: 'Save', 'data-state': 'ready' })
    expect(el.getAttribute('title')).toBe('Save')
    expect(el.getAttribute('data-state')).toBe('ready')

    await flush()

    spreadAttributes(el as any, { 'data-state': 'done' })

    expect(el.hasAttribute('title')).toBe(false)
    expect(el.getAttribute('data-state')).toBe('done')
  })

  it('drops stale records when later spread calls disappear', async () => {
    const el = document.createElement('label')

    spreadAttributes(el as any, { 'data-testid': 'root' })
    spreadAttributes(el as any, { title: 'Root title' })
    await flush()

    spreadAttributes(el as any, { 'data-testid': 'root' })
    await flush()

    expect(el.getAttribute('data-testid')).toBe('root')
    expect(el.hasAttribute('title')).toBe(false)
  })
})
