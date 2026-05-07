import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Breadcrumbs } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const ApiTable: FC<{ title: string; rows: ApiRow[] }> = ({ title, rows }) => {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-4 py-3 text-sm font-semibold">{title}</div>
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

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5V20h14V9.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20v-6h4v6" />
  </svg>
)

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
)

const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
  </svg>
)

const SparkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 18h.01M19 18h.01M12 21h.01" />
  </svg>
)

const breadcrumbApiRows: ApiRow[] = [
  { prop: 'children', description: '保留旧的组合式写法，适合手工控制节点结构', type: 'any', defaultValue: '-' },
  { prop: 'className', description: '附加到根节点的类名', type: 'string', defaultValue: '-' },
  { prop: 'dropdownIcon', description: 'items 模式下菜单触发器的自定义图标', type: 'any', defaultValue: 'Rue arrow' },
  { prop: 'itemRender', description: '自定义 items 模式下每一项的渲染结果', type: '(route, params, routes, paths, href) => any', defaultValue: '-' },
  { prop: 'items', description: '推荐入口，支持 title/label、path、menu、separator item', type: 'ReadonlyArray<BreadcrumbsDataItem>', defaultValue: '-' },
  { prop: 'params', description: '用于替换 path 中的 :param 占位符', type: 'Record<string, string | number | boolean | null | undefined>', defaultValue: '{}' },
  { prop: 'routes', description: 'items 的兼容别名，能力一致', type: 'ReadonlyArray<BreadcrumbsDataItem>', defaultValue: '-' },
  { prop: 'separator', description: 'items 模式的全局分隔符，默认保持 Rue 的箭头风格', type: 'any', defaultValue: 'Rue arrow' },
]

const itemApiRows: ApiRow[] = [
  { prop: 'className', description: '应用到当前 li 的类名', type: 'string', defaultValue: '-' },
  { prop: 'current', description: '标记当前项，默认渲染为文本并附带 aria-current', type: 'boolean', defaultValue: 'false' },
  { prop: 'disabled', description: '禁用当前项的交互', type: 'boolean', defaultValue: 'false' },
  { prop: 'href', description: '直接指定链接地址', type: 'string', defaultValue: '-' },
  { prop: 'icon', description: '前置图标', type: 'any', defaultValue: '-' },
  { prop: 'label / title', description: '显示内容，title 为推荐字段，label 兼容旧写法', type: 'any', defaultValue: '-' },
  { prop: 'linkClassName', description: '应用到当前链接或文本节点的类名', type: 'string', defaultValue: '-' },
  { prop: 'menu', description: '快捷切换菜单，内部复用 Rue Dropdown', type: '{ items?: ReadonlyArray<BreadcrumbsMenuItem> }', defaultValue: '-' },
  { prop: 'onClick', description: '点击事件；无 href 时会渲染为 button', type: '(event: MouseEvent) => void', defaultValue: '-' },
  { prop: 'path', description: '按层级拼接路径，适合和 params、itemRender 一起用', type: 'string', defaultValue: '-' },
  { prop: 'type', description: '当值为 separator 时，这一项会作为独立分隔符配置', type: 'separator', defaultValue: '-' },
]

const itemComponentRows: ApiRow[] = [
  { prop: 'children', description: '手工传入内容，保留旧 demo 的组织方式', type: 'any', defaultValue: '-' },
  { prop: 'current', description: '将该项渲染为当前项文本', type: 'boolean', defaultValue: 'false' },
  { prop: 'href', description: '组合模式下直接输出链接', type: 'string', defaultValue: '-' },
  { prop: 'icon', description: '组合模式下的前置图标', type: 'any', defaultValue: '-' },
  { prop: 'linkClassName', description: '应用到链接、文本或按钮节点', type: 'string', defaultValue: '-' },
  { prop: 'menu', description: '为当前项附加一个快捷菜单', type: '{ items?: ReadonlyArray<BreadcrumbsMenuItem> }', defaultValue: '-' },
]

const basicCode = [
  "import { Breadcrumbs } from '@rue-js/design'",
  '',
  '<Breadcrumbs className="text-sm">',
  '  <Breadcrumbs.Item href="/home">Home</Breadcrumbs.Item>',
  '  <Breadcrumbs.Item href="/docs">Documents</Breadcrumbs.Item>',
  '  <Breadcrumbs.Item current>Add Document</Breadcrumbs.Item>',
  '</Breadcrumbs>',
].join('\n')

const iconCode = [
  '<Breadcrumbs className="text-sm">',
  '  <Breadcrumbs.Item href="/workspace" icon={<HomeIcon />}>',
  '    Workspace',
  '  </Breadcrumbs.Item>',
  '  <Breadcrumbs.Item href="/workspace/assets" icon={<FolderIcon />}>',
  '    Assets',
  '  </Breadcrumbs.Item>',
  '  <Breadcrumbs.Item current icon={<FileIcon />}>',
  '    Hero Banner',
  '  </Breadcrumbs.Item>',
  '</Breadcrumbs>',
].join('\n')

