import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Badge, Indicator, Input, Status, Tabs } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
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

const stockImage = 'https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp'
const avatarImage = 'https://img.daisyui.com/images/profile/demo/batperson@192.webp'

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

const indicatorApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定容器标签，默认输出 div',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'item',
    description: '单个快捷角标内容，适合最常见的一个 overlay 场景',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'itemProps',
    description: '配合 item 使用的 Indicator.Item 属性透传',
    type: 'Omit<IndicatorItemProps, children>',
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '多角标数据驱动写法，内部会自动展开为多个 Indicator.Item',
    type: 'IndicatorItemConfig[]',
    defaultValue: '-',
  },
  {
    prop: 'style',
    description: '容器样式，保持原生 style 透传',
    type: 'Record<string, any> | string',
    defaultValue: '-',
  },
]

const indicatorItemApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定角标根节点标签，默认输出 span',
    type: 'any',
    defaultValue: `'span'`,
  },
  {
    prop: 'className',
    description: '追加到 indicator-item 上的视觉类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'horizontal',
    description: '水平定位，显式传入时优先级高于 placement',
    type: `'start' | 'center' | 'end'`,
    defaultValue: '-',
  },
  {
    prop: 'offset',
    description: '在基础 anchor 基础上微调角标位置，格式为 [x, y]',
    type: '[number | string, number | string]',
    defaultValue: '-',
  },
  {
    prop: 'placement',
    description: '组合式定位写法，例如 top-start、middle-center、bottom-end',
    type: 'IndicatorPlacement',
    defaultValue: '-',
  },
  {
    prop: 'style',
    description: '原生 style 透传；offset 会通过 CSS 变量补充到最终节点',
    type: 'Record<string, any> | string',
    defaultValue: '-',
  },
  {
    prop: 'vertical',
    description: '垂直定位，显式传入时优先级高于 placement',
    type: `'top' | 'middle' | 'bottom'`,
    defaultValue: '-',
  },
]

