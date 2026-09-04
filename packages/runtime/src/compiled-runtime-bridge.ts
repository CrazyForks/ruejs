import type { ComponentInstance, ComponentProps, RenderOutput } from './runtime-types'

type CreateCompiledComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
) => RenderOutput
type CreateCompiledFragment = (children: readonly unknown[]) => RenderOutput

let createComponent: CreateCompiledComponent | undefined
let createFragment: CreateCompiledFragment | undefined

export const installCompiledRuntimeBridge = (
  nextCreateComponent: CreateCompiledComponent,
  nextCreateFragment: CreateCompiledFragment,
) => {
  createComponent = nextCreateComponent
  createFragment = nextCreateFragment
}

export const invokeCompiledComponent: CreateCompiledComponent = (type, props) => {
  if (!createComponent) {
    throw new Error('[rue] compiled runtime bridge is not initialized')
  }
  return createComponent(type, props)
}

export const invokeCompiledFragment: CreateCompiledFragment = children => {
  if (!createFragment) {
    throw new Error('[rue] compiled runtime bridge is not initialized')
  }
  return createFragment(children)
}
