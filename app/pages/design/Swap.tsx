import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Swap } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

interface IconProps {
  className?: string
}

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

type TriState = 'off' | 'mixed' | 'on'

const VolumeOnIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M5 9h3l4-4v14l-4-4H5zm10.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 15.5 12zm1.5 0c0 2.42-1.72 4.45-4 4.92v2.02c3.39-.49 6-3.4 6-6.94s-2.61-6.45-6-6.94v2.02c2.28.47 4 2.5 4 4.92z" />
  </svg>
)

const VolumeOffIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M5 9h3l4-4v14l-4-4H5zm10.59 3 2.7-2.7 1.41 1.41L17 13.41l2.7 2.69-1.41 1.41L15.59 14.82l-2.68 2.69-1.41-1.41L14.18 12l-2.68-2.7 1.41-1.41z" />
  </svg>
)

const SunIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 4a1 1 0 0 1-1-1V2h2v1a1 1 0 0 1-1 1zm0 17a1 1 0 0 1 1 1v1h-2v-1a1 1 0 0 1 1-1zm8-8a1 1 0 0 1 1-1h1v2h-1a1 1 0 0 1-1-1zM2 12a1 1 0 0 1 1-1h1v2H3a1 1 0 0 1-1-1zm15.66-6.24 1.41-1.42 1.42 1.42-1.42 1.41zM3.51 19.9l1.42-1.41 1.41 1.41-1.41 1.42zm15.56 1.42-1.41-1.42 1.41-1.41 1.42 1.41zM3.51 4.34l1.42 1.42-1.42 1.41-1.41-1.41zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
  </svg>
)

const MoonIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M20 14.46A8 8 0 0 1 9.54 4 9 9 0 1 0 20 14.46z" />
  </svg>
)

const MenuIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
  </svg>
)

const CloseIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z" />
  </svg>
)


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
    prop: 'active',
    description: 'class mode 开关，追加 swap-active；适合外部 class 驱动',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'as',
    description: '根节点标签，默认 label',
    type: 'any',
    defaultValue: `'label'`,
  },
  {
    prop: 'checked',
    description: '受控选中态；未手写 input 时会自动生成 checkbox',
    type: 'boolean',
    defaultValue: '-',
  },
  {
    prop: 'defaultChecked',
    description: '非受控初始选中态',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'defaultIndeterminate',
    description: '非受控初始半选态，首次交互后会退出 mixed',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'disabled',
    description: '禁用自动生成的 checkbox，并附加禁用视觉语义',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'effect',
    description: '推荐的效果写法，统一选择 rotate 或 flip',
    type: `'rotate' | 'flip'`,
    defaultValue: '-',
  },
  {
    prop: 'flip / rotate',
    description: '兼容原有布尔写法',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'indeterminate',
    description: '受控半选态；自动输入模式下会同步到原生 checkbox.indeterminate',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'inputClassName',
    description: '自动生成 checkbox 的 className',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'inputProps',
    description: '自动生成 checkbox 的透传属性，如 name、value、id',
    type: 'Record<string, any>',
    defaultValue: '-',
  },
  {
    prop: 'onChange',
    description: '变更事件，返回 checked、indeterminate、active、mode',
    type: '(event, meta) => void',
    defaultValue: '-',
  },
  {
    prop: 'onCheckedChange',
    description: '更轻量的 checked 回调',
    type: '(checked, event) => void',
    defaultValue: '-',
  },
]

