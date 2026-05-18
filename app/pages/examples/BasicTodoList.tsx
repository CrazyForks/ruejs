import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import BasicTodoListDemo from './home-demos/BasicTodoListDemo'
import source from './home-demos/BasicTodoListDemo.tsx?raw'

const BasicTodoList = createHomeSplitExamplePage({
  title: '基础待办事项',
  source,
  Demo: BasicTodoListDemo,
})

export default BasicTodoList
