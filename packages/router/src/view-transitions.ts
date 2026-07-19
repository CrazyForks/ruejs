export type RouterViewTransitionsOptions = {
  skipWhenReducedMotion?: boolean
}

export type RouterViewTransitionsConfig = boolean | RouterViewTransitionsOptions

const prefersReducedMotion = () => {
  const matchMedia = (
    globalThis as typeof globalThis & {
      matchMedia?: (query: string) => MediaQueryList
    }
  ).matchMedia
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const createRouterViewTransitionRunner = (config?: RouterViewTransitionsConfig) => {
  const enabled = config === true || (typeof config === 'object' && config != null)
  const skipWhenReducedMotion =
    typeof config === 'object' ? config.skipWhenReducedMotion !== false : true

  return (update: () => void): Promise<void> => {
    const startViewTransition =
      typeof document === 'undefined'
        ? undefined
        : (
            document as Document & {
              startViewTransition?: (callback: () => void) => {
                updateCallbackDone?: Promise<unknown>
              }
            }
          ).startViewTransition

    if (
      !enabled ||
      typeof startViewTransition !== 'function' ||
      (skipWhenReducedMotion && prefersReducedMotion())
    ) {
      update()
      return Promise.resolve()
    }

    return new Promise(resolve => {
      let committed = false
      const commitOnce = () => {
        if (committed) {
          return
        }
        committed = true
        update()
        resolve()
      }

      try {
        const transition = startViewTransition.call(document, commitOnce)
        void transition?.updateCallbackDone?.catch(commitOnce)
      } catch {
        commitOnce()
      }
    })
  }
}
