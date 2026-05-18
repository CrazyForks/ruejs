import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import MapListRenderingDemo from './home-demos/MapListRenderingDemo'
import source from './home-demos/MapListRenderingDemo.tsx?raw'

const MapListRendering = createHomeSplitExamplePage({
  title: 'map 列表渲染',
  source,
  Demo: MapListRenderingDemo,
})

export default MapListRendering
