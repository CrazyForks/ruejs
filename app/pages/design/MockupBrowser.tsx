import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { MockupBrowser, Tabs } from '@rue-js/design'

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

const rootApiRows: ApiRow[] = [
  {
    prop: 'bordered',
    description: '为浏览器外框追加边框',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'background',
    description: '为外层容器追加底色',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'showToolbar',
    description: '控制是否渲染快捷工具栏',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'url',
    description: '快捷生成地址栏内容；适合推荐用法',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'toolbar',
    description: '自定义快捷工具栏主体；通常与 toolbarStart / toolbarEnd 配合',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'toolbarStart',
    description: '快捷工具栏左侧插槽',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'toolbarEnd',
    description: '快捷工具栏右侧插槽',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'toolbarClassName',
    description: '快捷工具栏附加样式',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'contentClassName',
    description: '快捷内容区附加样式；设置后会自动包裹内容区',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'contentBordered',
    description: '快捷内容区是否带上边框',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'contentBackground',
    description: '快捷内容区是否带背景色',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'contentPadding',
    description: '快捷内容区内边距',
    type: `'none' | 'sm' | 'md' | 'lg'`,
    defaultValue: `'none'`,
  },
]

const toolbarApiRows: ApiRow[] = [
  {
    prop: 'start',
    description: '工具栏左侧内容',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'end',
    description: '工具栏右侧内容',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '工具栏主体内容，通常放地址栏',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'className',
    description: '工具栏附加样式',
    type: 'string',
    defaultValue: '-',
  },
]

