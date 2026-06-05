import {
  ensureNavigationRuntimeRscBootstrap,
  getNavigationRuntime,
  type NavigationRuntimeRscBootstrap,
  type NavigationRuntimeSnapshot,
} from '../client/navigation-runtime.js'
import { RSC_FORM_STATE_GLOBAL, type AppBrowserFormState } from './app-browser-hydration.js'
import { decodeRscEmbeddedChunk, type RscEmbeddedChunk } from './app-rsc-embedded-chunks.js'

type TextBrowserGlobals = {
  __TEXT_RSC_CHUNKS__?: RscEmbeddedChunk[]
  __TEXT_RSC_DONE__?: boolean
  [RSC_FORM_STATE_GLOBAL]?: AppBrowserFormState
  __TEXT_RSC_PARAMS__?: Record<string, string | string[]>
  __TEXT_RSC_NAV__?: NavigationRuntimeSnapshot
}

export function getTextBrowserGlobal(): typeof globalThis & TextBrowserGlobals {
  return globalThis as typeof globalThis & TextBrowserGlobals
}

function createUnexpectedRscStreamCloseError(): Error {
  return new Error(
    'The connection to the page was unexpectedly closed, possibly due to the stop button being clicked, loss of Wi-Fi, or an unstable internet connection.',
  )
}

/**
 * Convert embedded chunks back to a ReadableStream of Uint8Array chunks.
 */
export function chunksToReadableStream(
  chunks: readonly RscEmbeddedChunk[],
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(decodeRscEmbeddedChunk(chunk))
      }
      controller.close()
    },
  })
}

function getNavigationRuntimeRscBootstrap(): NavigationRuntimeRscBootstrap | null {
  return getNavigationRuntime()?.bootstrap.rsc ?? null
}

/**
 * Create a ReadableStream from progressively-embedded RSC chunks.
 *
 * The server pushes chunks into the typed navigation runtime via inline
 * <script> tags. We monkey-patch `push()` so new chunks reach the active
 * payload reader immediately instead of polling with setTimeout.
 */
export function createProgressiveRscStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const text = getTextBrowserGlobal()
      const runtimeRsc = getNavigationRuntimeRscBootstrap()
      const initialChunks = runtimeRsc?.rsc ?? text.__TEXT_RSC_CHUNKS__ ?? []

      for (const chunk of initialChunks) {
        controller.enqueue(decodeRscEmbeddedChunk(chunk))
      }

      if (runtimeRsc?.done || text.__TEXT_RSC_DONE__) {
        controller.close()
        return
      }

      let closed = false
      let cancelDocumentCompletionCheck: (() => void) | undefined
      const cancelPendingDocumentCompletionCheck = () => {
        const cancel = cancelDocumentCompletionCheck
        cancelDocumentCompletionCheck = undefined
        cancel?.()
      }
      const closeOnce = () => {
        if (!closed) {
          closed = true
          cancelPendingDocumentCompletionCheck()
          controller.close()
        }
      }
      const errorOnce = () => {
        if (!closed) {
          closed = true
          cancelPendingDocumentCompletionCheck()
          controller.error(createUnexpectedRscStreamCloseError())
        }
      }

      const liveRuntimeRsc =
        getNavigationRuntime() === null ? null : ensureNavigationRuntimeRscBootstrap()
      const arr = liveRuntimeRsc?.rsc ?? (text.__TEXT_RSC_CHUNKS__ ??= [])
      // Capture the bootstrap object before it can be cleared. Inline done
      // scripts mutate this same object, and clearing happens only after the
      // stream has already been consumed or closed.
      arr.push = function (...chunks: RscEmbeddedChunk[]): number {
        const length = Array.prototype.push.apply(this, chunks)

        if (closed) return length

        for (const chunk of chunks) {
          controller.enqueue(decodeRscEmbeddedChunk(chunk))
        }

        if (liveRuntimeRsc?.done || text.__TEXT_RSC_DONE__) {
          closeOnce()
        }

        return length
      }

      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', errorOnce)
          cancelDocumentCompletionCheck = () =>
            document.removeEventListener('DOMContentLoaded', errorOnce)
        } else {
          const timeoutId = setTimeout(errorOnce)
          cancelDocumentCompletionCheck = () => clearTimeout(timeoutId)
        }
      }
    },
  })
}
