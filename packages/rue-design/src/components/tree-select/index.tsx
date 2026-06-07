/* RUE_VAPOR_TRANSFORMED */
/*
TreeSelect 组件概述
- 目标：提供接近 antd TreeSelect 的核心能力，包括树数据源、单选/多选/勾选、搜索、异步加载、展开控制与标签回填。
- 视觉：保持 Rue 现有 daisyUI 语义类体系，用 input / badge / border / base 色阶拼出更贴近设计站的质感，而不是照搬 antd。
- 策略：受控/非受控、简单数据模式、showCheckedStrategy 与语义化样式扩展都收敛在一个文件内，便于后续继续增强而不拆碎行为路径。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

/** SHOW_ALL 常量。 */
export const SHOW_ALL = 'SHOW_ALL' as const
/** SHOW_PARENT 常量。 */
export const SHOW_PARENT = 'SHOW_PARENT' as const
/** SHOW_CHILD 常量。 */
export const SHOW_CHILD = 'SHOW_CHILD' as const

/** TreeSelectValue 值类型。 */
export type TreeSelectValue = string | number
/** TreeSelectShowCheckedStrategy 类型。 */
export type TreeSelectShowCheckedStrategy = typeof SHOW_ALL | typeof SHOW_PARENT | typeof SHOW_CHILD

/** TreeSelectFieldNames 接口。 */
export interface TreeSelectFieldNames {
  /** 展示标签。 */
  label?: string
  /** 受控值。 */
  value?: string
  /** 组件子内容。 */
  children?: string
  /** 数据项唯一标识。 */
  key?: string
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
  /** 根节点附加类名。 */
  className?: string
  /** 图标内容。 */
  icon?: string
  /** 元素或数据项标识。 */
  id?: string
  /** pId 配置项。 */
  pId?: string
}

