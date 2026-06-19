import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Button, Carousel, Tabs } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'

type TabMode = 'preview' | 'code'

interface ExampleBlockProps {
  title: string
  summary?: string
  tab: { value: TabMode }
  preview: () => any
  code: string
}

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

interface MethodRow {
  name: string
  description: string
  signature: string
}

interface ImageSlide {
  src: string
  alt: string
}

const ExampleBlock: FC<ExampleBlockProps> = ({ title, summary, tab, preview, code }) => {
  return (
    <div className="component-preview not-prose text-base-content my-6 lg:my-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
          {summary ? <p className="m-0 text-sm opacity-70">{summary}</p> : null}
        </div>
      </div>
      <Tabs
        style="box"
        items={[
          { key: 'preview', label: '预览' },
          { key: 'code', label: 'JSX代码' },
        ]}
        activeKey={tab.value}
        onChange={key => (tab.value = key as TabMode)}
        className="mb-3 mt-4"
      />
      {tab.value === 'preview' ? preview() : <Code className="mt-2" lang="tsx" code={code} />}
    </div>
  )
}

const ApiTable: FC<{ rows: ApiRow[] }> = ({ rows }) => {
  return (
    <div className="not-prose overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>属性</th>
            <th>说明</th>
            <th>类型</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.prop}>
              <td>
                <code>{row.prop}</code>
              </td>
              <td>{row.description}</td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                <code>{row.defaultValue}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MethodTable: FC<{ rows: MethodRow[] }> = ({ rows }) => {
  return (
    <div className="not-prose overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>方法</th>
            <th>说明</th>
            <th>签名</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{row.description}</td>
              <td>
                <code>{row.signature}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const buildCode = (lines: string[]) => lines.join('\n')

const stockSlides: ImageSlide[] = [
  {
    src: 'https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp',
    alt: 'Mountain lake morning',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1565098772267-60af42b81ef2.webp',
    alt: 'Desert road sunset',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1572635148818-ef6fd45eb394.webp',
    alt: 'Glass building reflection',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1494253109108-2e30c049369b.webp',
    alt: 'Coffee table detail',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1550258987-190a2d41a8ba.webp',
    alt: 'Beach chair lineup',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1559181567-c3190ca9959b.webp',
    alt: 'Orange sport car',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1601004890684-d8cbf643f5f2.webp',
    alt: 'Night city lights',
  },
]

const heroSlides: ImageSlide[] = [
  {
    src: 'https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp',
    alt: 'Cliffside villa',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp',
    alt: 'Concrete courtyard',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp',
    alt: 'Open road horizon',
  },
  {
    src: 'https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp',
    alt: 'Boutique hotel entry',
  },
]

const picsumSlides: ImageSlide[] = [
  { src: 'https://picsum.photos/id/1011/600/300', alt: 'Forest river view' },
  { src: 'https://picsum.photos/id/1015/600/300', alt: 'Sea cliff sunset' },
  { src: 'https://picsum.photos/id/1016/600/300', alt: 'Foggy mountain ridge' },
]

const verticalSlides: ImageSlide[] = [
  { src: 'https://picsum.photos/id/1005/320/200', alt: 'Street corner' },
  { src: 'https://picsum.photos/id/1018/320/200', alt: 'Window light' },
  { src: 'https://picsum.photos/id/1025/320/200', alt: 'Coastal trail' },
]

const renderImageSlides = (
  slides: ReadonlyArray<ImageSlide>,
  itemClassName?: string,
  imageClassName?: string,
) => {
  return slides.map(slide => (
    <Carousel.Item key={slide.src} className={itemClassName}>
      <img className={imageClassName} src={slide.src} alt={slide.alt} />
    </Carousel.Item>
  ))
}

const apiRows: ApiRow[] = [
  {
    prop: 'align',
    description: '控制 scrollx 模式下当前 slide 的对齐方式',
    type: '`start` | `center` | `end`',
    defaultValue: '`start`',
  },
  {
    prop: 'direction',
    description: '切换水平或垂直布局',
    type: '`horizontal` | `vertical`',
    defaultValue: '`horizontal`',
  },
  {
    prop: 'effect',
    description: '切换滚动或淡入淡出效果',
    type: '`scrollx` | `fade`',
    defaultValue: '`scrollx`',
  },
  {
    prop: 'arrows',
    description: '显示内置切换箭头',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'dots',
    description: '显示分页 dots；对象形态支持附加 className',
    type: 'boolean | { className?: string }',
    defaultValue: 'false',
  },
  {
    prop: 'dotPlacement',
    description: '控制 dots 在上、下、起始侧或结束侧的位置',
    type: '`top` | `bottom` | `start` | `end`',
    defaultValue: '`bottom`',
  },
  {
    prop: 'auto / autoplay',
    description: '开启自动播放；`autoplay={{ dotDuration: true }}` 会显示进度 dots',
    type: 'boolean | { dotDuration?: boolean }',
    defaultValue: 'false',
  },
  {
    prop: 'autoplaySpeed / interval',
    description: '控制自动播放节奏，保留 `interval` 兼容写法',
    type: 'number',
    defaultValue: '3000',
  },
  {
    prop: 'autoDirection',
    description: '控制自动播放方向',
    type: '`forward` | `backward`',
    defaultValue: '`forward`',
  },
  {
    prop: 'activeIndex / initialSlide',
    description: '指定初始展示 slide；推荐外部联动时配合 `apiRef` 使用',
    type: 'number',
    defaultValue: '0',
  },
  {
    prop: 'apiRef',
    description: '暴露 `goTo / next / prev / autoPlay / stop` 方法',
    type: '{ current?: CarouselRef }',
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '使用数组而不是 JSX children 直接生成 slide',
    type: 'Array<{ content: any; className?: string }>',
    defaultValue: '-',
  },
]

const methodRows: MethodRow[] = [
  {
    name: 'goTo',
    description: '跳转到指定 slide，可选是否跳过动画',
    signature: '(slide: number, dontAnimate?: boolean) => void',
  },
  {
    name: 'next',
    description: '切换到下一张',
    signature: '() => void',
  },
  {
    name: 'prev',
    description: '切换到上一张',
    signature: '() => void',
  },
  {
    name: 'autoPlay',
    description: '手动恢复自动播放，或传入 `leave` / `blur` 停止',
    signature: '(playType?: `update` | `leave` | `blur`) => void',
  },
  {
    name: 'stop',
    description: '显式停止自动播放',
    signature: '() => void',
  },
]

const snapCode = buildCode([
  'const scenicSlides = [',
  "  'https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp',",
  "  'https://img.daisyui.com/images/stock/photo-1565098772267-60af42b81ef2.webp',",
  "  'https://img.daisyui.com/images/stock/photo-1572635148818-ef6fd45eb394.webp',",
  ']',
  '',
  '<div className="grid gap-4">',
  '  <Carousel align="start" className="rounded-box" auto interval={1200}>',
  '    {scenicSlides.map(src => (',
  '      <Carousel.Item key={src}>',
  '        <img src={src} alt="Scenic slide" />',
  '      </Carousel.Item>',
  '    ))}',
  '  </Carousel>',
  '  <Carousel align="center" className="rounded-box" auto interval={1500}>',
  '    {scenicSlides.map(src => (',
  '      <Carousel.Item key={`center-${src}`}>',
  '        <img src={src} alt="Centered slide" />',
  '      </Carousel.Item>',
  '    ))}',
  '  </Carousel>',
  '  <Carousel align="end" className="rounded-box" auto interval={1800}>',
  '    {scenicSlides.map(src => (',
  '      <Carousel.Item key={`end-${src}`}>',
  '        <img src={src} alt="End slide" />',
  '      </Carousel.Item>',
  '    ))}',
  '  </Carousel>',
  '</div>',
])

const widthCode = buildCode([
  '<div className="grid gap-6 xl:grid-cols-3">',
  '  <Carousel className="w-72 rounded-box" auto interval={1400}>',
  '    <Carousel.Item className="w-full">',
  '      <img className="h-48 w-full object-cover" src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp" alt="Full width" />',
  '    </Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel className="w-96 rounded-box" auto interval={1600}>',
  '    <Carousel.Item className="w-1/2 pr-3">',
  '      <img className="w-full rounded-box" src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp" alt="Half width" />',
  '    </Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel align="center" className="max-w-xl rounded-box bg-neutral p-4 space-x-4" auto interval={1800}>',
  '    <Carousel.Item>',
  '      <img className="rounded-box" src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp" alt="Full bleed" />',
  '    </Carousel.Item>',
  '  </Carousel>',
  '</div>',
])

const verticalCode = buildCode([
  '<div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">',
  '  <Carousel align="center" className="rounded-box w-full" auto interval={1600}>',
  '    <Carousel.Item><img alt="Forest river view" src="https://picsum.photos/id/1011/600/300" /></Carousel.Item>',
  '    <Carousel.Item><img alt="Sea cliff sunset" src="https://picsum.photos/id/1015/600/300" /></Carousel.Item>',
  '    <Carousel.Item><img alt="Foggy mountain ridge" src="https://picsum.photos/id/1016/600/300" /></Carousel.Item>',
  '  </Carousel>',
  '  <div className="grid gap-4">',
  '    <Carousel direction="vertical" className="h-80 rounded-box" auto interval={1500}>',
  '      <Carousel.Item className="h-full"><img src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp" alt="Vertical gallery" /></Carousel.Item>',
  '    </Carousel>',
  '    <Carousel direction="vertical" className="rounded-box w-80 h-64" auto interval={1700}>',
  '      <Carousel.Item><img alt="Street corner" src="https://picsum.photos/id/1005/320/200" /></Carousel.Item>',
  '      <Carousel.Item><img alt="Window light" src="https://picsum.photos/id/1018/320/200" /></Carousel.Item>',
  '      <Carousel.Item><img alt="Coastal trail" src="https://picsum.photos/id/1025/320/200" /></Carousel.Item>',
  '    </Carousel>',
  '  </div>',
  '</div>',
])

const arrowsCode = buildCode([
  '<div className="grid gap-6 xl:grid-cols-2">',
  '  <Carousel className="w-full rounded-box" arrows dots speed={400}>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Cliffside villa" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Concrete courtyard" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp" alt="Open road horizon" /></Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel className="w-full rounded-box" arrows dots auto autoDirection="backward" autoplaySpeed={1800}>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Reverse autoplay" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Reverse autoplay" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp" alt="Reverse autoplay" /></Carousel.Item>',
  '  </Carousel>',
  '</div>',
])

const indicatorCode = buildCode([
  'const indicatorApiRef: { current?: any } = { current: undefined }',
  'const indicatorIndex = ref(0)',
  '',
  '<Carousel',
  '  className="w-full rounded-box"',
  '  apiRef={indicatorApiRef}',
  '  dots',
  '  onIndexChange={index => (indicatorIndex.value = index)}',
  '>',
  '  <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Indicator slide" /></Carousel.Item>',
  '  <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Indicator slide" /></Carousel.Item>',
  '  <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp" alt="Indicator slide" /></Carousel.Item>',
  '  <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp" alt="Indicator slide" /></Carousel.Item>',
  '</Carousel>',
  '',
  '<div className="flex justify-center gap-2 py-3">',
  '  {[0, 1, 2, 3].map(index => (',
  '    <button',
  '      type="button"',
  '      key={index}',
  '      className={`btn btn-xs ${indicatorIndex.value === index ? "btn-primary" : ""}`}',
  '      aria-pressed={indicatorIndex.value === index ? "true" : "false"}',
  '      onClick={() => indicatorApiRef.current?.goTo(index)}',
  '    >',
  '      {index + 1}',
  '    </button>',
  '  ))}',
  '</div>',
])

const apiControlCode = buildCode([
  'const apiRef: { current?: any } = { current: undefined }',
  'const currentIndex = ref(0)',
  '',
  '<div className="space-y-4">',
  '  <div className="flex flex-wrap items-center gap-2">',
  '    <Button size="sm" onClick={() => apiRef.current?.prev()}>Prev</Button>',
  '    <Button size="sm" onClick={() => apiRef.current?.next()}>Next</Button>',
  '    <Button size="sm" type="outlined" onClick={() => apiRef.current?.goTo(2)}>Go to 3</Button>',
  '    <Button size="sm" type="dashed" onClick={() => apiRef.current?.goTo(0, true)}>Instant 1</Button>',
  '    <span className="text-sm opacity-70">当前索引：{currentIndex.value}</span>',
  '  </div>',
  '  <Carousel apiRef={apiRef} dots onIndexChange={index => (currentIndex.value = index)} className="rounded-box w-full">',
  '    <Carousel.Item className="w-full"><img className="w-full object-cover" alt="Forest river view" src="https://picsum.photos/id/1011/600/300" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full object-cover" alt="Sea cliff sunset" src="https://picsum.photos/id/1015/600/300" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full object-cover" alt="Foggy mountain ridge" src="https://picsum.photos/id/1016/600/300" /></Carousel.Item>',
  '  </Carousel>',
  '</div>',
])

const autoplayCode = buildCode([
  '<div className="grid gap-6 xl:grid-cols-2">',
  '  <Carousel align="center" auto loop interval={2500} className="rounded-box w-full">',
  '    <Carousel.Item><img alt="Forest river view" src="https://picsum.photos/id/1011/600/300" /></Carousel.Item>',
  '    <Carousel.Item><img alt="Sea cliff sunset" src="https://picsum.photos/id/1015/600/300" /></Carousel.Item>',
  '    <Carousel.Item><img alt="Foggy mountain ridge" src="https://picsum.photos/id/1016/600/300" /></Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel',
  '    className="rounded-box w-full"',
  '    dots',
  '    autoplay={{ dotDuration: true }}',
  '    autoplaySpeed={2200}',
  '    pauseOnHover',
  '  >',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Progress slide" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Progress slide" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp" alt="Progress slide" /></Carousel.Item>',
  '  </Carousel>',
  '</div>',
])

const effectCode = buildCode([
  '<div className="grid gap-6 xl:grid-cols-3">',
  '  <Carousel effect="fade" dots className="rounded-box">',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Fade slide" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Fade slide" /></Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel dots dotPlacement="top" className="rounded-box">',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp" alt="Top dots" /></Carousel.Item>',
  '    <Carousel.Item className="w-full"><img className="w-full" src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp" alt="Top dots" /></Carousel.Item>',
  '  </Carousel>',
  '',
  '  <Carousel direction="vertical" dots dotPlacement="end" className="rounded-box h-72 w-64">',
  '    <Carousel.Item className="h-full"><img className="h-full w-full object-cover" src="https://picsum.photos/id/1005/320/200" alt="Side dots" /></Carousel.Item>',
  '    <Carousel.Item className="h-full"><img className="h-full w-full object-cover" src="https://picsum.photos/id/1018/320/200" alt="Side dots" /></Carousel.Item>',
  '  </Carousel>',
  '</div>',
])

const itemsCode = buildCode([
  'const items = [',
  '  {',
  '    content: <img alt="Forest river view" src="https://picsum.photos/id/1011/600/300" />,',
  '    className: "relative",',
  '  },',
  '  {',
  '    content: <img alt="Sea cliff sunset" src="https://picsum.photos/id/1015/600/300" />,',
  '    className: "relative",',
  '  },',
  '  {',
  '    content: <img alt="Foggy mountain ridge" src="https://picsum.photos/id/1016/600/300" />,',
  '    className: "relative",',
  '  },',
  ']',
  '',
  '<Carousel className="rounded-box w-full" align="center" arrows dots items={items} />',
])

const indicatorApiRef: { current?: any } = { current: undefined }
const methodsApiRef: { current?: any } = { current: undefined }

const CarouselDemo: FC = () => {
  const tabSnap = ref<TabMode>('preview')
  const tabWidth = ref<TabMode>('preview')
  const tabVertical = ref<TabMode>('preview')
  const tabArrows = ref<TabMode>('preview')
  const tabIndicators = ref<TabMode>('preview')
  const tabApi = ref<TabMode>('preview')
  const tabAutoplay = ref<TabMode>('preview')
  const tabEffects = ref<TabMode>('preview')
  const tabItems = ref<TabMode>('preview')

  const indicatorIndex = ref(0)
  const methodsIndex = ref(0)

  const items = picsumSlides.map(slide => ({
    content: <img alt={slide.alt} src={slide.src} />,
    className: 'relative',
  }))

  const indicatorGo = (index: number) => {
    indicatorApiRef.current?.goTo(index)
  }

  const runMethod = (action: 'prev' | 'next' | 'go-2' | 'instant-0') => {
    if (!methodsApiRef.current) return
    if (action === 'prev') {
      methodsApiRef.current.prev()
      return
    }
    if (action === 'next') {
      methodsApiRef.current.next()
      return
    }
    if (action === 'go-2') {
      methodsApiRef.current.goTo(2)
      return
    }
    methodsApiRef.current.goTo(0, true)
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Carousel 跑马灯</h1>
        <p className="mt-3 mb-3 text-sm">
          Rue 的 Carousel 现在兼顾两类能力：一类延续 daisyUI
          的滚动式视觉布局，保留多宽度、垂直、full-bleed 这些旧 demo；另一类补齐了成熟轮播组件常见的
          arrows、dots、fade、dotPlacement 与方法控制。
        </p>

        <div className="not-prose my-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Layout</div>
            <div className="mt-2 text-lg font-semibold">保留 Rue 原有滚动感</div>
            <p className="mt-2 text-sm text-base-content/70">
              `align`、`direction`、宽度类与 full-bleed 布局仍可直接复用。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Control</div>
            <div className="mt-2 text-lg font-semibold">补齐 dots / arrows / methods</div>
            <p className="mt-2 text-sm text-base-content/70">
              支持 built-in arrows、dot placement、`apiRef` 方法与外部按钮编排。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Effects</div>
            <div className="mt-2 text-lg font-semibold">新增 fade 与 progress dots</div>
            <p className="mt-2 text-sm text-base-content/70">
              既能做内容轮播，也能做更偏产品展示或运营 banner 的切换样式。
            </p>
          </div>
        </div>

        <ExampleBlock
          title="Snap 对齐总览"
          summary="融合旧的 Snap to start / center / end 三个 demo，保留 Rue 的滚动对齐视觉。"
          tab={tabSnap}
          code={snapCode}
          preview={() => (
            <div className="grid gap-5">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Start</div>
                <Carousel align="start" className="rounded-box" auto interval={1200}>
                  {renderImageSlides(stockSlides.slice(0, 5))}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Center</div>
                <Carousel align="center" className="rounded-box" auto interval={1500}>
                  {renderImageSlides(stockSlides.slice(0, 5))}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">End</div>
                <Carousel align="end" className="rounded-box" auto interval={1800}>
                  {renderImageSlides(stockSlides.slice(0, 5))}
                </Carousel>
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="布局宽度总览"
          summary="融合旧的 full width、half width 与 full-bleed 三个 demo，用同一套 Carousel 结构呈现不同密度。"
          tab={tabWidth}
          code={widthCode}
          preview={() => (
            <>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Full width items</div>
                <Carousel className="w-72 rounded-box" auto interval={1400}>
                  {renderImageSlides(stockSlides.slice(0, 4), 'w-full', 'h-48 w-full object-cover')}
                </Carousel>
              </div>

              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Half width items</div>
                <Carousel className="w-96 rounded-box" auto interval={1600}>
                  {renderImageSlides(
                    stockSlides.slice(0, 6),
                    'w-1/2 pr-3',
                    'w-full rounded-box object-cover',
                  )}
                </Carousel>
              </div>

              <div className="rounded-box border border-base-300 bg-neutral p-4 text-neutral-content">
                <div className="mb-3 text-sm font-medium text-neutral-content/80">Full bleed</div>
                <Carousel align="center" className="rounded-box space-x-4" auto interval={1800}>
                  {renderImageSlides(stockSlides.slice(0, 5), undefined, 'rounded-box')}
                </Carousel>
              </div>
            </>
          )}
        />

        <ExampleBlock
          title="基础与垂直布局"
          summary="保留旧的基础水平居中、Vertical carousel 与垂直方向 demo，但按使用意图重新排成一个 block。"
          tab={tabVertical}
          code={verticalCode}
          preview={() => (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">基础（水平居中）</div>
                <Carousel align="center" className="rounded-box w-full" auto interval={1600}>
                  {renderImageSlides(picsumSlides)}
                </Carousel>
              </div>
              <div className="grid gap-4">
                <div className="rounded-box border border-base-300 bg-base-100 p-4">
                  <div className="mb-3 text-sm font-medium">Vertical carousel</div>
                  <Carousel direction="vertical" className="h-80 rounded-box" auto interval={1500}>
                    {renderImageSlides(
                      stockSlides.slice(0, 4),
                      'h-full',
                      'h-full w-full object-cover',
                    )}
                  </Carousel>
                </div>
                <div className="rounded-box border border-base-300 bg-base-100 p-4">
                  <div className="mb-3 text-sm font-medium">垂直方向</div>
                  <Carousel
                    direction="vertical"
                    className="rounded-box w-80 h-64"
                    auto
                    interval={1700}
                  >
                    {renderImageSlides(verticalSlides)}
                  </Carousel>
                </div>
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="导航按钮与反向自动播放"
          summary="把旧的 next/prev buttons 与 auto left demo 融合为更完整的 arrows 场景，同时保留 Rue 的大图视觉。"
          tab={tabArrows}
          code={arrowsCode}
          preview={() => (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 flex items-center justify-between text-sm font-medium">
                  <span>Carousel with next/prev buttons</span>
                  <span className="opacity-60">arrows + dots</span>
                </div>
                <Carousel className="w-full rounded-box" arrows dots speed={400}>
                  {renderImageSlides(heroSlides, 'w-full', 'w-full object-cover')}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 flex items-center justify-between text-sm font-medium">
                  <span>Carousel with next/prev buttons (auto left)</span>
                  <span className="opacity-60">backward autoplay</span>
                </div>
                <Carousel
                  className="w-full rounded-box"
                  arrows
                  dots
                  auto
                  autoDirection="backward"
                  autoplaySpeed={1800}
                >
                  {renderImageSlides(heroSlides, 'w-full', 'w-full object-cover')}
                </Carousel>
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="Carousel with indicator buttons"
          summary="保留旧的 indicator buttons 场景，但切换改为稳定的 `apiRef.goTo`，按钮和 dots 会同步当前 slide。"
          tab={tabIndicators}
          code={indicatorCode}
          preview={() => (
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <Carousel
                className="w-full rounded-box"
                apiRef={indicatorApiRef}
                activeIndex={indicatorIndex.value}
                dots
                onIndexChange={index => (indicatorIndex.value = index)}
              >
                {renderImageSlides(heroSlides, 'w-full', 'w-full object-cover')}
              </Carousel>
              <div className="flex flex-wrap justify-center gap-2 py-3">
                {[0, 1, 2, 3].map(index => (
                  <button
                    type="button"
                    key={index}
                    className={`btn btn-xs ${indicatorIndex.value === index ? 'btn-primary' : ''}`}
                    aria-pressed={indicatorIndex.value === index ? 'true' : 'false'}
                    onClick={() => indicatorGo(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="受控切换 / API 方法"
          summary="旧的“受控切换” demo 在 Rue 设计页里改成方法编排：外部按钮控制轮播，组件通过 `onIndexChange` 回写当前索引。"
          tab={tabApi}
          code={apiControlCode}
          preview={() => (
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => runMethod('prev')}>
                  Prev
                </Button>
                <Button size="sm" onClick={() => runMethod('next')}>
                  Next
                </Button>
                <Button size="sm" type="outlined" onClick={() => runMethod('go-2')}>
                  Go to 3
                </Button>
                <Button size="sm" type="dashed" onClick={() => runMethod('instant-0')}>
                  Instant 1
                </Button>
                <span className="ml-auto text-sm opacity-70">当前索引：{methodsIndex.value}</span>
              </div>
              <Carousel
                apiRef={methodsApiRef}
                activeIndex={methodsIndex.value}
                dots
                className="rounded-box w-full"
                onIndexChange={index => (methodsIndex.value = index)}
              >
                {renderImageSlides(picsumSlides, 'w-full', 'w-full object-cover')}
              </Carousel>
            </div>
          )}
        />

        <ExampleBlock
          title="自动播放与进度 dots"
          summary="保留旧的自动播放循环 demo，同时补一个进度型 progress dots 场景。"
          tab={tabAutoplay}
          code={autoplayCode}
          preview={() => (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">自动播放（循环）</div>
                <Carousel align="center" auto loop interval={2500} className="rounded-box w-full">
                  {renderImageSlides(picsumSlides)}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Autoplay progress</div>
                <Carousel
                  className="rounded-box w-full"
                  dots
                  autoplay={{ dotDuration: true }}
                  autoplaySpeed={2200}
                  pauseOnHover
                >
                  {renderImageSlides(heroSlides.slice(0, 3), 'w-full', 'w-full object-cover')}
                </Carousel>
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="效果与位置增强"
          summary="新增 fade、top dots 和 end dots。这里保持 Rue 的底色，但能力组织更偏成熟业务组件的写法。"
          tab={tabEffects}
          code={effectCode}
          preview={() => (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">Fade</div>
                <Carousel effect="fade" dots className="rounded-box">
                  {renderImageSlides(heroSlides.slice(0, 3), 'w-full', 'w-full object-cover')}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">dotPlacement=&quot;top&quot;</div>
                <Carousel dots dotPlacement="top" className="rounded-box">
                  {renderImageSlides(heroSlides.slice(0, 3), 'w-full', 'w-full object-cover')}
                </Carousel>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">
                  dotPlacement=&quot;end&quot; + vertical
                </div>
                <Carousel
                  direction="vertical"
                  dots
                  dotPlacement="end"
                  className="rounded-box h-72 w-64"
                >
                  {renderImageSlides(verticalSlides, 'h-full', 'h-full w-full object-cover')}
                </Carousel>
              </div>
            </div>
          )}
        />

        <ExampleBlock
          title="Carousel 通过数据渲染（数组，组件内部）"
          summary="保留原来的 items 数组模式，并加上 arrows 与 dots，让它更接近真正的产品组件用法。"
          tab={tabItems}
          code={itemsCode}
          preview={() => (
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <Carousel className="rounded-box w-full" align="center" arrows dots items={items} />
            </div>
          )}
        />

        <h2>API</h2>
        <ApiTable rows={apiRows} />

        <h2 className="mt-8">Methods</h2>
        <MethodTable rows={methodRows} />
      </div>
    </SidebarPlayground>
  )
}

export default CarouselDemo
