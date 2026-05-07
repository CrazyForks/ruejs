import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Button, Fieldset, Input, Tabs } from '@rue-js/design'
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

const rootApiRows: ApiRow[] = [
  {
    prop: 'legend',
    description: '推荐写法的标题内容；未传 children 时会自动渲染到 Fieldset.Legend',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'description',
    description: '标题下方的说明文本',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '数据驱动字段项，内部自动映射为 Fieldset.Item',
    type: 'ReadonlyArray<FieldsetItemData>',
    defaultValue: '[]',
  },
  {
    prop: 'content',
    description: '自定义主体内容；适合放复杂布局',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'hint',
    description: '底部提示文本',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'actions',
    description: '底部操作区，默认右对齐',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'variant',
    description: '容器表现层，保留 Rue 当前视觉风格',
    type: `'default' | 'soft' | 'outlined'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'tone',
    description: '容器主题色，主要影响 soft / outlined 分支',
    type: `'default' | 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'size',
    description: '控制字段间距和说明文字密度，支持语义别名',
    type: `'sm' | 'md' | 'lg' | 'small' | 'middle' | 'medium' | 'large'`,
    defaultValue: `'md'`,
  },
  {
    prop: 'bordered',
    description: '默认分支下快速补一层边框和内边距',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'invalid',
    description: '错误态容器，输出错误色并补 aria-invalid',
    type: 'boolean',
    defaultValue: 'false',
  },
]

const itemApiRows: ApiRow[] = [
  {
    prop: 'label',
    description: '字段标题',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'description',
    description: '字段标题下的补充说明',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'control',
    description: '字段控件内容；不传时回退到 children',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'hint',
    description: '字段底部提示，可用于校验说明',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'required',
    description: '显示“必填”标识',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'optional',
    description: '显示“可选”标识',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'horizontal',
    description: '切换为左右两列的字段布局',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'invalid',
    description: '字段级错误态，会把标题和提示切成错误色',
    type: 'boolean',
    defaultValue: 'false',
  },
]

const partApiRows: ApiRow[] = [
  {
    prop: 'Fieldset.Legend',
    description: '保留原有 legend 组合写法，并新增 aside 右侧辅助信息',
    type: 'component',
    defaultValue: '-',
  },
  {
    prop: 'Fieldset.Label',
    description: '保留 label / p / span，并新增 div 与 tone',
    type: 'component',
    defaultValue: '-',
  },
  {
    prop: 'Fieldset.Item',
    description: '新增复合字段项，适合复用字段布局与提示文案',
    type: 'component',
    defaultValue: '-',
  },
]

