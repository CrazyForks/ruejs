import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Toggle } from '@rue-js/design'
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

const CheckIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

const CloseIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

const BoltIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  )
}

const CloudIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 1 1 .8-7.92A5 5 0 0 1 17 11a3.5 3.5 0 1 1 0 7H7Z" />
    </svg>
  )
}

const BasicTogglePreview: FC = () => {
  const enabled = ref(true)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle
        data-testid="toggle-basic"
        checked={enabled.value}
        checkedChildren="已启用"
        unCheckedChildren="已关闭"
        onChange={nextChecked => {
          enabled.value = nextChecked
        }}
      />
      <span className="text-sm text-base-content/70">当前状态：{enabled.value ? '已启用' : '已关闭'}</span>
    </div>
  )
}

const TextTogglePreview: FC = () => {
  const wifiEnabled = ref(true)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Toggle defaultChecked={true} checkedChildren="开启" unCheckedChildren="关闭" />
        <Toggle checkedChildren="1" unCheckedChildren="0" />
        <Toggle
          checked={wifiEnabled.value}
          checkedChildren={<CheckIcon />}
          unCheckedChildren={<CloseIcon />}
          onChange={nextChecked => {
            wifiEnabled.value = nextChecked
          }}
        />
      </div>
      <div className="text-sm text-base-content/70">图标态：{wifiEnabled.value ? '网络已接通' : '网络已断开'}</div>
    </div>
  )
}

const LoadingTogglePreview: FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle loading={true} defaultValue={true} checkedChildren="同步中" unCheckedChildren="待命" />
      <Toggle size="small" loading={true} defaultChecked={false} />
    </div>
  )
}

const SettingTogglePreview: FC = () => {
  const aiReview = ref(true)
  const releaseAlert = ref(false)
  const cloudSync = ref(true)

  const cardClassName = 'w-full rounded-box border border-base-300 bg-base-100 px-4 py-3 shadow-sm md:max-w-xl'

  return (
    <div className="flex flex-col gap-3">
      <Toggle
        checked={aiReview.value}
        color="primary"
        checkedChildren={
          <>
            <BoltIcon />
            实时审查
          </>
        }
        unCheckedChildren="手动处理"
        rootClassName={cardClassName}
        contentClassName="gap-1"
        onChange={nextChecked => {
          aiReview.value = nextChecked
        }}
      >
        AI Review
      </Toggle>

      <Toggle
        checked={releaseAlert.value}
        color="warning"
        checkedChildren="变更时提醒"
        unCheckedChildren="静默模式"
        rootClassName={cardClassName}
        contentClassName="gap-1"
        onChange={nextChecked => {
          releaseAlert.value = nextChecked
        }}
      >
        Release Alert
      </Toggle>

      <Toggle
        checked={cloudSync.value}
        color="success"
        checkedChildren={
          <>
            <CloudIcon />
            云端在线
          </>
        }
        unCheckedChildren="暂停同步"
        rootClassName={cardClassName}
        contentClassName="gap-1"
        onChange={nextChecked => {
          cloudSync.value = nextChecked
        }}
      >
        Cloud Sync
      </Toggle>
    </div>
  )
}

const apiRows: ApiRow[] = [
  {
    prop: 'checked',
    description: '受控选中状态',
    type: 'boolean',
    defaultValue: '-',
  },
  {
    prop: 'checkedChildren',
    description: '选中态展示内容，适合短文本或图标',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '附加说明内容，传入后会自动包裹为设置项布局',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'color',
    description: '开关颜色主题',
    type: `'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'info' | 'error'`,
    defaultValue: '-',
  },
  {
    prop: 'contentClassName',
    description: '设置项内容容器类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'defaultChecked',
    description: '非受控初始选中状态',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'defaultValue',
    description: '别名；传 boolean 时等价于 defaultChecked，传 string 或 number 时作为原生默认值',
    type: 'boolean | string | number',
    defaultValue: '-',
  },
  {
    prop: 'disabled',
    description: '禁用开关',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'loading',
    description: '加载态，同时自动禁用当前开关',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'onChange',
    description: '状态变化时回调，签名为 (checked, event)',
    type: '(checked: boolean, event: Event) => void',
    defaultValue: '-',
  },
  {
    prop: 'onCheckedChange',
    description: '语义化别名回调，签名同 onChange',
    type: '(checked: boolean, event: Event) => void',
    defaultValue: '-',
  },
  {
    prop: 'onClick',
    description: '点击开关时回调，签名为 (checked, event)',
    type: '(checked: boolean, event: Event) => void',
    defaultValue: '-',
  },
  {
    prop: 'rootClassName',
    description: '设置项根容器类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'size',
    description: '尺寸，支持 xs 到 xl，也支持 small、default、medium 语义别名',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium'`,
    defaultValue: '-',
  },
  {
    prop: 'stateClassName',
    description: '状态文案区域类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'unCheckedChildren',
    description: '未选中态展示内容',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'value',
    description: '别名；传 boolean 时等价于 checked，传 string 或 number 时作为原生 input 值',
    type: 'boolean | string | number',
    defaultValue: '-',
  },
]

