import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { MockupPhone, Tabs } from '@rue-js/design'

type TabMode = 'preview' | 'code'
type DemoTone = 'primary' | 'secondary' | 'accent' | 'success'
type DemoSize = 'xs' | 'sm' | 'md' | 'lg'

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

interface SizeExample {
  label: string
  size: DemoSize
  color?: DemoTone
}

const wallpaperUrl = 'https://img.daisyui.com/images/stock/453966.webp?1'

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

const StatusPill: FC<{ label: string; tone?: string }> = ({ label, tone }) => {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[0.65rem] font-medium backdrop-blur ${tone ?? 'bg-white/10 text-white/85'}`}
    >
      {label}
    </span>
  )
}

const AppIcon: FC<{ label: string; className: string }> = ({ label, className }) => {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
      <div
        className={`grid h-11 w-11 place-items-center rounded-2xl text-sm font-semibold shadow-sm ${className}`}
      >
        {label}
      </div>
      <span>{label}</span>
    </div>
  )
}

const rootApiRows: ApiRow[] = [
  {
    prop: 'className',
    description: '追加到手机外框根节点，适合细调边框、阴影、定位等样式',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'size',
    description: '机身宽度预设，提供 xs 到 xl 以及 small / middle / large 别名',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'`,
    defaultValue: '-',
  },
  {
    prop: 'color',
    description: '边框主色快捷语义，映射到 border-* 类名',
    type: `'default' | 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'camera',
    description: '仅在 display 简写模式下生效；可关闭摄像头，或透传 className / attrs 给摄像头节点',
    type: 'boolean | MockupPhoneCameraConfig',
    defaultValue: 'true',
  },
  {
    prop: 'display',
    description: '根级简写模式：直接声明屏幕内容、壁纸、覆盖层与显示区类名',
    type: 'MockupPhoneDisplayConfig',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '经典 compound 模式内容，通常与 MockupPhone.Camera / Display 搭配使用',
    type: 'any',
    defaultValue: '-',
  },
]

const partApiRows: ApiRow[] = [
  {
    prop: 'MockupPhone.Camera',
    description: '摄像头部件，保留原始结构，可自定义 className 和 attrs',
    type: 'FC<MockupPhonePartProps>',
    defaultValue: '-',
  },
  {
    prop: 'MockupPhone.Display',
    description: '显示区部件，适合完全自定义屏幕内部 DOM 结构',
    type: 'FC<MockupPhonePartProps>',
    defaultValue: '-',
  },
]

const sizeExamples: SizeExample[] = [
  { label: 'XS', size: 'xs' },
  { label: 'SM', size: 'sm', color: 'primary' },
  { label: 'MD', size: 'md', color: 'secondary' },
  { label: 'LG', size: 'lg', color: 'accent' },
]

const MockupPhonePage: FC = () => {
  const tabRecommended = ref<TabMode>('preview')
  const tabBasic = ref<TabMode>('preview')
  const tabWallpaper = ref<TabMode>('preview')
  const tabSizes = ref<TabMode>('preview')
  const tabLayouts = ref<TabMode>('preview')
  const tabCamera = ref<TabMode>('preview')
  const tabRecipes = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Mockup Phone 手机外框</h1>
        <p className="text-sm mt-3 mb-3">
          MockupPhone 继续保留 Rue 原本的 compound 结构，同时补上一层更顺手的根级 API：可以直接声明
          <code>display</code>、<code>size</code>、<code>color</code> 和 <code>camera</code>
          ，在快速搭 demo 时不用每次都手写完整骨架。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/mockup-phone/" target="_blank">
            查看 Mockup Phone 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要在设计页、营销页或功能介绍页展示移动端界面，而不想自己维护手机边框结构。</li>
          <li>需要在“快速搭一个手机画面”和“完全自定义显示区 DOM”之间自由切换。</li>
          <li>需要统一控制机身尺寸、边框主色、摄像头显隐和屏幕内容布局。</li>
        </ul>

        <ExampleBlock
          title="推荐写法"
          summary="display 简写模式适合绝大多数展示型场景，根节点上就能把机身、摄像头和屏幕内容一次性声明完。"
          tab={tabRecommended}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap justify-center gap-8 lg:flex-nowrap lg:items-start">
                <MockupPhone
                  size="sm"
                  color="primary"
                  data-testid="mockup-phone-recommended"
                  display={{
                    className:
                      'bg-neutral-950 text-white grid place-content-center px-6 text-center',
                    children: (
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                          Rue OS
                        </div>
                        <div className="mt-3 text-2xl font-semibold">It&apos;s Glowtime.</div>
                        <div className="mt-2 text-sm text-white/65">根级 display API</div>
                      </div>
                    ),
                  }}
                />

                <MockupPhone
                  size="sm"
                  color="secondary"
                  display={{
                    className: 'relative overflow-hidden bg-neutral-950',
                    src: wallpaperUrl,
                    children: (
                      <div className="space-y-3">
                        <StatusPill label="9:41" />
                        <div className="rounded-2xl bg-black/30 p-4 shadow-lg ring-1 ring-white/10">
                          <div className="text-sm font-medium">Today</div>
                          <div className="mt-1 text-2xl font-semibold">3 meetings</div>
                          <div className="mt-2 text-xs text-white/70">
                            Design sync, API review, launch checklist
                          </div>
                        </div>
                      </div>
                    ),
                    contentClassName:
                      'absolute inset-0 flex flex-col justify-between p-4 text-white',
                  }}
                />
              </div>
            </div>
          )}
          code={`<MockupPhone
  size="sm"
  color="primary"
  display={{
    className: 'bg-neutral-950 text-white grid place-content-center px-6 text-center',
    children: (
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-white/50">Rue OS</div>
        <div className="mt-3 text-2xl font-semibold">It's Glowtime.</div>
        <div className="mt-2 text-sm text-white/65">根级 display API</div>
      </div>
    ),
  }}
/>

<MockupPhone
  size="sm"
  color="secondary"
  display={{
    className: 'relative overflow-hidden bg-neutral-950',
    src: 'https://img.daisyui.com/images/stock/453966.webp?1',
    children: (
      <div className="space-y-3">
        <span className="rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-medium text-white/85 backdrop-blur">
          9:41
        </span>
        <div className="rounded-2xl bg-black/30 p-4 shadow-lg ring-1 ring-white/10">
          <div className="text-sm font-medium">Today</div>
          <div className="mt-1 text-2xl font-semibold">3 meetings</div>
          <div className="mt-2 text-xs text-white/70">
            Design sync, API review, launch checklist
          </div>
        </div>
      </div>
    ),
    contentClassName: 'absolute inset-0 flex flex-col justify-between p-4 text-white',
  }}
/>`}
        />

        <ExampleBlock
          title="iPhone mockup"
          summary="保留原来的 compound 写法，适合你想显式控制摄像头和显示区结构的时候。"
          tab={tabBasic}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-start">
                <MockupPhone data-testid="mockup-phone-basic">
                  <MockupPhone.Camera />
                  <MockupPhone.Display className="text-white bg-neutral-900 grid place-content-center">
                    It&apos;s Glowtime.
                  </MockupPhone.Display>
                </MockupPhone>
              </div>
            </div>
          )}
          code={`<MockupPhone>
  <MockupPhone.Camera />
  <MockupPhone.Display className="text-white bg-neutral-900 grid place-content-center">
    It's Glowtime.
  </MockupPhone.Display>
</MockupPhone>`}
        />

        <ExampleBlock
          title="With color and wallpaper"
          summary="原有壁纸 demo 继续保留，同时说明 className 仍然是最高自由度的扩展入口。"
          tab={tabWallpaper}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-start">
                <MockupPhone className="border-[#ff8938]" data-testid="mockup-phone-wallpaper">
                  <MockupPhone.Camera />
                  <MockupPhone.Display>
                    <img alt="wallpaper" src={wallpaperUrl} />
                  </MockupPhone.Display>
                </MockupPhone>
              </div>
            </div>
          )}
          code={`<MockupPhone className="border-[#ff8938]">
  <MockupPhone.Camera />
  <MockupPhone.Display>
    <img alt="wallpaper" src={wallpaperUrl} />
  </MockupPhone.Display>
</MockupPhone>`}
        />

        <ExampleBlock
          title="尺寸与边框色"
          summary="size 控制机身宽度，color 负责常用边框主题色；如果需要更细粒度样式，继续追加 className 即可。"
          tab={tabSizes}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-6 lg:grid-cols-4">
                {sizeExamples.map(item => (
                  <div key={item.label} className="space-y-3 text-center">
                    <div className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">
                      {item.label}
                    </div>
                    <div className="flex justify-center">
                      <MockupPhone
                        size={item.size}
                        color={item.color}
                        display={{
                          className:
                            'grid place-content-center bg-base-200 text-base-content text-center px-4',
                          children: (
                            <div>
                              <div className="text-xs opacity-60">{item.size}</div>
                              <div className="mt-2 text-sm font-semibold">Rue Demo</div>
                            </div>
                          ),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          code={`const phones = [
  { label: 'XS', size: 'xs' },
  { label: 'SM', size: 'sm', color: 'primary' },
  { label: 'MD', size: 'md', color: 'secondary' },
  { label: 'LG', size: 'lg', color: 'accent' },
] as const

{phones.map(item => (
  <MockupPhone
    key={item.label}
    size={item.size}
    color={item.color}
    display={{
      className: 'grid place-content-center bg-base-200 text-base-content text-center px-4',
      children: (
        <div>
          <div className="text-xs opacity-60">{item.size}</div>
          <div className="mt-2 text-sm font-semibold">Rue Demo</div>
        </div>
      ),
    }}
  />
))}`}
        />

        <ExampleBlock
          title="屏幕内容布局"
          summary="display.contentClassName 适合把文案、状态块和浮层叠加到壁纸或纯色背景之上。"
          tab={tabLayouts}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap justify-center gap-8 lg:flex-nowrap lg:items-start">
                <MockupPhone
                  size="sm"
                  color="accent"
                  display={{
                    className:
                      'relative overflow-hidden bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400',
                    children: (
                      <>
                        <div className="flex items-center justify-between">
                          <StatusPill label="Recording" tone="bg-error/85 text-white" />
                          <StatusPill label="14m left" />
                        </div>
                        <div>
                          <div className="text-sm text-white/75">Weekly launch</div>
                          <div className="mt-2 text-3xl font-semibold">84%</div>
                          <div className="mt-2 h-2 rounded-full bg-white/15">
                            <div className="h-full w-[84%] rounded-full bg-white" />
                          </div>
                        </div>
                      </>
                    ),
                    contentClassName: 'flex h-full flex-col justify-between p-5 text-white',
                  }}
                />

                <MockupPhone
                  size="sm"
                  color="success"
                  display={{
                    className: 'bg-base-100 p-4',
                    children: (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-success/10 p-3 text-success">
                          <div className="text-xs uppercase tracking-[0.2em]">Focus</div>
                          <div className="mt-1 text-lg font-semibold">2h 18m</div>
                        </div>
                        <div className="rounded-2xl bg-base-200 p-3">
                          <div className="text-sm font-medium">Notes</div>
                          <div className="mt-1 text-xs opacity-70">
                            保留 compound，同时用 display 简写快速搭状态屏。
                          </div>
                        </div>
                        <div className="rounded-2xl bg-base-200 p-3">
                          <div className="text-sm font-medium">Next</div>
                          <div className="mt-1 text-xs opacity-70">Ship Mockup Phone API</div>
                        </div>
                      </div>
                    ),
                  }}
                />
              </div>
            </div>
          )}
          code={`<MockupPhone
  size="sm"
  color="accent"
  display={{
    className: 'relative overflow-hidden bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400',
    children: (
      <>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-error/85 px-2 py-1 text-[0.65rem] font-medium text-white backdrop-blur">
            Recording
          </span>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-medium text-white/85 backdrop-blur">
            14m left
          </span>
        </div>
        <div>
          <div className="text-sm text-white/75">Weekly launch</div>
          <div className="mt-2 text-3xl font-semibold">84%</div>
          <div className="mt-2 h-2 rounded-full bg-white/15">
            <div className="h-full w-[84%] rounded-full bg-white" />
          </div>
        </div>
      </>
    ),
    contentClassName: 'flex h-full flex-col justify-between p-5 text-white',
  }}
/>

<MockupPhone
  size="sm"
  color="success"
  display={{
    className: 'bg-base-100 p-4',
    children: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-success/10 p-3 text-success">
          <div className="text-xs uppercase tracking-[0.2em]">Focus</div>
          <div className="mt-1 text-lg font-semibold">2h 18m</div>
        </div>
        <div className="rounded-2xl bg-base-200 p-3">
          <div className="text-sm font-medium">Notes</div>
          <div className="mt-1 text-xs opacity-70">
            保留 compound，同时用 display 简写快速搭状态屏。
          </div>
        </div>
        <div className="rounded-2xl bg-base-200 p-3">
          <div className="text-sm font-medium">Next</div>
          <div className="mt-1 text-xs opacity-70">Ship Mockup Phone API</div>
        </div>
      </div>
    ),
  }}
