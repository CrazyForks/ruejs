import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Stack, Tabs } from '@rue-js/design'
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

const apiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签或组件，适合 section、article 等语义容器。',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'className',
    description: '补充容器尺寸、圆角、边框、背景等样式。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'horizontal',
    description: '水平方向定位；显式传入时会覆盖 placement 里的水平预设。',
    type: `'center' | 'start' | 'end'`,
    defaultValue: `'center'`,
  },
  {
    prop: 'placement',
    description: '组合定位快捷写法，用一条属性同时声明 vertical 和 horizontal。',
    type: `'center' | 'top' | 'bottom' | 'start' | 'end' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'`,
    defaultValue: `'center'`,
  },
  {
    prop: 'reverse',
    description: '反转子节点渲染顺序，适合把最新项放在最上层。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'vertical',
    description: '垂直方向定位；显式传入时会覆盖 placement 里的垂直预设。',
    type: `'center' | 'top' | 'bottom'`,
    defaultValue: `'center'`,
  },
]

const StackPage: FC = () => {
  const tabs = {
    basic: ref<TabMode>('preview'),
    images: ref<TabMode>('preview'),
    cards: ref<TabMode>('preview'),
    alignment: ref<TabMode>('preview'),
    reverse: ref<TabMode>('preview'),
    shadow: ref<TabMode>('preview'),
    notifications: ref<TabMode>('preview'),
    scene: ref<TabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Stack 堆叠容器</h1>
        <p className="text-sm mt-3 mb-3">
          Stack 保留 Rue 当前的 stack 视觉风格，同时把 API 补成更清晰的语义层。除了原有的
          <code>vertical</code> 和 <code>horizontal</code>，现在还支持 <code>placement</code>{' '}
          组合定位，以及
          <code>reverse</code> 反向层级。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/stack/" target="_blank">
            查看 Stack 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要把多张卡片、图片、文件封面或通知面板做成同一视觉堆叠。</li>
          <li>需要用一条属性快速切换堆叠朝向和落点，而不想反复记忆底层 class。</li>
          <li>需要保留已有堆叠视觉，但希望额外控制最新项是否位于最上层。</li>
        </ul>

        <ExampleBlock
          title="基础堆叠"
          summary="保留原来的 3 div stack demo，作为最小可用写法。"
          tab={tabs.basic}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Stack className="h-20 w-32" data-testid="stack-basic">
                  <div className="grid place-content-center rounded-box bg-primary text-primary-content">
                    1
                  </div>
                  <div className="grid place-content-center rounded-box bg-accent text-accent-content">
                    2
                  </div>
                  <div className="grid place-content-center rounded-box bg-secondary text-secondary-content">
                    3
                  </div>
                </Stack>
              </div>
            </div>
          )}
          code={`<Stack className="h-20 w-32">
  <div className="grid place-content-center rounded-box bg-primary text-primary-content">1</div>
  <div className="grid place-content-center rounded-box bg-accent text-accent-content">2</div>
  <div className="grid place-content-center rounded-box bg-secondary text-secondary-content">3</div>
</Stack>`}
        />

        <ExampleBlock
          title="图片堆叠"
          summary="保留原来的 stacked images，用于相册封面或图库预览。"
          tab={tabs.images}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Stack className="w-48" data-testid="stack-images">
                  <img
                    src="https://img.daisyui.com/images/stock/photo-1572635148818-ef6fd45eb394.webp"
                    alt="Stack example 1"
                    className="rounded-box"
                  />
                  <img
                    src="https://img.daisyui.com/images/stock/photo-1565098772267-60af42b81ef2.webp"
                    alt="Stack example 2"
                    className="rounded-box"
                  />
                  <img
                    src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp"
                    alt="Stack example 3"
                    className="rounded-box"
                  />
                </Stack>
              </div>
            </div>
          )}
          code={`<Stack className="w-48">
  <img
    src="https://img.daisyui.com/images/stock/photo-1572635148818-ef6fd45eb394.webp"
    alt="Stack example 1"
    className="rounded-box"
  />
  <img
    src="https://img.daisyui.com/images/stock/photo-1565098772267-60af42b81ef2.webp"
    alt="Stack example 2"
    className="rounded-box"
  />
  <img
    src="https://img.daisyui.com/images/stock/photo-1559703248-dcaaec9fab78.webp"
    alt="Stack example 3"
    className="rounded-box"
  />
</Stack>`}
        />

        <ExampleBlock
          title="卡片堆叠"
          summary="保留原来的 stacked cards，适合做 deck、ticket 或文件层。"
          tab={tabs.cards}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Stack className="size-28" data-testid="stack-cards">
                  <div className="card border border-base-content bg-base-100 text-center">
                    <div className="card-body">A</div>
                  </div>
                  <div className="card border border-base-content bg-base-100 text-center">
                    <div className="card-body">B</div>
                  </div>
                  <div className="card border border-base-content bg-base-100 text-center">
                    <div className="card-body">C</div>
                  </div>
                </Stack>
              </div>
            </div>
          )}
          code={`<Stack className="size-28">
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">A</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">B</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">C</div>
  </div>
</Stack>`}
        />

        <ExampleBlock
          title="对齐与 Placement"
          summary="旧的 vertical / horizontal 继续可用；新增 placement 可以直接表达组合定位。"
          tab={tabs.alignment}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div
                className="card-body grid gap-6 md:grid-cols-4"
                data-testid="stack-alignment-grid"
              >
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/60">
                    vertical=&quot;top&quot;
                  </span>
                  <Stack className="size-28" vertical="top">
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">A</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">B</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">C</div>
                    </div>
                  </Stack>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/60">
                    horizontal=&quot;start&quot;
                  </span>
                  <Stack className="size-28" horizontal="start">
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">A</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">B</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">C</div>
                    </div>
                  </Stack>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/60">
                    placement=&quot;top-end&quot;
                  </span>
                  <Stack className="size-28" placement="top-end">
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">A</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">B</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">C</div>
                    </div>
                  </Stack>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/60">
                    placement=&quot;bottom-start&quot;
                  </span>
                  <Stack className="size-28" placement="bottom-start">
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">A</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">B</div>
                    </div>
                    <div className="card border border-base-content bg-base-100 text-center">
                      <div className="card-body">C</div>
                    </div>
                  </Stack>
                </div>
              </div>
            </div>
          )}
          code={`<Stack className="size-28" vertical="top">
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">A</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">B</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">C</div>
  </div>
</Stack>

<Stack className="size-28" horizontal="start">
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">A</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">B</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">C</div>
  </div>
</Stack>

<Stack className="size-28" placement="top-end">
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">A</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">B</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">C</div>
  </div>
</Stack>

<Stack className="size-28" placement="bottom-start">
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">A</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">B</div>
  </div>
  <div className="card border border-base-content bg-base-100 text-center">
    <div className="card-body">C</div>
  </div>
</Stack>`}
        />

        <ExampleBlock
          title="反向层级"
          summary="reverse 适合把最新版本、最新消息或最新封面放在最上层。"
          tab={tabs.reverse}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-5 md:grid md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">
                    Default order
                  </div>
                  <Stack className="w-44">
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      v1 Initial draft
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      v2 Review notes
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      v3 Final copy
                    </div>
                  </Stack>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">
                    reverse
                  </div>
                  <Stack className="w-44" reverse>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      v1 Initial draft
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      v2 Review notes
                    </div>
                    <div className="rounded-box border border-primary/30 bg-primary/5 p-4 text-primary">
                      v3 Final copy
                    </div>
                  </Stack>
                </div>
              </div>
            </div>
          )}
          code={`<Stack className="w-44" reverse>
  <div className="rounded-box border border-base-300 bg-base-100 p-4">v1 Initial draft</div>
  <div className="rounded-box border border-base-300 bg-base-100 p-4">v2 Review notes</div>
  <div className="rounded-box border border-primary/30 bg-primary/5 p-4 text-primary">v3 Final copy</div>
</Stack>`}
        />

        <ExampleBlock
          title="阴影层次"
          summary="保留原来的 shadow 示例，适合强调卡片深度和层级关系。"
          tab={tabs.shadow}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Stack>
                  <div className="card bg-base-200 text-center shadow-md">
                    <div className="card-body">A</div>
                  </div>
                  <div className="card bg-base-200 text-center shadow">
                    <div className="card-body">B</div>
                  </div>
                  <div className="card bg-base-200 text-center shadow-sm">
                    <div className="card-body">C</div>
                  </div>
                </Stack>
              </div>
            </div>
          )}
          code={`<Stack>
  <div className="card bg-base-200 text-center shadow-md"><div className="card-body">A</div></div>
  <div className="card bg-base-200 text-center shadow"><div className="card-body">B</div></div>
  <div className="card bg-base-200 text-center shadow-sm"><div className="card-body">C</div></div>
</Stack>`}
        />

        <ExampleBlock
          title="通知堆叠"
          summary="保留原来的通知 demo，并结合 reverse 展示“最新一条在最上层”的常见用法。"
          tab={tabs.notifications}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Stack className="w-full max-w-md" reverse>
                  <div className="card bg-base-100 shadow-md">
                    <div className="card-body">
                      <h2 className="card-title">Notification 1</h2>
                      <p>You have 3 unread messages. Tap here to see.</p>
                    </div>
                  </div>
                  <div className="card bg-base-100 shadow-md">
                    <div className="card-body">
                      <h2 className="card-title">Notification 2</h2>
                      <p>Deploy finished successfully. Tap here to open the report.</p>
                    </div>
                  </div>
                  <div className="card border border-success/30 bg-success/5 shadow-md">
                    <div className="card-body">
                      <h2 className="card-title text-success">Notification 3</h2>
                      <p>Latest release is live. Tap here to share the changelog.</p>
                    </div>
                  </div>
                </Stack>
              </div>
            </div>
          )}
          code={`<Stack className="w-full max-w-md" reverse>
  <div className="card bg-base-100 shadow-md">
    <div className="card-body">
      <h2 className="card-title">Notification 1</h2>
      <p>You have 3 unread messages. Tap here to see.</p>
    </div>
  </div>
  <div className="card bg-base-100 shadow-md">
    <div className="card-body">
      <h2 className="card-title">Notification 2</h2>
      <p>Deploy finished successfully. Tap here to open the report.</p>
    </div>
  </div>
  <div className="card border border-success/30 bg-success/5 shadow-md">
    <div className="card-body">
      <h2 className="card-title text-success">Notification 3</h2>
      <p>Latest release is live. Tap here to share the changelog.</p>
    </div>
  </div>
</Stack>`}
        />

        <ExampleBlock
          title="场景组合"
          summary="把 as、placement、reverse 和 className 组合起来，可以很快搭出带语义的堆叠封面。"
          tab={tabs.scene}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-6 md:grid md:grid-cols-2">
                <section>
                  <div className="mb-3 text-sm font-medium">Release deck</div>
                  <Stack
                    as="section"
                    className="w-56"
                    placement="bottom-end"
                    aria-label="release deck"
                  >
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="text-xs uppercase opacity-60">Draft</div>
                      <div className="mt-1 font-semibold">Roadmap 2026</div>
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="text-xs uppercase opacity-60">Review</div>
                      <div className="mt-1 font-semibold">Product launch notes</div>
                    </div>
                    <div className="rounded-box border border-primary/30 bg-primary text-primary-content p-4">
                      <div className="text-xs uppercase opacity-80">Published</div>
                      <div className="mt-1 font-semibold">April release</div>
                    </div>
                  </Stack>
                </section>

                <section>
                  <div className="mb-3 text-sm font-medium">Asset pile</div>
                  <Stack className="w-56" placement="top-start" reverse>
                    <div className="rounded-box bg-neutral p-4 text-neutral-content">hero.png</div>
                    <div className="rounded-box bg-secondary p-4 text-secondary-content">
                      thumbnail.png
                    </div>
                    <div className="rounded-box bg-accent p-4 text-accent-content">
                      open-graph.png
                    </div>
                  </Stack>
                </section>
              </div>
            </div>
          )}
          code={`<Stack as="section" className="w-56" placement="bottom-end" aria-label="release deck">
  <div className="rounded-box border border-base-300 bg-base-100 p-4">Draft</div>
  <div className="rounded-box border border-base-300 bg-base-100 p-4">Review</div>
  <div className="rounded-box border border-primary/30 bg-primary text-primary-content p-4">Published</div>
</Stack>

<Stack className="w-56" placement="top-start" reverse>
  <div className="rounded-box bg-neutral p-4 text-neutral-content">hero.png</div>
  <div className="rounded-box bg-secondary p-4 text-secondary-content">thumbnail.png</div>
  <div className="rounded-box bg-accent p-4 text-accent-content">open-graph.png</div>
</Stack>`}
        />

        <h2 id="stack-api">API</h2>
        <p>当前页面展示的是 Stack 的完整可用 API，旧属性保留，新属性作为语义增强层补充进来。</p>

        <ApiTable rows={apiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">placement 快捷映射</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>placement="top"</code> → <code>vertical="top"</code>
            </div>
            <div>
              <code>placement="bottom"</code> → <code>vertical="bottom"</code>
            </div>
            <div>
              <code>placement="start"</code> → <code>horizontal="start"</code>
            </div>
            <div>
              <code>placement="end"</code> → <code>horizontal="end"</code>
            </div>
            <div>
              <code>placement="top-start"</code> → <code>vertical="top" + horizontal="start"</code>
            </div>
            <div>
              <code>placement="bottom-end"</code> →{' '}
              <code>vertical="bottom" + horizontal="end"</code>
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>已经有 vertical 和 horizontal，为什么还要加 placement？</h3>
        <p>
          <code>placement</code> 适合快速写组合定位，尤其是 <code>top-end</code>、
          <code>bottom-start</code> 这类常见场景。 如果你已经在用旧 API，也可以继续沿用原来的{' '}
          <code>vertical</code> 和 <code>horizontal</code>。
        </p>

        <h3>placement 和 vertical / horizontal 同时传会怎样？</h3>
        <p>
          显式传入的 <code>vertical</code>、<code>horizontal</code> 优先级更高。也就是说，
          <code>placement</code> 更像一个快捷预设，而不是强制覆盖层。
        </p>

        <h3>reverse 会改变样式还是改变 DOM 顺序？</h3>
        <p>
          <code>reverse</code>{' '}
          会反转子节点渲染顺序，因此最适合“最新项在最上层”的内容流场景，比如通知、版本封面、设计稿堆叠。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default StackPage
