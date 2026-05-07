import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type ModelFieldProps = {
  label: string
  modelValue?: string
  onUpdateModelValue?: (value: string) => void
}

const ModelField: FC<ModelFieldProps> = props => {
  return (
    <label className="floating-label">
      <input
        className="input input-bordered w-full"
        value={props.modelValue ?? ''}
        onInput={(event: Event) => {
          props.onUpdateModelValue?.((event.target as HTMLInputElement).value)
        }}
      />
      <span>{props.label}</span>
    </label>
  )
}

type TitleFieldProps = {
  title?: string
  titleModifiers?: { trim?: boolean; lazy?: boolean }
  onUpdateTitle?: (value: string) => void
}

const TitleField: FC<TitleFieldProps> = props => {
  const emitTitleUpdate = (event: Event) => {
    const rawValue = (event.target as HTMLInputElement).value
    props.onUpdateTitle?.(props.titleModifiers?.trim ? rawValue.trim() : rawValue)
  }

  return (
    <label className="floating-label">
      <input
        className="input input-bordered w-full"
        value={props.title ?? ''}
        onInput={props.titleModifiers?.lazy ? undefined : emitTitleUpdate}
        onChange={props.titleModifiers?.lazy ? emitTitleUpdate : undefined}
      />
      <span>title</span>
    </label>
  )
}

type UserNameEditorProps = {
  firstName?: string
  lastName?: string
  firstNameModifiers?: { trim?: boolean; lazy?: boolean }
  lastNameModifiers?: { trim?: boolean; lazy?: boolean }
  onUpdateFirstName?: (value: string) => void
  onUpdateLastName?: (value: string) => void
}

const UserNameEditor: FC<UserNameEditorProps> = props => {
  const emitFirstNameUpdate = (event: Event) => {
    const rawValue = (event.target as HTMLInputElement).value
    props.onUpdateFirstName?.(props.firstNameModifiers?.trim ? rawValue.trim() : rawValue)
  }

  const emitLastNameUpdate = (event: Event) => {
    const rawValue = (event.target as HTMLInputElement).value
    props.onUpdateLastName?.(props.lastNameModifiers?.trim ? rawValue.trim() : rawValue)
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="floating-label">
        <input
          className="input input-bordered w-full"
          value={props.firstName ?? ''}
          onInput={props.firstNameModifiers?.lazy ? undefined : emitFirstNameUpdate}
          onChange={props.firstNameModifiers?.lazy ? emitFirstNameUpdate : undefined}
        />
        <span>firstName</span>
      </label>

      <label className="floating-label">
        <input
          className="input input-bordered w-full"
          value={props.lastName ?? ''}
          onInput={props.lastNameModifiers?.lazy ? undefined : emitLastNameUpdate}
          onChange={props.lastNameModifiers?.lazy ? emitLastNameUpdate : undefined}
        />
        <span>lastName</span>
      </label>
    </div>
  )
}

const vModelAttr = ['v', '-model'].join('')
const vModelTrimAttr = ['v', '-model', ':trim'].join('')
const rModelNumberAttr = ['r', '-model', ':number'].join('')
const rModelLazyAttr = ['r', '-model', ':lazy'].join('')
const vModelTitleTrimAttr = ['v', '-model', ':trim-title'].join('')
const vModelFirstNameAttr = ['v', '-model', ':trim-first-name'].join('')
const vModelLastNameAttr = ['v', '-model', ':lazy-last-name'].join('')

