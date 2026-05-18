import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import RenderCounterDemo from './home-demos/RenderCounterDemo'
import source from './home-demos/RenderCounterDemo.tsx?raw'

const RenderCounter = createHomeSplitExamplePage({
  title: '渲染函数计数器',
  source,
  Demo: RenderCounterDemo,
})

export default RenderCounter
