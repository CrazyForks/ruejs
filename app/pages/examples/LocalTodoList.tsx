import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import LocalTodoListDemo from './home-demos/LocalTodoListDemo'
import source from './home-demos/LocalTodoListDemo.tsx?raw'

const LocalTodoList = createHomeSplitExamplePage({
  title: '本地待办事项',
  source,
  Demo: LocalTodoListDemo,
})

export default LocalTodoList
