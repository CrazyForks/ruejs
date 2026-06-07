import type { AppServerRenderable } from './app-server-tree.js'

const APP_RENDER_DEPENDENCY_SSR_UNWRAP = Symbol.for('text.appRenderDependencySsrUnwrap')

type AppRenderDependencySsrUnwrap = {
  [APP_RENDER_DEPENDENCY_SSR_UNWRAP]?: AppServerRenderable
}

export function markAppRenderDependencySsrUnwrap(
  component: Function,
  children: AppServerRenderable,
): void {
  Object.defineProperty(component, APP_RENDER_DEPENDENCY_SSR_UNWRAP, {
    configurable: false,
    enumerable: false,
    value: children,
    writable: false,
  })
}

export function readAppRenderDependencySsrUnwrap(value: unknown): AppServerRenderable | null {
  if (typeof value !== 'function') return null
  const children = (value as AppRenderDependencySsrUnwrap)[APP_RENDER_DEPENDENCY_SSR_UNWRAP]
  return children === undefined ? null : children
}
