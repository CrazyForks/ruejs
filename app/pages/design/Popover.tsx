import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Popover } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
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
    prop: 'title / content / overlay',
    description: '支持标准标题与内容，也支持直接传完整 overlay 卡片以承载更自由的结构。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'trigger',
    description: '触发方式，可单个或组合使用 hover、focus、click、contextMenu。',
    type: "'hover' | 'focus' | 'click' | 'contextMenu' | Array<...>",
    defaultValue: "'hover'",
  },
  {
    prop: 'open / defaultOpen / onOpenChange',
    description: '受控与非受控开合，适合做外部按钮联动、校验提示或场景化引导。',
    type: 'boolean / boolean / (open: boolean) => void',
    defaultValue: 'false / false / -',
  },
  {
    prop: 'placement',
    description: '支持四个基础方向和常见角落别名，便于和成熟浮层组件保持一致心智。',
    type: "'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | ...",
    defaultValue: "'top'",
  },
  {
    prop: 'arrow',
    description: '支持关闭箭头或通过 pointAtCenter 让箭头对齐触发器中心。',
    type: 'boolean | { pointAtCenter?: boolean }',
    defaultValue: 'true',
  },
  {
    prop: 'destroyOnHidden',
    description: '关闭后是否卸载浮层内容；默认保持 DOM 并切换可见状态，适合轻操作卡片。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'mouseEnterDelay / mouseLeaveDelay',
    description: '控制 hover 模式的开合延时，单位为秒。',
    type: 'number / number',
    defaultValue: '0.08 / 0.12',
  },
  {
    prop: 'classNames / styles',
    description: '按 root、trigger、overlay、panel、header、title、content、arrow 等语义块定制。',
    type: 'PopoverClassNames / PopoverStyles',
    defaultValue: '-',
  },
  {
    prop: 'overlayClassName / overlayStyle / zIndex',
    description: '补充浮层层级、尺寸和视觉样式扩展。',
    type: 'string / Record<string, any> / number',
    defaultValue: '- / - / -',
  },
]

const ControlledPopoverPreview: FC = () => {
  const controlledOpen = ref(false)
  const nextControlledOpen = ref(false)

  return (
    <div className="rounded-box border border-base-300 bg-base-100/75 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Popover
          open={controlledOpen.value}
          trigger="click"
          title="受控 Popover"
          content="可以由外部按钮、校验状态或流程步骤直接控制。"
          onOpenChange={nextOpen => {
            controlledOpen.value = nextOpen
          }}
        >
          <button className="btn btn-outline">受控触发器</button>
        </Popover>

        <button
          className="btn btn-primary"
          onMouseDown={() => {
            nextControlledOpen.value = !controlledOpen.value
          }}
          onClick={() => {
            controlledOpen.value = nextControlledOpen.value
          }}
        >
          {controlledOpen.value ? '收起外部控制面板' : '打开外部控制面板'}
        </button>

        <span className="badge badge-outline min-w-[6rem] justify-center">
          {controlledOpen.value ? 'open' : 'closed'}
        </span>
      </div>
    </div>
  )
}

