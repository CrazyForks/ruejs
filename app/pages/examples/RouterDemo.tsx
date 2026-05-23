import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import RouterDemoScene from './router-demo/RouterDemoScene'
import source from './router-demo/RouterDemoScene.tsx?raw'

const RouterDemo = createHomeSplitExamplePage({
  title: '路由（嵌套 / 命名路由 / 守卫）',
  source,
  Demo: RouterDemoScene,
  codeCardClassName: 'h-[560px] md:h-[1850px]',
})

export default RouterDemo
