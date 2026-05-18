import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ComponentEmitDemo from './home-demos/ComponentEmitDemo'
import source from './home-demos/ComponentEmitDemo.tsx?raw'

const ComponentEmit = createHomeSplitExamplePage({
  title: '组件 emit',
  source,
  Demo: ComponentEmitDemo,
})

export default ComponentEmit
