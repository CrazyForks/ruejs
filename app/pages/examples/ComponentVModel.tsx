import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ComponentVModelDemo from './home-demos/ComponentVModelDemo'
import source from './home-demos/ComponentVModelDemo.tsx?raw'

const ComponentVModel = createHomeSplitExamplePage({
  title: '组件级 v-model',
  source,
  Demo: ComponentVModelDemo,
})

export default ComponentVModel
