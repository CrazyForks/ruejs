import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'
import Layout, {
  type LayoutSiderTriggerRenderMeta,
} from '../../../packages/rue-design/src/components/layout/index'
import Badge from '../../../packages/rue-design/src/components/badge/index'
import Button from '../../../packages/rue-design/src/components/button/index'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const menuItems = ['Overview', 'Reports', 'Signals', 'Members']
const opsItems = ['Queue', 'Review', 'Policy', 'Export']

const apiRows: ApiRow[] = [
  {
    prop: 'hasSider',
    description: '显式声明当前 Layout 包含 Sider，适合 SSR 或异步 children 场景避免首帧方向抖动。',
    type: 'boolean',
    defaultValue: '自动推断',
  },
  {
    prop: 'className / style',
    description: '根容器样式扩展，继续保持 Rue 的 utility class 叠加方式。',
    type: 'string / string | Record<string, any>',
    defaultValue: '-',
  },
  {
    prop: 'Layout.Header / Content / Footer',
    description: '语义分区子组件，默认提供 Rue 风格的面板样式，也支持通过 className 覆盖。',
    type: 'FC',
    defaultValue: '-',
  },
  {
    prop: 'Layout.Sider',
    description: '侧边栏子组件，支持折叠、响应式收起、零宽触发器和自定义 trigger。',
    type: 'FC',
    defaultValue: '-',
  },
  {
    prop: 'Sider.width',
    description: '展开态宽度，支持数字与任意 CSS 长度。',
    type: 'number | string',
    defaultValue: '240',
  },
  {
    prop: 'Sider.collapsedWidth',
    description: '收起态宽度；传 0 时会切到零宽模式，保留浮动 trigger。',
    type: 'number | string',
    defaultValue: '80',
  },
  {
    prop: 'Sider.collapsible',
    description: '开启点击触发器的折叠能力。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'Sider.collapsed / defaultCollapsed',
    description: '受控和非受控折叠态。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'Sider.breakpoint',
    description: '按 xs 到 xxl 断点自动切换 broken / collapsed，并触发回调。',
    type: "'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'",
    defaultValue: '-',
  },
  {
    prop: 'Sider.trigger',
    description: '自定义 trigger 节点，或传入函数读取 collapsed / below / zeroWidth / toggle。',
    type: 'any | (meta) => any',
    defaultValue: '内置 Trigger',
  },
  {
    prop: 'Sider.triggerPosition',
    description: '控制默认 trigger 贴在起始侧还是结束侧。',
    type: "'start' | 'end'",
    defaultValue: 'end',
  },
  {
    prop: 'Sider.theme',
    description: '切换 light / dark 两套侧栏基底色。',
    type: "'light' | 'dark'",
    defaultValue: 'light',
  },
  {
    prop: 'Sider.onCollapse / onBreakpoint',
    description: '监听点击折叠与响应式断点变化。',
    type: '(collapsed, type) => void / (broken) => void',
    defaultValue: '-',
  },
]

const basicCode = [
  '<Layout className="rounded-[2rem] bg-base-200/40 p-4">',
  '  <Layout.Header>Header</Layout.Header>',
  '  <Layout.Content>Content</Layout.Content>',
  '  <Layout.Footer>Footer</Layout.Footer>',
  '</Layout>',
].join('\n')

