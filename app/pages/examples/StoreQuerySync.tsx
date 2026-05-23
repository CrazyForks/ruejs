import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import StoreQuerySyncDemo from './home-demos/StoreQuerySyncDemo'
import source from './home-demos/StoreQuerySyncDemo.tsx?raw'

const StoreQuerySync = createHomeSplitExamplePage({
  title: 'Store Query Sync 与 URL 状态',
  source,
  Demo: StoreQuerySyncDemo,
  codeCardClassName: 'h-[520px] md:h-[1220px]',
})

export default StoreQuerySync
