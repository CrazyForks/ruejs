import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import UseStateCounterDemo from './home-demos/UseStateCounterDemo'
import source from './home-demos/UseStateCounterDemo.tsx?raw'

const UseStateCounter = createHomeSplitExamplePage({
  title: 'useState 计数器',
  source,
  Demo: UseStateCounterDemo,
})

export default UseStateCounter
