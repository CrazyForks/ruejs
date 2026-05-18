import { type FC } from '@rue-js/rue'
import ExamplePlayground from './ExamplePlayground'
import ReactiveCounterDemo from './home-demos/ReactiveCounterDemo'
import source from './home-demos/ReactiveCounterDemo.tsx?raw'

const ReactiveCounter: FC = () => {
  return (
    <ExamplePlayground title="基础计数器" source={source}>
      <ReactiveCounterDemo />
    </ExamplePlayground>
  )
}

export default ReactiveCounter
