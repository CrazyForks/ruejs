// @vitest-environment jsdom

import { computed, nextTick, ref, watchEffect } from '@rue-js/rue'
import { createStore, defineStore, storeToRefs } from '../src'

describe('@rue-js/store', () => {
  it('supports options stores with getters, actions, patching and subscriptions', async () => {
    const root = createStore()

    const useCounterStore = defineStore('counter', {
      state: () => ({
        count: 0,
        nested: {
          label: 'seed',
        },
      }),
      getters: {
        double(state: any) {
          return state.count * 2
        },
        summary(this: any) {
          return `${this.count}:${this.double}:${this.nested.label}`
        },
      },
      actions: {
        increment(this: any, step = 1) {
          this.count += step
        },
        rename(this: any, label: string) {
          this.nested.label = label
        },
      },
    })

    const store = useCounterStore(root)
    const doubles: number[] = []
    const stopEffect = watchEffect(() => {
      doubles.push(store.double)
    })

    const snapshots: string[] = []
    const unsubscribe = store.$subscribe((_mutation, state) => {
      snapshots.push(`${state.count}:${state.nested.label}`)
    })

    expect(store.summary).toBe('0:0:seed')

    store.increment()
    await nextTick()
    expect(store.summary).toBe('1:2:seed')

    store.$patch({
      nested: {
        label: 'patched',
      },
    })
    await nextTick()
    expect(store.summary).toBe('1:2:patched')

    store.$set(['nested', 'label'], 'path')
    await nextTick()
    expect(store.summary).toBe('1:2:path')

    store.increment(2)
    await nextTick()
    expect(store.summary).toBe('3:6:path')

    store.$reset()
    await nextTick()
    expect(store.summary).toBe('0:0:seed')
    expect(doubles).toEqual([0, 2, 6, 0])
    expect(snapshots).toEqual(['1:seed', '1:patched', '1:path', '3:path', '0:seed'])

    unsubscribe()
    stopEffect.dispose()
  })

  it('isolates the same store definition across store roots', async () => {
    const rootA = createStore()
    const rootB = createStore()

    const usePreferencesStore = defineStore('preferences', {
      state: () => ({
        theme: 'light',
      }),
      actions: {
        toggle(this: any) {
          this.theme = this.theme === 'light' ? 'dark' : 'light'
        },
      },
    })

    const storeA = usePreferencesStore(rootA)
    const storeB = usePreferencesStore(rootB)

    storeA.toggle()
    await nextTick()

    expect(storeA.theme).toBe('dark')
    expect(storeB.theme).toBe('light')
    expect(usePreferencesStore(rootA)).toBe(storeA)
    expect(usePreferencesStore(rootB)).toBe(storeB)
  })

  it('supports setup stores and storeToRefs for writable state', async () => {
    const root = createStore()

    const useSessionStore = defineStore('session', () => {
      const token = ref('alpha')
      const upper = computed(() => token.value.toUpperCase())

      const update = (nextToken: string) => {
        token.value = nextToken
      }

      return {
        token,
        upper,
        update,
      }
    })

    const store = useSessionStore(root)
    const refs = storeToRefs(store)

    expect(refs.token.value).toBe('alpha')
    expect(refs.upper.value).toBe('ALPHA')

    refs.token.value = 'beta'
    await nextTick()
    expect(store.upper).toBe('BETA')

    store.update('gamma')
    await nextTick()
    expect(refs.token.value).toBe('gamma')
    expect(refs.upper.value).toBe('GAMMA')
  })
})
