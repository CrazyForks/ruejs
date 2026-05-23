import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Mask, Tabs } from '@rue-js/design'
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

const photoUrl = 'https://picsum.photos/320/320?grayscale'
const photoWideUrl = 'https://picsum.photos/420/240?grayscale'
const photoTallUrl = 'https://picsum.photos/240/420?grayscale'

const shapes = [
  'squircle',
  'heart',
  'hexagon',
  'hexagon-2',
  'decagon',
  'pentagon',
  'diamond',
  'square',
  'circle',
] as const
const stars = ['star', 'star-2'] as const
const triangles = ['triangle', 'triangle-2', 'triangle-3', 'triangle-4'] as const
const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
const fitExamples = [
  { label: 'cover', fit: 'cover', src: photoWideUrl },
  { label: 'contain', fit: 'contain', src: photoTallUrl },
  { label: 'fill', fit: 'fill', src: photoWideUrl },
] as const
const toneExamples = [
  { label: 'Base', tone: 'base' },
  { label: 'Primary', tone: 'primary' },
  { label: 'Secondary', tone: 'secondary' },
  { label: 'Accent', tone: 'accent' },
  { label: 'Success', tone: 'success' },
  { label: 'Warning', tone: 'warning' },
] as const

const apiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定渲染标签，默认输出 img，也可渲染 div、figure 等任意宿主元素',
    type: 'string',
    defaultValue: `'img'`,
  },
  {
    prop: 'shape',
    description: '遮罩形状，覆盖当前支持的全部 mask-* 造型',
    type: `'squircle' | 'heart' | 'hexagon' | 'hexagon-2' | 'decagon' | 'pentagon' | 'diamond' | 'square' | 'circle' | 'star' | 'star-2' | 'triangle' | 'triangle-2' | 'triangle-3' | 'triangle-4'`,
    defaultValue: `'squircle'`,
  },
  {
    prop: 'half',
    description: '半边遮罩；支持数字写法，也支持 start / end 语义别名',
    type: `'1' | '2' | 'start' | 'end'`,
    defaultValue: '-',
  },
  {
    prop: 'size',
    description: '语义尺寸，映射到一组常用正方形尺寸 class',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'`,
    defaultValue: '-',
  },
  {
    prop: 'fit',
    description: '媒体内容适配模式，输出 object-* 类名',
    type: `'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`,
    defaultValue: `'cover'`,
  },
  {
    prop: 'tone',
    description: '给非图片宿主补齐背景与前景色，方便做头像牌、数字徽记和内容卡片',
    type: `'base' | 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'`,
    defaultValue: '-',
  },
  {
    prop: 'bordered',
    description: '追加轻量内描边，适合浅背景图片或卡片',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'ring',
    description: '追加 ring 与 offset，tone 存在时会自动继承对应的环颜色',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'shadow',
    description: '追加投影，适合头像、封面和内容模块',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'interactive',
    description: '追加轻量 hover 动效，方便做可点击素材墙或精选卡片',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'className',
    description: '透传自定义样式类，可与组件生成的 mask 类叠加',
    type: 'string',
    defaultValue: '-',
  },
]

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

