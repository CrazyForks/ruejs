import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { Navbar, Tabs } from '@rue-js/design'
import { renderDesignPreview } from './preview-test-gate'

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
      {tab.value === 'preview' ? (
        renderDesignPreview(title, preview)
      ) : (
        <Code className="mt-2" lang="tsx" code={code} />
      )}
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

const MenuIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="inline-block h-5 w-5 stroke-current"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 6h16M4 12h16M4 18h16"
      ></path>
    </svg>
  )
}

const MoreIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="inline-block h-5 w-5 stroke-current"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
      ></path>
    </svg>
  )
}

const SearchIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="inline-block h-4 w-4 stroke-current"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m21 21-4.35-4.35"
      ></path>
      <circle cx="11" cy="11" r="6" strokeWidth="2"></circle>
    </svg>
  )
}

const BellIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="inline-block h-4 w-4 stroke-current"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M14.857 17.082a23.848 23.848 0 0 1-5.714 0M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
      ></path>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13.73 21a2 2 0 0 1-3.46 0"
      ></path>
    </svg>
  )
}

const BrandMark: FC<{ label?: string }> = ({ label = 'R' }) => {
  return (
    <span className="inline-grid h-8 w-8 place-items-center rounded-box bg-primary text-primary-content text-sm font-bold shadow-sm">
      {label}
    </span>
  )
}

const rootApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签，例如 div、header、nav',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'brand',
    description: '推荐模式下的品牌区内容，会落在 start 区前面',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'start / center / end',
    description: '推荐模式下的三个语义插槽',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'actions',
    description: '推荐模式下的操作区内容，会落在 end 区最后',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '数据驱动写法；通过 placement 分发到 start、center、end',
    type: 'NavbarItem[]',
    defaultValue: '-',
  },
  {
    prop: 'startProps / centerProps / endProps',
    description: '推荐模式下传给三个布局区的属性',
    type: 'Omit<NavbarSectionProps, "children" | "placement">',
    defaultValue: '-',
  },
  {
    prop: 'wrap',
    description: '允许根节点换行，适合搜索框或操作区较多的场景',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'sticky',
    description: '为根节点追加 sticky 头部定位类',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'bordered',
    description: '为根节点追加底边框',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'children',
    description: '经典组合模式；传入后优先按 children 渲染',
    type: 'any',
    defaultValue: '-',
  },
]

const sectionApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定布局区标签',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'align',
    description: '控制区块内部对齐',
    type: `'start' | 'center' | 'end' | 'between'`,
    defaultValue: '根据 placement 自动推导',
  },
  {
    prop: 'grow',
    description: '让布局区占据更多可用宽度',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'wrap',
    description: '允许区块内部换行',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'className',
    description: '追加到 navbar-start / center / end 的类名',
    type: 'string',
    defaultValue: '-',
  },
]

const itemApiRows: ApiRow[] = [
  {
    prop: 'placement',
    description: '仅 items 数组使用，控制内容落在哪个区域',
    type: `'start' | 'center' | 'end'`,
    defaultValue: `'start'`,
  },
  {
    prop: 'as',
    description: '指定数据项或 Navbar.Item 的标签',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'content',
    description: '数据驱动模式下的内容；等价于 children',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'grow',
    description: '让单个项目在所在区块内扩展',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'className',
    description: '追加到内层 inline-flex 包裹节点的类名',
    type: 'string',
    defaultValue: '-',
  },
]

