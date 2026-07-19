import type { NavigationLifecycleType } from './navigation-lifecycle'
import type { Route } from './index'

export type RouterScrollPosition = {
  left: number
  top: number
  behavior?: ScrollBehavior
}

export type RouterScrollResult = false | void | RouterScrollPosition | string | Element

export type RouterScrollBehavior = (
  to: Route,
  from: Route,
  savedPosition: RouterScrollPosition | null,
) => RouterScrollResult | Promise<RouterScrollResult>

type ScrollNavigation = {
  to: Route
  from: Route
  type: NavigationLifecycleType
  href: string
}

const getWindowScrollPosition = (): RouterScrollPosition => ({
  left: typeof window === 'undefined' ? 0 : window.scrollX,
  top: typeof window === 'undefined' ? 0 : window.scrollY,
})

const findHashTarget = (href: string) => {
  if (typeof document === 'undefined') {
    return null
  }
  const hashIndex = href.indexOf('#')
  if (hashIndex < 0 || hashIndex === href.length - 1) {
    return null
  }
  let targetName: string
  try {
    targetName = decodeURIComponent(href.slice(hashIndex + 1))
  } catch {
    return null
  }
  if (!targetName) {
    return null
  }
  return (
    document.getElementById(targetName) ||
    Array.from(document.getElementsByName(targetName)).find(
      (element): element is HTMLElement => element instanceof HTMLElement,
    ) ||
    null
  )
}

const resolveSelector = (selector: string) => {
  if (typeof document === 'undefined') {
    return null
  }
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

const applyScrollResult = (result: RouterScrollResult) => {
  if (result === false || result == null || typeof window === 'undefined') {
    return
  }
  if (typeof result === 'string') {
    resolveSelector(result)?.scrollIntoView()
    return
  }
  if (typeof (result as Element).scrollIntoView === 'function') {
    ;(result as Element).scrollIntoView()
    return
  }
  const position = result as RouterScrollPosition
  const options: ScrollToOptions = { left: position.left, top: position.top }
  if (position.behavior) {
    options.behavior = position.behavior
  }
  window.scrollTo(options)
}

export const createRouterScrollManager = (scrollBehavior?: RouterScrollBehavior) => {
  const savedPositions = new Map<string, RouterScrollPosition>()

  return {
    save(href: string) {
      if (typeof window !== 'undefined') {
        savedPositions.set(href, getWindowScrollPosition())
      }
    },
    async scroll(navigation: ScrollNavigation) {
      if (typeof window === 'undefined') {
        return
      }
      const savedPosition =
        navigation.type === 'pop' ? (savedPositions.get(navigation.href) ?? null) : null

      if (scrollBehavior) {
        applyScrollResult(await scrollBehavior(navigation.to, navigation.from, savedPosition))
        return
      }

      if (savedPosition) {
        applyScrollResult(savedPosition)
        return
      }
      const hashTarget = findHashTarget(navigation.href)
      if (hashTarget) {
        applyScrollResult(hashTarget)
        return
      }
      applyScrollResult({ left: 0, top: 0 })
    },
  }
}
