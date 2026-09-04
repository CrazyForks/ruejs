import type { FC } from '@rue-js/rue'
import { batch, onScopeDispose, ref } from '@rue-js/rue'
import { Badge, Button, Card, Range, Watermark } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const rueWatermarkImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="196" height="72" viewBox="0 0 196 72"><rect width="196" height="72" rx="18" fill="#0f172a"/><path d="M30 19h22c12 0 19 6 19 17 0 11-7 17-19 17H45v14H30V19Zm22 22c4 0 6-2 6-5s-2-5-6-5H45v10h7Zm35-22h15l10 31 10-31h15l-17 48H104L87 19Zm60 0h18l15 48h-15l-2.2-7.5h-13.7L147 67h-15l15-48Zm13 29-4-14-4 14h8Z" fill="#f8fafc"/></svg>',
)}`

const stats = [
  { label: '共享链接', value: '1.8k', detail: '过去 24 小时' },
  { label: '导出快照', value: '312', detail: '包含 38 个外部成员' },
  { label: '访问终端', value: '57', detail: '待二次确认设备 5 台' },
]

const apiRows: ApiRow[] = [
  {
    prop: 'content',
    description: '文字水印内容，支持字符串或多行数组。',
    type: 'string | string[]',
    defaultValue: '-',
  },
  {
    prop: 'image',
    description: '图片水印地址，适合 logo、签章、业务标记。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'font',
    description: '文字水印的颜色、字号、字重、字体和对齐方式。',
    type: '{ color?: string; fontSize?: number | string; fontWeight?: number | string; fontStyle?: string; fontFamily?: string; textAlign?: string }',
    defaultValue: '{ color: 自动按宿主背景明暗推导, fontSize: 16 }',
  },
  {
    prop: 'rotate',
    description: '单个水印块的旋转角度。',
    type: 'number',
    defaultValue: '-22',
  },
  {
    prop: 'width / height',
    description: '单个水印内容块的尺寸；不传时文本会按内容估算。',
    type: 'number',
    defaultValue: '文本自动测量 / 图片 120 x 64',
  },
  {
    prop: 'gap',
    description: '水印块之间的水平与垂直间距。',
    type: '[number, number]',
    defaultValue: '[100, 100]',
  },
  {
    prop: 'offset',
    description: '起始铺设偏移量，便于与卡片头部或图像对齐。',
    type: '[number, number]',
    defaultValue: '[gapX / 2, gapY / 2]',
  },
  {
    prop: 'zIndex',
    description: '覆盖层层级，保持视觉上方但不阻断交互。',
    type: 'number',
    defaultValue: '9',
  },
  {
    prop: 'inherit',
    description: '是否让后代 Watermark 复用当前图案与铺设参数。',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'className / rootClassName',
    description: '根容器类名，便于直接叠加 Rue 的布局与视觉类。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'overlayClassName / overlayStyle',
    description: '覆盖层类名和样式，适合与圆角、混合模式、局部调优配合。',
    type: 'string / any',
    defaultValue: '-',
  },
  {
    prop: 'style',
    description: '根容器行内样式；默认会自动补 position、overflow、isolation。',
    type: 'any',
    defaultValue: '-',
  },
]

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

type WatermarkNumericControlKey =
  | 'rotate'
  | 'gapX'
  | 'gapY'
  | 'offsetX'
  | 'offsetY'
  | 'fontSize'
  | 'zIndex'

type WatermarkNumericControls = Record<WatermarkNumericControlKey, number>

type ScheduledWatermarkControlFlush =
  | { type: 'frame'; id: number }
  | { type: 'timeout'; id: ReturnType<typeof setTimeout> }

const defaultWatermarkNumericControls: WatermarkNumericControls = {
  rotate: -22,
  gapX: 120,
  gapY: 96,
  offsetX: 48,
  offsetY: 48,
  fontSize: 18,
  zIndex: 12,
}

const sparseWatermarkNumericControls: WatermarkNumericControls = {
  rotate: -8,
  gapX: 156,
  gapY: 124,
  offsetX: 64,
  offsetY: 32,
  fontSize: 14,
  zIndex: 10,
}

const scheduleWatermarkControlFlush = (callback: () => void): ScheduledWatermarkControlFlush => {
  if (typeof requestAnimationFrame === 'function') {
    return { type: 'frame', id: requestAnimationFrame(callback) }
  }

  return { type: 'timeout', id: setTimeout(callback, 0) }
}

const cancelWatermarkControlFlush = (flush: ScheduledWatermarkControlFlush) => {
  if (flush.type === 'frame') {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(flush.id)
    }
    return
  }

  clearTimeout(flush.id)
}

interface WatermarkControlRangeProps {
  label: string
  value: { value: number }
  min: number
  max: number
  onValueChange: (value: number) => void
  onValueCommit: (value: number) => void
}

const WatermarkControlRange: FC<WatermarkControlRangeProps> = ({
  label,
  value,
  min,
  max,
  onValueChange,
  onValueCommit,
}) => {
  return (
    <Range
      className="range-sm"
      rootClassName="space-y-2"
      valueClassName="min-w-12 text-center tabular-nums"
      label={label}
      min={min}
      max={max}
      value={value}
      showValue={{ formatter: nextValue => String(nextValue) }}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
    />
  )
}

const WatermarkCustomControlsDemo: FC = () => {
  const content = ref('Rue Design')
  const rotate = ref(defaultWatermarkNumericControls.rotate)
  const gapX = ref(defaultWatermarkNumericControls.gapX)
  const gapY = ref(defaultWatermarkNumericControls.gapY)
  const offsetX = ref(defaultWatermarkNumericControls.offsetX)
  const offsetY = ref(defaultWatermarkNumericControls.offsetY)
  const fontSize = ref(defaultWatermarkNumericControls.fontSize)
  const zIndex = ref(defaultWatermarkNumericControls.zIndex)
  const rotateControl = ref(defaultWatermarkNumericControls.rotate)
  const gapXControl = ref(defaultWatermarkNumericControls.gapX)
  const gapYControl = ref(defaultWatermarkNumericControls.gapY)
  const offsetXControl = ref(defaultWatermarkNumericControls.offsetX)
  const offsetYControl = ref(defaultWatermarkNumericControls.offsetY)
  const fontSizeControl = ref(defaultWatermarkNumericControls.fontSize)
  const zIndexControl = ref(defaultWatermarkNumericControls.zIndex)
  const color = ref('')

  const controlRefs: Record<WatermarkNumericControlKey, { value: number }> = {
    rotate: rotateControl,
    gapX: gapXControl,
    gapY: gapYControl,
    offsetX: offsetXControl,
    offsetY: offsetYControl,
    fontSize: fontSizeControl,
    zIndex: zIndexControl,
  }

  let pendingControls: WatermarkNumericControls = { ...defaultWatermarkNumericControls }
  let controlFlush: ScheduledWatermarkControlFlush | null = null

  const writePreviewControls = (nextControls: WatermarkNumericControls) => {
    rotate.value = nextControls.rotate
    gapX.value = nextControls.gapX
    gapY.value = nextControls.gapY
    offsetX.value = nextControls.offsetX
    offsetY.value = nextControls.offsetY
    fontSize.value = nextControls.fontSize
    zIndex.value = nextControls.zIndex
  }

  const writeRangeControls = (nextControls: WatermarkNumericControls) => {
    rotateControl.value = nextControls.rotate
    gapXControl.value = nextControls.gapX
    gapYControl.value = nextControls.gapY
    offsetXControl.value = nextControls.offsetX
    offsetYControl.value = nextControls.offsetY
    fontSizeControl.value = nextControls.fontSize
    zIndexControl.value = nextControls.zIndex
  }

  const clearControlFlush = () => {
    if (!controlFlush) return
    cancelWatermarkControlFlush(controlFlush)
    controlFlush = null
  }

  const flushPreviewControls = () => {
    controlFlush = null
    batch(() => {
      writePreviewControls(pendingControls)
    })
  }

  const queuePreviewControl = (key: WatermarkNumericControlKey, nextValue: number) => {
    pendingControls[key] = nextValue
    if (controlFlush) return
    controlFlush = scheduleWatermarkControlFlush(flushPreviewControls)
  }

  const commitPreviewControl = (key: WatermarkNumericControlKey, nextValue: number) => {
    pendingControls[key] = nextValue
    clearControlFlush()
    batch(() => {
      writePreviewControls(pendingControls)
      controlRefs[key].value = nextValue
    })
  }

  const applyWatermarkState = ({
    nextContent,
    nextColor,
    nextControls,
  }: {
    nextContent: string
    nextColor: string
    nextControls: WatermarkNumericControls
  }) => {
    clearControlFlush()
    pendingControls = { ...nextControls }
    batch(() => {
      content.value = nextContent
      color.value = nextColor
      writePreviewControls(nextControls)
      writeRangeControls(nextControls)
    })
  }

  const reset = () =>
    applyWatermarkState({
      nextContent: 'Rue Design',
      nextColor: '',
      nextControls: defaultWatermarkNumericControls,
    })

  const applySparse = () =>
    applyWatermarkState({
      nextContent: 'Shared with Partner',
      nextColor: 'rgba(34, 197, 94, 0.22)',
      nextControls: sparseWatermarkNumericControls,
    })

  onScopeDispose(clearControlFlush)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Watermark
        content={[content.value, 'Scenario Sandbox']}
        rotate={rotate.value}
        gap={[gapX.value, gapY.value]}
        offset={[offsetX.value, offsetY.value]}
        zIndex={zIndex.value}
        width={180}
        height={72}
        font={{
          color: color.value || undefined,
          fontSize: fontSize.value,
          fontWeight: 700,
          textAlign: 'center',
        }}
        className="rounded-[1.75rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200 shadow-sm"
      >
        <div className="space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">
                Scenario Sandbox
              </div>
              <div className="mt-2 text-2xl font-semibold text-base-content">
                参数调整后的实时预览
              </div>
            </div>
            <Badge outline>{`z-index ${zIndex.value}`}</Badge>
          </div>
          <p className="m-0 max-w-2xl text-sm leading-7 text-base-content/65">
            这里故意放了文字、徽标和按钮，方便观察水印对不同内容密度与层次关系的影响。
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-base-100/90 shadow-sm md:col-span-2">
              <Card.Body>
                <div className="text-sm font-semibold text-base-content">内容流</div>
                <p className="m-0 text-sm leading-7 text-base-content/65">
                  Rue Watermark
                  会把铺设逻辑限制在当前容器内部，圆角、阴影和内容布局都可以继续由宿主容器控制。
                </p>
              </Card.Body>
            </Card>
            <div className="rounded-[1.25rem] bg-accent px-4 py-5 text-accent-content shadow-sm">
              <div className="text-xs uppercase tracking-[0.2em] opacity-70">Preset</div>
              <div className="mt-2 text-2xl font-black">{content.value}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" color="primary" onClick={reset}>
              重置参数
            </Button>
            <Button size="sm" type="outlined" onClick={applySparse}>
              切换到稀疏模式
            </Button>
          </div>
        </div>
      </Watermark>

      <Card className="bg-base-100 shadow-sm">
        <Card.Body className="gap-4">
          <div>
            <div className="text-sm font-semibold text-base-content">文本</div>
            <input
              className="input input-bordered mt-2 w-full"
              value={content.value}
              onInput={(event: Event) => {
                content.value = (event.currentTarget as HTMLInputElement).value
              }}
            />
          </div>

          <WatermarkControlRange
            label="Rotate"
            min={-90}
            max={90}
            value={rotateControl}
            onValueChange={value => queuePreviewControl('rotate', value)}
            onValueCommit={value => commitPreviewControl('rotate', value)}
          />
          <WatermarkControlRange
            label="Font size"
            min={12}
            max={28}
            value={fontSizeControl}
            onValueChange={value => queuePreviewControl('fontSize', value)}
            onValueCommit={value => commitPreviewControl('fontSize', value)}
          />
          <WatermarkControlRange
            label="Gap X"
            min={72}
            max={180}
            value={gapXControl}
            onValueChange={value => queuePreviewControl('gapX', value)}
            onValueCommit={value => commitPreviewControl('gapX', value)}
          />
          <WatermarkControlRange
            label="Gap Y"
            min={72}
            max={180}
            value={gapYControl}
            onValueChange={value => queuePreviewControl('gapY', value)}
            onValueCommit={value => commitPreviewControl('gapY', value)}
          />
          <WatermarkControlRange
            label="Offset X"
            min={0}
            max={120}
            value={offsetXControl}
            onValueChange={value => queuePreviewControl('offsetX', value)}
            onValueCommit={value => commitPreviewControl('offsetX', value)}
          />
          <WatermarkControlRange
            label="Offset Y"
            min={0}
            max={120}
            value={offsetYControl}
            onValueChange={value => queuePreviewControl('offsetY', value)}
            onValueCommit={value => commitPreviewControl('offsetY', value)}
          />
          <WatermarkControlRange
            label="z-index"
            min={1}
            max={24}
            value={zIndexControl}
            onValueChange={value => queuePreviewControl('zIndex', value)}
            onValueCommit={value => commitPreviewControl('zIndex', value)}
          />

          <div>
            <div className="text-sm font-medium text-base-content">Color override</div>
            <input
              className="input input-bordered mt-2 w-full"
              placeholder="auto"
              value={color.value}
              onInput={(event: Event) => {
                color.value = (event.currentTarget as HTMLInputElement).value
              }}
            />
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}

const customControlsCode = `const WatermarkCustomControlsDemo = () => {
  const content = ref('Rue Design')
  const rotate = ref(-22)
  const rotateControl = ref(-22)
  const gapX = ref(120)
  const gapXControl = ref(120)
  const gapY = ref(96)
  const offsetX = ref(48)
  const offsetY = ref(48)
  const fontSize = ref(18)
  const zIndex = ref(12)
  const color = ref('')
  let pendingFrame = 0
  let pendingRotate = rotate.value
  let pendingGapX = gapX.value

  const flushPreview = () => {
    pendingFrame = 0
    batch(() => {
      rotate.value = pendingRotate
      gapX.value = pendingGapX
    })
  }

  const queuePreview = () => {
    if (pendingFrame) return
    pendingFrame = requestAnimationFrame(flushPreview)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Watermark
        content={[content.value, 'Scenario Sandbox']}
        rotate={rotate.value}
        gap={[gapX.value, gapY.value]}
        offset={[offsetX.value, offsetY.value]}
        zIndex={zIndex.value}
        width={180}
        height={72}
        font={{
          color: color.value || undefined,
          fontSize: fontSize.value,
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {/* preview content */}
      </Watermark>

      <Card>
        <Card.Body>
          <Range
            className="range-sm"
            min={-90}
            max={90}
            label="Rotate"
            value={rotateControl}
            showValue
            onValueChange={value => {
              pendingRotate = value
              queuePreview()
            }}
            onValueCommit={value => {
              pendingRotate = value
              rotate.value = value
              rotateControl.value = value
            }}
          />
          <Range
            className="range-sm"
            min={72}
            max={180}
            label="Gap X"
            value={gapXControl}
            showValue
            onValueChange={value => {
              pendingGapX = value
              queuePreview()
            }}
            onValueCommit={value => {
              pendingGapX = value
              gapX.value = value
              gapXControl.value = value
            }}
          />
          <input
            className="input input-bordered"
            placeholder="auto"
            value={color.value}
            onInput={(event: Event) => {
              color.value = (event.currentTarget as HTMLInputElement).value
            }}
          />
        </Card.Body>
      </Card>
    </div>
  )
}`

const WatermarkPage: FC = () => {
  const tabs = {
    basic: ref<PreviewTabMode>('preview'),
    multiline: ref<PreviewTabMode>('preview'),
    image: ref<PreviewTabMode>('preview'),
    inherit: ref<PreviewTabMode>('preview'),
    custom: ref<PreviewTabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Watermark 水印</h1>
        <p className="mt-3 mb-3 text-sm">
          Rue 的 Watermark 不照搬其他组件库的视觉，而是把能力落成更适合当前设计站点的轻量覆盖层。
          你可以直接给任意容器加文字或图片水印，同时保持按钮、卡片、统计区这些内容本身的交互。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要给卡片、报表、详情页加上“内部预览”“草稿”“仅限共享”等视觉标记。</li>
          <li>需要图片或文字水印覆盖在任意内容上，但又不希望阻断按钮、链接和表单的交互。</li>
          <li>需要局部容器继承上层水印图案，而不是为每一块内容重复写一遍配置。</li>
        </ul>

        <PreviewBlock
          title="Basic text watermark"
          summary="最直接的用法：给一个内容容器加上文本水印，按钮仍然可以正常点击。"
          tab={tabs.basic}
          preview={
            <Watermark
              content="Rue Design"
              className="rounded-[2rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200 shadow-sm"
            >
              <div className="grid gap-6 px-6 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:px-8">
                <div className="space-y-4">
                  <Badge variant="secondary">Internal Preview</Badge>
                  <h3 className="m-0 text-3xl font-black tracking-tight text-base-content md:text-4xl">
                    协作面板正在生成新一轮可共享快照
                  </h3>
                  <p className="m-0 max-w-2xl text-sm leading-7 text-base-content/70">
                    水印覆盖层默认在视觉上方，但采用 pointer-events
                    none，不会挡住卡片、按钮和其它交互控件。
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button color="primary">导出摘要</Button>
                    <Button type="outlined">查看访问日志</Button>
                  </div>
                </div>
                <Card className="bg-base-100/85 shadow-sm backdrop-blur-sm">
                  <Card.Body className="gap-4">
                    {stats.map(item => (
                      <div
                        key={item.label}
                        className="rounded-box border border-base-300/70 bg-base-100/70 px-4 py-3"
                      >
                        <div className="text-xs uppercase tracking-[0.2em] text-base-content/50">
                          {item.label}
                        </div>
                        <div className="mt-2 text-2xl font-bold text-base-content">
                          {item.value}
                        </div>
                        <div className="mt-1 text-sm text-base-content/60">{item.detail}</div>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </div>
            </Watermark>
          }
          code={`const stats = [
  { label: '共享链接', value: '1.8k', detail: '过去 24 小时' },
  { label: '导出快照', value: '312', detail: '包含 38 个外部成员' },
  { label: '访问终端', value: '57', detail: '待二次确认设备 5 台' },
]

<Watermark
  content="Rue Design"
  className="rounded-[2rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200 shadow-sm"
>
  <div className="grid gap-6 px-6 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:px-8">
    <div className="space-y-4">
      <Badge variant="secondary">Internal Preview</Badge>
      <h3 className="m-0 text-3xl font-black tracking-tight text-base-content md:text-4xl">
        协作面板正在生成新一轮可共享快照
      </h3>
      <p className="m-0 max-w-2xl text-sm leading-7 text-base-content/70">
        水印覆盖层默认在视觉上方，但采用 pointer-events none，不会挡住卡片、按钮和其它交互控件。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button color="primary">导出摘要</Button>
        <Button type="outlined">查看访问日志</Button>
      </div>
    </div>

    <Card className="bg-base-100/85 shadow-sm backdrop-blur-sm">
      <Card.Body className="gap-4">
        {stats.map(item => (
          <div
            key={item.label}
            className="rounded-box border border-base-300/70 bg-base-100/70 px-4 py-3"
          >
            <div className="text-xs uppercase tracking-[0.2em] text-base-content/50">
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-bold text-base-content">{item.value}</div>
            <div className="mt-1 text-sm text-base-content/60">{item.detail}</div>
          </div>
        ))}
      </Card.Body>
    </Card>
  </div>
</Watermark>`}
        />

        <PreviewBlock
          title="Multiline typography and tuned spacing"
          summary="支持多行内容、字族和铺设参数调优，更适合仪表盘、稿件和审批流页面。"
          tab={tabs.multiline}
          preview={
            <Watermark
              content={['Confidential Build', 'Rue Design System']}
              rotate={-16}
              gap={[132, 116]}
              width={168}
              height={72}
              font={{
                color: 'rgba(13, 22, 39, 0.15)',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'Georgia, Times New Roman, serif',
                textAlign: 'center',
              }}
              className="rounded-[1.75rem] border border-base-300 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,250,0.88))] shadow-sm"
            >
              <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
                <Card className="bg-base-100/90 shadow-sm">
                  <Card.Body>
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">
                      Draft
                    </div>
                    <div className="text-lg font-semibold text-base-content">产品评审结论</div>
                    <p className="m-0 text-sm leading-6 text-base-content/65">
                      用多行水印把容器语义说清楚，而不是只放一个模糊 logo。
                    </p>
                  </Card.Body>
                </Card>
                <Card className="bg-base-100/90 shadow-sm md:col-span-2">
                  <Card.Body className="gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">
                          Access Scope
                        </div>
                        <div className="text-xl font-semibold text-base-content">
                          仅限设计与法务同步窗口
                        </div>
                      </div>
                      <Badge outline>Version 15</Badge>
                    </div>
                    <p className="m-0 text-sm leading-7 text-base-content/65">
                      通过 width、height、gap 和 font 组合，可以让文字块更像“签章”而不是背景噪音。
                    </p>
                  </Card.Body>
                </Card>
              </div>
            </Watermark>
          }
          code={`<Watermark
  content={['Confidential Build', 'Rue Design System']}
  rotate={-16}
  gap={[132, 116]}
  width={168}
  height={72}
  font={{
    color: 'rgba(13, 22, 39, 0.15)',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'Georgia, Times New Roman, serif',
    textAlign: 'center',
  }}
  className="rounded-[1.75rem] border border-base-300 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,250,0.88))] shadow-sm"
>
  <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
    <Card className="bg-base-100/90 shadow-sm">
      <Card.Body>
        <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Draft</div>
        <div className="text-lg font-semibold text-base-content">产品评审结论</div>
        <p className="m-0 text-sm leading-6 text-base-content/65">
          用多行水印把容器语义说清楚，而不是只放一个模糊 logo。
        </p>
      </Card.Body>
    </Card>

    <Card className="bg-base-100/90 shadow-sm md:col-span-2">
      <Card.Body className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">
              Access Scope
            </div>
            <div className="text-xl font-semibold text-base-content">仅限设计与法务同步窗口</div>
          </div>
          <Badge outline>Version 15</Badge>
        </div>
        <p className="m-0 text-sm leading-7 text-base-content/65">
          通过 width、height、gap 和 font 组合，可以让文字块更像“签章”而不是背景噪音。
        </p>
      </Card.Body>
    </Card>
  </div>
</Watermark>`}
        />

        <PreviewBlock
          title="Image watermark"
          summary="图片模式适合品牌 logo、部门印记或业务章；Rue 这边建议把它用在局部容器，而不是整页满屏。"
          tab={tabs.image}
          preview={
            <Watermark
              image={rueWatermarkImage}
              width={156}
              height={58}
              rotate={-18}
              gap={[140, 112]}
              className="rounded-[1.5rem] border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:p-6">
                <Card className="overflow-hidden bg-base-200/70 shadow-none">
                  <Card.Body className="gap-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">
                      Media Kit
                    </div>
                    <div className="text-2xl font-semibold text-base-content">品牌资产导出包</div>
                    <p className="m-0 text-sm leading-7 text-base-content/65">
                      图片水印不会吞掉原内容的层级信息，更适合 logo、组织印章和明确的来源标识。
                    </p>
                  </Card.Body>
                </Card>
                <div className="rounded-[1.25rem] bg-gradient-to-br from-neutral to-slate-900 p-5 text-neutral-content shadow-sm">
                  <div className="text-xs uppercase tracking-[0.22em] opacity-70">Delivery</div>
                  <div className="mt-4 text-3xl font-black">5 Files</div>
                  <div className="mt-2 text-sm leading-6 opacity-75">
                    SVG / PDF / PNG / dark / light
                  </div>
                </div>
              </div>
            </Watermark>
          }
          code={`const logo = 'https://dummyimage.com/312x116/0f172a/f8fafc.png&text=RUE'

<Watermark
  image={logo}
  width={156}
  height={58}
  rotate={-18}
  gap={[140, 112]}
  className="rounded-[1.5rem] border border-base-300 bg-base-100 shadow-sm"
>
  <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:p-6">
    <Card className="overflow-hidden bg-base-200/70 shadow-none">
      <Card.Body className="gap-4">
        <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Media Kit</div>
        <div className="text-2xl font-semibold text-base-content">品牌资产导出包</div>
        <p className="m-0 text-sm leading-7 text-base-content/65">
          图片水印不会吞掉原内容的层级信息，更适合 logo、组织印章和明确的来源标识。
        </p>
      </Card.Body>
    </Card>

    <div className="rounded-[1.25rem] bg-gradient-to-br from-neutral to-slate-900 p-5 text-neutral-content shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] opacity-70">Delivery</div>
      <div className="mt-4 text-3xl font-black">5 Files</div>
      <div className="mt-2 text-sm leading-6 opacity-75">SVG / PDF / PNG / dark / light</div>
    </div>
  </div>
</Watermark>`}
        />

        <PreviewBlock
          title="Inherited local scope"
          summary="父级配置一次，子级局部容器可以继续复用；不想继承时再显式关掉。"
          tab={tabs.inherit}
          preview={
            <Watermark
              content={['Team Only', 'Rue Preview']}
              rotate={-14}
              width={148}
              height={64}
              gap={[128, 108]}
              className="rounded-[1.75rem] border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
                <Watermark className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-100/80">
                  <div className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-base-content">继承父级水印</div>
                    <p className="m-0 text-sm leading-6 text-base-content/65">
                      这个局部容器没有重新写 content 和 image，会直接复用外层图案与铺设参数。
                    </p>
                  </div>
                </Watermark>

                <Watermark
                  inherit={false}
                  className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-200/60"
                >
                  <div className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-base-content">关闭继承</div>
                    <p className="m-0 text-sm leading-6 text-base-content/65">
                      当局部容器不需要上层水印时，直接把 inherit 设为 false 即可回到纯净内容区。
                    </p>
                  </div>
                </Watermark>
              </div>
            </Watermark>
          }
          code={`<Watermark
  content={['Team Only', 'Rue Preview']}
  rotate={-14}
  width={148}
  height={64}
  gap={[128, 108]}
  className="rounded-[1.75rem] border border-base-300 bg-base-100 shadow-sm"
>
  <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
    <Watermark className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-100/80">
      <div className="space-y-3 p-4">
        <div className="text-sm font-semibold text-base-content">继承父级水印</div>
        <p className="m-0 text-sm leading-6 text-base-content/65">
          这个局部容器没有重新写 content 和 image，会直接复用外层图案与铺设参数。
        </p>
      </div>
    </Watermark>

    <Watermark
      inherit={false}
      className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-200/60"
    >
      <div className="space-y-3 p-4">
        <div className="text-sm font-semibold text-base-content">关闭继承</div>
        <p className="m-0 text-sm leading-6 text-base-content/65">
          当局部容器不需要上层水印时，直接把 inherit 设为 false 即可回到纯净内容区。
        </p>
      </div>
    </Watermark>
  </div>
</Watermark>`}
        />

        <PreviewBlock
          title="Custom controls"
          summary="把可调示例 落到 Rue 风格里，用 Range 的按帧更新快速调整排版参数。"
          tab={tabs.custom}
          preview={<WatermarkCustomControlsDemo />}
          code={customControlsCode}
        />

        <h2>API</h2>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default WatermarkPage
