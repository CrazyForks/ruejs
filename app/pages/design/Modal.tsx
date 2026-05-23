import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { Button, Modal, Tabs } from '@rue-js/design'

type TabMode = 'preview' | 'code'

interface ExampleBlockProps {
  title: string
  summary: string
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
          <p className="m-0 text-sm opacity-70">{summary}</p>
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

const apiRows: ApiRow[] = [
  {
    prop: 'open',
    description: '受控显隐。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'defaultOpen',
    description: '非受控初始打开状态。',
    type: 'boolean',
    defaultValue: 'false',
  },
  { prop: 'title', description: '标题区域内容。', type: 'any', defaultValue: '-' },
  {
    prop: 'footer',
    description: '自定义 footer；传 `null` 可隐藏；也支持函数包裹默认 footer。',
    type: 'any | (originNode) => any',
    defaultValue: '-',
  },
  {
    prop: 'actions',
    description: '旧版动作区写法，会保留原有“自定义动作 + 默认关闭按钮”行为。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'onOk / onCancel / onClose',
    description: '确认、取消与关闭回调。',
    type: 'function',
    defaultValue: '-',
  },
  {
    prop: 'confirmLoading',
    description: '让默认确认按钮进入 loading 态。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'loading',
    description: '主体切换到骨架占位态，并临时隐藏 footer。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'okText / cancelText / okType',
    description: '默认 footer 的按钮文案与确认按钮类型。',
    type: 'any / any / ButtonType',
    defaultValue: '`确定` / 自动 / `primary`',
  },
  {
    prop: 'width / className',
    description: '设置 modal-box 宽度；`className` 仍直接追加到 box。',
    type: 'string | number / string',
    defaultValue: '-',
  },
  {
    prop: 'rootStyle / wrapClassName / wrapProps / maskClassName / maskStyle',
    description: '分别定制根层、wrapper 和遮罩层；`mask={false}` 时不会渲染遮罩节点。',
    type: 'style / string / object / string / style',
    defaultValue: '-',
  },
  { prop: 'centered', description: '垂直居中。', type: 'boolean', defaultValue: 'false' },
  {
    prop: 'mask / maskClosable / keyboard',
    description: '控制遮罩显示、点击遮罩关闭与 ESC 关闭。',
    type: 'boolean',
    defaultValue: 'true / true / true',
  },
  {
    prop: 'closable / closeIcon',
    description: '右上角关闭按钮与自定义关闭图标。',
    type: 'boolean / any',
    defaultValue: 'true / 默认图标',
  },
  {
    prop: 'forceRender / destroyOnHidden',
    description: '控制关闭后是否保留内容挂载。',
    type: 'boolean / boolean',
    defaultValue: 'false / true',
  },
  {
    prop: 'destroyOnClose / getContainer',
    description: '兼容旧别名，并支持通过 Teleport 把弹层渲染到指定容器。',
    type: 'boolean / string | HTMLElement | (() => HTMLElement) | false',
    defaultValue: '- / false',
  },
  {
    prop: 'bodyClassName / headerClassName / footerClassName',
    description: '分别定制头部、主体、底部区域类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'classNames / styles',
    description: '按语义分区覆盖 root/mask/wrapper/container/box/header/title/body/footer/close。',
    type: 'object',
    defaultValue: '-',
  },
  {
    prop: 'modalRender',
    description: '接管最终弹层节点的二次包裹。',
    type: '(node) => any',
    defaultValue: '-',
  },
  {
    prop: 'afterOpenChange / afterClose',
    description: '显隐变化后的钩子。',
    type: 'function',
    defaultValue: '-',
  },
]

const ModalPage: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabMaskless = ref<TabMode>('preview')
  const tabActions = ref<TabMode>('preview')
  const tabWide = ref<TabMode>('preview')
  const tabAsync = ref<TabMode>('preview')
  const tabFooterRender = ref<TabMode>('preview')
  const tabKeepMounted = ref<TabMode>('preview')

