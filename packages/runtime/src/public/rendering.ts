/** Public component and rendering facade. */
export { version } from '../version'
export * from '../rue'
export { createContext, useContext, type RueContext, type ContextProviderProps } from '../context'

export {
  createComment as _$createComment,
  createTextNode as _$createTextNode,
  createElement as _$createElement,
  createTextWrapper as _$createTextWrapper,
  setStyle as _$setStyle,
  settextContent as _$settextContent,
  createDocumentFragment as _$createDocumentFragment,
  appendChild as _$appendChild,
  removeChild as _$removeChild,
  insertBefore as _$insertBefore,
  replaceChild as _$replaceChild,
  querySelector as _$querySelector,
  setAttribute as _$setAttribute,
  removeAttribute as _$removeAttribute,
  addEventListener as _$addEventListener,
  removeEventListener as _$removeEventListener,
  setClassName as _$setClassName,
  setInnerHTML as _$setInnerHTML,
  setValue as _$setValue,
  setChecked as _$setChecked,
  setDisabled as _$setDisabled,
  setProperty as _$setProperty,
  spreadAttributes as _$spreadAttributes,
  getTagName as _$getTagName,
} from '../dom'