const itemsCode = [
  '<Breadcrumbs',
  '  className="text-sm"',
  '  items={[',
  '    {',
  '      label: "Home",',
  '      href: "/home",',
  '      icon: <HomeIcon />,',
  '      linkClassName: "text-base-content/80 hover:text-base-content",',
  '    },',
  '    {',
  '      label: "Documents",',
  '      href: "/docs",',
  '      icon: <FolderIcon />,',
  '      linkClassName: "text-base-content/80 hover:text-base-content",',
  '    },',
  '    {',
  '      title: "Breadcrumbs",',
  '      icon: <FileIcon />,',
  '      current: true,',
  '    },',
  '  ]}',
  '/>',
].join('\n')

const itemRenderCode = [
  '<Breadcrumbs',
  '  className="text-sm"',
  '  params={{ workspaceId: "apollo-studio" }}',
  '  items={[',
  '    { path: "workspaces", title: "Workspaces" },',
  '    { path: ":workspaceId", title: "Apollo Studio" },',
  '    { path: "deployments", title: "Deployments" },',
  '    { title: "Preview" },',
  '  ]}',
  '  itemRender={(route, params, routes, paths, href) => {',
  '    const isLast = route.title === routes[routes.length - 1]?.title',
  '    const label = `${route.title} (${params.workspaceId})`',
  '',
  '    if (isLast) {',
  '      return <span className="font-medium text-base-content">{label}</span>',
  '    }',
  '',
  '    return (',
  '      <a href={href} className="text-base-content/75 hover:text-base-content">',
  '        {label}',
  '        <span className="text-xs opacity-50">/{paths.join("/")}</span>',
  '      </a>',
  '    )',
  '  }}',
  '/>',
].join('\n')

const separatorMenuCode = [
  '<Breadcrumbs',
  '  className="text-sm"',
  '  separator="/"',
  '  dropdownIcon={<span className="text-[10px] font-semibold">v</span>}',
  '  items={[',
  '    { title: "Control Center", href: "/control", icon: <GridIcon /> },',
  '    { type: "separator", separator: "·" },',
  '    {',
  '      title: "Content",',
  '      href: "/content",',
  '      icon: <FolderIcon />,',
  '      menu: {',
  '        items: [',
  '          { key: "overview", title: "Overview", href: "/content" },',
  '          { key: "drafts", title: "Drafts" },',
  '          { key: "scheduled", title: "Scheduled" },',
  '        ],',
  '      },',
  '    },',
  '    { title: "Breadcrumbs", icon: <FileIcon />, current: true },',
  '  ]}',
  '/>',
].join('\n')

const maxWidthCode = [
  '<Breadcrumbs className="max-w-xs text-sm">',
  '  <Breadcrumbs.Item>Workspace / Growth / Launch / Sprint 03</Breadcrumbs.Item>',
  '  <Breadcrumbs.Item>Assets / Homepage / Experiment</Breadcrumbs.Item>',
  '  <Breadcrumbs.Item current>Hero Banner / Copy Review</Breadcrumbs.Item>',
  '</Breadcrumbs>',
].join('\n')