const SwapPage: FC = () => {
  const textActive = ref(false)
  const controlledActive = ref(true)
  const mixedState = ref<TriState>('mixed')
  const classModeActive = ref(false)
  const tabs = {
    controlled: ref<PreviewTabMode>('preview'),
    uncontrolled: ref<PreviewTabMode>('preview'),
    mixed: ref<PreviewTabMode>('preview'),
    disabled: ref<PreviewTabMode>('preview'),
    text: ref<PreviewTabMode>('preview'),
    volume: ref<PreviewTabMode>('preview'),
    rotate: ref<PreviewTabMode>('preview'),
    hamburger: ref<PreviewTabMode>('preview'),
    flip: ref<PreviewTabMode>('preview'),
    classMode: ref<PreviewTabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Swap 切换容器</h1>
        <p className="text-sm mt-3 mb-3">
          Swap 继续保留 Rue 原本的视觉风格和 compound 结构，但现在补上了更顺手的状态 API。
          你可以继续手写 checkbox，也可以直接用 <code>checked</code>、<code>defaultChecked</code>、
          <code>indeterminate</code> 和 <code>onCheckedChange</code> 让组件自己生成隐藏输入。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/swap/" target="_blank">
            查看 Swap 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要在两个内容之间做轻量切换，同时复用 Rue 现有的 swap 视觉和动效。</li>
          <li>需要图标切换、文案切换、菜单开合、主题切换这类“一进一出”的状态表达。</li>
          <li>需要 mixed/indeterminate 这类第三态，但又不想手动维护隐藏 checkbox。</li>
        </ul>

        <h2>推荐用法</h2>

        <PreviewBlock
          title="Props driven controlled swap"
          tab={tabs.controlled}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Swap
                    checked={controlledActive.value}
                    effect="rotate"
                    className="rounded-box bg-base-200 p-3 text-primary"
                    inputProps={{ name: 'theme-mode' }}
                    data-testid="swap-controlled-demo"
                    onCheckedChange={checked => {
                      controlledActive.value = checked
                    }}
                  >
                    <Swap.On>
                      <SunIcon className="h-10 w-10 fill-current" />
                    </Swap.On>
                    <Swap.Off>
                      <MoonIcon className="h-10 w-10 fill-current" />
                    </Swap.Off>
                  </Swap>
                  <div className="text-sm text-base-content/70">
                    当前模式：{controlledActive.value ? 'light' : 'dark'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      controlledActive.value = true
                    }}
                  >
                    打开
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      controlledActive.value = false
                    }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          }
          code={`const checked = ref(true)

<Swap
  checked={checked.value}
  effect="rotate"
  className="rounded-box bg-base-200 p-3 text-primary"
  inputProps={{ name: 'theme-mode' }}
  onCheckedChange={next => {
    checked.value = next
  }}
>
  <Swap.On><SunIcon className="h-10 w-10 fill-current" /></Swap.On>
  <Swap.Off><MoonIcon className="h-10 w-10 fill-current" /></Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Props driven uncontrolled swap"
          tab={tabs.uncontrolled}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap items-center gap-6">
                <Swap
                  defaultChecked
                  className="text-2xl font-black tracking-widest"
                  data-testid="swap-uncontrolled-demo"
                >
                  <Swap.On>OPEN</Swap.On>
                  <Swap.Off>CLOSE</Swap.Off>
                </Swap>
                <div className="text-sm text-base-content/70">
                  这个例子不手写 <code>input</code>，但仍然是原生 checkbox 驱动。
                </div>
              </div>
            </div>
          }
          code={`<Swap defaultChecked className="text-2xl font-black tracking-widest">
  <Swap.On>OPEN</Swap.On>
  <Swap.Off>CLOSE</Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Indeterminate state"
          tab={tabs.mixed}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Swap
                    checked={mixedState.value === 'on'}
                    indeterminate={mixedState.value === 'mixed'}
                    className="rounded-box border border-base-300 px-4 py-3 text-lg font-semibold"
                    data-testid="swap-mixed-demo"
                    onCheckedChange={checked => {
                      mixedState.value = checked ? 'on' : 'off'
                    }}
                  >
                    <Swap.On>ALL</Swap.On>
                    <Swap.Indeterminate>SOME</Swap.Indeterminate>
                    <Swap.Off>NONE</Swap.Off>
                  </Swap>
                  <span className="text-sm text-base-content/70">当前状态：{mixedState.value}</span>
                </div>
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mixedState.value === 'off' ? 'btn-active' : ''}`}
                    onClick={() => {
                      mixedState.value = 'off'
                    }}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mixedState.value === 'mixed' ? 'btn-active' : ''}`}
                    onClick={() => {
                      mixedState.value = 'mixed'
                    }}
                  >
                    Mixed
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mixedState.value === 'on' ? 'btn-active' : ''}`}
                    onClick={() => {
                      mixedState.value = 'on'
                    }}
                  >
                    On
                  </button>
                </div>
              </div>
            </div>
          }
          code={`const state = ref<'off' | 'mixed' | 'on'>('mixed')