/** TreeSelectDataNode 接口。 */
export interface TreeSelectDataNode {
  /** 标题内容。 */
  title?: any
  /** 展示标签。 */
  label?: any
  /** 受控值。 */
  value?: TreeSelectValue
  /** 数据项唯一标识。 */
  key?: TreeSelectValue
  /** 组件子内容。 */
  children?: TreeSelectDataNode[]
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
  /** 根节点附加类名。 */
  className?: string
  /** 图标内容。 */
  icon?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** TreeSelectSimpleModeConfig 配置对象。 */
export interface TreeSelectSimpleModeConfig {
  /** 元素或数据项标识。 */
  id?: string
  /** pId 配置项。 */
  pId?: string
  /** rootPId 配置项。 */
  rootPId?: string | number | null
}

/** TreeSelectLabeledValue 接口。 */
export interface TreeSelectLabeledValue {
  /** 受控值。 */
  value: TreeSelectValue
  /** 数据项唯一标识。 */
  key: TreeSelectValue
  /** 展示标签。 */
  label: any
  /** halfChecked 配置项。 */
  halfChecked?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
}

/** TreeSelectShowSearchConfig 配置对象。 */
export interface TreeSelectShowSearchConfig {
  /** autoClearSearchValue 值。 */
  autoClearSearchValue?: boolean
  /** filterTreeNode 配置项。 */
  filterTreeNode?: boolean | ((inputValue: string, node: TreeSelectNormalizedNode) => boolean)
  /** searchValue 值。 */
  searchValue?: string
  /** treeNodeFilterProp 配置项。 */
  treeNodeFilterProp?: string
  /** 搜索文本变化时触发的回调。 */
  onSearch?: (value: string) => void
}

/** TreeSelectChangeExtra 接口。 */
export interface TreeSelectChangeExtra {
  /** triggerValue 值。 */
  triggerValue?: TreeSelectValue | null
  /** selected 配置项。 */
  selected?: boolean
  /** 受控选中状态。 */
  checked?: boolean
  /** clear 配置项。 */
  clear?: boolean
  /** triggerNode 配置项。 */
  triggerNode?: TreeSelectNormalizedNode | null
  /** checkedNodes 配置项。 */
  checkedNodes?: TreeSelectNormalizedNode[]
  /** displayNodes 配置项。 */
  displayNodes?: TreeSelectNormalizedNode[]
  /** halfCheckedKeys 标识键集合。 */
  halfCheckedKeys?: TreeSelectValue[]
}

/** TreeSelectTagRenderProps 组件属性。 */
export interface TreeSelectTagRenderProps {
  /** 展示标签。 */
  label: any
  /** 受控值。 */
  value: TreeSelectValue
  /** 是否禁用交互。 */
  disabled?: boolean
  /** closable 配置项。 */
  closable: boolean
  /** node 配置项。 */
  node: TreeSelectNormalizedNode
  /** 关闭时触发的回调。 */
  onClose: (event: MouseEvent) => void
}

/** TreeSelectSwitcherRenderContext 事件或渲染上下文。 */
export interface TreeSelectSwitcherRenderContext {
  /** expanded 配置项。 */
  expanded: boolean
  /** 是否展示加载态。 */
  loading: boolean
  /** selected 配置项。 */
  selected: boolean
  /** 受控选中状态。 */
  checked: boolean
  /** halfChecked 配置项。 */
  halfChecked: boolean
  /** node 配置项。 */
  node: TreeSelectNormalizedNode
}

/** TreeSelectProps 组件属性。 */
export interface TreeSelectProps {
  /** 受控值。 */
  value?:
    | TreeSelectValue
    | TreeSelectValue[]
    | TreeSelectLabeledValue
    | TreeSelectLabeledValue[]
    | null
  /** 非受控初始值。 */
  defaultValue?:
    | TreeSelectValue
    | TreeSelectValue[]
    | TreeSelectLabeledValue
    | TreeSelectLabeledValue[]
    | null
  /** treeData 配置项。 */
  treeData?: TreeSelectDataNode[]
  /** 自定义数据字段映射。 */
  fieldNames?: TreeSelectFieldNames
  /** treeDataSimpleMode 配置项。 */
  treeDataSimpleMode?: boolean | TreeSelectSimpleModeConfig
  /** multiple 配置项。 */
  multiple?: boolean
  /** treeCheckable 配置项。 */
  treeCheckable?: boolean
  /** treeCheckStrictly 配置项。 */
  treeCheckStrictly?: boolean
  /** showCheckedStrategy 配置项。 */
  showCheckedStrategy?: TreeSelectShowCheckedStrategy
  /** labelInValue 值。 */
  labelInValue?: boolean
  /** showSearch 配置项。 */
  showSearch?: boolean | TreeSelectShowSearchConfig
  /** searchValue 值。 */
  searchValue?: string
  /** filterTreeNode 配置项。 */
  filterTreeNode?: boolean | ((inputValue: string, node: TreeSelectNormalizedNode) => boolean)
  /** treeNodeFilterProp 配置项。 */
  treeNodeFilterProp?: string
  /** 占位内容。 */
  placeholder?: any
  /** 是否允许一键清空。 */
  allowClear?: boolean | { clearIcon?: any }
  /** clearLabel 标签内容。 */
  clearLabel?: string
  /** notFoundContent 配置项。 */
  notFoundContent?: any
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 是否展示加载态。 */
  loading?: boolean
  /** 受控打开状态。 */
  open?: boolean
  /** 非受控初始打开状态。 */
  defaultOpen?: boolean
  /** 打开状态变化时触发的回调。 */
  onOpenChange?: (open: boolean) => void
  /** treeDefaultExpandAll 配置项。 */
  treeDefaultExpandAll?: boolean
  /** treeDefaultExpandedKeys 标识键集合。 */
  treeDefaultExpandedKeys?: TreeSelectValue[]
  /** treeExpandedKeys 标识键集合。 */
  treeExpandedKeys?: TreeSelectValue[]
  /** treeLoadedKeys 标识键集合。 */
  treeLoadedKeys?: TreeSelectValue[]
  /** onTreeExpand 事件回调。 */
  onTreeExpand?: (keys: TreeSelectValue[]) => void
  /** loadData 配置项。 */
  loadData?: (node: TreeSelectNormalizedNode) => Promise<any> | void
  /** maxCount 配置项。 */
  maxCount?: number
  /** maxTagCount 配置项。 */
  maxTagCount?: number | 'responsive'
  /** maxTagPlaceholder 配置项。 */
  maxTagPlaceholder?: any | ((omittedValues: TreeSelectNormalizedNode[]) => any)
  /** maxTagTextLength 配置项。 */
  maxTagTextLength?: number
  /** listHeight 配置项。 */
  listHeight?: number
  /** 弹出层或内容展示位置。 */
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'
  /** popupMatchSelectWidth 配置项。 */
  popupMatchSelectWidth?: boolean | number
  /** 组件尺寸。 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'
  /** 组件状态。 */
  status?: 'error' | 'warning'
  /** 组件视觉变体。 */
  variant?: 'outlined' | 'filled' | 'borderless' | 'underlined'
  /** 前缀内容。 */
  prefix?: any
  /** 后缀内容。 */
  suffix?: any
  /** suffixIcon 图标内容。 */
  suffixIcon?: any
  /** showArrow 配置项。 */
  showArrow?: boolean
  /** switcherIcon 图标内容。 */
  switcherIcon?: any | ((context: TreeSelectSwitcherRenderContext) => any)
  /** treeTitleRender 自定义渲染函数。 */
  treeTitleRender?: (node: TreeSelectNormalizedNode) => any
  /** treeNodeLabelProp 配置项。 */
  treeNodeLabelProp?: string
  /** treeLine 配置项。 */
  treeLine?: boolean | { showLeafIcon?: boolean }
  /** tagRender 自定义渲染函数。 */
  tagRender?: (props: TreeSelectTagRenderProps) => any
  /** 搜索文本变化时触发的回调。 */
  onSearch?: (value: string) => void
  /** 值或状态变化时触发的回调。 */
  onChange?: (
    value:
      | TreeSelectValue
      | TreeSelectValue[]
      | TreeSelectLabeledValue
      | TreeSelectLabeledValue[]
      | null,
    label: any,
    extra: TreeSelectChangeExtra,
  ) => void
  /** 选中项时触发的回调。 */
  onSelect?: (
    value: TreeSelectValue | TreeSelectLabeledValue,
    node: TreeSelectNormalizedNode,
    extra: TreeSelectChangeExtra,
  ) => void
  /** 取消选中项时触发的回调。 */
  onDeselect?: (
    value: TreeSelectValue | TreeSelectLabeledValue,
    node: TreeSelectNormalizedNode,
    extra: TreeSelectChangeExtra,
  ) => void
  /** 清空时触发的回调。 */
  onClear?: (event: MouseEvent) => void
  /** onPopupScroll 事件回调。 */
  onPopupScroll?: (event: UIEvent) => void
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** selectorClassName 附加类名。 */
  selectorClassName?: string
  /** selectorStyle 内联样式。 */
  selectorStyle?: any
  /** popupClassName 附加类名。 */
  popupClassName?: string
  /** popupStyle 内联样式。 */
  popupStyle?: any
  /** dropdownClassName 附加类名。 */
  dropdownClassName?: string
  /** dropdownStyle 内联样式。 */
  dropdownStyle?: any
  /** 按局部区域覆盖的类名集合。 */
  classNames?: Record<string, any>
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: Record<string, any>
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** TreeSelectNormalizedNode 接口。 */
export interface TreeSelectNormalizedNode {
  /** 数据项唯一标识。 */
  key: string
  /** 受控值。 */
  value: TreeSelectValue
  /** valueKey 标识键。 */
  valueKey: string
  /** 展示标签。 */
  label: any
  /** labelText 文本内容。 */
  labelText: string
  /** depth 配置项。 */
  depth: number
  /** parentValueKey 标识键。 */
  parentValueKey?: string
  /** 组件子内容。 */
  children: TreeSelectNormalizedNode[]
  /** raw 配置项。 */
  raw: TreeSelectDataNode
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
}

interface NormalizedTreeResult {
  roots: TreeSelectNormalizedNode[]
  flat: TreeSelectNormalizedNode[]
  byValueKey: Record<string, TreeSelectNormalizedNode>
}

interface TreeCheckState {
  checked: boolean
  halfChecked: boolean
  participates: boolean
}

interface DerivedCheckState {
  checkedKeys: Set<string>
  halfCheckedKeys: Set<string>
  stateMap: Record<string, TreeCheckState>
}

interface VisibleTreeNode {
  node: TreeSelectNormalizedNode
  matched: boolean
}

interface TreeSelectSelectionPreview {
  currentValueKeySet: Set<string>
  derivedCheckState: DerivedCheckState
  displayNodes: TreeSelectNormalizedNode[]
  displayNodeKeySet: Set<string>
}

const sizeClassMap = {
  xs: 'input-xs',
  sm: 'input-sm',
  md: '',
  lg: 'input-lg',
  xl: 'input-xl',
  small: 'input-sm',
  medium: '',
  middle: '',
  large: 'input-lg',
} as const

const defaultFieldNames: Required<TreeSelectFieldNames> = {
  label: 'title',
  value: 'value',
  children: 'children',
  key: 'key',
  disabled: 'disabled',
  selectable: 'selectable',
  checkable: 'checkable',
  disableCheckbox: 'disableCheckbox',
  isLeaf: 'isLeaf',
  className: 'className',
  icon: 'icon',
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

/** 判断 Tree Select Value 的内部工具函数。 */
const isTreeSelectValue = (value: unknown): value is TreeSelectValue => {
  return typeof value === 'string' || typeof value === 'number'
}

/** 转换为 Array 的内部工具函数。 */
const toArray = <T,>(value: T | T[] | null | undefined) => {
  if (value === undefined || value === null) return [] as T[]
  return Array.isArray(value) ? value : [value]
}

/** serialize Value 的内部工具函数。 */
const serializeValue = (value: TreeSelectValue) => {
  return `${typeof value}:${String(value)}`
}

/** 解析 Input Value 的内部工具函数。 */
const resolveInputValue = (candidate: unknown): TreeSelectValue | undefined => {
  if (isTreeSelectValue(candidate)) return candidate
  if (isObjectRecord(candidate) && isTreeSelectValue(candidate.value)) {
    return candidate.value
  }
  return undefined
}

/** 归一化 Input Values 的内部工具函数。 */
const normalizeInputValues = (value: unknown) => {
  return toArray(value).flatMap(item => {
    const resolved = resolveInputValue(item)
    return resolved === undefined ? [] : [resolved]
  })
}

/** read Tree Field 的内部工具函数。 */
const readTreeField = (
  node: TreeSelectDataNode,
  field: keyof Required<TreeSelectFieldNames>,
  fieldNames?: TreeSelectFieldNames,
) => {
  const fieldName = fieldNames?.[field] ?? defaultFieldNames[field]
  return node[fieldName]
}

/** 解析 Raw Node Label 的内部工具函数。 */
const resolveRawNodeLabel = (node: TreeSelectDataNode, fieldNames?: TreeSelectFieldNames) => {
  return (
    readTreeField(node, 'label', fieldNames) ??
    node.title ??
    node.label ??
    readTreeField(node, 'value', fieldNames) ??
    readTreeField(node, 'key', fieldNames)
  )
}

/** 转换为 Label Text 的内部工具函数。 */
const toLabelText = (label: any) => {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label)
  }
  return ''
}

/** 构建 Simple Mode Tree Data 的内部工具函数。 */
const buildSimpleModeTreeData = (
  treeData: TreeSelectDataNode[],
  treeDataSimpleMode?: boolean | TreeSelectSimpleModeConfig,
  fieldNames?: TreeSelectFieldNames,
) => {
  if (!treeDataSimpleMode) {
    return treeData
  }

  const modeConfig = isObjectRecord(treeDataSimpleMode) ? treeDataSimpleMode : undefined
  const idField = modeConfig?.id ?? fieldNames?.id ?? defaultFieldNames.id
  const pIdField = modeConfig?.pId ?? fieldNames?.pId ?? defaultFieldNames.pId
  const rootPId = modeConfig?.rootPId ?? 0
  const childrenField = fieldNames?.children ?? defaultFieldNames.children

  const clonedById = new Map<any, TreeSelectDataNode>()
  treeData.forEach((item, index) => {
    const nodeId = item[idField] ?? item.value ?? item.key ?? index
    clonedById.set(nodeId, {
      ...item,
      [childrenField]: [],
    })
  })

  const roots: TreeSelectDataNode[] = []

  treeData.forEach((item, index) => {
    const nodeId = item[idField] ?? item.value ?? item.key ?? index
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

    const currentChildren = (parentNode[childrenField] as TreeSelectDataNode[]) ?? []
    currentChildren.push(currentNode)
    parentNode[childrenField] = currentChildren
  })

  return roots
}

/** 归一化 Tree Data 的内部工具函数。 */
const normalizeTreeData = (
  treeData: TreeSelectDataNode[],
  fieldNames?: TreeSelectFieldNames,
): NormalizedTreeResult => {
  const flat: TreeSelectNormalizedNode[] = []
  const byValueKey: Record<string, TreeSelectNormalizedNode> = {}

  const visit = (
    rawNode: TreeSelectDataNode,
    depth: number,
    path: string,
    parentValueKey?: string,
  ): TreeSelectNormalizedNode => {
    const rawChildren = readTreeField(rawNode, 'children', fieldNames)
    const rawValue = readTreeField(rawNode, 'value', fieldNames)
    const rawKey = readTreeField(rawNode, 'key', fieldNames)
    const rawIsLeaf = readTreeField(rawNode, 'isLeaf', fieldNames)
    const resolvedValue = isTreeSelectValue(rawValue)
      ? rawValue
      : isTreeSelectValue(rawKey)
        ? rawKey
        : path
    const label = resolveRawNodeLabel(rawNode, fieldNames)
    const valueKey = serializeValue(resolvedValue)
    const children = Array.isArray(rawChildren)
      ? rawChildren.map((child, index) => visit(child, depth + 1, `${path}-${index}`, valueKey))
      : []

    const node: TreeSelectNormalizedNode = {
      key: String(rawKey ?? resolvedValue),
      value: resolvedValue,
      valueKey,
      label,
      labelText: toLabelText(label),
      depth,
      parentValueKey,
      children,
      raw: rawNode,
      disabled: !!readTreeField(rawNode, 'disabled', fieldNames),
      selectable: readTreeField(rawNode, 'selectable', fieldNames) !== false,
      checkable: readTreeField(rawNode, 'checkable', fieldNames) !== false,
      disableCheckbox: !!readTreeField(rawNode, 'disableCheckbox', fieldNames),
      isLeaf: rawIsLeaf === true ? true : rawIsLeaf === false ? false : children.length === 0,
      className: readTreeField(rawNode, 'className', fieldNames) as string | undefined,
      icon: readTreeField(rawNode, 'icon', fieldNames),
    }

    flat.push(node)
    byValueKey[valueKey] = node
    return node
  }

  return {
    roots: treeData.map((node, index) => visit(node, 0, `node-${index}`)),
    flat,
    byValueKey,
  }
}

/** 读取 Subtree Check Keys 的内部工具函数。 */
const getSubtreeCheckKeys = (node: TreeSelectNormalizedNode) => {
  const collected: string[] = []

  const visit = (currentNode: TreeSelectNormalizedNode) => {
    if (!currentNode.disabled && currentNode.checkable && !currentNode.disableCheckbox) {
      collected.push(currentNode.valueKey)
    }
    currentNode.children.forEach(child => visit(child))
  }

  visit(node)
  return collected
}

/** 读取 Descendant Check Keys 的内部工具函数。 */
const getDescendantCheckKeys = (node: TreeSelectNormalizedNode) => {
  const collected: string[] = []

  node.children.forEach(child => {
    getSubtreeCheckKeys(child).forEach(valueKey => collected.push(valueKey))
  })

  return collected
}

/** expand Checked Value Keys 的内部工具函数。 */
const expandCheckedValueKeys = (
  inputValueKeys: string[],
  byValueKey: Record<string, TreeSelectNormalizedNode>,
  strict: boolean,
) => {
  const selectedKeys = new Set<string>()

  inputValueKeys.forEach(valueKey => {
    const matchedNode = byValueKey[valueKey]
    if (!matchedNode) return

    if (strict) {
      selectedKeys.add(valueKey)
      return
    }

    const descendantKeys = getDescendantCheckKeys(matchedNode)

    if (descendantKeys.length > 0) {
      descendantKeys.forEach(key => selectedKeys.add(key))
      return
    }

    if (!matchedNode.disabled && matchedNode.checkable && !matchedNode.disableCheckbox) {
      selectedKeys.add(valueKey)
    }
  })

  return selectedKeys
}

/** derive Check State 的内部工具函数。 */
const deriveCheckState = (
  roots: TreeSelectNormalizedNode[],
  baseSelectedKeys: Set<string>,
  strict: boolean,
): DerivedCheckState => {
  const checkedKeys = new Set<string>()
  const halfCheckedKeys = new Set<string>()
  const stateMap: Record<string, TreeCheckState> = {}

  const visit = (node: TreeSelectNormalizedNode): TreeCheckState => {
    const selfParticipates = !node.disabled && node.checkable && !node.disableCheckbox
    const childStates = node.children.map(child => visit(child))
    const childParticipantStates = childStates.filter(state => state.participates)
    const selfChecked = baseSelectedKeys.has(node.valueKey)

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

    const participates = selfParticipates || childParticipantStates.length > 0
    const state: TreeCheckState = {
      checked,
      halfChecked,
      participates,
    }

    stateMap[node.valueKey] = state

    if (checked && selfParticipates) {
      checkedKeys.add(node.valueKey)
    }
    if (halfChecked && selfParticipates) {
      halfCheckedKeys.add(node.valueKey)
    }

    return state
  }

  roots.forEach(node => visit(node))

  return {
    checkedKeys,
    halfCheckedKeys,
    stateMap,
  }
}

/** 解析 Display Checked Nodes 的内部工具函数。 */
const resolveDisplayCheckedNodes = (
  roots: TreeSelectNormalizedNode[],
  stateMap: Record<string, TreeCheckState>,
  strategy: TreeSelectShowCheckedStrategy,
) => {
  const displayNodes: TreeSelectNormalizedNode[] = []

  const visit = (node: TreeSelectNormalizedNode, ancestorCaptured: boolean) => {
    const state = stateMap[node.valueKey]
    if (!state) return

    const childStates = node.children.map(child => stateMap[child.valueKey]).filter(Boolean)
    const hasCheckedChildren = childStates.some(
      childState => childState.checked || childState.halfChecked,
    )
    const canDisplaySelf =
      !node.disabled && node.checkable && !node.disableCheckbox && state.checked

    if (strategy === SHOW_ALL) {
      if (canDisplaySelf) {
        displayNodes.push(node)
      }
      node.children.forEach(child => visit(child, ancestorCaptured))
      return
    }

    if (strategy === SHOW_PARENT) {
      if (canDisplaySelf && hasCheckedChildren && !ancestorCaptured) {
        displayNodes.push(node)
        return
      }
      if (canDisplaySelf && !hasCheckedChildren && !ancestorCaptured) {
        displayNodes.push(node)
        return
      }
      node.children.forEach(child => visit(child, ancestorCaptured || canDisplaySelf))
      return
    }

    if (canDisplaySelf && !hasCheckedChildren) {
      displayNodes.push(node)
      return
    }

    if (canDisplaySelf && node.children.length === 0) {
      displayNodes.push(node)
      return
    }

    node.children.forEach(child => visit(child, ancestorCaptured))
  }

  roots.forEach(node => visit(node, false))
  return displayNodes
}

/** 解析 Node Label Prop 的内部工具函数。 */
const resolveNodeLabelProp = (node: TreeSelectNormalizedNode, labelProp?: string) => {
  if (labelProp && node.raw[labelProp] !== undefined) {
    return node.raw[labelProp]
  }
  return node.label
}

/** 转换为 Labeled Value 的内部工具函数。 */
const toLabeledValue = (
  node: TreeSelectNormalizedNode,
  halfChecked: boolean,
  labelProp?: string,
): TreeSelectLabeledValue => {
  return {
    value: node.value,
    key: node.value,
    label: resolveNodeLabelProp(node, labelProp),
    halfChecked,
    disabled: node.disabled,
  }
}

/** 构建 Emitted Value 的内部工具函数。 */
const buildEmittedValue = (
  nodes: TreeSelectNormalizedNode[],
  multiple: boolean,
  labelInValue: boolean,
  halfCheckedKeys: Set<string>,
  labelProp?: string,
) => {
  const payload = labelInValue
    ? nodes.map(node => toLabeledValue(node, halfCheckedKeys.has(node.valueKey), labelProp))
    : nodes.map(node => node.value)

  if (multiple) {
    return payload
  }

  return payload[0] ?? null
}

/** 构建 Emitted Label 的内部工具函数。 */
const buildEmittedLabel = (
  nodes: TreeSelectNormalizedNode[],
  multiple: boolean,
  labelProp?: string,
) => {
  const labels = nodes.map(node => resolveNodeLabelProp(node, labelProp))
  return multiple ? labels : (labels[0] ?? null)
}

/** 解析 Search Target 的内部工具函数。 */
const resolveSearchTarget = (
  node: TreeSelectNormalizedNode,
  propName: string,
  labelProp?: string,
) => {
  if (propName === 'title' || propName === 'label') {
    return String(resolveNodeLabelProp(node, labelProp) ?? '')
  }
  if (propName === 'value') {
    return String(node.value)
  }
  return String(node.raw[propName] ?? '')
}

/** 解析 Default Search Targets 的内部工具函数。 */
const resolveDefaultSearchTargets = (node: TreeSelectNormalizedNode, labelProp?: string) => {
  return [String(node.value ?? ''), String(resolveNodeLabelProp(node, labelProp) ?? '')]
}

/** filter Visible Nodes 的内部工具函数。 */
const filterVisibleNodes = (
  roots: TreeSelectNormalizedNode[],
  expandedKeys: Set<string>,
  searchValue: string,
  matchesNode: (node: TreeSelectNormalizedNode) => boolean,
) => {
  if (!searchValue) {
    const visibleNodes: VisibleTreeNode[] = []

    const visit = (node: TreeSelectNormalizedNode) => {
      visibleNodes.push({ node, matched: false })
      if (expandedKeys.has(node.valueKey)) {
        node.children.forEach(child => visit(child))
      }
    }

    roots.forEach(node => visit(node))
    return visibleNodes
  }

  const visibleNodes: VisibleTreeNode[] = []

  const _visitAll = (node: TreeSelectNormalizedNode, matched: boolean) => {
    visibleNodes.push({ node, matched })
    node.children.forEach(child => _visitAll(child, false))
  }

  const visitFiltered = (node: TreeSelectNormalizedNode): VisibleTreeNode[] => {
    const selfMatched = matchesNode(node)
    const matchedChildren = node.children.flatMap(child => visitFiltered(child))
    if (!selfMatched && matchedChildren.length === 0) {
      return []
    }

    if (selfMatched) {
      const branch: VisibleTreeNode[] = [{ node, matched: true }]
      node.children.forEach(child => {
        const childBranch: VisibleTreeNode[] = []
        const collect = (currentNode: TreeSelectNormalizedNode, currentMatched: boolean) => {
          childBranch.push({ node: currentNode, matched: currentMatched })
          currentNode.children.forEach(grandChild => collect(grandChild, false))
        }
        collect(child, false)
        branch.push(...childBranch)
      })
      return branch
    }

    return [{ node, matched: false }, ...matchedChildren]
  }

  roots.forEach(node => {
    visibleNodes.push(...visitFiltered(node))
  })

  return visibleNodes
}

/** 解析 Semantic Class Name 的内部工具函数。 */
const resolveSemanticClassName = (classNames: Record<string, any> | undefined, key: string) => {
  const direct = classNames?.[key]
  if (typeof direct === 'string') return direct
  if (isObjectRecord(direct) && typeof direct.root === 'string') return direct.root
  return undefined
}

/** 解析 Semantic Style 的内部工具函数。 */
const resolveSemanticStyle = (styles: Record<string, any> | undefined, key: string) => {
  const direct = styles?.[key]
  if (isObjectRecord(direct) && !('root' in direct)) return direct
  if (isObjectRecord(direct?.root)) return direct.root
  return undefined
}

/** truncate Tag Label 的内部工具函数。 */
const truncateTagLabel = (label: any, maxTagTextLength?: number) => {
  const text = typeof label === 'string' || typeof label === 'number' ? String(label) : label
  if (typeof text !== 'string' || !maxTagTextLength || text.length <= maxTagTextLength) {
    return text
  }
  return `${text.slice(0, maxTagTextLength)}...`
}

/** 转换为 Display Text 的内部工具函数。 */
const toDisplayText = (value: any) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (value === undefined || value === null || value === false) {
    return ''
  }
  return String(value)
}

