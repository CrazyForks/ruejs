export * from './pkg/rue_runtime_vapor'
export { shallowRef } from './reactive'
import * as runtimeVapor from './pkg/rue_runtime_vapor'

declare const _default: typeof runtimeVapor & {
  shallowRef: typeof import('./reactive').shallowRef
}
export default _default
