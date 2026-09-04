import { createCompiledFragmentHandle, createJsxComponent } from '@rue-js/runtime'

export const Fragment = Symbol.for('rue.jsx.fragment')

export const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => {
  const resolvedProps = key === undefined ? props : { ...props, key }
  if (type === Fragment) {
    const children = resolvedProps?.children
    return createCompiledFragmentHandle(Array.isArray(children) ? children : [children])
  }
  return createJsxComponent(type as any, resolvedProps)
}

export const jsxs = jsx
export const jsxDEV = jsx
