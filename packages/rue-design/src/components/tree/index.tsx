/* RUE_VAPOR_TRANSFORMED */
/*
Tree 组件概述
- 目标：补齐 Rue Design 缺失的树形组件，覆盖展开、选择、勾选、异步加载，并继续向 antd Tree 的目录树、拖拽和虚拟滚动能力靠拢。
- 视觉：延续 Rue 当前卡片化和 badge / border 语义，不照搬 ant-design 的视觉实现。
- 实现：保持手写 TSX 结构，避免被 Vite 阶段重复 Vapor-transform。
*/
import type { FC } from '@rue-js/rue'
import { batch, onMounted, render as renderRue, useRef, useState, watch } from '@rue-js/rue'

export type TreeKey = string | number
export type TreeStatus = 'warning' | 'error'
export type TreeSize = 'small' | 'default' | 'middle' | 'large' | 'sm' | 'md' | 'lg'
export type TreeExpandAction = false | 'click' | 'doubleClick'
export type TreeDropPosition = -1 | 0 | 1
export type DirectoryTreeRangeSelectMode = false | 'append' | 'replace'

export interface TreeFieldNames {
  title?: string
  key?: string
  children?: string
  disabled?: string
  selectable?: string
  checkable?: string
  disableCheckbox?: string
  isLeaf?: string
  icon?: string
  className?: string
  id?: string
  pId?: string
}

export interface TreeDataNode {
  title?: any
  key?: TreeKey
  children?: TreeDataNode[]
  disabled?: boolean
  selectable?: boolean
  checkable?: boolean
  disableCheckbox?: boolean
  isLeaf?: boolean
  icon?: any
  className?: string
  [key: string]: any
}

export interface TreeSimpleModeConfig {
  id?: string
  pId?: string
  rootPId?: string | number | null
}

export interface TreeCheckedKeysObject {
  checked: TreeKey[]
  halfChecked: TreeKey[]
}

export interface TreeNode {
  key: TreeKey
  keyText: string
  title: any
  depth: number
  children: TreeNode[]
  raw: TreeDataNode
  disabled: boolean
  selectable: boolean
  checkable: boolean
  disableCheckbox: boolean
  isLeaf: boolean
  className?: string
  icon?: any
  parentKeyText?: string
}

export interface TreeEventInfo {
  node: TreeNode
  nativeEvent?: Event | MouseEvent
  selected?: boolean
  checked?: boolean
  expanded?: boolean
  checkedNodes?: TreeNode[]
  selectedNodes?: TreeNode[]
  halfCheckedKeys?: TreeKey[]
}

export interface TreeDragEventInfo {
  event: DragEvent | Event
  node: TreeNode
  expandedKeys?: TreeKey[]
}

export interface TreeDropInfo extends TreeDragEventInfo {
  dragNode: TreeNode
  dragNodesKeys: TreeKey[]
  dropPosition: TreeDropPosition
  dropToGap: boolean
}

export interface TreeAllowDropInfo {
  dragNode: TreeNode
  dropNode: TreeNode
  dropPosition: TreeDropPosition
  dropToGap: boolean
}

export interface TreeDraggableConfig {
  icon?: any | false
  nodeDraggable?: (node: TreeNode) => boolean
}

export type TreeDraggable = boolean | ((node: TreeNode) => boolean) | TreeDraggableConfig

export interface TreeClassNames {
  root?: string
  header?: string
  body?: string
  search?: string
  node?: string
  switcher?: string
  checkbox?: string
  dragHandle?: string
  label?: string
  empty?: string
}

export interface TreeStyles {
  root?: Record<string, any>
  header?: Record<string, any>
  body?: Record<string, any>
  search?: Record<string, any>
  node?: Record<string, any>
  switcher?: Record<string, any>
  checkbox?: Record<string, any>
  dragHandle?: Record<string, any>
  label?: Record<string, any>
  empty?: Record<string, any>
}

const TreeTitleContent: FC<{ render: () => any }> = ({ render }) => render()

export interface TreeTitleRenderProps {
  node: TreeNode
  expanded: boolean
  selected: boolean
  checked: boolean
  halfChecked: boolean
  loading: boolean
}

