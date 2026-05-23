import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ShallowRefDemo from './home-demos/ShallowRefDemo'
import source from './home-demos/ShallowRefDemo.tsx?raw'

const ShallowRef = createHomeSplitExamplePage({
  title: 'shallowRef 浅层 ref',
  source,
  Demo: ShallowRefDemo,
})

export default ShallowRef
