import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ParentChildCounterControlDemo from './home-demos/ParentChildCounterControlDemo'
import source from './home-demos/ParentChildCounterControlDemo.tsx?raw'

const ParentChildCounterControl = createHomeSplitExamplePage({
  title: '父控子计数',
  source,
  Demo: ParentChildCounterControlDemo,
})

export default ParentChildCounterControl
