import { ref, type FC } from '@rue-js/rue'
import { Tabs, Toast } from '@rue-js/design'
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

interface PlacementExample {
  label: string
  placement:
    | 'top-start'
    | 'top'
    | 'top-end'
    | 'middle-start'
    | 'center'
    | 'middle-end'
    | 'bottom-start'
    | 'bottom'
    | 'bottom-end'
  tone: 'info' | 'success' | 'warning'
}

interface ToastItemDemo {
  type: 'info' | 'success' | 'warning' | 'error' | 'loading'
  title: string
  description: string
}

interface ToastVariantDemo {
  label: string
  variant: 'soft' | 'outline' | 'solid'
  type: 'info' | 'success' | 'warning'
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
        onChange={(key: string) => (tab.value = key as TabMode)}
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

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (children == null) {
    return []
  }
  return [children]
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

const DemoSurface: FC<{ minHeight?: string; children?: any }> = ({
  minHeight = '14rem',
  children,
}) => {
  return (
    <div className="not-prose rounded-[1.5rem] border border-base-300 bg-base-200/50 p-4 shadow-sm">
      <div
        className="relative overflow-hidden rounded-[1.25rem] border border-base-300 bg-base-100/90"
        style={{ minHeight }}
      >
        {toChildArray(children)}
      </div>
    </div>
  )
}

const toastToneClassMap: Record<PlacementExample['tone'], string> = {
  info: 'alert alert-info',
  success: 'alert alert-success',
  warning: 'alert alert-warning',
}

const placementExamples: PlacementExample[] = [
  { label: 'top-start', placement: 'top-start', tone: 'info' },
  { label: 'top', placement: 'top', tone: 'success' },
  { label: 'top-end', placement: 'top-end', tone: 'warning' },
  { label: 'middle-start', placement: 'middle-start', tone: 'warning' },
  { label: 'center', placement: 'center', tone: 'info' },
  { label: 'middle-end', placement: 'middle-end', tone: 'success' },
  { label: 'bottom-start', placement: 'bottom-start', tone: 'success' },
  { label: 'bottom', placement: 'bottom', tone: 'warning' },
  { label: 'bottom-end', placement: 'bottom-end', tone: 'info' },
]

const toastItemExamples: ToastItemDemo[] = [
  {
    type: 'info',
    title: 'Draft synced',
    description: 'The latest edits have been pushed to your shared workspace.',
  },
  {
    type: 'success',
    title: 'Publish complete',
    description: 'The release has been deployed to production without errors.',
  },
  {
    type: 'warning',
    title: 'Review pending',
    description: 'Two comments still need acknowledgement before merge.',
  },
  {
    type: 'error',
    title: 'Backup failed',
    description: 'Storage quota is exhausted. Free up space and retry.',
  },
  {
    type: 'loading',
    title: 'Indexing content',
    description: 'Toast.Item can keep a loading state visible until your flow completes.',
  },
]

const toastVariantExamples: ToastVariantDemo[] = [
  { label: 'Soft', variant: 'soft', type: 'info' },
  { label: 'Outline', variant: 'outline', type: 'warning' },
  { label: 'Solid', variant: 'solid', type: 'success' },
]

const rootApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签，例如 div、section',
    type: 'any',
    defaultValue: "'div'",
  },
  {
    prop: 'gap',
    description: '控制多个 toast 项之间的间距，支持数字和任意 CSS 长度',
    type: 'number | string',
    defaultValue: '-',
  },
  {
    prop: 'horizontal',
    description: '横向位置；传入后会覆盖 placement 推导出的横轴结果',
    type: "'start' | 'center' | 'end'",
    defaultValue: '-',
  },
  {
    prop: 'inset',
    description: '容器内边距，可统一设置，也可通过 x / y 分别控制横向与纵向留白',
    type: 'number | string | { x?: number | string; y?: number | string }',
    defaultValue: '-',
  },
  {
    prop: 'placement',
    description: '语义化九宫格定位别名，例如 top-end、center、bottom-start',
    type: "'top-start' | 'top' | 'top-center' | 'top-end' | 'middle-start' | 'middle' | 'middle-center' | 'middle-end' | 'bottom-start' | 'bottom' | 'bottom-center' | 'bottom-end' | 'start' | 'center' | 'end'",
    defaultValue: '-',
  },
  {
    prop: 'reverse',
    description: '反转容器内子项顺序，适合最新消息置顶或横向倒序布局',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'stack',
    description: '堆叠方向，默认维持竖向通知流，也可以切到横向条带式布局',
    type: "'vertical' | 'horizontal'",
    defaultValue: "'vertical'",
  },
  {
    prop: 'vertical',
    description: '纵向位置；传入后会覆盖 placement 推导出的纵轴结果',
    type: "'top' | 'middle' | 'bottom'",
    defaultValue: '-',
  },
  {
    prop: 'zIndex',
    description: '调整容器层级，适合叠放在抽屉、卡片或 mock 页面之上',
    type: 'number | string',
    defaultValue: '-',
  },
]

