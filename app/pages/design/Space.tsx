import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Badge, Button, Dropdown, Input, Space, Tooltip } from '@rue-js/design'
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

const CompactGlyph: FC<{ label: string }> = ({ label }) => {
  return (
    <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-[0.12em]">
      {label}
    </span>
  )
}

const compactRailMenuItems = [
  { key: 'report', label: 'Report', icon: <CompactGlyph label="RP" /> },
  { key: 'mail', label: 'Mail', icon: <CompactGlyph label="ML" /> },
  { key: 'mobile', label: 'Mobile', icon: <CompactGlyph label="MB" /> },
]

const compactPrimaryMenuItems = [
  { key: 'first', label: '1st item' },
  { key: 'second', label: '2nd item' },
  { key: 'third', label: '3rd item' },
]

const spaceApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签或组件，适合 section、nav、article 等语义容器。',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'size',
    description:
      '主轴与交叉轴间距，支持 small / middle / large、数字像素值和 [columnGap, rowGap]。',
    type: `'small' | 'middle' | 'large' | number | string | [SpaceSize, SpaceSize]`,
    defaultValue: `'small'`,
  },
  {
    prop: 'direction',
    description: '主轴方向，保留 horizontal / vertical 两种布局。',
    type: `'horizontal' | 'vertical'`,
    defaultValue: `'horizontal'`,
  },
  {
    prop: 'orientation',
    description: 'direction 的同义增强写法，适合和其他 Rue 组件保持语义一致。',
    type: `'horizontal' | 'vertical'`,
    defaultValue: '-',
  },
  {
    prop: 'vertical',
    description: '纵向快捷开关，传入 true 时直接切为 vertical。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'align',
    description: '交叉轴对齐，水平布局默认 center，垂直布局按内容自然拉伸。',
    type: `'start' | 'end' | 'center' | 'baseline' | 'stretch'`,
    defaultValue: `'center'（horizontal）`,
  },
  {
    prop: 'separator / split',
    description: '在相邻项之间插入分隔内容；自定义节点推荐传函数，确保每次都生成新的分隔符实例。',
    type: 'any | (() => any)',
    defaultValue: '-',
  },
  {
    prop: 'wrap',
    description: '允许水平排列在空间不足时自动换行。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'block',
    description: '让容器使用 flex 并占满可用宽度，适合工具条和过滤区。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'itemClassName / itemStyle',
    description: '补充每个子项包装层的类名和内联样式，适合卡片、徽标和统计组。',
    type: 'string / Record<string, any>',
    defaultValue: '-',
  },
  {
    prop: 'className / style',
    description: '补充根容器样式。',
    type: 'string / Record<string, any>',
    defaultValue: '-',
  },
]

const compactApiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '指定根节点标签或组件。',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'direction / orientation / vertical',
    description: 'Compact 的横向或纵向编排方式。',
    type: `'horizontal' | 'vertical' | boolean`,
    defaultValue: `'horizontal'`,
  },
  {
    prop: 'block',
    description: '让 Compact 组占满宽度，适合表单工具条和移动端批量操作。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'size',
    description: '用于调整 Compact 壳层的密度，适合文本段、标签组或自定义内容；不会生成子项间距。',
    type: `'small' | 'middle' | 'large' | number | string`,
    defaultValue: '-',
  },
  {
    prop: 'className / style',
    description: '补充根容器样式。',
    type: 'string / Record<string, any>',
    defaultValue: '-',
  },
]

const basicCode = `<Space>
  <Button color="primary">Run build</Button>
  <Button color="secondary" variant="outline">Preview</Button>
  <Badge color="neutral">workspace</Badge>
</Space>`

const directionCode = `<div className="grid gap-4 lg:grid-cols-2">
  <Space align="start" className="rounded-box border border-base-300 bg-base-100 p-4">
    <Badge color="primary">baseline</Badge>
    <span className="text-2xl font-semibold">24h</span>
    <span className="text-sm opacity-60">fresh</span>
  </Space>

  <Space vertical align="stretch" className="rounded-box border border-base-300 bg-base-100 p-4">
    <div className="rounded-box bg-base-200 px-3 py-2">Upload assets</div>
    <div className="rounded-box bg-base-200 px-3 py-2">Sync routes</div>
    <div className="rounded-box bg-base-200 px-3 py-2">Publish preview</div>
  </Space>
</div>`