<Swap
  checked={state.value === 'on'}
  indeterminate={state.value === 'mixed'}
  onCheckedChange={checked => {
    state.value = checked ? 'on' : 'off'
  }}
>
  <Swap.On>ALL</Swap.On>
  <Swap.Indeterminate>SOME</Swap.Indeterminate>
  <Swap.Off>NONE</Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Disabled states"
          tab={tabs.disabled}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-wrap items-center gap-6">
                <Swap disabled defaultChecked className="rounded-box bg-base-200 px-4 py-3 text-success">
                  <Swap.On>ONLINE</Swap.On>
                  <Swap.Off>OFFLINE</Swap.Off>
                </Swap>
                <Swap disabled defaultIndeterminate className="rounded-box bg-base-200 px-4 py-3 text-warning">
                  <Swap.On>READY</Swap.On>
                  <Swap.Indeterminate>PENDING</Swap.Indeterminate>
                  <Swap.Off>IDLE</Swap.Off>
                </Swap>
              </div>
            </div>
          }
          code={`<Swap disabled defaultChecked className="rounded-box bg-base-200 px-4 py-3 text-success">
  <Swap.On>ONLINE</Swap.On>
  <Swap.Off>OFFLINE</Swap.Off>
</Swap>

<Swap disabled defaultIndeterminate className="rounded-box bg-base-200 px-4 py-3 text-warning">
  <Swap.On>READY</Swap.On>
  <Swap.Indeterminate>PENDING</Swap.Indeterminate>
  <Swap.Off>IDLE</Swap.Off>
</Swap>`}
        />

        <h2>经典 demo</h2>
        <p>下面这些示例全部保留原始写法，适合对照 swap 的底层结构和 class mode 使用方式。</p>

        <PreviewBlock
          title="Swap text"
          tab={tabs.text}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex items-center gap-4">
                <Swap className="text-2xl" data-testid="swap-text-demo">
                  <input
                    type="checkbox"
                    autoComplete="off"
                    checked={textActive.value}
                    data-testid="swap-text-input"
                    onChange={(event: Event) => {
                      textActive.value = (event.target as HTMLInputElement | null)?.checked === true
                    }}
                  />
                  <Swap.On>ON</Swap.On>
                  <Swap.Off>OFF</Swap.Off>
                </Swap>
                <span className="text-sm text-base-content/70" data-testid="swap-text-state">
                  Current: {textActive.value ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          }
          code={`const active = ref(false)

<Swap>
  <input
    type="checkbox"
    checked={active.value}
    onChange={event => {
      active.value = (event.target as HTMLInputElement).checked
    }}
  />
  <Swap.On>ON</Swap.On>
  <Swap.Off>OFF</Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Swap volume icons"
          tab={tabs.volume}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Swap>
                  <input type="checkbox" autoComplete="off" />
                  <Swap.On>
                    <VolumeOnIcon className="h-12 w-12 fill-current" />
                  </Swap.On>
                  <Swap.Off>
                    <VolumeOffIcon className="h-12 w-12 fill-current" />
                  </Swap.Off>
                </Swap>
              </div>
            </div>
          }
          code={`<Swap>
  <input type="checkbox" autoComplete="off" />
  <Swap.On><VolumeOnIcon className="h-12 w-12 fill-current" /></Swap.On>
  <Swap.Off><VolumeOffIcon className="h-12 w-12 fill-current" /></Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Swap icons with rotate effect"
          tab={tabs.rotate}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Swap rotate>
                  <input type="checkbox" autoComplete="off" />
                  <Swap.On>
                    <SunIcon className="h-10 w-10 fill-current" />
                  </Swap.On>
                  <Swap.Off>
                    <MoonIcon className="h-10 w-10 fill-current" />
                  </Swap.Off>
                </Swap>
              </div>
            </div>
          }
          code={`<Swap rotate>
  <input type="checkbox" autoComplete="off" />
  <Swap.On><SunIcon className="h-10 w-10 fill-current" /></Swap.On>
  <Swap.Off><MoonIcon className="h-10 w-10 fill-current" /></Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Hamburger button"
          tab={tabs.hamburger}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Swap rotate className="btn btn-circle" data-testid="swap-hamburger">
                  <input type="checkbox" autoComplete="off" />
                  <Swap.Off>
                    <MenuIcon className="h-8 w-8 fill-current" />
                  </Swap.Off>
                  <Swap.On>
                    <CloseIcon className="h-8 w-8 fill-current" />
                  </Swap.On>
                </Swap>
              </div>
            </div>
          }
          code={`<Swap rotate className="btn btn-circle">
  <input type="checkbox" autoComplete="off" />
  <Swap.Off><MenuIcon className="h-8 w-8 fill-current" /></Swap.Off>
  <Swap.On><CloseIcon className="h-8 w-8 fill-current" /></Swap.On>
</Swap>`}
        />

        <PreviewBlock
          title="Swap icons with flip effect"
          tab={tabs.flip}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Swap flip className="text-4xl font-black tracking-widest">
                  <input type="checkbox" autoComplete="off" />
                  <Swap.On>EVIL</Swap.On>
                  <Swap.Off>ANGEL</Swap.Off>
                </Swap>
              </div>
            </div>
          }
          code={`<Swap flip className="text-4xl font-black tracking-widest">
  <input type="checkbox" autoComplete="off" />
  <Swap.On>EVIL</Swap.On>
  <Swap.Off>ANGEL</Swap.Off>
</Swap>`}
        />

        <PreviewBlock
          title="Activate using class name"
          tab={tabs.classMode}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-col gap-4">
                <button
                  type="button"
                  className="btn btn-sm w-fit"
                  data-testid="swap-class-toggle"
                  onClick={() => {
                    classModeActive.value = !classModeActive.value
                  }}
                >
                  Toggle class mode
                </button>
                <div className="flex items-center gap-4">
                  <Swap
                    as="div"
                    active={classModeActive.value}
                    className="text-4xl font-black tracking-widest"
                    data-testid="swap-class-demo"
                  >
                    <Swap.On>HOT</Swap.On>
                    <Swap.Off>COLD</Swap.Off>
                  </Swap>
                  <span className="text-sm text-base-content/70" data-testid="swap-class-state">
                    当前状态：{classModeActive.value ? 'active' : 'inactive'}
                  </span>
                </div>
              </div>
            </div>
          }
          code={`const active = ref(false)

<button type="button" onClick={() => {
  active.value = !active.value
}}>
  Toggle class mode
</button>

<Swap as="div" active={active.value}>
  <Swap.On>HOT</Swap.On>
  <Swap.Off>COLD</Swap.Off>
</Swap>`}
        />

        <h2 id="swap-api">API</h2>
        <p>推荐优先使用 props 驱动模式；如果你已经有自己的隐藏 checkbox，也可以继续沿用原始结构。</p>
        <ApiTable rows={apiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">Compound parts</h3>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>
              <code>Swap.On</code>：选中态显示
            </div>
            <div>
              <code>Swap.Off</code>：未选中态显示
            </div>
            <div>
              <code>Swap.Indeterminate</code>：半选态显示
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候该手写 input，什么时候直接传 checked？</h3>
        <p>
          如果业务里只需要一个常规切换器，直接传 <code>checked</code>、<code>defaultChecked</code>、
          <code>onCheckedChange</code> 会更省事；如果你已经有现成的表单结构或需要完全接管输入节点，
          继续手写 <code>input type="checkbox"</code> 也完全可以。
        </p>

        <h3>active 和 checked 有什么区别？</h3>
        <p>
          <code>active</code> 只是追加 <code>swap-active</code>，属于 class mode；
          <code>checked</code> / <code>indeterminate</code> 则是 input mode，会驱动真实的 checkbox 状态。
        </p>

        <h3>effect 和 rotate / flip 应该怎么选？</h3>
        <p>
          新代码优先用 <code>effect</code>，表达更集中；老代码继续使用 <code>rotate</code> 或{' '}
          <code>flip</code> 也兼容。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default SwapPage
