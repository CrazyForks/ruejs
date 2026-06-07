import { describe, expect, it } from 'vite-plus/test'
import { jsx } from '../src/shims/jsx-runtime-compat.js'
import { deleteContextRuntime, setContextRuntime } from '../src/shims/context-runtime-global.js'

describe('jsx-runtime-compat', () => {
  it('preserves client references as protocol elements instead of using the active Rue runtime', () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute')
      },
      {
        $$typeof: Symbol.for('rue.client.reference'),
        $$id: '/components/LikeButton.tsx#default',
      },
    )

    setContextRuntime({
      createElement() {
        throw new Error('active runtime should not receive client references')
      },
    })

    try {
      const element = jsx(clientReference, { initialLikes: 16 }) as {
        props?: Record<string, unknown>
        type?: unknown
      }

      expect(element.type).toBe(clientReference)
      expect(element.props).toMatchObject({ initialLikes: 16 })
    } finally {
      deleteContextRuntime()
    }
  })
})