  const basicOpen = ref(false)
  const masklessOpen = ref(false)
  const actionsOpen = ref(false)
  const wideOpen = ref(false)
  const asyncOpen = ref(false)
  const asyncLoading = ref(false)
  const asyncStatus = ref('点击确认按钮后会进入 1.2 秒 loading，并在完成后关闭。')
  const renderOpen = ref(false)
  const guardCount = ref(0)
  const keepMountedOpen = ref(false)

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Modal 模态框</h1>
        <p className="text-sm mt-3 mb-3">
          Modal 现在保持 Rue 自己的视觉风格，同时补齐了更完整的显隐控制、默认
          footer、异步确认、遮罩交互、挂载策略与 root/mask/wrapper 级别的语义化定制能力。
        </p>

        <ExampleBlock
          title="Controlled modal"
          summary="保留原有受控用法：通过 `open` 和 `onClose` 管理显隐，默认 footer 会自动提供关闭按钮。"
          tab={tabBasic}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="primary"
                  className="w-fit"
                  data-testid="modal-basic-open"
                  onClick={() => {
                    basicOpen.value = true
                  }}
                >
                  Open modal
                </Button>
                <p className="text-sm text-base-content/70">
                  点击按钮后会显示受控模态框，并通过默认关闭按钮或右上角关闭图标收起。
                </p>
                <Modal
                  open={basicOpen.value}
                  title="Basic modal"
                  onClose={() => {
                    basicOpen.value = false
                  }}
                >
                  <p className="py-2">Press the close button below to dismiss this modal.</p>
                </Modal>
              </div>
            </div>
          )}
          code={`const basicOpen = ref(false)

<Button color="primary" onClick={() => (basicOpen.value = true)}>
  Open modal
</Button>
<Modal
  open={basicOpen.value}
  title="Basic modal"
  onClose={() => {
    basicOpen.value = false
  }}
>
  <p className="py-2">Press the close button below to dismiss this modal.</p>
</Modal>`}
        />

        <ExampleBlock
          title="Maskless modal and layer hooks"
          summary="`mask={false}` 会真正移除遮罩层；需要精细控制时可继续配合 `rootStyle`、`wrapClassName` 与语义化 `classNames/styles`。"
          tab={tabMaskless}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="warning"
                  className="w-fit"
                  data-testid="modal-maskless-open"
                  onClick={() => {
                    masklessOpen.value = true
                  }}
                >
                  Open without mask
                </Button>
                <p className="text-sm text-base-content/70">
                  当前示例关闭了遮罩视觉，因此背景保持可见，点击外层空白区域也不会触发关闭。
                </p>
                <Modal
                  open={masklessOpen.value}
                  mask={false}
                  width={680}
                  rootStyle={{ backdropFilter: 'blur(2px)' }}
                  wrapClassName="items-end sm:items-center"
                  classNames={{
                    container: 'max-w-3xl',
                    box: 'border border-base-300 shadow-2xl',
                    body: 'space-y-3',
                  }}
                  title="Inspector panel"
                  footer={(_originNode: any, { CancelBtn }: any) => (
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-base-content/60">
                        No mask layer is rendered in this example.
                      </div>
                      <div className="flex justify-end">
                        <CancelBtn>关闭面板</CancelBtn>
                      </div>
                    </div>
                  )}
                  onClose={() => {
                    masklessOpen.value = false
                  }}
                >
                  <div className="rounded-box bg-base-200 p-4 text-sm text-base-content/80">
                    <div className="font-medium">Layer summary</div>
                    <ul className="mt-2 mb-0 list-disc pl-5">
                      <li>`rootStyle` 作用在最外层固定定位节点</li>
                      <li>`wrapClassName` 作用在可滚动的交互 wrapper</li>
                      <li>`classNames.container` 和 `classNames.box` 分别控制容器与面板</li>
                    </ul>
                  </div>
                </Modal>
              </div>
            </div>
          )}
          code={`const masklessOpen = ref(false)

<Modal
  open={masklessOpen.value}
  mask={false}
  width={680}
  rootStyle={{ backdropFilter: 'blur(2px)' }}
  wrapClassName="items-end sm:items-center"
  classNames={{
    container: 'max-w-3xl',
    box: 'border border-base-300 shadow-2xl',
  }}
  footer={(_originNode, { CancelBtn }) => (
    <div className="flex w-full justify-between gap-3">
      <div className="text-sm text-base-content/60">No mask layer is rendered in this example.</div>
      <CancelBtn>关闭面板</CancelBtn>
    </div>
  )}
  onClose={() => {
    masklessOpen.value = false
  }}
>
  <p className="py-2">The mask node is omitted entirely in this example.</p>
</Modal>`}
        />

        <ExampleBlock
          title="Modal with custom actions"
          summary="旧版 `actions` 仍然可用，适合把自定义按钮组插到 footer 里，同时保留默认关闭按钮。"
          tab={tabActions}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="secondary"
                  className="w-fit"
                  data-testid="modal-actions-open"
                  onClick={() => {
                    actionsOpen.value = true
                  }}
                >
                  Review actions
                </Button>
                <p className="text-sm text-base-content/70">
                  可以继续使用 `actions` 兼容旧 demo，同时逐步迁移到新的 `footer` API。
                </p>
                <Modal
                  open={actionsOpen.value}
                  title="Delete this draft?"
                  actions={
                    <div className="join" data-testid="modal-actions-group">
                      <button
                        className="btn join-item btn-ghost"
                        onClick={() => {
                          actionsOpen.value = false
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn join-item btn-error"
                        data-testid="modal-actions-confirm"
                        onClick={() => {
                          actionsOpen.value = false
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  }
                  onClose={() => {
                    actionsOpen.value = false
                  }}
                >
                  <p className="py-2">This action removes the draft from your local workspace.</p>
                </Modal>
              </div>
            </div>
          )}
          code={`const actionsOpen = ref(false)

<Button color="secondary" onClick={() => (actionsOpen.value = true)}>
  Review actions
</Button>
<Modal
  open={actionsOpen.value}
  title="Delete this draft?"
  actions={
    <div className="join">
      <button className="btn join-item btn-ghost" onClick={() => (actionsOpen.value = false)}>
        Cancel
      </button>
      <button className="btn join-item btn-error" onClick={() => (actionsOpen.value = false)}>
        Delete
      </button>
    </div>
  }
  onClose={() => {
    actionsOpen.value = false
  }}
>
  <p className="py-2">This action removes the draft from your local workspace.</p>
</Modal>`}
        />

        <ExampleBlock
          title="Wide modal box"
          summary="原有宽弹层示例保留，同时也可以配合 `width` 使用更偏语义化的尺寸写法。"
          tab={tabWide}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="accent"
                  className="w-fit"
                  data-testid="modal-wide-open"
                  onClick={() => {
                    wideOpen.value = true
                  }}
                >
                  Open wide modal
                </Button>
                <p className="text-sm text-base-content/70">
                  通过 `className` 直接扩展 modal-box 宽度和排版，旧写法完全保留。
                </p>
                <Modal
                  open={wideOpen.value}
                  title="Release summary"
                  className="w-11/12 max-w-5xl"
                  onClose={() => {
                    wideOpen.value = false
                  }}
                >
                  <div className="grid gap-4 py-2 md:grid-cols-2">
                    <div className="rounded-box bg-base-200 p-4">
                      <h3 className="mt-0 text-base font-semibold">Highlights</h3>
                      <p className="mb-0 text-sm text-base-content/70">
                        Routing docs refreshed, design pages expanded, and runtime tests tightened.
                      </p>
                    </div>
                    <div className="rounded-box bg-base-200 p-4">
                      <h3 className="mt-0 text-base font-semibold">Notes</h3>
                      <p className="mb-0 text-sm text-base-content/70">
                        Use modal width utilities on className when the default box is too narrow.
                      </p>
                    </div>
                  </div>
                </Modal>
              </div>
            </div>
          )}
          code={`const wideOpen = ref(false)

<Button color="accent" onClick={() => (wideOpen.value = true)}>
  Open wide modal
</Button>
<Modal
  open={wideOpen.value}
  title="Release summary"
  className="w-11/12 max-w-5xl"
  onClose={() => {
    wideOpen.value = false
  }}
>
  <div className="grid gap-4 py-2 md:grid-cols-2">...</div>
</Modal>`}
        />

        <ExampleBlock
          title="Default footer with async confirm"
          summary="更贴近常见业务弹窗的用法：给 `onOk/onCancel` 和 `confirmLoading` 即可得到默认确认 footer。"
          tab={tabAsync}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="primary"
                  className="w-fit"
                  data-testid="modal-async-open"
                  onClick={() => {
                    asyncStatus.value = '点击确认按钮后会进入 1.2 秒 loading，并在完成后关闭。'
                    asyncOpen.value = true
                  }}
                >
                  Launch publish flow
                </Button>
                <p className="text-sm text-base-content/70">
                  默认 footer 会自动生成取消/确认按钮，并把 `confirmLoading` 映射到确认按钮。
                </p>
                <Modal
                  open={asyncOpen.value}
                  title="Publish this release?"
                  okText="开始发布"
                  cancelText="稍后处理"
                  confirmLoading={asyncLoading.value}
                  onCancel={() => {
                    asyncLoading.value = false
                    asyncOpen.value = false
                  }}
                  onOk={() => {
                    asyncStatus.value = '正在校验变更、生成产物并同步部署状态...'
                    asyncLoading.value = true
                    setTimeout(() => {
                      asyncLoading.value = false
                      asyncOpen.value = false
                      asyncStatus.value = '发布完成，当前版本已经推送到 staging。'
                    }, 1200)
                  }}
                >
                  <div className="space-y-3 py-2">
                    <p className="m-0 text-sm text-base-content/80">{asyncStatus.value}</p>
                    <div className="rounded-box bg-base-200 p-4 text-sm">
                      <div className="font-medium">Release checklist</div>
                      <ul className="mt-2 mb-0 list-disc pl-5">
                        <li>Tag 已创建</li>
                        <li>Changelog 已同步</li>
                        <li>Preview 环境检查通过</li>
                      </ul>
                    </div>
                  </div>
                </Modal>
              </div>
            </div>
          )}
          code={`const asyncOpen = ref(false)
const asyncLoading = ref(false)

<Modal
  open={asyncOpen.value}
  title="Publish this release?"
  okText="开始发布"
  cancelText="稍后处理"
  confirmLoading={asyncLoading.value}
  onCancel={() => {
    asyncLoading.value = false
    asyncOpen.value = false
  }}
  onOk={() => {
    asyncLoading.value = true
    setTimeout(() => {
      asyncLoading.value = false
      asyncOpen.value = false
    }, 1200)
  }}
>
  <p className="py-2">默认 footer 会自动生成取消/确认按钮。</p>
</Modal>`}
        />

        <ExampleBlock
          title="Footer render and centered layout"
          summary="通过 `centered`、`width`、语义化 className 和 `footer(originNode => ...)`，可以在不改动视觉体系的前提下重组结构。"
          tab={tabFooterRender}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="info"
                  className="w-fit"
                  onClick={() => {
                    renderOpen.value = true
                  }}
                >
                  Open settings modal
                </Button>
                <p className="text-sm text-base-content/70">
                  `footer` 支持函数式包裹默认 footer，适合在两端插入说明信息或额外操作。
                </p>
                <Modal
                  open={renderOpen.value}
                  centered
                  width={720}
                  title="Workspace settings"
                  headerClassName="border-b border-base-300 pb-3"
                  bodyClassName="pt-1"
                  footer={(originNode: any) => (
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-base-content/60">
                        Changes are scoped to the current workspace.
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">{originNode}</div>
                    </div>
                  )}
                  okText="保存设置"
                  cancelText="关闭"
                  onCancel={() => {
                    renderOpen.value = false
                  }}
                  onOk={() => {
                    guardCount.value += 1
                    renderOpen.value = false
                  }}
                >
                  <div className="grid gap-4 py-2 md:grid-cols-2">
                    <label className="form-control gap-2">
                      <span className="label-text font-medium">Environment</span>
                      <select className="select select-bordered">
                        <option>Staging</option>
                        <option>Production</option>
                      </select>
                    </label>
                    <label className="form-control gap-2">
                      <span className="label-text font-medium">Deploy channel</span>
                      <select className="select select-bordered">
                        <option>Web</option>
                        <option>Desktop</option>
                      </select>
                    </label>
                  </div>
                  <p className="mb-0 text-sm text-base-content/70">
                    Saved count: {guardCount.value}
                  </p>
                </Modal>
              </div>
            </div>
          )}
          code={`<Modal
  open={renderOpen.value}
  centered
  width={720}
  title="Workspace settings"
  headerClassName="border-b border-base-300 pb-3"
  footer={(originNode: any) => (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="text-sm text-base-content/60">Changes are scoped to the current workspace.</div>
      <div className="flex flex-wrap justify-end gap-2">{originNode}</div>
    </div>
  )}
  okText="保存设置"
  cancelText="关闭"
  onCancel={() => {
    renderOpen.value = false
  }}
  onOk={() => {
    renderOpen.value = false
  }}
>
  <div className="grid gap-4 py-2 md:grid-cols-2">...</div>
</Modal>`}
        />

        <ExampleBlock
          title="Keep mounted content"
          summary="需要在关闭后保留 DOM 状态时，可以开启 `forceRender` + `destroyOnHidden={false}`。"
          tab={tabKeepMounted}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Button
                  color="success"
                  className="w-fit"
                  onClick={() => {
                    keepMountedOpen.value = true
                  }}
                >
                  Open draft modal
                </Button>
                <p className="text-sm text-base-content/70">
                  在文本框里输入内容，关闭后再次打开，未提交的草稿仍会保留。
                </p>
                <Modal
                  open={keepMountedOpen.value}
                  title="Draft note"
                  forceRender
                  destroyOnHidden={false}
                  maskClosable={false}
                  keyboard={false}
                  footer={null}
                  onClose={() => {
                    keepMountedOpen.value = false
                  }}
                >
                  <div className="space-y-3 py-2">
                    <textarea
                      className="textarea textarea-bordered min-h-32 w-full"
                      defaultValue="This textarea keeps its DOM state after the modal is hidden."
                    />
                    <div className="alert alert-info text-sm">
                      这里禁用了遮罩点击和 ESC 关闭，只保留右上角关闭按钮，方便演示 `maskClosable`
                      与 `keyboard`。
                    </div>
                  </div>
                </Modal>
              </div>
            </div>
          )}
          code={`<Modal
  open={keepMountedOpen.value}
  title="Draft note"
  forceRender
  destroyOnHidden={false}
  maskClosable={false}
  keyboard={false}
  footer={null}
  onClose={() => {
    keepMountedOpen.value = false
  }}
>
  <textarea className="textarea textarea-bordered min-h-32 w-full" defaultValue="..." />
</Modal>`}
        />

        <h2 id="modal-api">API</h2>
        <p>以下列出当前设计页覆盖到的主要 `Modal` 能力。</p>
        <ApiTable rows={apiRows} />

        <h2>FAQ</h2>
        <p>
          <strong>什么时候用 `actions`，什么时候用 `footer`？</strong>
          如果你在迁移旧代码，直接继续用 `actions` 即可；新代码优先用 `footer`，它可以完全接管
          footer，也可以用函数包装默认 footer。
        </p>
        <p>
          <strong>`className`、`bodyClassName` 和 `classNames` 怎么选？</strong>
          `className` 仍直接追加到 <code>modal-box</code>；只想改某个区域时优先用
          <code>bodyClassName/headerClassName/footerClassName</code>；需要更细粒度统一配置时再用{' '}
          <code>classNames</code>。
        </p>
        <p>
          <strong>为什么保留 `destroyOnHidden` 默认关闭即卸载？</strong>
          这是为了兼容 Rue 当前组件行为；当你确实需要保留 DOM 状态时，再显式开启
          <code>forceRender</code> 与 <code>destroyOnHidden=&#123;false&#125;</code>。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default ModalPage