export interface TreeProps {
  className?: string
  style?: Record<string, any>
  treeData?: TreeDataNode[]
  fieldNames?: TreeFieldNames
  treeDataSimpleMode?: boolean | TreeSimpleModeConfig
  selectedKeys?: TreeKey[]
  defaultSelectedKeys?: TreeKey[]
  checkedKeys?: TreeKey[] | TreeCheckedKeysObject
  defaultCheckedKeys?: TreeKey[]
  expandedKeys?: TreeKey[]
  defaultExpandedKeys?: TreeKey[]
  defaultExpandAll?: boolean
  multiple?: boolean
  checkable?: boolean
  checkStrictly?: boolean
  showLine?: boolean
  showIcon?: boolean
  blockNode?: boolean
  selectable?: boolean
  disabled?: boolean
  size?: TreeSize
  status?: TreeStatus
  draggable?: TreeDraggable
  allowDrop?: (info: TreeAllowDropInfo) => boolean
  virtual?: boolean
  height?: number
  itemHeight?: number
  titleRender?: (props: TreeTitleRenderProps) => any
  switcherIcon?: any | ((props: TreeTitleRenderProps) => any)
  icon?: any | ((props: TreeTitleRenderProps) => any)
  filterTreeNode?: boolean | ((inputValue: string, node: TreeNode) => boolean)
  searchValue?: string
  defaultSearchValue?: string
  searchPlaceholder?: any
  allowSearch?: boolean
  loadData?: (node: TreeNode) => Promise<any> | void
  emptyText?: any
  onSelect?: (selectedKeys: TreeKey[], info: TreeEventInfo) => void
  onCheck?: (checkedKeys: TreeKey[] | TreeCheckedKeysObject, info: TreeEventInfo) => void
  onExpand?: (expandedKeys: TreeKey[], info: TreeEventInfo) => void
  onSearch?: (value: string) => void
  onDoubleClick?: (event: MouseEvent, node: TreeNode) => void
  onDragStart?: (info: TreeDragEventInfo) => void
  onDragEnter?: (info: TreeDragEventInfo) => void
  onDragOver?: (info: TreeDragEventInfo) => void
  onDragLeave?: (info: TreeDragEventInfo) => void
  onDragEnd?: (info: TreeDragEventInfo) => void
  onDrop?: (info: TreeDropInfo) => void
  onScroll?: (event: UIEvent) => void
  classNames?: TreeClassNames
  styles?: TreeStyles
  [key: string]: any
}

export interface DirectoryTreeProps extends TreeProps {
  expandAction?: TreeExpandAction
  toggleSelect?: boolean
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

const joinClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const isObjectRecord = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isTreeKey = (value: unknown): value is TreeKey => {
  return typeof value === 'string' || typeof value === 'number'
}

const serializeKey = (key: TreeKey) => `${typeof key}:${String(key)}`

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

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const resolveField = (
  node: TreeDataNode,
  field: keyof Required<TreeFieldNames>,
  fieldNames?: TreeFieldNames,
) => {
  const fieldName = fieldNames?.[field] ?? defaultFieldNames[field]
  return node[fieldName]
}

const resolveTitle = (node: TreeDataNode, fieldNames?: TreeFieldNames) => {
  return resolveField(node, 'title', fieldNames) ?? node.title ?? node.key
}

const toKeyTextSet = (keys?: ReadonlyArray<TreeKey>) => {
  return new Set(uniqKeys(keys).map(serializeKey))
}

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

const getSubtreeKeys = (node: TreeNode) => {
  const keys: TreeKey[] = []

  const visit = (currentNode: TreeNode) => {
    keys.push(currentNode.key)
    currentNode.children.forEach(child => visit(child))
  }

  visit(node)
  return keys
}

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

const toDropIntent = (dropPosition?: TreeDropPosition) => {
  if (dropPosition === -1) return 'before'
  if (dropPosition === 1) return 'after'
  if (dropPosition === 0) return 'inside'
  return undefined
}

const keyTextsToKeys = (keyTexts: string[], byKeyText: Record<string, TreeNode>) => {
  return keyTexts.map(keyText => byKeyText[keyText]?.key).filter(isTreeKey)
}

const sameKeyTextSet = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) return false
  for (const keyText of left) {
    if (!right.has(keyText)) return false
  }
  return true
}

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