const itemApiRows: ApiRow[] = [
  {
    prop: 'action',
    description: '右侧操作区，可放按钮、链接或状态标签',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'as',
    description: '单条提示的根节点标签，默认 div',
    type: 'any',
    defaultValue: "'div'",
  },
  {
    prop: 'closable',
    description: '显示内建关闭按钮，并在点击时触发 onClose / onOpenChange',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'closeIcon',
    description: '自定义关闭按钮图标',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'defaultOpen',
    description: '非受控初始显示状态',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'description',
    description: '说明文案，适合放补充上下文或后续动作提示',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'duration',
    description: '自动关闭时长，单位秒；传入 0 或 null 时保持常驻',
    type: 'number | null',
    defaultValue: '-',
  },
  {
    prop: 'icon',
    description: '自定义图标；未传时会根据 type 渲染默认图标',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'onClose',
    description: '关闭完成时触发，meta.source 会标记 close 或 timeout',
    type: '(meta) => void',
    defaultValue: '-',
  },
  {
    prop: 'onOpenChange',
    description: '显示状态变化回调，适合受控关闭或外部同步状态',
    type: '(open, meta) => void',
    defaultValue: '-',
  },
  {
    prop: 'open',
    description: '受控显示状态',
    type: 'boolean',
    defaultValue: '-',
  },
  {
    prop: 'pauseOnHover',
    description: '自动关闭时鼠标移入是否暂停剩余计时',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'showIcon',
    description: '关闭默认图标渲染，只保持文字和操作区',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'title',
    description: '标题文案，适合放主状态结论',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'type',
    description: '语义类型，会同时影响默认图标、无障碍语义和视觉配色',
    type: "'neutral' | 'info' | 'success' | 'warning' | 'error' | 'loading'",
    defaultValue: "'neutral'",
  },
  {
    prop: 'variant',
    description: '提示外观风格，适合在页面层级里调节存在感',
    type: "'soft' | 'solid' | 'outline'",
    defaultValue: "'soft'",
  },
]

const messageHookRows: ApiRow[] = [
  {
    prop: 'placement / inset / gap / zIndex',
    description: '复用 Toast 根容器的定位能力；默认消息层会挂到全局页面层，而不是被当前 box 裁住。',
    type: 'ToastProps 子集',
    defaultValue: "placement = 'top'",
  },
  {
    prop: 'getContainer',
    description:
      '控制消息挂载位置；默认挂到 document.body，传 false 时退回到 contextHolder 所在的局部 box。',
    type: 'string | HTMLElement | (() => HTMLElement) | false',
    defaultValue: 'document.body',
  },
  {
    prop: 'maxCount',
    description: '限制同时显示的消息数量；超过时会自动挤掉最早的一条。',
    type: 'number',
    defaultValue: '-',
  },
  {
    prop: 'duration',
    description: '给 hook 创建出来的消息设定默认自动关闭时长，单条消息可覆盖。',
    type: 'number | null',
    defaultValue: '3',
  },
  {
    prop: 'variant / closable / pauseOnHover / showIcon / type',
    description: '为整个 message 通道设定单条提示的默认外观和行为。',
    type: 'ToastItemProps 子集',
    defaultValue: '-',
  },
]

const messageMethodRows: ApiRow[] = [
  {
    prop: 'open(config)',
    description: '创建一条消息；返回关闭函数，适合临时保存句柄。',
    type: '(config: ToastMessageConfig) => () => void',
    defaultValue: '-',
  },
  {
    prop: 'success / info / warning / error',
    description: '带语义类型的快捷方法，等价于 open({ type, ...config })。',
    type: '(config) => () => void',
    defaultValue: '-',
  },
  {
    prop: 'loading(config)',
    description: '加载态快捷方法，默认会把 duration 设为 0，便于后续按 key 更新。',
    type: '(config) => () => void',
    defaultValue: '-',
  },
  {
    prop: 'destroy(key?)',
    description: '销毁指定 key 的消息；不传 key 时清空当前 holder 里的全部消息。',
    type: '(key?: string | number) => void',
    defaultValue: '-',
  },
]