const PopoverPage: FC = () => {
  const tabBasic = ref<PreviewTabMode>('preview')
  const tabPlacement = ref<PreviewTabMode>('preview')
  const tabTrigger = ref<PreviewTabMode>('preview')
  const tabControlled = ref<PreviewTabMode>('preview')
  const tabRich = ref<PreviewTabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Popover 气泡卡片</h1>
        <p className="text-sm mt-3 mb-3">
          Popover 用来承载比 Tooltip 更完整的信息块和轻操作。Rue 实现采用当前的轻卡片视觉， 同时补充{' '}
          <code>title</code>、<code>content</code>、<code>overlay</code>、触发方式、
          定位、箭头和受控开合等核心能力。
        </p>
        <p className="text-sm text-base-content/70">
          它更适合字段解释、快速状态卡、内联操作和轻量二次确认，而不是用 Modal 打断页面流程。
        </p>

        <PreviewBlock
          title="Basic popovers"
          tab={tabBasic}
          preview={() => (
            <div className="grid gap-4 lg:grid-cols-3">
              <Popover title="部署窗口" content="今晚 22:00 后会自动切换到新构建。">
                <button className="btn btn-outline">Hover for status</button>
              </Popover>

              <Popover
                trigger="click"
                title="审批提示"
                content="这个批次还缺法务签字，建议先补全再提交。"
              >
                <button className="btn btn-soft btn-primary">Click for guidance</button>
              </Popover>

              <Popover
                overlay={
                  <div className="space-y-3 rounded-[1.15rem] border border-base-300/80 bg-base-100/95 p-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Release checklist</div>
                      <div className="text-xs leading-5 text-base-content/70">
                        包含资源校验、追踪链路确认与灰度开关检查。
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-primary">继续发布</button>
                      <button className="btn btn-sm btn-ghost">稍后处理</button>
                    </div>
                  </div>
                }
                trigger="click"
                overlayClassName="max-w-80"
              >
                <button className="btn btn-soft">Custom action card</button>
              </Popover>
            </div>
          )}
          code={`<div className="grid gap-4 lg:grid-cols-3">
  <Popover title="部署窗口" content="今晚 22:00 后会自动切换到新构建。">
    <button className="btn btn-outline">Hover for status</button>
  </Popover>

  <Popover
    trigger="click"
    title="审批提示"
    content="这个批次还缺法务签字，建议先补全再提交。"
  >
    <button className="btn btn-soft btn-primary">Click for guidance</button>
  </Popover>

  <Popover
    trigger="click"
    overlay={
      <div className="space-y-3 rounded-[1.15rem] border border-base-300/80 bg-base-100/95 p-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Release checklist</div>
          <div className="text-xs leading-5 text-base-content/70">
            包含资源校验、追踪链路确认与灰度开关检查。
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-primary">继续发布</button>
          <button className="btn btn-sm btn-ghost">稍后处理</button>
        </div>
      </div>
    }
    overlayClassName="max-w-80"
  >
    <button className="btn btn-soft">Custom action card</button>
  </Popover>
</div>`}
        />

        <PreviewBlock
          title="Placement"
          tab={tabPlacement}
          preview={() => (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <Popover
                open={true}
                placement="topLeft"
                title="Top start"
                content="适合贴着触发器左边缘展示信息。"
                className="justify-self-start"
              >
                <button className="btn">Top left</button>
              </Popover>

              <Popover
                open={true}
                placement="bottomRight"
                title="Bottom end"
                content="右下角常用来对齐工具条末端。"
                className="justify-self-start"
              >
                <button className="btn">Bottom right</button>
              </Popover>

              <Popover
                open={true}
                placement="leftTop"
                title="Left top"
                content="适合桌面端列表或表格中的侧向说明。"
                className="justify-self-start"
              >
                <button className="btn">Left top</button>
              </Popover>

              <Popover
                open={true}
                placement="rightBottom"
                title="Right bottom"
                content="在工具面板、筛选块里会更自然。"
                className="justify-self-start"
              >
                <button className="btn">Right bottom</button>
              </Popover>
            </div>
          )}
          code={`<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
  <Popover open={true} placement="topLeft" title="Top start" content="适合贴着触发器左边缘展示信息。" className="justify-self-start">
    <button className="btn">Top left</button>
  </Popover>

  <Popover open={true} placement="bottomRight" title="Bottom end" content="右下角常用来对齐工具条末端。" className="justify-self-start">
    <button className="btn">Bottom right</button>
  </Popover>

  <Popover open={true} placement="leftTop" title="Left top" content="适合桌面端列表或表格中的侧向说明。" className="justify-self-start">
    <button className="btn">Left top</button>
  </Popover>

  <Popover open={true} placement="rightBottom" title="Right bottom" content="在工具面板、筛选块里会更自然。" className="justify-self-start">
    <button className="btn">Right bottom</button>
  </Popover>
</div>`}
        />

        <PreviewBlock
          title="Trigger modes"
          tab={tabTrigger}
          preview={() => (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <Popover title="默认 hover" content="鼠标进入时展示，移出后收起。">
                <button className="btn btn-outline">Hover</button>
              </Popover>

              <Popover
                trigger="click"
                title="Click trigger"
                content="再次点击同一个触发器即可关闭。"
              >
                <button className="btn btn-soft">Click</button>
              </Popover>

              <Popover
                trigger="contextMenu"
                title="Context menu"
                content="右键适合承载次级命令或辅助说明。"
              >
                <button className="btn btn-ghost border border-base-300">Right click</button>
              </Popover>

              <Popover
                trigger="focus"
                title="Focus trigger"
                content="适合输入前的字段说明与校验前置提示。"
              >
                <input className="input input-bordered w-full" placeholder="Focus this input" />
              </Popover>
            </div>
          )}
          code={`<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
  <Popover title="默认 hover" content="鼠标进入时展示，移出后收起。">
    <button className="btn btn-outline">Hover</button>
  </Popover>

  <Popover trigger="click" title="Click trigger" content="再次点击同一个触发器即可关闭。">
    <button className="btn btn-soft">Click</button>
  </Popover>

  <Popover trigger="contextMenu" title="Context menu" content="右键适合承载次级命令或辅助说明。">
    <button className="btn btn-ghost border border-base-300">Right click</button>
  </Popover>

  <Popover trigger="focus" title="Focus trigger" content="适合输入前的字段说明与校验前置提示。">
    <input className="input input-bordered w-full" placeholder="Focus this input" />
  </Popover>
</div>`}
        />

        <PreviewBlock
          title="Controlled visibility"
          tab={tabControlled}
          preview={() => <ControlledPopoverPreview />}
          code={`const controlledOpen = ref(false)
const nextControlledOpen = ref(false)

<div className="rounded-box border border-base-300 bg-base-100/75 p-5">
  <div className="flex flex-wrap items-center gap-3">
    <Popover
      open={controlledOpen.value}
      trigger="click"
      title="受控 Popover"
      content="可以由外部按钮、校验状态或流程步骤直接控制。"
      onOpenChange={nextOpen => {
        controlledOpen.value = nextOpen
      }}
    >
      <button className="btn btn-outline">受控触发器</button>
    </Popover>

    <button
      className="btn btn-primary"
      onMouseDown={() => {
        nextControlledOpen.value = !controlledOpen.value
      }}
      onClick={() => {
        controlledOpen.value = nextControlledOpen.value
      }}
    >
      {controlledOpen.value ? '收起外部控制面板' : '打开外部控制面板'}
    </button>

    <span className="badge badge-outline min-w-[6rem] justify-center">
      {controlledOpen.value ? 'open' : 'closed'}
    </span>
  </div>
</div>`}
        />

        <PreviewBlock
          title="Arrow and semantic styling"
          tab={tabRich}
          preview={() => (
            <div className="grid gap-6 lg:grid-cols-2">
              <Popover
                open={true}
                placement="bottom"
                arrow={{ pointAtCenter: true }}
                title="Centered arrow"
                content="箭头会对齐到触发器中心，更适合宽按钮或卡片入口。"
                className="justify-self-start"
              >
                <button className="btn btn-primary w-52 justify-center">Point at center</button>
              </Popover>

              <Popover
                open={true}
                placement="rightTop"
                arrow={false}
                title="Editorial pulse"
                content={
                  <div className="space-y-2">
                    <div className="text-xs text-base-content/60">本周更新节奏</div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-primary badge-soft">+12%</span>
                      <span className="text-xs text-base-content/70">首屏转化高于上周</span>
                    </div>
                  </div>
                }
                classNames={{
                  panel: 'border-primary/20 bg-base-100/98',
                  header: 'bg-primary/5',
                  title: 'uppercase tracking-[0.14em] text-[11px] text-primary',
                }}
                styles={{
                  content: { padding: '0.75rem 1rem 1rem' },
                }}
                className="justify-self-start"
              >
                <button className="btn btn-outline btn-primary">Styled card</button>
              </Popover>
            </div>
          )}
          code={`<div className="grid gap-6 lg:grid-cols-2">
  <Popover
    open={true}
    placement="bottom"
    arrow={{ pointAtCenter: true }}
    title="Centered arrow"
    content="箭头会对齐到触发器中心，更适合宽按钮或卡片入口。"
    className="justify-self-start"
  >
    <button className="btn btn-primary w-52 justify-center">Point at center</button>
  </Popover>

  <Popover
    open={true}
    placement="rightTop"
    arrow={false}
    title="Editorial pulse"
    content={
      <div className="space-y-2">
        <div className="text-xs text-base-content/60">本周更新节奏</div>
        <div className="flex items-center gap-2">
          <span className="badge badge-primary badge-soft">+12%</span>
          <span className="text-xs text-base-content/70">首屏转化高于上周</span>
        </div>
      </div>
    }
    classNames={{
      panel: 'border-primary/20 bg-base-100/98',
      header: 'bg-primary/5',
      title: 'uppercase tracking-[0.14em] text-[11px] text-primary',
    }}
    styles={{
      content: { padding: '0.75rem 1rem 1rem' },
    }}
    className="justify-self-start"
  >
    <button className="btn btn-outline btn-primary">Styled card</button>
  </Popover>
</div>`}
        />

        <h2 className="mt-12">API</h2>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default PopoverPage
