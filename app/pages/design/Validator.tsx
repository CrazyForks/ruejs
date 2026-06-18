import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import Button from '../../../packages/rue-design/src/components/button'
import Tabs from '../../../packages/rue-design/src/components/tabs'
import Validator from '../../../packages/rue-design/src/components/validator'

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

type NativeValidatorField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

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

const ApiTable: FC<{ title: string; rows: ApiRow[] }> = ({ title, rows }) => {
  return (
    <div className="not-prose my-6 lg:my-8">
      <h3 className="mt-0 mb-3 text-base font-semibold text-base-content">{title}</h3>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
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
    </div>
  )
}

const syncNativeValidity = (event: Event) => {
  const field = event.currentTarget as NativeValidatorField | null
  if (!field) return
  field.setAttribute('aria-invalid', field.checkValidity() ? 'false' : 'true')
}

const syncNativeInvalid = (event: Event) => {
  const field = event.currentTarget as NativeValidatorField | null
  if (!field) return
  field.setAttribute('aria-invalid', 'true')
}

const preventPreviewSubmit = (event: Event) => {
  event.preventDefault()
}

const PasswordRulePreview: FC = () => {
  return (
    <form className="grid gap-2" onSubmit={preventPreviewSubmit}>
      <Validator
        appearance="input"
        type="password"
        required={true}
        minLength={8}
        pattern="(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}"
        title="Must include number, lowercase and uppercase letters"
        placeholder="Password"
        aria-invalid="false"
        onInvalid={syncNativeInvalid}
        onInput={syncNativeValidity}
        onBlur={syncNativeValidity}
      />
      <Validator.Hint
        hideUntilInvalid={true}
        lines={[
          'Must be at least 8 characters',
          'Must include number, lowercase and uppercase letters',
        ]}
      />
      <Button htmlType="submit" size="sm" className="w-fit">
        Check password
      </Button>
    </form>
  )
}

const UsernameRulePreview: FC = () => {
  return (
    <form className="grid gap-2" onSubmit={preventPreviewSubmit}>
      <Validator
        appearance="input"
        type="text"
        required={true}
        minLength={3}
        maxLength={30}
        pattern="[A-Za-z0-9-]+"
        title="Only letters, numbers or dash"
        placeholder="Username"
        aria-invalid="false"
        onInvalid={syncNativeInvalid}
        onInput={syncNativeValidity}
        onBlur={syncNativeValidity}
      />
      <Validator.Hint
        hideUntilInvalid={true}
        lines={['Must be 3 to 30 characters', 'Only letters, numbers or dash']}
      />
      <Button htmlType="submit" size="sm" className="w-fit">
        Check username
      </Button>
    </form>
  )
}

const validatorApiRows: ApiRow[] = [
  {
    prop: 'appearance',
    description: '自动补齐 input、select、textarea、checkbox、toggle 这些宿主类名',
    type: `'input' | 'select' | 'textarea' | 'checkbox' | 'toggle'`,
    defaultValue: '-',
  },
  {
    prop: 'as',
    description: '指定渲染标签，select 和 textarea 会自动推断对应外观',
    type: `'input' | 'select' | 'textarea'`,
    defaultValue: `'input'`,
  },
  {
    prop: 'className',
    description: '追加自定义类名，旧写法仍可继续手动传入 input / select / textarea',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'size',
    description: '按宿主类型拼接尺寸类，例如 input-lg、checkbox-sm',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl'`,
    defaultValue: '-',
  },
  {
    prop: 'status',
    description: '手动追加状态类，适合服务端校验或异步反馈场景',
    type: `'error' | 'success' | 'warning'`,
    defaultValue: '-',
  },
]

const hintApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定 hint 标签',
    type: `'div' | 'p' | 'span'`,
    defaultValue: `'p'`,
  },
  {
    prop: 'className',
    description: '追加 hint 的自定义类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'hideUntilInvalid',
    description: '自动追加 hidden 类，让 hint 在无效前不占布局空间',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'lines',
    description: '按多行规则渲染 hint 内容，每一项会单独包成一行',
    type: 'any[]',
    defaultValue: '-',
  },
]

