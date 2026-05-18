import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import LayoutChildrenDemo from './home-demos/LayoutChildrenDemo'
import source from './home-demos/LayoutChildrenDemo.tsx?raw'

const LayoutChildren = createHomeSplitExamplePage({
  title: 'Layout children',
  source,
  Demo: LayoutChildrenDemo,
})

export default LayoutChildren
