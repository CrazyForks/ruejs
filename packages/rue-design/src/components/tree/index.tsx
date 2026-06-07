/* RUE_VAPOR_TRANSFORMED */
/* oxlint-disable eslint/no-unused-vars -- Rue's transformed TSX in this file leaves helper usage opaque to oxlint. */
/*
Tree 组件概述
- 目标：补齐 Rue Design 缺失的树形组件，覆盖展开、选择、勾选、异步加载，并继续向 antd Tree 的目录树、拖拽和虚拟滚动能力靠拢。
- 视觉：延续 Rue 当前卡片化和 badge / border 语义，不照搬 ant-design 的视觉实现。
- 实现：保持手写 TSX 结构，避免被 Vite 阶段重复 Vapor-transform。
*/
import type { FC } from '@rue-js/rue'
import { batch, onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

/** TreeKey 标识键类型。 */
export type TreeKey = string | number
/** TreeStatus 状态类型。 */
export type TreeStatus = 'warning' | 'error'
/** TreeSize 尺寸类型。 */
export type TreeSize = 'small' | 'default' | 'middle' | 'large' | 'sm' | 'md' | 'lg'
/** TreeExpandAction 类型。 */
export type TreeExpandAction = false | 'click' | 'doubleClick'
/** TreeDropPosition 位置或方向类型。 */
export type TreeDropPosition = -1 | 0 | 1
/** DirectoryTreeRangeSelectMode 类型。 */
export type DirectoryTreeRangeSelectMode = false | 'append' | 'replace'

/** TreeFieldNames 接口。 */
export interface TreeFieldNames {
  /** 标题内容。 */
  title?: string
  /** 数据项唯一标识。 */
  key?: string
  /** 组件子内容。 */
  children?: string
  /** 是否禁用交互。 */
  disabled?: string
  /** selectable 配置项。 */
  selectable?: string
  /** checkable 配置项。 */
  checkable?: string
  /** disableCheckbox 配置项。 */
  disableCheckbox?: string
  /** isLeaf 配置项。 */
  isLeaf?: string
  /** 图标内容。 */
  icon?: string
  /** 根节点附加类名。 */
  className?: string
  /** 元素或数据项标识。 */
  id?: string
  /** pId 配置项。 */
  pId?: string
}

/** TreeDataNode 接口。 */
export interface TreeDataNode {
  /** 标题内容。 */
  title?: any
  /** 数据项唯一标识。 */
  key?: TreeKey
  /** 组件子内容。 */
  children?: TreeDataNode[]
  /** 是否禁用交互。 */
  disabled?: boolean
  /** selectable 配置项。 */
  selectable?: boolean
  /** checkable 配置项。 */
  checkable?: boolean
  /** disableCheckbox 配置项。 */
  disableCheckbox?: boolean
  /** isLeaf 配置项。 */
  isLeaf?: boolean
  /** 图标内容。 */
  icon?: any
  /** 根节点附加类名。 */
  className?: string
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** TreeSimpleModeConfig 配置对象。 */
export interface TreeSimpleModeConfig {
  /** 元素或数据项标识。 */
  id?: string
  /** pId 配置项。 */
  pId?: string
  /** rootPId 配置项。 */
  rootPId?: string | number | null
}

/** TreeCheckedKeysObject 接口。 */
export interface TreeCheckedKeysObject {
  /** 受控选中状态。 */
  checked: TreeKey[]
  /** halfChecked 配置项。 */
  halfChecked: TreeKey[]
}

/** TreeNode 接口。 */
export interface TreeNode {
  /** 数据项唯一标识。 */
  key: TreeKey
  /** keyText 文本内容。 */
  keyText: string
  /** 标题内容。 */
  title: any
  /** depth 配置项。 */
  depth: number
  /** 组件子内容。 */
  children: TreeNode[]
  /** raw 配置项。 */
  raw: TreeDataNode
  /** 是否禁用交互。 */
  disabled: boolean
  /** selectable 配置项。 */
  selectable: boolean
  /** checkable 配置项。 */
  checkable: boolean
  /** disableCheckbox 配置项。 */
  disableCheckbox: boolean
  /** isLeaf 配置项。 */
  isLeaf: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 图标内容。 */
  icon?: any
  /** parentKeyText 文本内容。 */
  parentKeyText?: string
}

/** TreeEventInfo 接口。 */
export interface TreeEventInfo {
  /** node 配置项。 */
  node: TreeNode
  /** nativeEvent 配置项。 */
  nativeEvent?: Event | MouseEvent
  /** selected 配置项。 */
  selected?: boolean
  /** 受控选中状态。 */
  checked?: boolean
  /** expanded 配置项。 */
  expanded?: boolean
  /** checkedNodes 配置项。 */
  checkedNodes?: TreeNode[]
  /** selectedNodes 配置项。 */
  selectedNodes?: TreeNode[]
  /** halfCheckedKeys 标识键集合。 */
  halfCheckedKeys?: TreeKey[]
}

/** TreeDragEventInfo 接口。 */
export interface TreeDragEventInfo {
  /** event 配置项。 */
  event: DragEvent | Event
  /** node 配置项。 */
  node: TreeNode
  /** expandedKeys 标识键集合。 */
  expandedKeys?: TreeKey[]
}

/** TreeDropInfo 接口。 */
export interface TreeDropInfo extends TreeDragEventInfo {
  /** dragNode 配置项。 */
  dragNode: TreeNode
  /** dragNodesKeys 标识键集合。 */
  dragNodesKeys: TreeKey[]
  /** dropPosition 配置项。 */
  dropPosition: TreeDropPosition
  /** dropToGap 配置项。 */
  dropToGap: boolean
}

/** TreeAllowDropInfo 接口。 */
export interface TreeAllowDropInfo {
  /** dragNode 配置项。 */
  dragNode: TreeNode
  /** dropNode 配置项。 */
  dropNode: TreeNode
  /** dropPosition 配置项。 */
  dropPosition: TreeDropPosition
  /** dropToGap 配置项。 */
  dropToGap: boolean
}

/** TreeDraggableConfig 配置对象。 */
export interface TreeDraggableConfig {
  /** 图标内容。 */
  icon?: any | false
  /** nodeDraggable 配置项。 */
  nodeDraggable?: (node: TreeNode) => boolean
}

/** TreeDraggable 类型。 */
export type TreeDraggable = boolean | ((node: TreeNode) => boolean) | TreeDraggableConfig

/** TreeClassNames 局部类名配置。 */
export interface TreeClassNames {
  /** 根节点区域配置。 */
  root?: string
  /** 头部区域内容。 */
  header?: string
  /** 主体区域配置。 */
  body?: string
  /** search 配置项。 */
  search?: string
  /** node 配置项。 */
  node?: string
  /** switcher 配置项。 */
  switcher?: string
  /** checkbox 配置项。 */
  checkbox?: string
  /** dragHandle 配置项。 */
  dragHandle?: string
  /** 展示标签。 */
  label?: string
  /** empty 配置项。 */
  empty?: string
}

/** TreeStyles 局部样式配置。 */
export interface TreeStyles {
  /** 根节点区域配置。 */
  root?: Record<string, any>
  /** 头部区域内容。 */
  header?: Record<string, any>
  /** 主体区域配置。 */
  body?: Record<string, any>
  /** search 配置项。 */
  search?: Record<string, any>
  /** node 配置项。 */
  node?: Record<string, any>
  /** switcher 配置项。 */
  switcher?: Record<string, any>
  /** checkbox 配置项。 */
  checkbox?: Record<string, any>
  /** dragHandle 配置项。 */
  dragHandle?: Record<string, any>
  /** 展示标签。 */
  label?: Record<string, any>
  /** empty 配置项。 */
  empty?: Record<string, any>
}

/** TreeTitleRenderProps 组件属性。 */
export interface TreeTitleRenderProps {
  /** node 配置项。 */
  node: TreeNode
  /** expanded 配置项。 */
  expanded: boolean
  /** selected 配置项。 */
  selected: boolean
  /** 受控选中状态。 */
  checked: boolean
  /** halfChecked 配置项。 */
  halfChecked: boolean
  /** 是否展示加载态。 */
  loading: boolean
}

/** TreeProps 组件属性。 */
export interface TreeProps {
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** treeData 配置项。 */
  treeData?: TreeDataNode[]
  /** 自定义数据字段映射。 */
  fieldNames?: TreeFieldNames
  /** treeDataSimpleMode 配置项。 */
  treeDataSimpleMode?: boolean | TreeSimpleModeConfig
  /** selectedKeys 标识键集合。 */
  selectedKeys?: TreeKey[]
  /** defaultSelectedKeys 标识键集合。 */
  defaultSelectedKeys?: TreeKey[]
  /** checkedKeys 标识键集合。 */
  checkedKeys?: TreeKey[] | TreeCheckedKeysObject
  /** defaultCheckedKeys 标识键集合。 */
  defaultCheckedKeys?: TreeKey[]
  /** expandedKeys 标识键集合。 */
  expandedKeys?: TreeKey[]
  /** defaultExpandedKeys 标识键集合。 */
  defaultExpandedKeys?: TreeKey[]
  /** defaultExpandAll 配置项。 */
  defaultExpandAll?: boolean
  /** multiple 配置项。 */
  multiple?: boolean
  /** checkable 配置项。 */
  checkable?: boolean
  /** checkStrictly 配置项。 */
  checkStrictly?: boolean
  /** showLine 配置项。 */
  showLine?: boolean
  /** showIcon 图标内容。 */
  showIcon?: boolean
  /** blockNode 配置项。 */
  blockNode?: boolean
  /** selectable 配置项。 */
  selectable?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 组件尺寸。 */
  size?: TreeSize
  /** 组件状态。 */
  status?: TreeStatus
  /** draggable 配置项。 */
  draggable?: TreeDraggable
  /** allowDrop 配置项。 */
  allowDrop?: (info: TreeAllowDropInfo) => boolean
  /** virtual 配置项。 */
  virtual?: boolean
  /** height 配置项。 */
  height?: number
  /** itemHeight 配置项。 */
  itemHeight?: number
  /** titleRender 自定义渲染函数。 */
  titleRender?: (props: TreeTitleRenderProps) => any
  /** switcherIcon 图标内容。 */
  switcherIcon?: any | ((props: TreeTitleRenderProps) => any)
  /** 图标内容。 */
  icon?: any | ((props: TreeTitleRenderProps) => any)
  /** filterTreeNode 配置项。 */
  filterTreeNode?: boolean | ((inputValue: string, node: TreeNode) => boolean)
  /** searchValue 值。 */
  searchValue?: string
  /** defaultSearchValue 值。 */
  defaultSearchValue?: string
  /** searchPlaceholder 配置项。 */
  searchPlaceholder?: any
  /** allowSearch 配置项。 */
  allowSearch?: boolean
  /** loadData 配置项。 */
  loadData?: (node: TreeNode) => Promise<any> | void
  /** emptyText 文本内容。 */
  emptyText?: any
  /** 选中项时触发的回调。 */
  onSelect?: (selectedKeys: TreeKey[], info: TreeEventInfo) => void
  /** onCheck 事件回调。 */
  onCheck?: (checkedKeys: TreeKey[] | TreeCheckedKeysObject, info: TreeEventInfo) => void
  /** onExpand 事件回调。 */
  onExpand?: (expandedKeys: TreeKey[], info: TreeEventInfo) => void
  /** 搜索文本变化时触发的回调。 */
  onSearch?: (value: string) => void
  /** onDoubleClick 事件回调。 */
  onDoubleClick?: (event: MouseEvent, node: TreeNode) => void
  /** onDragStart 事件回调。 */
  onDragStart?: (info: TreeDragEventInfo) => void
  /** onDragEnter 事件回调。 */
  onDragEnter?: (info: TreeDragEventInfo) => void
  /** onDragOver 事件回调。 */
  onDragOver?: (info: TreeDragEventInfo) => void
  /** onDragLeave 事件回调。 */
  onDragLeave?: (info: TreeDragEventInfo) => void
  /** onDragEnd 事件回调。 */
  onDragEnd?: (info: TreeDragEventInfo) => void
  /** onDrop 事件回调。 */
  onDrop?: (info: TreeDropInfo) => void
  /** onScroll 事件回调。 */
  onScroll?: (event: UIEvent) => void
  /** 按局部区域覆盖的类名集合。 */
  classNames?: TreeClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: TreeStyles
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** DirectoryTreeProps 组件属性。 */
export interface DirectoryTreeProps extends TreeProps {
  /** expandAction 配置项。 */
  expandAction?: TreeExpandAction
  /** toggleSelect 配置项。 */
  toggleSelect?: boolean
  /** rangeSelect 配置项。 */
  rangeSelect?: DirectoryTreeRangeSelectMode
}

interface InternalTreeProps extends TreeProps {
  directoryMode?: boolean
  expandAction?: TreeExpandAction
  toggleSelect?: boolean
  rangeSelect?: DirectoryTreeRangeSelectMode
}

interface TreeDragState {
  dragKeyText?: string
  overKeyText?: string
  dropPosition?: TreeDropPosition
}

interface TreeCheckState {
  checked: boolean
  halfChecked: boolean
  participates: boolean
}

interface NormalizedTreeResult {
  roots: TreeNode[]
  flat: TreeNode[]
  byKeyText: Record<string, TreeNode>
}

interface VisibleTreeNode {
  node: TreeNode
  matched: boolean
}

interface TreeRenderSlice {
  items: VisibleTreeNode[]
  topSpacer: number
  bottomSpacer: number
}

const defaultFieldNames: Required<TreeFieldNames> = {
  title: 'title',
  key: 'key',
  children: 'children',
  disabled: 'disabled',
  selectable: 'selectable',
  checkable: 'checkable',
  disableCheckbox: 'disableCheckbox',
  isLeaf: 'isLeaf',
  icon: 'icon',
  className: 'className',
  id: 'id',
  pId: 'pId',
}

/** join Class Name 的内部工具函数。 */
const joinClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

/** 判断 Object Record 的内部工具函数。 */
const isObjectRecord = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 判断 Tree Key 的内部工具函数。 */
const isTreeKey = (value: unknown): value is TreeKey => {
  return typeof value === 'string' || typeof value === 'number'
}

/** serialize Key 的内部工具函数。 */
const serializeKey = (key: TreeKey) => `${typeof key}:${String(key)}`

/** uniq Keys 的内部工具函数。 */
const uniqKeys = (keys?: ReadonlyArray<TreeKey>) => {
  const next: TreeKey[] = []
  const seen = new Set<string>()

  ;(keys ?? []).forEach(key => {
    const keyText = serializeKey(key)
    if (seen.has(keyText)) return
    seen.add(keyText)
    next.push(key)
  })

  return next
}

/** append Class Name 的内部工具函数。 */
const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const LoadingIcon: FC = () => {
  return <span className="loading loading-spinner loading-xs" aria-hidden="true" />
}

const ChevronIcon: FC<{ expanded: boolean; hidden?: boolean }> = ({ expanded, hidden }) => {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={appendClassName(
        'size-4 transition-transform duration-200',
        hidden ? 'opacity-0' : expanded ? 'rotate-90' : '',
      )}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 3.5 4 4.5-4 4.5" />
    </svg>
  )
}

const DragHandleIcon: FC = () => {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M5 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM11 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM11 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM11 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  )
}

const DirectoryFolderIcon: FC<{ expanded: boolean }> = ({ expanded }) => {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          expanded
            ? 'M2.5 6.5h11l-1.2 6h-9.1l-1.2-6ZM2.5 5V3.5h4l1.2 1.5h5.8v1.5'
            : 'M2.5 4.5h4l1.2 1.5h5.8v6.5h-11v-8Z'
        }
      />
    </svg>
  )
}