const TogglePage: FC = () => {
  const tabBasic = ref<PreviewTabMode>('preview')
  const tabText = ref<PreviewTabMode>('preview')
  const tabLoading = ref<PreviewTabMode>('preview')
  const tabColors = ref<PreviewTabMode>('preview')
  const tabSizes = ref<PreviewTabMode>('preview')
  const tabDisabled = ref<PreviewTabMode>('preview')
  const tabSettings = ref<PreviewTabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Toggle 开关</h1>
        <p className="mt-3 mb-3 text-sm">
          Toggle 适合立即生效的双态切换。和 Checkbox 更偏向“标记后统一提交”不同，Toggle 更适合通知、同步、权限和偏好设置。
        </p>
        <p className="text-sm text-base-content/70">
          Rue 继续沿用现有 toggle 视觉类，并补齐了 Switch 常见的受控/非受控、状态文案、loading 和设置项布局能力。
        </p>

        <PreviewBlock
          title="基础受控"
          tab={tabBasic}
          preview={<BasicTogglePreview />}
          code={`const enabled = ref(true)

<Toggle
  checked={enabled.value}
  checkedChildren="已启用"
  unCheckedChildren="已关闭"
  onChange={nextChecked => {
    enabled.value = nextChecked
  }}
/>
<span>当前状态：{enabled.value ? '已启用' : '已关闭'}</span>`}
        />

        <PreviewBlock
          title="文本与图标"
          tab={tabText}
          preview={<TextTogglePreview />}
          code={`<Toggle defaultChecked={true} checkedChildren="开启" unCheckedChildren="关闭" />
<Toggle checkedChildren="1" unCheckedChildren="0" />

const wifiEnabled = ref(true)

<Toggle
  checked={wifiEnabled.value}
  checkedChildren={<CheckIcon />}
  unCheckedChildren={<CloseIcon />}
  onChange={nextChecked => {
    wifiEnabled.value = nextChecked
  }}
/>`}
        />

        <PreviewBlock
          title="Loading"
          tab={tabLoading}
          preview={<LoadingTogglePreview />}
          code={`<Toggle loading={true} defaultValue={true} checkedChildren="同步中" unCheckedChildren="待命" />
<Toggle size="small" loading={true} defaultChecked={false} />`}
        />

        <PreviewBlock
          title="Toggle colors"
          tab={tabColors}
          preview={() => (
            <div className="flex flex-wrap items-center gap-4">
              <Toggle checked={true} color="primary" />
              <Toggle checked={true} color="secondary" />
              <Toggle checked={true} color="accent" />
              <Toggle checked={true} color="neutral" />
              <Toggle checked={true} color="info" />
              <Toggle checked={true} color="success" />
              <Toggle checked={true} color="warning" />
              <Toggle checked={true} color="error" />
            </div>
          )}
          code={`<Toggle checked={true} color="primary" />
<Toggle checked={true} color="secondary" />
<Toggle checked={true} color="accent" />
<Toggle checked={true} color="neutral" />
<Toggle checked={true} color="info" />
<Toggle checked={true} color="success" />
<Toggle checked={true} color="warning" />
<Toggle checked={true} color="error" />`}
        />

        <PreviewBlock
          title="Toggle sizes"
          tab={tabSizes}
          preview={() => (
            <div className="flex flex-wrap items-center gap-4">
              <Toggle data-testid="toggle-size-xs" checked={true} size="xs" />
              <Toggle checked={true} size="sm" />
              <Toggle checked={true} size="md" />
              <Toggle checked={true} size="lg" />
              <Toggle checked={true} size="xl" />
              <Toggle checked={true} size="small" />
              <Toggle checked={true} size="default" />
            </div>
          )}
          code={`<Toggle checked={true} size="xs" />
<Toggle checked={true} size="sm" />
<Toggle checked={true} size="md" />
<Toggle checked={true} size="lg" />
<Toggle checked={true} size="xl" />
<Toggle checked={true} size="small" />
<Toggle checked={true} size="default" />`}
        />

        <PreviewBlock
          title="Disabled"
          tab={tabDisabled}
          preview={() => (
            <div className="flex flex-wrap items-center gap-4">
              <Toggle disabled={true} />
              <Toggle disabled={true} checked={true} />
              <Toggle disabled={true} checkedChildren="在线" unCheckedChildren="离线" />
            </div>
          )}
          code={`<Toggle disabled={true} />
<Toggle disabled={true} checked={true} />
<Toggle disabled={true} checkedChildren="在线" unCheckedChildren="离线" />`}
        />

        <PreviewBlock
          title="设置项布局"
          tab={tabSettings}
          preview={<SettingTogglePreview />}
          code={`const aiReview = ref(true)
const releaseAlert = ref(false)

<Toggle
  checked={aiReview.value}
  color="primary"
  checkedChildren="实时审查"
  unCheckedChildren="手动处理"
  rootClassName="rounded-box border border-base-300 bg-base-100 px-4 py-3"
  onChange={nextChecked => {
    aiReview.value = nextChecked
  }}
>
  AI Review
</Toggle>

<Toggle
  checked={releaseAlert.value}
  color="warning"
  checkedChildren="变更时提醒"
  unCheckedChildren="静默模式"
  rootClassName="rounded-box border border-base-300 bg-base-100 px-4 py-3"
  onChange={nextChecked => {
    releaseAlert.value = nextChecked
  }}
>
  Release Alert
</Toggle>`}
        />

        <div className="not-prose mt-10">
          <h2 className="mb-4 text-lg font-semibold text-base-content">API</h2>
          <ApiTable rows={apiRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default TogglePage
