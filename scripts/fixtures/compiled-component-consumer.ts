import {
  _$compiledCreateElement,
  _$compiledRoot,
  _$mountCompiledComponent,
  _$withCompiledPropsUpdater,
  RUE_COMPILED_UPDATE_PROPS_KEY,
  type CompiledComponentHandle,
} from '../../packages/runtime/src/compiled'

type DemoProps = {
  label: string
}

export const createCompiledConsumer = (
  parent: ParentNode,
  readProps: () => DemoProps,
): Node | null | undefined => {
  const factory = (initialProps: DemoProps): CompiledComponentHandle<DemoProps> => {
    let label = initialProps.label
    const root = _$compiledRoot(() => {
      const element = _$compiledCreateElement('div')
      element.textContent = label
      parent.appendChild(element)
      return element
    })

    return _$withCompiledPropsUpdater(root, nextProps => {
      label = nextProps.label
    })
  }

  const result = _$mountCompiledComponent(parent, factory, readProps)
  void RUE_COMPILED_UPDATE_PROPS_KEY
  return result
}
