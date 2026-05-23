import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import ResourceJSXDemo from './home-demos/ResourceJSXDemo'
import source from './home-demos/ResourceJSXDemo.tsx?raw'

const ResourceJSX = createHomeSplitExamplePage({
  title: '资源（纯 JSX，移植自 SolidJS）',
  source,
  Demo: ResourceJSXDemo,
  codeCardClassName: 'h-[420px] md:h-[900px]',
})

export default ResourceJSX