const messageConfigRows: ApiRow[] = [
  {
    prop: 'key',
    description: '稳定标识；重复调用同一个 key 时会原位更新，而不是追加新消息。',
    type: 'string | number',
    defaultValue: '自动生成',
  },
  {
    prop: 'content',
    description: 'message 风格的主内容；未传 children 时会直接渲染在正文区域。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '需要 richer JSX 时可直接传 children，优先级高于 content。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: '其余字段',
    description: 'type、duration、action、closable、variant、icon、onClose 等字段复用 Toast.Item。',
    type: 'ToastItemProps 子集',
    defaultValue: '-',
  },
]

const ControlledAutoClosePreview: FC = () => {
  const [messageApi, contextHolder] = Toast.useMessage({
    getContainer: false,
    className: 'absolute',
    placement: 'top-end',
    inset: { x: 16, y: 56 },
    gap: 12,
    maxCount: 3,
    duration: 4,
    closable: true,
    pauseOnHover: true,
  })

  return (
    <DemoSurface minHeight="19rem">
      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            messageApi.open({
              key: 'deployment-paused',
              type: 'warning',
              title: 'Deployment paused',
              description:
                'This one is controlled by messageApi.destroy(key), so it can stay linked to page state.',
              duration: 0,
              closable: true,
            })
          }}
        >
          重新显示受控提示
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            messageApi.destroy('deployment-paused')
          }}
        >
          关闭受控提示
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => {
            messageApi.success({
              key: `auto-save-${Date.now()}`,
              title: 'Auto saved',
              description: 'This toast closes itself after 4 seconds and pauses while hovered.',
              duration: 4,
            })
          }}
        >
          重新触发自动关闭
        </button>
      </div>
      {contextHolder}
      <div className="absolute inset-x-4 bottom-4 rounded-[1rem] border border-base-300 bg-base-100/85 px-4 py-3 text-sm text-base-content/70 backdrop-blur">
        受控提示使用固定 key 反复显示或销毁；自动关闭提示每次生成新 key，悬停时会暂停倒计时。
      </div>
    </DemoSurface>
  )
}

const controlledAutoCloseCode = `const [messageApi, contextHolder] = Toast.useMessage({
  getContainer: false,
  className: 'absolute',
  placement: 'top-end',
  inset: { x: 16, y: 56 },
  gap: 12,
  maxCount: 3,
  duration: 4,
  closable: true,
  pauseOnHover: true,
})

const showControlledToast = () => {
  messageApi.open({
    key: 'deployment-paused',
    type: 'warning',
    title: 'Deployment paused',
    description: 'This one is controlled by messageApi.destroy(key).',
    duration: 0,
    closable: true,
  })
}

const closeControlledToast = () => {
  messageApi.destroy('deployment-paused')
}

const showAutoCloseToast = () => {
  messageApi.success({
    key: \`auto-save-\${Date.now()}\`,
    title: 'Auto saved',
    description: 'This toast closes itself after 4 seconds and pauses while hovered.',
    duration: 4,
  })
}

<div className="relative min-h-80 overflow-hidden rounded-box border border-base-300">
  <button type="button" onClick={showControlledToast}>
    重新显示受控提示
  </button>
  <button type="button" onClick={closeControlledToast}>
    关闭受控提示
  </button>
  <button type="button" onClick={showAutoCloseToast}>
    重新触发自动关闭
  </button>

  {contextHolder}
</div>`

