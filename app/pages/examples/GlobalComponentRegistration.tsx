import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import GlobalComponentRegistrationDemo from './home-demos/GlobalComponentRegistrationDemo'
import source from './home-demos/GlobalComponentRegistrationDemo.tsx?raw'

const GlobalComponentRegistration = createHomeSplitExamplePage({
  title: 'useApp().component 运行时注册',
  source,
  Demo: GlobalComponentRegistrationDemo,
})

export default GlobalComponentRegistration
