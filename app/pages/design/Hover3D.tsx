import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Card, Hover3D, Tabs } from '@rue-js/design'
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

interface GalleryEntry {
  title: string
  label: string
  badgeClassName: string
  summary: string
  src: string
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

const galleryEntries: GalleryEntry[] = [
  {
    title: 'Northern Drift',
    label: 'motion',
    badgeClassName: 'badge-primary',
    summary: '保留原有单图 3D 结构，并给画廊增加统一的标题与标签层。',
    src: 'https://img.daisyui.com/images/stock/card-1.webp?x',
  },
  {
    title: 'Signal Bloom',
    label: 'editorial',
    badgeClassName: 'badge-secondary',
    summary: '适合做作品墙、专题入口或横向卡片集合。',
    src: 'https://img.daisyui.com/images/stock/card-2.webp?x',
  },
  {
    title: 'Afterglow Frame',
    label: 'poster',
    badgeClassName: 'badge-accent',
    summary: '根节点仍然只是 Hover3D，自身不需要再额外写 8 个空 div。',
    src: 'https://img.daisyui.com/images/stock/card-3.webp?x',
  },
]

const basicImageCode = [
  '<Hover3D className="mx-2">',
  '  <figure className="max-w-[26rem] overflow-hidden rounded-[1.75rem] shadow-2xl">',
  '    <img',
  '      src="https://img.daisyui.com/images/stock/creditcard.webp"',
  '      alt="Hover 3D credit card preview"',
  '    />',
  '  </figure>',
  '</Hover3D>',
].join('\n')

const linkedCardCode = [
  '<Hover3D href="#hover-3d-case-study" className="mx-2 cursor-pointer">',
  '  <Card className="w-[22rem] overflow-hidden border border-white/10 bg-neutral text-neutral-content shadow-2xl">',
  '    <div className="card-body gap-6 font-mono">',
  '      <div className="flex items-start justify-between">',
  '        <div>',
  '          <div className="text-xs uppercase tracking-[0.3em] opacity-60">Rue Capsule</div>',
  '          <div className="mt-3 text-3xl font-semibold leading-none">03</div>',
  '        </div>',
  '        <span className="badge badge-outline border-white/20 text-white">link root</span>',
  '      </div>',
  '      <div className="space-y-2 text-sm opacity-75">',
  '        <p className="m-0">Hover the whole surface to read the motion.</p>',
  '        <p className="m-0">Click stays on the wrapper instead of nested controls.</p>',
  '      </div>',
  '      <div className="grid grid-cols-2 gap-4 text-sm">',
  '        <div>',
  '          <div className="text-xs uppercase tracking-[0.2em] opacity-40">Depth</div>',
  '          <div className="mt-2">Responsive tilt</div>',
  '        </div>',
  '        <div>',
  '          <div className="text-xs uppercase tracking-[0.2em] opacity-40">Root</div>',
  '          <div className="mt-2">Anchor semantics</div>',
  '        </div>',
  '      </div>',
  '    </div>',
  '  </Card>',
  '</Hover3D>',
].join('\n')

const surfaceWrapperCode = [
  '<Hover3D',
  '  className="max-w-[20rem]"',
  '  surfaceAs="figure"',
  '  surfaceClassName="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-xl"',
  "  surfaceProps={{ 'data-surface': 'poster' }}",
  '>',
  '  <img',
  '    src="https://img.daisyui.com/images/stock/card-2.webp?x"',
  '    alt="surface wrapper demo"',
  '  />',
  '  <figcaption className="space-y-2 px-5 py-4">',
  '    <div className="text-xs uppercase tracking-[0.24em] opacity-50">Surface wrapper</div>',
  '    <div className="text-lg font-semibold">给第一层面板单独挂标签和类名</div>',
  '    <p className="m-0 text-sm opacity-70">适合图片 + 文案一体化的倾斜卡片。</p>',
  '  </figcaption>',
  '</Hover3D>',
].join('\n')

const galleryCode = [
  'const galleryEntries = [',
  "  { title: 'Northern Drift', label: 'motion', badgeClassName: 'badge-primary', src: 'https://img.daisyui.com/images/stock/card-1.webp?x' },",
  "  { title: 'Signal Bloom', label: 'editorial', badgeClassName: 'badge-secondary', src: 'https://img.daisyui.com/images/stock/card-2.webp?x' },",
  "  { title: 'Afterglow Frame', label: 'poster', badgeClassName: 'badge-accent', src: 'https://img.daisyui.com/images/stock/card-3.webp?x' },",
  '];',
  '',
  '<div className="grid gap-6 md:grid-cols-3">',
  '  {galleryEntries.map(entry => (',
  '    <div key={entry.title} className="space-y-3">',
  '      <Hover3D className="mx-1">',
  '        <figure className="overflow-hidden rounded-[1.5rem] bg-base-200">',
  '          <img src={entry.src} alt={entry.title} />',
  '        </figure>',
  '      </Hover3D>',
  '      <div className="px-1">',
  '        <div className="flex items-center justify-between gap-3">',
  '          <h3 className="m-0 text-sm font-semibold">{entry.title}</h3>',
  '          <span className={`badge badge-soft ${entry.badgeClassName}`}>{entry.label}</span>',
  '        </div>',
  '      </div>',
  '    </div>',
  '  ))}',
  '</div>',
].join('\n')

const apiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签，可选 div 或 a；未传时，传入 href 会自动切成 a',
    type: `'div' | 'a'`,
    defaultValue: `'div'`,
  },
  {
    prop: 'className',
    description: '追加到根节点的类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'href',
    description: '链接地址；与 target、rel 一起控制链接根节点',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'overlayClassName',
    description: '追加到 8 个 hover zone 的类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'overlays',
    description: '是否自动生成 8 个 hover zone',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'rel',
    description: '链接 rel；target 为 _blank 且未传时会补上 noreferrer',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'surfaceAs',
    description: '为第一层倾斜面板指定包装标签，例如 figure 或 article',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'surfaceClassName',
    description: '追加到第一层倾斜面板的类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'surfaceProps',
    description: '透传给第一层倾斜面板的额外 HTML 属性',
    type: 'Record<string, any>',
    defaultValue: '-',
  },
  {
    prop: 'target',
    description: '链接目标窗口，仅 a 根节点生效',
    type: 'string',
    defaultValue: '-',
  },
]

