import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import LocalCounterDemo from './home-demos/LocalCounterDemo'
import source from './home-demos/LocalCounterDemo.tsx?raw'

const LocalCounter = createHomeSplitExamplePage({
  title: '本地 ref 计数器',
  source,
  Demo: LocalCounterDemo,
})

export default LocalCounter