const fieldApiRows: ApiRow[] = [
  {
    prop: 'className',
    description: 'Field 外层容器类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'controlClassName',
    description: '内部 Validator 控件的类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'extra',
    description: '底部补充说明，会以 label 风格文本渲染',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'extraClassName',
    description: 'extra 区域的类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'fieldAs',
    description: '外层容器标签，默认是 fieldset，也可切到 div',
    type: `'fieldset' | 'div'`,
    defaultValue: `'fieldset'`,
  },
  {
    prop: 'hint',
    description: '快捷生成 Validator.Hint',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'hintAs',
    description: '快捷生成的 hint 标签',
    type: `'div' | 'p' | 'span'`,
    defaultValue: `'p'`,
  },
  {
    prop: 'hintClassName',
    description: '快捷生成的 hint 类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'hideHintWhenValid',
    description: '等价于给快捷 hint 开启 hideUntilInvalid',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'label',
    description: '快捷生成字段标题，并在传入 id 时自动关联到控件',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'labelClassName',
    description: '字段标题类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'requiredMark',
    description: '强制展示必填星号，未设置时会跟随 required',
    type: 'boolean',
    defaultValue: '根据 required 推断',
  },
]

const ValidatorPage: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabHosts = ref<TabMode>('preview')
  const tabRules = ref<TabMode>('preview')
  const tabStatus = ref<TabMode>('preview')
  const tabField = ref<TabMode>('preview')
  const tabForm = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Validator 校验辅助</h1>
        <p className="text-sm mt-3 mb-3">
          Validator 仍然只负责把浏览器原生校验结果映射成 Rue
          当前的表单视觉，不引入额外校验引擎。原有的
          <code>className=&quot;input validator&quot;</code>
          写法继续可用，但现在也可以直接通过
          <code>appearance</code>、<code>size</code>、<code>status</code> 和<code>Field</code>
          组合件来组织更完整的表单场景。
        </p>
        <div className="not-prose grid gap-3 rounded-box border border-base-300 bg-base-200/70 p-4 text-sm sm:grid-cols-3">
          <div>
            <div className="font-medium text-base-content">原生校验优先</div>
            <div className="mt-1 opacity-70">
              继续依赖 required、pattern、minLength 等原生约束。
            </div>
          </div>
          <div>
            <div className="font-medium text-base-content">语义外观补齐</div>
            <div className="mt-1 opacity-70">
              用 appearance 直接映射 input、select、toggle 等宿主风格。
            </div>
          </div>
          <div>
            <div className="font-medium text-base-content">表单结构复用</div>
            <div className="mt-1 opacity-70">
              Field 统一 label、hint、extra 和基础可访问性连线。
            </div>
          </div>
        </div>

        <ExampleBlock
          title="Validator and validator-hint"
          summary="最基础的邮箱校验示例，点击按钮即可触发浏览器原生 required / email 校验和 hint 展示。"
          tab={tabBasic}
          preview={() => (
            <form className="grid w-full max-w-xs gap-2">
              <Validator
                appearance="input"
                type="email"
                required={true}
                placeholder="mail@site.com"
              />
              <Validator.Hint>Enter valid email address</Validator.Hint>
              <Button htmlType="submit" size="sm" className="w-fit">
                Check email
              </Button>
            </form>
          )}
          code={`<form className="grid w-full max-w-xs gap-2">
  <Validator appearance="input" type="email" required={true} placeholder="mail@site.com" />
  <Validator.Hint>Enter valid email address</Validator.Hint>
  <Button htmlType="submit" size="sm" className="w-fit">
    Check email
  </Button>
</form>`}
        />

        <ExampleBlock
          title="Different validator hosts"
          summary="保留原有 select 和 textarea 场景，并补上 checkbox / toggle 这种同样依赖 validator 的宿主。"
          tab={tabHosts}
          preview={() => (
            <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Validator as="select" appearance="select" required={true}>
                  <option value="">Choose:</option>
                  <option value="tabs">Tabs</option>
                  <option value="spaces">Spaces</option>
                </Validator>
                <Validator.Hint>Required</Validator.Hint>
              </div>

              <div className="grid gap-2">
                <Validator
                  as="textarea"
                  appearance="textarea"
                  rows={4}
                  placeholder="Project notes"
                  required={true}
                />
                <Validator.Hint>Required</Validator.Hint>
              </div>

              <label className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3">
                <Validator appearance="checkbox" type="checkbox" required={true} />
                <span className="text-sm text-base-content">Accept release checklist</span>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3">
                <span className="text-sm text-base-content">Enable deploy gate</span>
                <Validator appearance="toggle" type="checkbox" required={true} />
              </label>
            </div>
          )}
          code={`<Validator as="select" appearance="select" required={true}>
  <option value="">Choose:</option>
  <option value="tabs">Tabs</option>
  <option value="spaces">Spaces</option>
</Validator>
<Validator.Hint>Required</Validator.Hint>

<Validator as="textarea" appearance="textarea" rows={4} placeholder="Project notes" required={true} />
<Validator.Hint>Required</Validator.Hint>

<Validator appearance="checkbox" type="checkbox" required={true} />
<Validator appearance="toggle" type="checkbox" required={true} />`}
        />

        <ExampleBlock
          title="Hidden hint and rule list"
          summary="提交、失焦或输入时都会同步原生 invalid 状态，隐藏 hint 和多行规则列表现在会在首次校验失败后正确出现。"
          tab={tabRules}
          preview={() => (
            <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
              <PasswordRulePreview />
              <UsernameRulePreview />
            </div>
          )}
          code={`const syncNativeValidity = (event: Event) => {
  const field = event.currentTarget as HTMLInputElement | null
  if (!field) return
  field.setAttribute('aria-invalid', field.checkValidity() ? 'false' : 'true')
}

const syncNativeInvalid = (event: Event) => {
  const field = event.currentTarget as HTMLInputElement | null
  if (!field) return
  field.setAttribute('aria-invalid', 'true')
}

<form className="grid gap-2" onSubmit={event => event.preventDefault()}>
  <Validator
    appearance="input"
    type="password"
    required={true}
    minLength={8}
    pattern="(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}"
    title="Must include number, lowercase and uppercase letters"
    placeholder="Password"
    aria-invalid="false"
    onInvalid={syncNativeInvalid}
    onInput={syncNativeValidity}
    onBlur={syncNativeValidity}
  />
  <Validator.Hint
    hideUntilInvalid={true}
    lines={['Must be at least 8 characters', 'Must include number, lowercase and uppercase letters']}
  />
  <Button htmlType="submit" size="sm" className="w-fit">
    Check password
  </Button>
</form>

<form className="grid gap-2" onSubmit={event => event.preventDefault()}>
  <Validator
    appearance="input"
    type="text"
    required={true}
    minLength={3}
    maxLength={30}
    pattern="[A-Za-z0-9-]+"
    title="Only letters, numbers or dash"
    placeholder="Username"
    aria-invalid="false"
    onInvalid={syncNativeInvalid}
    onInput={syncNativeValidity}
    onBlur={syncNativeValidity}
  />
  <Validator.Hint
    hideUntilInvalid={true}
    lines={['Must be 3 to 30 characters', 'Only letters, numbers or dash']}
  />
  <Button htmlType="submit" size="sm" className="w-fit">
    Check username
  </Button>
</form>`}
        />

        <ExampleBlock
          title="Manual status and size"
          summary="status 适合展示服务端或异步校验反馈；size 则让同一套 Validator 能直接落到不同密度的表单里。"
          tab={tabStatus}
          preview={() => (
            <div className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
              <Validator.Field
                id="validator-status-error"
                label="Workspace slug"
                hint="Already taken on the edge cluster"
                appearance="input"
                size="sm"
                status="error"
                defaultValue="rue-design"
              />

              <Validator.Field
                id="validator-status-warning"
                label="Notification email"
                hint="MX record is still being verified"
                appearance="input"
                status="warning"
                defaultValue="team@rue.dev"
              />

              <Validator.Field
                id="validator-status-success"
                label="Release channel"
                hint="Synced with the latest deployment policy"
                appearance="select"
                as="select"
                size="lg"
                status="success"
              >
                <option>Stable</option>
                <option>Canary</option>
              </Validator.Field>
            </div>
          )}
          code={`<Validator.Field
  id="validator-status-error"
  label="Workspace slug"
  hint="Already taken on the edge cluster"
  appearance="input"
  size="sm"
  status="error"
  defaultValue="rue-design"
/>

<Validator.Field
  id="validator-status-warning"
  label="Notification email"
  hint="MX record is still being verified"
  appearance="input"
  status="warning"
  defaultValue="team@rue.dev"
/>

<Validator.Field
  id="validator-status-success"
  label="Release channel"
  hint="Synced with the latest deployment policy"
  appearance="select"
  as="select"
  size="lg"
  status="success"
>
  <option>Stable</option>
  <option>Canary</option>
</Validator.Field>`}
        />

        <ExampleBlock
          title="Field composition"
          summary="Field 适合搭建单个表单项：label、hint、extra 和 aria-describedby 都能一起就位。"
          tab={tabField}
          preview={() => (
            <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
              <Validator.Field
                id="validator-field-email"
                label="Project email"
                hint="Use your workspace mailbox"
                extra="This address is used for deployment notifications."
                appearance="input"
                type="email"
                required={true}
                placeholder="release@rue.dev"
                hideHintWhenValid={true}
              />

              <Validator.Field
                id="validator-field-timezone"
                label="Timezone"
                hint="Required"
                appearance="select"
                as="select"
                required={true}
              >
                <option value="">Choose:</option>
                <option value="utc+8">UTC +8</option>
                <option value="utc">UTC</option>
              </Validator.Field>

              <Validator.Field
                id="validator-field-bio"
                label="Deployment note"
                hint={['Keep it under 140 characters', 'Mention rollback owner if needed']}
                appearance="textarea"
                as="textarea"
                rows={4}
                placeholder="What changed in this release?"
                fieldAs="div"
                className="rounded-box border border-base-300 bg-base-100 p-4"
                controlClassName="w-full"
              />
            </div>
          )}
          code={`<Validator.Field
  id="validator-field-email"
  label="Project email"
  hint="Use your workspace mailbox"
  extra="This address is used for deployment notifications."
  appearance="input"
  type="email"
  required={true}
  placeholder="release@rue.dev"
  hideHintWhenValid={true}
/>

<Validator.Field
  id="validator-field-timezone"
  label="Timezone"
  hint="Required"
  appearance="select"
  as="select"
  required={true}
>
  <option value="">Choose:</option>
  <option value="utc+8">UTC +8</option>
  <option value="utc">UTC</option>
</Validator.Field>

<Validator.Field
  id="validator-field-bio"
  label="Deployment note"
  hint={['Keep it under 140 characters', 'Mention rollback owner if needed']}
  appearance="textarea"
  as="textarea"
  rows={4}
  placeholder="What changed in this release?"
  fieldAs="div"
  className="rounded-box border border-base-300 bg-base-100 p-4"
  controlClassName="w-full"
/>
`}
        />

        <ExampleBlock
          title="Form recipe"
          summary="把原有散装 demo 融合成一个更接近真实业务的登录表单，同时保持 Validator 只负责视觉反馈。"
          tab={tabForm}
          preview={() => (
            <form
              autocomplete="off"
              className="grid w-full max-w-sm gap-4 rounded-box border border-base-300 bg-base-200 p-5"
              onSubmit={(event: Event) => event.preventDefault()}
            >
              <Validator.Field
                id="validator-login-email"
                label="Email"
                hint="Required"
                appearance="input"
                type="email"
                required={true}
                placeholder="mail@site.com"
                hideHintWhenValid={true}
              />

              <Validator.Field
                id="validator-login-password"
                label="Password"
                hint={['At least 8 characters', 'Contains uppercase, lowercase and a number']}
                appearance="input"
                type="password"
                required={true}
                minLength={8}
                pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                placeholder="Password"
                hideHintWhenValid={true}
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <Button color="primary" htmlType="submit" block={true}>
                  Login
                </Button>
                <Button type="text" htmlType="reset" block={true}>
                  Reset
                </Button>
              </div>
            </form>
          )}
          code={`<form className="grid w-full max-w-sm gap-4 rounded-box border border-base-300 bg-base-200 p-5">
  <Validator.Field
    id="validator-login-email"
    label="Email"
    hint="Required"
    appearance="input"
    type="email"
    required={true}
    placeholder="mail@site.com"
    hideHintWhenValid={true}
  />

  <Validator.Field
    id="validator-login-password"
    label="Password"
    hint={['At least 8 characters', 'Contains uppercase, lowercase and a number']}
    appearance="input"
    type="password"
    required={true}
    minLength={8}
    pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
    placeholder="Password"
    hideHintWhenValid={true}
  />

  <div className="grid gap-2 sm:grid-cols-2">
    <Button color="primary" htmlType="submit" block={true}>Login</Button>
    <Button type="text" htmlType="reset" block={true}>Reset</Button>
  </div>
</form>`}
        />

        <div className="my-8 lg:my-12">
          <h2>API</h2>
          <p className="text-sm opacity-80">
            Validator 本体负责控件本身的宿主类和状态类，Hint 管理提示文案，Field
            则把常见表单项的结构和可访问性连线收敛到一处。
          </p>
          <ApiTable title="Validator" rows={validatorApiRows} />
          <ApiTable title="Validator.Hint" rows={hintApiRows} />
          <ApiTable title="Validator.Field" rows={fieldApiRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default ValidatorPage
