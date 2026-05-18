import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import BasicChildrenBoxDemo from './home-demos/BasicChildrenBoxDemo'
import source from './home-demos/BasicChildrenBoxDemo.tsx?raw'

const BasicChildrenBox = createHomeSplitExamplePage({
  title: '基础 children Box',
  source,
  Demo: BasicChildrenBoxDemo,
})

export default BasicChildrenBox
