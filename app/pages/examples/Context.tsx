import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ContextDemo from './home-demos/ContextDemo'
import source from './home-demos/ContextDemo.tsx?raw'

const Context = createHomeSplitExamplePage({
  title: 'Context（移植自 SolidJS）',
  source,
  Demo: ContextDemo,
  codeCardClassName: 'h-[420px] md:h-[860px]',
})

export default Context
