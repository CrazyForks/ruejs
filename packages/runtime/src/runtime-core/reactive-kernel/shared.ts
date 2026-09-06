import { createReactiveKernel } from './index'

const reactiveKernelKey = Symbol.for('@rue-js/runtime/reactive-kernel')
const reactiveKernelRegistry = globalThis as typeof globalThis & {
  [reactiveKernelKey]?: ReturnType<typeof createReactiveKernel>
}

export const reactiveKernel = (reactiveKernelRegistry[reactiveKernelKey] ??= createReactiveKernel({
  onErrorCaptured: (error, owner, info) =>
    globalThis.__rue_compiled_runtime_bridge?.dispatchErrorCaptured?.(error, owner, info) === true,
}))