const DirectoryFileIcon: FC = () => {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 2.5h5l3 3v8H4v-11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 2.5v3h3" />
    </svg>
  )
}

/** 解析 Field 的内部工具函数。 */
const resolveField = (
  node: TreeDataNode,
  field: keyof Required<TreeFieldNames>,
  fieldNames?: TreeFieldNames,
) => {
  const fieldName = fieldNames?.[field] ?? defaultFieldNames[field]
  return node[fieldName]
}

/** 解析 Title 的内部工具函数。 */
const resolveTitle = (node: TreeDataNode, fieldNames?: TreeFieldNames) => {
  return resolveField(node, 'title', fieldNames) ?? node.title ?? node.key
}

/** 转换为 Key Text Set 的内部工具函数。 */
const toKeyTextSet = (keys?: ReadonlyArray<TreeKey>) => {
  return new Set(uniqKeys(keys).map(serializeKey))
}

/** 转换为 Search Text 的内部工具函数。 */
const toSearchText = (value: any): string => {
  if (value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value))
    return value
      .map(item => toSearchText(item))
      .filter(Boolean)
      .join(' ')
  if (typeof value === 'object') {
    return ['title', 'label', 'name', 'text', 'description', 'children']
      .map(key => toSearchText(value[key]))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

/** 构建 Simple Mode Tree Data 的内部工具函数。 */
const buildSimpleModeTreeData = (
  treeData: TreeDataNode[],
  treeDataSimpleMode?: boolean | TreeSimpleModeConfig,
  fieldNames?: TreeFieldNames,
) => {
  if (!treeDataSimpleMode) return treeData

  const modeConfig = isObjectRecord(treeDataSimpleMode) ? treeDataSimpleMode : undefined
  const idField = modeConfig?.id ?? fieldNames?.id ?? defaultFieldNames.id
  const pIdField = modeConfig?.pId ?? fieldNames?.pId ?? defaultFieldNames.pId
  const rootPId = modeConfig?.rootPId ?? 0
  const childrenField = fieldNames?.children ?? defaultFieldNames.children

  const clonedById = new Map<any, TreeDataNode>()

  treeData.forEach((item, index) => {
    const nodeId = item[idField] ?? item.key ?? index
    clonedById.set(nodeId, { ...item, [childrenField]: [] })
  })

  const roots: TreeDataNode[] = []

  treeData.forEach((item, index) => {
    const nodeId = item[idField] ?? item.key ?? index
    const parentId = item[pIdField]
    const currentNode = clonedById.get(nodeId)
    if (!currentNode) return

    if (
      parentId === undefined ||
      parentId === null ||
      parentId === rootPId ||
      !clonedById.has(parentId)
    ) {
      roots.push(currentNode)
      return
    }

    const parentNode = clonedById.get(parentId)
    if (!parentNode) {
      roots.push(currentNode)
      return
    }

    const children = (parentNode[childrenField] as TreeDataNode[]) ?? []
    children.push(currentNode)
    parentNode[childrenField] = children
  })

  return roots
}

/** 归一化 Tree Data 的内部工具函数。 */
const normalizeTreeData = (
  treeData: TreeDataNode[],
  fieldNames?: TreeFieldNames,
): NormalizedTreeResult => {
  const flat: TreeNode[] = []
  const byKeyText: Record<string, TreeNode> = {}

  const visit = (
    rawNode: TreeDataNode,
    depth: number,
    path: string,
    parentKeyText?: string,
  ): TreeNode => {
    const rawKey = resolveField(rawNode, 'key', fieldNames)
    const resolvedKey = isTreeKey(rawKey) ? rawKey : path
    const keyText = serializeKey(resolvedKey)
    const rawIsLeaf = resolveField(rawNode, 'isLeaf', fieldNames)

    const node: TreeNode = {
      key: resolvedKey,
      keyText,
      title: resolveTitle(rawNode, fieldNames),
      depth,
      children: [],
      raw: rawNode,
      disabled: !!resolveField(rawNode, 'disabled', fieldNames),
      selectable: resolveField(rawNode, 'selectable', fieldNames) !== false,
      checkable: resolveField(rawNode, 'checkable', fieldNames) !== false,
      disableCheckbox: !!resolveField(rawNode, 'disableCheckbox', fieldNames),
      isLeaf: false,
      className: resolveField(rawNode, 'className', fieldNames) as string | undefined,
      icon: resolveField(rawNode, 'icon', fieldNames),
      parentKeyText,
    }

    flat.push(node)
    byKeyText[keyText] = node

    const rawChildren = resolveField(rawNode, 'children', fieldNames)
    node.children = Array.isArray(rawChildren)
      ? rawChildren.map((child, index) => visit(child, depth + 1, `${path}-${index}`, keyText))
      : []
    node.isLeaf =
      rawIsLeaf === true ? true : rawIsLeaf === false ? false : node.children.length === 0

    return node
  }

  return {
    roots: treeData.map((node, index) => visit(node, 0, `node-${index}`)),
    flat,
    byKeyText,
  }
}

/** 读取 Descendant Check Keys 的内部工具函数。 */
const getDescendantCheckKeys = (node: TreeNode) => {
  const collected: string[] = []

  const visit = (currentNode: TreeNode) => {
    if (!currentNode.disabled && currentNode.checkable && !currentNode.disableCheckbox) {
      collected.push(currentNode.keyText)
    }
    currentNode.children.forEach(child => visit(child))
  }

  visit(node)
  return collected
}

/** 读取 Subtree Keys 的内部工具函数。 */
const getSubtreeKeys = (node: TreeNode) => {
  const keys: TreeKey[] = []

  const visit = (currentNode: TreeNode) => {
    keys.push(currentNode.key)
    currentNode.children.forEach(child => visit(child))
  }

  visit(node)
  return keys
}

/** derive Check State 的内部工具函数。 */
const deriveCheckState = (roots: TreeNode[], baseCheckedKeys: Set<string>, strict: boolean) => {
  const checkedKeys = new Set<string>()
  const halfCheckedKeys = new Set<string>()
  const stateMap: Record<string, TreeCheckState> = {}

  const visit = (node: TreeNode): TreeCheckState => {
    const selfParticipates = !node.disabled && node.checkable && !node.disableCheckbox
    const childStates = node.children.map(child => visit(child))
    const childParticipantStates = childStates.filter(state => state.participates)
    const selfChecked = baseCheckedKeys.has(node.keyText)

    let checked = selfChecked
    let halfChecked = false

    if (!strict && childParticipantStates.length > 0) {
      const allChildrenChecked = childParticipantStates.every(state => state.checked)
      const someChildrenChecked = childParticipantStates.some(
        state => state.checked || state.halfChecked,
      )

      checked = selfChecked || allChildrenChecked
      halfChecked = !checked && someChildrenChecked
    }

    const state: TreeCheckState = {
      checked,
      halfChecked,
      participates: selfParticipates || childParticipantStates.length > 0,
    }

    stateMap[node.keyText] = state

    if (checked && selfParticipates) checkedKeys.add(node.keyText)
    if (halfChecked && selfParticipates) halfCheckedKeys.add(node.keyText)

    return state
  }

  roots.forEach(node => visit(node))

  return { checkedKeys, halfCheckedKeys, stateMap }
}

/** 转换为 Checked Payload 的内部工具函数。 */
const toCheckedPayload = (
  checkedKeyTexts: string[],
  halfCheckedKeyTexts: string[],
  flatNodes: TreeNode[],
  strict: boolean,
) => {
  const checkedKeyTextSet = new Set(checkedKeyTexts)
  const halfCheckedKeyTextSet = new Set(halfCheckedKeyTexts)
  const checked = flatNodes
    .filter(node => checkedKeyTextSet.has(node.keyText))
    .map(node => node.key)
    .filter(isTreeKey)

  if (!strict) return checked

  return {
    checked,
    halfChecked: flatNodes
      .filter(node => halfCheckedKeyTextSet.has(node.keyText))
      .map(node => node.key)
      .filter(isTreeKey),
  }
}

/** filter Visible Nodes 的内部工具函数。 */
const filterVisibleNodes = (
  roots: TreeNode[],
  expandedKeys: Set<string>,
  searchValue: string,
  matchesNode: (node: TreeNode) => boolean,
) => {
  if (!searchValue) {
    const visible: VisibleTreeNode[] = []

    const visit = (node: TreeNode) => {
      visible.push({ node, matched: false })
      if (expandedKeys.has(node.keyText)) {
        node.children.forEach(child => visit(child))
      }
    }

    roots.forEach(node => visit(node))
    return visible
  }

  const visitFiltered = (node: TreeNode): VisibleTreeNode[] => {
    const selfMatched = matchesNode(node)
    const matchedChildren = node.children.flatMap(child => visitFiltered(child))
    if (!selfMatched && matchedChildren.length === 0) return []

    if (selfMatched) {
      const branch: VisibleTreeNode[] = [{ node, matched: true }]
      const collect = (currentNode: TreeNode) => {
        branch.push({ node: currentNode, matched: false })
        currentNode.children.forEach(child => collect(child))
      }
      node.children.forEach(child => collect(child))
      return branch
    }

    return [{ node, matched: false }, ...matchedChildren]
  }

  return roots.flatMap(node => visitFiltered(node))
}

/** matches Tree Node 的内部工具函数。 */
const matchesTreeNode = (
  node: TreeNode,
  inputValue: string,
  filterTreeNode?: boolean | ((inputValue: string, node: TreeNode) => boolean),
) => {
  if (!inputValue) return true
  if (typeof filterTreeNode === 'function') return filterTreeNode(inputValue, node)
  if (filterTreeNode === false) return true
  return toSearchText(node.title).toLowerCase().includes(inputValue.toLowerCase())
}

/** 判断 Ancestor Node 的内部工具函数。 */
const isAncestorNode = (
  possibleAncestor: TreeNode,
  node: TreeNode,
  byKeyText: Record<string, TreeNode>,
) => {
  let currentParentKeyText = node.parentKeyText
  while (currentParentKeyText) {
    if (currentParentKeyText === possibleAncestor.keyText) return true
    currentParentKeyText = byKeyText[currentParentKeyText]?.parentKeyText
  }
  return false
}

/** 解析 Draggable Config 的内部工具函数。 */
const resolveDraggableConfig = (draggable?: TreeDraggable) => {
  const enabled = !!draggable
  const config = isObjectRecord(draggable) ? (draggable as TreeDraggableConfig) : undefined
  const icon = config?.icon

  const nodeDraggable = (node: TreeNode) => {
    if (!enabled) return false
    if (typeof draggable === 'function') return draggable(node)
    if (config && typeof config.nodeDraggable === 'function') {
      return config.nodeDraggable(node)
    }
    return true
  }

  return {
    enabled,
    icon,
    nodeDraggable,
  }
}

/** 构建 Virtual Slice 的内部工具函数。 */
const buildVirtualSlice = (
  items: VisibleTreeNode[],
  scrollTop: number,
  viewportHeight?: number,
  itemHeight?: number,
  virtual?: boolean,
) => {
  if (!virtual || !viewportHeight || !itemHeight) {
    return {
      items,
      topSpacer: 0,
      bottomSpacer: 0,
    } satisfies TreeRenderSlice
  }

  const rowGap = 4
  const rowStride = itemHeight + rowGap
  const overscan = 6
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowStride))
  const sliceWindow = visibleCount + overscan * 2
  const maxStartIndex = Math.max(0, items.length - sliceWindow)
  const startIndex = Math.min(
    maxStartIndex,
    Math.max(0, Math.floor(scrollTop / rowStride) - overscan),
  )
  const endIndex = Math.min(items.length, startIndex + sliceWindow)

  return {
    items: items.slice(startIndex, endIndex),
    topSpacer: startIndex * rowStride,
    bottomSpacer: Math.max(0, (items.length - endIndex) * rowStride),
  } satisfies TreeRenderSlice
}

