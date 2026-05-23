// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick, setReactiveScheduling } from '@rue-js/rue'

import {
  createParser,
  createQuerySync,
  createStore,
  debounce,
  defineStore,
  parseAsInteger,
  parseAsString,
  throttle,
} from '../src'

const mountedRoots: ReturnType<typeof createStore>[] = []

const createTestRoot = () => {
  const root = createStore()
  mountedRoots.push(root)
  return root
}

const flush = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

const flushFakeTimers = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const resetUrl = (path = '/') => {
  window.history.replaceState(null, '', path)
}

const readSearch = () => new URLSearchParams(window.location.search)

describe('store query sync plugin', () => {
  beforeEach(() => {
    setReactiveScheduling('sync')
    resetUrl('/')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.dispose()
    }
    setReactiveScheduling('sync')
    resetUrl('/')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hydrates configured fields from query params and omits defaults on writeback', async () => {
    resetUrl('/products?keep=1&q=rue&page=3')

    const root = createTestRoot()
    root.use(
      createQuerySync({
        stores: {
          filters: {
            q: { path: 'query', parser: parseAsString.withDefault('') },
            page: parseAsInteger.withDefault(1),
          },
        },
      }),
    )

    const useFiltersStore = defineStore('filters', {
      state: () => ({
        query: '',
        page: 1,
        localOnly: 'keep-local',
      }),
    })

    const store = useFiltersStore(root)

    expect(store.query).toBe('rue')
    expect(store.page).toBe(3)
    expect(store.localOnly).toBe('keep-local')

    store.query = ''
    store.page = 1
    await flush()

    expect(readSearch().get('keep')).toBe('1')
    expect(readSearch().has('q')).toBe(false)
    expect(readSearch().has('page')).toBe(false)
  })

  it('writes changes with push history and rehydrates from popstate while preserving hash routes', async () => {
    resetUrl('/?q=alpha#/examples/demo')

    const pushState = vi.spyOn(window.history, 'pushState')
    const root = createTestRoot()
    root.use(
      createQuerySync({
        stores: {
          filters: {
            q: { path: 'query', parser: parseAsString.withDefault(''), history: 'push' },
          },
        },
      }),
    )

    const useFiltersStore = defineStore('filters', {
      state: () => ({
        query: '',
      }),
    })

    const store = useFiltersStore(root)

    expect(store.query).toBe('alpha')
    expect(window.location.hash).toBe('#/examples/demo')

    store.query = 'beta'
    await flush()

    expect(pushState).toHaveBeenCalledTimes(1)
    expect(readSearch().get('q')).toBe('beta')
    expect(window.location.hash).toBe('#/examples/demo')

    window.history.pushState(null, '', '/?q=restored#/examples/demo')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush()

    expect(store.query).toBe('restored')
  })

  it('supports custom parsers for multi-value fields', async () => {
    const parseAsTags = createParser<string[]>({
      parse: value => (value ? value.split(',').filter(Boolean) : null),
      serialize: value => value.join(','),
      equals: (left, right) => left.join(',') === right.join(','),
    }).withDefault([])

    resetUrl('/?tags=red,blue')

    const root = createTestRoot()
    root.use(
      createQuerySync({
        stores: {
          filters: {
            tags: parseAsTags,
          },
        },
      }),
    )

    const useFiltersStore = defineStore('filters', {
      state: () => ({
        tags: [] as string[],
      }),
    })

    const store = useFiltersStore(root)
    expect(store.tags).toEqual(['red', 'blue'])

    store.tags = ['green', 'yellow']
    await flush()

    expect(readSearch().get('tags')).toBe('green,yellow')

    window.history.replaceState(null, '', '/?tags=cyan,magenta')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush()

    expect(store.tags).toEqual(['cyan', 'magenta'])
  })

  it('debounces high-frequency query updates while keeping local state immediate', async () => {
    vi.useFakeTimers()
    resetUrl('/?q=alpha')

    const root = createTestRoot()
    root.use(
      createQuerySync({
        limitUrlUpdates: debounce(300),
        stores: {
          filters: {
            q: { path: 'query', parser: parseAsString.withDefault('') },
          },
        },
      }),
    )

    const replaceState = vi.spyOn(window.history, 'replaceState')
    const useFiltersStore = defineStore('filters', {
      state: () => ({
        query: '',
      }),
    })

    const store = useFiltersStore(root)
    expect(store.query).toBe('alpha')

    store.query = 'a'
    await flushFakeTimers()
    store.query = 'ab'
    await flushFakeTimers()

    expect(store.query).toBe('ab')
    expect(readSearch().get('q')).toBe('alpha')
    expect(replaceState).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    await flushFakeTimers()

    expect(readSearch().get('q')).toBe('alpha')

    vi.advanceTimersByTime(1)
    await flushFakeTimers()

    expect(readSearch().get('q')).toBe('ab')
    expect(replaceState).toHaveBeenCalledTimes(1)
  })

  it('throttles repeated query updates but keeps the first write eager', async () => {
    vi.useFakeTimers()
    resetUrl('/?tab=overview')

    const root = createTestRoot()
    root.use(
      createQuerySync({
        stores: {
          filters: {
            tab: {
              parser: parseAsString.withDefault('overview'),
              history: 'push',
              limitUrlUpdates: throttle(200),
            },
          },
        },
      }),
    )

    const pushState = vi.spyOn(window.history, 'pushState')
    const useFiltersStore = defineStore('filters', {
      state: () => ({
        tab: 'overview',
      }),
    })

    const store = useFiltersStore(root)

    store.tab = 'preview'
    await flushFakeTimers()

    expect(readSearch().get('tab')).toBe('preview')
    expect(pushState).toHaveBeenCalledTimes(1)

    store.tab = 'code'
    await flushFakeTimers()

    expect(store.tab).toBe('code')
    expect(readSearch().get('tab')).toBe('preview')

    vi.advanceTimersByTime(199)
    await flushFakeTimers()
    expect(readSearch().get('tab')).toBe('preview')

    vi.advanceTimersByTime(1)
    await flushFakeTimers()

    expect(readSearch().get('tab')).toBe('code')
    expect(pushState).toHaveBeenCalledTimes(2)
  })
})
