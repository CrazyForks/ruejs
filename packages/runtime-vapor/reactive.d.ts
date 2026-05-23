export * from './pkg/rue_runtime_vapor'

export declare function shallowRef<T = any>(
  initial: T,
  options?: { equals?: (prev: T, next: T) => boolean } | null,
  forceGlobal?: boolean,
): { value: T }

import * as reactiveRuntime from './pkg/rue_runtime_vapor'

declare const _default: typeof reactiveRuntime & {
  shallowRef: typeof shallowRef
}

export default _default
