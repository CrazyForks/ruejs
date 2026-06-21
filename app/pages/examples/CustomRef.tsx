import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import CustomRefDemo from './home-demos/CustomRefDemo'
import source from './home-demos/CustomRefDemo.tsx?raw'

const CustomRef = createHomeSplitExamplePage({
  title: 'customRef 自定义 ref',
  source,
  Demo: CustomRefDemo,
})

export default CustomRef