const shellCode = [
  '<Layout hasSider className="rounded-[2rem] bg-base-200/50 p-4">',
  '  <Layout.Sider width={248} theme="dark" footer="12 agents online">',
  '    <div className="flex flex-1 flex-col gap-3">',
  '      <div className="space-y-1">',
  '        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-55">',
  '          workspace',
  '        </div>',
  '        <div className="text-lg font-semibold leading-none">Rue Console</div>',
  '        <div className="text-sm opacity-70">Stable branch / ap-southeast-1</div>',
  '      </div>',
  '      <div className="grid gap-2">',
  '        {["Overview", "Reports", "Signals", "Members"].map((item, index) => (',
  '          <button',
  '            key={item}',
  '            type="button"',
  '            className={[',
  '              "inline-flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm transition duration-200",',
  '              index === 0 ? "bg-base-100/14 font-semibold text-white shadow-sm" : "hover:bg-base-100/10",',
  '            ].join(" ")}',
  '          >',
  '            <span className="inline-grid size-8 place-items-center rounded-xl bg-white/10 text-[11px] font-semibold">',
  '              {item.slice(0, 1)}',
  '            </span>',
  '            <span className="truncate">{item}</span>',
  '          </button>',
  '        ))}',
  '      </div>',
  '    </div>',
  '  </Layout.Sider>',
  '  <Layout>',
  '    <Layout.Header>',
  '      <div>',
  '        <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">',
  '          command center',
  '        </div>',
  '        <div className="text-lg font-semibold">Growth cockpit</div>',
  '      </div>',
  '      <div className="ml-auto flex flex-wrap gap-2">',
  '        <Button className="btn-sm">Share</Button>',
  '        <Button className="btn-primary btn-sm">Deploy</Button>',
  '      </div>',
  '    </Layout.Header>',
  '    <Layout.Content>',
  '      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">',
  '        <div className="grid gap-4 md:grid-cols-2">',
  '          <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">',
  '            <div className="text-xs uppercase tracking-[0.24em] opacity-50">ARR</div>',
  '            <div className="mt-3 text-3xl font-semibold">¥ 4.2M</div>',
  '            <div className="mt-2 text-sm opacity-70">Renewal stayed above 91% for six weeks.</div>',
  '          </div>',
  '          <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">',
  '            <div className="text-xs uppercase tracking-[0.24em] opacity-50">Activation</div>',
  '            <div className="mt-3 text-3xl font-semibold">68%</div>',
  '            <div className="mt-2 text-sm opacity-70">Onboarding friction is now concentrated in payment setup.</div>',
  '          </div>',
  '          <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm md:col-span-2">',
  '            <div className="text-sm font-semibold">Content canvas</div>',
  '            <div className="mt-2 text-sm leading-6 opacity-75">',
  '              Place your charts, editors or boards here. Layout only handles the page skeleton; the canvas remains fully composable.',
  '            </div>',
  '          </div>',
  '        </div>',
  '        <div className="grid gap-3">',
  '          <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-4 shadow-sm">',
  '            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">release</div>',
  '            <div className="mt-2 text-2xl font-semibold">v0.0.39</div>',
  '            <div className="mt-2 text-sm leading-6 text-base-content/70">',
  '              148 checks passed, 3 docs pending approval.',
  '            </div>',
  '          </div>',
  '          <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/75 p-4">',
  '            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">',
  '              Ops queue',
  '            </div>',
  '            <div className="grid gap-2">',
  '              {["Queue", "Review", "Policy", "Export"].map(item => (',
  '                <div',
  '                  key={item}',
  '                  className="flex items-center justify-between rounded-xl bg-base-200/70 px-3 py-2 text-sm"',
  '                >',
  '                  <span>{item}</span>',
  '                  <Badge outline>{item.length + 2}</Badge>',
  '                </div>',
  '              ))}',
  '            </div>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </Layout.Content>',
  '    <Layout.Footer>',
  '      <span>Queue latency 28 ms</span>',
  '      <span className="ml-auto">SLA 99.98%</span>',
  '    </Layout.Footer>',
  '  </Layout>',
  '</Layout>',
].join('\n')

