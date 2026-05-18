import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import UseStateArrayDemo from './home-demos/UseStateArrayDemo'
import source from './home-demos/UseStateArrayDemo.tsx?raw'

const UseStateArray = createHomeSplitExamplePage({
  title: 'useState 数组',
  source,
  Demo: UseStateArrayDemo,
})

export default UseStateArray
