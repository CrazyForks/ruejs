import type { FC } from '@rue-js/rue'
import { onUnmounted, ref } from '@rue-js/rue'
import { Badge, QRCode } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

type RenderType = 'canvas' | 'svg'

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

const createIconDataUri = (label: string, foreground: string, background: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" fill="none">
      <rect x="4" y="4" width="64" height="64" rx="20" fill="${background}"/>
      <text x="36" y="43" text-anchor="middle" font-size="24" font-family="ui-sans-serif, system-ui" font-weight="700" fill="${foreground}">${label}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const doDownload = (url: string, fileName: string) => {
  const link = document.createElement('a')
  link.download = fileName
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const downloadCurrentQRCode = (hostId: string, type: RenderType) => {
  const host = document.getElementById(hostId)

  if (!host) {
    return
  }

  if (type === 'canvas') {
    const canvas = host.querySelector('canvas')
    if (canvas) {
      doDownload(canvas.toDataURL('image/png'), 'rue-qrcode.png')
    }
    return
  }

  const svg = host.querySelector('svg')
  if (!svg) {
    return
  }

  const svgData = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  doDownload(url, 'rue-qrcode.svg')
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const statusBadgeClassName: Record<RenderType, string> = {
  canvas: 'badge-primary',
  svg: 'badge-secondary',
}

const brandIcon = createIconDataUri('R', '#f8fafc', '#0f172a')
const labIcon = createIconDataUri('L', '#ecfeff', '#115e59')
const pulseIcon = createIconDataUri('P', '#eff6ff', '#1d4ed8')

const basicTab = ref<PreviewTabMode>('preview')
const typeTab = ref<PreviewTabMode>('preview')
const appearanceTab = ref<PreviewTabMode>('preview')
const statusTab = ref<PreviewTabMode>('preview')
const downloadTab = ref<PreviewTabMode>('preview')

const basicCode = `const liveValue = ref('https://rue.dev/design/qr-code')

<div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
  <QRCode value={liveValue.value || '-'} size={176} />
  <div className="space-y-3">
    <input
      className="input input-bordered w-full"
      value={liveValue.value}
      onChange={event => {
        liveValue.value = (event.currentTarget as HTMLInputElement).value
      }}
    />
    <p className="text-sm opacity-70">value 变化后会自动重新编码。</p>
  </div>
</div>`

const typeCode = `const renderType = ref<'canvas' | 'svg'>('canvas')

<div className="join">
  <button className="btn btn-sm" onClick={() => (renderType.value = 'canvas')}>Canvas</button>
  <button className="btn btn-sm" onClick={() => (renderType.value = 'svg')}>SVG</button>
</div>

<QRCode type={renderType.value} size={96} value="https://rue.dev" />
<QRCode type={renderType.value} size={144} value="https://rue.dev" />
<QRCode type={renderType.value} size={208} errorLevel="H" icon={brandIcon} value="https://rue.dev" />`

const appearanceCode = `<div className="grid gap-4 sm:grid-cols-3">
  <QRCode value="https://rue.dev/brand" color="#0f766e" bgColor="#f0fdf4" />
  <QRCode value="https://rue.dev/night" bordered={false} color="#f8fafc" bgColor="#0f172a" />
  <QRCode
    value="https://rue.dev/lab"
    icon={labIcon}
    errorLevel="H"
    classNames={{ root: 'shadow-[0_28px_60px_-40px_rgba(15,23,42,0.55)]' }}
    styles={{ frame: { borderRadius: '32px' } }}
  />
</div>`

const statusCode = `const sessionValue = ref('https://rue.dev/session/qr-1')
const sessionStatus = ref<'active' | 'loading' | 'expired'>('expired')
const customSessionValue = ref('https://rue.dev/custom-status')
const customSessionStatus = ref<'active' | 'loading' | 'expired'>('expired')

<QRCode value="https://rue.dev/loading" status="loading" />
<QRCode
  value={sessionValue.value}
  status={sessionStatus.value}
  onRefresh={() => {
    sessionStatus.value = 'loading'
    sessionValue.value = nextSessionUrl()
    window.setTimeout(() => {
      sessionStatus.value = 'active'
    }, 700)
  }}
/>
<QRCode value="https://rue.dev/scan" status="scanned" />
<QRCode
  value={customSessionValue.value}
  status={customSessionStatus.value}
  onRefresh={() => {
    customSessionStatus.value = 'loading'
    customSessionValue.value = nextSessionUrl()
    window.setTimeout(() => {
      customSessionStatus.value = 'active'
    }, 700)
  }}
  statusRender={({ locale, onRefresh }) => (
    <div className="text-left">
      <div className="badge badge-warning badge-sm">Custom</div>
      <p className="mt-2 text-sm">{locale.expired}</p>
      <button className="btn btn-primary btn-xs mt-3" onClick={onRefresh}>{locale.refresh}</button>
    </div>
  )}
/>`

const downloadCode = `const downloadType = ref<'canvas' | 'svg'>('canvas')

<div id="rue-qrcode-download-host">
  <QRCode type={downloadType.value} value="https://rue.dev/invite?scene=design-lab" icon={brandIcon} />
</div>

<button onClick={() => downloadCurrentQRCode('rue-qrcode-download-host', downloadType.value)}>
  下载二维码
</button>`

const BasicValuePreview: FC = () => {
  const liveValue = ref('https://rue.dev/design/qr-code')

  return (
    <div className="not-prose grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="rounded-[1.75rem] border border-base-300 bg-base-100 p-4 shadow-sm">
        <QRCode value={liveValue.value || '-'} size={176} icon={brandIcon} errorLevel="H" />
      </div>
      <div className="rounded-[1.75rem] border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge outline>Live Value</Badge>
          <Badge className="badge-ghost">{(liveValue.value || '-').length} chars</Badge>
        </div>
        <div className="mt-4">
          <input
            className="input input-bordered w-full"
            value={liveValue.value}
            onChange={(event: Event) => {
              liveValue.value = (event.currentTarget as HTMLInputElement).value
            }}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-base-200/60 p-4">
            <div className="text-xs uppercase tracking-[0.16em] opacity-55">Payload</div>
            <div className="mt-2 break-all text-sm leading-6">{liveValue.value || '-'}</div>
          </div>
          <div className="rounded-2xl bg-base-200/60 p-4">
            <div className="text-xs uppercase tracking-[0.16em] opacity-55">Use Case</div>
            <div className="mt-2 text-sm leading-6 opacity-75">
              登录确认、邀请码、设备配网、活动页落地都适合这种外部受控写法。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const TypeSizePreview: FC = () => {
  const renderType = ref<RenderType>('canvas')

  return (
    <div className="not-prose space-y-4">
      <div className="join">
        {(['canvas', 'svg'] as RenderType[]).map(item => (
          <button
            key={item}
            type="button"
            className={`btn btn-sm join-item ${renderType.value === item ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              renderType.value = item
            }}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[96, 144, 208].map(qrSize => (
          <div
            key={qrSize}
            className="rounded-[1.6rem] border border-base-300 bg-base-100 p-5 text-center shadow-sm"
          >
            <div className="flex min-h-[240px] items-center justify-center rounded-[1.35rem] bg-base-200/45 p-4">
              <QRCode type={renderType.value} value="https://rue.dev/design" size={qrSize} />
            </div>
            <div className="mt-4 text-sm font-medium">{qrSize}px</div>
          </div>
        ))}

        <div className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">
                High Recovery
              </div>
              <div className="mt-2 text-lg font-semibold">Logo 场景建议 H 级纠错</div>
            </div>
            <Badge className={statusBadgeClassName[renderType.value]}>{renderType.value}</Badge>
          </div>
          <div className="mt-5 flex justify-center rounded-[1.5rem] bg-base-200/50 p-4">
            <QRCode
              type={renderType.value}
              size={190}
              value="https://rue.dev/design/qr-code?entry=hero"
              icon={brandIcon}
              iconSize={46}
              errorLevel="H"
            />
          </div>
          <p className="mt-4 mb-0 text-sm text-base-content/72">
            同一份内容可以在 canvas 和 svg
            之间切换。短内容默认会在不升版本的前提下自动尝试提高纠错等级。
          </p>
        </div>
      </div>
    </div>
  )
}

const StatusPreview: FC = () => {
  const statusValue = ref('https://rue.dev/session/qr-1')
  const statusVersion = ref(1)
  const sessionStatus = ref<'active' | 'loading' | 'expired'>('expired')
  const refreshTimer = ref<number | null>(null)
  const customStatusValue = ref('https://rue.dev/custom-status')
  const customStatusVersion = ref(1)
  const customSessionStatus = ref<'active' | 'loading' | 'expired'>('expired')
  const customRefreshTimer = ref<number | null>(null)

  const scheduleSessionReady = () => {
    if (refreshTimer.value != null) {
      clearTimeout(refreshTimer.value)
    }

    refreshTimer.value = window.setTimeout(() => {
      sessionStatus.value = 'active'
      refreshTimer.value = null
    }, 700)
  }

  const refreshSessionCode = () => {
    statusVersion.value += 1
    statusValue.value = `https://rue.dev/session/qr-${statusVersion.value}`
    sessionStatus.value = 'loading'
    scheduleSessionReady()
  }

  const scheduleCustomSessionReady = () => {
    if (customRefreshTimer.value != null) {
      clearTimeout(customRefreshTimer.value)
    }

    customRefreshTimer.value = window.setTimeout(() => {
      customSessionStatus.value = 'active'
      customRefreshTimer.value = null
    }, 700)
  }

  const refreshCustomSessionCode = () => {
    customStatusVersion.value += 1
    customStatusValue.value = `https://rue.dev/custom-status?seed=${customStatusVersion.value}`
    customSessionStatus.value = 'loading'
    scheduleCustomSessionReady()
  }

  onUnmounted(() => {
    if (refreshTimer.value != null) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = null
    }

    if (customRefreshTimer.value != null) {
      clearTimeout(customRefreshTimer.value)
      customRefreshTimer.value = null
    }
  })

  return (
    <div className="not-prose space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.7rem] border border-base-300 bg-base-100 p-4 text-center shadow-sm">
          <QRCode
            value="https://rue.dev/loading"
            status="loading"
            icon={pulseIcon}
            errorLevel="H"
          />
          <div className="mt-3 text-sm font-medium">loading</div>
        </div>

        <div className="rounded-[1.7rem] border border-base-300 bg-base-100 p-4 text-center shadow-sm">
          <QRCode
            value={statusValue.value}
            status={sessionStatus.value}
            onRefresh={refreshSessionCode}
          />
          <div className="mt-3 text-sm font-medium">{sessionStatus.value}</div>
        </div>

        <div className="rounded-[1.7rem] border border-base-300 bg-base-100 p-4 text-center shadow-sm">
          <QRCode
            value="https://rue.dev/scanned"
            status="scanned"
            icon={brandIcon}
            errorLevel="H"
          />
          <div className="mt-3 text-sm font-medium">scanned</div>
        </div>

        <div className="rounded-[1.7rem] border border-base-300 bg-base-100 p-4 text-center shadow-sm">
          <QRCode
            value={customStatusValue.value}
            status={customSessionStatus.value}
            onRefresh={refreshCustomSessionCode}
            classNames={{ cover: 'items-end justify-start p-3' }}
            statusRender={({ locale, onRefresh }) => (
              <div className="w-[180px] rounded-[1.25rem] bg-base-100 px-4 py-3 text-left shadow-sm">
                <div className="badge badge-warning badge-sm">Custom</div>
                <p className="mt-3 mb-0 text-sm leading-6 text-base-content/75">{locale.expired}</p>
                <button
                  className="btn btn-primary btn-xs mt-3 rounded-full"
                  type="button"
                  onClick={onRefresh}
                >
                  {locale.refresh}
                </button>
              </div>
            )}
          />
          <div className="mt-3 text-sm font-medium">
            custom render / {customSessionStatus.value}
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-base-300 bg-base-100 px-5 py-4 text-sm text-base-content/72 shadow-sm">
        当前会话版本：<span className="font-medium">#{statusVersion.value}</span>。点击 expired
        卡片里的刷新按钮，会先进入 loading，再展示新二维码，适合登录确认、支付倒计时和临时令牌场景。
      </div>
    </div>
  )
}

const DownloadPreview: FC = () => {
  const downloadType = ref<RenderType>('canvas')
  const downloadSeed = ref(1)
  const downloadValue = ref('https://rue.dev/invite?scene=design-lab&seed=1')

  return (
    <div className="not-prose grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="join mb-4">
          {(['canvas', 'svg'] as RenderType[]).map(item => (
            <button
              key={item}
              type="button"
              className={`btn btn-sm join-item ${downloadType.value === item ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                downloadType.value = item
              }}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>

        <div
          id="rue-qrcode-download-host"
          className="flex justify-center rounded-[1.6rem] bg-base-200/55 p-4"
        >
          <QRCode
            type={downloadType.value}
            value={downloadValue.value}
            icon={brandIcon}
            iconSize={44}
            errorLevel="H"
            size={208}
          />
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusBadgeClassName[downloadType.value]}>{downloadType.value}</Badge>
          <Badge outline>seed {downloadSeed.value}</Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-base-content/72">
          当前示例把下载动作放在业务页实现：canvas 用 toDataURL，svg 用 Blob + ObjectURL。
          这样组件本身维持纯渲染职责，也便于后续接入埋点、权限和文件命名策略。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary rounded-full px-5"
            onClick={() => {
              downloadCurrentQRCode('rue-qrcode-download-host', downloadType.value)
            }}
          >
            下载 {downloadType.value.toUpperCase()}
          </button>
          <button
            type="button"
            className="btn btn-ghost rounded-full px-5"
            onClick={() => {
              downloadSeed.value += 1
              downloadValue.value = `https://rue.dev/invite?scene=design-lab&seed=${downloadSeed.value}`
            }}
          >
            模拟换码
          </button>
        </div>
        <div className="mt-5 rounded-2xl bg-base-200/60 p-4 text-xs leading-6 text-base-content/65 break-all">
          {downloadValue.value}
        </div>
      </div>
    </div>
  )
}

const apiRows: ApiRow[] = [
  {
    prop: 'value',
    description: '二维码内容，推荐在外部对空字符串做兜底，例如 value || "-"。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'type',
    description: '输出类型，可切换 canvas 和 svg。',
    type: `'canvas' | 'svg'`,
    defaultValue: `'canvas'`,
  },
  {
    prop: 'size',
    description: '组件外层尺寸，内部二维码区域会按 bordered 自动留出边框内边距。',
    type: 'number',
    defaultValue: '160',
  },
  {
    prop: 'color / bgColor',
    description: '前景色和背景色，适合品牌色、暗底码和浅底业务码。',
    type: 'string',
    defaultValue: `'#111827' / '#ffffff'`,
  },
  {
    prop: 'icon / iconSize',
    description: '中心 logo，推荐与 errorLevel="H" 一起使用。',
    type: 'string / number | { width?: number; height?: number }',
    defaultValue: '- / 自动',
  },
  {
    prop: 'errorLevel',
    description: '纠错等级，值越高越适合遮挡或 logo 场景。',
    type: `'L' | 'M' | 'Q' | 'H'`,
    defaultValue: `'M'`,
  },
  {
    prop: 'boostLevel',
    description: '在不增加版本的前提下自动尝试提升纠错等级。',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'status',
    description: '状态遮罩，覆盖 active、loading、expired、scanned 四种核心态。',
    type: `'active' | 'loading' | 'expired' | 'scanned'`,
    defaultValue: `'active'`,
  },
  {
    prop: 'onRefresh / statusRender / locale',
    description: '过期刷新、状态内容自定义和文案定制。',
    type: 'function / function / object',
    defaultValue: '-',
  },
  {
    prop: 'bordered / marginSize',
    description: '外框展示和二维码 quiet zone 大小。',
    type: 'boolean / number',
    defaultValue: 'true / 4',
  },
  {
    prop: 'className / rootClassName / style',
    description: '根节点样式增强，保留与 Rue Design 其他组件一致的入口。',
    type: 'string / string / object',
    defaultValue: '-',
  },
  {
    prop: 'classNames / styles',
    description:
      '语义化槽位样式，支持 root、frame、code、svg、canvas、cover、status、icon 等节点。',
    type: 'object',
    defaultValue: '-',
  },
]

const QRCodeDesign: FC = () => {
  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>QRCode 二维码</h1>
        <p>
          Rue QRCode 这次直接补齐成一个可用组件：保持 Rue 自己的表面语言，不照搬 ant-design
          的视觉，但把 canvas / svg、纠错等级、中心
          logo、状态遮罩、下载示例和语义化样式入口一次性补上。
        </p>
        <p className="text-sm opacity-75">
          组件源码保持 TSX 形态，不写预转换标记，让 Rue
          编译器继续参与后续优化路径；二维码编码逻辑也保持自包含，避免为了这个组件把额外依赖扩散到别处。
        </p>

        <div className="not-prose mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-base-300 bg-gradient-to-br from-base-100 to-base-200/40 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">
              Compiler Friendly
            </div>
            <div className="mt-2 text-base font-semibold">保留 TSX 源码直编</div>
            <p className="mt-2 mb-0 text-sm text-base-content/68">
              没有额外的预转换头，让组件继续走 Rue 自己的编译优化路径。
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-base-300 bg-gradient-to-br from-base-100 to-base-200/40 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">
              Core Features
            </div>
            <div className="mt-2 text-base font-semibold">Canvas、SVG、状态与 Logo</div>
            <p className="mt-2 mb-0 text-sm text-base-content/68">
              核心能力向成熟二维码组件看齐，但视觉仍然是 Rue 当前的卡面体系。
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-base-300 bg-gradient-to-br from-base-100 to-base-200/40 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">
              Style Hooks
            </div>
            <div className="mt-2 text-base font-semibold">保留 classNames / styles</div>
            <p className="mt-2 mb-0 text-sm text-base-content/68">
              业务页既能快速直接用，也能按语义槽位做表面微调。
            </p>
          </div>
        </div>

        <PreviewBlock
          title="基础实时值"
          summary="保留最常见的二维码输入联动场景：外部维护 value，组件只专注编码和渲染。"
          tab={basicTab}
          code={basicCode}
          preview={() => <BasicValuePreview />}
        />

        <PreviewBlock
          title="类型、尺寸与纠错"
          summary="type 决定输出面，size 控制外层尺寸，errorLevel 则决定遮挡容忍度。"
          tab={typeTab}
          code={typeCode}
          preview={() => <TypeSizePreview />}
        />

        <PreviewBlock
          title="配色、边框与语义样式"
          summary="不照搬 antd 的视觉，而是延续 Rue 的圆角卡面语言，同时保留 classNames / styles 扩展位。"
          tab={appearanceTab}
          code={appearanceCode}
          preview={() => (
            <div className="not-prose grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="text-sm font-medium">品牌浅底</div>
                <div className="mt-4 flex justify-center">
                  <QRCode value="https://rue.dev/brand" color="#0f766e" bgColor="#f0fdf4" />
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-base-300 bg-neutral p-5 shadow-sm text-neutral-content">
                <div className="text-sm font-medium">无边框暗底码</div>
                <div className="mt-4 flex justify-center">
                  <QRCode
                    value="https://rue.dev/night"
                    bordered={false}
                    color="#f8fafc"
                    bgColor="#0f172a"
                  />
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="text-sm font-medium">带扩展样式的工作台码</div>
                <div className="mt-4 flex justify-center">
                  <QRCode
                    value="https://rue.dev/lab"
                    icon={labIcon}
                    iconSize={42}
                    errorLevel="H"
                    classNames={{ root: 'shadow-[0_28px_60px_-40px_rgba(15,23,42,0.55)]' }}
                    styles={{ frame: { borderRadius: '34px' } }}
                  />
                </div>
              </div>
            </div>
          )}
        />

        <PreviewBlock
          title="状态遮罩与自定义渲染"
          summary="loading、expired、scanned 三类业务状态内置可用，也可以完全接管覆盖层内容。"
          tab={statusTab}
          code={statusCode}
          preview={() => <StatusPreview />}
        />

        <PreviewBlock
          title="下载输出"
          summary="和 ant-design 的示例一样，下载逻辑放在业务层；组件只负责稳定地产出 canvas 或 svg。"
          tab={downloadTab}
          code={downloadCode}
          preview={() => <DownloadPreview />}
        />

        <h2>API</h2>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default QRCodeDesign