const NavbarPage: FC = () => {
  const tabRecommended = ref<TabMode>('preview')
  const tabItems = ref<TabMode>('preview')
  const tabLayout = ref<TabMode>('preview')
  const tabTitleOnly = ref<TabMode>('preview')
  const tabTitleAndIcon = ref<TabMode>('preview')
  const tabThreePart = ref<TabMode>('preview')
  const tabMenu = ref<TabMode>('preview')
  const tabSearch = ref<TabMode>('preview')

  const workspaceItems = [
    {
      key: 'overview',
      placement: 'center' as const,
      content: <button className="btn btn-ghost btn-sm">Overview</button>,
    },
    {
      key: 'docs',
      placement: 'center' as const,
      content: <button className="btn btn-ghost btn-sm">Docs</button>,
    },
    {
      key: 'pricing',
      placement: 'center' as const,
      content: <button className="btn btn-ghost btn-sm">Pricing</button>,
    },
    {
      key: 'status',
      placement: 'end' as const,
      content: <div className="badge badge-outline badge-success">Online</div>,
    },
    {
      key: 'notify',
      placement: 'end' as const,
      content: (
        <button className="btn btn-ghost btn-circle btn-sm" aria-label="通知">
          <BellIcon />
        </button>
      ),
    },
  ]

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Navbar 导航栏</h1>
        <p className="text-sm mt-3 mb-3">
          Navbar 仍然保持 Rue 当前的视觉基础和 daisyUI
          的布局骨架，但补齐了更适合真实项目的语义插槽、 数据驱动项和布局控制能力。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要一个轻量的头部布局容器，用来放品牌、导航入口、搜索框和用户操作。</li>
          <li>希望保留 Rue 当前的视觉风格，但把常见头部结构改成更好复用的 API。</li>
          <li>既要支持快速搭建推荐用法，也要兼容原来的 children + Start/Center/End 手写布局。</li>
        </ul>

        <ExampleBlock
          title="推荐用法：语义插槽"
          summary="用 brand、center、actions 描述最常见的头部结构；布局细节交给 startProps 和 endProps。"
          tab={tabRecommended}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Navbar
                  className="rounded-box bg-base-100"
                  bordered
                  brand={
                    <a className="btn btn-ghost gap-3 px-2 text-lg normal-case">
                      <BrandMark />
                      Rue Console
                    </a>
                  }
                  center={
                    <div className="hidden items-center gap-1 lg:flex">
                      <button className="btn btn-ghost btn-sm">Overview</button>
                      <button className="btn btn-ghost btn-sm btn-active">Projects</button>
                      <button className="btn btn-ghost btn-sm">Deployments</button>
                      <button className="btn btn-ghost btn-sm">Analytics</button>
                    </div>
                  }
                  actions={
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost btn-sm">Docs</button>
                      <button className="btn btn-primary btn-sm">New Project</button>
                    </div>
                  }
                  startProps={{ className: 'gap-2' }}
                  endProps={{ className: 'gap-2' }}
                  data-testid="navbar-recommended"
                />
              </div>
            </div>
          )}
          code={`<Navbar
  className="rounded-box bg-base-100"
  bordered
  brand={
    <a className="btn btn-ghost gap-3 px-2 text-lg normal-case">
      <BrandMark />
      Rue Console
    </a>
  }
  center={
    <div className="hidden lg:flex items-center gap-1">
      <button className="btn btn-ghost btn-sm">Overview</button>
      <button className="btn btn-ghost btn-sm btn-active">Projects</button>
      <button className="btn btn-ghost btn-sm">Deployments</button>
    </div>
  }
  actions={
    <div className="flex items-center gap-2">
      <button className="btn btn-ghost btn-sm">Docs</button>
      <button className="btn btn-primary btn-sm">New Project</button>
    </div>
  }
  startProps={{ className: 'gap-2' }}
  endProps={{ className: 'gap-2' }}
/>`}
        />

        <ExampleBlock
          title="数据驱动导航项"
          summary="当中间菜单和右侧状态来自配置或接口时，用 items 比手写结构更容易维护。"
          tab={tabItems}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Navbar
                  className="rounded-box bg-base-100"
                  brand={
                    <a className="btn btn-ghost gap-3 px-2 text-lg normal-case">
                      <BrandMark label="W" />
                      Workspace
                    </a>
                  }
                  items={workspaceItems}
                  actions={<button className="btn btn-primary btn-sm">Invite</button>}
                  centerProps={{ className: 'hidden md:flex gap-1' }}
                  endProps={{ className: 'gap-2' }}
                  data-testid="navbar-items"
                />
              </div>
            </div>
          )}
          code={`const items = [
  { key: 'overview', placement: 'center', content: <button className="btn btn-ghost btn-sm">Overview</button> },
  { key: 'docs', placement: 'center', content: <button className="btn btn-ghost btn-sm">Docs</button> },
  { key: 'status', placement: 'end', content: <div className="badge badge-outline badge-success">Online</div> },
]

<Navbar
  brand={<a className="btn btn-ghost text-lg">Workspace</a>}
  items={items}
  actions={<button className="btn btn-primary btn-sm">Invite</button>}
  centerProps={{ className: 'hidden md:flex gap-1' }}
  endProps={{ className: 'gap-2' }}
/>`}
        />

        <ExampleBlock
          title="根节点与布局控制"
          summary="支持 header 根节点、换行和区块对齐，适合内容更密集的工作台头部。"
          tab={tabLayout}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Navbar
                  as="header"
                  wrap
                  bordered
                  className="rounded-box bg-base-100 px-4 py-2"
                  brand={
                    <a className="btn btn-ghost gap-3 px-2 text-lg normal-case">
                      <BrandMark />
                      Rue Docs
                    </a>
                  }
                  start={<div className="badge badge-outline">v2.4</div>}
                  center={
                    <label className="input input-bordered hidden w-full max-w-md items-center gap-2 md:flex">
                      <SearchIcon />
                      <input type="text" className="grow" placeholder="Search docs" />
                    </label>
                  }
                  actions={
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost btn-sm">Changelog</button>
                      <button className="btn btn-neutral btn-sm">Feedback</button>
                    </div>
                  }
                  startProps={{ className: 'w-auto flex-none items-center gap-2' }}
                  centerProps={{
                    grow: true,
                    className:
                      'order-3 basis-full justify-start pt-2 md:order-none md:basis-auto md:pt-0 md:px-6',
                  }}
                  endProps={{ className: 'w-auto flex-none items-center gap-2' }}
                  data-testid="navbar-layout"
                />
              </div>
            </div>
          )}
          code={`<Navbar
  as="header"
  wrap
  bordered
  className="rounded-box bg-base-100 px-4 py-2"
  brand={<a className="btn btn-ghost text-lg">Rue Docs</a>}
  start={<div className="badge badge-outline">v2.4</div>}
  center={
    <label className="input input-bordered hidden w-full max-w-md items-center gap-2 md:flex">
      <SearchIcon />
      <input type="text" className="grow" placeholder="Search docs" />
    </label>
  }
  actions={
    <div className="flex items-center gap-2">
      <button className="btn btn-ghost btn-sm">Changelog</button>
      <button className="btn btn-neutral btn-sm">Feedback</button>
    </div>
  }
  startProps={{ className: 'w-auto flex-none items-center gap-2' }}
  centerProps={{
    grow: true,
    className: 'order-3 basis-full justify-start pt-2 md:order-none md:basis-auto md:pt-0 md:px-6',
  }}
  endProps={{ className: 'w-auto flex-none items-center gap-2' }}
/>`}
        />

        <h2>经典 demo</h2>
        <p>
          下面这几组示例保留了原有写法，只做了页面重组，方便继续对照 Start / Center / End
          的经典组合方式。
        </p>

        <ExampleBlock
          title="仅标题"
          summary="最简单的 navbar，用 root 直接承载内容。"
          tab={tabTitleOnly}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Navbar className="bg-base-100 shadow-sm" data-testid="navbar-title-only">
                  <button className="btn btn-ghost text-xl">daisyUI</button>
                </Navbar>
              </div>
            </div>
          )}
          code={`<Navbar className="bg-base-100 shadow-sm">
  <button className="btn btn-ghost text-xl">daisyUI</button>
</Navbar>`}
        />

        <ExampleBlock
          title="标题与图标"
          summary="保留经典的 Start + End 组合。"
          tab={tabTitleAndIcon}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Navbar className="bg-base-100 shadow-sm" data-testid="navbar-title-icon">
                  <Navbar.Start>
                    <button className="btn btn-ghost text-xl">daisyUI</button>
                  </Navbar.Start>
                  <Navbar.End>
                    <button className="btn btn-square btn-ghost">
                      <MoreIcon />
                    </button>
                  </Navbar.End>
                </Navbar>
              </div>
            </div>
          )}
          code={`<Navbar className="bg-base-100 shadow-sm">
  <Navbar.Start>
    <button className="btn btn-ghost text-xl">daisyUI</button>
  </Navbar.Start>
  <Navbar.End>
    <button className="btn btn-square btn-ghost">
      <MoreIcon />
    </button>
  </Navbar.End>
</Navbar>`}
        />

        <ExampleBlock
          title="三段式布局"
          summary="中间标题 + 两侧图标，是最标准的三栏头部。"
          tab={tabThreePart}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Navbar className="bg-base-100 shadow-sm" data-testid="navbar-three-part">
                  <Navbar.Start>
                    <button className="btn btn-square btn-ghost">
                      <MenuIcon />
                    </button>
                  </Navbar.Start>
                  <Navbar.Center>
                    <button className="btn btn-ghost text-xl">daisyUI</button>
                  </Navbar.Center>
                  <Navbar.End>
                    <button className="btn btn-square btn-ghost">
                      <MoreIcon />
                    </button>
                  </Navbar.End>
                </Navbar>
              </div>
            </div>
          )}
          code={`<Navbar className="bg-base-100 shadow-sm">
  <Navbar.Start>
    <button className="btn btn-square btn-ghost">
      <MenuIcon />
    </button>
  </Navbar.Start>
  <Navbar.Center>
    <button className="btn btn-ghost text-xl">daisyUI</button>
  </Navbar.Center>
  <Navbar.End>
    <button className="btn btn-square btn-ghost">
      <MoreIcon />
    </button>
  </Navbar.End>
</Navbar>`}
        />

        <ExampleBlock
          title="菜单与子菜单"
          summary="继续保留菜单容器和 details 子菜单的经典演示。"
          tab={tabMenu}
          preview={() => (
            <div className="card bg-base-100 shadow-sm mb-32">
              <div className="card-body">
                <Navbar className="bg-base-100 shadow-sm" data-testid="navbar-menu-demo">
                  <Navbar.Start>
                    <button className="btn btn-ghost text-xl">daisyUI</button>
                  </Navbar.Start>
                  <Navbar.End>
                    <ul className="menu menu-horizontal items-center gap-1 px-1">
                      <li>
                        <button className="h-10 min-h-10 items-center">Link</button>
                      </li>
                      <li>
                        <details>
                          <summary className="h-10 min-h-10 items-center">Parent</summary>
                          <ul className="bg-base-100 rounded-t-none p-2">
                            <li>
                              <button>Link 1</button>
                            </li>
                            <li>
                              <button>Link 2</button>
                            </li>
                          </ul>
                        </details>
                      </li>
                    </ul>
                  </Navbar.End>
                </Navbar>
              </div>
            </div>
          )}
          code={`<Navbar className="bg-base-100 shadow-sm">
  <Navbar.Start>
    <button className="btn btn-ghost text-xl">daisyUI</button>
  </Navbar.Start>
  <Navbar.End>
    <ul className="menu menu-horizontal items-center gap-1 px-1">
      <li><button className="h-10 min-h-10 items-center">Link</button></li>
      <li>
        <details>
          <summary className="h-10 min-h-10 items-center">Parent</summary>
          <ul className="bg-base-100 rounded-t-none p-2">
            <li><button>Link 1</button></li>
            <li><button>Link 2</button></li>
          </ul>
        </details>
      </li>
    </ul>
  </Navbar.End>
</Navbar>`}
        />

        <ExampleBlock
          title="搜索框与头像下拉"
          summary="保留搜索、头像和下拉菜单混排的经典结构。"
          tab={tabSearch}
          preview={() => (
            <div className="card bg-base-100 shadow-sm mb-32">
              <div className="card-body">
                <Navbar className="bg-base-100 shadow-sm" data-testid="navbar-search-demo">
                  <Navbar.Start>
                    <button className="btn btn-ghost text-xl">daisyUI</button>
                  </Navbar.Start>
                  <Navbar.End className="gap-2">
                    <input
                      type="text"
                      placeholder="Search"
                      className="input input-bordered w-24 md:w-auto"
                    />
                    <div className="dropdown dropdown-end">
                      <div tabIndex="0" role="button" className="btn btn-ghost btn-circle avatar">
                        <div className="w-10 rounded-full">
                          <img
                            alt="Tailwind CSS Navbar component"
                            src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                          />
                        </div>
                      </div>
                      <ul
                        tabIndex="-1"
                        className="mt-3 z-1 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
                      >
                        <li>
                          <button className="justify-between">
                            Profile
                            <span className="badge">New</span>
                          </button>
                        </li>
                        <li>
                          <button>Settings</button>
                        </li>
                        <li>
                          <button>Logout</button>
                        </li>
                      </ul>
                    </div>
                  </Navbar.End>
                </Navbar>
              </div>
            </div>
          )}
          code={`<Navbar className="bg-base-100 shadow-sm">
  <Navbar.Start>
    <button className="btn btn-ghost text-xl">daisyUI</button>
  </Navbar.Start>
  <Navbar.End className="gap-2">
    <input type="text" placeholder="Search" className="input input-bordered w-24 md:w-auto" />
    <div className="dropdown dropdown-end">
      <div tabIndex="0" role="button" className="btn btn-ghost btn-circle avatar">
        <div className="w-10 rounded-full">
          <img alt="Tailwind CSS Navbar component" src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" />
        </div>
      </div>
      <ul tabIndex="-1" className="mt-3 z-1 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
        <li>
          <button className="justify-between">
            Profile
            <span className="badge">New</span>
          </button>
        </li>
        <li><button>Settings</button></li>
        <li><button>Logout</button></li>
      </ul>
    </div>
  </Navbar.End>
</Navbar>`}
        />

        <h2 id="navbar-api">API</h2>
        <p>Navbar 现在同时支持推荐的语义插槽模式，以及原有的组合模式。</p>

        <h3>Navbar</h3>
        <ApiTable rows={rootApiRows} />

        <h3>Navbar.Start / Navbar.Center / Navbar.End / Navbar.Section</h3>
        <ApiTable rows={sectionApiRows} />

        <h3>Navbar.Item / items[]</h3>
        <ApiTable rows={itemApiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">双模式说明</h3>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <code>children + Navbar.Start/Center/End</code>: 适合完全手写布局，兼容旧 demo。
            </div>
            <div>
              <code>brand / start / center / end / actions / items</code>:
              适合抽象成复用头部或通过配置生成导航结构。
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候选推荐模式，什么时候继续手写 children？</h3>
        <p>
          如果页面头部结构在多个页面之间重复，或者导航项来自配置，优先用语义插槽和{' '}
          <code>items</code>。 如果当前头部结构非常自由，包含复杂的
          dropdown、menu、搜索表单，继续手写
          <code>children + Navbar.Start/Center/End</code> 会更直接。
        </p>

        <h3>children 和 items 同时传时谁优先？</h3>
        <p>
          当前实现会优先渲染 <code>children</code>。这样可以保证旧代码迁移时不被新属性打断，
          也能让组合模式保持完全可控。
        </p>

        <h3>sticky 和 bordered 是强样式能力吗？</h3>
        <p>
          不是。它们只是补一层常用布局类，仍然遵循 Rue
          当前的视觉基底；更细的背景、阴影、圆角和响应式布局， 依然建议通过 <code>className</code>{' '}
          和区块 props 来组合。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default NavbarPage
