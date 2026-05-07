import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Button, MockupWindow, Tabs } from '@rue-js/design'
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

const Dot: FC<{ className: string }> = ({ className }) => {
  return <span className={`inline-block size-2 rounded-full ${className}`} />
}

const apiRows: ApiRow[] = [
  {
    prop: 'actions',
    description: '底部操作区；传入后自动渲染带分隔线的底栏',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'actionsClassName',
    description: '底部操作区 className',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'background',
    description: '为根节点追加 bg-base-100',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'bordered',
    description: '为根节点追加 border border-base-300',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'bodyClassName',
    description: '内容区 className；启用增强模式时作用在自动生成的 Body 上',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '窗口内容；未启用增强结构时会原样透传',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'className',
    description: '根节点 className',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'description',
    description: '头部辅助说明文案',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'headerClassName',
    description: '头部区域 className',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'padding',
    description: '自动生成 Body 的内边距',
    type: `'none' | 'sm' | 'md' | 'lg'`,
    defaultValue: `'md'`,
  },
  {
    prop: 'title',
    description: '头部标题；与 description / toolbar 组合后启用结构化窗口',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'toolbar',
    description: '头部右侧工具区，适合按钮、状态和筛选器',
    type: 'any',
    defaultValue: '-',
  },
]

const MockupWindowPage: FC = () => {
  const tabStructured = ref<TabMode>('preview')
  const tabCompound = ref<TabMode>('preview')
  const tabWorkspace = ref<TabMode>('preview')
  const tabBorder = ref<TabMode>('preview')
  const tabBackground = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Mockup Window 窗口外框</h1>
        <p className="text-sm mt-3 mb-3">
          MockupWindow 继续保留 Rue 原本的静态窗口外壳视觉，同时补了一层更顺手的结构化 API。
          既可以继续直接写 children，也可以用 title、toolbar、actions 快速搭一个带头部和底部操作区的展示窗口。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/mockup-window/" target="_blank">
            查看 Mockup Window 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要模拟一个系统窗口、面板或预览壳层，用来承载展示内容。</li>
          <li>希望保留 Rue 现有 mockup-window 视觉，但不想每次都手写头部、内容区和底部操作区。</li>
          <li>需要同时兼顾推荐用法和完全手动拼装的低层布局能力。</li>
        </ul>

        <ExampleBlock
          title="结构化窗口"
          summary="推荐用法：根组件直接负责标题、工具区、内容区和底部操作区。"
          tab={tabStructured}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupWindow
                  bordered
                  background
                  title="Deployment Preview"
                  description="把常见预览面板的标题、状态和操作整理成一套更顺手的写法。"
                  toolbar={
                    <MockupWindow.Toolbar>
                      <div className="hidden items-center gap-2 text-xs opacity-70 sm:flex">
                        <Dot className="bg-success" />
                        Preview ready
                      </div>
                      <Button size="sm" type="outlined">
                        Share
                      </Button>
                    </MockupWindow.Toolbar>
                  }
                  actions={
                    <>
                      <Button type="text">Cancel</Button>
                      <Button color="primary">Publish</Button>
                    </>
                  }
                  bodyClassName="grid gap-4 md:grid-cols-[1.3fr_0.7fr]"
                  data-testid="mockup-window-structured"
                >
                  <div className="rounded-box border border-base-300 bg-base-200/60 p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">Preview</div>
                    <div className="mt-4 grid gap-3">
                      <div className="h-24 rounded-box bg-base-100" />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-16 rounded-box bg-base-100" />
                        <div className="h-16 rounded-box bg-base-100" />
                        <div className="h-16 rounded-box bg-base-100" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-box border border-base-300 p-4">
                      <div className="text-sm font-semibold">Build info</div>
                      <div className="mt-2 text-sm opacity-70">Branch: feat/mockup-window</div>
                      <div className="text-sm opacity-70">Runtime: 82ms</div>
                    </div>
                    <div className="rounded-box border border-base-300 p-4">
                      <div className="text-sm font-semibold">Checklist</div>
                      <ul className="mt-2 space-y-2 text-sm opacity-70">
                        <li>Visual review passed</li>
                        <li>API examples updated</li>
                        <li>Ready for handoff</li>
                      </ul>
                    </div>
                  </div>
                </MockupWindow>
              </div>
            </div>
          )}
          code={`<MockupWindow
  bordered
  background
  title="Deployment Preview"
  description="把常见预览面板的标题、状态和操作整理成一套更顺手的写法。"
  toolbar={
    <MockupWindow.Toolbar>
      <div className="hidden items-center gap-2 text-xs opacity-70 sm:flex">
        <span className="inline-block size-2 rounded-full bg-success" />
        Preview ready
      </div>
      <Button size="sm" type="outlined">Share</Button>
    </MockupWindow.Toolbar>
  }
  actions={
    <>
      <Button type="text">Cancel</Button>
      <Button color="primary">Publish</Button>
    </>
  }
  bodyClassName="grid gap-4 md:grid-cols-[1.3fr_0.7fr]"
>
  <div className="rounded-box border border-base-300 bg-base-200/60 p-4">
    <div className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">Preview</div>
    <div className="mt-4 grid gap-3">
      <div className="h-24 rounded-box bg-base-100" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-16 rounded-box bg-base-100" />
        <div className="h-16 rounded-box bg-base-100" />
        <div className="h-16 rounded-box bg-base-100" />
      </div>
    </div>
  </div>
  <div className="space-y-3">
    <div className="rounded-box border border-base-300 p-4">
      <div className="text-sm font-semibold">Build info</div>
      <div className="mt-2 text-sm opacity-70">Branch: feat/mockup-window</div>
      <div className="text-sm opacity-70">Runtime: 82ms</div>
    </div>
    <div className="rounded-box border border-base-300 p-4">
      <div className="text-sm font-semibold">Checklist</div>
      <ul className="mt-2 space-y-2 text-sm opacity-70">
        <li>Visual review passed</li>
        <li>API examples updated</li>
        <li>Ready for handoff</li>
      </ul>
    </div>
  </div>
</MockupWindow>`}
        />

        <ExampleBlock
          title="复合子组件"
          summary="需要更细粒度控制时，用 Header / Toolbar / Body / Actions 手动拼装。"
          tab={tabCompound}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupWindow bordered className="w-full" data-testid="mockup-window-compound">
                  <MockupWindow.Header
                    title="Analytics Snapshot"
                    description="低层用法适合需要自定义头部排版的场景。"
                    extra={
                      <MockupWindow.Toolbar>
                        <Button size="sm" type="text">
                          This week
                        </Button>
                        <Button size="sm" type="outlined">
                          Export
                        </Button>
                      </MockupWindow.Toolbar>
                    }
                  />
                  <MockupWindow.Body className="grid gap-3 bg-base-100 p-4 sm:grid-cols-3">
                    <div className="rounded-box border border-base-300 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Views</div>
                      <div className="mt-2 text-2xl font-semibold">128k</div>
                    </div>
                    <div className="rounded-box border border-base-300 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Signups</div>
                      <div className="mt-2 text-2xl font-semibold">3.2k</div>
                    </div>
                    <div className="rounded-box border border-base-300 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Conversion</div>
                      <div className="mt-2 text-2xl font-semibold">5.8%</div>
                    </div>
                  </MockupWindow.Body>
                  <MockupWindow.Actions>
                    <Button type="text">Dismiss</Button>
                    <Button color="primary">Open report</Button>
                  </MockupWindow.Actions>
                </MockupWindow>
              </div>
            </div>
          )}
          code={`<MockupWindow bordered className="w-full">
  <MockupWindow.Header
    title="Analytics Snapshot"
    description="低层用法适合需要自定义头部排版的场景。"
    extra={
      <MockupWindow.Toolbar>
        <Button size="sm" type="text">This week</Button>
        <Button size="sm" type="outlined">Export</Button>
      </MockupWindow.Toolbar>
    }
  />
  <MockupWindow.Body className="grid gap-3 bg-base-100 p-4 sm:grid-cols-3">
    <div className="rounded-box border border-base-300 p-4">
      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Views</div>
      <div className="mt-2 text-2xl font-semibold">128k</div>
    </div>
    <div className="rounded-box border border-base-300 p-4">
      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Signups</div>
      <div className="mt-2 text-2xl font-semibold">3.2k</div>
    </div>
    <div className="rounded-box border border-base-300 p-4">
      <div className="text-xs uppercase tracking-[0.2em] opacity-60">Conversion</div>
      <div className="mt-2 text-2xl font-semibold">5.8%</div>
    </div>
  </MockupWindow.Body>
  <MockupWindow.Actions>
    <Button type="text">Dismiss</Button>
    <Button color="primary">Open report</Button>
  </MockupWindow.Actions>
</MockupWindow>`}
        />

        <ExampleBlock
          title="工作台布局"
          summary="结构化 API 和低层 Body 可以混用，快速拼出更复杂的后台窗口。"
          tab={tabWorkspace}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupWindow
                  bordered
                  background
                  title="Workspace Activity"
                  description="适合承载列表、侧栏和操作条的中等复杂度展示区域。"
                  toolbar={
                    <MockupWindow.Toolbar className="justify-end">
                      <Button size="sm" type="text">
                        Filters
                      </Button>
                      <Button size="sm" type="outlined">
                        New panel
                      </Button>
                    </MockupWindow.Toolbar>
                  }
                  padding="none"
                  bodyClassName="grid divide-x divide-base-300 md:grid-cols-[220px_1fr]"
                >
                  <div className="bg-base-100 p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] opacity-60">Sections</div>
                    <div className="space-y-2 text-sm">
                      <div className="rounded-box bg-base-200/70 px-3 py-2 font-medium">Overview</div>
                      <div className="rounded-box px-3 py-2 opacity-70">Reports</div>
                      <div className="rounded-box px-3 py-2 opacity-70">Releases</div>
                    </div>
                  </div>
                  <div className="space-y-3 bg-base-100 p-4">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-box border border-base-300 p-4">
                        <div className="text-sm font-semibold">Queue</div>
                        <div className="mt-3 space-y-2">
                          <div className="h-10 rounded-box bg-base-200/70" />
                          <div className="h-10 rounded-box bg-base-200/70" />
                          <div className="h-10 rounded-box bg-base-200/70" />
                        </div>
                      </div>
                      <div className="rounded-box border border-base-300 p-4">
                        <div className="text-sm font-semibold">Notes</div>
                        <div className="mt-3 h-36 rounded-box bg-base-200/70" />
                      </div>
                    </div>
                    <div className="rounded-box border border-dashed border-base-300 p-4 text-sm opacity-70">
                      这里保持的是 Rue 自己的展示型窗口风格，不把 MockupWindow 做成真正的模态框或桌面应用壳。
                    </div>
                  </div>
                </MockupWindow>
              </div>
            </div>
          )}
          code={`<MockupWindow
  bordered
  background
  title="Workspace Activity"
  description="适合承载列表、侧栏和操作条的中等复杂度展示区域。"
  toolbar={
    <MockupWindow.Toolbar className="justify-end">
      <Button size="sm" type="text">Filters</Button>
      <Button size="sm" type="outlined">New panel</Button>
    </MockupWindow.Toolbar>
  }
  padding="none"
  bodyClassName="grid divide-x divide-base-300 md:grid-cols-[220px_1fr]"
>
  <div className="bg-base-100 p-4">
    <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] opacity-60">Sections</div>
    <div className="space-y-2 text-sm">
      <div className="rounded-box bg-base-200/70 px-3 py-2 font-medium">Overview</div>
      <div className="rounded-box px-3 py-2 opacity-70">Reports</div>
      <div className="rounded-box px-3 py-2 opacity-70">Releases</div>
    </div>
  </div>
  <div className="space-y-3 bg-base-100 p-4">
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-box border border-base-300 p-4">
        <div className="text-sm font-semibold">Queue</div>
        <div className="mt-3 space-y-2">
          <div className="h-10 rounded-box bg-base-200/70" />
          <div className="h-10 rounded-box bg-base-200/70" />
          <div className="h-10 rounded-box bg-base-200/70" />
        </div>
      </div>
      <div className="rounded-box border border-base-300 p-4">
        <div className="text-sm font-semibold">Notes</div>
        <div className="mt-3 h-36 rounded-box bg-base-200/70" />
      </div>
    </div>
    <div className="rounded-box border border-dashed border-base-300 p-4 text-sm opacity-70">
      这里保持的是 Rue 自己的展示型窗口风格，不把 MockupWindow 做成真正的模态框或桌面应用壳。
    </div>
  </div>
</MockupWindow>`}
        />

        <ExampleBlock
          title="window mockup with border"
          summary="保留原有经典 demo，不改动原始 children 透传写法。"
          tab={tabBorder}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupWindow className="border border-base-300 w-full" data-testid="mockup-window-border">
                  <div className="grid place-content-center border-t border-base-300 h-80">Hello!</div>
                </MockupWindow>
              </div>
            </div>
          )}
          code={`<MockupWindow className="border border-base-300 w-full">
  <div className="grid place-content-center border-t border-base-300 h-80">Hello!</div>
</MockupWindow>`}
        />

        <ExampleBlock
          title="window mockup with background color"
          summary="原有背景版本也继续保留，适合最简单的展示壳层。"
          tab={tabBackground}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <MockupWindow
                  className="bg-base-100 border border-base-300 w-full"
                  data-testid="mockup-window-background"
                >
                  <div className="grid place-content-center h-80">Hello!</div>
                </MockupWindow>
              </div>
            </div>
          )}
          code={`<MockupWindow className="bg-base-100 border border-base-300 w-full">
  <div className="grid place-content-center h-80">Hello!</div>
</MockupWindow>`}
        />

        <h2 id="mockup-window-api">API</h2>
        <p>MockupWindow 同时支持“旧的 children 直出模式”和“新的结构化窗口模式”。</p>

        <ApiTable rows={apiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">复合子组件</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>MockupWindow.Header</code>：标准头部，支持 <code>title</code>、<code>description</code> 和{' '}
              <code>extra</code>
            </div>
            <div>
              <code>MockupWindow.Toolbar</code>：头部工具区包装器，默认横向排列
            </div>
            <div>
              <code>MockupWindow.Body</code>：内容区，可选 <code>padding</code>
            </div>
            <div>
              <code>MockupWindow.Actions</code>：底部操作区，默认右对齐并带分隔线
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候用根组件属性，什么时候用复合子组件？</h3>
        <p>
          如果只是常见的标题栏 + 内容区 + 按钮栏，优先直接使用根组件的 <code>title</code>、<code>toolbar</code>
          和 <code>actions</code>。当你需要完全自定义头部排版，再切换到 <code>MockupWindow.Header</code> 这类低层拼装方式。
        </p>

        <h3>padding 应该怎么理解？</h3>
        <p>
          <code>padding</code> 只作用于结构化模式下自动生成的 <code>Body</code>。如果你已经手动使用{' '}
          <code>MockupWindow.Body</code> 或自己管理内容布局，直接在内容节点上写 className 会更直接。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default MockupWindowPage
