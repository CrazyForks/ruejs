export type RueBuiltinComponentName =
  | 'KeepAlive'
  | 'Transition'
  | 'TransitionGroup'
  | 'Template'
  | 'Suspense'

export const RUE_BUILTIN_COMPONENT_KEY = Symbol.for('rue.builtin-component')

export const markBuiltinComponent = <T extends Function>(
  component: T,
  name: RueBuiltinComponentName,
): T => {
  Object.defineProperty(component, RUE_BUILTIN_COMPONENT_KEY, {
    value: name,
    enumerable: false,
    configurable: true,
  })
  return component
}

const readBuiltinComponentMarker = (type: unknown): RueBuiltinComponentName | undefined => {
  if (typeof type !== 'function') {
    return undefined
  }

  const marker = Reflect.get(type, RUE_BUILTIN_COMPONENT_KEY)
  return typeof marker === 'string' ? (marker as RueBuiltinComponentName) : undefined
}

export const copyBuiltinComponentMarker = <T extends Function>(source: unknown, target: T): T => {
  const marker = readBuiltinComponentMarker(source)
  return marker ? markBuiltinComponent(target, marker) : target
}

export const getBuiltinComponentName = (type: unknown): string => {
  if (typeof type !== 'function') {
    return ''
  }

  return readBuiltinComponentMarker(type) ?? type.name
}
