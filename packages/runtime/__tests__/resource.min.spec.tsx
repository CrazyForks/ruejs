import { describe, expect, it, vi } from 'vitest'

import { createResource, render, setReactiveScheduling, signal, type FC } from '../src'
import { flush } from './page-test-utils'

setReactiveScheduling('microtask')

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

describe('createResource', () => {
  it('renders pending loading state and resolved content', async () => {
    const request = deferred<string>()
    const fetcher = vi.fn(() => request.promise)

    const App: FC = () => {
      const key = signal('main')
      const resource = createResource(key, fetcher)

      return (
        <div>
          <p>loading = {String(resource.loading.get())}</p>
          {resource.loading.get() && <span>Loading...</span>}
          {!resource.loading.get() && <p>{resource.data.get()}</p>}
        </div>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<App />, container)
    await flush(8)

    expect(container.textContent).toContain('Loading...')

    request.resolve('ready')
    await flush(8)

    expect(container.textContent).toContain('ready')
    expect(fetcher).toHaveBeenCalledWith('main')
  })
})