const IndicatorPage: FC = () => {
  const tabStatus = ref<TabMode>('preview')
  const tabBadge = ref<TabMode>('preview')
  const tabButton = ref<TabMode>('preview')
  const tabInput = ref<TabMode>('preview')
  const tabCard = ref<TabMode>('preview')
  const tabCenter = ref<TabMode>('preview')
  const tabAvatar = ref<TabMode>('preview')
  const tabTab = ref<TabMode>('preview')
  const tabPlacement = ref<TabMode>('preview')
  const tabShortcut = ref<TabMode>('preview')
  const tabMultiple = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Indicator 指示器</h1>
        <p className="text-sm mt-3 mb-3">
          Indicator 负责把状态点、徽标、按钮或任意轻量信息悬挂到内容边缘。组件展示基础复合写法，
          并提供
          <code> placement </code>、<code> offset </code>，以及 <code> item / items </code>
          这组三件套，方便快速搭角标而不必每次都手写一个 <code>Indicator.Item</code>。
        </p>
        <div className="not-prose grid gap-3 rounded-box border border-base-300 bg-base-100 p-4 md:grid-cols-3">
          <div className="rounded-box bg-base-200/70 p-4">
            <div className="text-sm font-medium">支持基础用法</div>
            <p className="m-0 mt-2 text-sm text-base-content/70">
              horizontal 和 vertical 仍然可直接使用，基础示例 不需要回退。
            </p>
          </div>
          <div className="rounded-box bg-base-200/70 p-4">
            <div className="text-sm font-medium">快捷模式</div>
            <p className="m-0 mt-2 text-sm text-base-content/70">
              一个角标用 item，多角标用 items，页面模板代码可以明显收缩。
            </p>
          </div>
          <div className="rounded-box bg-base-200/70 p-4">
            <div className="text-sm font-medium">定位更顺手</div>
            <p className="m-0 mt-2 text-sm text-base-content/70">
              placement 负责主定位，offset 负责微调，适合图片、卡片、操作按钮等场景。
            </p>
          </div>
        </div>

        <ExampleBlock
          title="Status indicator"
          summary="最轻量的状态提醒，展示基础复合写法。"
          tab={tabStatus}
          preview={() => (
            <Indicator>
              <Indicator.Item>
                <Status status="success" />
              </Indicator.Item>
              <div className="grid h-32 w-32 place-items-center rounded bg-base-300">content</div>
            </Indicator>
          )}
          code={`<Indicator>\n  <Indicator.Item>\n    <Status status="success" />\n  </Indicator.Item>\n  <div className="grid h-32 w-32 place-items-center rounded bg-base-300">content</div>\n</Indicator>`}
        />

        <ExampleBlock
          title="Badge as indicator"
          summary="把 Badge 挂到内容右上角，是最常见的信息提醒写法。"
          tab={tabBadge}
          preview={() => (
            <Indicator>
              <Indicator.Item>
                <Badge variant="primary">New</Badge>
              </Indicator.Item>
              <div className="grid h-32 w-32 place-items-center rounded bg-base-300">content</div>
            </Indicator>
          )}
          code={`<Indicator>\n  <Indicator.Item>\n    <Badge variant="primary">New</Badge>\n  </Indicator.Item>\n  <div className="grid h-32 w-32 place-items-center rounded bg-base-300">content</div>\n</Indicator>`}
        />

        <ExampleBlock
          title="For button"
          summary="一个角标时可以直接改用 item 快捷模式，不再手写 Indicator.Item。"
          tab={tabButton}
          preview={() => (
            <Indicator
              item={<Badge variant="secondary">12</Badge>}
              itemProps={{ placement: 'top-end' }}
            >
              <button className="btn">Inbox</button>
            </Indicator>
          )}
          code={`<Indicator\n  item={<Badge variant="secondary">12</Badge>}\n  itemProps={{ placement: 'top-end' }}\n>\n  <button className="btn">Inbox</button>\n</Indicator>`}
        />

        <ExampleBlock
          title="For an input"
          summary="表单必填、实验开关等轻提示适合放在输入框边缘。"
          tab={tabInput}
          preview={() => (
            <Indicator>
              <Indicator.Item>
                <Badge>Required</Badge>
              </Indicator.Item>
              <Input placeholder="Your email address" className="input-bordered" />
            </Indicator>
          )}
          code={`<Indicator>\n  <Indicator.Item>\n    <Badge>Required</Badge>\n  </Indicator.Item>\n  <Input placeholder="Your email address" className="input-bordered" />\n</Indicator>`}
        />

        <ExampleBlock
          title="A button as an indicator for a card"
          summary="支持基础的 vertical 写法，适合把操作按钮悬挂在卡片边缘。"
          tab={tabCard}
          preview={() => (
            <Indicator className="mx-10 my-6">
              <Indicator.Item vertical="bottom">
                <button className="btn btn-primary">Apply</button>
              </Indicator.Item>
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title">Job Title</h2>
                  <p>Rerum reiciendis beatae tenetur excepturi</p>
                </div>
              </div>
            </Indicator>
          )}
          code={`<Indicator className="mx-10 my-6">\n  <Indicator.Item vertical="bottom">\n    <button className="btn btn-primary">Apply</button>\n  </Indicator.Item>\n  <div className="card border border-base-300 bg-base-100 shadow-sm">\n    <div className="card-body">\n      <h2 className="card-title">Job Title</h2>\n      <p>Rerum reiciendis beatae tenetur excepturi</p>\n    </div>\n  </div>\n</Indicator>`}
        />

        <ExampleBlock
          title="In center of an image"
          summary="同一条提示覆盖在图片中心时，组合 horizontal 和 vertical 依然最直观。"
          tab={tabCenter}
          preview={() => (
            <Indicator className="max-w-xs">
              <Indicator.Item horizontal="center" vertical="middle" className="badge">
                Only available for Pro users
              </Indicator.Item>
              <img className="rounded" src={stockImage} alt="Indicator centered message" />
            </Indicator>
          )}
          code={`<Indicator className="max-w-xs">\n  <Indicator.Item horizontal="center" vertical="middle" className="badge">\n    Only available for Pro users\n  </Indicator.Item>\n  <img className="rounded" src="${stockImage}" alt="Indicator centered message" />\n</Indicator>`}
        />

        <ExampleBlock
          title="For avatar"
          summary="头像、封面等媒体元素通常更适合搭配短文本或身份标签。"
          tab={tabAvatar}
          preview={() => (
            <Indicator className="avatar">
              <Indicator.Item className="badge badge-secondary">Justice</Indicator.Item>
              <div className="w-20 rounded-lg">
                <img src={avatarImage} alt="Avatar with indicator" />
              </div>
            </Indicator>
          )}
          code={`<Indicator className="avatar">\n  <Indicator.Item className="badge badge-secondary">Justice</Indicator.Item>\n  <div className="w-20 rounded-lg">\n    <img src="${avatarImage}" alt="Avatar with indicator" />\n  </div>\n</Indicator>`}
        />

        <ExampleBlock
          title="For tab"
          summary="在 tab 标题上挂未读数，适合消息、审批和工单等场景。"
          tab={tabTab}
          preview={() => (
            <div className="tabs tabs-lift">
              <button className="tab">Messages</button>
              <button className="indicator tab tab-active">
                Notifications
                <span className="indicator-item badge">8</span>
              </button>
              <button className="tab">Requests</button>
            </div>
          )}
          code={`<div className="tabs tabs-lift">\n  <button className="tab">Messages</button>\n  <button className="indicator tab tab-active">\n    Notifications\n    <span className="indicator-item badge">8</span>\n  </button>\n  <button className="tab">Requests</button>\n</div>`}
        />

        <ExampleBlock
          title="Placement shorthand and offset"
          summary="placement 先给出主定位，再用 offset 做细调，适合视觉需要避让边框或圆角的场景。"
          tab={tabPlacement}
          preview={() => (
            <div className="grid gap-4 md:grid-cols-3">
              <Indicator
                item={<Badge variant="secondary">Start</Badge>}
                itemProps={{ placement: 'top-start', offset: [8, -4] }}
              >
                <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">
                  top-start
                </div>
              </Indicator>
              <Indicator
                item={<Badge variant="accent">Center</Badge>}
                itemProps={{ placement: 'middle-center', offset: [0, 4] }}
              >
                <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">
                  middle-center
                </div>
              </Indicator>
              <Indicator
                item={<Badge variant="warning">End</Badge>}
                itemProps={{ placement: 'bottom-end', offset: [10, 6] }}
              >
                <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">
                  bottom-end
                </div>
              </Indicator>
            </div>
          )}
          code={`<div className="grid gap-4 md:grid-cols-3">\n  <Indicator\n    item={<Badge variant="secondary">Start</Badge>}\n    itemProps={{ placement: 'top-start', offset: [8, -4] }}\n  >\n    <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">top-start</div>\n  </Indicator>\n  <Indicator\n    item={<Badge variant="accent">Center</Badge>}\n    itemProps={{ placement: 'middle-center', offset: [0, 4] }}\n  >\n    <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">middle-center</div>\n  </Indicator>\n  <Indicator\n    item={<Badge variant="warning">End</Badge>}\n    itemProps={{ placement: 'bottom-end', offset: [10, 6] }}\n  >\n    <div className="grid h-24 rounded-xl bg-base-200 place-items-center text-sm">bottom-end</div>\n  </Indicator>\n</div>`}
        />

        <ExampleBlock
          title="Props-driven shorthand"
          summary="常见的一主一辅场景可以完全通过 item 和 itemProps 表达，代码更短，也更适合数据驱动。"
          tab={tabShortcut}
          preview={() => (
            <Indicator
              className="w-full max-w-sm"
              item={<Badge variant="primary">8 pending</Badge>}
              itemProps={{ placement: 'top-end', offset: [12, -6] }}
            >
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">
                      Queue
                    </div>
                    <div className="mt-2 text-lg font-semibold">Build pipeline</div>
                  </div>
                  <p className="m-0 text-sm text-base-content/70">
                    Web hooks, release notes and QA approvals are waiting for merge.
                  </p>
                </div>
              </div>
            </Indicator>
          )}
          code={`<Indicator\n  className="w-full max-w-sm"\n  item={<Badge variant="primary">8 pending</Badge>}\n  itemProps={{ placement: 'top-end', offset: [12, -6] }}\n>\n  <div className="card border border-base-300 bg-base-100 shadow-sm">\n    <div className="card-body gap-3">\n      <div>\n        <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Queue</div>\n        <div className="mt-2 text-lg font-semibold">Build pipeline</div>\n      </div>\n      <p className="m-0 text-sm text-base-content/70">\n        Web hooks, release notes and QA approvals are waiting for merge.\n      </p>\n    </div>\n  </div>\n</Indicator>`}
        />

        <ExampleBlock
          title="Multiple indicators"
          summary="items 适合一个主体上同时悬挂多个提示，比如在线状态和悬挂操作。"
          tab={tabMultiple}
          preview={() => (
            <Indicator
              className="w-full max-w-sm"
              items={[
                {
                  key: 'presence',
                  placement: 'top-start',
                  offset: [6, -4],
                  children: <Status status="success" />,
                },
                {
                  key: 'cta',
                  as: 'div',
                  placement: 'bottom-center',
                  children: <button className="btn btn-primary btn-sm">Apply</button>,
                },
              ]}
            >
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body gap-2">
                  <h3 className="m-0 text-lg font-semibold">Design review board</h3>
                  <p className="m-0 text-sm text-base-content/70">
                    This board keeps the latest reviewer presence and the primary action in one
                    place.
                  </p>
                </div>
              </div>
            </Indicator>
          )}
          code={`<Indicator\n  className="w-full max-w-sm"\n  items={[\n    {\n      key: 'presence',\n      placement: 'top-start',\n      offset: [6, -4],\n      children: <Status status="success" />,\n    },\n    {\n      key: 'cta',\n      as: 'div',\n      placement: 'bottom-center',\n      children: <button className="btn btn-primary btn-sm">Apply</button>,\n    },\n  ]}\n>\n  <div className="card border border-base-300 bg-base-100 shadow-sm">\n    <div className="card-body gap-2">\n      <h3 className="m-0 text-lg font-semibold">Design review board</h3>\n      <p className="m-0 text-sm text-base-content/70">\n        This board keeps the latest reviewer presence and the primary action in one place.\n      </p>\n    </div>\n  </div>\n</Indicator>`}
        />

        <h2 className="mt-10">API</h2>
        <p className="text-sm text-base-content/70">
          Indicator 仍然是一个纯布局组件，不接管 Badge、Status 或 Button 的视觉，只负责悬挂与定位。
        </p>
        <h3>Indicator</h3>
        <ApiTable rows={indicatorApiRows} />
        <h3 className="mt-8">Indicator.Item</h3>
        <ApiTable rows={indicatorItemApiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default IndicatorPage