const addressBarApiRows: ApiRow[] = [
  {
    prop: 'href',
    description: '地址链接；传入后默认渲染为 a',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'prefix',
    description: '地址栏前缀内容，例如标签或图标',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'suffix',
    description: '地址栏后缀内容，例如状态或动作',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'interactive',
    description: '强制按可交互链接样式输出',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'status',
    description: '地址栏状态色',
    type: `'default' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
]

const contentApiRows: ApiRow[] = [
  {
    prop: 'bordered',
    description: '内容区上边框',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'background',
    description: '内容区背景色',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'padding',
    description: '内容区内边距',
    type: `'none' | 'sm' | 'md' | 'lg'`,
    defaultValue: `'none'`,
  },
  {
    prop: 'className',
    description: '内容区附加样式',
    type: 'string',
    defaultValue: '-',
  },
]

const MockupBrowserPage: FC = () => {
  const tabRecommended = ref<TabMode>('preview')
  const tabBorder = ref<TabMode>('preview')
  const tabBackground = ref<TabMode>('preview')
  const tabToolbar = ref<TabMode>('preview')
  const tabAddressBar = ref<TabMode>('preview')
  const tabContent = ref<TabMode>('preview')
  const tabRecipes = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Mockup Browser 浏览器外框</h1>
        <p className="text-sm mt-3 mb-3">
          MockupBrowser 保留 Rue
          当前的浏览器外框视觉，同时补上推荐写法所需的地址栏、内容区和快捷工具栏 API。 原始 children
          组合方式依然可用，适合需要完全自定义结构的场景。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要展示网页、管理台、嵌入式预览或静态产品截图，并且希望外层有统一的浏览器语义。</li>
          <li>希望快速落一个带地址栏的浏览器框，用少量 props 搭出完整演示。</li>
          <li>需要保留对工具栏和内容区的完全控制，继续使用原始组合模式。</li>
        </ul>

        <ExampleBlock
          title="推荐用法"
          summary="直接通过 url、toolbarEnd、contentClassName 等快捷 props 组出一个完整浏览器预览。"
          tab={tabRecommended}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupBrowser
                  bordered
                  background
                  url="https://app.ruejs.org/workspaces/demo"
                  toolbarEnd={
                    <>
                      <span className="badge badge-success badge-sm">LIVE</span>
                      <span className="badge badge-ghost badge-sm">v0.15</span>
                    </>
                  }
                  contentClassName="h-[22rem] bg-base-100"
                >
                  <div className="grid h-full md:grid-cols-[15rem_minmax(0,1fr)]">
                    <aside className="border-r border-base-300 bg-base-200/35 p-4">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] opacity-60">
                        Workspace
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="rounded-box bg-primary/10 px-3 py-2 font-medium text-primary">
                          Overview
                        </div>
                        <div className="rounded-box px-3 py-2">Releases</div>
                        <div className="rounded-box px-3 py-2">Assets</div>
                        <div className="rounded-box px-3 py-2">Team</div>
                      </div>
                    </aside>
                    <main className="grid gap-4 p-4">
                      <div className="rounded-box border border-base-300 bg-base-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.24em] opacity-60">
                              Current sprint
                            </div>
                            <div className="mt-1 text-lg font-semibold">Mockup Browser refresh</div>
                          </div>
                          <div className="badge badge-primary badge-outline">In review</div>
                        </div>
                        <p className="mt-3 mb-0 text-sm opacity-75">
                          用增强后的快捷 API 组织浏览器壳层，同时把真实页面内容直接塞进内容区。
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-box border border-base-300 bg-base-100 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] opacity-60">
                            Deploys
                          </div>
                          <div className="mt-2 text-2xl font-semibold">18</div>
                        </div>
                        <div className="rounded-box border border-base-300 bg-base-100 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] opacity-60">
                            Latency
                          </div>
                          <div className="mt-2 text-2xl font-semibold">124ms</div>
                        </div>
                        <div className="rounded-box border border-base-300 bg-base-100 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] opacity-60">
                            Errors
                          </div>
                          <div className="mt-2 text-2xl font-semibold">0.02%</div>
                        </div>
                      </div>
                    </main>
                  </div>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser
  bordered
  background
  url="https://app.ruejs.org/workspaces/demo"
  toolbarEnd={
    <>
      <span className="badge badge-success badge-sm">LIVE</span>
      <span className="badge badge-ghost badge-sm">v0.15</span>
    </>
  }
  contentClassName="h-[22rem] bg-base-100"
>
  <div className="grid h-full md:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="border-r border-base-300 bg-base-200/35 p-4">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Workspace</div>
      <div className="space-y-2 text-sm">
        <div className="rounded-box bg-primary/10 px-3 py-2 font-medium text-primary">Overview</div>
        <div className="rounded-box px-3 py-2">Releases</div>
        <div className="rounded-box px-3 py-2">Assets</div>
        <div className="rounded-box px-3 py-2">Team</div>
      </div>
    </aside>
    <main className="grid gap-4 p-4">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] opacity-60">Current sprint</div>
            <div className="mt-1 text-lg font-semibold">Mockup Browser refresh</div>
          </div>
          <div className="badge badge-primary badge-outline">In review</div>
        </div>
        <p className="mt-3 mb-0 text-sm opacity-75">
          用增强后的快捷 API 组织浏览器壳层，同时把真实页面内容直接塞进内容区。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase tracking-[0.24em] opacity-60">Deploys</div>
          <div className="mt-2 text-2xl font-semibold">18</div>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase tracking-[0.24em] opacity-60">Latency</div>
          <div className="mt-2 text-2xl font-semibold">124ms</div>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase tracking-[0.24em] opacity-60">Errors</div>
          <div className="mt-2 text-2xl font-semibold">0.02%</div>
        </div>
      </div>
    </main>
  </div>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="browser mockup with border"
          summary="保留原有 demo，不改变旧的 children + Toolbar 组织方式。"
          tab={tabBorder}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupBrowser
                  className="w-full border border-base-300"
                  data-testid="mockup-browser-border"
                >
                  <MockupBrowser.Toolbar>
                    <div className="input">https://daisyui.com</div>
                  </MockupBrowser.Toolbar>
                  <div className="grid h-80 place-content-center border-t border-base-300">
                    Hello!
                  </div>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser className="w-full border border-base-300">
  <MockupBrowser.Toolbar>
    <div className="input">https://daisyui.com</div>
  </MockupBrowser.Toolbar>
  <div className="grid h-80 place-content-center border-t border-base-300">Hello!</div>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="browser mockup with background color"
          summary="保留原有背景色 demo，继续支持最原始的手写结构。"
          tab={tabBackground}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupBrowser className="w-full border border-base-300 bg-base-100">
                  <MockupBrowser.Toolbar>
                    <div className="input">https://daisyui.com</div>
                  </MockupBrowser.Toolbar>
                  <div className="grid h-80 place-content-center">Hello!</div>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser className="w-full border border-base-300 bg-base-100">
  <MockupBrowser.Toolbar>
    <div className="input">https://daisyui.com</div>
  </MockupBrowser.Toolbar>
  <div className="grid h-80 place-content-center">Hello!</div>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="自定义工具栏"
          summary="Toolbar 的 start / end 插槽适合放站点标签、环境状态或次要动作。"
          tab={tabToolbar}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupBrowser bordered background className="w-full">
                  <MockupBrowser.Toolbar
                    start={<span className="badge badge-neutral badge-sm">Docs</span>}
                    end={
                      <>
                        <span className="badge badge-ghost badge-sm">Preview</span>
                        <span className="badge badge-primary badge-sm">Share</span>
                      </>
                    }
                  >
                    <MockupBrowser.AddressBar
                      href="https://ruejs.org/docs/components/mockup-browser"
                      prefix={<span className="badge badge-ghost badge-xs">GET</span>}
                      suffix={<span className="text-xs">public</span>}
                    >
                      https://ruejs.org/docs/components/mockup-browser
                    </MockupBrowser.AddressBar>
                  </MockupBrowser.Toolbar>
                  <MockupBrowser.Content
                    background
                    padding="md"
                    className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]"
                  >
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] opacity-60">
                        Outline
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-primary">Introduction</div>
                        <div>Recommended usage</div>
                        <div>AddressBar</div>
                        <div>Content</div>
                      </div>
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="text-lg font-semibold">Mockup Browser</div>
                      <p className="mt-3 mb-0 text-sm opacity-75">
                        工具栏仍然保留原始组合能力，但通过 start / end 把常见布局槽位做得更顺手。
                      </p>
                    </div>
                  </MockupBrowser.Content>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser bordered background className="w-full">
  <MockupBrowser.Toolbar
    start={<span className="badge badge-neutral badge-sm">Docs</span>}
    end={
      <>
        <span className="badge badge-ghost badge-sm">Preview</span>
        <span className="badge badge-primary badge-sm">Share</span>
      </>
    }
  >
    <MockupBrowser.AddressBar
      href="https://ruejs.org/docs/components/mockup-browser"
      prefix={<span className="badge badge-ghost badge-xs">GET</span>}
      suffix={<span className="text-xs">public</span>}
    >
      https://ruejs.org/docs/components/mockup-browser
    </MockupBrowser.AddressBar>
  </MockupBrowser.Toolbar>
  <MockupBrowser.Content background padding="md">
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Outline</div>
      <div className="space-y-2 text-sm">
        <div className="font-medium text-primary">Introduction</div>
        <div>Recommended usage</div>
        <div>AddressBar</div>
        <div>Content</div>
      </div>
    </div>
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="text-lg font-semibold">Mockup Browser</div>
      <p className="mt-3 mb-0 text-sm opacity-75">
        工具栏仍然保留原始组合能力，但通过 start / end 把常见布局槽位做得更顺手。
      </p>
    </div>
  </MockupBrowser.Content>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="地址栏状态"
          summary="AddressBar 可单独使用，并支持 success / warning / error 等状态语义。"
          tab={tabAddressBar}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-4">
                <MockupBrowser bordered className="w-full">
                  <MockupBrowser.Toolbar>
                    <MockupBrowser.AddressBar
                      href="https://preview.ruejs.org/releases/2026.05.01"
                      status="success"
                      prefix={<span className="badge badge-success badge-xs">200</span>}
                      suffix={<span className="text-xs">Published</span>}
                    />
                  </MockupBrowser.Toolbar>
                  <MockupBrowser.Content className="grid h-28 place-content-center text-sm opacity-70">
                    发布成功，可继续分享预览链接。
                  </MockupBrowser.Content>
                </MockupBrowser>

                <MockupBrowser bordered className="w-full">
                  <MockupBrowser.Toolbar>
                    <MockupBrowser.AddressBar
                      status="warning"
                      prefix={<span className="badge badge-warning badge-xs">302</span>}
                      suffix={<span className="text-xs">Redirect</span>}
                    >
                      https://staging.ruejs.org/latest
                    </MockupBrowser.AddressBar>
                  </MockupBrowser.Toolbar>
                  <MockupBrowser.Content className="grid h-28 place-content-center text-sm opacity-70">
                    预览地址已重定向到最新构建。
                  </MockupBrowser.Content>
                </MockupBrowser>

                <MockupBrowser bordered className="w-full">
                  <MockupBrowser.Toolbar>
                    <MockupBrowser.AddressBar
                      status="error"
                      prefix={<span className="badge badge-error badge-xs">500</span>}
                      suffix={<span className="text-xs">Retry</span>}
                    >
                      https://api.ruejs.org/workspaces/demo
                    </MockupBrowser.AddressBar>
                  </MockupBrowser.Toolbar>
                  <MockupBrowser.Content className="grid h-28 place-content-center text-sm opacity-70">
                    当前接口不可达，请稍后重试。
                  </MockupBrowser.Content>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser bordered>
  <MockupBrowser.Toolbar>
    <MockupBrowser.AddressBar
      href="https://preview.ruejs.org/releases/2026.05.01"
      status="success"
      prefix={<span className="badge badge-success badge-xs">200</span>}
      suffix={<span className="text-xs">Published</span>}
    />
  </MockupBrowser.Toolbar>
  <MockupBrowser.Content className="grid h-28 place-content-center">
    发布成功，可继续分享预览链接。
  </MockupBrowser.Content>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="内容容器"
          summary="Content 用来统一处理上边框、背景色和内边距，避免每个 demo 都手写一遍。"
          tab={tabContent}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupBrowser bordered className="w-full">
                  <MockupBrowser.Toolbar>
                    <MockupBrowser.AddressBar>https://ruejs.org/changelog</MockupBrowser.AddressBar>
                  </MockupBrowser.Toolbar>
                  <MockupBrowser.Content
                    background
                    padding="lg"
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] opacity-60">May</div>
                      <div className="mt-2 text-base font-semibold">Component refresh</div>
                      <p className="mt-2 mb-0 text-sm opacity-75">
                        Mockup Browser 新增地址栏和内容区语义 API。
                      </p>
                    </div>
                    <div className="rounded-box border border-dashed border-base-300 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] opacity-60">Next</div>
                      <div className="mt-2 text-base font-semibold">Design recipes</div>
                      <p className="mt-2 mb-0 text-sm opacity-75">
                        用组合页展示不同布局密度和数据卡片编排方式。
                      </p>
                    </div>
                  </MockupBrowser.Content>
                </MockupBrowser>
              </div>
            </div>
          )}
          code={`<MockupBrowser bordered className="w-full">
  <MockupBrowser.Toolbar>
    <MockupBrowser.AddressBar>https://ruejs.org/changelog</MockupBrowser.AddressBar>
  </MockupBrowser.Toolbar>
  <MockupBrowser.Content background padding="lg" className="grid gap-4 md:grid-cols-2">
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="text-xs uppercase tracking-[0.24em] opacity-60">May</div>
      <div className="mt-2 text-base font-semibold">Component refresh</div>
      <p className="mt-2 mb-0 text-sm opacity-75">Mockup Browser 新增地址栏和内容区语义 API。</p>
    </div>
    <div className="rounded-box border border-dashed border-base-300 p-4">
      <div className="text-xs uppercase tracking-[0.24em] opacity-60">Next</div>
      <div className="mt-2 text-base font-semibold">Design recipes</div>
      <p className="mt-2 mb-0 text-sm opacity-75">用组合页展示不同布局密度和数据卡片编排方式。</p>
    </div>
  </MockupBrowser.Content>
</MockupBrowser>`}
        />

        <ExampleBlock
          title="场景组合"
          summary="把快捷 props 和子组件混用，可以很快搭出文档、后台、嵌入式预览等组合场景。"
          tab={tabRecipes}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="grid gap-4 xl:grid-cols-2">
                  <MockupBrowser
                    bordered
                    url="https://studio.ruejs.org/campaigns/spring-launch"
                    toolbarEnd={<span className="badge badge-accent badge-sm">Draft</span>}
                    contentClassName="h-72 bg-base-100"
                  >
                    <div className="grid h-full gap-4 p-4">
                      <div className="rounded-box border border-base-300 bg-primary/8 p-4">
                        <div className="text-xs uppercase tracking-[0.24em] opacity-60">
                          Campaign
                        </div>
                        <div className="mt-2 text-lg font-semibold">Spring Launch</div>
                        <p className="mt-2 mb-0 text-sm opacity-75">
                          在一个浏览器壳层里展示编辑后台会更接近真实产品观感。
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-box border border-base-300 p-4 text-sm">
                          Email sequences
                        </div>
                        <div className="rounded-box border border-base-300 p-4 text-sm">
                          Asset approvals
                        </div>
                      </div>
                    </div>
                  </MockupBrowser>

                  <MockupBrowser bordered background className="w-full">
                    <MockupBrowser.Toolbar
                      end={<span className="badge badge-info badge-sm">Docs</span>}
                    >
                      <MockupBrowser.AddressBar prefix={<span className="text-xs">Search</span>}>
                        https://ruejs.org/components/mockup-browser
                      </MockupBrowser.AddressBar>
                    </MockupBrowser.Toolbar>
                    <MockupBrowser.Content padding="md" className="h-72">
                      <div className="grid h-full gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
                        <div className="rounded-box border border-base-300 bg-base-200/35 p-4 text-sm">
                          <div className="font-medium">On this page</div>
                          <div className="mt-3 space-y-2 opacity-75">
                            <div>Recommended usage</div>
                            <div>Toolbar</div>
                            <div>AddressBar</div>
                            <div>Content</div>
                          </div>
                        </div>
                        <div className="rounded-box border border-base-300 bg-base-100 p-4">
                          <div className="text-lg font-semibold">Mockup Browser API</div>
                          <p className="mt-3 mb-0 text-sm opacity-75">
                            文档页场景更适合手动组合 Toolbar、AddressBar 和 Content，让布局更可控。
                          </p>
                        </div>
                      </div>
                    </MockupBrowser.Content>
                  </MockupBrowser>
                </div>
              </div>
            </div>
          )}
          code={`<MockupBrowser
  bordered
  url="https://studio.ruejs.org/campaigns/spring-launch"
  toolbarEnd={<span className="badge badge-accent badge-sm">Draft</span>}
  contentClassName="h-72 bg-base-100"
>
  <div className="grid h-full gap-4 p-4">
    <div className="rounded-box border border-base-300 bg-primary/8 p-4">
      <div className="text-xs uppercase tracking-[0.24em] opacity-60">Campaign</div>
      <div className="mt-2 text-lg font-semibold">Spring Launch</div>
      <p className="mt-2 mb-0 text-sm opacity-75">在一个浏览器壳层里展示编辑后台会更接近真实产品观感。</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-box border border-base-300 p-4 text-sm">Email sequences</div>
      <div className="rounded-box border border-base-300 p-4 text-sm">Asset approvals</div>
    </div>
  </div>
</MockupBrowser>

<MockupBrowser bordered background>
  <MockupBrowser.Toolbar end={<span className="badge badge-info badge-sm">Docs</span>}>
    <MockupBrowser.AddressBar prefix={<span className="text-xs">Search</span>}>
      https://ruejs.org/components/mockup-browser
    </MockupBrowser.AddressBar>
  </MockupBrowser.Toolbar>
  <MockupBrowser.Content padding="md" className="h-72">
    <div className="grid h-full gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="rounded-box border border-base-300 bg-base-200/35 p-4 text-sm">
        <div className="font-medium">On this page</div>
        <div className="mt-3 space-y-2 opacity-75">
          <div>Recommended usage</div>
          <div>Toolbar</div>
          <div>AddressBar</div>
          <div>Content</div>
        </div>
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="text-lg font-semibold">Mockup Browser API</div>
        <p className="mt-3 mb-0 text-sm opacity-75">
          文档页场景更适合手动组合 Toolbar、AddressBar 和 Content，让布局更可控。
        </p>
      </div>
    </div>
  </MockupBrowser.Content>
</MockupBrowser>`}
        />

        <h2 id="mockup-browser-api">API</h2>
        <p>MockupBrowser 现在支持推荐快捷模式和原始组合模式两套写法。</p>

        <h3>MockupBrowser</h3>
        <ApiTable rows={rootApiRows} />

        <h3>MockupBrowser.Toolbar</h3>
        <ApiTable rows={toolbarApiRows} />

        <h3>MockupBrowser.AddressBar</h3>
        <ApiTable rows={addressBarApiRows} />

        <h3>MockupBrowser.Content</h3>
        <ApiTable rows={contentApiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">推荐写法对照</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>url</code> 适合快速生成地址栏
            </div>
            <div>
              <code>contentClassName</code> 适合直接包裹内容区
            </div>
            <div>
              <code>Toolbar + AddressBar + Content</code> 适合需要细粒度控制的页面
            </div>
            <div>
              旧的手写 <code>Toolbar</code> 结构仍然完全可用
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候用快捷 props，什么时候用子组件？</h3>
        <p>
          如果只是想快速放一个带地址栏的浏览器框，优先用 <code>url</code>、<code>toolbarEnd</code>、
          <code>contentClassName</code> 这些快捷 props。需要更细的布局控制时，再切到{' '}
          <code>MockupBrowser.Toolbar</code>、<code>MockupBrowser.AddressBar</code> 和{' '}
          <code>MockupBrowser.Content</code>。
        </p>

        <h3>原来的 demo 写法会失效吗？</h3>
        <p>
          不会。原来的 <code>children + MockupBrowser.Toolbar</code> 结构仍然保留；当前页面里的
          “browser mockup with border” 和 “browser mockup with background color”
          就是旧写法的直接保留版。
        </p>

        <h3>Content 和根节点上的 contentClassName 有什么区别？</h3>
        <p>
          <code>contentClassName</code>{' '}
          适合推荐写法，直接让根组件帮你包一层内容区；如果你还需要分别控制
          <code>padding</code>、<code>background</code> 或自己拆更多节点，就更适合直接使用{' '}
          <code>MockupBrowser.Content</code>。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default MockupBrowserPage