/>`}
        />

        <ExampleBlock
          title="摄像头控制"
          summary="camera 默认开启；当画面更偏卡片展示时可以关闭，或者通过对象写法补充类名和属性。"
          tab={tabCamera}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap justify-center gap-8 lg:flex-nowrap lg:items-start">
                <MockupPhone
                  size="sm"
                  camera={false}
                  display={{
                    className:
                      'grid place-content-center bg-base-200 text-base-content text-center px-6',
                    children: (
                      <div>
                        <div className="text-sm font-semibold">camera={false}</div>
                        <div className="mt-2 text-xs opacity-60">适合更像产品卡片的展示。</div>
                      </div>
                    ),
                  }}
                />

                <MockupPhone
                  size="sm"
                  color="primary"
                  camera={{ className: 'bg-primary/20 ring-2 ring-primary/40' }}
                  display={{
                    className: 'bg-neutral-950 text-white p-4',
                    children: (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Custom camera</div>
                        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/75">
                          用对象写法继续给摄像头节点补 className 或测试属性。
                        </div>
                      </div>
                    ),
                  }}
                />
              </div>
            </div>
          )}
          code={`<MockupPhone
  size="sm"
  camera={false}
  display={{
    className: 'grid place-content-center bg-base-200 text-base-content text-center px-6',
    children: (
      <div>
        <div className="text-sm font-semibold">camera={false}</div>
        <div className="mt-2 text-xs opacity-60">适合更像产品卡片的展示。</div>
      </div>
    ),
  }}