const sizeCode = `<div className="space-y-4">
  <Space size="small">
    <Badge color="primary">small</Badge>
    <Badge color="secondary">8px token</Badge>
    <Badge color="accent">dense</Badge>
  </Space>

  <Space size="middle">
    <Badge color="primary">middle</Badge>
    <Badge color="secondary">balanced</Badge>
    <Badge color="accent">12px token</Badge>
  </Space>

  <Space size={[28, 14]} wrap className="max-w-xl">
    <Badge color="neutral">tuple gap</Badge>
    <Badge color="info">column 28</Badge>
    <Badge color="success">row 14</Badge>
    <Badge color="warning">wrap aware</Badge>
    <Badge color="error">custom density</Badge>
  </Space>
</div>`

const wrapCode = `<Space wrap size={[16, 12]} className="max-w-2xl rounded-box border border-dashed border-base-300 bg-base-100 p-4">
  <Badge color="primary">router</Badge>
  <Badge color="secondary">runtime-vapor</Badge>
  <Badge color="accent">design-system</Badge>
  <Badge color="neutral">sfc playground</Badge>
  <Badge color="info">bench</Badge>
  <Badge color="success">release</Badge>
  <Badge color="warning">compat</Badge>
  <Badge color="error">incident</Badge>
</Space>`

const separatorCode = `<Space separator={() => <span className="text-xs uppercase tracking-[0.2em] opacity-35">/</span>}>
  <a className="link link-hover">Workspace</a>
  <a className="link link-hover">Design</a>
  <span className="font-medium">Space</span>
</Space>`

const compactToolbarCode = `<Space.Compact className="w-full max-w-3xl">
  <Input className="w-full" placeholder="Search component or token" />
  <select className="select w-full min-w-40">
    <option>All teams</option>
    <option>Design infra</option>
    <option>Runtime</option>
  </select>
  <Button className="w-full lg:w-auto" color="primary">Search</Button>
</Space.Compact>`

const compactVerticalCode = `<Space.Compact vertical block className="w-full max-w-sm">
  <Input className="w-full" placeholder="Campaign title" />
  <Input className="w-full" placeholder="Owner" />
  <Button className="w-full" color="primary">Create workspace</Button>
</Space.Compact>`

const compactButtonsCode = `<div className="space-y-4">
  <Space.Compact block>
    <Tooltip title="Like">
      <Button shape="square" aria-label="Like" icon={<span aria-hidden="true">LK</span>} />
    </Tooltip>
    <Tooltip title="Comment">
      <Button shape="square" aria-label="Comment" icon={<span aria-hidden="true">CM</span>} />
    </Tooltip>
    <Tooltip title="Star">
      <Button shape="square" aria-label="Star" icon={<span aria-hidden="true">ST</span>} />
    </Tooltip>
    <Tooltip title="Heart">
      <Button shape="square" aria-label="Heart" icon={<span aria-hidden="true">HT</span>} />
    </Tooltip>
    <Tooltip title="Share">
      <Button shape="square" aria-label="Share" icon={<span aria-hidden="true">SH</span>} />
    </Tooltip>
    <Tooltip title="Download">
      <Button shape="square" aria-label="Download" icon={<span aria-hidden="true">DL</span>} />
    </Tooltip>
    <Dropdown trigger="click" placement="bottomRight" items={compactRailMenuItems}>
      <Button shape="square" aria-label="More actions" icon={<span aria-hidden="true">...</span>} />
    </Dropdown>
  </Space.Compact>

  <Space.Compact block>
    <Button color="primary">Button 1</Button>
    <Button color="primary">Button 2</Button>
    <Button color="primary">Button 3</Button>
    <Button color="primary">Button 4</Button>
    <Tooltip title="Download disabled">
      <Button color="primary" shape="square" disabled aria-label="Download disabled" icon={<span aria-hidden="true">DL</span>} />
    </Tooltip>
    <Tooltip title="Download">
      <Button color="primary" shape="square" aria-label="Download" icon={<span aria-hidden="true">DL</span>} />
    </Tooltip>
  </Space.Compact>

  <Space.Compact block>
    <Button>Button 1</Button>
    <Button>Button 2</Button>
    <Button>Button 3</Button>
    <Tooltip title="Download disabled">
      <Button shape="square" disabled aria-label="Download disabled" icon={<span aria-hidden="true">DL</span>} />
    </Tooltip>
    <Tooltip title="Download">
      <Button shape="square" aria-label="Download" icon={<span aria-hidden="true">DL</span>} />
    </Tooltip>
    <Button color="primary">Button 4</Button>
    <Dropdown trigger="click" placement="bottomRight" items={compactPrimaryMenuItems}>
      <Button color="primary" shape="square" aria-label="More actions" icon={<span aria-hidden="true">...</span>} />
    </Dropdown>
  </Space.Compact>
</div>`