const FieldsetPage: FC = () => {
  const tabRecommended = ref<TabMode>('preview')
  const tabItem = ref<TabMode>('preview')
  const tabStates = ref<TabMode>('preview')
  const tabBasic = ref<TabMode>('preview')
  const tabBorder = ref<TabMode>('preview')
  const tabMultiple = ref<TabMode>('preview')
  const tabJoin = ref<TabMode>('preview')
  const tabLogin = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Fieldset 字段集</h1>
        <p className="text-sm mt-3 mb-3">
          Fieldset 现在同时支持两类用法：保留原有的 <code>Fieldset.Legend</code> / <code>Fieldset.Label</code>{' '}
          组合写法，也补上更适合表单场景的结构化 props 与 <code>Fieldset.Item</code>。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/fieldset/" target="_blank">
            查看 Fieldset 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要把一组相关输入控件组织成一个明确的表单区块。</li>
          <li>需要同时表达标题、说明、字段提示、操作区和错误态。</li>
          <li>希望小表单走结构化 props，大表单继续保留原有 JSX 组合写法。</li>
        </ul>

        <ExampleBlock
          title="推荐写法"
          summary="legend / description / items / hint / actions 适合直接搭表单区块。"
          tab={tabRecommended}
          preview={() => (
            <Fieldset
              legend="Project details"
              description="用结构化 props 组织标题、说明、字段和动作。"
              variant="outlined"
              tone="primary"
              className="w-full max-w-xl"
              items={[
                {
                  label: 'Project name',
                  required: true,
                  control: <Input placeholder="My awesome page" />,
                  hint: '名称会显示在应用导航和工作区列表中。',
                },
                {
                  label: 'Slug',
                  description: '用于生成可读 URL，保存后可再次修改。',
                  control: <Input placeholder="my-awesome-page" />,
                },
                {
                  label: 'Owner',
                  optional: true,
                  control: <Input placeholder="dyhb" />,
                },
              ]}
              hint="保存后仍可在设置里继续调整这些字段。"
              actions={
                <>
                  <Button type="text">Cancel</Button>
                  <Button color="primary">Save project</Button>
                </>
              }
            />
          )}
          code={`<Fieldset
  legend="Project details"
  description="用结构化 props 组织标题、说明、字段和动作。"
  variant="outlined"
  tone="primary"
  items={[
    {
      label: 'Project name',
      required: true,
      control: <Input placeholder="My awesome page" />,
      hint: '名称会显示在应用导航和工作区列表中。',
    },
    {
      label: 'Slug',
      description: '用于生成可读 URL，保存后可再次修改。',
      control: <Input placeholder="my-awesome-page" />,
    },
  ]}
  hint="保存后仍可在设置里继续调整这些字段。"
  actions={
    <>
      <Button type="text">Cancel</Button>
      <Button color="primary">Save project</Button>
    </>
  }
/>`}
        />

        <ExampleBlock
          title="Fieldset.Item 复合字段"
          summary="当字段布局更复杂时，继续用 children 组合，但把重复行收敛到 Fieldset.Item。"
          tab={tabItem}
          preview={() => (
            <Fieldset variant="soft" tone="neutral" size="large" className="w-full max-w-2xl">
              <Fieldset.Legend aside="Autosave enabled">Profile settings</Fieldset.Legend>
              <Fieldset.Label as="p" className="mt-0 min-h-0 px-0 text-sm opacity-70">
                组合写法仍然可用，适合逐块拼装复杂表单。
              </Fieldset.Label>
              <Fieldset.Item
                horizontal
                label="Display name"
                required
                description="团队和评论区会优先显示这个名称。"
                control={<Input placeholder="Rue Design" />}
                hint="建议控制在 2 到 24 个字符。"
              />
              <Fieldset.Item
                horizontal
                label="Workspace URL"
                description="公开访问地址，可在发布前再次调整。"
                control={<Input placeholder="https://rue.design/workspace" />}
              />
              <Fieldset.Item
                horizontal
                label="Support email"
                optional
                hint="用于接收账单和故障通知。"
              >
                <Input type="email" placeholder="team@rue.design" />
              </Fieldset.Item>
            </Fieldset>
          )}
          code={`<Fieldset variant="soft" tone="neutral" size="large" className="w-full max-w-2xl">
  <Fieldset.Legend aside="Autosave enabled">Profile settings</Fieldset.Legend>
  <Fieldset.Label as="p" className="mt-0 min-h-0 px-0 text-sm opacity-70">
    组合写法仍然可用，适合逐块拼装复杂表单。
  </Fieldset.Label>

  <Fieldset.Item
    horizontal
    label="Display name"
    required
    description="团队和评论区会优先显示这个名称。"
    control={<Input placeholder="Rue Design" />}
    hint="建议控制在 2 到 24 个字符。"
  />

  <Fieldset.Item
    horizontal
    label="Support email"
    optional
    hint="用于接收账单和故障通知。"
  >
    <Input type="email" placeholder="team@rue.design" />
  </Fieldset.Item>
</Fieldset>`}
        />

        <ExampleBlock
          title="尺寸与状态"
          summary="size 管信息密度，invalid 管容器错误态；原生 disabled 仍透传给 fieldset。"
          tab={tabStates}
          preview={() => (
            <div className="grid gap-4 xl:grid-cols-2">
              <Fieldset
                legend="Compact settings"
                description="适合侧栏或弹窗里的轻量配置。"
                variant="outlined"
                size="small"
                className="w-full"
                items={[
                  {
                    label: 'Branch',
                    control: <Input placeholder="main" />,
                  },
                  {
                    label: 'Region',
                    optional: true,
                    control: <Input placeholder="Hangzhou" />,
                  },
                ]}
              />

              <Fieldset
                legend="Verification"
                description="错误态会统一强调标题、底部提示和边框。"
                invalid
                className="w-full"
                items={[
                  {
                    label: 'Email',
                    invalid: true,
                    control: <Input type="email" placeholder="team@rue.design" />,
                    hint: '当前邮箱尚未完成验证，请先检查收件箱。',
                  },
                  {
                    label: 'Backup email',
                    optional: true,
                    control: <Input disabled placeholder="disabled by parent fieldset" />,
                  },
                ]}
                disabled
                hint="只读模式下仍可展示当前表单结构与校验上下文。"
              />
            </div>
          )}
          code={`<Fieldset
  legend="Compact settings"
  description="适合侧栏或弹窗里的轻量配置。"
  variant="outlined"
  size="small"
  items={[
    { label: 'Branch', control: <Input placeholder="main" /> },
    { label: 'Region', optional: true, control: <Input placeholder="Hangzhou" /> },
  ]}
/>

<Fieldset
  legend="Verification"
  invalid
  disabled
  items={[
    {
      label: 'Email',
      invalid: true,
      control: <Input type="email" placeholder="team@rue.design" />,
      hint: '当前邮箱尚未完成验证，请先检查收件箱。',
    },
  ]}
  hint="只读模式下仍可展示当前表单结构与校验上下文。"
/>`}
        />

        <ExampleBlock
          title="Fieldset fieldset-legend and label"
          summary="原始基础示例保持不变，继续展示最轻量的组合写法。"
          tab={tabBasic}
          preview={() => (
            <Fieldset className="w-xs rounded-box bg-base-100 p-4 shadow-sm">
              <Fieldset.Legend>Page title</Fieldset.Legend>
              <Input placeholder="My awesome page" />
              <Fieldset.Label as="p">You can edit page title later on from settings</Fieldset.Label>
            </Fieldset>
          )}
          code={`<Fieldset className="w-xs rounded-box bg-base-100 p-4 shadow-sm">
  <Fieldset.Legend>Page title</Fieldset.Legend>
  <Input placeholder="My awesome page" />
  <Fieldset.Label as="p">You can edit page title later on from settings</Fieldset.Label>
</Fieldset>`}
        />

        <ExampleBlock
          title="Fieldset with background and border"
          summary="继续保留手动 className 覆盖方式，和新 variant 可以自由混用。"
          tab={tabBorder}
          preview={() => (
            <Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
              <Fieldset.Legend>Page title</Fieldset.Legend>
              <Input placeholder="My awesome page" />
              <Fieldset.Label as="p">You can edit page title later on from settings</Fieldset.Label>
            </Fieldset>
          )}
          code={`<Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
  <Fieldset.Legend>Page title</Fieldset.Legend>
  <Input placeholder="My awesome page" />
  <Fieldset.Label as="p">You can edit page title later on from settings</Fieldset.Label>
</Fieldset>`}
        />

        <ExampleBlock
          title="Fieldset with multiple inputs"
          summary="原有多输入框示例保留，适合对比 items 写法和纯 JSX 写法。"
          tab={tabMultiple}
          preview={() => (
            <Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
              <Fieldset.Legend>Page details</Fieldset.Legend>
              <Fieldset.Label>Title</Fieldset.Label>
              <Input placeholder="My awesome page" />
              <Fieldset.Label>Slug</Fieldset.Label>
              <Input placeholder="my-awesome-page" />
              <Fieldset.Label>Author</Fieldset.Label>
              <Input placeholder="Name" />
            </Fieldset>
          )}
          code={`<Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
  <Fieldset.Legend>Page details</Fieldset.Legend>
  <Fieldset.Label>Title</Fieldset.Label>
  <Input placeholder="My awesome page" />
  <Fieldset.Label>Slug</Fieldset.Label>
  <Input placeholder="my-awesome-page" />
  <Fieldset.Label>Author</Fieldset.Label>
  <Input placeholder="Name" />
</Fieldset>`}
        />

        <ExampleBlock
          title="Fieldset with multiple join items"
          summary="原有 join 场景保留，适合放紧凑操作条或搜索表单。"
          tab={tabJoin}
          preview={() => (
            <Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
              <Fieldset.Legend>Settings</Fieldset.Legend>
              <div className="join">
                <Input className="join-item" placeholder="Product name" />
                <Button className="join-item">save</Button>
              </div>
            </Fieldset>
          )}
          code={`<Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
  <Fieldset.Legend>Settings</Fieldset.Legend>
  <div className="join">
    <Input className="join-item" placeholder="Product name" />
    <Button className="join-item">save</Button>
  </div>
</Fieldset>`}
        />

        <ExampleBlock
          title="Login form with fieldset"
          summary="登录表单示例继续保留，能直接对照增强后的推荐结构。"
          tab={tabLogin}
          preview={() => (
            <Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
              <Fieldset.Legend>Login</Fieldset.Legend>
              <Fieldset.Label>Email</Fieldset.Label>
              <Input type="email" placeholder="Email" />
              <Fieldset.Label>Password</Fieldset.Label>
              <Input type="password" placeholder="Password" />
              <Button color="neutral" className="mt-4">
                Login
              </Button>
            </Fieldset>
          )}
          code={`<Fieldset className="w-xs rounded-box border border-base-300 bg-base-200 p-4">
  <Fieldset.Legend>Login</Fieldset.Legend>
  <Fieldset.Label>Email</Fieldset.Label>
  <Input type="email" placeholder="Email" />
  <Fieldset.Label>Password</Fieldset.Label>
  <Input type="password" placeholder="Password" />
  <Button color="neutral" className="mt-4">Login</Button>
</Fieldset>`}
        />

        <h2 id="fieldset-api">API</h2>
        <p>当前页面展示的是增强后的完整可用 API，同时保留原有 children 组合写法。</p>

        <h3>Fieldset</h3>
        <ApiTable rows={rootApiRows} />

        <h3>Fieldset.Item</h3>
        <ApiTable rows={itemApiRows} />

        <h3>复合子组件</h3>
        <ApiTable rows={partApiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">推荐用法总结</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>legend + items</code> 适合直接搭一整块表单
            </div>
            <div>
              <code>Fieldset.Item</code> 适合沉淀复用字段行
            </div>
            <div>
              <code>children + Legend/Label</code> 继续兼容原有写法
            </div>
            <div>
              <code>variant / tone / invalid</code> 用来表达区块层级和状态
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>结构化 props 和 children 可以同时用吗？</h3>
        <p>
          当前实现里，<code>children</code> 仍然是最高优先级。想走推荐写法时使用 <code>legend</code>、
          <code>description</code>、<code>items</code>；想自由拼装时继续直接写 <code>children</code>。
        </p>

        <h3>什么时候该用 items，什么时候该用 Fieldset.Item？</h3>
        <p>
          简单表单优先用 <code>items</code>，这样信息更集中；字段布局开始变复杂、需要横向排版或局部复用时，
          更适合切到 <code>Fieldset.Item</code>。
        </p>

        <h3>variant 和手写 className 会冲突吗？</h3>
        <p>
          不会。<code>variant</code> 只是给出一套推荐容器样式，仍然可以继续叠加现有的
          <code>rounded-box</code>、<code>border</code>、<code>bg-*</code> 等类名做局部覆盖。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default FieldsetPage