/>

<MockupPhone
  size="sm"
  color="primary"
  camera={{ className: 'bg-primary/20 ring-2 ring-primary/40' }}
  display={{
    className: 'bg-neutral-950 text-white p-4',
    children: (
      <div className="space-y-3">
        <div className="text-sm font-medium">Custom camera</div>
        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/75">
          用对象写法继续给摄像头节点补 className 或测试属性。
        </div>
      </div>
    ),
  }}
/>`}
        />

        <ExampleBlock
          title="场景组合"
          summary="当手机只是内容容器时，可以把它当成页面模块来组合；推荐把复杂 UI 放进 display.children。"
          tab={tabRecipes}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-8 xl:grid-cols-2">
                <div className="flex justify-center">
                  <MockupPhone
                    size="sm"
                    color="secondary"
                    display={{
                      className: 'relative overflow-hidden bg-neutral-950',
                      src: wallpaperUrl,
                      children: (
                        <div className="grid gap-3">
                          <div className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10 backdrop-blur">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
                              Now Playing
                            </div>
                            <div className="mt-2 text-lg font-semibold">Midnight Route</div>
                            <div className="text-sm text-white/70">Rue FM</div>
                          </div>
                          <div className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10 backdrop-blur">
                            <div className="text-sm font-medium">Next up</div>
                            <div className="mt-1 text-xs text-white/70">3 new product updates</div>
                          </div>
                        </div>
                      ),
                      contentClassName: 'absolute inset-0 flex flex-col justify-end p-4 text-white',
                    }}
                  />
                </div>

                <div className="flex justify-center">
                  <MockupPhone
                    size="sm"
                    color="accent"
                    display={{
                      className: 'bg-slate-950 px-4 py-5',
                      children: (
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">Home</div>
                            <div className="mt-1 text-xs text-white/55">6 apps pinned</div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <AppIcon label="Mail" className="bg-sky-500 text-white" />
                            <AppIcon label="AI" className="bg-fuchsia-500 text-white" />
                            <AppIcon label="Cam" className="bg-emerald-500 text-white" />
                            <AppIcon label="Map" className="bg-amber-400 text-slate-950" />
                            <AppIcon label="Docs" className="bg-white text-slate-950" />
                            <AppIcon label="Pay" className="bg-rose-500 text-white" />
                          </div>
                          <div className="rounded-full bg-white/10 p-2 text-center text-xs text-white/70">
                            Swipe up for more
                          </div>
                        </div>
                      ),
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          code={`<MockupPhone
  size="sm"
  color="secondary"
  display={{
    className: 'relative overflow-hidden bg-neutral-950',
    src: 'https://img.daisyui.com/images/stock/453966.webp?1',
    children: (
      <div className="grid gap-3">
        <div className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-white/60">Now Playing</div>
          <div className="mt-2 text-lg font-semibold">Midnight Route</div>
          <div className="text-sm text-white/70">Rue FM</div>
        </div>
        <div className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/10 backdrop-blur">
          <div className="text-sm font-medium">Next up</div>
          <div className="mt-1 text-xs text-white/70">3 new product updates</div>
        </div>
      </div>
    ),
    contentClassName: 'absolute inset-0 flex flex-col justify-end p-4 text-white',
  }}