const compactVerticalButtonsCode = `<Space size="large" wrap>
  <Space.Compact orientation="vertical" className="w-40">
    <Button block className="justify-start">Button 1</Button>
    <Button block className="justify-start">Button 2</Button>
    <Button block className="justify-start">Button 3</Button>
  </Space.Compact>

  <Space.Compact orientation="vertical" className="w-40">
    <Button block type="dashed" className="justify-start">Button 1</Button>
    <Button block type="dashed" className="justify-start">Button 2</Button>
    <Button block type="dashed" className="justify-start">Button 3</Button>
  </Space.Compact>

  <Space.Compact orientation="vertical" className="w-40">
    <Button block color="primary" className="justify-start">Button 1</Button>
    <Button block color="primary" className="justify-start">Button 2</Button>
    <Button block color="primary" className="justify-start">Button 3</Button>
  </Space.Compact>

  <Space.Compact orientation="vertical" className="w-40">
    <Button block type="outlined" className="justify-start">Button 1</Button>
    <Button block type="outlined" className="justify-start">Button 2</Button>
    <Button block type="outlined" className="justify-start">Button 3</Button>
  </Space.Compact>
</Space>`

const sceneCode = `<Space block align="center" wrap className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
  <Space vertical className="min-w-52">
    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">release room</span>
    <div>
      <div className="text-lg font-semibold">Weekly rollout</div>
      <div className="text-sm text-base-content/60">3 streams waiting for approval</div>
    </div>
  </Space>

  <Space size="large" wrap className="flex-1 justify-end">
    <Badge color="primary">preview ready</Badge>
    <Badge color="secondary">7 checks</Badge>
    <Badge color="accent">2 owners</Badge>
    <Space.Compact>
      <Button variant="outline">Draft</Button>
      <Button color="primary">Publish</Button>
    </Space.Compact>
  </Space>
</Space>`

