/**
 * text/dynamic shim unit tests.
 *
 * Plan 08 keeps these as Rue renderable/normalization tests. Full SSR behavior
 * coverage comes later, once Rue owns Suspense streaming semantics.
 */
import { describe, it, expect } from 'vite-plus/test'
import dynamic, { flushPreloads } from '../src/shims/dynamic.js'
import { RUE_SUSPENSE_ELEMENT_MARKER } from '../src/server/app-optimistic-routing.js'
import { isRueRenderableHandle } from './rue-test-utils.js'

function Hello() {
  return null
}

function LoadingSpinner({ isLoading, error }: { isLoading?: boolean; error?: Error | null }) {
  if (error) return `Error: ${error.message}`
  if (isLoading) return 'Loading...'
  return null
}

function getProps(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  const props = Reflect.get(value, 'props')
  return props && typeof props === 'object' ? (props as Record<string, unknown>) : {}
}

describe('text/dynamic Rue component shape', () => {
  it('returns a Rue async component for SSR-enabled dynamic imports', () => {
    const DynamicHello = dynamic(() => Promise.resolve({ default: Hello }))

    expect(DynamicHello.displayName).toBe('RueDynamicServer')
    const element = DynamicHello({})
    expect(isRueRenderableHandle(element)).toBe(true)
    expect(Reflect.get(element as object, RUE_SUSPENSE_ELEMENT_MARKER)).toBe(true)
  })

  it('accepts modules exporting a bare component', () => {
    const DynamicComponent = dynamic(() => Promise.resolve(Hello))

    expect(DynamicComponent.displayName).toBe('RueDynamicServer')
    expect(isRueRenderableHandle(DynamicComponent({}))).toBe(true)
  })

  it('accepts a direct loader promise', () => {
    const DynamicComponent = dynamic(Promise.resolve({ default: Hello }))

    expect(DynamicComponent.displayName).toBe('RueDynamicServer')
    expect(isRueRenderableHandle(DynamicComponent({}))).toBe(true)
  })

  it('accepts an options object with loader', () => {
    const DynamicComponent = dynamic({
      loader: () => Promise.resolve({ default: Hello }),
    })

    expect(DynamicComponent.displayName).toBe('RueDynamicServer')
    expect(isRueRenderableHandle(DynamicComponent({}))).toBe(true)
  })
})

describe('text/dynamic ssr: false', () => {
  it('returns loading component output on server-like runtimes', () => {
    const DynamicNoSSR = dynamic(() => Promise.resolve({ default: Hello }), {
      ssr: false,
      loading: LoadingSpinner,
    })

    const element = DynamicNoSSR({})
    expect(DynamicNoSSR.displayName).toBe('DynamicSSRFalse')
    expect(isRueRenderableHandle(element)).toBe(true)
    expect(getProps(element)).toMatchObject({
      isLoading: true,
      pastDelay: false,
      error: null,
      timedOut: false,
    })
    expect(getProps(element).retry).toEqual(expect.any(Function))
  })

  it('returns null on server-like runtimes when ssr:false has no loading component', () => {
    const DynamicNoSSR = dynamic(() => Promise.resolve({ default: Hello }), { ssr: false })

    expect(DynamicNoSSR({})).toBeNull()
  })
})

describe('text/dynamic loading component', () => {
  it('threads the loading component through the Rue Suspense fallback', () => {
    const DynamicWithLoading = dynamic(() => Promise.resolve({ default: Hello }), {
      loading: LoadingSpinner,
    })

    const suspenseElement = DynamicWithLoading({})
    const fallback = getProps(suspenseElement).fallback

    expect(isRueRenderableHandle(fallback)).toBe(true)
    expect(getProps(fallback)).toMatchObject({
      isLoading: true,
      pastDelay: true,
      error: null,
      timedOut: false,
    })
  })
})

describe('text/dynamic defaults', () => {
  it('defaults ssr to true', () => {
    const DynamicDefault = dynamic(() => Promise.resolve({ default: Hello }))
    expect(DynamicDefault.displayName).toBe('RueDynamicServer')
  })

  it('handles undefined options', () => {
    const DynamicNoOpts = dynamic(() => Promise.resolve({ default: Hello }), undefined)
    expect(DynamicNoOpts.displayName).toBe('RueDynamicServer')
  })
})

describe('flushPreloads', () => {
  it('returns an empty array when no preloads queued', async () => {
    const result = await flushPreloads()
    expect(result).toEqual([])
  })

  it('can be called multiple times safely', async () => {
    await flushPreloads()
    const result = await flushPreloads()
    expect(result).toEqual([])
  })
})