const BreadcrumbsDemo: FC = () => {
  const tabBasic = ref<PreviewTabMode>('preview')
  const tabIcons = ref<PreviewTabMode>('preview')
  const tabItems = ref<PreviewTabMode>('preview')
  const tabRender = ref<PreviewTabMode>('preview')
  const tabMenu = ref<PreviewTabMode>('preview')
  const tabMaxWidth = ref<PreviewTabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Breadcrumbs 面包屑</h1>
        <p className="text-sm mt-3 mb-3">Breadcrumbs 用来表达当前位置、可回退层级和相邻页面的快速切换。</p>
        <div className="text-sm">
          <a href="https://daisyui.com/components/breadcrumbs/" target="_blank">
            查看 Breadcrumbs 静态样式
          </a>
        </div>

        <div className="not-prose my-6 rounded-box border border-base-300 bg-base-100 p-5">
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-primary badge-soft">推荐 items</span>
            <span className="badge badge-secondary badge-soft">支持 itemRender</span>
            <span className="badge badge-accent badge-soft">支持 menu</span>
            <span className="badge badge-neutral badge-soft">保留 children</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-base-content/75">
            <li>默认分隔符继续保持 Rue 当前的箭头视觉，不照搬 ant-design 的斜杠样式。</li>
            <li>推荐使用 items：可组合 title、label、path、params、current、menu 和独立 separator item。</li>
            <li>children 与 Breadcrumbs.Item 仍然保留，适合在设计稿里手工控制单个节点。</li>
          </ul>
        </div>

        <PreviewBlock
          title="基础组合"
          tab={tabBasic}
          preview={() => (
            <Breadcrumbs className="text-sm">
              <Breadcrumbs.Item href="/home">Home</Breadcrumbs.Item>
              <Breadcrumbs.Item href="/docs">Documents</Breadcrumbs.Item>
              <Breadcrumbs.Item current>Add Document</Breadcrumbs.Item>
            </Breadcrumbs>
          )}
          code={basicCode}
        />

        <PreviewBlock
          title="组合模式带图标"
          tab={tabIcons}
          preview={() => (
            <Breadcrumbs className="text-sm">
              <Breadcrumbs.Item href="/workspace" icon={<HomeIcon />}>
                Workspace
              </Breadcrumbs.Item>
              <Breadcrumbs.Item href="/workspace/assets" icon={<FolderIcon />}>
                Assets
              </Breadcrumbs.Item>
              <Breadcrumbs.Item current icon={<FileIcon />}>
                Hero Banner
              </Breadcrumbs.Item>
            </Breadcrumbs>
          )}
          code={iconCode}
        />

        <PreviewBlock
          title="从 items 渲染"
          tab={tabItems}
          preview={() => (
            <Breadcrumbs
              className="text-sm"
              items={[
                {
                  label: 'Home',
                  href: '/home',
                  icon: <HomeIcon />,
                  linkClassName: 'text-base-content/80 hover:text-base-content',
                },
                {
                  label: 'Documents',
                  href: '/docs',
                  icon: <FolderIcon />,
                  linkClassName: 'text-base-content/80 hover:text-base-content',
                },
                {
                  title: 'Breadcrumbs',
                  icon: <FileIcon />,
                  current: true,
                },
              ]}
            />
          )}
          code={itemsCode}
        />

        <PreviewBlock
          title="path、params 与 itemRender"
          tab={tabRender}
          preview={() => (
            <div className="space-y-3">
              <Breadcrumbs
                className="text-sm"
                params={{ workspaceId: 'apollo-studio' }}
                items={[
                  { path: 'workspaces', title: 'Workspaces' },
                  { path: ':workspaceId', title: 'Apollo Studio' },
                  { path: 'deployments', title: 'Deployments' },
                  { title: 'Preview' },
                ]}
                itemRender={(route, params, routes, paths, href) => {
                  const isLast = route.title === routes[routes.length - 1]?.title
                  const label = `${route.title} (${params.workspaceId})`

                  if (isLast) {
                    return <span className="font-medium text-base-content">{label}</span>
                  }

                  return (
                    <a href={href} className="text-base-content/75 hover:text-base-content">
                      {label}
                      <span className="text-xs opacity-50">/{paths.join('/')}</span>
                    </a>
                  )
                }}
              />
              <p className="m-0 text-sm text-base-content/60">itemRender 会拿到当前 route、params、完整 routes、当前 paths 和解析后的 href。</p>
            </div>
          )}
          code={itemRenderCode}
        />

        <PreviewBlock
          title="自定义 separator 与快捷菜单"
          tab={tabMenu}
          preview={() => (
            <Breadcrumbs
              className="text-sm"
              separator="/"
              dropdownIcon={<span className="text-[10px] font-semibold">v</span>}
              items={[
                { title: 'Control Center', href: '/control', icon: <GridIcon /> },
                { type: 'separator', separator: '·' },
                {
                  title: 'Content',
                  href: '/content',
                  icon: <FolderIcon />,
                  menu: {
                    items: [
                      { key: 'overview', title: 'Overview', href: '/content' },
                      { key: 'drafts', title: 'Drafts' },
                      { key: 'scheduled', title: 'Scheduled' },
                    ],
                  },
                },
                { title: 'Breadcrumbs', icon: <SparkIcon />, current: true },
              ]}
            />
          )}
          code={separatorMenuCode}
        />

        <PreviewBlock
          title="超长路径滚动"
          tab={tabMaxWidth}
          preview={() => (
            <Breadcrumbs className="max-w-xs text-sm">
              <Breadcrumbs.Item>Workspace / Growth / Launch / Sprint 03</Breadcrumbs.Item>
              <Breadcrumbs.Item>Assets / Homepage / Experiment</Breadcrumbs.Item>
              <Breadcrumbs.Item current>Hero Banner / Copy Review</Breadcrumbs.Item>
            </Breadcrumbs>
          )}
          code={maxWidthCode}
        />

        <div className="not-prose my-10 space-y-4">
          <div>
            <h2 className="m-0 text-lg font-semibold"># API</h2>
            <p className="mt-2 text-sm text-base-content/65">items 是推荐入口；Breadcrumbs.Item 更适合保留原有手工结构时逐步迁移。</p>
          </div>
          <ApiTable title="Breadcrumbs" rows={breadcrumbApiRows} />
          <ApiTable title="BreadcrumbsDataItem / separator item" rows={itemApiRows} />
          <ApiTable title="Breadcrumbs.Item" rows={itemComponentRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default BreadcrumbsDemo
