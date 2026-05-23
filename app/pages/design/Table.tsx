import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { Table, Tabs } from '@rue-js/design'

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

const baseUsers = [
  {
    key: '1',
    name: '林青',
    age: 28,
    city: '杭州',
    role: '设计工程师',
    team: '体验平台',
    status: 'active',
    score: 92,
    salary: 26000,
    visits: 148,
    address: '云谷路 88 号',
  },
  {
    key: '2',
    name: '周宁',
    age: 34,
    city: '上海',
    role: '前端工程师',
    team: '设计系统',
    status: 'active',
    score: 88,
    salary: 31000,
    visits: 203,
    address: '武康路 12 号',
  },
  {
    key: '3',
    name: '刘溪',
    age: 41,
    city: '深圳',
    role: '产品经理',
    team: '商业化',
    status: 'leave',
    score: 79,
    salary: 35000,
    visits: 167,
    address: '深南大道 100 号',
  },
  {
    key: '4',
    name: '陈默',
    age: 26,
    city: '成都',
    role: '测试开发',
    team: '质量平台',
    status: 'trial',
    score: 95,
    salary: 22000,
    visits: 98,
    address: '天府三街 18 号',
  },
  {
    key: '5',
    name: '顾安',
    age: 31,
    city: '北京',
    role: '运营分析',
    team: '增长',
    status: 'active',
    score: 83,
    salary: 24500,
    visits: 132,
    address: '望京 SOHO',
  },
]

const staticPinnedRows = [
  { id: '1', item: '套餐 A', owner: '前台', price: '199' },
  { id: '2', item: '套餐 B', owner: '门店', price: '299' },
  { id: '3', item: '套餐 C', owner: '线上', price: '399' },
]

const controlledDemoRows = [
  { key: '1', name: 'John Brown', age: 32, address: 'New York No. 1 Lake Park' },
  { key: '2', name: 'Jim Green', age: 42, address: 'London No. 1 Lake Park' },
  { key: '3', name: 'Joe Black', age: 32, address: 'Sydney No. 1 Lake Park' },
  { key: '4', name: 'Jim Red', age: 32, address: 'London No. 2 Lake Park' },
]

const multipleSorterRows = [
  { key: '1', name: 'John Brown', chinese: 98, math: 60, english: 70 },
  { key: '2', name: 'Jim Green', chinese: 98, math: 66, english: 89 },
  { key: '3', name: 'Joe Black', chinese: 98, math: 90, english: 70 },
  { key: '4', name: 'Jim Red', chinese: 88, math: 99, english: 89 },
]

const historicColumnRows = [
  {
    key: '1',
    name: 'Cy Ganderton',
    team: 'Design Ops',
    city: 'Hangzhou',
    owner: 'Hart Hagerty',
    updatedAt: '2026-04-18',
  },
  {
    key: '2',
    name: 'Brice Swyre',
    team: 'Growth',
    city: 'Shanghai',
    owner: 'Yancy Tear',
    updatedAt: '2026-04-19',
  },
  {
    key: '3',
    name: 'Marjy Ferencz',
    team: 'Infra',
    city: 'Shenzhen',
    owner: 'Maribeth Popping',
    updatedAt: '2026-04-21',
  },
]

const tableApiRows: ApiRow[] = [
  {
    prop: 'columns',
    description: '列配置，支持分组表头、排序、筛选、隐藏列与单元格属性。',
    type: 'ColumnItem[]',
    defaultValue: '-',
  },
  { prop: 'dataSource', description: '数据数组。', type: 'any[]', defaultValue: '-' },
  {
    prop: 'rowKey',
    description: '行主键，可传字段名或函数。',
    type: 'string | (record) => key',
    defaultValue: '`key`',
  },
  {
    prop: 'rowSelection',
    description: '选择列配置，支持多选、单选、禁用项、表头标题。',
    type: 'object',
    defaultValue: '-',
  },
  {
    prop: 'expandable',
    description: '展开行配置，支持按行点击展开与受控展开。',
    type: 'object',
    defaultValue: '-',
  },
  {
    prop: 'pagination',
    description: '分页配置，设为 `false` 时关闭分页。',
    type: 'object | false',
    defaultValue: '-',
  },
  {
    prop: 'scroll',
    description: '横向 / 纵向滚动配置，可在变更后自动回到顶部。',
    type: 'object',
    defaultValue: '-',
  },
  {
    prop: 'summary',
    description: '汇总栏渲染。',
    type: '(currentData, info) => any',
    defaultValue: '-',
  },
]