const directiveCode = [
  "import { type FC, ref } from '@rue-js/rue'",
  '',
  'const Demo: FC = () => {',
  "  const message = ref('  Rue model  ')",
  "  const trimmed = ref('  keep edges tidy  ')",
  "  const age = ref<string | number>('18')",
  "  const lazyNote = ref('blur to sync')",
  '  const accepted = ref(false)',
  "  const title = ref('Guide draft')",
  "  const articleTitle = ref('Inside Rue')",
  "  const firstName = ref('Rue')",
  "  const lastName = ref('JSX')",
  '',
  '  return (',
  '    <section className="grid gap-4">',
  '      <input className="input input-bordered" ' + vModelAttr + '={message.value} />',
  '      <input className="input input-bordered" ' + vModelTrimAttr + '={trimmed.value} />',
  '      <input type="number" className="input input-bordered" ' + rModelNumberAttr + '={age.value} />',
  '      <input className="input input-bordered" ' + rModelLazyAttr + '={lazyNote.value} />',
  '      <input type="checkbox" className="checkbox" ' + vModelAttr + '={accepted.value} />',
  '',
  '      <ModelField label="默认组件 model" ' + vModelAttr + '={title.value} />',
  '      <TitleField ' + vModelTitleTrimAttr + '={articleTitle.value} />',
  '      <UserNameEditor',
  '        ' + vModelFirstNameAttr + '={firstName.value}',
  '        ' + vModelLastNameAttr + '={lastName.value}',
  '      />',
  '    </section>',
  '  )',
  '}',
  '',
  'export default Demo',
].join('\n')

const manualCompareCode = `import { type FC, ref } from '@rue-js/rue'

const Demo: FC = () => {
  const message = ref('  Rue model  ')
  const trimmed = ref('  keep edges tidy  ')
  const age = ref<string | number>('18')
  const lazyNote = ref('blur to sync')
  const accepted = ref(false)
  const title = ref('Guide draft')
  const articleTitle = ref('Inside Rue')
  const firstName = ref('Rue')
  const lastName = ref('JSX')

  return (
    <section className="grid gap-4">
      <input
        className="input input-bordered"
        value={message.value}
        onInput={event => {
          message.value = (event.target as HTMLInputElement).value
        }}
      />

      <input
        className="input input-bordered"
        value={trimmed.value}
        onInput={event => {
          trimmed.value = (event.target as HTMLInputElement).value.trim()
        }}
      />

      <input
        type="number"
        className="input input-bordered"
        value={String(age.value)}
        onInput={event => {
          const value = (event.target as HTMLInputElement).value
          const parsed = parseFloat(value)
          age.value = Number.isNaN(parsed) ? value : parsed
        }}
      />

      <input
        className="input input-bordered"
        value={lazyNote.value}
        onChange={event => {
          lazyNote.value = (event.target as HTMLInputElement).value
        }}
      />

      <input
        type="checkbox"
        className="checkbox"
        checked={accepted.value}
        onChange={event => {
          accepted.value = (event.target as HTMLInputElement).checked
        }}
      />

      <ModelField
        label="默认组件 model"
        modelValue={title.value}
        onUpdateModelValue={value => {
          title.value = value
        }}
      />

      <TitleField
        title={articleTitle.value}
        titleModifiers={{ trim: true }}
        onUpdateTitle={value => {
          articleTitle.value = value
        }}
      />

      <UserNameEditor
        firstName={firstName.value}
        lastName={lastName.value}
        firstNameModifiers={{ trim: true }}
        lastNameModifiers={{ lazy: true }}
        onUpdateFirstName={value => {
          firstName.value = value
        }}
        onUpdateLastName={value => {
          lastName.value = value
        }}
      />
    </section>
  )
}

export default Demo`

const modifierSyntaxCode = [
  '// TSX-safe 内建修饰符写法',
  '<input ' + vModelTrimAttr + '={message.value} />',
  '<input ' + rModelNumberAttr + '={age.value} />',
  '<input ' + rModelLazyAttr + '={lazyNote.value} />',
  '<TitleField ' + vModelTitleTrimAttr + '={articleTitle.value} />',
  '<UserNameEditor ' + vModelFirstNameAttr + '={firstName.value} />',
  '<UserNameEditor ' + vModelLastNameAttr + '={lastName.value} />',
  '',
  '// 冒号后的前导内建修饰符会映射到 xxxModifiers，并在原生元素上切换 input/change 等行为',
].join('\n')

const componentMappingCode = `// 实际 Rue TSX
<ModelField v-model={title.value} />
<TitleField v-model:trim-title={articleTitle.value} />
<UserNameEditor
  v-model:trim-first-name={firstName.value}
  v-model:lazy-last-name={lastName.value}
/>

// 等价手写 props
<ModelField
  modelValue={title.value}
  onUpdateModelValue={value => {
    title.value = value
  }}
/>

<TitleField
  title={articleTitle.value}
  titleModifiers={{ trim: true }}
  onUpdateTitle={value => {
    articleTitle.value = value
  }}
/>

<UserNameEditor
  firstName={firstName.value}
  lastName={lastName.value}
  firstNameModifiers={{ trim: true }}
  lastNameModifiers={{ lazy: true }}
  onUpdateFirstName={value => {
    firstName.value = value
  }}
  onUpdateLastName={value => {
    lastName.value = value
  }}
/>`

