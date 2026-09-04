import type { CompiledRootHandle } from './compiled-root'
import { effect, getCurrentOwner, onOwnerCleanup, signal, untrack } from './internal-reactive'
import { _$compiledValue } from './compiled-render-anchor'
import { _$compiledRoot } from './compiled-root'
import { _$compiledSpreadAttributes } from './compiled-dom-bindings'
import { appendChild, createElement } from './compiler-runtime/dom.browser'
import {
  RUE_COMPILED_COMPONENT_FACTORY_KEY,
  RUE_COMPILED_COMPONENT_READ_PROPS_KEY,
  RUE_COMPILED_COMPONENT_TRACK_PROPS_KEY,
  _$compiledBranch,
  _$compiledComponent,
  _$withCompiledPropsUpdater,
  type CompiledComponentFactory,
} from './compiled-component'
import { isRueIslandDescriptor } from './island-protocol'

type CompiledFactory<Props> = ((props: Props) => unknown) | string | null | undefined
type CompiledPropsInput<Props> = Props | (() => Props)

const isClosedCompiledChild = (value: unknown): boolean => {
  if (
    value == null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'function'
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isClosedCompiledChild)
  if (typeof Node !== 'undefined' && value instanceof Node) return true
  if (isRueIslandDescriptor(value)) return true
  if (typeof value !== 'object') return false
  const record = value as Record<string | symbol, unknown>
  const elementMarker = record.$$typeof
  if (
    elementMarker === Symbol.for('rue.transitional.element') ||
    elementMarker === Symbol.for('rue.element') ||
    elementMarker === Symbol.for('react.transitional.element') ||
    elementMarker === Symbol.for('react.element')
  ) {
    return true
  }
  return (
    ('__rue_compiled_mount' in value && typeof value.__rue_compiled_mount === 'function') ||
    ('__rue_component_type' in value &&
      (typeof value.__rue_component_type === 'string' ||
        typeof value.__rue_component_type === 'function'))
  )
}

const assertClosedCompiledChildren = (props: unknown): void => {
  if (
    props != null &&
    typeof props === 'object' &&
    'children' in props &&
    !isClosedCompiledChild((props as { children?: unknown }).children)
  ) {
    throw new TypeError(
      '[rue] Unsupported object inputs are no longer accepted as compiled children',
    )
  }
}

/** Invoke only the closed compiled component factory contract. */
export const _$createComponent = <Props>(
  factory: CompiledFactory<Props>,
  props: CompiledPropsInput<Props>,
): CompiledRootHandle => {
  if (typeof props !== 'function') assertClosedCompiledChildren(props)
  const readProps = typeof props === 'function' ? (props as () => Props) : () => props
  if (typeof factory === 'string') {
    const propsState = signal(untrack(readProps))
    let refreshAttributes: (() => void) | undefined
    const root = _$withCompiledPropsUpdater<Props>(
      _$compiledRoot(parent => {
        if (parent == null) throw new Error('[rue] a compiled element requires a mount parent')
        const sourceEffect = effect(() => propsState.set(readProps()))
        onOwnerCleanup(() => sourceEffect.dispose())
        const element = createElement(factory, parent)
        refreshAttributes = _$compiledSpreadAttributes(
          element,
          () => propsState.get() as Record<string, unknown>,
          ['children'],
        )
        const initialProps = propsState.peek() as Record<string, unknown>
        if (
          !factory.includes('-') ||
          Object.prototype.hasOwnProperty.call(initialProps, 'children')
        ) {
          const children = _$compiledBranch(() =>
            _$compiledValue((propsState.get() as Record<string, unknown>)?.children),
          )
          children.__rue_compiled_mount(element)
          onOwnerCleanup(() => children.dispose())
        }
        if (factory.includes('-')) {
          const owner = getCurrentOwner() as Record<string, unknown> | undefined
          if (owner != null) {
            Reflect.set(element, '__rue_context_parent_instance__', owner)
          }
        }
        appendChild(parent, element)
        return element
      }),
      nextProps => {
        propsState.set(nextProps)
        refreshAttributes?.()
      },
    ) as unknown as CompiledRootHandle & Record<string, unknown>
    root[RUE_COMPILED_COMPONENT_FACTORY_KEY] = factory
    root[RUE_COMPILED_COMPONENT_READ_PROPS_KEY] = () => propsState.peek()
    root[RUE_COMPILED_COMPONENT_TRACK_PROPS_KEY] = () => propsState.get()
    root.__rue_compiled_clone = () => _$createComponent(factory, readProps)
    return root
  }
  if (factory == null) return _$compiledValue(null)
  if (typeof factory !== 'function') return _$compiledValue(factory)
  if (
    (factory as unknown as { $$typeof?: unknown }).$$typeof ===
      Symbol.for('rue.client.reference') &&
    Number((globalThis as Record<string, unknown>).__rue_is_server_rendering__ ?? 0) > 0
  ) {
    // A client-reference stub must never be invoked by the compiled DOM
    // runtime. Resolvable references are replaced before reaching this path;
    // unresolved client-only effects have no SSR output.
    return _$compiledValue(null)
  }
  return _$compiledComponent(factory as CompiledComponentFactory<Props>, readProps)
}

const isCompiledHandle = (value: unknown): value is CompiledRootHandle =>
  value != null &&
  typeof value === 'object' &&
  '__rue_compiled_mount' in value &&
  typeof value.__rue_compiled_mount === 'function'

/** Close nested-component lowering over a factory that must return a compiled handle. */
export const _$compiledRootFactory = (factory: () => CompiledRootHandle): CompiledRootHandle => {
  return _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] a compiled component requires a mount parent')
    const value = factory()
    const handle = isCompiledHandle(value) ? value : _$compiledValue(value)
    const result = handle.__rue_compiled_mount(parent)
    if (result != null && result.parentNode !== parent) appendChild(parent, result)
    return result
  })
}