/** 转换为 Drop Intent 的内部工具函数。 */
const toDropIntent = (dropPosition?: TreeDropPosition) => {
  if (dropPosition === -1) return 'before'
  if (dropPosition === 1) return 'after'
  if (dropPosition === 0) return 'inside'
  return undefined
}

/** key Texts To Keys 的内部工具函数。 */
const keyTextsToKeys = (keyTexts: string[], byKeyText: Record<string, TreeNode>) => {
  return keyTexts.map(keyText => byKeyText[keyText]?.key).filter(isTreeKey)
}

/** same Key Text Set 的内部工具函数。 */
const sameKeyTextSet = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) return false
  for (const keyText of left) {
    if (!right.has(keyText)) return false
  }
  return true
}

/** size Config 的内部工具函数。 */
const sizeConfig = (size?: TreeSize) => {
  switch (size) {
    case 'small':
    case 'sm':
      return {
        headerPadding: 'px-4 py-3',
        bodyPadding: 'px-3 py-3',
        rowPadding: 'py-1.5',
        textClass: 'text-sm',
        rowMinHeight: 36,
        rowEstimate: 42,
      }
    case 'large':
    case 'lg':
      return {
        headerPadding: 'px-5 py-4',
        bodyPadding: 'px-4 py-4',
        rowPadding: 'py-2.5',
        textClass: 'text-[0.95rem]',
        rowMinHeight: 44,
        rowEstimate: 50,
      }
    default:
      return {
        headerPadding: 'px-4 py-3.5',
        bodyPadding: 'px-3.5 py-3.5',
        rowPadding: 'py-2',
        textClass: 'text-sm',
        rowMinHeight: 40,
        rowEstimate: 46,
      }
  }
}

