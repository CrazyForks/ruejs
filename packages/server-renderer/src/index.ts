/*
Rue Server Renderer 入口概述
- 独立包入口，面向 SSR / SSG 流程暴露 renderToString 和服务端 DOM adapter。
- 实现复用 runtime/server，确保服务端渲染与默认运行时使用同一套 renderable 协议。
*/
export {
  runWithServerDOMAdapter,
  ServerDOMAdapter,
  ServerElementNode,
  ServerTextNode,
  ServerCommentNode,
  ServerFragmentNode,
  type RenderToStringOptions,
} from '@rue-js/runtime/server'

import {
  renderToReadableStream as renderRuntimeToReadableStream,
  renderToString as renderRuntimeToString,
  type RenderToStringOptions,
} from '@rue-js/runtime/server'
import { createCompiledComponent, createCompiledFragmentHandle } from '@rue-js/runtime'
import {
  createRueIslandDescriptor,
  createRueServerIslandDescriptor,
  isRueIslandDescriptor,
  isRueServerIslandDescriptor,
} from '@rue-js/runtime/island'

const SERVER_OPERATION = Symbol.for('rue.server.operation')
const TEXT_CONTEXT_VALUE_STACK_KEY = Symbol.for('text.contextValueStack')
const CONTEXT_PROVIDER_MARKER = '__rue_context_provider__'
const CONTEXT_PROVIDER_CONTEXT = '__rue_context_provider_context__'
const PORTABLE_COMPONENT_TYPE = '__rue_component_type'
const COMPILED_COMPONENT_FACTORY = '__rue_compiled_component_factory__'
const COMPILED_COMPONENT_READ_PROPS = '__rue_compiled_component_read_props__'

type ServerOperation = {
  [SERVER_OPERATION]: 'element' | 'component' | 'fragment'
  type?: unknown
  props?: Record<string, unknown> | null
  children: unknown[]
}

const createServerOperation = (
  kind: ServerOperation[typeof SERVER_OPERATION],
  type: unknown,
  props: Record<string, unknown> | null,
  children: unknown[],
): ServerOperation => ({
  [SERVER_OPERATION]: kind,
  type,
  props,
  children,
})

/** Compiler-only native element operation. This is not a public JSX factory. */
export const _$serverElement = (
  tag: string,
  props: Record<string, unknown> | null,
  children: unknown[],
) => createServerOperation('element', tag, props, children)

/** Compiler-only component operation. */
export const _$serverComponent = (
  component: unknown,
  props: Record<string, unknown> | null,
  children: unknown[],
) => createServerOperation('component', component, props, children)

/** Compiler-only Fragment operation. */
export const _$serverFragment = (children: unknown[]) =>
  createServerOperation('fragment', null, null, children)

const isServerOperation = (value: unknown): value is ServerOperation =>
  !!value && typeof value === 'object' && SERVER_OPERATION in value

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === 'function'

const suppressUnhandledRejection = <T>(promise: Promise<T>): Promise<T> => {
  void promise.catch(() => undefined)
  return promise
}

const flattenChildren = (children: unknown[]): unknown[] =>
  children.flatMap(child => (Array.isArray(child) ? child : [child]))

const resolveChildren = (
  children: unknown[],
  forceComponentInvocation = false,
): unknown[] | Promise<unknown[]> => {
  const resolved = children.map(child => resolveServerOperations(child, forceComponentInvocation))
  return resolved.some(isThenable)
    ? Promise.all(resolved).then(flattenChildren)
    : flattenChildren(resolved)
}

const propsWithChildren = (
  props: Record<string, unknown> | null | undefined,
  children: unknown[],
): Record<string, unknown> | Promise<Record<string, unknown>> => {
  const normalized = props ? { ...props } : {}
  if (children.length > 0) {
    normalized.children = children.length === 1 ? children[0] : children
  } else if ('children' in normalized) {
    const resolved = resolveServerOperations(normalized.children)
    if (isThenable(resolved)) {
      return Promise.resolve(resolved).then(children => ({ ...normalized, children }))
    }
    normalized.children = resolved
  }
  return normalized
}

