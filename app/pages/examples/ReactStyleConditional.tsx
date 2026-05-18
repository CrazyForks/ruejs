import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ReactStyleConditionalDemo from './home-demos/ReactStyleConditionalDemo'
import source from './home-demos/ReactStyleConditionalDemo.tsx?raw'

const ReactStyleConditional = createHomeSplitExamplePage({
  title: '条件渲染',
  source,
  Demo: ReactStyleConditionalDemo,
})

export default ReactStyleConditional