/** apply Inline Style 的内部工具函数。 */
const applyInlineStyle = (element: HTMLElement, style: any) => {
  if (!isObjectRecord(style)) return
  Object.assign(element.style, style)
}

/** Default Switcher Icon 的内部工具函数。 */
const _DefaultSwitcherIcon: FC<{ expanded: boolean; hidden?: boolean }> = ({
  expanded,
  hidden,
}) => {
  return (
    <span
      aria-hidden="true"
      className={joinClassName(
        'inline-flex h-4 w-4 items-center justify-center text-base-content/55 transition-transform duration-150',
        expanded && 'rotate-90',
        hidden && 'opacity-0',
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M7.5 5.5L12.5 10L7.5 14.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  )
}

/** Loading Switcher Icon 的内部工具函数。 */
const _LoadingSwitcherIcon: FC = () => {
  return (
    <span className="loading loading-spinner loading-xs text-base-content/55" aria-hidden="true" />
  )
}

/** Default Arrow Icon 的内部工具函数。 */
const _DefaultArrowIcon: FC<{ open: boolean }> = ({ open }) => {
  return (
    <span
      aria-hidden="true"
      className={joinClassName(
        'inline-flex h-4 w-4 items-center justify-center text-base-content/55 transition-transform duration-150',
        open && 'rotate-180',
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M5.5 7.5L10 12.5L14.5 7.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  )
}

/** Clear Icon 的内部工具函数。 */
const ClearIcon: FC = () => {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="block h-4 w-4">
      <path
        d="M6 6L14 14M14 6L6 14"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  )
}

/** Tree Select Root 的内部工具函数。 */
const TreeSelectRoot: FC<TreeSelectProps> = ({
  value,
  defaultValue,
  treeData = [],
  fieldNames,
  treeDataSimpleMode,
  multiple,
  treeCheckable,
  treeCheckStrictly,
  showCheckedStrategy = SHOW_CHILD,
  labelInValue,
  showSearch,
  searchValue,
  filterTreeNode,
  treeNodeFilterProp,
  placeholder,
  allowClear,
  clearLabel = '清空选择',
  notFoundContent,
  disabled,
  loading,
  open,
  defaultOpen,
  onOpenChange,
  treeDefaultExpandAll,
  treeDefaultExpandedKeys,
  treeExpandedKeys,
  treeLoadedKeys,
  onTreeExpand,
  loadData,
  maxCount,
  maxTagCount,
  maxTagPlaceholder,
  maxTagTextLength,
  listHeight = 320,
  placement = 'bottomLeft',
  popupMatchSelectWidth = true,
  size = 'md',
  status,
  variant = 'outlined',
  prefix,
  suffix,
  suffixIcon,
  showArrow = true,
  switcherIcon: _switcherIcon,
  treeTitleRender,
  treeNodeLabelProp = 'title',
  treeLine,
  onSearch,
  onChange,
  onSelect,
  onDeselect,
  onClear,
  onPopupScroll,
  className,
  style,
  selectorClassName,
  selectorStyle,
  popupClassName,
  popupStyle,
  dropdownClassName,
  dropdownStyle,
  classNames,
  styles,
  tagRender: _tagRender,
  children,
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>()
  const selectorRef = useRef<HTMLDivElement>()
  const arrowIconRef = useRef<HTMLSpanElement>()
  const selectionAreaRef = useRef<HTMLDivElement>()
  const searchInputRef = useRef<HTMLInputElement>()
  const clearButtonRef = useRef<HTMLButtonElement>()
  const popupRef = useRef<HTMLDivElement>()
  const treeBodyRef = useRef<HTMLDivElement>()
  const renderVersion = ref(0)
  const uncontrolledValue = ref(defaultValue ?? (treeCheckable || multiple ? [] : null))
  const internalOpen = ref(!!defaultOpen)
  const initialTree = normalizeTreeData(
    buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames),
    fieldNames,
  )
  const initialExpandedKeys = treeDefaultExpandAll
    ? initialTree.flat.filter(node => node.children.length > 0).map(node => node.value)
    : (treeDefaultExpandedKeys ?? [])
  const uncontrolledExpandedKeys = ref<TreeSelectValue[]>(initialExpandedKeys)
  const uncontrolledLoadedKeys = ref<TreeSelectValue[]>([])
  const internalSearch = ref('')
  const loadingNodeKeys = ref<string[]>([])
  const treeBodyScrollTop = ref(0)

  const searchConfig = isObjectRecord(showSearch)
    ? (showSearch as TreeSelectShowSearchConfig)
    : undefined
  const mergedTreeData = buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames)
  const normalizedTree = normalizeTreeData(mergedTreeData, fieldNames)
  const normalizedTreeRef = useRef<NormalizedTreeResult>()
  normalizedTreeRef.current = normalizedTree
  const mergedMultiple = !!multiple || !!treeCheckable
  const mergedLabelInValue = !!labelInValue || !!treeCheckStrictly
  const mergedDisabled = !!disabled || !!loading
  const allowClearConfig = isObjectRecord(allowClear) ? allowClear : allowClear ? {} : null
  const mergedShowSearch =
    typeof showSearch === 'boolean' ? showSearch : showSearch !== undefined ? true : mergedMultiple
  const selectorSemanticClassName = resolveSemanticClassName(classNames, 'selector')
  const selectorSemanticStyle = resolveSemanticStyle(styles, 'selector')
  const popupSemanticClassName = resolveSemanticClassName(classNames, 'popup')
  const popupSemanticStyle = resolveSemanticStyle(styles, 'popup')
  const treeSemanticClassName = resolveSemanticClassName(classNames, 'tree')
  const treeSemanticStyle = resolveSemanticStyle(styles, 'tree')
  const searchSemanticClassName = resolveSemanticClassName(classNames, 'search')
  const searchSemanticStyle = resolveSemanticStyle(styles, 'search')
  const tagSemanticClassName = resolveSemanticClassName(classNames, 'tag')
  const tagSemanticStyle = resolveSemanticStyle(styles, 'tag')
  const rootSemanticClassName = resolveSemanticClassName(classNames, 'root')
  const rootSemanticStyle = resolveSemanticStyle(styles, 'root')
  const rebuildNormalizedTree = () => {
    const nextMergedTreeData = buildSimpleModeTreeData(treeData, treeDataSimpleMode, fieldNames)
    const nextNormalizedTree = normalizeTreeData(nextMergedTreeData, fieldNames)
    normalizedTreeRef.current = nextNormalizedTree
    return nextNormalizedTree
  }
  const getNormalizedTree = () => {
    return normalizedTreeRef.current ?? normalizedTree
  }
  const getMergedSearchValue = () => {
    return (
      searchConfig?.searchValue ?? searchValue ?? (mergedShowSearch ? internalSearch.value : '')
    )
  }
  const getMergedOpen = () => {
    return open ?? internalOpen.value
  }
  const getExpandedValueKeys = () => {
    return normalizeInputValues(treeExpandedKeys ?? uncontrolledExpandedKeys.value)
  }
  const getExpandedKeySet = () => {
    return new Set(getExpandedValueKeys().map(serializeValue))
  }
  const getLoadedValueKeys = () => {
    return normalizeInputValues(treeLoadedKeys ?? uncontrolledLoadedKeys.value)
  }
  const getLoadedKeySet = () => {
    return new Set(getLoadedValueKeys().map(serializeValue))
  }
  const getSelectionSnapshot = () => {
    const activeTree = getNormalizedTree()
    const currentRawValue = value !== undefined ? value : uncontrolledValue.value
    const currentValueKeys = normalizeInputValues(currentRawValue).map(serializeValue)
    const currentValueKeySet = new Set(currentValueKeys)
    const baseCheckedKeys = treeCheckable
      ? expandCheckedValueKeys(currentValueKeys, activeTree.byValueKey, !!treeCheckStrictly)
      : currentValueKeySet
    const derivedCheckState = treeCheckable
      ? deriveCheckState(activeTree.roots, baseCheckedKeys, !!treeCheckStrictly)
      : {
          checkedKeys: currentValueKeySet,
          halfCheckedKeys: new Set<string>(),
          stateMap: Object.fromEntries(
            activeTree.flat.map(node => [
              node.valueKey,
              {
                checked: currentValueKeySet.has(node.valueKey),
                halfChecked: false,
                participates: true,
              },
            ]),
          ),
        }
    const displayNodes = treeCheckable
      ? resolveDisplayCheckedNodes(
          activeTree.roots,
          derivedCheckState.stateMap,
          showCheckedStrategy,
        )
      : (currentValueKeys
          .map(valueKey => activeTree.byValueKey[valueKey])
          .filter(Boolean) as TreeSelectNormalizedNode[])

    return {
      currentValueKeys,
      currentValueKeySet,
      derivedCheckState,
      displayNodes,
      displayNodeKeySet: new Set(displayNodes.map(node => node.valueKey)),
    }
  }
  const filterProp = searchConfig?.treeNodeFilterProp ?? treeNodeFilterProp
  const filterLogic = searchConfig?.filterTreeNode ?? filterTreeNode ?? true
  const matchesNode = (node: TreeSelectNormalizedNode, inputValue: string) => {
    if (!inputValue) return true
    if (typeof filterLogic === 'function') {
      return filterLogic(inputValue, node)
    }
    if (filterLogic === false) {
      return true
    }

    const normalizedInputValue = inputValue.toLowerCase()
    const searchTargets = filterProp
      ? [resolveSearchTarget(node, filterProp, treeNodeLabelProp)]
      : resolveDefaultSearchTargets(node, treeNodeLabelProp)

    return searchTargets.some(target => target.toLowerCase().includes(normalizedInputValue))
  }
  const visibleTagCount =
    typeof maxTagCount === 'number' && maxTagCount >= 0 ? Math.max(0, maxTagCount) : undefined
  const getVisibleNodes = () => {
    const activeTree = getNormalizedTree()
    const mergedSearchValue = getMergedSearchValue()
    return filterVisibleNodes(activeTree.roots, getExpandedKeySet(), mergedSearchValue, node =>
      matchesNode(node, mergedSearchValue),
    )
  }

  const requestRender = () => {
    renderVersion.value += 1
  }

  const syncPopupDom = () => {
    const popup = popupRef.current
    if (!popup) return
    const visible = getMergedOpen()
    popup.hidden = !visible
    popup.setAttribute('aria-hidden', visible ? 'false' : 'true')
  }

  const syncSelectorDom = () => {
    const selector = selectorRef.current
    if (!selector) return
    selector.setAttribute('aria-expanded', getMergedOpen() ? 'true' : 'false')
  }

  const syncArrowDom = () => {
    const arrow = arrowIconRef.current
    if (!arrow) return
    arrow.classList.toggle('rotate-180', getMergedOpen())
  }

  const syncOpenDom = () => {
    syncSelectorDom()
    syncPopupDom()
    syncArrowDom()
  }

  const buildSelectionPreview = (
    displayNodes: TreeSelectNormalizedNode[],
    derivedCheckStateOverride?: DerivedCheckState,
  ): TreeSelectSelectionPreview => {
    const currentValueKeySet = new Set(displayNodes.map(node => node.valueKey))
    const derivedCheckState = derivedCheckStateOverride ?? {
      checkedKeys: currentValueKeySet,
      halfCheckedKeys: new Set<string>(),
      stateMap: Object.fromEntries(
        getNormalizedTree().flat.map(node => [
          node.valueKey,
          {
            checked: currentValueKeySet.has(node.valueKey),
            halfChecked: false,
            participates: true,
          },
        ]),
      ),
    }

    return {
      currentValueKeySet,
      derivedCheckState,
      displayNodes,
      displayNodeKeySet: new Set(displayNodes.map(node => node.valueKey)),
    }
  }

  const getClearButtonVisible = (selectionOverride?: TreeSelectNormalizedNode[]) => {
    const visibleSelectionCount =
      selectionOverride?.length ?? getSelectionSnapshot().displayNodes.length
    return !!allowClearConfig && !mergedDisabled && visibleSelectionCount > 0
  }

  const restoreTreeBodyScrollTop = () => {
    const container = treeBodyRef.current
    if (!container) return
    const maxScrollTop =
      container.scrollHeight > 0 || container.clientHeight > 0
        ? Math.max(0, container.scrollHeight - container.clientHeight)
        : treeBodyScrollTop.value
    const nextScrollTop = Math.min(treeBodyScrollTop.value, maxScrollTop)
    treeBodyScrollTop.value = nextScrollTop
    if (container.scrollTop !== nextScrollTop) {
      container.scrollTop = nextScrollTop
    }
  }

  const syncClearButtonDom = (selectionOverride?: TreeSelectNormalizedNode[]) => {
    const button = clearButtonRef.current
    if (!button) return
    const visible = getClearButtonVisible(selectionOverride)
    button.classList.toggle('hidden', !visible)
    button.classList.toggle('inline-flex', visible)
    button.disabled = !visible
  }

  const syncSelectorContentDom = (selectionOverride?: TreeSelectNormalizedNode[]) => {
    const container = selectionAreaRef.current
    if (!container || typeof document === 'undefined') return

    const selection = getSelectionSnapshot()
    const displayNodes = selectionOverride ?? selection.displayNodes
    const hasValue = displayNodes.length > 0
    const visibleTagNodes =
      visibleTagCount !== undefined ? displayNodes.slice(0, visibleTagCount) : displayNodes
    const omittedTagNodes = visibleTagCount !== undefined ? displayNodes.slice(visibleTagCount) : []
    const mergedSearchValue = getMergedSearchValue()
    const mergedOpen = getMergedOpen()
    const showSearchInput =
      mergedShowSearch && (mergedMultiple || treeCheckable || mergedOpen || !hasValue)

    container.replaceChildren()

    visibleTagNodes.forEach(node => {
      const label = truncateTagLabel(
        resolveNodeLabelProp(node, treeNodeLabelProp),
        maxTagTextLength,
      )
      const chip = document.createElement('span')
      chip.className = joinClassName(
        'badge badge-outline inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium leading-none',
        tagSemanticClassName,
      )
      applyInlineStyle(chip, tagSemanticStyle)

      const labelNode = document.createElement('span')
      labelNode.className = 'truncate'
      labelNode.textContent = toDisplayText(label)
      chip.appendChild(labelNode)

      if (!mergedDisabled) {
        const closeButton = document.createElement('button')
        closeButton.type = 'button'
        closeButton.className =
          'btn btn-ghost btn-xs inline-flex h-4 min-h-0 w-4 shrink-0 items-center justify-center rounded-full p-0 text-center leading-none'
        closeButton.setAttribute(
          'aria-label',
          `移除 ${toDisplayText(resolveNodeLabelProp(node, treeNodeLabelProp) ?? node.value)}`,
        )
        closeButton.textContent = '×'
        closeButton.addEventListener('click', event => {
          const nextSelection = removeNodeFromSelection(node, event as MouseEvent)
          if (nextSelection) {
            syncSelectorContentDom(nextSelection.displayNodes)
            syncClearButtonDom(nextSelection.displayNodes)
            syncTreeBodyDom(nextSelection)
            syncOpenDom()
          }
        })
        chip.appendChild(closeButton)
      }

      container.appendChild(chip)
    })

    if (omittedTagNodes.length > 0) {
      const omittedNode = document.createElement('span')
      omittedNode.className =
        'badge badge-ghost inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs leading-none'
      omittedNode.textContent =
        typeof maxTagPlaceholder === 'function'
          ? toDisplayText(maxTagPlaceholder(omittedTagNodes))
          : toDisplayText(maxTagPlaceholder ?? `+${omittedTagNodes.length}`)
      container.appendChild(omittedNode)
    }

    if (showSearchInput) {
      const input = document.createElement('input')
      input.value = mergedSearchValue
      input.disabled = mergedDisabled
      input.placeholder = toDisplayText(placeholder ?? '请选择')
      input.className = joinClassName(
        'min-w-[5rem] flex-1 border-0 bg-transparent px-0 py-0 text-sm leading-5 outline-none placeholder:text-base-content/40',
        searchSemanticClassName,
      )
      applyInlineStyle(input, searchSemanticStyle)
      input.addEventListener('click', event => event.stopPropagation())
      input.addEventListener('input', event => {
        setMergedOpen(true)
        setMergedSearchValue((event.target as HTMLInputElement).value, { syncSelector: false })
      })
      searchInputRef.current = input
      container.appendChild(input)
      return
    }

    searchInputRef.current = undefined

    const contentNode = document.createElement('span')
    contentNode.className =
      hasValue && !mergedMultiple && !treeCheckable
        ? 'flex flex-1 items-center truncate text-sm leading-5'
        : 'flex flex-1 items-center truncate text-sm leading-5 text-base-content/40'
    contentNode.textContent =
      hasValue && !mergedMultiple && !treeCheckable
        ? toDisplayText(resolveNodeLabelProp(displayNodes[0], treeNodeLabelProp))
        : toDisplayText(placeholder ?? '请选择')
    container.appendChild(contentNode)
  }

  const syncTreeBodyDom = (selectionOverride?: TreeSelectSelectionPreview) => {
    const container = treeBodyRef.current
    if (!container || typeof document === 'undefined') return

    const selection = selectionOverride ?? getSelectionSnapshot()
    const visibleNodes = getVisibleNodes()
    const mergedSearchValue = getMergedSearchValue()
    const expandedKeySet = getExpandedKeySet()

    container.replaceChildren()

    if (!visibleNodes.length) {
      const emptyNode = document.createElement('div')
      emptyNode.className = 'rounded-md px-3 py-8 text-center text-sm text-base-content/55'
      emptyNode.textContent = toDisplayText(notFoundContent ?? '暂无匹配项')
      container.appendChild(emptyNode)
      restoreTreeBodyScrollTop()
      return
    }

    visibleNodes.forEach(({ node, matched }) => {
      const state = selection.derivedCheckState.stateMap[node.valueKey] ?? {
        checked: false,
        halfChecked: false,
        participates: true,
      }
      const selected = treeCheckable
        ? state.checked
        : selection.currentValueKeySet.has(node.valueKey)
      const halfChecked = treeCheckable ? state.halfChecked : false
      const expanded = mergedSearchValue ? true : expandedKeySet.has(node.valueKey)
      const loadingNode = loadingNodeKeys.value.includes(node.valueKey)
      const canExpand = !!loadData || node.children.length > 0 || !node.isLeaf

      const row = document.createElement('div')
      row.dataset.rueTreeSelectNode = node.valueKey
      row.className = joinClassName(
        'group flex items-center gap-1 rounded-lg py-1.5 pr-2',
        matched && 'bg-primary/8',
        treeLine && node.depth > 0 && 'border-l border-base-300/60',
        node.className,
      )
      row.style.paddingLeft = `${node.depth * 16 + 4}px`

      const expandButton = document.createElement('button')
      expandButton.type = 'button'
      expandButton.className =
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-base-200 disabled:cursor-not-allowed'
      expandButton.disabled = !canExpand || mergedDisabled || node.disabled
      expandButton.setAttribute('aria-label', expanded ? '折叠节点' : '展开节点')
      expandButton.textContent = loadingNode ? '…' : canExpand ? (expanded ? '▾' : '▸') : ''
      expandButton.addEventListener('click', event => {
        treeBodyScrollTop.value = container.scrollTop
        handleExpandToggle(node, event as MouseEvent)
        syncTreeBodyDom()
        syncOpenDom()
      })
      row.appendChild(expandButton)

      if (treeCheckable) {
        const checkboxButton = document.createElement('button')
        checkboxButton.type = 'button'
        checkboxButton.setAttribute('role', 'checkbox')
        checkboxButton.setAttribute(
          'aria-checked',
          halfChecked ? 'mixed' : state.checked ? 'true' : 'false',
        )
        checkboxButton.disabled =
          mergedDisabled || node.disabled || node.disableCheckbox || !node.checkable
        checkboxButton.className = joinClassName(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150',
          state.checked || halfChecked
            ? 'border-primary bg-primary text-primary-content'
            : 'border-base-content/40 bg-base-100 text-base-content/0',
          (mergedDisabled || node.disabled || node.disableCheckbox || !node.checkable) &&
            'opacity-45',
        )
        checkboxButton.textContent = halfChecked ? '−' : state.checked ? '✓' : ''
        checkboxButton.addEventListener('click', event => {
          treeBodyScrollTop.value = container.scrollTop
          const nextSelection = handleNodeToggle(node, event as MouseEvent)
          if (nextSelection) {
            syncSelectorContentDom(nextSelection.displayNodes)
            syncClearButtonDom(nextSelection.displayNodes)
            syncTreeBodyDom(nextSelection)
            syncOpenDom()
          }
        })
        row.appendChild(checkboxButton)
      }

      const labelButton = document.createElement('button')
      labelButton.type = 'button'
      labelButton.className = joinClassName(
        'flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-sm transition-colors duration-150',
        selected ? 'bg-primary/12 text-primary' : 'text-base-content hover:bg-base-200/70',
        (mergedDisabled || node.disabled || !node.selectable) && 'cursor-not-allowed opacity-55',
      )
      labelButton.disabled = mergedDisabled || node.disabled || !node.selectable
      labelButton.textContent = toDisplayText(
        treeTitleRender ? treeTitleRender(node) : resolveNodeLabelProp(node, treeNodeLabelProp),
      )
      labelButton.addEventListener('click', event => {
        treeBodyScrollTop.value = container.scrollTop
        const nextSelection = handleNodeToggle(node, event as MouseEvent)
        if (nextSelection) {
          syncSelectorContentDom(nextSelection.displayNodes)
          syncClearButtonDom(nextSelection.displayNodes)
          syncTreeBodyDom(nextSelection)
          syncOpenDom()
        }
      })
      row.appendChild(labelButton)

      container.appendChild(row)
    })

    restoreTreeBodyScrollTop()
  }

  const syncDynamicDom = () => {
    syncSelectorContentDom()
    syncClearButtonDom()
    syncTreeBodyDom()
    syncOpenDom()
  }

  const setMergedOpen = (
    nextOpen: boolean,
    options?: { selectionOverride?: TreeSelectNormalizedNode[] },
  ) => {
    const previousOpen = getMergedOpen()
    const openStateChanged = previousOpen !== nextOpen

    if (open === undefined) {
      if (internalOpen.value !== nextOpen) {
        internalOpen.value = nextOpen
        requestRender()
      }
    }
    if (openStateChanged) {
      syncSelectorContentDom(options?.selectionOverride)
    }
    syncOpenDom()
    if (openStateChanged && onOpenChange) {
      onOpenChange(nextOpen)
    }
    if (openStateChanged && nextOpen && mergedShowSearch) {
      Promise.resolve().then(() => {
        searchInputRef.current?.focus()
      })
    }
  }

  const setMergedSearchValue = (nextSearchValue: string, options?: { syncSelector?: boolean }) => {
    if (searchConfig?.searchValue === undefined && searchValue === undefined) {
      if (internalSearch.value === nextSearchValue) {
        return
      }
      internalSearch.value = nextSearchValue
      requestRender()
    }
    if (options?.syncSelector === false) {
      syncClearButtonDom()
      syncTreeBodyDom()
      syncOpenDom()
    } else {
      syncDynamicDom()
    }
    if (searchConfig?.onSearch) {
      searchConfig.onSearch(nextSearchValue)
    }
    if (onSearch) {
      onSearch(nextSearchValue)
    }
  }

  const setExpandedKeys = (nextExpandedKeys: TreeSelectValue[]) => {
    if (treeExpandedKeys === undefined) {
      uncontrolledExpandedKeys.value = nextExpandedKeys
      requestRender()
    }
    syncTreeBodyDom()
    if (onTreeExpand) {
      onTreeExpand(nextExpandedKeys)
    }
  }

  const setLoadedKeys = (nextLoadedKeys: TreeSelectValue[]) => {
    if (treeLoadedKeys === undefined) {
      uncontrolledLoadedKeys.value = nextLoadedKeys
      requestRender()
    }
    syncTreeBodyDom()
  }

  const emitSelectionCallbacks = (
    previousNodes: TreeSelectNormalizedNode[],
    nextNodes: TreeSelectNormalizedNode[],
    extra: TreeSelectChangeExtra,
    halfCheckedKeys: Set<string>,
  ) => {
    const previousKeySet = new Set(previousNodes.map(node => node.valueKey))
    const nextKeySet = new Set(nextNodes.map(node => node.valueKey))

    if (onDeselect) {
      previousNodes
        .filter(node => !nextKeySet.has(node.valueKey))
        .forEach(node => {
          onDeselect(
            mergedLabelInValue
              ? toLabeledValue(node, halfCheckedKeys.has(node.valueKey), treeNodeLabelProp)
              : node.value,
            node,
            { ...extra, selected: false, checked: false },
          )
        })
    }

    if (onSelect) {
      nextNodes
        .filter(node => !previousKeySet.has(node.valueKey))
        .forEach(node => {
          onSelect(
            mergedLabelInValue
              ? toLabeledValue(node, halfCheckedKeys.has(node.valueKey), treeNodeLabelProp)
              : node.value,
            node,
            { ...extra, selected: true, checked: true },
          )
        })
    }
  }

  const commitValue = (
    nextNodes: TreeSelectNormalizedNode[],
    extra: TreeSelectChangeExtra,
    nextHalfCheckedKeys: Set<string>,
  ) => {
    const activeTree = getNormalizedTree()
    const currentSelection = getSelectionSnapshot()
    const nextValue = buildEmittedValue(
      nextNodes,
      mergedMultiple,
      mergedLabelInValue,
      nextHalfCheckedKeys,
      treeNodeLabelProp,
    )
    const nextLabel = buildEmittedLabel(nextNodes, mergedMultiple, treeNodeLabelProp)

    if (value === undefined) {
      uncontrolledValue.value = nextValue as any
      requestRender()
    }

    syncSelectorContentDom(nextNodes)
    syncClearButtonDom(nextNodes)
    syncTreeBodyDom()
    syncOpenDom()

    emitSelectionCallbacks(
      currentSelection.displayNodes,
      nextNodes,
      {
        ...extra,
        displayNodes: nextNodes,
        halfCheckedKeys: Array.from(nextHalfCheckedKeys)
          .map(valueKey => activeTree.byValueKey[valueKey]?.value)
          .filter(isTreeSelectValue),
      },
      nextHalfCheckedKeys,
    )

    if (onChange) {
      onChange(nextValue as any, nextLabel, {
        ...extra,
        displayNodes: nextNodes,
        halfCheckedKeys: Array.from(nextHalfCheckedKeys)
          .map(valueKey => activeTree.byValueKey[valueKey]?.value)
          .filter(isTreeSelectValue),
        checkedNodes: treeCheckable
          ? activeTree.flat.filter(node => nextNodes.some(item => item.valueKey === node.valueKey))
          : nextNodes,
      })
    }
  }

  const removeNodeFromSelection = (node: TreeSelectNormalizedNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const currentSelection = getSelectionSnapshot()
    const activeTree = getNormalizedTree()

    if (treeCheckable) {
      const nextBaseKeys = expandCheckedValueKeys(
        currentSelection.currentValueKeys,
        activeTree.byValueKey,
        !!treeCheckStrictly,
      )
      if (treeCheckStrictly) {
        nextBaseKeys.delete(node.valueKey)
      } else {
        getSubtreeCheckKeys(node).forEach(valueKey => nextBaseKeys.delete(valueKey))
      }

      const nextCheckState = deriveCheckState(activeTree.roots, nextBaseKeys, !!treeCheckStrictly)
      const nextDisplayNodes = resolveDisplayCheckedNodes(
        activeTree.roots,
        nextCheckState.stateMap,
        showCheckedStrategy,
      )
      commitValue(
        nextDisplayNodes,
        { triggerNode: node, triggerValue: node.value, checked: false },
        nextCheckState.halfCheckedKeys,
      )
      return buildSelectionPreview(nextDisplayNodes, nextCheckState)
    }

    const nextDisplayNodes = currentSelection.displayNodes.filter(
      item => item.valueKey !== node.valueKey,
    )
    commitValue(
      nextDisplayNodes,
      { triggerNode: node, triggerValue: node.value, selected: false },
      new Set<string>(),
    )
    return buildSelectionPreview(nextDisplayNodes)
  }

  const clearSelection = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (onClear) {
      onClear(event)
    }

    if (getMergedSearchValue()) {
      setMergedSearchValue('')
    }

    commitValue(
      [],
      { clear: true, selected: false, checked: false, triggerNode: null, triggerValue: null },
      new Set<string>(),
    )

    const clearedSelection = buildSelectionPreview([])
    syncSelectorContentDom(clearedSelection.displayNodes)
    syncClearButtonDom(clearedSelection.displayNodes)
    syncTreeBodyDom(clearedSelection)
    syncOpenDom()
  }

  const handleNodeToggle = (node: TreeSelectNormalizedNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (mergedDisabled || node.disabled) {
      return null
    }

    const currentSelection = getSelectionSnapshot()
    const activeTree = getNormalizedTree()

    if (treeCheckable) {
      const nextBaseKeys = expandCheckedValueKeys(
        currentSelection.currentValueKeys,
        activeTree.byValueKey,
        !!treeCheckStrictly,
      )
      const currentlyChecked = currentSelection.derivedCheckState.checkedKeys.has(node.valueKey)

      if (treeCheckStrictly) {
        if (currentlyChecked) {
          nextBaseKeys.delete(node.valueKey)
        } else {
          nextBaseKeys.add(node.valueKey)
        }
      } else {
        const subtreeKeys = getSubtreeCheckKeys(node)
        if (currentlyChecked) {
          subtreeKeys.forEach(valueKey => nextBaseKeys.delete(valueKey))
        } else {
          subtreeKeys.forEach(valueKey => nextBaseKeys.add(valueKey))
        }
      }

      const nextCheckState = deriveCheckState(activeTree.roots, nextBaseKeys, !!treeCheckStrictly)
      const nextDisplayNodes = resolveDisplayCheckedNodes(
        activeTree.roots,
        nextCheckState.stateMap,
        showCheckedStrategy,
      )

      if (!currentlyChecked && maxCount && nextDisplayNodes.length > maxCount) {
        return null
      }

      commitValue(
        nextDisplayNodes,
        {
          triggerNode: node,
          triggerValue: node.value,
          checked: !currentlyChecked,
          selected: !currentlyChecked,
        },
        nextCheckState.halfCheckedKeys,
      )

      const autoClearSearchValue = searchConfig?.autoClearSearchValue ?? true
      if (autoClearSearchValue && getMergedSearchValue()) {
        setMergedSearchValue('')
      }
      setMergedOpen(true)
      return buildSelectionPreview(nextDisplayNodes, nextCheckState)
    }

    if (mergedMultiple) {
      const nextDisplayNodes = currentSelection.displayNodes.some(
        item => item.valueKey === node.valueKey,
      )
        ? currentSelection.displayNodes.filter(item => item.valueKey !== node.valueKey)
        : [...currentSelection.displayNodes, node]

      if (
        !currentSelection.displayNodeKeySet.has(node.valueKey) &&
        maxCount &&
        nextDisplayNodes.length > maxCount
      ) {
        return null
      }

      commitValue(
        nextDisplayNodes,
        {
          triggerNode: node,
          triggerValue: node.value,
          selected: !currentSelection.displayNodeKeySet.has(node.valueKey),
        },
        new Set<string>(),
      )

      const autoClearSearchValue = searchConfig?.autoClearSearchValue ?? true
      if (autoClearSearchValue && getMergedSearchValue()) {
        setMergedSearchValue('')
      }
      setMergedOpen(true)
      return buildSelectionPreview(nextDisplayNodes)
    }

    commitValue(
      [node],
      {
        triggerNode: node,
        triggerValue: node.value,
        selected: true,
      },
      new Set<string>(),
    )

    if (getMergedSearchValue()) {
      setMergedSearchValue('')
    }
    setMergedOpen(false, { selectionOverride: [node] })
    return buildSelectionPreview([node])
  }

  const handleExpandToggle = (node: TreeSelectNormalizedNode, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (
      mergedDisabled ||
      node.disabled ||
      (!loadData && node.children.length === 0 && node.isLeaf)
    ) {
      return
    }

    const expandedKeySet = getExpandedKeySet()
    const mergedLoadedValueKeys = getLoadedValueKeys()
    const loadedKeySet = getLoadedKeySet()
    const mergedSearchValue = getMergedSearchValue()
    const activeTree = getNormalizedTree()
    const nextExpandedKeys = new Set(expandedKeySet)
    const nextOpen = !expandedKeySet.has(node.valueKey)

    if (nextOpen) {
      nextExpandedKeys.add(node.valueKey)
    } else {
      nextExpandedKeys.delete(node.valueKey)
    }

    setExpandedKeys(
      Array.from(nextExpandedKeys)
        .map(valueKey => activeTree.byValueKey[valueKey]?.value)
        .filter(isTreeSelectValue),
    )

    if (
      nextOpen &&
      loadData &&
      !mergedSearchValue &&
      !loadedKeySet.has(node.valueKey) &&
      !loadingNodeKeys.value.includes(node.valueKey) &&
      !node.isLeaf &&
      node.children.length === 0
    ) {
      loadingNodeKeys.value = [...loadingNodeKeys.value, node.valueKey]
      requestRender()
      syncTreeBodyDom()

      Promise.resolve(loadData(node))
        .then(() => {
          rebuildNormalizedTree()
          const nextLoadedKeys = Array.from(new Set([...mergedLoadedValueKeys, node.value]))
          setLoadedKeys(nextLoadedKeys)
          syncDynamicDom()
        })
        .finally(() => {
          loadingNodeKeys.value = loadingNodeKeys.value.filter(
            valueKey => valueKey !== node.valueKey,
          )
          rebuildNormalizedTree()
          requestRender()
          syncTreeBodyDom()
        })
    }
  }

  const handleRootMouseDown = (event: MouseEvent) => {
    if (mergedDisabled) {
      event.preventDefault()
    }
  }

  const handleSelectorClick = () => {
    if (mergedDisabled) return
    setMergedOpen(!getMergedOpen())
  }

  onMounted(() => {
    if (typeof document === 'undefined') {
      return
    }

    syncDynamicDom()

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      setMergedOpen(false)
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMergedOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    onUnmounted(() => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    })
  })

  watch(
    () => value,
    () => {
      syncDynamicDom()
    },
  )

  watch(
    () => open,
    () => {
      syncDynamicDom()
    },
  )

  watch(
    () => searchValue,
    () => {
      syncDynamicDom()
    },
  )

  watch(
    () => treeData,
    () => {
      rebuildNormalizedTree()
      syncDynamicDom()
    },
  )

  watch(
    () => treeExpandedKeys,
    () => {
      syncDynamicDom()
    },
  )

  watch(
    () => treeLoadedKeys,
    () => {
      syncDynamicDom()
    },
  )

  const resolvedSizeClass = sizeClassMap[size] ?? ''
  const selectorClass = joinClassName(
    'input relative flex w-full items-center gap-2 px-3 text-left transition-shadow duration-150',
    resolvedSizeClass,
    status === 'error' && 'input-error',
    status === 'warning' && 'input-warning',
    variant === 'filled' && 'bg-base-200 border-base-300 shadow-none',
    variant === 'borderless' && 'border-transparent bg-transparent px-0 shadow-none',
    variant === 'underlined' &&
      'rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none',
    mergedDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    selectorSemanticClassName,
    selectorClassName,
  )
  const popupClass = joinClassName(
    'absolute z-40 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]',
    placement.startsWith('top') ? 'bottom-full mb-2' : 'top-full mt-2',
    placement.endsWith('Right') ? 'right-0' : 'left-0',
    popupSemanticClassName,
    popupClassName,
    dropdownClassName,
  )
  const popupSizingStyle =
    popupMatchSelectWidth === false
      ? { minWidth: '18rem' }
      : typeof popupMatchSelectWidth === 'number'
        ? { width: `${popupMatchSelectWidth}px` }
        : { minWidth: '100%' }
  const clearIcon = allowClearConfig?.clearIcon ?? <ClearIcon />

  return (
    <div
      {...rest}
      ref={rootRef}
      data-rue-tree-select-root="true"
      data-rue-tree-select-version={String(renderVersion.value)}
      className={joinClassName('relative', rootSemanticClassName, className)}
      style={{ ...rootSemanticStyle, ...style }}
      onMouseDown={handleRootMouseDown}
    >
      <div
        data-rue-tree-select-selector="true"
        ref={selectorRef}
        className={selectorClass}
        style={{ ...selectorSemanticStyle, ...selectorStyle }}
        role="combobox"
        aria-expanded={(() => {
          void renderVersion.value
          return getMergedOpen()
        })()}
        aria-disabled={mergedDisabled}
        aria-haspopup="tree"
        onClick={handleSelectorClick}
      >
        {prefix !== undefined ? (
          <span className="flex shrink-0 items-center text-base-content/65">{prefix}</span>
        ) : null}

        <div
          ref={selectionAreaRef}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 self-stretch py-1"
        />

        <button
          ref={clearButtonRef}
          type="button"
          className={joinClassName(
            'btn btn-ghost btn-xs btn-circle h-7 min-h-0 w-7 shrink-0 items-center justify-center self-center p-0 leading-none text-base-content/55 hover:text-base-content',
            (() => {
              void renderVersion.value
              return getClearButtonVisible() ? 'inline-flex' : 'hidden'
            })(),
          )}
          aria-label={clearLabel}
          disabled={(() => {
            void renderVersion.value
            return !getClearButtonVisible()
          })()}
          onClick={clearSelection}
        >
          {clearIcon}
        </button>

        {suffix !== undefined ? (
          <span className="flex shrink-0 items-center text-base-content/65">{suffix}</span>
        ) : null}

        {showArrow ? (
          <span className="flex shrink-0 items-center">
            {suffixIcon ?? (
              <span
                ref={arrowIconRef}
                data-rue-tree-select-arrow="true"
                aria-hidden="true"
                className={joinClassName(
                  'inline-flex h-4 w-4 items-center justify-center text-base-content/55 transition-transform duration-150',
                  (() => {
                    void renderVersion.value
                    return getMergedOpen()
                  })() && 'rotate-180',
                )}
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path
                    d="M5.5 7.5L10 12.5L14.5 7.5"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            )}
          </span>
        ) : null}
      </div>

      <div
        ref={popupRef}
        data-rue-tree-select-popup="true"
        aria-hidden={(() => {
          void renderVersion.value
          return getMergedOpen() ? 'false' : 'true'
        })()}
        className={popupClass}
        style={{
          ...popupSizingStyle,
          ...popupSemanticStyle,
          ...popupStyle,
          ...dropdownStyle,
        }}
      >
        <div
          ref={treeBodyRef}
          role="tree"
          className={joinClassName('overflow-auto p-2', treeSemanticClassName)}
          style={{ maxHeight: `${listHeight}px`, ...treeSemanticStyle }}
          onScroll={(event: Event) => {
            treeBodyScrollTop.value = (event.target as HTMLDivElement).scrollTop
            if (onPopupScroll) {
              onPopupScroll(event as UIEvent)
            }
          }}
        />
      </div>

      {children}
    </div>
  )
}

type TreeSelectCompound = FC<TreeSelectProps> & {
  SHOW_ALL: typeof SHOW_ALL
  SHOW_PARENT: typeof SHOW_PARENT
  SHOW_CHILD: typeof SHOW_CHILD
}

const TreeSelect = TreeSelectRoot as TreeSelectCompound

TreeSelect.SHOW_ALL = SHOW_ALL
TreeSelect.SHOW_PARENT = SHOW_PARENT
TreeSelect.SHOW_CHILD = SHOW_CHILD

/** 默认导出树选择组件。 */
export default TreeSelect