const resolveServerComponent = (
  operation: ServerOperation,
  forceComponentInvocation = false,
): unknown => {
  const component = operation.type as any
  if (typeof component !== 'function') {
    return null
  }

  if (component[CONTEXT_PROVIDER_MARKER] === true) {
    const context = component[CONTEXT_PROVIDER_CONTEXT]
    const globalRecord = globalThis as Record<PropertyKey, unknown>
    const stack = (globalRecord[TEXT_CONTEXT_VALUE_STACK_KEY] ??= []) as Array<
      Map<unknown, unknown>
    >
    const scope = new Map<unknown, unknown>()
    scope.set(context, operation.props?.value)
    stack.push(scope)
    let deferredPop = false
    try {
      const rawChildren =
        operation.children.length > 0
          ? operation.children
          : Array.isArray(operation.props?.children)
            ? operation.props.children
            : operation.props?.children === undefined
              ? []
              : [operation.props.children]
      const children = resolveChildren(rawChildren, true)
      if (isThenable(children)) {
        deferredPop = true
        return Promise.resolve(children)
          .then(createCompiledFragmentHandle)
          .finally(() => stack.pop())
      }
      return createCompiledFragmentHandle(children)
    } finally {
      if (!deferredPop && stack.at(-1) === scope) stack.pop()
    }
  }

  const render = (children: unknown[]) => {
    const props = propsWithChildren(operation.props, children)
    const invoke = (resolvedProps: Record<string, unknown>) => {
      if (
        !forceComponentInvocation &&
        !component.prototype?.render &&
        component.constructor?.name !== 'AsyncFunction'
      ) {
        return {
          type: component,
          props: resolvedProps,
          children: resolvedProps.children,
        }
      }
      const output = component.prototype?.render
        ? new component(resolvedProps).render()
        : component(resolvedProps)
      return isThenable(output)
        ? suppressUnhandledRejection(Promise.resolve(output).then(resolveServerOperations))
        : resolveServerOperations(output)
    }
    return isThenable(props)
      ? suppressUnhandledRejection(Promise.resolve(props).then(invoke))
      : invoke(props)
  }
  const children = resolveChildren(operation.children)
  return isThenable(children)
    ? suppressUnhandledRejection(Promise.resolve(children).then(render))
    : render(children)
}

const resolveServerOperations = (value: unknown, forceComponentInvocation = false): unknown => {
  if (isThenable(value)) return Promise.resolve(value).then(resolveServerOperations)
  if (Array.isArray(value)) {
    return resolveChildren(value, forceComponentInvocation)
  }
  if (isRueIslandDescriptor(value)) {
    return createRueIslandDescriptor({
      component: value.component,
      props: value.props,
      fallback: resolveServerOperations(value.fallback) as any,
      metadata: value.metadata,
    })
  }
  if (isRueServerIslandDescriptor(value)) {
    return createRueServerIslandDescriptor({
      id: value.id,
      props: value.props,
      fallback: resolveServerOperations(value.fallback) as any,
    })
  }
  if (value && typeof value === 'object') {
    const handle = value as Record<string, any>
    const factory = handle[COMPILED_COMPONENT_FACTORY]
    const readProps = handle[COMPILED_COMPONENT_READ_PROPS]
    if (
      (typeof factory === 'function' || typeof factory === 'string') &&
      typeof readProps === 'function'
    ) {
      return value
    }
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)[PORTABLE_COMPONENT_TYPE] === 'function'
  ) {
    // Keep portable component handles intact. runtime/server owns client-reference
    // resolution and must invoke the resolved SSR implementation rather than the
    // serialized client stub stored on the handle.
    return value
  }
  if (!isServerOperation(value)) {
    return value
  }
  if (value[SERVER_OPERATION] === 'fragment') {
    const children = resolveChildren(value.children)
    return isThenable(children)
      ? Promise.resolve(children).then(createCompiledFragmentHandle)
      : createCompiledFragmentHandle(children)
  }
  if (value[SERVER_OPERATION] === 'component') {
    return resolveServerComponent(value, forceComponentInvocation)
  }

  const createElement = (children: unknown[]) => ({
    type: value.type,
    props: value.props,
    children,
  })
  const children = resolveChildren(value.children)
  return isThenable(children)
    ? suppressUnhandledRejection(Promise.resolve(children).then(createElement))
    : createElement(children)
}

/** Render both regular Rue inputs and compiler-emitted server operations. */
export const renderToString = async (
  input:
    | Parameters<typeof renderRuntimeToString>[0]
    | ((props: Record<string, unknown>) => ServerOperation),
  options: RenderToStringOptions = {},
) => {
  if (typeof input === 'function') {
    return renderRuntimeToString(
      ((props: Record<string, unknown>) =>
        resolveServerOperations((input as any)(props))) as Parameters<
        typeof renderRuntimeToString
      >[0],
      options,
    )
  }
  return renderRuntimeToString(
    (() => resolveServerOperations(input)) as Parameters<typeof renderRuntimeToString>[0],
    options,
  )
}

export const renderToReadableStream = async (
  input:
    | Parameters<typeof renderRuntimeToReadableStream>[0]
    | ((props: Record<string, unknown>) => ServerOperation),
  options: RenderToStringOptions = {},
) => {
  if (typeof input === 'function') {
    return renderRuntimeToReadableStream(
      ((props: Record<string, unknown>) =>
        resolveServerOperations((input as any)(props))) as Parameters<
        typeof renderRuntimeToReadableStream
      >[0],
      options,
    )
  }
  return renderRuntimeToReadableStream(
    (() => resolveServerOperations(input)) as Parameters<typeof renderRuntimeToReadableStream>[0],
    options,
  )
}