const collapseCode = [
  '<Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">',
  '  <Layout.Sider',
  '    collapsible',
  '    defaultCollapsed',
  '    width={264}',
  '    collapsedWidth={72}',
  '    theme="dark"',
  '    footer="Auto save every 24s"',
  '  >',
  '    <div className="grid gap-2">',
  '      {["Overview", "Reports", "Signals", "Members"].map((item, index) => (',
  '        <button',
  '          key={item}',
  '          type="button"',
  '          className={[',
  '            "inline-flex min-h-11 items-center justify-center rounded-2xl px-0 text-sm transition duration-200",',
  '            index === 0 ? "bg-base-100/14 font-semibold text-white shadow-sm" : "hover:bg-base-100/10",',
  '          ].join(" ")}',
  '        >',
  '          <span className="inline-grid size-8 place-items-center rounded-xl bg-white/10 text-[11px] font-semibold">',
  '            {item.slice(0, 1)}',
  '          </span>',
  '        </button>',
  '      ))}',
  '    </div>',
  '  </Layout.Sider>',
  '  <Layout>',
  '    <Layout.Header>',
  '      <div>',
  '        <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">',
  '          sider status',
  '        </div>',
  '        <div className="text-lg font-semibold">collapsed</div>',
  '      </div>',
  '      <Badge outline>defaultCollapsed</Badge>',
  '    </Layout.Header>',
  '    <Layout.Content>',
  '      <div className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-100/75 p-5 text-sm leading-6 opacity-80">',
  '        Trigger 会自动驱动 current width、collapsed state 和 footer 排版。需要更细的文案时，可以接 onCollapse。',
  '      </div>',
  '    </Layout.Content>',
  '  </Layout>',
  '</Layout>',
].join('\n')

const customTriggerCode = [
  '<Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">',
  '  <Layout.Sider',
  '    collapsible',
  '    width={256}',
  '    theme="light"',
  '    trigger={({ collapsed, below }) => (',
  '      <Layout.Trigger className="border-primary/20 bg-primary text-primary-content">',
  '        <span>{collapsed ? "Open rail" : "Focus mode"}</span>',
  '        <span className="opacity-70">{below ? "mobile" : "desktop"}</span>',
  '      </Layout.Trigger>',
  '    )}',
  '  >',
  '    <div className="space-y-4">',
  '      <div>',
  '        <div className="text-xs uppercase tracking-[0.24em] text-base-content/50">review</div>',
  '        <div className="mt-2 text-lg font-semibold">Design critique</div>',
  '      </div>',
  '      <div className="grid gap-2">',
  '        {["Tokens", "Spacing", "Voice", "QA"].map(item => (',
  '          <div key={item} className="rounded-xl bg-base-200/75 px-3 py-2 text-sm">',
  '            {item}',
  '          </div>',
  '        ))}',
  '      </div>',
  '    </div>',
  '  </Layout.Sider>',
  '  <Layout>',
  '    <Layout.Header>',
  '      <div className="text-lg font-semibold">Custom trigger shell</div>',
  '    </Layout.Header>',
  '    <Layout.Content>',
  '      <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/75 p-5 text-sm leading-6 opacity-80">',
  '        当你想把 trigger 做成 CTA、chip 或者把断点状态一起露出时，直接用函数式 trigger 就够了。',
  '      </div>',
  '    </Layout.Content>',
  '  </Layout>',
  '</Layout>',
].join('\n')

const responsiveCode = [
  '<Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">',
  '  <Layout.Sider',
  '    collapsible',
  '    breakpoint="lg"',
  '    collapsedWidth={0}',
  '    width={240}',
  '    theme="dark"',
  '    onBreakpoint={broken => console.log("breakpoint", broken)}',
  '    onCollapse={(collapsed, type) => console.log("collapse", collapsed, type)}',
  '  >',
  '    <div className="flex flex-1 flex-col gap-3">',
  '      <div className="space-y-1">',
  '        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-55">',
  '          workspace',
  '        </div>',
  '        <div className="text-lg font-semibold leading-none">Rue Console</div>',
  '        <div className="text-sm opacity-70">Stable branch / ap-southeast-1</div>',
  '      </div>',
  '      <div className="grid gap-2">',
  '        {["Overview", "Reports", "Signals", "Members"].map((item, index) => (',
  '          <button',
  '            key={item}',
  '            type="button"',
  '            className={[',
  '              "inline-flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm transition duration-200",',
  '              index === 0 ? "bg-base-100/14 font-semibold text-white shadow-sm" : "hover:bg-base-100/10",',
  '            ].join(" ")}',
  '          >',
  '            <span className="inline-grid size-8 place-items-center rounded-xl bg-white/10 text-[11px] font-semibold">',
  '              {item.slice(0, 1)}',
  '            </span>',
  '            <span className="truncate">{item}</span>',
  '          </button>',
  '        ))}',
  '      </div>',
  '    </div>',
  '  </Layout.Sider>',
  '  <Layout>',
  '    <Layout.Header>',
  '      <div>',
  '        <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">',
  '          responsive',
  '        </div>',
  '        <div className="text-lg font-semibold">desktop</div>',
  '      </div>',
  '      <span className="badge badge-outline">expanded</span>',
  '    </Layout.Header>',
  '    <Layout.Content>',
  '      <div className="grid gap-4 md:grid-cols-2">',
  '        <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">',
  '          <div className="text-sm font-semibold">Try narrow viewport</div>',
  '          <div className="mt-2 text-sm opacity-75">',
  '            In browser, shrinking below lg collapses the rail to zero width and leaves a floating trigger.',
  '          </div>',
  '        </div>',
  '        <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">',
  '          <div className="text-sm font-semibold">Callbacks included</div>',
  '          <div className="mt-2 text-sm opacity-75">',
  '            onBreakpoint and onCollapse stay separate, keeping breakpoint and collapse callbacks separate.',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </Layout.Content>',
  '  </Layout>',
  '</Layout>',
].join('\n')