const SpacePage: FC = () => {
  const tabs = {
    basic: ref<PreviewTabMode>('preview'),
    direction: ref<PreviewTabMode>('preview'),
    size: ref<PreviewTabMode>('preview'),
    wrap: ref<PreviewTabMode>('preview'),
    separator: ref<PreviewTabMode>('preview'),
    compactToolbar: ref<PreviewTabMode>('preview'),
    compactButtons: ref<PreviewTabMode>('preview'),
    compactVerticalButtons: ref<PreviewTabMode>('preview'),
    compactVertical: ref<PreviewTabMode>('preview'),
    scene: ref<PreviewTabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Space 间距容器</h1>
        <p className="text-sm mt-3 mb-3">
          Space 现在不再只是“自己写 gap”的占位组件，而是补成了一个完整的布局原语。它保留 Rue
          自己干净直接的视觉，不抢内容本身的风头，同时把常用的水平/垂直编排、对齐、换行、分隔符和
          Compact 紧凑组合一次补齐。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要把按钮、标签、统计块、输入控件排成一致的节奏，而不想在每个页面重复手写 gap。</li>
          <li>
            需要在同一套 API 下切换 horizontal、vertical、wrap 和 separator，保持布局表达统一。
          </li>
          <li>需要工具条、搜索栏、批量操作区这类更紧凑的组合时，可以直接切到 Space.Compact。</li>
        </ul>

        <h2>推荐用法</h2>

        <PreviewBlock
          title="基础间距"
          summary="最小可用写法，适合动作按钮、标签和轻量操作组。"
          tab={tabs.basic}
          code={basicCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
              <Space>
                <Button color="primary">Run build</Button>
                <Button color="secondary" variant="outline">
                  Preview
                </Button>
                <Badge color="neutral">workspace</Badge>
              </Space>
            </div>
          }
        />

        <PreviewBlock
          title="方向与对齐"
          summary="主轴方向和交叉轴对齐都在 Space 本身表达，不需要额外写 flex 类。"
          tab={tabs.direction}
          code={directionCode}
          preview={
            <div className="grid gap-4 lg:grid-cols-2">
              <Space
                align="baseline"
                className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <Badge color="primary">baseline</Badge>
                <span className="text-2xl font-semibold">24h</span>
                <span className="text-sm opacity-60">fresh</span>
              </Space>

              <Space
                vertical
                align="stretch"
                className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="rounded-box bg-base-200 px-3 py-2">Upload assets</div>
                <div className="rounded-box bg-base-200 px-3 py-2">Sync routes</div>
                <div className="rounded-box bg-base-200 px-3 py-2">Publish preview</div>
              </Space>
            </div>
          }
        />

        <PreviewBlock
          title="尺寸与自定义 Gap"
          summary="延续 small / middle / large 预设，也支持 tuple 间距覆盖列距与行距。"
          tab={tabs.size}
          code={sizeCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm space-y-4">
              <Space size="small">
                <Badge color="primary">small</Badge>
                <Badge color="secondary">8px token</Badge>
                <Badge color="accent">dense</Badge>
              </Space>

              <Space size="middle">
                <Badge color="primary">middle</Badge>
                <Badge color="secondary">balanced</Badge>
                <Badge color="accent">12px token</Badge>
              </Space>

              <Space size={[28, 14]} wrap className="max-w-xl">
                <Badge color="neutral">tuple gap</Badge>
                <Badge color="info">column 28</Badge>
                <Badge color="success">row 14</Badge>
                <Badge color="warning">wrap aware</Badge>
                <Badge color="error">custom density</Badge>
              </Space>
            </div>
          }
        />

        <PreviewBlock
          title="自动换行"
          summary="用 wrap 处理标签墙、筛选条件和批量状态块，保持行距稳定。"
          tab={tabs.wrap}
          code={wrapCode}
          preview={
            <Space
              wrap
              size={[16, 12]}
              className="max-w-2xl rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <Badge color="primary">router</Badge>
              <Badge color="secondary">runtime-vapor</Badge>
              <Badge color="accent">design-system</Badge>
              <Badge color="neutral">sfc playground</Badge>
              <Badge color="info">bench</Badge>
              <Badge color="success">release</Badge>
              <Badge color="warning">compat</Badge>
              <Badge color="error">incident</Badge>
            </Space>
          }
        />

        <PreviewBlock
          title="Separator / Split"
          summary="分隔符适合 breadcrumb、命令路径和键值对；自定义节点推荐传函数。"
          tab={tabs.separator}
          code={separatorCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
              <Space
                separator={() => (
                  <span className="text-xs uppercase tracking-[0.2em] opacity-35">/</span>
                )}
              >
                <a className="link link-hover">Workspace</a>
                <a className="link link-hover">Design</a>
                <span className="font-medium">Space</span>
              </Space>
            </div>
          }
        />

        <PreviewBlock
          title="Compact 横向工具条"
          summary="把输入、筛选和提交动作收成一个连续控制带，适合搜索栏与操作条；Compact 默认就是无间距拼接。"
          tab={tabs.compactToolbar}
          code={compactToolbarCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
              <Space.Compact className="w-full max-w-3xl">
                <Input className="w-full" placeholder="Search component or token" />
                <select className="select w-full min-w-40">
                  <option>All teams</option>
                  <option>Design infra</option>
                  <option>Runtime</option>
                </select>
                <Button className="w-full lg:w-auto" color="primary">
                  Search
                </Button>
              </Space.Compact>
            </div>
          }
        />

        <PreviewBlock
          title="Compact 按钮拼接"
          summary="补一组更接近操作面板的按钮拼接示例：图标轨道、主色动作条和带下拉收口的混合按钮组。"
          tab={tabs.compactButtons}
          code={compactButtonsCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm space-y-4">
              <Space.Compact block>
                <Tooltip title="Like">
                  <Button shape="square" aria-label="Like" icon={<CompactGlyph label="LK" />} />
                </Tooltip>
                <Tooltip title="Comment">
                  <Button shape="square" aria-label="Comment" icon={<CompactGlyph label="CM" />} />
                </Tooltip>
                <Tooltip title="Star">
                  <Button shape="square" aria-label="Star" icon={<CompactGlyph label="ST" />} />
                </Tooltip>
                <Tooltip title="Heart">
                  <Button shape="square" aria-label="Heart" icon={<CompactGlyph label="HT" />} />
                </Tooltip>
                <Tooltip title="Share">
                  <Button shape="square" aria-label="Share" icon={<CompactGlyph label="SH" />} />
                </Tooltip>
                <Tooltip title="Download">
                  <Button shape="square" aria-label="Download" icon={<CompactGlyph label="DL" />} />
                </Tooltip>
                <Dropdown trigger="click" placement="bottomRight" items={compactRailMenuItems}>
                  <Button
                    shape="square"
                    aria-label="More actions"
                    icon={<CompactGlyph label="..." />}
                  />
                </Dropdown>
              </Space.Compact>

              <Space.Compact block>
                <Button color="primary">Button 1</Button>
                <Button color="primary">Button 2</Button>
                <Button color="primary">Button 3</Button>
                <Button color="primary">Button 4</Button>
                <Button
                  color="primary"
                  disabled
                  title="Disabled download"
                  icon={<CompactGlyph label="DL" />}
                />
                <Button color="primary" title="Download" icon={<CompactGlyph label="DL" />} />
              </Space.Compact>

              <Space.Compact block>
                <Button>Button 1</Button>
                <Button>Button 2</Button>
                <Button>Button 3</Button>
                <Button disabled title="Disabled download" icon={<CompactGlyph label="DL" />} />
                <Button title="Download" icon={<CompactGlyph label="DL" />} />
                <Button color="primary">Button 4</Button>
                <Dropdown trigger="click" placement="bottomRight" items={compactPrimaryMenuItems}>
                  <Button
                    color="primary"
                    title="More actions"
                    icon={<CompactGlyph label="..." />}
                  />
                </Dropdown>
              </Space.Compact>
            </div>
          }
        />

        <PreviewBlock
          title="Compact 垂直按钮组"
          summary="再补一组纵向按钮拼接，直接把默认、dashed、primary 和 outlined 四种按钮风格摆在一起。"
          tab={tabs.compactVerticalButtons}
          code={compactVerticalButtonsCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
              <Space size="large" wrap>
                <Space.Compact orientation="vertical" className="w-40">
                  <Button block className="justify-start">
                    Button 1
                  </Button>
                  <Button block className="justify-start">
                    Button 2
                  </Button>
                  <Button block className="justify-start">
                    Button 3
                  </Button>
                </Space.Compact>

                <Space.Compact orientation="vertical" className="w-40">
                  <Button block type="dashed" className="justify-start">
                    Button 1
                  </Button>
                  <Button block type="dashed" className="justify-start">
                    Button 2
                  </Button>
                  <Button block type="dashed" className="justify-start">
                    Button 3
                  </Button>
                </Space.Compact>

                <Space.Compact orientation="vertical" className="w-40">
                  <Button block color="primary" className="justify-start">
                    Button 1
                  </Button>
                  <Button block color="primary" className="justify-start">
                    Button 2
                  </Button>
                  <Button block color="primary" className="justify-start">
                    Button 3
                  </Button>
                </Space.Compact>

                <Space.Compact orientation="vertical" className="w-40">
                  <Button block type="outlined" className="justify-start">
                    Button 1
                  </Button>
                  <Button block type="outlined" className="justify-start">
                    Button 2
                  </Button>
                  <Button block type="outlined" className="justify-start">
                    Button 3
                  </Button>
                </Space.Compact>
              </Space>
            </div>
          }
        />

        <PreviewBlock
          title="Compact 纵向表单"
          summary="纵向 Compact 更适合移动端或窄侧栏里的批量录入。"
          tab={tabs.compactVertical}
          code={compactVerticalCode}
          preview={
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm">
              <Space.Compact vertical block className="w-full max-w-sm">
                <Input className="w-full" placeholder="Campaign title" />
                <Input className="w-full" placeholder="Owner" />
                <Button className="w-full" color="primary">
                  Create workspace
                </Button>
              </Space.Compact>
            </div>
          }
        />

        <PreviewBlock
          title="场景化组合"
          summary="Space 负责主节奏，Space.Compact 负责局部收口，适合真实工作台头部。"
          tab={tabs.scene}
          code={sceneCode}
          preview={
            <Space
              block
              align="center"
              wrap
              className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <Space vertical className="min-w-52">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/45">
                  release room
                </span>
                <div>
                  <div className="text-lg font-semibold">Weekly rollout</div>
                  <div className="text-sm text-base-content/60">3 streams waiting for approval</div>
                </div>
              </Space>

              <Space size="large" wrap className="flex-1 justify-end">
                <Badge color="primary">preview ready</Badge>
                <Badge color="secondary">7 checks</Badge>
                <Badge color="accent">2 owners</Badge>
                <Space.Compact>
                  <Button variant="outline">Draft</Button>
                  <Button color="primary">Publish</Button>
                </Space.Compact>
              </Space>
            </Space>
          }
        />

        <h2>API</h2>
        <ApiTable rows={spaceApiRows} />

        <h2 className="mt-10">Space.Compact API</h2>
        <p className="text-sm opacity-70">
          Space.Compact 对应的是 compact 语义：它负责把控件压成连续组，默认不提供
          gap；如果你要的是普通留白，请继续使用 Space。
        </p>
        <ApiTable rows={compactApiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default SpacePage