const columnApiRows: ApiRow[] = [
  {
    prop: 'title',
    description: '列标题，支持传节点或函数。',
    type: 'any | (context) => any',
    defaultValue: '-',
  },
  {
    prop: 'dataIndex',
    description: '字段路径，支持字符串和数组路径。',
    type: 'string | string[]',
    defaultValue: '-',
  },
  {
    prop: 'sorter / sortOrder',
    description: '本地排序、受控排序与多列排序。',
    type: 'boolean | fn | { compare?: fn; multiple?: number } / SortOrder',
    defaultValue: '-',
  },
  {
    prop: 'filters / filterDropdown / filteredValue',
    description: '默认筛选菜单、自定义筛选面板与受控筛选值。',
    type: 'FilterItem[] / render fn / any[]',
    defaultValue: '-',
  },
  {
    prop: 'filterSearch',
    description: '筛选项搜索。',
    type: 'boolean | fn',
    defaultValue: 'false',
  },
  { prop: 'children', description: '分组表头子列。', type: 'ColumnItem[]', defaultValue: '-' },
  { prop: 'hidden', description: '隐藏列但保留配置。', type: 'boolean', defaultValue: 'false' },
  {
    prop: 'onCell / onHeaderCell',
    description: '给单元格注入 className、style、colSpan、rowSpan 等属性。',
    type: 'fn',
    defaultValue: '-',
  },
]

const rowSelectionApiRows: ApiRow[] = [
  {
    prop: 'type',
    description: '选择模式。',
    type: '`checkbox` | `radio`',
    defaultValue: '`checkbox`',
  },
  { prop: 'columnTitle', description: '选择列表头内容。', type: 'any', defaultValue: '-' },
  { prop: 'hideSelectAll', description: '隐藏全选框。', type: 'boolean', defaultValue: 'false' },
  {
    prop: 'getCheckboxProps',
    description: '为某一行注入 disabled 等状态。',
    type: '(record) => object',
    defaultValue: '-',
  },
  {
    prop: 'onSelect / onSelectAll / onChange',
    description: '选择行为回调。',
    type: 'fn',
    defaultValue: '-',
  },
]

const expandableApiRows: ApiRow[] = [
  {
    prop: 'expandedRowRender',
    description: '展开内容渲染函数。',
    type: '(record, index) => any',
    defaultValue: '-',
  },
  {
    prop: 'expandRowByClick',
    description: '点击行即可展开。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'showExpandColumn',
    description: '是否展示展开列。',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'rowExpandable',
    description: '按行控制是否可展开。',
    type: '(record) => boolean',
    defaultValue: '-',
  },
  {
    prop: 'defaultExpandedRowKeys / expandedRowKeys',
    description: '默认展开 / 受控展开。',
    type: 'key[]',
    defaultValue: '-',
  },
]

