export {
  createActionReferenceSet,
  decodeProgressiveAction,
  decodeFormState,
  parseActionArgs,
  loadServerAction,
} from './app-rsc-server-action-protocol.js'
import { renderRuePayloadToReadableStream } from '@rue-js/rsc/core/payload'
import {
  RUE_ELEMENT_SYMBOL,
  RUE_FRAGMENT_SYMBOL,
  RUE_SUSPENSE_SYMBOL,
} from '@rue-js/rsc/core/payload'
import {
  adaptAppServerRenderable,
  createAppServerElement,
  type AppServerRenderable,
} from './app-server-tree.js'
import {
  ServerProtocolFragment,
  ServerProtocolSuspense,
  isServerProtocolElement,
} from './element-protocol.js'
import { isRueRenderableHandle } from './renderable.js'
import { runWithServerElementRuntimeStream } from './server-element-runtime.js'
import { readAppRenderDependencySsrUnwrap } from './app-render-dependency-protocol.js'
import { installCompatAppClientReferenceResolver } from './app-rsc-ssr-plugin-runtime-compat.js'
import { isAppRscServerClientReference } from './app-rsc-client-reference-protocol.js'

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const RUE_SERVER_OPERATION = Symbol.for('rue.server.operation')
const RUE_SERVER_REFERENCE = Symbol.for('rue.server.reference')
const RUE_SUSPENSE_COMPONENT = Symbol.for('rue.suspense.component')

function adaptCompiledServerOperation(model: unknown): unknown {
  if (!model || typeof model !== 'object' || !(RUE_SERVER_OPERATION in model)) return model
  const operation = model as Record<PropertyKey, unknown>
  const children = Array.isArray(operation.children) ? operation.children : []
  if (operation[RUE_SERVER_OPERATION] === 'fragment') return children
  const props =
    operation.props && typeof operation.props === 'object'
      ? (operation.props as Record<string, unknown>)
      : null
  return createAppServerElement(operation.type as never, props, ...(children as never[]))
}

function adaptAppRscPayloadModel(model: unknown): unknown {
  if (isThenable(model)) {
    return Promise.resolve(model).then(
      resolved => adaptAppRscPayloadModel(resolved),
      error => error,
    )
  }

  const compiledOperation = adaptCompiledServerOperation(model)
  if (compiledOperation !== model) {
    return adaptAppRscPayloadModel(compiledOperation)
  }

  if (isServerProtocolElement(model)) {
    if (isAppRscServerClientReference(model.type)) {
      const adaptedProps = adaptAppRscPayloadModel(model.props)
      const createClientReferenceElement = (props: unknown): unknown =>
        props === model.props && (model as { $$typeof?: unknown }).$$typeof === RUE_ELEMENT_SYMBOL
          ? model
          : {
              ...model,
              props,
              $$typeof: RUE_ELEMENT_SYMBOL,
            }
      return isThenable(adaptedProps)
        ? Promise.resolve(adaptedProps).then(createClientReferenceElement)
        : createClientReferenceElement(adaptedProps)
    }

    let adapted: AppServerRenderable
    try {
      adapted = adaptAppServerRenderable(model as AppServerRenderable)
    } catch (error) {
      return error
    }
    if (isThenable(adapted)) {
      return Promise.resolve(adapted).then(
        resolved => adaptAppRscPayloadModel(resolved),
        error => error,
      )
    }
    if (adapted !== model) {
      return adaptAppRscPayloadModel(adapted)
    }

    if (
      typeof model.type === 'function' &&
      !isAppRscServerClientReference(model.type) &&
      (model.type as Record<PropertyKey, unknown>).$$typeof !== RUE_SERVER_REFERENCE &&
      (model.type as Record<PropertyKey, unknown>)[RUE_SUSPENSE_COMPONENT] !== true
    ) {
      const component = model.type as (props: Record<string, unknown>) => unknown
      try {
        return adaptAppRscPayloadModel(component(model.props ?? {}))
      } catch (error) {
        return error
      }
    }

    const unwrapped = readAppRenderDependencySsrUnwrap(model.type)
    if (unwrapped !== null) {
      return adaptAppRscPayloadModel(unwrapped)
    }

    const adaptedProps = adaptAppRscPayloadModel(model.props)
    const createTextElement = (props: unknown): Record<string, unknown> => ({
      ...model,
      props,
      $$typeof: RUE_ELEMENT_SYMBOL,
    })
    const createNormalizedTextElement = (props: unknown): unknown =>
      props === model.props && (model as { $$typeof?: unknown }).$$typeof === RUE_ELEMENT_SYMBOL
        ? model
        : createTextElement(props)
    return isThenable(adaptedProps)
      ? Promise.resolve(adaptedProps).then(props => createNormalizedTextElement(props))
      : createNormalizedTextElement(adaptedProps)
  }

  if (model === ServerProtocolFragment) return RUE_FRAGMENT_SYMBOL
  if (model === ServerProtocolSuspense) return RUE_SUSPENSE_SYMBOL

  if (isRueRenderableHandle(model)) {
    let adapted: AppServerRenderable
    try {
      adapted = adaptAppServerRenderable(model as AppServerRenderable)
    } catch (error) {
      return error
    }
    return isThenable(adapted)
      ? Promise.resolve(adapted).then(
          resolved => adaptAppRscPayloadModel(resolved),
          error => error,
        )
      : adaptAppRscPayloadModel(adapted)
  }

  if (Array.isArray(model)) {
    let changed = false
    const textItems = model.map(item => {
      const adaptedItem = adaptAppRscPayloadModel(item)
      if (adaptedItem !== item) changed = true
      return adaptedItem
    })
    return textItems.some(isThenable)
      ? Promise.all(textItems.map(item => Promise.resolve(item))).then(resolvedItems => {
          for (let i = 0; i < resolvedItems.length; i += 1) {
            if (resolvedItems[i] !== model[i]) changed = true
          }
          return changed ? resolvedItems : model
        })
      : changed
        ? textItems
        : model
  }

  if (isPlainObject(model)) {
    const entries = Object.entries(model)
    let changed = false
    const textRecord: Record<string, unknown> = {}
    const pendingEntries: Promise<void>[] = []

    for (const [key, value] of entries) {
      const adaptedValue = adaptAppRscPayloadModel(value)
      if (adaptedValue !== value) changed = true
      if (isThenable(adaptedValue)) {
        pendingEntries.push(
          Promise.resolve(adaptedValue).then(resolvedValue => {
            textRecord[key] = resolvedValue
          }),
        )
      } else {
        textRecord[key] = adaptedValue
      }
    }

    if (pendingEntries.length > 0) {
      return Promise.all(pendingEntries).then(() => textRecord)
    }
    return changed ? textRecord : model
  }

  return model
}

export function renderAppRscPayloadToReadableStream(
  model: unknown,
  options?: unknown,
): ReadableStream<Uint8Array> {
  installCompatAppClientReferenceResolver()
  return runWithServerElementRuntimeStream(() =>
    renderRuePayloadToReadableStream(adaptAppRscPayloadModel(model), options as object, {
      normalizeResolvedValue: adaptAppRscPayloadModel,
    }),
  )
}
