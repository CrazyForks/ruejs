import { nextTick } from '@rue-js/rue'

import type { AfterEachFailure, Route } from './index'

export type NavigationLifecycleType = 'push' | 'replace' | 'pop'

export type NavigationLifecycleDetail = {
  to: Route
  from: Route
  type: NavigationLifecycleType
  failure?: AfterEachFailure
}

const dispatchNavigationEvent = (name: string, detail: NavigationLifecycleDetail) => {
  if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') {
    return
  }
  document.dispatchEvent(new CustomEvent(name, { detail }))
}

export const dispatchBeforeNavigation = (detail: NavigationLifecycleDetail) => {
  dispatchNavigationEvent('rue:before-navigation', detail)
}

export const dispatchAfterNavigation = (detail: NavigationLifecycleDetail) => {
  dispatchNavigationEvent('rue:after-navigation', detail)
}

export const shouldManageNavigationFocus = () => {
  if (typeof document === 'undefined') {
    return false
  }
  const activeElement = document.activeElement
  return (
    activeElement == null ||
    activeElement === document.body ||
    activeElement === document.documentElement
  )
}

let routeAnnouncer: HTMLElement | null = null

const ensureRouteAnnouncer = () => {
  if (typeof document === 'undefined') {
    return null
  }
  if (!routeAnnouncer) {
    routeAnnouncer = document.createElement('div')
    routeAnnouncer.setAttribute('data-rue-route-announcer', '')
    routeAnnouncer.setAttribute('aria-live', 'assertive')
    routeAnnouncer.setAttribute('aria-atomic', 'true')
    routeAnnouncer.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'
  }
  if (!routeAnnouncer.isConnected) {
    document.body.appendChild(routeAnnouncer)
  }
  return routeAnnouncer
}

const getAnnouncementText = (route: Route) => {
  if (typeof document !== 'undefined' && document.title.trim()) {
    return document.title.trim()
  }
  const metaTitle = route?.meta?.title
  if (typeof metaTitle === 'string' && metaTitle.trim()) {
    return metaTitle.trim()
  }
  if (route?.path) {
    return route.path
  }
  return typeof location !== 'undefined' ? location.pathname : '/'
}

const focusPageMain = () => {
  if (typeof document === 'undefined') {
    return
  }
  const target = document.querySelector<HTMLElement>('[data-rue-page-main], main, [role="main"]')
  if (!target) {
    return
  }
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1')
  }
  target.focus({ preventScroll: true })
}

export const scheduleNavigationPageLoad = (
  detail: NavigationLifecycleDetail,
  manageFocus: boolean,
  isCurrent: () => boolean,
  beforePageLoad?: () => void | Promise<void>,
) => {
  void nextTick().then(async () => {
    if (!isCurrent()) {
      return
    }
    await beforePageLoad?.()
    if (!isCurrent()) {
      return
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (!isCurrent()) {
      return
    }
    const announcer = ensureRouteAnnouncer()
    if (announcer) {
      announcer.textContent = getAnnouncementText(detail.to)
    }
    if (manageFocus) {
      focusPageMain()
    }
    dispatchNavigationEvent('rue:page-load', detail)
  })
}
