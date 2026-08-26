import type { ComponentProps, DOMHost, DOMProps, DOMStyle } from './types.js'

const emptyProps: DOMProps = Object.freeze({})

const domString = (value: unknown): string => String(value)

const styleRecord = (value: unknown): DOMStyle => {
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

const removeAttributeUnlessReserved = <HostNode>(
  host: DOMHost<HostNode>,
  element: HostNode,
  key: string,
): void => {
  if (key !== 'key' && key !== 'children') host.removeAttribute(element, key)
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
  if (key.startsWith('on')) {
    host.removeEventListener(element, eventName(key), oldValue)
  } else if (key === 'className') {
    host.setClassName(element, '')
  } else if (key === 'style') {
    host.patchStyle(element, {}, {})
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
    removeAttributeUnlessReserved(host, element, key)
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
    if (value === undefined) {
      resetRemovedProp(host, element, key, oldProps[key])
    } else if (key === 'className') {
      host.setClassName(element, domString(value))
    } else if (key === 'style') {
      host.patchStyle(element, {}, styleRecord(value))
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
      host.setAttribute(element, key, domString(value))
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