const nestedCode = [
  '<Layout hasSider>',
  '  <Layout.Sider width={220}>Primary nav</Layout.Sider>',
  '  <Layout>',
  '    <Layout.Header>Command Center</Layout.Header>',
  '    <Layout hasSider>',
  '      <Layout.Content>Main canvas</Layout.Content>',
  '      <Layout.Sider width={280} theme="dark">Activity rail</Layout.Sider>',
  '    </Layout>',
  '    <Layout.Footer>Footer</Layout.Footer>',
  '  </Layout>',
  '</Layout>',
].join('\n')

const renderPrimaryNav = (collapsed = false) => (
  <div className="flex flex-1 flex-col gap-3">
    <div className={collapsed ? 'hidden' : 'space-y-1'}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-55">
        workspace
      </div>
      <div className="text-lg font-semibold leading-none">Rue Console</div>
      <div className="text-sm opacity-70">Stable branch / ap-southeast-1</div>
    </div>
    <div className="grid gap-2">
      {menuItems.map((item, index) => (
        <button
          key={item}
          type="button"
          className={[
            'inline-flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm transition duration-200',
            index === 0
              ? 'bg-base-100/14 font-semibold text-white shadow-sm'
              : 'hover:bg-base-100/10',
            collapsed ? 'justify-center px-0' : '',
          ].join(' ')}
        >
          <span className="inline-grid size-8 place-items-center rounded-xl bg-white/10 text-[11px] font-semibold">
            {item.slice(0, 1)}
          </span>
          {collapsed ? null : <span className="truncate">{item}</span>}
        </button>
      ))}
    </div>
  </div>
)

