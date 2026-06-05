const APP_SSR_PASSTHROUGH_COMPONENT = Symbol.for('text.appSsrPassthroughComponent')

type AppSsrPassthroughComponent = {
  [APP_SSR_PASSTHROUGH_COMPONENT]?: true
}

export function markAppSsrPassthroughComponent(component: Function): void {
  Object.defineProperty(component, APP_SSR_PASSTHROUGH_COMPONENT, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  })
}

export function isAppSsrPassthroughComponent(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    (value as AppSsrPassthroughComponent)[APP_SSR_PASSTHROUGH_COMPONENT] === true
  )
}
