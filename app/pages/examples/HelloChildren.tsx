import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import HelloChildrenDemo from './home-demos/HelloChildrenDemo'
import source from './home-demos/HelloChildrenDemo.tsx?raw'

const HelloChildren = createHomeSplitExamplePage({
  title: 'Hello children',
  source,
  Demo: HelloChildrenDemo,
})

export default HelloChildren