/** 解析 Status Class Name 的内部工具函数。 */
const resolveStatusClassName = (status?: TreeStatus) => {
  switch (status) {
    case 'error':
      return 'border-error/55 shadow-[0_0_0_1px_rgba(248,113,113,0.14)]'
    case 'warning':
      return 'border-warning/55 shadow-[0_0_0_1px_rgba(251,191,36,0.14)]'
    default:
      return ''
  }
}

/** Tree Root 的内部工具函数。 */
const TreeRoot: FC<InternalTreeProps> = ({
  className,
  style,
  treeData = [],
  fieldNames,
  treeDataSimpleMode,
  selectedKeys,
  defaultSelectedKeys,
  checkedKeys,
  defaultCheckedKeys,
  expandedKeys,
  defaultExpandedKeys,
  defaultExpandAll,
  multiple,
  checkable,
  checkStrictly,
  showLine,
  showIcon,
  blockNode,
  selectable = true,
  disabled,
  size,
  status,
  draggable,
  allowDrop,
  virtual = true,
  height,
  itemHeight,
  titleRender,
  switcherIcon,
  icon,
  filterTreeNode,
  searchValue,
  defaultSearchValue,
  searchPlaceholder = '搜索节点',
  allowSearch,
  loadData,
  emptyText = '暂无节点',
  onSelect,
  onCheck,
  onExpand,
  onSearch,
  onDoubleClick,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onScroll,
  classNames,
  styles,
  directoryMode,
  expandAction = false,
  toggleSelect = true,
  rangeSelect = 'append',
  ...rest
}) => {
  const sourceTreeData = buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames)
  const normalizedTree = normalizeTreeData(sourceTreeData, fieldNames)
  const normalizedTreeRef = useRef<NormalizedTreeResult>()
  normalizedTreeRef.current = normalizedTree
  const componentSize = sizeConfig(size)
  const dragConfig = resolveDraggableConfig(draggable)
  const initialExpandedKeys = defaultExpandAll
    ? normalizedTree.flat
        .filter(node => node.children.length > 0 || !node.isLeaf)
        .map(node => node.key)
    : (defaultExpandedKeys ?? [])

  const renderVersion = ref(0)
  const uncontrolledSelectedKeysRef = ref(uniqKeys(defaultSelectedKeys ?? selectedKeys))
  const uncontrolledCheckedKeysRef = ref(uniqKeys(defaultCheckedKeys))
  const uncontrolledExpandedKeysRef = ref(uniqKeys(initialExpandedKeys))
  const controlledSelectedKeysRef = ref(uniqKeys(selectedKeys))
  const controlledExpandedKeysRef = ref(uniqKeys(expandedKeys))
  const controlledCheckedKeyTextsRef = ref<Set<string>>(
    checkedKeys === undefined
      ? new Set<string>()
      : Array.isArray(checkedKeys)
        ? toKeyTextSet(checkedKeys)
        : toKeyTextSet(checkedKeys.checked),
  )
  const searchValueRef = ref(defaultSearchValue ?? '')
  const loadingKeyTextsRef = ref<string[]>([])
  const scrollTopRef = ref(0)
  const directoryLastSelectedKeyTextRef = ref<string | null>(null)
  const directoryCachedSelectedKeyTextsRef = ref<string[]>([])
  const bodyHostRef = useRef<HTMLDivElement>()
  const dragStateRef = ref<TreeDragState>({})
  const dragHoverDepthRef = ref<Record<string, number>>({})

  if (checkedKeys !== undefined) {
    const nextControlledCheckedKeyTexts = Array.isArray(checkedKeys)
      ? toKeyTextSet(checkedKeys)
      : toKeyTextSet(checkedKeys.checked)

    if (!sameKeyTextSet(controlledCheckedKeyTextsRef.value, nextControlledCheckedKeyTexts)) {
      controlledCheckedKeyTextsRef.value = nextControlledCheckedKeyTexts
    }
  }

  if (
    selectedKeys !== undefined &&
    !sameKeyTextSet(toKeyTextSet(controlledSelectedKeysRef.value), toKeyTextSet(selectedKeys))
  ) {
    controlledSelectedKeysRef.value = uniqKeys(selectedKeys)
  }

  if (
    expandedKeys !== undefined &&
    !sameKeyTextSet(toKeyTextSet(controlledExpandedKeysRef.value), toKeyTextSet(expandedKeys))
  ) {
    controlledExpandedKeysRef.value = uniqKeys(expandedKeys)
  }

  const estimatedRowHeight = itemHeight ?? componentSize.rowEstimate
  const viewportHeight = typeof height === 'number' && height > 0 ? height : undefined
  const fixedVirtualRowHeight =
    virtual !== false && viewportHeight && typeof itemHeight === 'number' && itemHeight > 0
      ? itemHeight
      : undefined

  function requestRender() {
    renderVersion.value += 1
    syncTreeBodyDom()
  }

  function rebuildNormalizedTree() {
    const nextSourceTreeData = buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames)
    const nextNormalizedTree = normalizeTreeData(nextSourceTreeData, fieldNames)
    normalizedTreeRef.current = nextNormalizedTree
    return nextNormalizedTree
  }

  function getNormalizedTree() {
    return normalizedTreeRef.current ?? rebuildNormalizedTree()
  }

  function readMergedSelectedKeys() {
    return selectedKeys !== undefined
      ? controlledSelectedKeysRef.value
      : uncontrolledSelectedKeysRef.value
  }

  function readMergedExpandedKeys() {
    return expandedKeys !== undefined
      ? controlledExpandedKeysRef.value
      : uncontrolledExpandedKeysRef.value
  }

  function readMergedSearchValue() {
    return searchValue !== undefined ? searchValue : searchValueRef.value
  }

  function readMergedCheckedKeyTexts() {
    if (checkedKeys === undefined) return toKeyTextSet(uncontrolledCheckedKeysRef.value)
    return controlledCheckedKeyTextsRef.value
  }

  function readVisibleNodes() {
    const currentTree = rebuildNormalizedTree()
    const currentExpandedKeyTexts = toKeyTextSet(readMergedExpandedKeys())
    const currentSearchValue = readMergedSearchValue()

    return filterVisibleNodes(
      currentTree.roots,
      currentExpandedKeyTexts,
      currentSearchValue,
      node => matchesTreeNode(node, currentSearchValue, filterTreeNode),
    )
  }

  function readRenderSnapshot() {
    void renderVersion.value

    const currentTree = rebuildNormalizedTree()
    const currentSearchValue = readMergedSearchValue()
    const currentSelectedKeyTextSet = toKeyTextSet(readMergedSelectedKeys())
    const currentExpandedKeyTextSet = toKeyTextSet(readMergedExpandedKeys())
    const currentCheckedKeyTexts = readMergedCheckedKeyTexts()
    const currentCheckState = deriveCheckState(
      currentTree.roots,
      currentCheckedKeyTexts,
      !!checkStrictly,
    )
    const currentVisibleNodes = filterVisibleNodes(
      currentTree.roots,
      currentExpandedKeyTextSet,
      currentSearchValue,
      node => matchesTreeNode(node, currentSearchValue, filterTreeNode),
    )
    const currentVirtualSlice = buildVirtualSlice(
      currentVisibleNodes,
      scrollTopRef.value,
      viewportHeight,
      estimatedRowHeight,
      virtual !== false && !!viewportHeight,
    )

    return {
      searchValue: currentSearchValue,
      selectedKeyTextSet: currentSelectedKeyTextSet,
      expandedKeyTextSet: currentExpandedKeyTextSet,
      checkState: currentCheckState,
      visibleNodes: currentVisibleNodes,
      virtualSlice: currentVirtualSlice,
      dragState: dragStateRef.value,
    }
  }

  const emitExpand = (
    nextExpandedKeys: TreeKey[],
    node: TreeNode,
    nativeEvent?: Event | MouseEvent,
  ) => {
    const normalizedKeys = uniqKeys(nextExpandedKeys)
    if (expandedKeys === undefined) uncontrolledExpandedKeysRef.value = normalizedKeys
    else controlledExpandedKeysRef.value = normalizedKeys
    requestRender()
    if (onExpand) {
      onExpand(normalizedKeys, {
        node,
        expanded: normalizedKeys.some(key => serializeKey(key) === node.keyText),
        nativeEvent,
      })
    }
    return normalizedKeys
  }

  const commitSelectedKeys = (
    nextSelectedKeys: TreeKey[],
    node: TreeNode,
    nativeEvent?: Event | MouseEvent,
  ) => {
    const currentTree = getNormalizedTree()
    const cleanedKeys = uniqKeys(nextSelectedKeys).filter(
      key => currentTree.byKeyText[serializeKey(key)],
    )
    const selectedNodes = cleanedKeys
      .map(key => currentTree.byKeyText[serializeKey(key)])
      .filter(Boolean)

    if (selectedKeys === undefined) uncontrolledSelectedKeysRef.value = cleanedKeys
    else controlledSelectedKeysRef.value = cleanedKeys
    requestRender()

    if (onSelect) {
      onSelect(cleanedKeys, {
        node,
        nativeEvent,
        selected: cleanedKeys.some(key => serializeKey(key) === node.keyText),
        selectedNodes,
      })
    }
  }

  const commitCheckedKeys = (
    nextCheckedKeyTexts: Set<string>,
    node: TreeNode,
    nativeEvent?: Event | MouseEvent,
  ) => {
    const currentTree = getNormalizedTree()
    const nextCheckState = deriveCheckState(currentTree.roots, nextCheckedKeyTexts, !!checkStrictly)
    const checkedPayload = toCheckedPayload(
      Array.from(nextCheckState.checkedKeys),
      Array.from(nextCheckState.halfCheckedKeys),
      currentTree.flat,
      !!checkStrictly,
    )

    if (checkedKeys === undefined) {
      uncontrolledCheckedKeysRef.value = checkStrictly
        ? (checkedPayload as TreeCheckedKeysObject).checked
        : (checkedPayload as TreeKey[])
    } else {
      controlledCheckedKeyTextsRef.value = new Set(nextCheckState.checkedKeys)
    }
    requestRender()

    if (onCheck) {
      onCheck(checkedPayload, {
        node,
        nativeEvent,
        checked: nextCheckState.checkedKeys.has(node.keyText),
        checkedNodes: Array.from(nextCheckState.checkedKeys)
          .map(keyText => currentTree.byKeyText[keyText])
          .filter(Boolean),
        halfCheckedKeys: Array.from(nextCheckState.halfCheckedKeys)
          .map(keyText => currentTree.byKeyText[keyText]?.key)
          .filter(isTreeKey),
      })
    }
  }

  const toggleExpanded = async (node: TreeNode, nativeEvent?: Event | MouseEvent) => {
    const currentExpandedKeys = readMergedExpandedKeys()
    const currentExpandedKeyTexts = toKeyTextSet(currentExpandedKeys)

    if (disabled || node.disabled) return currentExpandedKeys

    const currentlyExpanded = currentExpandedKeyTexts.has(node.keyText)
    const nextExpandedKeys = currentlyExpanded
      ? currentExpandedKeys.filter(key => serializeKey(key) !== node.keyText)
      : [...currentExpandedKeys, node.key]
    const committedExpandedKeys = emitExpand(nextExpandedKeys, node, nativeEvent)

    if (!currentlyExpanded && loadData && !node.isLeaf && node.children.length === 0) {
      if (!loadingKeyTextsRef.value.includes(node.keyText)) {
        loadingKeyTextsRef.value = [...loadingKeyTextsRef.value, node.keyText]
        requestRender()
        try {
          await loadData(node)
          rebuildNormalizedTree()
          requestRender()
        } finally {
          loadingKeyTextsRef.value = loadingKeyTextsRef.value.filter(
            keyText => keyText !== node.keyText,
          )
        }
      }
    }

    return committedExpandedKeys
  }

  const handleExpandToggle = (node: TreeNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void toggleExpanded(node, event)
  }

  const selectTreeNode = (node: TreeNode, nativeEvent?: MouseEvent) => {
    if (disabled || node.disabled || !selectable || !node.selectable) return

    const currentSelectedKeys = readMergedSelectedKeys()
    const currentSelectedKeyTexts = toKeyTextSet(currentSelectedKeys)

    if (directoryMode) {
      const controlPick =
        !!multiple && !!toggleSelect && !!(nativeEvent?.ctrlKey || nativeEvent?.metaKey)
      const shiftPick =
        !!multiple &&
        rangeSelect !== false &&
        !!nativeEvent?.shiftKey &&
        !!directoryLastSelectedKeyTextRef.value

      if (multiple && shiftPick) {
        const orderedVisibleKeyTexts = readVisibleNodes().map(item => item.node.keyText)
        const anchorKeyText = directoryLastSelectedKeyTextRef.value ?? node.keyText
        const startIndex = orderedVisibleKeyTexts.indexOf(anchorKeyText)
        const endIndex = orderedVisibleKeyTexts.indexOf(node.keyText)
        const rangeStart = Math.min(startIndex, endIndex)
        const rangeEnd = Math.max(startIndex, endIndex)
        const rangeKeyTexts = orderedVisibleKeyTexts.slice(rangeStart, rangeEnd + 1)
        const cachedKeyTexts =
          rangeSelect === 'append'
            ? directoryCachedSelectedKeyTextsRef.value.length
              ? directoryCachedSelectedKeyTextsRef.value
              : currentSelectedKeys.map(serializeKey)
            : []
        const nextSelectedKeyTexts = Array.from(new Set([...cachedKeyTexts, ...rangeKeyTexts]))
        commitSelectedKeys(
          keyTextsToKeys(nextSelectedKeyTexts, getNormalizedTree().byKeyText),
          node,
          nativeEvent,
        )
        return
      }

      if (multiple && controlPick) {
        const nextSelectedKeys = currentSelectedKeyTexts.has(node.keyText)
          ? currentSelectedKeys.filter(key => serializeKey(key) !== node.keyText)
          : [...currentSelectedKeys, node.key]
        directoryLastSelectedKeyTextRef.value = node.keyText
        directoryCachedSelectedKeyTextsRef.value = nextSelectedKeys.map(serializeKey)
        commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
        return
      }

      directoryLastSelectedKeyTextRef.value = node.keyText
      directoryCachedSelectedKeyTextsRef.value = [node.keyText]
      commitSelectedKeys([node.key], node, nativeEvent)
      return
    }

    if (multiple) {
      const nextSelectedKeys = currentSelectedKeyTexts.has(node.keyText)
        ? currentSelectedKeys.filter(key => serializeKey(key) !== node.keyText)
        : [...currentSelectedKeys, node.key]
      commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
      return
    }

    const nextSelectedKeys = currentSelectedKeyTexts.has(node.keyText) ? [] : [node.key]
    commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
  }

  const handleCheck = (node: TreeNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (disabled || node.disabled || !node.checkable || node.disableCheckbox) return

    const currentCheckedKeyTexts = readMergedCheckedKeyTexts()
    const currentCheckState = deriveCheckState(
      getNormalizedTree().roots,
      currentCheckedKeyTexts,
      !!checkStrictly,
    )
    const nextCheckedKeys = new Set(currentCheckedKeyTexts)
    const isChecked = currentCheckState.checkedKeys.has(node.keyText)

    if (checkStrictly) {
      if (isChecked) nextCheckedKeys.delete(node.keyText)
      else nextCheckedKeys.add(node.keyText)
    } else {
      const subtreeKeys = getDescendantCheckKeys(node)
      if (isChecked) subtreeKeys.forEach(keyText => nextCheckedKeys.delete(keyText))
      else subtreeKeys.forEach(keyText => nextCheckedKeys.add(keyText))
    }

    commitCheckedKeys(nextCheckedKeys, node, event)
  }

  const handleSearchInput = (value: string) => {
    if (searchValue === undefined) searchValueRef.value = value
    requestRender()
    if (onSearch) onSearch(value)
  }

  const handleBodyScroll = (event: UIEvent) => {
    scrollTopRef.value = (event.currentTarget as HTMLElement).scrollTop
    requestRender()
    if (onScroll) onScroll(event)
  }

  const clearDragHoverState = (keyText?: string) => {
    if (!keyText || dragStateRef.value.overKeyText !== keyText) return
    dragStateRef.value = {
      dragKeyText: dragStateRef.value.dragKeyText,
    }
    requestRender()
  }

  const setDragHoverState = (keyText: string, dropPosition: TreeDropPosition) => {
    if (
      dragStateRef.value.overKeyText === keyText &&
      dragStateRef.value.dropPosition === dropPosition
    ) {
      return
    }

    dragStateRef.value = {
      ...dragStateRef.value,
      overKeyText: keyText,
      dropPosition,
    }
    requestRender()
  }

  const updateDragHoverDepth = (keyText: string, delta: 1 | -1) => {
    const nextDepths = { ...dragHoverDepthRef.value }
    const currentDepth = nextDepths[keyText] ?? 0
    const nextDepth = Math.max(currentDepth + delta, 0)

    if (nextDepth > 0) nextDepths[keyText] = nextDepth
    else delete nextDepths[keyText]

    dragHoverDepthRef.value = nextDepths
    requestRender()
    return nextDepth
  }

  const resetDragState = () => {
    dragHoverDepthRef.value = {}
    dragStateRef.value = {}
    requestRender()
  }

  const resolveDropContext = (
    dropNode: TreeNode,
    event: DragEvent | Event,
    currentTarget?: HTMLElement | null,
  ) => {
    const currentTree = getNormalizedTree()
    const dragKeyText = dragStateRef.value.dragKeyText
    if (!dragKeyText) return null
    const dragNode = currentTree.byKeyText[dragKeyText]
    if (!dragNode || dragNode.keyText === dropNode.keyText) return null
    if (isAncestorNode(dragNode, dropNode, currentTree.byKeyText)) return null

    const rect = currentTarget?.getBoundingClientRect?.()
    const clientY = 'clientY' in event ? (event as DragEvent).clientY : undefined
    let dropPosition: TreeDropPosition = 0

    if (rect && typeof clientY === 'number') {
      if (clientY < rect.top + rect.height * 0.25) dropPosition = -1
      else if (clientY > rect.bottom - rect.height * 0.25) dropPosition = 1
    }

    const dropToGap = dropPosition !== 0

    if (allowDrop && !allowDrop({ dragNode, dropNode, dropPosition, dropToGap })) return null

    return {
      dragNode,
      dropPosition,
    }
  }

  const handleDragStartNode = (node: TreeNode, event: DragEvent) => {
    const currentDragConfig = resolveDraggableConfig(draggable)
    if (
      !currentDragConfig.enabled ||
      !currentDragConfig.nodeDraggable(node) ||
      disabled ||
      node.disabled
    )
      return

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', node.keyText)
    }

    dragHoverDepthRef.value = {}
    dragStateRef.value = { dragKeyText: node.keyText }
    requestRender()

    if (onDragStart) {
      onDragStart({ event, node })
    }
  }

  const handleDragEnterNode = (node: TreeNode, event: DragEvent) => {
    if (!dragStateRef.value.dragKeyText) return

    updateDragHoverDepth(node.keyText, 1)

    const dropContext = resolveDropContext(node, event, event.currentTarget as HTMLElement)
    if (!dropContext) {
      clearDragHoverState(node.keyText)
      return
    }

    event.preventDefault()
    setDragHoverState(node.keyText, dropContext.dropPosition)

    let nextExpandedKeys = readMergedExpandedKeys()
    const currentExpandedKeyTexts = toKeyTextSet(nextExpandedKeys)
    if (
      dropContext.dropPosition === 0 &&
      !currentExpandedKeyTexts.has(node.keyText) &&
      (node.children.length > 0 || !node.isLeaf)
    ) {
      nextExpandedKeys = emitExpand([...nextExpandedKeys, node.key], node, event)
    }

    if (onDragEnter) {
      onDragEnter({ event, node, expandedKeys: nextExpandedKeys })
    }
  }

  const handleDragOverNode = (node: TreeNode, event: DragEvent) => {
    if (!dragStateRef.value.dragKeyText) return

    const dropContext = resolveDropContext(node, event, event.currentTarget as HTMLElement)
    if (!dropContext) {
      clearDragHoverState(node.keyText)
      return
    }

    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    setDragHoverState(node.keyText, dropContext.dropPosition)

    if (onDragOver) {
      onDragOver({ event, node })
    }
  }

  const handleDragLeaveNode = (node: TreeNode, event: DragEvent) => {
    const nextDepth = updateDragHoverDepth(node.keyText, -1)

    if (nextDepth === 0) {
      clearDragHoverState(node.keyText)
    }

    if (onDragLeave) {
      onDragLeave({ event, node })
    }
  }

  const handleDragEndNode = (node: TreeNode, event: DragEvent) => {
    resetDragState()

    if (onDragEnd) {
      onDragEnd({ event, node })
    }
  }

  const handleDropNode = (node: TreeNode, event: DragEvent) => {
    const dropContext = resolveDropContext(node, event, event.currentTarget as HTMLElement)
    if (!dropContext) {
      resetDragState()
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const dropPosition =
      dragStateRef.value.overKeyText === node.keyText &&
      dragStateRef.value.dropPosition !== undefined
        ? dragStateRef.value.dropPosition
        : dropContext.dropPosition

    if (onDrop) {
      onDrop({
        event,
        node,
        dragNode: dropContext.dragNode,
        dragNodesKeys: getSubtreeKeys(dropContext.dragNode),
        dropPosition,
        dropToGap: dropPosition !== 0,
      })
    }

    resetDragState()
  }

  const renderSwitcher = (
    node: TreeNode,
    expanded: boolean,
    selected: boolean,
    checked: boolean,
    halfChecked: boolean,
    loading: boolean,
  ) => {
    const renderProps: TreeTitleRenderProps = {
      node,
      expanded,
      selected,
      checked,
      halfChecked,
      loading,
    }

    if (typeof switcherIcon === 'function') return switcherIcon(renderProps)
    if (switcherIcon !== undefined) return switcherIcon
    return loading ? (
      <LoadingIcon />
    ) : (
      <ChevronIcon expanded={expanded} hidden={node.isLeaf && node.children.length === 0} />
    )
  }

  const renderDragHandle = (node: TreeNode) => {
    if (!dragConfig.enabled || dragConfig.icon === false || !dragConfig.nodeDraggable(node))
      return null

    return (
      <span
        aria-hidden="true"
        className={appendClassName(
          'inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-lg text-base-content/35 transition group-hover:text-base-content/55',
          classNames?.dragHandle,
        )}
        style={styles?.dragHandle}
        data-rue-tree-drag-handle="true"
      >
        {dragConfig.icon ?? <DragHandleIcon />}
      </span>
    )
  }

  const renderGapPlaceholder = (node: TreeNode, position: 'before' | 'after') => {
    return (
      <div
        className={joinClassName(
          'pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/85',
          position === 'before' ? '-top-2.5' : '-bottom-2.5',
        )}
        style={{ paddingLeft: `${node.depth * 18 + 20}px` }}
        data-rue-tree-drop-placeholder={position}
      >
        <span className="h-[2px] flex-1 rounded-full bg-primary/60" />
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px]">插入到此处</span>
      </div>
    )
  }

  const renderNodeIcon = (
    node: TreeNode,
    expanded: boolean,
    selected: boolean,
    checked: boolean,
    halfChecked: boolean,
    loading: boolean,
  ) => {
    const renderProps: TreeTitleRenderProps = {
      node,
      expanded,
      selected,
      checked,
      halfChecked,
      loading,
    }

    if (typeof icon === 'function') return icon(renderProps)
    if (icon !== undefined) return icon
    if (node.icon !== undefined) return node.icon
    if (!showIcon) return null

    if (directoryMode) {
      return (
        <span className="inline-flex size-6 items-center justify-center text-base-content/60">
          {node.children.length > 0 || !node.isLeaf ? (
            <DirectoryFolderIcon expanded={expanded} />
          ) : (
            <DirectoryFileIcon />
          )}
        </span>
      )
    }

    return (
      <span className="inline-flex size-6 items-center justify-center rounded-xl bg-base-200/80 text-[11px] text-base-content/60">
        {node.children.length > 0 || !node.isLeaf ? 'DIR' : 'DOC'}
      </span>
    )
  }

  const handleLabelActivate = (
    node: TreeNode,
    event: MouseEvent,
    interaction: 'click' | 'doubleClick',
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (interaction === 'doubleClick' && onDoubleClick) {
      onDoubleClick(event, node)
    }

    const shouldToggleFromLabel =
      directoryMode && expandAction === interaction && (node.children.length > 0 || !node.isLeaf)

    if (interaction === 'click' && shouldToggleFromLabel) {
      batch(() => {
        void toggleExpanded(node, event)
        selectTreeNode(node, event)
      })
      return
    }

    if (shouldToggleFromLabel) {
      void toggleExpanded(node, event)
    }

    if (interaction === 'click') {
      selectTreeNode(node, event)
    }
  }

  const renderTreeBodyContent = () => {
    const snapshot = readRenderSnapshot()

    return (
      <>
        {snapshot.virtualSlice.topSpacer > 0 ? (
          <div style={{ height: `${snapshot.virtualSlice.topSpacer}px` }} aria-hidden="true" />
        ) : null}
        {snapshot.virtualSlice.items.map(({ node }) => {
          const state = snapshot.checkState.stateMap[node.keyText] ?? {
            checked: false,
            halfChecked: false,
            participates: true,
          }
          const expanded = snapshot.searchValue
            ? true
            : snapshot.expandedKeyTextSet.has(node.keyText)
          const selected = snapshot.selectedKeyTextSet.has(node.keyText)
          const loading = loadingKeyTextsRef.value.includes(node.keyText)
          const canExpand = !!loadData || node.children.length > 0 || !node.isLeaf
          const rowIsDragTarget = snapshot.dragState.overKeyText === node.keyText
          const canDragNode =
            dragConfig.enabled && dragConfig.nodeDraggable(node) && !disabled && !node.disabled
          const dropIntent = rowIsDragTarget
            ? toDropIntent(snapshot.dragState.dropPosition)
            : undefined
          const renderProps: TreeTitleRenderProps = {
            node,
            expanded,
            selected,
            checked: state.checked,
            halfChecked: state.halfChecked,
            loading,
          }

          return (
            <div
              key={node.keyText}
              className={appendClassName(
                joinClassName(
                  'rue-tree-node',
                  showLine && node.depth > 0 && 'border-l border-base-300/60',
                  node.className,
                ),
                classNames?.node,
              )}
              style={{
                paddingLeft: `${node.depth * 18 + 8}px`,
                height: fixedVirtualRowHeight ? `${fixedVirtualRowHeight}px` : undefined,
                minHeight: fixedVirtualRowHeight ? undefined : `${componentSize.rowMinHeight}px`,
                ...styles?.node,
              }}
              data-rue-tree-node={node.keyText}
              data-rue-tree-drop-intent={dropIntent ?? ''}
              data-rue-tree-drop-position={
                rowIsDragTarget ? String(snapshot.dragState.dropPosition ?? 0) : ''
              }
              draggable={canDragNode}
              onDragStart={(event: DragEvent) => handleDragStartNode(node, event)}
              onDragEnter={(event: DragEvent) => handleDragEnterNode(node, event)}
              onDragOver={(event: DragEvent) => handleDragOverNode(node, event)}
              onDragLeave={(event: DragEvent) => handleDragLeaveNode(node, event)}
              onDragEnd={(event: DragEvent) => handleDragEndNode(node, event)}
              onDrop={(event: DragEvent) => handleDropNode(node, event)}
            >
              {dropIntent === 'before' ? renderGapPlaceholder(node, 'before') : null}
              <button
                type="button"
                disabled={!canExpand || disabled || node.disabled}
                aria-label={expanded ? '折叠节点' : '展开节点'}
                onClick={(event: MouseEvent) => handleExpandToggle(node, event)}
              >
                {renderSwitcher(
                  node,
                  expanded,
                  selected,
                  state.checked,
                  state.halfChecked,
                  loading,
                )}
              </button>
              {checkable ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state.halfChecked ? 'mixed' : state.checked ? 'true' : 'false'}
                  disabled={disabled || node.disabled || node.disableCheckbox || !node.checkable}
                  onClick={(event: MouseEvent) => handleCheck(node, event)}
                >
                  {state.halfChecked ? '−' : state.checked ? '✓' : ''}
                </button>
              ) : null}
              {renderDragHandle(node)}
              {showIcon || node.icon !== undefined || icon !== undefined
                ? renderNodeIcon(
                    node,
                    expanded,
                    selected,
                    state.checked,
                    state.halfChecked,
                    loading,
                  )
                : null}
              <button
                type="button"
                className={appendClassName(
                  joinClassName(selected ? 'selected' : '', blockNode ? 'w-full' : ''),
                  classNames?.label,
                )}
                style={styles?.label}
                disabled={disabled || node.disabled || !selectable || !node.selectable}
                onClick={(event: MouseEvent) => handleLabelActivate(node, event, 'click')}
                onDblClick={(event: MouseEvent) => handleLabelActivate(node, event, 'doubleClick')}
              >
                {titleRender ? titleRender(renderProps) : <span>{node.title}</span>}
                {dropIntent ? (
                  <span data-rue-tree-drop-placeholder={dropIntent}>
                    {dropIntent === 'inside' ? '放入' : dropIntent === 'before' ? '插前' : '插后'}
                  </span>
                ) : selected ? (
                  <span>选中</span>
                ) : null}
              </button>
              {dropIntent === 'after' ? renderGapPlaceholder(node, 'after') : null}
            </div>
          )
        })}
        {snapshot.virtualSlice.bottomSpacer > 0 ? (
          <div style={{ height: `${snapshot.virtualSlice.bottomSpacer}px` }} aria-hidden="true" />
        ) : null}
        {!snapshot.visibleNodes.length ? (
          <div className={classNames?.empty}>{emptyText}</div>
        ) : null}
      </>
    )
  }

  function syncTreeBodyDom() {
    const bodyHost = bodyHostRef.current
    if (!bodyHost) return
    const equalIgnoringInlineStyle = (left: HTMLElement, right: HTMLElement) => {
      const cloneWithoutStyle = (node: HTMLElement) => {
        const clone = node.cloneNode(true) as HTMLElement
        clone.removeAttribute('style')
        clone
          .querySelectorAll<HTMLElement>('[style]')
          .forEach(item => item.removeAttribute('style'))
        return clone
      }
      return cloneWithoutStyle(left).isEqualNode(cloneWithoutStyle(right))
    }
    const previousRows = new Map(
      Array.from(bodyHost.querySelectorAll<HTMLElement>('[data-rue-tree-node]')).map(row => [
        row.getAttribute('data-rue-tree-node') ?? '',
        row,
      ]),
    )
    renderRue(renderTreeBodyContent(), bodyHost)
    bodyHost.querySelectorAll<HTMLElement>('[data-rue-tree-node]').forEach(row => {
      const key = row.getAttribute('data-rue-tree-node') ?? ''
      const previousRow = previousRows.get(key)
      if (previousRow && previousRow !== row && equalIgnoringInlineStyle(previousRow, row)) {
        row.replaceWith(previousRow)
      }
    })
  }

  onMounted(syncTreeBodyDom)

  watch(
    () => [treeData, selectedKeys, checkedKeys, expandedKeys, searchValue],
    () => {
      rebuildNormalizedTree()
      syncTreeBodyDom()
    },
  )

  const bodyViewportStyle = viewportHeight
    ? virtual !== false
      ? { height: `${viewportHeight}px`, overflowY: 'auto' }
      : { maxHeight: `${viewportHeight}px`, overflowY: 'auto' }
    : { overflowY: 'visible' }
  return (
    <section
      {...rest}
      className={appendClassName(
        appendClassName(
          appendClassName(
            'rue-tree rounded-box border border-base-300 bg-base-100',
            resolveStatusClassName(status),
          ),
          classNames?.root,
        ),
        className,
      )}
      style={{ ...styles?.root, ...style }}
      data-rue-tree="true"
      data-rue-tree-version={String(renderVersion.value)}
    >
      {allowSearch ? (
        <div className={classNames?.search} style={styles?.search}>
          <input
            type="text"
            value={readRenderSnapshot().searchValue}
            placeholder={searchPlaceholder}
            onInput={(event: Event) =>
              handleSearchInput((event.currentTarget as HTMLInputElement).value)
            }
          />
        </div>
      ) : null}
      <div
        ref={bodyHostRef}
        data-rue-tree-body="true"
        style={bodyViewportStyle}
        onScroll={handleBodyScroll}
      />
    </section>
  )
}

/** DirectoryTree 导出函数。 */
export const DirectoryTree: FC<DirectoryTreeProps> = ({
  className,
  showIcon = true,
  blockNode = true,
  expandAction = 'click',
  ...rest
}) => {
  return (
    <TreeRoot
      {...rest}
      className={appendClassName('rue-directory-tree', className)}
      showIcon={showIcon}
      blockNode={blockNode}
      directoryMode
      expandAction={expandAction}
    />
  )
}

type TreeCompoundComponent = FC<TreeProps> & {
  DirectoryTree: FC<DirectoryTreeProps>
}

const Tree = TreeRoot as TreeCompoundComponent
Tree.DirectoryTree = DirectoryTree

/** 默认导出树组件。 */
export default Tree
