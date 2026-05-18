import { type FC } from '@rue-js/rue'
import ExamplePlayground from './ExamplePlayground'
import SVGSharedNamespaceDemo from './home-demos/SVGSharedNamespaceDemo'
import source from './home-demos/SVGSharedNamespaceDemo.tsx?raw'

const SVGSharedNamespace: FC = () => {
  return (
    <ExamplePlayground
      title="SVG 共享标签命名空间"
      source={source}
      codeCardClassName="h-[640px] md:h-[760px]"
    >
      <SVGSharedNamespaceDemo />
    </ExamplePlayground>
  )
}

export default SVGSharedNamespace
