import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import I18nLocaleSwitcherDemo from './home-demos/I18nLocaleSwitcherDemo'
import source from './home-demos/I18nLocaleSwitcherDemo.tsx?raw'

const I18nSwitcher = createHomeSplitExamplePage({
  title: '语言切换（_ 模型）',
  source,
  Demo: I18nLocaleSwitcherDemo,
  codeCardClassName: 'h-[420px] md:h-[1080px]',
})

export default I18nSwitcher
