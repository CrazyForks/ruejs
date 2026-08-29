import type { DOMHost, DOMProps, DOMStyle } from './types.js'

const emptyProps: DOMProps = Object.freeze({})

const domString = (value: unknown): string => String(value)

const styleRecord = (value: unknown): DOMStyle => {
  if (typeof value === 'string') {
    const result: DOMStyle = {}
    for (const declaration of value.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator < 0) continue
      const key = declaration.slice(0, separator).trim()
      if (!key) continue
      result[key] = declaration.slice(separator + 1).trim()
    }
    return result
  }
  if (!value || typeof value !== 'object') return {}
  const result: DOMStyle = {}
  for (const key of Object.keys(value)) {
    const item = Reflect.get(value, key)
    result[key] = typeof item === 'string' || typeof item === 'number' ? String(item) : ''
  }
  return result
}

const innerHTMLValue = (value: unknown): string => {
  if (!value || typeof value !== 'object') return ''
  const html = Reflect.get(value, '__html')
  return typeof html === 'string' ? html : ''
}

const eventName = (key: string): string => key.toLowerCase().slice(2)

const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const isCustomElement = <HostNode>(host: DOMHost<HostNode>, element: HostNode): boolean =>
  host.getTagName(element).includes('-')

const shouldUseProperty = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  key: string,
  value: unknown,
): boolean =>
  isCustomElement(host, element) &&
  (key === 'props' ||
    key === '__rue_slots' ||
    key.startsWith('__rue_context_') ||
    (isObjectLike(element) && key in element) ||
    isObjectLike(value))

const notifyCustomElementPropertyChanged = (element: unknown): void => {
  if (!isObjectLike(element)) return
  const sync = Reflect.get(element, '__rue_custom_element_sync_props__')
  if (typeof sync === 'function') Reflect.apply(sync, element, [])
}

const setProperty = (element: unknown, key: string, value: unknown): void => {
  if (!isObjectLike(element)) return
  if (value === undefined || value === null || value === false) {
    try {
      if (!Reflect.deleteProperty(element, key)) Reflect.set(element, key, undefined)
    } catch {
      Reflect.set(element, key, undefined)
    }
  } else {
    Reflect.set(element, key, value)
  }
  notifyCustomElementPropertyChanged(element)
}

const attributeName = (key: string): string =>
  key === 'htmlFor' ? 'for' : key === 'tabIndex' ? 'tabindex' : key

const removeAttributeUnlessReserved = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  key: string,
): void => {
  if (key !== 'key' && key !== 'children') {
    host.removeAttribute(element, key)
  }
}

const resetRemovedValue = <HostNode>(host: DOMHost<HostNode>, element: HostNode): void => {
  if (host.getTagName(element) === 'SELECT') {
    host.setValue(element, host.isSelectMultiple(element) ? [] : '')
  } else if (host.hasValueProperty(element)) {
    host.setValue(element, '')
    host.removeAttribute(element, 'value')
  }
}

const resetRemovedProp = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  key: string,
  oldValue: unknown,
): void => {
  if (shouldUseProperty(host, element, key, oldValue)) {
    setProperty(element, key, undefined)
  } else if (key.startsWith('on')) {
    host.removeEventListener(element, eventName(key), oldValue)
  } else if (key === 'className') {
    host.setClassName(element, '')
  } else if (key === 'style') {
    host.patchStyle(element, styleRecord(oldValue), {})
  } else if (key === 'dangerouslySetInnerHTML') {
    host.setInnerHTML(element, '')
  } else if (key === 'value') {
    resetRemovedValue(host, element)
  } else if (key === 'checked') {
    host.setChecked(element, false)
    host.removeAttribute(element, 'checked')
  } else if (key === 'disabled') {
    host.setDisabled(element, false)
    host.removeAttribute(element, 'disabled')
  } else if (key === 'ref') {
    host.clearRef(oldValue)
  } else {
    removeAttributeUnlessReserved(host, element, attributeName(key))
  }
}

/** Apply runtime props through the corresponding host operations. */
export const patchProps = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  oldProps: DOMProps = emptyProps,
  newProps: DOMProps = emptyProps,
): void => {
  for (const key of Object.keys(oldProps)) {
    if (!Object.prototype.hasOwnProperty.call(newProps, key)) {
      resetRemovedProp(host, element, key, oldProps[key])
    }
  }

  for (const key of Object.keys(newProps)) {
    const value = newProps[key]
    if (value === undefined || value === null || value === false) {
      resetRemovedProp(host, element, key, oldProps[key])
    } else if (shouldUseProperty(host, element, key, value)) {
      setProperty(element, key, value)
    } else if (key === 'className') {
      host.setClassName(element, domString(value))
    } else if (key === 'style') {
      host.patchStyle(element, styleRecord(oldProps[key]), styleRecord(value))
    } else if (key === 'dangerouslySetInnerHTML') {
      host.setInnerHTML(element, innerHTMLValue(value))
    } else if (key === 'value') {
      host.setValue(element, value)
    } else if (key === 'checked') {
      host.setChecked(element, value === true)
    } else if (key === 'disabled') {
      host.setDisabled(element, value === true)
    } else if (key === 'ref') {
      host.applyRef(element, value)
    } else if (key.startsWith('on')) {
      if (Object.prototype.hasOwnProperty.call(oldProps, key)) {
        host.removeEventListener(element, eventName(key), oldProps[key])
      }
      host.addEventListener(element, eventName(key), value)
    } else if (key !== 'key' && key !== 'children') {
      host.setAttribute(element, attributeName(key), domString(value === true ? 'true' : value))
    }
  }
}

/** Re-apply select values after its option children have mounted. */
export const postPatchElement = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  props: DOMProps = emptyProps,
): void => {
  if (
    host.getTagName(element) === 'SELECT' &&
    Object.prototype.hasOwnProperty.call(props, 'value')
  ) {
    host.setValue(element, props.value)
  }
}
