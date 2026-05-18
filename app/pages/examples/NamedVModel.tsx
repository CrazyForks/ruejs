import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import NamedVModelDemo from './home-demos/NamedVModelDemo'
import source from './home-demos/NamedVModelDemo.tsx?raw'

const NamedVModel = createHomeSplitExamplePage({
  title: '命名 vModel',
  source,
  Demo: NamedVModelDemo,
})

export default NamedVModel
