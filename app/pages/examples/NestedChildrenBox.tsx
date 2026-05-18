import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import NestedChildrenBoxDemo from './home-demos/NestedChildrenBoxDemo'
import source from './home-demos/NestedChildrenBoxDemo.tsx?raw'

const NestedChildrenBox = createHomeSplitExamplePage({
  title: '嵌套 children Box',
  source,
  Demo: NestedChildrenBoxDemo,
})

export default NestedChildrenBox