const updateText = (model: { value: string }, event: Event) => {
  model.value = (event.target as HTMLInputElement).value
}

const updateTrimmedText = (model: { value: string }, event: Event) => {
  model.value = (event.target as HTMLInputElement).value.trim()
}

const updateNumber = (model: { value: string | number }, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  const parsed = parseFloat(value)
  model.value = Number.isNaN(parsed) ? value : parsed
}

const updateCheckbox = (model: { value: boolean }, event: Event) => {
  model.value = (event.target as HTMLInputElement).checked
}

const VModelAndRModel: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  const message = ref('  Rue model  ')
  const trimmedMessage = ref('  keep edges tidy  ')
  const age = ref<string | number>('18')
  const lazyNote = ref('blur to sync')
  const accepted = ref(false)
  const title = ref('Guide draft')
  const articleTitle = ref('Inside Rue')
  const firstName = ref('Rue')
  const lastName = ref('JSX')

  const manualMessage = ref('  Rue model  ')
  const manualTrimmedMessage = ref('  keep edges tidy  ')
  const manualAge = ref<string | number>('18')
  const manualLazyNote = ref('blur to sync')
  const manualAccepted = ref(false)

  return (
    <SidebarPlayground>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-5xl font-semibold">v-model / r-model</h1>
          <p className="text-base-content/70 max-w-3xl">
            这页直接对齐 v-on 页面：一边给真实 Rue TSX 写法，一边给手写 value / checked /
            modelValue 的等价实现，预览里也直接跑真实 v-model / r-model。
          </p>
        </div>

        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            role="tab"
            className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
            onClick={() => {
              activeTab.value = 'preview'
            }}
          >
            效果
          </button>
          <button
            role="tab"
            className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
            onClick={() => {
              activeTab.value = 'code'
            }}
          >
            代码
          </button>
        </div>

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-6">
              <div role="alert" className="alert alert-info">
                <span>
                  左列是当前真实可写进 TSX 的 v-model / r-model，右列是手写等价实现。组件部分则把真实指令预览和等价 props 写法并排展示。
                </span>
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">原生输入：真实指令 vs 手写等价</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-primary">directive</span>
                    <span className="badge badge-secondary">manual</span>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2 items-start">
                  <div className="rounded-box border border-base-300 bg-base-100 p-4 grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">Rue TSX 实际写法</h3>
                      <span className="badge badge-primary">v-model / r-model</span>
                    </div>

                    <label className="floating-label">
                      <input className="input input-bordered w-full" v-model={message.value} />
                      <span>v-model</span>
                    </label>

                    <label className="floating-label">
                      <input className="input input-bordered w-full" v-model:trim={trimmedMessage.value} />
                      <span>v-model:trim</span>
                    </label>

                    <label className="floating-label">
                      <input type="number" className="input input-bordered w-full" r-model:number={age.value} />
                      <span>r-model:number</span>
                    </label>

                    <label className="floating-label">
                      <input className="input input-bordered w-full" r-model:lazy={lazyNote.value} />
                      <span>r-model:lazy</span>
                    </label>

                    <label className="label cursor-pointer justify-start gap-3">
                      <input type="checkbox" className="checkbox" v-model={accepted.value} />
                      <span className="label-text">v-model checkbox</span>
                    </label>

                    <div className="rounded-box border border-base-300 bg-base-200 p-4 text-sm">
                      <p>message: {message.value || '空'}</p>
                      <p>trimmed: {trimmedMessage.value || '空'}</p>
                      <p>age: {String(age.value)}</p>
                      <p>lazy: {lazyNote.value || '空'}</p>
                      <p>accepted: {accepted.value ? 'true' : 'false'}</p>
                    </div>
                  </div>

                  <div className="rounded-box border border-base-300 bg-base-100 p-4 grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">手写 value / checked 对照</h3>
                      <span className="badge badge-secondary">manual</span>
                    </div>

                    <label className="floating-label">
                      <input
                        className="input input-bordered w-full"
                        value={manualMessage.value}
                        onInput={(event: Event) => {
                          updateText(manualMessage, event)
                        }}
                      />
                      <span>value + onInput</span>
                    </label>

                    <label className="floating-label">
                      <input
                        className="input input-bordered w-full"
                        value={manualTrimmedMessage.value}
                        onInput={(event: Event) => {
                          updateTrimmedText(manualTrimmedMessage, event)
                        }}
                      />
                      <span>trim 后手写写回</span>
                    </label>

                    <label className="floating-label">
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={String(manualAge.value)}
                        onInput={(event: Event) => {
                          updateNumber(manualAge, event)
                        }}
                      />
                      <span>parseFloat 后手写写回</span>
                    </label>

                    <label className="floating-label">
                      <input
                        className="input input-bordered w-full"
                        value={manualLazyNote.value}
                        onChange={(event: Event) => {
                          updateText(manualLazyNote, event)
                        }}
                      />
                      <span>onChange 延迟同步</span>
                    </label>

                    <label className="label cursor-pointer justify-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={manualAccepted.value}
                        onChange={(event: Event) => {
                          updateCheckbox(manualAccepted, event)
                        }}
                      />
                      <span className="label-text">checked + onChange</span>
                    </label>

                    <div className="rounded-box border border-base-300 bg-base-200 p-4 text-sm">
                      <p>message: {manualMessage.value || '空'}</p>
                      <p>trimmed: {manualTrimmedMessage.value || '空'}</p>
                      <p>age: {String(manualAge.value)}</p>
                      <p>lazy: {manualLazyNote.value || '空'}</p>
                      <p>accepted: {manualAccepted.value ? 'true' : 'false'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">组件：真实 v-model vs 等价 props</h2>
                  <span className="badge badge-info badge-lg">component compare</span>
                </div>

                <div className="grid gap-4 xl:grid-cols-2 items-start">
                  <div className="rounded-box border border-base-300 bg-base-100 p-4 grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">Rue TSX 实际组件写法</h3>
                      <span className="badge badge-primary">v-model</span>
                    </div>

                    <ModelField label="v-model={title.value}" v-model={title.value} />

                    <TitleField v-model:trim-title={articleTitle.value} />

                    <UserNameEditor
                      v-model:trim-first-name={firstName.value}
                      v-model:lazy-last-name={lastName.value}
                    />

                    <div className="rounded-box border border-base-300 bg-base-200 p-4 text-sm">
                      <p>title: {title.value || '空'}</p>
                      <p>articleTitle: {articleTitle.value || '空'}</p>
                      <p>firstName / lastName: {firstName.value} {lastName.value}</p>
                    </div>
                  </div>

                  <div className="rounded-box border border-base-300 bg-base-100 p-4 grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">等价手写 props</h3>
                      <span className="badge badge-secondary">modelValue / onUpdateX</span>
                    </div>

                    <Code className="h-full" lang="tsx" code={componentMappingCode} />

                    <div className="rounded-box border border-base-300 bg-base-200 p-4 text-sm">
                      <p><strong>v-model</strong> -&gt; modelValue + onUpdateModelValue</p>
                      <p><strong>v-model:trim-title</strong> -&gt; title + titleModifiers + onUpdateTitle</p>
                      <p><strong>v-model:trim-first-name</strong> -&gt; firstName + firstNameModifiers + onUpdateFirstName</p>
                      <p><strong>v-model:lazy-last-name</strong> -&gt; lastName + lastNameModifiers + onUpdateLastName</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab.value === 'code' && (
          <div className="grid gap-6">
            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">Rue TSX 实际源码</h2>
                <Code className="h-full" lang="tsx" code={directiveCode} />
              </div>
            </div>

            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">手写 modelValue / value 对照</h2>
                <Code className="h-full" lang="tsx" code={manualCompareCode} />
              </div>
            </div>

            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">TSX-safe 修饰符写法</h2>
                <Code className="h-full" lang="tsx" code={modifierSyntaxCode} />
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VModelAndRModel