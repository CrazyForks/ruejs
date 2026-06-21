import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, render, setReactiveScheduling, Suspense, useComponent, type FC } from '../src'

type AsyncLabelModule = { default: FC<{ label: string }> }

setReactiveScheduling('sync')

const flushSuspense = async () => {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve()
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Suspense', () => {
  it('renders fallback while a useComponent child is pending, then renders the resolved child', async () => {
    const deferred: { resolve?: (value: AsyncLabelModule) => void } = {}
    const Async = useComponent<{ label: string }>(
      () =>
        new Promise<AsyncLabelModule>(resolve => {
          deferred.resolve = resolve
        }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      h(
        Suspense,
        { fallback: h('span', { id: 'fallback' }, 'Loading dashboard...') },
        h(Async, { label: 'Revenue' }),
      ),
      container,
    )

    await flushSuspense()
    expect(container.querySelector('#fallback')?.textContent).toBe('Loading dashboard...')

    deferred.resolve?.({
      default: props => h('section', { id: 'resolved' }, props.label),
    })
    await flushSuspense()

    expect(container.querySelector('#fallback')).toBeNull()
    expect(container.querySelector('#resolved')?.textContent).toBe('Revenue')
  })

  it('emits pending, fallback, and resolve hooks around an async dependency', async () => {
    const deferred: { resolve?: (value: AsyncLabelModule) => void } = {}
    const Async = useComponent<{ label: string }>(
      () =>
        new Promise<AsyncLabelModule>(resolve => {
          deferred.resolve = resolve
        }),
    )
    const onPending = vi.fn()
    const onFallback = vi.fn()
    const onResolve = vi.fn()

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      h(
        Suspense,
        {
          fallback: h('span', { id: 'fallback' }, 'Loading...'),
          onPending,
          onFallback,
          onResolve,
        },
        h(Async, { label: 'Done' }),
      ),
      container,
    )

    await flushSuspense()
    expect(onPending).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onResolve).not.toHaveBeenCalled()

    deferred.resolve?.({
      default: props => h('section', { id: 'resolved' }, props.label),
    })
    await flushSuspense()

    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  it('keeps nested Suspense dependencies inside the child boundary by default', async () => {
    const deferred: { resolve?: (value: AsyncLabelModule) => void } = {}
    const Async = useComponent<{ label: string }>(
      () =>
        new Promise<AsyncLabelModule>(resolve => {
          deferred.resolve = resolve
        }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      h(
        Suspense,
        { fallback: h('span', { id: 'outer-fallback' }, 'Outer loading') },
        h(
          Suspense,
          { fallback: h('span', { id: 'inner-fallback' }, 'Inner loading') },
          h(Async, { label: 'Nested' }),
        ),
      ),
      container,
    )

    await flushSuspense()

    expect(container.querySelector('#outer-fallback')).toBeNull()
    expect(container.querySelector('#inner-fallback')?.textContent).toBe('Inner loading')

    deferred.resolve?.({
      default: props => h('section', { id: 'nested-resolved' }, props.label),
    })
    await flushSuspense()

    expect(container.querySelector('#inner-fallback')).toBeNull()
    expect(container.querySelector('#nested-resolved')?.textContent).toBe('Nested')
  })

  it('forwards nested Suspense dependencies to the parent boundary when suspensible is true', async () => {
    const deferred: { resolve?: (value: AsyncLabelModule) => void } = {}
    const Async = useComponent<{ label: string }>(
      () =>
        new Promise<AsyncLabelModule>(resolve => {
          deferred.resolve = resolve
        }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      h(
        Suspense,
        { fallback: h('span', { id: 'outer-fallback' }, 'Outer loading') },
        h(
          Suspense,
          {
            fallback: h('span', { id: 'inner-fallback' }, 'Inner loading'),
            suspensible: true,
          },
          h(Async, { label: 'Nested' }),
        ),
      ),
      container,
    )

    await flushSuspense()

    expect(container.querySelector('#outer-fallback')?.textContent).toBe('Outer loading')
    expect(container.querySelector('#nested-resolved')).toBeNull()

    deferred.resolve?.({
      default: props => h('section', { id: 'nested-resolved' }, props.label),
    })
    await flushSuspense()

    expect(container.querySelector('#outer-fallback')).toBeNull()
    expect(container.querySelector('#nested-resolved')?.textContent).toBe('Nested')
  })
})