const Hover3DDemo: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabLink = ref<TabMode>('preview')
  const tabSurface = ref<TabMode>('preview')
  const tabGallery = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Hover 3D 悬浮 3D</h1>
        <p className="text-sm mt-3 mb-3">
          Hover 3D 负责把第一层内容面板变成一个会随着鼠标位置倾斜的 3D surface。现在除了保留原有的
          8 个命中区，也补齐了链接语义、surface wrapper 与根节点属性透传。
        </p>
        <div className="text-sm">
          <a href="https://daisyui.com/components/hover-3d/" target="_blank">
            查看 Hover 3D 静态样式
          </a>
        </div>

        <div className="not-prose mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5 shadow-sm">
            <span className="badge badge-primary badge-outline">结构</span>
            <div className="mt-4 text-3xl font-semibold tracking-tight">1 + 8</div>
            <p className="m-0 mt-2 text-sm leading-6 opacity-70">
              第一层是倾斜面板，后 8 层由组件自动补齐 hover zones。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5 shadow-sm">
            <span className="badge badge-secondary badge-outline">语义</span>
            <div className="mt-4 text-3xl font-semibold tracking-tight">href → a</div>
            <p className="m-0 mt-2 text-sm leading-6 opacity-70">
              传入 href 后默认切到链接根节点，整卡跳转不必再手写外层 a 标签。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5 shadow-sm">
            <span className="badge badge-accent badge-outline">组合</span>
            <div className="mt-4 text-3xl font-semibold tracking-tight">surface</div>
            <p className="m-0 mt-2 text-sm leading-6 opacity-70">
              用 surfaceAs、surfaceClassName、surfaceProps 精准控制第一层面板。
            </p>
          </div>
        </div>

        <div className="not-prose mt-6 rounded-[1.5rem] border border-base-300 bg-base-100 p-5">
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-outline">非交互内容优先</span>
            <span className="badge badge-outline">整块点击用根节点承接</span>
            <span className="badge badge-outline">不要手写 8 个空 div</span>
          </div>
          <p className="m-0 mt-4 text-sm leading-6 opacity-80">
            内部 children 尽量保持非交互。如果整块需要点击，直接让 Hover3D 自己渲染为链接根节点，避免在倾斜面板里再嵌按钮或链接。
          </p>
        </div>

        <ExampleBlock
          title="基础图片悬浮"
          summary="保留原有图片 demo，用最直接的 1 + 8 结构工作。"
          tab={tabBasic}
          preview={() => (
            <div className="flex justify-center px-2 py-6">
              <Hover3D className="mx-2">
                <figure className="max-w-[26rem] overflow-hidden rounded-[1.75rem] shadow-2xl">
                  <img
                    src="https://img.daisyui.com/images/stock/creditcard.webp"
                    alt="Hover 3D credit card preview"
                  />
                </figure>
              </Hover3D>
            </div>
          )}
          code={basicImageCode}
        />

        <ExampleBlock
          title="整卡点击"
          summary="保留原有整卡链接 demo，并改成只传 href 就能得到链接根节点。"
          tab={tabLink}
          preview={() => (
            <div className="flex justify-center px-2 py-6">
              <Hover3D href="#hover-3d-case-study" className="mx-2 cursor-pointer">
                <Card className="w-[22rem] overflow-hidden border border-white/10 bg-neutral text-neutral-content shadow-2xl">
                  <div className="card-body gap-6 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] opacity-60">
                          Rue Capsule
                        </div>
                        <div className="mt-3 text-3xl font-semibold leading-none">03</div>
                      </div>
                      <span className="badge badge-outline border-white/20 text-white">
                        link root
                      </span>
                    </div>
                    <div className="space-y-2 text-sm opacity-75">
                      <p className="m-0">Hover the whole surface to read the motion.</p>
                      <p className="m-0">
                        Click stays on the wrapper instead of nested controls.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] opacity-40">Depth</div>
                        <div className="mt-2">Responsive tilt</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] opacity-40">Root</div>
                        <div className="mt-2">Anchor semantics</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Hover3D>
            </div>
          )}
          code={linkedCardCode}
        />

        <ExampleBlock
          title="Surface 包装层"
          summary="用 surfaceAs 与 surfaceClassName 精简第一层结构，避免为了 figure 或 article 再手写外壳。"
          tab={tabSurface}
          preview={() => (
            <div className="flex justify-center px-2 py-6">
              <Hover3D
                className="max-w-[20rem]"
                surfaceAs="figure"
                surfaceClassName="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-xl"
                surfaceProps={{ 'data-surface': 'poster' }}
              >
                <img
                  src="https://img.daisyui.com/images/stock/card-2.webp?x"
                  alt="surface wrapper demo"
                />
                <figcaption className="space-y-2 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.24em] opacity-50">
                    Surface wrapper
                  </div>
                  <div className="text-lg font-semibold">给第一层面板单独挂标签和类名</div>
                  <p className="m-0 text-sm opacity-70">适合图片 + 文案一体化的倾斜卡片。</p>
                </figcaption>
              </Hover3D>
            </div>
          )}
          code={surfaceWrapperCode}
        />

        <ExampleBlock
          title="画廊矩阵"
          summary="保留原有多图 demo，并补上统一的排版、标题和标签信息。"
          tab={tabGallery}
          preview={() => (
            <div className="px-2 py-6">
              <div className="grid gap-6 md:grid-cols-3">
                {galleryEntries.map(entry => (
                  <div key={entry.title} className="space-y-3">
                    <Hover3D className="mx-1">
                      <figure className="overflow-hidden rounded-[1.5rem] bg-base-200">
                        <img src={entry.src} alt={entry.title} />
                      </figure>
                    </Hover3D>
                    <div className="px-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="m-0 text-sm font-semibold">{entry.title}</h3>
                        <span className={`badge badge-soft ${entry.badgeClassName}`}>
                          {entry.label}
                        </span>
                      </div>
                      <p className="m-0 mt-2 text-xs leading-5 opacity-70">{entry.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          code={galleryCode}
        />

        <div className="component-preview not-prose text-base-content my-6 lg:my-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># API</h2>
              <p className="m-0 text-sm opacity-70">除下表外，其余 HTML 属性会透传给根节点。</p>
            </div>
          </div>
          <div className="mt-4">
            <ApiTable rows={apiRows} />
          </div>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default Hover3DDemo