const renderOpsRail = () => (
  <div className="grid gap-3">
    <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
        release
      </div>
      <div className="mt-2 text-2xl font-semibold">v0.0.39</div>
      <div className="mt-2 text-sm leading-6 text-base-content/70">
        148 checks passed, 3 docs pending approval.
      </div>
    </div>
    <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/75 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
        Ops queue
      </div>
      <div className="grid gap-2">
        {opsItems.map(item => (
          <div
            key={item}
            className="flex items-center justify-between rounded-xl bg-base-200/70 px-3 py-2 text-sm"
          >
            <span>{item}</span>
            <Badge outline>{item.length + 2}</Badge>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const syncTextContent = (element: HTMLElement | null, value: string) => {
  if (element) {
    element.textContent = value
  }
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

const LayoutPage: FC = () => {
  const tabBasic = ref<PreviewTabMode>('preview')
  const tabShell = ref<PreviewTabMode>('preview')
  const tabCollapse = ref<PreviewTabMode>('preview')
  const tabCustom = ref<PreviewTabMode>('preview')
  const tabResponsive = ref<PreviewTabMode>('preview')
  const tabNested = ref<PreviewTabMode>('preview')

  const collapsedInfo = ref('ready')
  const responsiveInfo = ref('desktop')
  const responsiveCollapse = ref('expanded')
  let collapseStatusElement: HTMLElement | null = null
  let responsiveStatusElement: HTMLElement | null = null
  let responsiveCollapseElement: HTMLElement | null = null

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Layout 布局</h1>
        <p className="text-sm mt-3 mb-3">
          Rue 原来没有成体系的 Layout。现在这一组组件把页面骨架、双栏工作台、可折叠侧栏和响应式 rail
          一次补齐，API 覆盖 Layout / Sider 这组核心能力，但视觉仍然沿用 Rue 现在的 柔和面板、圆角和
          utility class 组合方式。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要把导航、工作区、补充信息区和页脚组织成稳定的页面骨架。</li>
          <li>需要一套既能做控制台类双栏壳子，也能做 dashboard 内部嵌套布局的基础容器。</li>
          <li>需要侧栏支持收起、零宽触发器和响应式 breakpoint，而不是自己拼一层 Flex 状态机。</li>
        </ul>

        <h2>推荐用法</h2>

        <PreviewBlock
          title="Basic structure"
          summary="最小可用壳子：Header、Content、Footer 三段式结构直接开箱。"
          tab={tabBasic}
          preview={() => (
            <Layout className="rounded-[2rem] bg-base-200/45 p-4" data-testid="layout-basic-root">
              <Layout.Header data-testid="layout-basic-header">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">
                    header
                  </div>
                  <div className="text-lg font-semibold">Project launch board</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <Badge outline>live</Badge>
                  <Badge outline>beta</Badge>
                </div>
              </Layout.Header>
              <Layout.Content>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-base-300/70 bg-primary/8 p-4">
                    <div className="text-sm font-semibold">Content</div>
                    <div className="mt-2 text-sm opacity-70">
                      Use content as the main canvas for dashboards, docs and editors.
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/70 p-4 md:col-span-2">
                    <div className="text-sm font-semibold">Fluid workspace</div>
                    <div className="mt-2 text-sm opacity-70">
                      The default panel style already carries radius, border and soft depth.
                    </div>
                  </div>
                </div>
              </Layout.Content>
              <Layout.Footer>
                <span>Updated 2 minutes ago</span>
                <span className="ml-auto">6 services healthy</span>
              </Layout.Footer>
            </Layout>
          )}
          code={basicCode}
        />

        <PreviewBlock
          title="Workspace shell"
          summary="典型控制台骨架：左侧导航、顶部命令区、主画布和页脚消息条。"
          tab={tabShell}
          preview={() => (
            <Layout
              hasSider
              className="rounded-[2rem] bg-base-200/45 p-4"
              data-testid="layout-shell-root"
            >
              <Layout.Sider
                width={248}
                theme="dark"
                footer="12 agents online"
                data-testid="layout-shell-sider"
              >
                {renderPrimaryNav(false)}
              </Layout.Sider>
              <Layout>
                <Layout.Header>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">
                      command center
                    </div>
                    <div className="text-lg font-semibold">Growth cockpit</div>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button className="btn-sm">Share</Button>
                    <Button className="btn-primary btn-sm">Deploy</Button>
                  </div>
                </Layout.Header>
                <Layout.Content>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.24em] opacity-50">ARR</div>
                        <div className="mt-3 text-3xl font-semibold">¥ 4.2M</div>
                        <div className="mt-2 text-sm opacity-70">
                          Renewal stayed above 91% for six weeks.
                        </div>
                      </div>
                      <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.24em] opacity-50">
                          Activation
                        </div>
                        <div className="mt-3 text-3xl font-semibold">68%</div>
                        <div className="mt-2 text-sm opacity-70">
                          Onboarding friction is now concentrated in payment setup.
                        </div>
                      </div>
                      <div className="rounded-[1.35rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm md:col-span-2">
                        <div className="text-sm font-semibold">Content canvas</div>
                        <div className="mt-2 text-sm leading-6 opacity-75">
                          Place your charts, editors or boards here. Layout only handles the page
                          skeleton; the canvas remains fully composable.
                        </div>
                      </div>
                    </div>
                    {renderOpsRail()}
                  </div>
                </Layout.Content>
                <Layout.Footer>
                  <span>Queue latency 28 ms</span>
                  <span className="ml-auto">SLA 99.98%</span>
                </Layout.Footer>
              </Layout>
            </Layout>
          )}
          code={shellCode}
        />

        <PreviewBlock
          title="Collapsible sider"
          summary="Sider 直接自带折叠状态，无需在业务层额外拼宽度与 trigger。"
          tab={tabCollapse}
          preview={() => (
            <Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">
              <Layout.Sider
                collapsible
                defaultCollapsed
                width={264}
                collapsedWidth={72}
                theme="dark"
                footer="Auto save every 24s"
                data-testid="layout-collapsible-sider"
                onCollapse={nextCollapsed => {
                  collapsedInfo.value = nextCollapsed ? 'collapsed' : 'expanded'
                  syncTextContent(collapseStatusElement, collapsedInfo.value)
                }}
              >
                {renderPrimaryNav(true)}
              </Layout.Sider>
              <Layout>
                <Layout.Header>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">
                      sider status
                    </div>
                    <div
                      ref={(element: HTMLElement | null) => {
                        collapseStatusElement = element
                        syncTextContent(element, collapsedInfo.value)
                      }}
                      className="text-lg font-semibold"
                      data-testid="layout-collapse-status"
                    >
                      {collapsedInfo.value}
                    </div>
                  </div>
                  <Badge outline>defaultCollapsed</Badge>
                </Layout.Header>
                <Layout.Content>
                  <div className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-100/75 p-5 text-sm leading-6 opacity-80">
                    Trigger 会自动驱动 current width、collapsed state 和 footer
                    排版。需要更细的文案时，可以接 onCollapse。
                  </div>
                </Layout.Content>
              </Layout>
            </Layout>
          )}
          code={collapseCode}
        />

        <PreviewBlock
          title="Custom trigger"
          summary="trigger 可以直接传函数，读取 collapsed / below / zeroWidth / toggle。"
          tab={tabCustom}
          preview={() => (
            <Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">
              <Layout.Sider
                collapsible
                width={256}
                theme="light"
                trigger={({ collapsed, below }: LayoutSiderTriggerRenderMeta) => (
                  <Layout.Trigger className="border-primary/20 bg-primary text-primary-content">
                    <span>{collapsed ? 'Open rail' : 'Focus mode'}</span>
                    <span className="opacity-70">{below ? 'mobile' : 'desktop'}</span>
                  </Layout.Trigger>
                )}
              >
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-base-content/50">
                      review
                    </div>
                    <div className="mt-2 text-lg font-semibold">Design critique</div>
                  </div>
                  <div className="grid gap-2">
                    {['Tokens', 'Spacing', 'Voice', 'QA'].map(item => (
                      <div key={item} className="rounded-xl bg-base-200/75 px-3 py-2 text-sm">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </Layout.Sider>
              <Layout>
                <Layout.Header>
                  <div className="text-lg font-semibold">Custom trigger shell</div>
                </Layout.Header>
                <Layout.Content>
                  <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/75 p-5 text-sm leading-6 opacity-80">
                    当你想把 trigger 做成 CTA、chip 或者把断点状态一起露出时，直接用函数式 trigger
                    就够了。
                  </div>
                </Layout.Content>
              </Layout>
            </Layout>
          )}
          code={customTriggerCode}
        />

        <PreviewBlock
          title="Responsive zero-width sider"
          summary="breakpoint + collapsedWidth=0 会切到零宽模式，并保留浮动 trigger。"
          tab={tabResponsive}
          preview={() => (
            <Layout hasSider className="rounded-[2rem] bg-base-200/45 p-4">
              <Layout.Sider
                collapsible
                breakpoint="lg"
                collapsedWidth={0}
                width={240}
                theme="dark"
                data-testid="layout-responsive-sider"
                onBreakpoint={broken => {
                  responsiveInfo.value = broken ? 'broken' : 'desktop'
                  syncTextContent(responsiveStatusElement, responsiveInfo.value)
                }}
                onCollapse={nextCollapsed => {
                  responsiveCollapse.value = nextCollapsed ? 'collapsed' : 'expanded'
                  syncTextContent(responsiveCollapseElement, responsiveCollapse.value)
                }}
              >
                {renderPrimaryNav(false)}
              </Layout.Sider>
              <Layout>
                <Layout.Header>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">
                      responsive
                    </div>
                    <div
                      ref={(element: HTMLElement | null) => {
                        responsiveStatusElement = element
                        syncTextContent(element, responsiveInfo.value)
                      }}
                      className="text-lg font-semibold"
                      data-testid="layout-breakpoint-status"
                    >
                      {responsiveInfo.value}
                    </div>
                  </div>
                  <span
                    ref={(element: HTMLElement | null) => {
                      responsiveCollapseElement = element
                      syncTextContent(element, responsiveCollapse.value)
                    }}
                    className="badge badge-outline"
                    data-testid="layout-responsive-collapse"
                  >
                    {responsiveCollapse.value}
                  </span>
                </Layout.Header>
                <Layout.Content>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                      <div className="text-sm font-semibold">Try narrow viewport</div>
                      <div className="mt-2 text-sm opacity-75">
                        In browser, shrinking below lg collapses the rail to zero width and leaves a
                        floating trigger.
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                      <div className="text-sm font-semibold">Callbacks included</div>
                      <div className="mt-2 text-sm opacity-75">
                        onBreakpoint and onCollapse stay separate, so breakpoint and collapse state
                        can be handled independently.
                      </div>
                    </div>
                  </div>
                </Layout.Content>
              </Layout>
            </Layout>
          )}
          code={responsiveCode}
        />

        <PreviewBlock
          title="Nested workbench"
          summary="Layout 可以继续嵌套，外层做主导航，内层再拆主内容与活动侧栏。"
          tab={tabNested}
          preview={() => (
            <Layout
              hasSider
              className="rounded-[2rem] bg-base-200/45 p-4"
              data-testid="layout-nested-root"
            >
              <Layout.Sider width={220} theme="dark" footer="Primary navigation">
                {renderPrimaryNav(false)}
              </Layout.Sider>
              <Layout>
                <Layout.Header>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-base-content/45">
                      nested shell
                    </div>
                    <div className="text-lg font-semibold">Incident room</div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Badge outline>P1</Badge>
                    <Badge outline>12 updates</Badge>
                  </div>
                </Layout.Header>
                <Layout hasSider>
                  <Layout.Content>
                    <div className="grid gap-4">
                      <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                        <div className="text-sm font-semibold">Main canvas</div>
                        <div className="mt-2 text-sm opacity-75">
                          Use nested Layout when a page itself still has a main + aside split.
                        </div>
                      </div>
                      <div className="rounded-[1.25rem] border border-base-300/70 bg-base-100/90 p-5 shadow-sm">
                        <div className="text-sm font-semibold">Timeline</div>
                        <div className="mt-2 text-sm opacity-75">
                          The parent shell keeps header and footer stable while the child shell
                          manages inner work zones.
                        </div>
                      </div>
                    </div>
                  </Layout.Content>
                  <Layout.Sider width={280} footer="Ops rail" data-testid="layout-nested-rail">
                    {renderOpsRail()}
                  </Layout.Sider>
                </Layout>
                <Layout.Footer>
                  <span>Escalation room synced</span>
                  <span className="ml-auto">Incident owner: Platform</span>
                </Layout.Footer>
              </Layout>
            </Layout>
          )}
          code={nestedCode}
        />

        <h2 id="layout-api">API</h2>
        <p className="text-sm mt-3 mb-4">
          Layout 的目标不是替代 Flex，而是把页面级骨架和带状态的 Sider 收敛成一套更稳定的基础设施。
          如果只是做局部排版，继续用 Flex / Grid；如果要组织页面结构、导航和补充侧栏，就切到
          Layout。
        </p>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default LayoutPage