const ChevronIcon: FC<{ expanded: boolean; hidden?: boolean }> = ({ expanded, hidden }) => {
  return (
    <span
      aria-hidden="true"
      className={joinClassName(
        'inline-flex size-4 items-center justify-center text-base-content/55 transition-transform duration-150',
        expanded && 'rotate-90',
        hidden && 'opacity-0',
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" className="size-4">
        <path
          d="M7.5 5.5L12.5 10L7.5 14.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

const LoadingIcon: FC = () => {
  return (
    <span className="loading loading-spinner loading-xs text-base-content/55" aria-hidden="true" />
  )
}

const DragHandleIcon: FC = () => {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <circle cx="6" cy="5" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
      <circle cx="6" cy="15" r="1.2" />
      <circle cx="13" cy="5" r="1.2" />
      <circle cx="13" cy="10" r="1.2" />
      <circle cx="13" cy="15" r="1.2" />
    </svg>
  )
}

const DirectoryFolderIcon: FC<{ expanded: boolean }> = ({ expanded }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      {expanded ? (
        <path
          d="M3 8.5a2 2 0 0 1 2-2h4l1.4 1.5H19a2 2 0 0 1 1.9 2.6l-1.4 5A2 2 0 0 1 17.6 17H6a2 2 0 0 1-1.93-1.48L3 8.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M3 7.5a2 2 0 0 1 2-2h4l1.4 1.5H19a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

const DirectoryFileIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path
        d="M8 3.5h6l4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

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
  const normalizedTreeRef = useRef<ReturnType<typeof normalizeTreeData>>()
  normalizedTreeRef.current = normalizedTree
  const componentSize = sizeConfig(size)
  const dragConfig = resolveDraggableConfig(draggable)
  const initialExpandedKeys = defaultExpandAll
    ? normalizedTree.flat
        .filter(node => node.children.length > 0 || !node.isLeaf)
        .map(node => node.key)
    : (defaultExpandedKeys ?? [])

  const [uncontrolledSelectedKeysRef, setUncontrolledSelectedKeys] = useState<TreeKey[]>(
    uniqKeys(defaultSelectedKeys ?? selectedKeys),
    { kind: 'ref' },
  )
  const [uncontrolledCheckedKeysRef, setUncontrolledCheckedKeys] = useState<TreeKey[]>(
    uniqKeys(defaultCheckedKeys),
    { kind: 'ref' },
  )
  const [uncontrolledExpandedKeysRef, setUncontrolledExpandedKeys] = useState<TreeKey[]>(
    uniqKeys(initialExpandedKeys),
    { kind: 'ref' },
  )
  const [controlledSelectedKeysRef, setControlledSelectedKeys] = useState<TreeKey[]>(
    uniqKeys(selectedKeys),
    { kind: 'ref' },
  )
  const [controlledExpandedKeysRef, setControlledExpandedKeys] = useState<TreeKey[]>(
    uniqKeys(expandedKeys),
    { kind: 'ref' },
  )
  const [controlledCheckedKeyTextsRef, setControlledCheckedKeyTexts] = useState<Set<string>>(
    checkedKeys === undefined
      ? new Set<string>()
      : Array.isArray(checkedKeys)
        ? toKeyTextSet(checkedKeys)
        : toKeyTextSet(checkedKeys.checked),
    { kind: 'ref' },
  )
  const [searchValueRef, setSearchValue] = useState(defaultSearchValue ?? '', { kind: 'ref' })
  const [loadingKeyTextsRef, setLoadingKeyTexts] = useState<string[]>([], { kind: 'ref' })
  const [scrollTopRef, setScrollTop] = useState(0, { kind: 'ref' })
  const directoryLastSelectedKeyTextRef = useRef<string | null>(null)
  const directoryCachedSelectedKeyTextsRef = useRef<string[]>([])
  const bodyHostRef = useRef<HTMLDivElement>()
  const [dragStateRef, setDragState] = useState<TreeDragState>({}, { kind: 'ref' })
  const [dragHoverDepthRef, setDragHoverDepth] = useState<Record<string, number>>(
    {},
    { kind: 'ref' },
  )
  if (checkedKeys !== undefined) {
    const nextControlledCheckedKeyTexts = Array.isArray(checkedKeys)
      ? toKeyTextSet(checkedKeys)
      : toKeyTextSet(checkedKeys.checked)

    if (!sameKeyTextSet(controlledCheckedKeyTextsRef.value, nextControlledCheckedKeyTexts))
      setControlledCheckedKeyTexts(nextControlledCheckedKeyTexts)
  }

  if (
    selectedKeys !== undefined &&
    !sameKeyTextSet(toKeyTextSet(controlledSelectedKeysRef.value), toKeyTextSet(selectedKeys))
  ) {
    setControlledSelectedKeys(uniqKeys(selectedKeys))
  }

  if (
    expandedKeys !== undefined &&
    !sameKeyTextSet(toKeyTextSet(controlledExpandedKeysRef.value), toKeyTextSet(expandedKeys))
  ) {
    setControlledExpandedKeys(uniqKeys(expandedKeys))
  }

  const estimatedRowHeight = itemHeight ?? componentSize.rowEstimate
  const viewportHeight = typeof height === 'number' && height > 0 ? height : undefined
  const fixedVirtualRowHeight =
    virtual !== false && viewportHeight && typeof itemHeight === 'number' && itemHeight > 0
      ? itemHeight
      : undefined

  const rebuildNormalizedTree = () => {
    const nextSourceTreeData = buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames)
    const nextNormalizedTree = normalizeTreeData(nextSourceTreeData, fieldNames)
    normalizedTreeRef.current = nextNormalizedTree
    return nextNormalizedTree
  }

  const getNormalizedTree = () => normalizedTreeRef.current ?? normalizedTree
  const getMergedSelectedKeys = () =>
    selectedKeys !== undefined ? controlledSelectedKeysRef.value : uncontrolledSelectedKeysRef.value
  const getMergedExpandedKeys = () =>
    expandedKeys !== undefined ? controlledExpandedKeysRef.value : uncontrolledExpandedKeysRef.value
  const getMergedSearchValue = () =>
    searchValue !== undefined ? searchValue : searchValueRef.value
  const getMergedCheckedKeyTexts = () => {
    if (checkedKeys === undefined) return toKeyTextSet(uncontrolledCheckedKeysRef.value)
    return controlledCheckedKeyTextsRef.value
  }
  const getRenderSnapshot = () => {
    const activeTree = getNormalizedTree()
    const mergedSelectedKeys = getMergedSelectedKeys()
    const mergedExpandedKeys = getMergedExpandedKeys()
    const mergedSearchValue = getMergedSearchValue()
    const mergedCheckedKeyTexts = getMergedCheckedKeyTexts()
    const selectedKeyTextSet = toKeyTextSet(mergedSelectedKeys)
    const expandedKeyTextSet = toKeyTextSet(mergedExpandedKeys)
    const checkState = deriveCheckState(activeTree.roots, mergedCheckedKeyTexts, !!checkStrictly)
    const visibleNodes = filterVisibleNodes(
      activeTree.roots,
      expandedKeyTextSet,
      mergedSearchValue,
      node => matchesTreeNode(node, mergedSearchValue, filterTreeNode),
    )
    const virtualSlice = buildVirtualSlice(
      visibleNodes,
      scrollTopRef.value,
      viewportHeight,
      estimatedRowHeight,
      virtual !== false && !!viewportHeight,
    )

    return {
      normalizedTree: activeTree,
      mergedSelectedKeys,
      mergedExpandedKeys,
      mergedSearchValue,
      selectedKeyTextSet,
      expandedKeyTextSet,
      checkState,
      visibleNodes,
      virtualSlice,
    }
  }

  const emitExpand = (
    nextExpandedKeys: TreeKey[],
    node: TreeNode,
    nativeEvent?: Event | MouseEvent,
  ) => {
    const normalizedKeys = uniqKeys(nextExpandedKeys)
    if (expandedKeys === undefined) setUncontrolledExpandedKeys(normalizedKeys)
    else setControlledExpandedKeys(normalizedKeys)
    syncTreeBodyDom()
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
    const activeTree = getNormalizedTree()
    const cleanedKeys = uniqKeys(nextSelectedKeys).filter(
      key => activeTree.byKeyText[serializeKey(key)],
    )
    const selectedNodes = cleanedKeys
      .map(key => activeTree.byKeyText[serializeKey(key)])
      .filter(Boolean)

    if (selectedKeys === undefined) setUncontrolledSelectedKeys(cleanedKeys)
    else setControlledSelectedKeys(cleanedKeys)
    syncTreeBodyDom()

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
    const activeTree = getNormalizedTree()
    const nextCheckState = deriveCheckState(activeTree.roots, nextCheckedKeyTexts, !!checkStrictly)
    const checkedPayload = toCheckedPayload(
      Array.from(nextCheckState.checkedKeys),
      Array.from(nextCheckState.halfCheckedKeys),
      activeTree.flat,
      !!checkStrictly,
    )

    if (checkedKeys === undefined) {
      setUncontrolledCheckedKeys(
        checkStrictly
          ? (checkedPayload as TreeCheckedKeysObject).checked
          : (checkedPayload as TreeKey[]),
      )
    } else {
      setControlledCheckedKeyTexts(new Set(nextCheckState.checkedKeys))
    }
    syncTreeBodyDom()

    if (onCheck) {
      onCheck(checkedPayload, {
        node,
        nativeEvent,
        checked: nextCheckState.checkedKeys.has(node.keyText),
        checkedNodes: Array.from(nextCheckState.checkedKeys)
          .map(keyText => activeTree.byKeyText[keyText])
          .filter(Boolean),
        halfCheckedKeys: Array.from(nextCheckState.halfCheckedKeys)
          .map(keyText => activeTree.byKeyText[keyText]?.key)
          .filter(isTreeKey),
      })
    }
  }

  const toggleExpanded = async (node: TreeNode, nativeEvent?: Event | MouseEvent) => {
    const snapshot = getRenderSnapshot()
    if (disabled || node.disabled) return snapshot.mergedExpandedKeys

    const currentlyExpanded = snapshot.expandedKeyTextSet.has(node.keyText)
    const nextExpandedKeys = currentlyExpanded
      ? snapshot.mergedExpandedKeys.filter(key => serializeKey(key) !== node.keyText)
      : [...snapshot.mergedExpandedKeys, node.key]

    if (!currentlyExpanded && loadData && !node.isLeaf && node.children.length === 0) {
      if (!loadingKeyTextsRef.value.includes(node.keyText)) {
        setLoadingKeyTexts([...loadingKeyTextsRef.value, node.keyText])
        syncTreeBodyDom()
        try {
          await loadData(node)
          rebuildNormalizedTree()
        } finally {
          setLoadingKeyTexts(loadingKeyTextsRef.value.filter(keyText => keyText !== node.keyText))
          rebuildNormalizedTree()
          syncTreeBodyDom()
        }
      }
    }

    return emitExpand(nextExpandedKeys, node, nativeEvent)
  }

  const handleExpandToggle = (node: TreeNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void toggleExpanded(node, event)
  }

  const selectTreeNode = (node: TreeNode, nativeEvent?: MouseEvent) => {
    if (disabled || node.disabled || !selectable || !node.selectable) return
    const snapshot = getRenderSnapshot()

    if (directoryMode) {
      const controlPick =
        !!multiple && !!toggleSelect && !!(nativeEvent?.ctrlKey || nativeEvent?.metaKey)
      const shiftPick =
        !!multiple &&
        rangeSelect !== false &&
        !!nativeEvent?.shiftKey &&
        !!directoryLastSelectedKeyTextRef.current

      if (multiple && shiftPick) {
        const orderedVisibleKeyTexts = snapshot.visibleNodes.map(item => item.node.keyText)
        const anchorKeyText = directoryLastSelectedKeyTextRef.current ?? node.keyText
        const startIndex = orderedVisibleKeyTexts.indexOf(anchorKeyText)
        const endIndex = orderedVisibleKeyTexts.indexOf(node.keyText)
        const rangeStart = Math.min(startIndex, endIndex)
        const rangeEnd = Math.max(startIndex, endIndex)
        const rangeKeyTexts = orderedVisibleKeyTexts.slice(rangeStart, rangeEnd + 1)
        const cachedDirectoryKeyTexts = directoryCachedSelectedKeyTextsRef.current ?? []
        const cachedKeyTexts =
          rangeSelect === 'append'
            ? cachedDirectoryKeyTexts.length
              ? cachedDirectoryKeyTexts
              : snapshot.mergedSelectedKeys.map(serializeKey)
            : []
        const nextSelectedKeyTexts = Array.from(new Set([...cachedKeyTexts, ...rangeKeyTexts]))
        commitSelectedKeys(
          keyTextsToKeys(nextSelectedKeyTexts, snapshot.normalizedTree.byKeyText),
          node,
          nativeEvent,
        )
        return
      }

      if (multiple && controlPick) {
        const nextSelectedKeys = snapshot.selectedKeyTextSet.has(node.keyText)
          ? snapshot.mergedSelectedKeys.filter(key => serializeKey(key) !== node.keyText)
          : [...snapshot.mergedSelectedKeys, node.key]
        directoryLastSelectedKeyTextRef.current = node.keyText
        directoryCachedSelectedKeyTextsRef.current = nextSelectedKeys.map(serializeKey)
        commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
        return
      }

      directoryLastSelectedKeyTextRef.current = node.keyText
      directoryCachedSelectedKeyTextsRef.current = [node.keyText]
      commitSelectedKeys([node.key], node, nativeEvent)
      return
    }

    if (multiple) {
      const nextSelectedKeys = snapshot.selectedKeyTextSet.has(node.keyText)
        ? snapshot.mergedSelectedKeys.filter(key => serializeKey(key) !== node.keyText)
        : [...snapshot.mergedSelectedKeys, node.key]
      commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
      return
    }

    const nextSelectedKeys = snapshot.selectedKeyTextSet.has(node.keyText) ? [] : [node.key]
    commitSelectedKeys(nextSelectedKeys, node, nativeEvent)
  }

  const handleCheck = (node: TreeNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (disabled || node.disabled || !node.checkable || node.disableCheckbox) return

    const snapshot = getRenderSnapshot()
    const nextCheckedKeys = new Set(getMergedCheckedKeyTexts())
    const isChecked = snapshot.checkState.checkedKeys.has(node.keyText)

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
    if (searchValue === undefined) setSearchValue(value)
    syncTreeBodyDom()
    if (onSearch) onSearch(value)
  }

  const handleBodyScroll = (event: UIEvent) => {
    setScrollTop((event.currentTarget as HTMLElement).scrollTop)
    syncTreeBodyDom()
    if (onScroll) onScroll(event)
  }

  const clearDragHoverState = (keyText?: string) => {
    if (!keyText || dragStateRef.value.overKeyText !== keyText) return
    setDragState({
      dragKeyText: dragStateRef.value.dragKeyText,
    })
    syncTreeBodyDom()
  }

  const setDragHoverState = (keyText: string, dropPosition: TreeDropPosition) => {
    if (
      dragStateRef.value.overKeyText === keyText &&
      dragStateRef.value.dropPosition === dropPosition
    ) {
      return
    }

    setDragState({
      ...dragStateRef.value,
      overKeyText: keyText,
      dropPosition,
    })
    syncTreeBodyDom()
  }

  const updateDragHoverDepth = (keyText: string, delta: 1 | -1) => {
    const nextDepths = { ...dragHoverDepthRef.value }
    const currentDepth = nextDepths[keyText] ?? 0
    const nextDepth = Math.max(currentDepth + delta, 0)

    if (nextDepth > 0) nextDepths[keyText] = nextDepth
    else delete nextDepths[keyText]

    setDragHoverDepth(nextDepths)
    syncTreeBodyDom()
    return nextDepth
  }

  const resetDragState = () => {
    setDragHoverDepth({})
    setDragState({})
    syncTreeBodyDom()
  }

  const resolveDropContext = (
    dropNode: TreeNode,
    event: DragEvent | Event,
    currentTarget?: HTMLElement | null,
  ) => {
    const dragKeyText = dragStateRef.value.dragKeyText
    if (!dragKeyText) return null
    const activeTree = getNormalizedTree()
    const dragNode = activeTree.byKeyText[dragKeyText]
    if (!dragNode || dragNode.keyText === dropNode.keyText) return null
    if (isAncestorNode(dragNode, dropNode, activeTree.byKeyText)) return null

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
    if (!dragConfig.enabled || !dragConfig.nodeDraggable(node) || disabled || node.disabled) return

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', node.keyText)
    }

    setDragHoverDepth({})
    setDragState({ dragKeyText: node.keyText })
    syncTreeBodyDom()

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

    const snapshot = getRenderSnapshot()
    let nextExpandedKeys = snapshot.mergedExpandedKeys
    if (
      dropContext.dropPosition === 0 &&
      !snapshot.expandedKeyTextSet.has(node.keyText) &&
      (node.children.length > 0 || !node.isLeaf)
    ) {
      nextExpandedKeys = emitExpand([...snapshot.mergedExpandedKeys, node.key], node, event)
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
    const {
      mergedSearchValue,
      selectedKeyTextSet,
      expandedKeyTextSet,
      checkState,
      visibleNodes,
      virtualSlice,
    } = getRenderSnapshot()

    return (
      <>
        {virtualSlice.topSpacer > 0 ? (
          <div style={{ height: `${virtualSlice.topSpacer}px` }} aria-hidden="true" />
        ) : null}
        <div
          className={visibleNodes.length ? 'space-y-1' : 'hidden'}
          aria-hidden={visibleNodes.length ? undefined : 'true'}
        >
          {virtualSlice.items.map(({ node, matched }) => {
            const state = checkState.stateMap[node.keyText] ?? {
              checked: false,
              halfChecked: false,
              participates: true,
            }
            const expanded = mergedSearchValue ? true : expandedKeyTextSet.has(node.keyText)
            const selected = selectedKeyTextSet.has(node.keyText)
            const loading = loadingKeyTextsRef.value.includes(node.keyText)
            const canExpand = !!loadData || node.children.length > 0 || !node.isLeaf
            const rowIsDragTarget = dragStateRef.value.overKeyText === node.keyText
            const canDragNode =
              dragConfig.enabled && dragConfig.nodeDraggable(node) && !disabled && !node.disabled
            const dropIntent = rowIsDragTarget
              ? toDropIntent(dragStateRef.value.dropPosition)
              : undefined
            const dragIndicatorClassName = rowIsDragTarget
              ? dragStateRef.value.dropPosition === 0
                ? 'ring-2 ring-primary/35 ring-inset'
                : ''
              : ''
            const renderProps: TreeTitleRenderProps = {
              node,
              expanded,
              selected,
              checked: state.checked,
              halfChecked: state.halfChecked,
              loading,
            }

            return (
              <div key={node.keyText} className="relative flex flex-col">
                {dropIntent === 'before' ? renderGapPlaceholder(node, 'before') : null}
                <div
                  className={appendClassName(
                    appendClassName(
                      joinClassName(
                        `group flex items-center gap-2 rounded-2xl px-2.5 ${componentSize.rowPadding} transition duration-200 ease-out`,
                        matched && 'bg-primary/8',
                        selected &&
                          'bg-primary/18 ring-1 ring-primary/30 shadow-[0_18px_32px_-24px_rgba(37,99,235,0.85)]',
                        showLine && node.depth > 0 && 'border-l border-base-300/60',
                        blockNode ? 'w-full' : '',
                        dragIndicatorClassName,
                        node.className,
                      ),
                      classNames?.node,
                    ),
                    disabled || node.disabled ? 'opacity-55' : '',
                  )}
                  style={{
                    paddingLeft: `${node.depth * 18 + 8}px`,
                    minHeight: fixedVirtualRowHeight
                      ? undefined
                      : `${componentSize.rowMinHeight}px`,
                    height: fixedVirtualRowHeight ? `${fixedVirtualRowHeight}px` : undefined,
                    boxSizing: fixedVirtualRowHeight ? 'border-box' : undefined,
                    ...styles?.node,
                  }}
                  data-rue-tree-node={node.keyText}
                  data-rue-tree-drop-position={
                    rowIsDragTarget ? String(dragStateRef.value.dropPosition ?? 0) : ''
                  }
                  data-rue-tree-drop-intent={dropIntent ?? ''}
                  draggable={canDragNode}
                  onDragStart={(event: DragEvent) => handleDragStartNode(node, event)}
                  onDragEnter={(event: DragEvent) => handleDragEnterNode(node, event)}
                  onDragOver={(event: DragEvent) => handleDragOverNode(node, event)}
                  onDragLeave={(event: DragEvent) => handleDragLeaveNode(node, event)}
                  onDragEnd={(event: DragEvent) => handleDragEndNode(node, event)}
                  onDrop={(event: DragEvent) => handleDropNode(node, event)}
                >
                  <button
                    type="button"
                    className={appendClassName(
                      'inline-flex size-7 shrink-0 items-center justify-center rounded-xl hover:bg-base-200 disabled:cursor-not-allowed',
                      classNames?.switcher,
                    )}
                    style={styles?.switcher}
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
                      key={`checkbox-${node.keyText}-${state.checked ? 'checked' : state.halfChecked ? 'mixed' : 'unchecked'}`}
                      type="button"
                      role="checkbox"
                      aria-checked={state.halfChecked ? 'mixed' : state.checked ? 'true' : 'false'}
                      className={appendClassName(
                        appendClassName(
                          joinClassName(
                            'inline-flex size-[1.1rem] shrink-0 items-center justify-center rounded-[0.4rem] border text-[0.75rem] font-semibold shadow-sm transition-all duration-150',
                            state.checked || state.halfChecked
                              ? 'border-primary/95 bg-primary text-primary-content shadow-[0_0_0_1px_rgba(37,99,235,0.22)]'
                              : 'border-base-content/30 bg-base-100 text-base-content/0 shadow-[0_0_0_1px_rgba(15,23,42,0.06)]',
                            (disabled ||
                              node.disabled ||
                              node.disableCheckbox ||
                              !node.checkable) &&
                              'opacity-45',
                          ),
                          classNames?.checkbox,
                        ),
                        disabled || node.disabled || node.disableCheckbox || !node.checkable
                          ? 'cursor-not-allowed'
                          : '',
                      )}
                      style={styles?.checkbox}
                      disabled={
                        disabled || node.disabled || node.disableCheckbox || !node.checkable
                      }
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
                      appendClassName(
                        joinClassName(
                          `flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left ${componentSize.textClass} transition-colors duration-150`,
                          directoryMode
                            ? selected
                              ? 'bg-base-200/85 text-base-content'
                              : 'text-base-content hover:bg-base-200/70'
                            : selected
                              ? 'bg-primary/10 font-semibold text-primary'
                              : 'text-base-content hover:bg-base-200/70',
                          disabled || node.disabled || !selectable || !node.selectable
                            ? 'cursor-not-allowed opacity-55'
                            : '',
                        ),
                        classNames?.label,
                      ),
                      blockNode ? 'w-full' : '',
                    )}
                    style={styles?.label}
                    disabled={disabled || node.disabled || !selectable || !node.selectable}
                    onClick={(event: MouseEvent) => handleLabelActivate(node, event, 'click')}
                    onDblClick={(event: MouseEvent) =>
                      handleLabelActivate(node, event, 'doubleClick')
                    }
                  >
                    {titleRender ? (
                      <div className="min-w-0 flex-1">
                        <TreeTitleContent render={() => titleRender(renderProps)} />
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{node.title}</span>
                    )}
                    {dropIntent ? (
                      <span
                        className="badge badge-primary badge-xs"
                        data-rue-tree-drop-placeholder={dropIntent}
                      >
                        {dropIntent === 'inside'
                          ? '放入'
                          : dropIntent === 'before'
                            ? '插前'
                            : '插后'}
                      </span>
                    ) : selected ? (
                      <span className="badge badge-primary badge-outline badge-xs">选中</span>
                    ) : null}
                  </button>
                </div>
                {dropIntent === 'after' ? renderGapPlaceholder(node, 'after') : null}
              </div>
            )
          })}
        </div>
        {virtualSlice.bottomSpacer > 0 ? (
          <div style={{ height: `${virtualSlice.bottomSpacer}px` }} aria-hidden="true" />
        ) : null}
        {!visibleNodes.length ? (
          <div
            className={appendClassName(
              'grid min-h-40 place-items-center rounded-2xl border border-dashed border-base-300/70 bg-base-100/50 px-6 py-8 text-center text-sm text-base-content/55',
              classNames?.empty,
            )}
            style={styles?.empty}
          >
            <div>{emptyText}</div>
          </div>
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
            joinClassName(
              'rue-tree overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-gradient-to-b from-base-100 via-base-100 to-base-200/35 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]',
              directoryMode && 'rue-directory-tree',
            ),
            resolveStatusClassName(status),
          ),
          classNames?.root,
        ),
        className,
      )}
      style={{ ...styles?.root, ...style }}
      data-rue-tree="true"
    >
      {allowSearch ? (
        <div
          className={appendClassName(
            appendClassName(
              `border-b border-base-300/70 ${componentSize.headerPadding}`,
              classNames?.header,
            ),
            classNames?.search,
          )}
          style={{ ...styles?.header, ...styles?.search }}
        >
          <label className="input input-bordered flex w-full items-center gap-2 rounded-2xl border-base-300/80 bg-base-100/85 px-3 shadow-sm focus-within:border-primary/45 focus-within:outline-none">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-4 text-base-content/50"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={getMergedSearchValue()}
              placeholder={searchPlaceholder}
              className="grow border-none bg-transparent px-0 py-2 text-sm outline-none"
              onInput={(event: Event) =>
                handleSearchInput((event.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
        </div>
      ) : null}

      <div
        className={appendClassName(`flex flex-col ${componentSize.bodyPadding}`, classNames?.body)}
        style={styles?.body}
      >
        <div
          ref={bodyHostRef}
          className={viewportHeight ? 'overflow-auto' : 'overflow-visible'}
          style={bodyViewportStyle}
          onScroll={(event: UIEvent) => handleBodyScroll(event)}
          data-rue-tree-body="true"
        />
      </div>
    </section>
  )
}

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

export default Tree
