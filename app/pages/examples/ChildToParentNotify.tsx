import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ChildToParentNotifyDemo from './home-demos/ChildToParentNotifyDemo'
import source from './home-demos/ChildToParentNotifyDemo.tsx?raw'

const ChildToParentNotify = createHomeSplitExamplePage({
  title: '子调父方法',
  source,
  Demo: ChildToParentNotifyDemo,
})

export default ChildToParentNotify
