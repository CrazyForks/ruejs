export { Fragment, jsx, jsxs } from './jsx-runtime-compat.js'
import { jsx } from './jsx-runtime-compat.js'

export function jsxDEV(
  type: any,
  props: any,
  key?: any,
  _isStaticChildren?: boolean,
  _source?: any,
  _self?: any,
) {
  return jsx(type, props, key)
}