/>

<MockupPhone
  size="sm"
  color="accent"
  display={{
    className: 'bg-slate-950 px-4 py-5',
    children: (
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="text-sm font-medium text-white">Home</div>
          <div className="mt-1 text-xs text-white/55">6 apps pinned</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500 text-sm font-semibold text-white shadow-sm">
              Mail
            </div>
            <span>Mail</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-fuchsia-500 text-sm font-semibold text-white shadow-sm">
              AI
            </div>
            <span>AI</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-sm">
              Cam
            </div>
            <span>Cam</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400 text-sm font-semibold text-slate-950 shadow-sm">
              Map
            </div>
            <span>Map</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-semibold text-slate-950 shadow-sm">
              Docs
            </div>
            <span>Docs</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-[0.65rem] text-white/80">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500 text-sm font-semibold text-white shadow-sm">
              Pay
            </div>
            <span>Pay</span>
          </div>
        </div>
        <div className="rounded-full bg-white/10 p-2 text-center text-xs text-white/70">
          Swipe up for more
        </div>
      </div>
    ),
  }}
/>`}
        />

        <h2 id="mockup-phone-api">API</h2>
        <p>MockupPhone 现在支持“根级简写模式”和“经典 compound 模式”两套写法。</p>

        <h3>MockupPhone</h3>
        <ApiTable rows={rootApiRows} />

        <h3 className="mt-6">Compound Parts</h3>
        <ApiTable rows={partApiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">display 对象结构</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>className</code>：显示区根节点类名
            </div>
            <div>
              <code>src</code> / <code>alt</code> / <code>imgClassName</code>：内置壁纸图
            </div>
            <div>
              <code>children</code>：显示区内容
            </div>
            <div>
              <code>contentClassName</code>：为 children 额外包一层容器，便于做绝对定位和覆盖层
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候用 display，什么时候继续写 MockupPhone.Display？</h3>
        <p>
          如果只是想快速搭一个手机画面，优先用 <code>display</code>
          。如果你需要自己决定显示区里的完整节点树，或者已经在复用旧 demo，继续用
          <code>MockupPhone.Camera</code> 和 <code>MockupPhone.Display</code> 会更直观。
        </p>

        <h3>color 和 className 应该怎么选？</h3>
        <p>
          <code>color</code> 负责常用边框主题色，适合快速选主色；<code>className</code>{' '}
          负责更细的样式控制，比如任意十六进制边框色、自定义阴影或缩放。
        </p>

        <h3>如何在壁纸上叠加浮层内容？</h3>
        <p>
          让 <code>display.className</code> 具备 <code>relative</code> 和{' '}
          <code>overflow-hidden</code>，再把浮层内容放进
          <code>children</code>，通过 <code>contentClassName</code> 设置{' '}
          <code>absolute inset-0</code> 即可。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default MockupPhonePage