const MaskPage: FC = () => {
  const tabShapes = ref<TabMode>('preview')
  const tabStars = ref<TabMode>('preview')
  const tabTriangles = ref<TabMode>('preview')
  const tabHalf = ref<TabMode>('preview')
  const tabSize = ref<TabMode>('preview')
  const tabFit = ref<TabMode>('preview')
  const tabTone = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Mask 形状裁切</h1>
        <p className="text-sm mt-3 mb-3">
          Mask 现在不只是原始 class 的薄封装。它保留 Rue
          的轻量视觉路线，同时补上尺寸、fit、tone、ring 与交互态这些更适合实际页面搭建的语义化能力。
        </p>

        <ExampleBlock
          title="Core shapes"
          summary="保留原有基础形状示例，并统一到更整洁的卡片布局里。"
          tab={tabShapes}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap gap-4" data-testid="mask-shapes-demo">
                {shapes.map(shape => (
                  <Mask
                    key={shape}
                    shape={shape}
                    src={photoUrl}
                    alt={shape}
                    size="md"
                    bordered={true}
                  />
                ))}
              </div>
            </div>
          )}
          code={`<Mask shape="squircle" src="${photoUrl}" alt="squircle" size="md" bordered />
<Mask shape="heart" src="${photoUrl}" alt="heart" size="md" bordered />
<Mask shape="hexagon" src="${photoUrl}" alt="hexagon" size="md" bordered />
<Mask shape="hexagon-2" src="${photoUrl}" alt="hexagon-2" size="md" bordered />
<Mask shape="decagon" src="${photoUrl}" alt="decagon" size="md" bordered />
<Mask shape="pentagon" src="${photoUrl}" alt="pentagon" size="md" bordered />
<Mask shape="diamond" src="${photoUrl}" alt="diamond" size="md" bordered />
<Mask shape="square" src="${photoUrl}" alt="square" size="md" bordered />
<Mask shape="circle" src="${photoUrl}" alt="circle" size="md" bordered />`}
        />

        <ExampleBlock
          title="Star variants"
          summary="保留星形与粗星形示例，增加 ring 和 hover，适合头像墙或精选内容。"
          tab={tabStars}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap gap-5">
                {stars.map(shape => (
                  <Mask
                    key={shape}
                    shape={shape}
                    src={photoUrl}
                    alt={shape}
                    size="lg"
                    ring={true}
                    shadow={true}
                    interactive={true}
                  />
                ))}
              </div>
            </div>
          )}
          code={`<Mask shape="star" src="${photoUrl}" alt="star" size="lg" ring shadow interactive />
<Mask shape="star-2" src="${photoUrl}" alt="star-2" size="lg" ring shadow interactive />`}
        />

        <ExampleBlock
          title="Triangle variants"
          summary="保留四向三角形示例，并通过统一尺寸让方向差异更好观察。"
          tab={tabTriangles}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap gap-5">
                {triangles.map(shape => (
                  <Mask
                    key={shape}
                    shape={shape}
                    src={photoUrl}
                    alt={shape}
                    size="lg"
                    bordered={true}
                    shadow={true}
                  />
                ))}
              </div>
            </div>
          )}
          code={`<Mask shape="triangle" src="${photoUrl}" alt="triangle" size="lg" bordered shadow />
<Mask shape="triangle-2" src="${photoUrl}" alt="triangle-2" size="lg" bordered shadow />
<Mask shape="triangle-3" src="${photoUrl}" alt="triangle-3" size="lg" bordered shadow />
<Mask shape="triangle-4" src="${photoUrl}" alt="triangle-4" size="lg" bordered shadow />`}
        />

        <ExampleBlock
          title="Half modifiers and arbitrary host"
          summary="保留 half modifier 与任意宿主演示，并补上 start / end 语义别名。"
          tab={tabHalf}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap items-center gap-6">
                <Mask
                  shape="star"
                  half="1"
                  src={photoUrl}
                  alt="star half 1"
                  size="lg"
                  ring={true}
                />
                <Mask
                  shape="star"
                  half="2"
                  src={photoUrl}
                  alt="star half 2"
                  size="lg"
                  ring={true}
                />
                <Mask
                  shape="diamond"
                  half="start"
                  src={photoUrl}
                  alt="diamond start"
                  size="lg"
                  bordered={true}
                />
                <Mask
                  as="div"
                  shape="diamond"
                  tone="primary"
                  size="lg"
                  ring={true}
                  shadow={true}
                  className="grid place-content-center text-sm font-semibold uppercase tracking-[0.2em]"
                  data-testid="mask-host-demo"
                >
                  Host
                </Mask>
              </div>
            </div>
          )}
          code={`<Mask shape="star" half="1" src="${photoUrl}" alt="star half 1" size="lg" ring />
<Mask shape="star" half="2" src="${photoUrl}" alt="star half 2" size="lg" ring />
<Mask shape="diamond" half="start" src="${photoUrl}" alt="diamond start" size="lg" bordered />
<Mask
  as="div"
  shape="diamond"
  tone="primary"
  size="lg"
  ring
  shadow
  className="grid place-content-center text-sm font-semibold uppercase tracking-[0.2em]"
>
  Host
</Mask>`}
        />

        <ExampleBlock
          title="Semantic sizes"
          summary="新增尺寸别名，常见头像和封面尺寸不再需要每次都手写宽高 class。"
          tab={tabSize}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap items-end gap-5">
                {sizes.map(size => (
                  <div
                    key={size}
                    className="flex flex-col items-center gap-3 text-xs uppercase tracking-[0.18em] opacity-80"
                  >
                    <Mask shape="circle" src={photoUrl} alt={size} size={size} ring={true} />
                    <span>{size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          code={`<Mask shape="circle" src="${photoUrl}" alt="xs" size="xs" ring />
<Mask shape="circle" src="${photoUrl}" alt="sm" size="sm" ring />
<Mask shape="circle" src="${photoUrl}" alt="md" size="md" ring />
<Mask shape="circle" src="${photoUrl}" alt="lg" size="lg" ring />
<Mask shape="circle" src="${photoUrl}" alt="xl" size="xl" ring />
<Mask shape="circle" src="${photoUrl}" alt="2xl" size="2xl" ring />`}
        />

        <ExampleBlock
          title="Fit modes"
          summary="新增 fit 语义，宽图、竖图和封面图都能直接得到明确的裁切策略。"
          tab={tabFit}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-6 md:grid-cols-3">
                {fitExamples.map(item => (
                  <div key={item.label} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                      {item.label}
                    </div>
                    <div className="rounded-box bg-base-200 p-4">
                      <Mask
                        shape="hexagon-2"
                        src={item.src}
                        alt={item.label}
                        size="xl"
                        fit={item.fit}
                        bordered={true}
                        className="mx-auto"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          code={`<Mask shape="hexagon-2" src="${photoWideUrl}" alt="cover" size="xl" fit="cover" bordered className="mx-auto" />
<Mask shape="hexagon-2" src="${photoTallUrl}" alt="contain" size="xl" fit="contain" bordered className="mx-auto" />
<Mask shape="hexagon-2" src="${photoWideUrl}" alt="fill" size="xl" fit="fill" bordered className="mx-auto" />`}
        />

        <ExampleBlock
          title="Tone surfaces"
          summary="新增 tone、ring、shadow 组合后，Mask 也能承担数字徽记、内容牌和亮点卡片的职责。"
          tab={tabTone}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-6">
                <div className="flex flex-wrap gap-4">
                  {toneExamples.map(item => (
                    <Mask
                      key={item.label}
                      as="div"
                      shape="squircle"
                      tone={item.tone}
                      size="md"
                      ring={true}
                      className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
                    >
                      {item.label}
                    </Mask>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Mask
                    as="div"
                    shape="hexagon"
                    tone="secondary"
                    size="xl"
                    ring={true}
                    shadow={true}
                    interactive={true}
                    className="mx-auto grid place-content-center p-6 text-center"
                  >
                    <div className="space-y-1">
                      <div className="text-3xl font-black">24</div>
                      <div className="text-xs uppercase tracking-[0.22em] opacity-80">Launches</div>
                    </div>
                  </Mask>

                  <Mask
                    as="div"
                    shape="diamond"
                    tone="accent"
                    size="xl"
                    ring={true}
                    shadow={true}
                    className="mx-auto grid place-content-center p-6 text-center"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em]">
                        Featured
                      </div>
                      <div className="text-xs opacity-80">Rue Studio</div>
                    </div>
                  </Mask>

                  <Mask
                    as="div"
                    shape="circle"
                    tone="success"
                    size="xl"
                    ring={true}
                    shadow={true}
                    className="mx-auto grid place-content-center p-6 text-center"
                  >
                    <div className="space-y-1">
                      <div className="text-2xl font-black">98%</div>
                      <div className="text-xs uppercase tracking-[0.18em] opacity-80">Approval</div>
                    </div>
                  </Mask>
                </div>
              </div>
            </div>
          )}
          code={`<div className="flex flex-wrap gap-4">
  <Mask
    as="div"
    shape="squircle"
    tone="base"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Base
  </Mask>
  <Mask
    as="div"
    shape="squircle"
    tone="primary"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Primary
  </Mask>
  <Mask
    as="div"
    shape="squircle"
    tone="secondary"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Secondary
  </Mask>
  <Mask
    as="div"
    shape="squircle"
    tone="accent"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Accent
  </Mask>
  <Mask
    as="div"
    shape="squircle"
    tone="success"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Success
  </Mask>
  <Mask
    as="div"
    shape="squircle"
    tone="warning"
    size="md"
    ring
    className="grid place-content-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
  >
    Warning
  </Mask>
</div>

<div className="grid gap-4 md:grid-cols-3">
  <Mask
    as="div"
    shape="hexagon"
    tone="secondary"
    size="xl"
    ring
    shadow
    interactive
    className="mx-auto grid place-content-center p-6 text-center"
  >
    <div className="space-y-1">
      <div className="text-3xl font-black">24</div>
      <div className="text-xs uppercase tracking-[0.22em] opacity-80">Launches</div>
    </div>
  </Mask>

  <Mask
    as="div"
    shape="diamond"
    tone="accent"
    size="xl"
    ring
    shadow
    className="mx-auto grid place-content-center p-6 text-center"
  >
    <div className="space-y-1">
      <div className="text-sm font-semibold uppercase tracking-[0.18em]">
        Featured
      </div>
      <div className="text-xs opacity-80">Rue Studio</div>
    </div>
  </Mask>

  <Mask
    as="div"
    shape="circle"
    tone="success"
    size="xl"
    ring
    shadow
    className="mx-auto grid place-content-center p-6 text-center"
  >
    <div className="space-y-1">
      <div className="text-2xl font-black">98%</div>
      <div className="text-xs uppercase tracking-[0.18em] opacity-80">Approval</div>
    </div>
  </Mask>
</div>`}
        />

        <div className="my-8">
          <h2 className="mt-0">API</h2>
          <ApiTable rows={apiRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default MaskPage