const TableDemo: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabVisual = ref<TabMode>('preview')
  const tabControlledSort = ref<TabMode>('preview')
  const tabMultipleSorter = ref<TabMode>('preview')
  const tabColumnToggle = ref<TabMode>('preview')
  const tabSelection = ref<TabMode>('preview')
  const tabExpand = ref<TabMode>('preview')
  const tabLayout = ref<TabMode>('preview')
  const tabGrouped = ref<TabMode>('preview')
  const tabStatic = ref<TabMode>('preview')

  const selectedKeys = ref<Array<string | number>>(['2'])
  const selectedRadio = ref<Array<string | number>>(['2'])
  const clickedName = ref('未点击')
  const controlledNameFilter = ref<any[] | null>(['Jim'])
  const controlledAddressFilter = ref<any[] | null>(['London'])
  const controlledSorter = ref<{ columnKey: string | null; order: 'ascend' | 'descend' | null }>({
    columnKey: 'age',
    order: 'descend',
  })
  const multiSortOrders = ref<Record<string, 'ascend' | 'descend' | null>>({
    chinese: 'ascend',
    math: 'ascend',
  })
  const visibleColumnKeys = ref(['name', 'team', 'city', 'owner'])
  const hideSalary = ref(false)
  const expandedKeys = ref<Array<string | number>>(['2'])

  const employeeColumns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '城市', dataIndex: 'city' },
    { title: '岗位', dataIndex: 'role' },
    { title: '团队', dataIndex: 'team' },
  ]

  const controlledSortColumns = [
    {
      title: 'Name',
      filters: [
        { text: 'Jim', value: 'Jim' },
        { text: 'Joe', value: 'Joe' },
        { text: 'John', value: 'John' },
      ],
      dataIndex: 'name',
      filteredValue: controlledNameFilter.value?.length ? controlledNameFilter.value : undefined,
      filterSearch: true,
      onFilter: (value: any, record: any) => record.name.includes(value as string),
      sorter: (a: any, b: any) => a.name.length - b.name.length,
      sortDirections: ['descend' as const, 'ascend' as const],
      sortOrder: controlledSorter.value.columnKey === 'name' ? controlledSorter.value.order : null,
    },
    {
      title: 'Age',
      dataIndex: 'age',
      sorter: (a: any, b: any) => a.age - b.age,
      sortDirections: ['descend' as const, 'ascend' as const],
      sortOrder: controlledSorter.value.columnKey === 'age' ? controlledSorter.value.order : null,
    },
    {
      title: 'Address',
      filters: [
        { text: 'London', value: 'London' },
        { text: 'New York', value: 'New York' },
        { text: 'Sydney', value: 'Sydney' },
      ],
      dataIndex: 'address',
      filteredValue: controlledAddressFilter.value?.length
        ? controlledAddressFilter.value
        : undefined,
      filterSearch: true,
      onFilter: (value: any, record: any) => record.address.includes(value as string),
      sorter: (a: any, b: any) => a.address.length - b.address.length,
      sortDirections: ['descend' as const, 'ascend' as const],
      sortOrder:
        controlledSorter.value.columnKey === 'address' ? controlledSorter.value.order : null,
      ellipsis: true,
    },
  ]

  const multipleSorterColumns = [
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Chinese Score',
      dataIndex: 'chinese',
      sortOrder: multiSortOrders.value.chinese ?? null,
      sorter: { compare: (a: any, b: any) => a.chinese - b.chinese, multiple: 3 },
      sortDirections: ['descend' as const, 'ascend' as const],
    },
    {
      title: 'Math Score',
      dataIndex: 'math',
      sortOrder: multiSortOrders.value.math ?? null,
      sorter: { compare: (a: any, b: any) => a.math - b.math, multiple: 2 },
      sortDirections: ['descend' as const, 'ascend' as const],
    },
    {
      title: 'English Score',
      dataIndex: 'english',
      sortOrder: multiSortOrders.value.english ?? null,
      sorter: { compare: (a: any, b: any) => a.english - b.english, multiple: 1 },
      sortDirections: ['descend' as const, 'ascend' as const],
    },
  ]

  const columnToggleColumns = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      hidden: !visibleColumnKeys.value.includes('name'),
    },
    {
      key: 'team',
      title: 'Team',
      dataIndex: 'team',
      hidden: !visibleColumnKeys.value.includes('team'),
    },
    {
      key: 'city',
      title: 'City',
      dataIndex: 'city',
      hidden: !visibleColumnKeys.value.includes('city'),
    },
    {
      key: 'owner',
      title: 'Owner',
      dataIndex: 'owner',
      hidden: !visibleColumnKeys.value.includes('owner'),
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      dataIndex: 'updatedAt',
      hidden: !visibleColumnKeys.value.includes('updatedAt'),
    },
  ]

  const groupedColumns = [
    {
      title: '成员信息',
      children: [
        { title: '姓名', dataIndex: 'name', width: 120 },
        { title: '城市', dataIndex: 'city', width: 120 },
      ],
    },
    {
      title: '工作概览',
      children: [
        { title: '岗位', dataIndex: 'role', ellipsis: true },
        { title: '团队', dataIndex: 'team', ellipsis: true },
        { title: '月薪', dataIndex: 'salary', align: 'right' as const, hidden: hideSalary.value },
      ],
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => (clickedName.value = `操作 ${record.name}`)}
        >
          查看
        </button>
      ),
      onCell: (_record: any, rowIndex: number) => ({
        className: rowIndex % 2 === 0 ? 'bg-base-100' : 'bg-base-200/30',
      }),
    },
  ]

  const scrollColumns = [
    { title: '姓名', dataIndex: 'name', width: 120, fixedCol: true },
    { title: '城市', dataIndex: 'city', width: 120 },
    { title: '岗位', dataIndex: 'role', width: 180, ellipsis: true },
    { title: '团队', dataIndex: 'team', width: 160 },
    { title: '地址', dataIndex: 'address', width: 220, ellipsis: true },
    { title: '访问量', dataIndex: 'visits', width: 120, align: 'right' as const },
  ]

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Table 表格</h1>
        <p>
          Rue Table 现在同时覆盖数据驱动表格和 daisyUI 风格的静态表格写法，保留 Rue
          当前视觉风格，并补齐更完整的 排序、筛选、分页、选择、展开与分组表头能力。
        </p>
        <p>
          可以先从基础用法进入，再根据场景查看筛选排序、选择模式、滚动布局与分组表头。静态样式写法仍然保留，可继续
          使用 <code>Table.Head</code>、<code>Table.Body</code> 等复合组件。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要展示结构化列表数据，并同时提供排序、筛选、分页等交互。</li>
          <li>希望沿用 Rue / daisyUI 的表格视觉风格，但 API 更接近成熟数据表组件。</li>
          <li>既有简单静态表格，也有复杂后台表格，想统一在一个组件里处理。</li>
        </ul>

        <ExampleBlock
          title="基础数据表格"
          summary="最直接的 columns + dataSource 用法，适合作为大多数列表页的起点。"
          tab={tabBasic}
          preview={() => (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100 p-4">
              <Table className="w-full" columns={employeeColumns} dataSource={baseUsers} />
            </div>
          )}
          code={`const columns = [
  { title: '姓名', dataIndex: 'name' },
  { title: '城市', dataIndex: 'city' },
  { title: '岗位', dataIndex: 'role' },
  { title: '团队', dataIndex: 'team' },
]

<Table className="w-full" columns={columns} dataSource={baseUsers} />`}
        />

        <ExampleBlock
          title="视觉风格与静态行态"
          summary="保留原有视觉类 demo：背景、激活行、hover、zebra 与尺寸示例。"
          tab={tabVisual}
          preview={() => (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">带背景与激活行</div>
                <Table className="w-full">
                  <Table.Head>
                    <Table.TR>
                      <Table.TH>姓名</Table.TH>
                      <Table.TH>岗位</Table.TH>
                      <Table.TH>城市</Table.TH>
                    </Table.TR>
                  </Table.Head>
                  <Table.Body>
                    <Table.TR className="bg-base-200">
                      <Table.TD>林青</Table.TD>
                      <Table.TD>设计工程师</Table.TD>
                      <Table.TD>杭州</Table.TD>
                    </Table.TR>
                    <Table.TR>
                      <Table.TD>周宁</Table.TD>
                      <Table.TD>前端工程师</Table.TD>
                      <Table.TD>上海</Table.TD>
                    </Table.TR>
                  </Table.Body>
                </Table>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm font-medium">hover / zebra / xs</div>
                <Table
                  className="w-full"
                  zebra
                  size="xs"
                  rowHoverable
                  columns={employeeColumns}
                  dataSource={baseUsers.slice(0, 3)}
                />
              </div>
            </div>
          )}
          code={`<Table className="w-full" zebra size="xs" rowHoverable columns={columns} dataSource={data} />

<Table>
  <Table.Head>...</Table.Head>
  <Table.Body>
    <Table.TR className="bg-base-200">...</Table.TR>
  </Table.Body>
</Table>`}
        />

        <ExampleBlock
          title="可控筛选与排序"
          summary="恢复外部控制台式的筛选与排序示例，避免交互状态混在一起。"
          tab={tabControlledSort}
          preview={() => (
            <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    (controlledSorter.value = {
                      columnKey: 'age',
                      order: 'descend',
                    })
                  }
                >
                  年龄降序
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => (controlledNameFilter.value = ['Jim'])}
                >
                  只看 Jim
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => (controlledAddressFilter.value = ['London'])}
                >
                  只看 London
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    controlledNameFilter.value = null
                    controlledAddressFilter.value = null
                  }}
                >
                  清空筛选
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    controlledNameFilter.value = null
                    controlledAddressFilter.value = null
                    controlledSorter.value = { columnKey: null, order: null }
                  }}
                >
                  清空全部
                </button>
                <span className="opacity-70">
                  当前排序：{controlledSorter.value.columnKey ?? '无'} /{' '}
                  {controlledSorter.value.order ?? '无'}
                </span>
              </div>
              <Table
                className="w-full"
                columns={controlledSortColumns}
                dataSource={controlledDemoRows}
                sortDirections={['descend', 'ascend']}
                onChange={(_paginationValue: any, filters: any, sorter: any) => {
                  controlledNameFilter.value =
                    Array.isArray(filters?.name) && filters.name.length > 0 ? filters.name : null
                  controlledAddressFilter.value =
                    Array.isArray(filters?.address) && filters.address.length > 0
                      ? filters.address
                      : null
                  const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
                  controlledSorter.value = {
                    columnKey: nextSorter?.columnKey ?? null,
                    order: nextSorter?.order ?? null,
                  }
                }}
              />
            </div>
          )}
          code={`const controlledNameFilter = ref<any[] | null>(['Jim'])
const controlledAddressFilter = ref<any[] | null>(['London'])
const controlledSorter = ref({ columnKey: 'age', order: 'descend' as const })

<Table
  columns={[
    {
      title: 'Name',
      filters: [
        { text: 'Jim', value: 'Jim' },
        { text: 'Joe', value: 'Joe' },
        { text: 'John', value: 'John' },
      ],
      dataIndex: 'name',
      filteredValue: controlledNameFilter.value ?? undefined,
      filterSearch: true,
      onFilter: (value, record) => record.name.includes(value),
      sorter: (a, b) => a.name.length - b.name.length,
      sortDirections: ['descend', 'ascend'],
      sortOrder: controlledSorter.value.columnKey === 'name' ? controlledSorter.value.order : null,
    },
    {
      title: 'Age',
      dataIndex: 'age',
      sorter: (a, b) => a.age - b.age,
      sortDirections: ['descend', 'ascend'],
      sortOrder: controlledSorter.value.columnKey === 'age' ? controlledSorter.value.order : null,
    },
    {
      title: 'Address',
      filters: [
        { text: 'London', value: 'London' },
        { text: 'New York', value: 'New York' },
        { text: 'Sydney', value: 'Sydney' },
      ],
      dataIndex: 'address',
      filteredValue: controlledAddressFilter.value ?? undefined,
      filterSearch: true,
      onFilter: (value, record) => record.address.includes(value),
      sorter: (a, b) => a.address.length - b.address.length,
      sortDirections: ['descend', 'ascend'],
      sortOrder: controlledSorter.value.columnKey === 'address' ? controlledSorter.value.order : null,
    },
  ]}
  dataSource={controlledDemoRows}
  sortDirections={['descend', 'ascend']}
  onChange={(_, filters, sorter) => {
    controlledNameFilter.value = Array.isArray(filters?.name) && filters.name.length > 0 ? filters.name : null
    controlledAddressFilter.value = Array.isArray(filters?.address) && filters.address.length > 0 ? filters.address : null
    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
    controlledSorter.value = {
      columnKey: nextSorter?.columnKey ?? null,
      order: nextSorter?.order ?? null,
    }
  }}
/>`}
        />

        <ExampleBlock
          title="多列排序（优先级组合）"
          summary="补回多列优先级排序 demo，支持 { compare, multiple } 并按优先级组合排序。"
          tab={tabMultipleSorter}
          preview={() => (
            <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    (multiSortOrders.value = {
                      chinese: 'ascend',
                      math: 'ascend',
                    })
                  }
                >
                  语文↑ + 数学↑
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    (multiSortOrders.value = {
                      english: 'descend',
                    })
                  }
                >
                  英语↓
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => (multiSortOrders.value = {})}
                >
                  清空排序
                </button>
                <span className="opacity-70">
                  当前：语文 {multiSortOrders.value.chinese ?? '-'} / 数学{' '}
                  {multiSortOrders.value.math ?? '-'} / 英语 {multiSortOrders.value.english ?? '-'}
                </span>
              </div>
              <Table
                className="w-full"
                columns={multipleSorterColumns}
                dataSource={multipleSorterRows}
                sortDirections={['descend', 'ascend']}
                onChange={(_paginationValue: any, _filters: any, sorter: any) => {
                  const sorters = Array.isArray(sorter) ? sorter : sorter?.order ? [sorter] : []
                  multiSortOrders.value = sorters.reduce(
                    (acc: Record<string, 'ascend' | 'descend' | null>, item: any) => {
                      if (item?.columnKey) acc[item.columnKey] = item.order ?? null
                      return acc
                    },
                    {},
                  )
                }}
              />
            </div>
          )}
          code={`const multiSortOrders = ref({ chinese: 'ascend' as const, math: 'ascend' as const })

<Table
  columns={[
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Chinese Score',
      dataIndex: 'chinese',
      sortOrder: multiSortOrders.value.chinese ?? null,
      sortDirections: ['descend', 'ascend'],
      sorter: { compare: (a, b) => a.chinese - b.chinese, multiple: 3 },
    },
    {
      title: 'Math Score',
      dataIndex: 'math',
      sortOrder: multiSortOrders.value.math ?? null,
      sortDirections: ['descend', 'ascend'],
      sorter: { compare: (a, b) => a.math - b.math, multiple: 2 },
    },
  ]}
  dataSource={multipleSorterRows}
  sortDirections={['descend', 'ascend']}
  onChange={(_, __, sorter) => {
    const sorters = Array.isArray(sorter) ? sorter : sorter?.order ? [sorter] : []
    multiSortOrders.value = sorters.reduce((acc, item) => {
      if (item?.columnKey) acc[item.columnKey] = item.order ?? null
      return acc
    }, {})
  }}
/>`}
        />

        <ExampleBlock
          title="动态列显隐（历史 Demo 恢复）"
          summary="把旧的隐藏列 demo 补回来，并用外部开关控制列可见性。"
          tab={tabColumnToggle}
          preview={() => (
            <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap gap-2 text-sm">
                {['name', 'team', 'city', 'owner', 'updatedAt'].map(key => {
                  const active = visibleColumnKeys.value.includes(key)
                  return (
                    <button
                      key={key}
                      className={`btn btn-xs ${active ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        visibleColumnKeys.value = active
                          ? visibleColumnKeys.value.filter(item => item !== key)
                          : [...visibleColumnKeys.value, key]
                      }}
                    >
                      {active ? `隐藏 ${key}` : `显示 ${key}`}
                    </button>
                  )
                })}
              </div>
              <Table
                className="w-full"
                columns={columnToggleColumns}
                dataSource={historicColumnRows}
              />
            </div>
          )}
          code={`const visibleColumnKeys = ref(['name', 'team', 'city', 'owner'])

const columns = [
  { key: 'name', title: 'Name', dataIndex: 'name', hidden: !visibleColumnKeys.value.includes('name') },
  { key: 'team', title: 'Team', dataIndex: 'team', hidden: !visibleColumnKeys.value.includes('team') },
  { key: 'city', title: 'City', dataIndex: 'city', hidden: !visibleColumnKeys.value.includes('city') },
  { key: 'owner', title: 'Owner', dataIndex: 'owner', hidden: !visibleColumnKeys.value.includes('owner') },
]

<Table columns={columns} dataSource={historicColumnRows} />`}
        />

        <ExampleBlock
          title="选择模式"
          summary="保留多选、单选、禁用项、部分禁用几类示例，并增加选择列表头与回调展示。"
          tab={tabSelection}
          preview={() => (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm">
                  多选：当前 {selectedKeys.value.join(', ') || '空'}
                </div>
                <Table
                  className="w-full"
                  columns={[
                    { title: '姓名', dataIndex: 'name' },
                    { title: '团队', dataIndex: 'team' },
                    { title: '状态', dataIndex: 'status' },
                  ]}
                  dataSource={baseUsers}
                  rowSelection={{
                    columnTitle: '成员',
                    selectedRowKeys: selectedKeys.value,
                    getCheckboxProps: record => ({
                      disabled: record.status === 'leave',
                    }),
                    onChange: keys => (selectedKeys.value = [...keys]),
                  }}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <div className="mb-3 text-sm">单选：当前 {selectedRadio.value[0] ?? '空'}</div>
                <Table
                  className="w-full"
                  columns={[
                    { title: '姓名', dataIndex: 'name' },
                    { title: '城市', dataIndex: 'city' },
                  ]}
                  dataSource={baseUsers.slice(0, 4)}
                  rowSelection={{
                    type: 'radio',
                    hideSelectAll: true,
                    selectedRowKeys: selectedRadio.value,
                    onChange: keys => (selectedRadio.value = [...keys]),
                  }}
                />
              </div>
            </div>
          )}
          code={`const selectedKeys = ref<Array<string | number>>(['2'])

<Table
  columns={columns}
  dataSource={baseUsers}
  rowSelection={{
    columnTitle: '成员',
    selectedRowKeys: selectedKeys.value,
    getCheckboxProps: record => ({ disabled: record.status === 'leave' }),
    onChange: keys => (selectedKeys.value = [...keys]),
  }}
/>`}
        />

        <ExampleBlock
          title="展开、摘要与空态"
          summary="把展开行、按行点击展开、summary 和 emptyText 放在同一个业务场景里。"
          tab={tabExpand}
          preview={() => (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <Table
                  className="w-full"
                  columns={[
                    { title: '姓名', dataIndex: 'name' },
                    { title: '绩效', dataIndex: 'score', align: 'right' },
                  ]}
                  dataSource={baseUsers}
                  expandable={{
                    expandedRowKeys: expandedKeys.value,
                    expandRowByClick: true,
                    onExpandedRowsChange: keys => (expandedKeys.value = [...keys]),
                    expandedRowRender: record => (
                      <div className="text-sm leading-6">
                        <div>团队：{record.team}</div>
                        <div>地址：{record.address}</div>
                      </div>
                    ),
                  }}
                  summary={(rows: any[]) => (
                    <div className="flex justify-between text-sm">
                      <span>当前行数：{rows.length}</span>
                      <span>
                        平均绩效：
                        {Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)}
                      </span>
                    </div>
                  )}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4">
                <Table
                  className="w-full"
                  columns={[
                    { title: '姓名', dataIndex: 'name' },
                    { title: '团队', dataIndex: 'team' },
                  ]}
                  dataSource={[]}
                  emptyText={<span className="text-sm opacity-60">暂无成员，请先创建数据。</span>}
                />
              </div>
            </div>
          )}
          code={`<Table
  columns={columns}
  dataSource={baseUsers}
  expandable={{
    expandRowByClick: true,
    expandedRowRender: record => <div>{record.address}</div>,
  }}
  summary={rows => <div>当前行数：{rows.length}</div>}
/>`}
        />

        <ExampleBlock
          title="滚动、标题、尾部与省略"
          summary="保留滚动、title/footer、ellipsis 和滚动容器类 demo，并串成一个长表格布局场景。"
          tab={tabLayout}
          preview={() => (
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <Table
                className="w-full"
                columns={scrollColumns}
                dataSource={baseUsers.concat(baseUsers).concat(baseUsers)}
                scroll={{ x: 900, y: 220, scrollToFirstRowOnChange: true }}
                title={rows => (
                  <div className="text-sm font-medium">成员列表（当前页 {rows.length} 行）</div>
                )}
                footer={_rows => (
                  <div className="text-sm opacity-70">展示了固定列、纵向滚动和 ellipsis。</div>
                )}
              />
            </div>
          )}
          code={`<Table
  columns={scrollColumns}
  dataSource={longData}
  scroll={{ x: 900, y: 220, scrollToFirstRowOnChange: true }}
  title={rows => <div>成员列表（当前页 {rows.length} 行）</div>}
  footer={() => <div>支持横向和纵向滚动</div>}
/>`}
        />

        <ExampleBlock
          title="分组表头、隐藏列与单元格属性"
          summary="新增分组表头，同时把隐藏列、单元格 className/style/操作列示例合并到这里。"
          tab={tabGrouped}
          preview={() => (
            <div className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => (hideSalary.value = !hideSalary.value)}
                >
                  {hideSalary.value ? '显示月薪列' : '隐藏月薪列'}
                </button>
                <span>最近操作：{clickedName.value}</span>
              </div>
              <Table
                className="w-full"
                columns={groupedColumns}
                dataSource={baseUsers}
                rowHoverable
                onRow={(record: any) => ({
                  onClick: () => (clickedName.value = `点击 ${record.name}`),
                })}
              />
            </div>
          )}
          code={`const groupedColumns = [
  {
    title: '成员信息',
    children: [
      { title: '姓名', dataIndex: 'name' },
      { title: '城市', dataIndex: 'city' },
    ],
  },
  {
    title: '工作概览',
    children: [
      { title: '岗位', dataIndex: 'role', ellipsis: true },
      { title: '团队', dataIndex: 'team', ellipsis: true },
      { title: '月薪', dataIndex: 'salary', hidden: hideSalary.value },
    ],
  },
]

<Table columns={groupedColumns} dataSource={baseUsers} />`}
        />

        <ExampleBlock
          title="静态样式、Pinned Rows 与 Pinned Cols"
          summary="原有静态样式 demo 仍然保留，适合不需要 columns/dataSource 时直接写结构。"
          tab={tabStatic}
          preview={() => (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4 overflow-x-auto">
                <Table zebra pinRows className="w-full">
                  <Table.Head>
                    <Table.TR>
                      <Table.TH>商品</Table.TH>
                      <Table.TH>负责人</Table.TH>
                      <Table.TH className="text-right">价格</Table.TH>
                    </Table.TR>
                  </Table.Head>
                  <Table.Body>
                    {staticPinnedRows.map(row => (
                      <Table.TR key={row.id}>
                        <Table.TD>{row.item}</Table.TD>
                        <Table.TD>{row.owner}</Table.TD>
                        <Table.TD className="text-right">{row.price}</Table.TD>
                      </Table.TR>
                    ))}
                  </Table.Body>
                </Table>
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 overflow-x-auto">
                <Table pinCols className="w-full">
                  <Table.Head>
                    <Table.TR>
                      <Table.TH className="bg-base-100">姓名</Table.TH>
                      <Table.TH>岗位</Table.TH>
                      <Table.TH>城市</Table.TH>
                      <Table.TH>地址</Table.TH>
                    </Table.TR>
                  </Table.Head>
                  <Table.Body>
                    {baseUsers.slice(0, 3).map(row => (
                      <Table.TR key={row.key}>
                        <Table.TH className="bg-base-100">{row.name}</Table.TH>
                        <Table.TD>{row.role}</Table.TD>
                        <Table.TD>{row.city}</Table.TD>
                        <Table.TD>{row.address}</Table.TD>
                      </Table.TR>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          )}
          code={`<Table zebra pinRows>
  <Table.Head>...</Table.Head>
  <Table.Body>...</Table.Body>
</Table>

<Table pinCols>
  <Table.Head>...</Table.Head>
  <Table.Body>...</Table.Body>
</Table>`}
        />

        <h2 id="table-api">API</h2>
        <p>当前页面只列出 Rue Table 本次增强后最常用的配置项，优先对应实际使用场景。</p>

        <h3>Table</h3>
        <ApiTable rows={tableApiRows} />

        <h3>Column</h3>
        <ApiTable rows={columnApiRows} />

        <h3>rowSelection</h3>
        <ApiTable rows={rowSelectionApiRows} />

        <h3>expandable</h3>
        <ApiTable rows={expandableApiRows} />

        <h2>FAQ</h2>
        <h3>数据驱动和静态结构怎么选？</h3>
        <p>
          需要排序、筛选、分页、选择、展开时优先使用 <code>columns + dataSource</code>
          。只想快速输出结构化样式， 或需要完全手写表格结构时，继续使用复合组件写法即可。
        </p>

        <h3>为什么筛选或排序后会回到第一页？</h3>
        <p>
          这是为了避免当前页在筛选后没有数据。如果你希望完全自行控制分页，把{' '}
          <code>pagination.current</code> 和<code>onChange</code> 一起受控即可。
        </p>

        <h3>固定列和 pinCols 的关系是什么？</h3>
        <p>
          <code>pinCols</code> 负责启用 daisyUI 的固定列视觉能力，具体哪一列固定则由列上的{' '}
          <code>fixedCol</code> 或 <code>fixed</code> 控制。静态结构写法中，通常把固定列单元格写成{' '}
          <code>TH</code> 会更自然。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default TableDemo
