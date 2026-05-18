import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import UseStateObjectDemo from './home-demos/UseStateObjectDemo'
import source from './home-demos/UseStateObjectDemo.tsx?raw'

const UseStateObject = createHomeSplitExamplePage({
  title: 'useState 对象',
  source,
  Demo: UseStateObjectDemo,
})

export default UseStateObject