const ToastPage: FC = () => {
  const tabs = {
    items: ref<TabMode>('preview'),
    variants: ref<TabMode>('preview'),
    controlled: ref<TabMode>('preview'),
    useMessage: ref<TabMode>('preview'),
    compound: ref<TabMode>('preview'),
    basic: ref<TabMode>('preview'),
    placements: ref<TabMode>('preview'),
    stacked: ref<TabMode>('preview'),
    inset: ref<TabMode>('preview'),
    host: ref<TabMode>('preview'),
  }

  const [messageApi, messageContextHolder] = Toast.useMessage({
    placement: 'top-end',
    inset: { x: 16, y: 68 },
    gap: 12,
    maxCount: 3,
    zIndex: 80,
  })

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Toast 轻提示</h1>
        <p className="text-sm mt-3 mb-3">
          Toast 根容器负责 placement、stack 和 inset。根容器仍然负责 placement、stack 和 inset，
          但单条提示现在可以直接用 <code>Toast.Item</code> 写出接近 message
          的反馈体验：类型、标题、说明、
          操作区、关闭按钮、自动关闭与悬停暂停都已经补充；现在还可以像常见 message API 一样通过
          <code>Toast.useMessage()</code> 拿到 <code>messageApi</code> 和 <code>contextHolder</code>
          ， 在业务按钮、异步流程和页面局部容器里直接按 key
          推送、更新和销毁消息；默认会弹到全局页面层， 只有显式传{' '}
          <code>getContainer=&#123;false&#125;</code> 时才会留在当前 box 里，同时仍然使用 Rue
          自己更轻、更靠近页面内容的视觉语气。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要在页面局部提供轻量反馈，但不想上升成全局通知系统。</li>
          <li>
            希望像 message 一样直接描述成功、失败、加载、警告这些状态，又想保持更贴近 Rue
            的视觉风格。
          </li>
          <li>希望在事件处理函数里直接触发反馈，而不是先把消息数组提升到页面状态。</li>
          <li>
            既要支持基础的 alert 容器写法，也想在业务里直接拿到可关闭、可自动关闭的单条提示能力。
          </li>
        </ul>

        <ExampleBlock
          title="Message-like items"
          summary="最直接的语义用法：把内容交给 Toast.Item，根容器继续负责定位和堆叠。"
          tab={tabs.items}
          preview={() => (
            <DemoSurface minHeight="19rem">
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-info/10 via-success/10 to-warning/10" />
              <Toast className="absolute" placement="top-end" inset={{ x: 16, y: 16 }} gap={12}>
                {toastItemExamples.slice(0, 3).map(item => (
                  <Toast.Item
                    key={item.title}
                    type={item.type}
                    title={item.title}
                    description={item.description}
                    closable
                  />
                ))}
              </Toast>
            </DemoSurface>
          )}
          code={`<Toast className="absolute" placement="top-end" inset={{ x: 16, y: 16 }} gap={12}>
  <Toast.Item
    type="info"
    title="Draft synced"
    description="The latest edits have been pushed to your shared workspace."
    closable
  />
  <Toast.Item
    type="success"
    title="Publish complete"
    description="The release has been deployed to production without errors."
    closable
  />
</Toast>`}
        />

        <ExampleBlock
          title="Variants and actions"
          summary="soft、outline、solid 三种外观可以调整存在感，action 让单条提示具备 message 之上的轻量操作能力。"
          tab={tabs.variants}
          preview={() => (
            <div className="grid gap-4">
              {toastVariantExamples.map(item => (
                <DemoSurface key={item.label} minHeight="11rem">
                  <div className="absolute left-3 top-3 badge badge-ghost badge-sm">
                    {item.label}
                  </div>
                  <Toast className="absolute" placement="bottom-start" inset={{ x: 12, y: 12 }}>
                    <Toast.Item
                      type={item.type}
                      variant={item.variant}
                      title={`${item.label} feedback`}
                      description="Toast.Item 可以直接承载业务动作。"
                      action={
                        <button type="button" className="btn btn-xs btn-ghost">
                          Undo
                        </button>
                      }
                      closable
                    />
                  </Toast>
                </DemoSurface>
              ))}
            </div>
          )}
          code={`<Toast.Item
  type="warning"
  variant="outline"
  title="Changes saved locally"
  description="Sync is waiting for your confirmation."
  action={<button type="button" className="btn btn-xs btn-ghost">Undo</button>}
  closable
/>`}
        />

        <ExampleBlock
          title="Controlled and auto close"
          summary="受控关闭适合和外部状态联动；自动关闭则提供了 message 常用的短时反馈体验，并支持 hover 暂停。"
          tab={tabs.controlled}
          preview={() => <ControlledAutoClosePreview />}
          code={controlledAutoCloseCode}
        />

        <ExampleBlock
          title="Toast.useMessage"
          summary="参考常见 message hook 的形态：把 contextHolder 放进页面即可，真正的消息默认弹到全局页面层；如果你要留在当前 box，再显式传 getContainer={false}。"
          tab={tabs.useMessage}
          preview={() => (
            <DemoSurface minHeight="18rem">
              <div className="absolute inset-x-4 top-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    messageApi.open({
                      type: 'success',
                      content:
                        'This is a prompt message for success, and it will disappear in 10 seconds',
                      duration: 10,
                    })
                  }}
                >
                  10 秒成功提示
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    messageApi.loading({
                      key: 'publish',
                      content: 'Publishing changes to preview...',
                    })
                  }}
                >
                  开始发布
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    messageApi.open({
                      key: 'publish',
                      type: 'success',
                      content: 'Published to preview. Same key, same slot, new state.',
                      duration: 2,
                    })
                  }}
                >
                  更新同 key
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    messageApi.destroy()
                  }}
                >
                  清空当前消息
                </button>
              </div>
              {messageContextHolder}
            </DemoSurface>
          )}
          code={`const [messageApi, contextHolder] = Toast.useMessage({
  placement: 'top-end',
  inset: { x: 16, y: 68 },
  gap: 12,
  maxCount: 3,
  zIndex: 80,
})

<button
  type="button"
  onClick={() => {
    messageApi.open({
      type: 'success',
      content: 'This is a prompt message for success, and it will disappear in 10 seconds',
      duration: 10,
    })
  }}
>
  Customized display duration
</button>

<button
  type="button"
  onClick={() => {
    messageApi.loading({
      key: 'publish',
      content: 'Publishing changes to preview...',
    })
  }}
>
  Start publish
</button>

<button
  type="button"
  onClick={() => {
    messageApi.open({
      key: 'publish',
      type: 'success',
      content: 'Published to preview. Same key, same slot, new state.',
      duration: 2,
    })
  }}
>
  Update same key
</button>

<button type="button" onClick={() => messageApi.destroy()}>
  Clear all
</button>

{contextHolder}

// keep it inside the current box instead:
// Toast.useMessage({
//   getContainer: false,
//   className: 'absolute',
//   placement: 'bottom-start',
//   inset: { x: 12, y: 12 },
// })`}
        />

        <ExampleBlock
          title="Compound composition"
          summary="如果标题、说明和操作区需要更强定制，可以直接使用 compound 子组件自己拼装。"
          tab={tabs.compound}
          preview={() => (
            <DemoSurface minHeight="15rem">
              <Toast className="absolute" placement="bottom-start" inset={{ x: 16, y: 16 }}>
                <Toast.Item variant="outline" className="max-w-md">
                  <Toast.Icon className="bg-secondary/12 text-secondary">
                    <span className="text-lg font-black">R</span>
                  </Toast.Icon>
                  <Toast.Content>
                    <Toast.Title>Workspace synced</Toast.Title>
                    <Toast.Description>
                      Compound API 适合带结构化说明、额外按钮和自定义图标的业务提示。
                    </Toast.Description>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm btn-primary btn-soft">
                        Open changelog
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost">
                        Later
                      </button>
                    </div>
                  </Toast.Content>
                  <Toast.Action className="ml-3 items-start self-start">
                    <Toast.Close className="text-base-content/50 hover:bg-base-200 hover:text-base-content" />
                  </Toast.Action>
                </Toast.Item>
              </Toast>
            </DemoSurface>
          )}
          code={`<Toast className="absolute" placement="bottom-start" inset={{ x: 16, y: 16 }}>
  <Toast.Item variant="outline" className="max-w-md">
    <Toast.Icon className="bg-secondary/12 text-secondary">
      <span className="text-lg font-black">R</span>
    </Toast.Icon>
    <Toast.Content>
      <Toast.Title>Workspace synced</Toast.Title>
      <Toast.Description>
        Compound API is useful when you need a custom icon and richer actions.
      </Toast.Description>
    </Toast.Content>
    <Toast.Action className="ml-3 items-start self-start">
      <Toast.Close className="text-base-content/50 hover:bg-base-200 hover:text-base-content" />
    </Toast.Action>
  </Toast.Item>
</Toast>`}
        />

        <h2>支持基础写法</h2>
        <p className="text-sm mt-2 mb-4">
          基础的“Toast 只做容器、里面继续放 alert 或自定义节点”的使用方式完整提供。下面这些基础示例
          都还在，只是按新的能力层次重新归组了。
        </p>

        <ExampleBlock
          title="Toast with alert inside"
          summary="展示基础示例，Toast 本体只包一层定位容器，内部内容完全由你决定。"
          tab={tabs.basic}
          preview={() => (
            <DemoSurface>
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10" />
              <div className="absolute inset-x-8 bottom-6 rounded-box border border-base-300 bg-base-200/60 px-4 py-3 text-sm text-base-content/70">
                当前页面内容
              </div>
              <Toast className="absolute" inset={16} gap={10}>
                <div role="alert" className="alert alert-info shadow-sm">
                  <span>New message arrived.</span>
                </div>
              </Toast>
            </DemoSurface>
          )}
          code={`<div className="relative h-56 overflow-hidden rounded-box border border-base-300 bg-base-100">
  <Toast className="absolute" inset={16} gap={10}>
    <div role="alert" className="alert alert-info shadow-sm">
      <span>New message arrived.</span>
    </div>
  </Toast>
</div>`}
        />

        <ExampleBlock
          title="Toast placements"
          summary="placement 九宫格别名和 horizontal / vertical 支持层仍然都可用，基础布局 API 不需要额外改造。"
          tab={tabs.placements}
          preview={() => (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {placementExamples.map(item => (
                <DemoSurface key={item.label} minHeight="9.5rem">
                  <div className="absolute left-3 top-3 badge badge-ghost badge-sm">
                    {item.label}
                  </div>
                  <Toast className="absolute" placement={item.placement} inset={{ x: 12, y: 12 }}>
                    <div role="alert" className={`${toastToneClassMap[item.tone]} shadow-sm`}>
                      <span>{item.label}</span>
                    </div>
                  </Toast>
                </DemoSurface>
              ))}
            </div>
          )}
          code={`<Toast className="absolute" placement="top-start" inset={{ x: 12, y: 12 }}>
  <div role="alert" className="alert alert-info">
    <span>top-start</span>
  </div>
</Toast>

<Toast className="absolute" placement="center" inset={{ x: 12, y: 12 }}>
  <div role="alert" className="alert alert-success">
    <span>center</span>
  </div>
</Toast>

<Toast className="absolute" horizontal="end" vertical="bottom" inset={{ x: 12, y: 12 }}>
  <div role="alert" className="alert alert-warning">
    <span>bottom-end</span>
  </div>
</Toast>`}
        />

        <ExampleBlock
          title="Stacked toasts"
          summary="基础的多条堆叠示例展示，同时和横向、倒序这些布局控制一起展示。"
          tab={tabs.stacked}
          preview={() => (
            <div className="grid gap-4 xl:grid-cols-2">
              <DemoSurface>
                <Toast
                  className="absolute"
                  vertical="top"
                  horizontal="end"
                  inset={{ x: 16, y: 16 }}
                  gap={12}
                >
                  <div role="alert" className="alert alert-info shadow-sm">
                    <span>New mail arrived.</span>
                  </div>
                  <div role="alert" className="alert alert-success shadow-sm">
                    <span>Message sent successfully.</span>
                  </div>
                </Toast>
              </DemoSurface>

              <DemoSurface>
                <Toast
                  className="absolute"
                  placement="bottom-start"
                  stack="horizontal"
                  reverse
                  inset={{ x: 16, y: 16 }}
                  gap={12}
                >
                  <div role="alert" className="alert alert-warning shadow-sm">
                    <span>Rollback ready</span>
                  </div>
                  <div role="alert" className="alert alert-info shadow-sm">
                    <span>Deploy queued</span>
                  </div>
                </Toast>
              </DemoSurface>
            </div>
          )}
          code={`<Toast className="absolute" vertical="top" horizontal="end" inset={{ x: 16, y: 16 }} gap={12}>
  <div role="alert" className="alert alert-info shadow-sm">
    <span>New mail arrived.</span>
  </div>
  <div role="alert" className="alert alert-success shadow-sm">
    <span>Message sent successfully.</span>
  </div>
</Toast>

<Toast
  className="absolute"
  placement="bottom-start"
  stack="horizontal"
  reverse
  inset={{ x: 16, y: 16 }}
  gap={12}
>
  <div role="alert" className="alert alert-warning shadow-sm">
    <span>Rollback ready</span>
  </div>
  <div role="alert" className="alert alert-info shadow-sm">
    <span>Deploy queued</span>
  </div>
</Toast>`}
        />

        <ExampleBlock
          title="Inset and layer control"
          summary="inset 负责把提示从边缘收进来，zIndex 用于压过页面中的局部浮层，适合嵌入 mock 页面或设计稿容器。"
          tab={tabs.inset}
          preview={() => (
            <DemoSurface minHeight="15rem">
              <div className="absolute inset-4 rounded-[1.25rem] border border-base-300 bg-base-100/80 p-4">
                <div className="h-10 rounded-box bg-base-200/80" />
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="h-20 rounded-box bg-base-200/70" />
                  <div className="h-20 rounded-box bg-base-200/70" />
                </div>
              </div>
              <div className="absolute right-8 top-10 z-10 rounded-box border border-base-300 bg-base-100 px-4 py-3 text-xs shadow-sm">
                背景浮层
              </div>
              <Toast
                className="absolute"
                placement="top-end"
                inset={{ x: 20, y: 20 }}
                gap={10}
                zIndex={30}
              >
                <div role="alert" className="alert alert-success shadow-lg">
                  <span>Layered above the card.</span>
                </div>
                <div role="alert" className="alert alert-info shadow-sm">
                  <span>Inset keeps it off the edge.</span>
                </div>
              </Toast>
            </DemoSurface>
          )}
          code={`<Toast
  className="absolute"
  placement="top-end"
  inset={{ x: 20, y: 20 }}
  gap={10}
  zIndex={30}
>
  <div role="alert" className="alert alert-success shadow-lg">
    <span>Layered above the card.</span>
  </div>
  <div role="alert" className="alert alert-info shadow-sm">
    <span>Inset keeps it off the edge.</span>
  </div>
</Toast>`}
        />

        <ExampleBlock
          title="Custom host element"
          summary="需要语义容器时，可以把根节点改成 section，并直接挂上 status / aria-live 之类的可访问性语义。"
          tab={tabs.host}
          preview={() => (
            <DemoSurface>
              <Toast
                as="section"
                className="absolute"
                placement="top"
                inset={{ x: 16, y: 16 }}
                role="status"
                aria-live="polite"
                gap={10}
              >
                <div role="alert" className="alert alert-info shadow-sm">
                  <span>Auto save completed.</span>
                </div>
                <div role="alert" className="alert alert-warning shadow-sm">
                  <span>1 draft still requires review.</span>
                </div>
              </Toast>
            </DemoSurface>
          )}
          code={`<Toast
  as="section"
  className="absolute"
  placement="top"
  inset={{ x: 16, y: 16 }}
  role="status"
  aria-live="polite"
  gap={10}
>
  <div role="alert" className="alert alert-info shadow-sm">
    <span>Auto save completed.</span>
  </div>
  <div role="alert" className="alert alert-warning shadow-sm">
    <span>1 draft still requires review.</span>
  </div>
</Toast>`}
        />

        <div className="my-8 lg:my-12">
          <h2 className="mt-2 mb-4 text-lg font-semibold">API</h2>
          <h3 className="mt-2 mb-3 text-base font-semibold">Toast.useMessage(options)</h3>
          <ApiTable rows={messageHookRows} />
          <p className="mt-4 text-sm opacity-70">
            返回值固定为 <code>[messageApi, contextHolder]</code>。为了保持这类 hook 的用法习惯，
            <code>contextHolder</code>
            仍然建议真实渲染到页面里；默认情况下它主要跟随当前组件生命周期，真正的消息层会挂到
            <code>document.body</code>，传 <code>getContainer=&#123;false&#125;</code> 时才会回到
            holder 内。
          </p>
          <h3 className="mt-8 mb-3 text-base font-semibold">messageApi</h3>
          <ApiTable rows={messageMethodRows} />
          <h3 className="mt-8 mb-3 text-base font-semibold">ToastMessageConfig</h3>
          <ApiTable rows={messageConfigRows} />
          <h3 className="mt-2 mb-3 text-base font-semibold">Toast 根容器</h3>
          <ApiTable rows={rootApiRows} />
          <h3 className="mt-8 mb-3 text-base font-semibold">Toast.Item 单条提示</h3>
          <ApiTable rows={itemApiRows} />
          <p className="mt-4 text-sm opacity-70">
            Compound 子组件包括 <code>Toast.Icon</code>、<code>Toast.Content</code>、
            <code>Toast.Title</code>、<code>Toast.Description</code>、<code>Toast.Action</code> 和{' '}
            <code>Toast.Close</code>。
          </p>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default ToastPage
