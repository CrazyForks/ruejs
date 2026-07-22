/*
Form 模块概述
- 汇总表单组件的公开类型、渲染入口和局部工具逻辑。
- 导出注释用于 API 文档生成，内部注释标明状态归一化、样式映射与 DOM 交互边界。
*/
import type { FC } from '@rue-js/rue'
import {
  Slot,
  getCurrentInstance,
  h,
  onCleanup,
  onMounted,
  onUpdated,
  ref,
  render as renderRue,
  useRef,
  useState,
  watch,
} from '@rue-js/rue'

/** FormLayout 类型。 */
export type FormLayout = 'horizontal' | 'vertical' | 'inline'
/** FormLabelAlign 对齐方式类型。 */
export type FormLabelAlign = 'left' | 'right'
/** FormSize 尺寸类型。 */
export type FormSize = 'small' | 'middle' | 'large' | 'sm' | 'md' | 'lg'
/** FormRequiredMark 类型。 */
export type FormRequiredMark =
  | boolean
  | 'optional'
  | ((label: any, info: { required: boolean }) => any)
/** FormComponent 类型。 */
export type FormComponent = string | false
/** NamePath 类型。 */
export type NamePath = string | number | ReadonlyArray<string | number>
/** NamePathSegment 类型。 */
export type NamePathSegment = string | number
/** ValidateStatus 状态类型。 */
export type ValidateStatus = 'success' | 'warning' | 'error' | 'validating'

/** FormValidateMessages 接口。 */
export interface FormValidateMessages {
  /** required 配置项。 */
  required?: string
  /** whitespace 配置项。 */
  whitespace?: string
  /** pattern 配置项。 */
  pattern?: string
  /** types 配置项。 */
  types?: Partial<Record<FormRuleType, string>>
  /** string 配置项。 */
  string?: {
    len?: string
    min?: string
    max?: string
  }
  /** number 配置项。 */
  number?: {
    len?: string
    min?: string
    max?: string
  }
  /** array 配置项。 */
  array?: {
    len?: string
    min?: string
    max?: string
  }
}

/** FormRuleType 视觉或语义变体类型。 */
export type FormRuleType = 'string' | 'number' | 'boolean' | 'array' | 'email' | 'url'

/** FormRule 接口。 */
export interface FormRule {
  /** required 配置项。 */
  required?: boolean
  /** message 配置项。 */
  message?: string
  /** min 配置项。 */
  min?: number
  /** max 配置项。 */
  max?: number
  /** len 配置项。 */
  len?: number
  /** 组件类型或语义类型。 */
  type?: FormRuleType
  /** pattern 配置项。 */
  pattern?: RegExp
  /** whitespace 配置项。 */
  whitespace?: boolean
  /** warningOnly 配置项。 */
  warningOnly?: boolean
  /** transform 配置项。 */
  transform?: (value: any) => any
  /** validator 配置项。 */
  validator?: (rule: FormRule, value: any, values: any) => void | string | Promise<void | string>
}

/** FieldError 接口。 */
export interface FieldError {
  /** 表单 name 属性或分组名称。 */
  name: NamePathSegment[]
  /** errors 配置项。 */
  errors: string[]
  /** warnings 配置项。 */
  warnings: string[]
}

/** FieldData 数据项结构。 */
export interface FieldData extends FieldError {
  /** touched 配置项。 */
  touched: boolean
  /** validating 配置项。 */
  validating: boolean
  /** 受控值。 */
  value: any
}

/** FormListFieldData 数据项结构。 */
export interface FormListFieldData {
  /** 数据项唯一标识。 */
  key: number
  /** 表单 name 属性或分组名称。 */
  name: number
  /** fieldKey 标识键。 */
  fieldKey: number
}

/** FormListOperation 接口。 */
export interface FormListOperation {
  /** add 配置项。 */
  add: (defaultValue?: any, insertIndex?: number) => void
  /** remove 配置项。 */
  remove: (index: number | number[]) => void
  /** move 配置项。 */
  move: (from: number, to: number) => void
}

/** FormErrorListProps 组件属性。 */
export interface FormErrorListProps {
  /** errors 配置项。 */
  errors?: ReadonlyArray<any>
  /** warnings 配置项。 */
  warnings?: ReadonlyArray<any>
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
}

/** FormProps 组件属性。 */
export interface FormProps {
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** 组件子内容。 */
  children?: any
  /** render 配置项。 */
  render?: (form: FormInstance) => any
  /** component 配置项。 */
  component?: FormComponent
  /** layout 配置项。 */
  layout?: FormLayout
  /** 组件尺寸。 */
  size?: FormSize
  /** 是否禁用交互。 */
  disabled?: boolean
  /** colon 配置项。 */
  colon?: boolean
  /** labelAlign 配置项。 */
  labelAlign?: FormLabelAlign
  /** labelWrap 配置项。 */
  labelWrap?: boolean
  /** labelCol 配置项。 */
  labelCol?: FormColConfig
  /** wrapperCol 配置项。 */
  wrapperCol?: FormColConfig
  /** requiredMark 配置项。 */
  requiredMark?: FormRequiredMark
  /** initialValues 值集合。 */
  initialValues?: Record<string, any>
  /** form 配置项。 */
  form?: FormInstance
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** preserve 配置项。 */
  preserve?: boolean
  /** validateMessages 配置项。 */
  validateMessages?: FormValidateMessages
  /** validateTrigger 配置项。 */
  validateTrigger?: string | string[]
  /** scrollToFirstError 配置项。 */
  scrollToFirstError?: boolean | (ScrollIntoViewOptions & { focus?: boolean })
  /** onValuesChange 事件回调。 */
  onValuesChange?: (changedValues: any, allValues: any) => void
  /** onFieldsChange 事件回调。 */
  onFieldsChange?: (changedFields: FieldData[], allFields: FieldData[]) => void
  /** onFinish 事件回调。 */
  onFinish?: (values: any) => void
  /** onFinishFailed 事件回调。 */
  onFinishFailed?: (info: FormFinishFailedInfo) => void
  /** onSubmit 事件回调。 */
  onSubmit?: (event: Event) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** FormItemProps 组件属性。 */
export interface FormItemProps {
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** form 配置项。 */
  form?: FormInstance
  /** 组件子内容。 */
  children?: any
  /** render 配置项。 */
  render?: (
    controlProps: Record<string, any>,
    meta: {
      value: any
      touched: boolean
      validating: boolean
      errors: string[]
      warnings: string[]
      status?: ValidateStatus
    },
    form: FormInstance,
  ) => any
  /** 表单 name 属性或分组名称。 */
  name?: NamePath
  /** 展示标签。 */
  label?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** help 配置项。 */
  help?: any
  /** required 配置项。 */
  required?: boolean
  /** rules 配置项。 */
  rules?: FormRule[]
  /** dependencies 配置项。 */
  dependencies?: NamePath[]
  /** noStyle 内联样式。 */
  noStyle?: boolean
  /** hidden 配置项。 */
  hidden?: boolean
  /** initialValue 值。 */
  initialValue?: any
  /** preserve 配置项。 */
  preserve?: boolean
  /** valuePropName 配置项。 */
  valuePropName?: string
  /** trigger 区域配置。 */
  trigger?: string
  /** validateTrigger 配置项。 */
  validateTrigger?: string | string[]
  /** getValueFromEvent 配置项。 */
  getValueFromEvent?: (...args: any[]) => any
  /** getValueProps 透传属性。 */
  getValueProps?: (value: any) => Record<string, any>
  /** normalize 配置项。 */
  normalize?: (value: any, prevValue: any, values: any) => any
  /** shouldUpdate 配置项。 */
  shouldUpdate?: boolean | ((prevValues: any, nextValues: any) => boolean)
  /** validateStatus 状态。 */
  validateStatus?: ValidateStatus
  /** hasFeedback 配置项。 */
  hasFeedback?: boolean
  /** messageVariables 配置项。 */
  messageVariables?: Record<string, string>
  /** colon 配置项。 */
  colon?: boolean
  /** labelAlign 配置项。 */
  labelAlign?: FormLabelAlign
  /** labelCol 配置项。 */
  labelCol?: FormColConfig
  /** wrapperCol 配置项。 */
  wrapperCol?: FormColConfig
  /** layout 配置项。 */
  layout?: Exclude<FormLayout, 'inline'>
  /** htmlFor 配置项。 */
  htmlFor?: string
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** FormListProps 组件属性。 */
export interface FormListProps {
  /** form 配置项。 */
  form?: FormInstance
  /** 表单 name 属性或分组名称。 */
  name: NamePath
  /** 组件子内容。 */
  children?: (
    fields: FormListFieldData[],
    operation: FormListOperation,
    meta: { errors: string[]; warnings: string[] },
  ) => any
  /** render 配置项。 */
  render?: (
    fields: FormListFieldData[],
    operation: FormListOperation,
    meta: { errors: string[]; warnings: string[] },
  ) => any
  /** initialValue 值。 */
  initialValue?: any[]
  /** rules 配置项。 */
  rules?: FormRule[]
}

/** FormFinishFailedInfo 接口。 */
export interface FormFinishFailedInfo {
  /** values 配置项。 */
  values: any
  /** errorFields 配置项。 */
  errorFields: FieldError[]
  /** outOfDate 配置项。 */
  outOfDate: boolean
}

/** FormInstance 对外暴露的实例能力。 */
export interface FormInstance {
  /** getFieldValue 值。 */
  getFieldValue: (name: NamePath) => any
  /** getFieldsValue 值。 */
  getFieldsValue: (nameList?: true | NamePath[]) => any
  /** setFieldValue 值。 */
  setFieldValue: (name: NamePath, value: any) => void
  /** setFieldsValue 值。 */
  setFieldsValue: (values: Record<string, any>) => void
  /** resetFields 配置项。 */
  resetFields: (nameList?: NamePath[]) => void
  /** validateFields 配置项。 */
  validateFields: (nameList?: NamePath[]) => Promise<any>
  /** submit 配置项。 */
  submit: () => void
  /** scrollToField 配置项。 */
  scrollToField: (name: NamePath, options?: ScrollIntoViewOptions & { focus?: boolean }) => void
  /** isFieldTouched 配置项。 */
  isFieldTouched: (name: NamePath) => boolean
  /** getFieldError 配置项。 */
  getFieldError: (name: NamePath) => string[]
  /** getFieldsError 配置项。 */
  getFieldsError: (nameList?: NamePath[]) => FieldError[]
}

/** FormColConfig 配置对象。 */
export interface FormColConfig {
  /** span 配置项。 */
  span?: number
  /** offset 配置项。 */
  offset?: number
}

interface InternalFieldMeta {
  touched: boolean
  validating: boolean
  errors: string[]
  warnings: string[]
}

interface RegisteredFieldEntity {
  id: string
  kind: 'item' | 'list'
  getNamePath: () => NamePathSegment[] | undefined
  getRules: () => FormRule[]
  getRequired: () => boolean | undefined
  getLabel: () => any
  getMessageVariables: () => Record<string, string> | undefined
  getValidateTrigger: () => string[]
  getDependencies: () => NamePathSegment[][]
  getInitialValue: () => any
  getPreserve: () => boolean | undefined
}

interface FormRuntimeOptions {
  name?: string
  preserve?: boolean
  validateTrigger: string[]
  validateMessages: FormValidateMessages
  scrollToFirstError?: boolean | (ScrollIntoViewOptions & { focus?: boolean })
  onValuesChange?: (changedValues: any, allValues: any) => void
  onFieldsChange?: (changedFields: FieldData[], allFields: FieldData[]) => void
  onFinish?: (values: any) => void
  onFinishFailed?: (info: FormFinishFailedInfo) => void
}

interface InternalFormInstance extends FormInstance {
  __INTERNAL__: {
    version: { value: number }
    setRuntimeOptions: (options: FormRuntimeOptions) => void
    ensureInitialized: (values?: Record<string, any>) => boolean
    registerField: (entity: RegisteredFieldEntity) => () => void
    getMeta: (namePath: NamePathSegment[]) => InternalFieldMeta
    validateFieldByPath: (
      namePath: NamePathSegment[],
      triggerName?: string,
    ) => Promise<FieldError | null>
    updateValueFromControl: (
      namePath: NamePathSegment[],
      value: any,
      info: { touch?: boolean; triggerName?: string },
    ) => Promise<void>
    updateListValue: (namePath: NamePathSegment[], value: any[]) => Promise<void>
    getDefaultValidateTrigger: () => string[]
    setRootElement: (element: HTMLElement | null) => void
    subscribe: (subscriber: () => void) => () => void
    emitUpdate: () => void
  }
}

interface FormContextValue {
  form: InternalFormInstance
  layout: FormLayout
  size?: FormSize
  disabled?: boolean
  colon: boolean
  labelAlign: FormLabelAlign
  labelWrap: boolean
  labelCol?: FormColConfig
  wrapperCol?: FormColConfig
  requiredMark: FormRequiredMark
  preserve?: boolean
  validateTrigger: string[]
  formName?: string
}

/** RUE_COMPONENT_TYPE_KEY 内部常量。 */
const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
/** FORM_CONTEXT_PROP 内部常量。 */
const FORM_CONTEXT_PROP = '__rueFormContext'
/** FORM_PATH_PROP 内部常量。 */
const FORM_PATH_PROP = '__rueFormPath'
/** FORM_ORIGINAL_SLOT_PROP 内部常量。 */
const FORM_ORIGINAL_SLOT_PROP = '__rueFormOriginalDefaultSlot'
/** RUE_SLOT_KEY 内部常量。 */
const RUE_SLOT_KEY = '__rue_slots'

let formEntitySeed = 0

const defaultValidateMessages: FormValidateMessages = {
  required: '${label} 为必填项',
  whitespace: '${label} 不能只包含空白字符',
  pattern: '${label} 格式不正确',
  types: {
    string: '${label} 不是合法文本',
    number: '${label} 不是合法数字',
    boolean: '${label} 不是合法布尔值',
    array: '${label} 不是合法数组',
    email: '${label} 不是合法邮箱',
    url: '${label} 不是合法链接',
  },
  string: {
    len: '${label} 需为 ${len} 个字符',
    min: '${label} 至少 ${min} 个字符',
    max: '${label} 最多 ${max} 个字符',
  },
  number: {
    len: '${label} 需等于 ${len}',
    min: '${label} 不能小于 ${min}',
    max: '${label} 不能大于 ${max}',
  },
  array: {
    len: '${label} 需包含 ${len} 项',
    min: '${label} 至少包含 ${min} 项',
    max: '${label} 最多包含 ${max} 项',
  },
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (...values: Array<string | undefined | false | null>) => {
  return values.filter(Boolean).join(' ')
}

/** 判断 Object Like 的内部工具函数。 */
const isObjectLike = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object'
}

/** clone Value 的内部工具函数。 */
const cloneValue = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T
  }
  if (isObjectLike(value)) {
    const next: Record<string, any> = {}
    Object.keys(value).forEach(key => {
      next[key] = cloneValue((value as Record<string, any>)[key])
    })
    return next as T
  }
  return value
}

/** 转换为 Name Path Array 的内部工具函数。 */
const toNamePathArray = (name?: NamePath): NamePathSegment[] => {
  if (name == null) return []
  if (Array.isArray(name)) return [...name] as NamePathSegment[]
  return [name as NamePathSegment]
}

/** 读取 Path Key 的内部工具函数。 */
const getPathKey = (namePath: NamePathSegment[]) => {
  return namePath.map(segment => `${typeof segment}:${String(segment)}`).join('__rue_form_path__')
}

/** path Matches 的内部工具函数。 */
const pathMatches = (left: NamePathSegment[], right: NamePathSegment[]) => {
  if (left.length !== right.length) return false
  return left.every((segment, index) => segment === right[index])
}

/** path Starts With 的内部工具函数。 */
const _pathStartsWith = (namePath: NamePathSegment[], target: NamePathSegment[]) => {
  if (target.length > namePath.length) return false
  return target.every((segment, index) => segment === namePath[index])
}

/** 读取 Value At Path 的内部工具函数。 */
const getValueAtPath = (source: any, namePath: NamePathSegment[]) => {
  return namePath.reduce<any>((current, segment) => {
    if (current == null) return undefined
    return current[segment as keyof typeof current]
  }, source)
}

/** 判断是否存在 Value At Path 的内部工具函数。 */
const hasValueAtPath = (source: any, namePath: NamePathSegment[]) => {
  if (namePath.length === 0) return source !== undefined
  let current = source
  for (const segment of namePath) {
    if (current == null || !(segment in Object(current))) return false
    current = current[segment as keyof typeof current]
  }
  return true
}

/** 设置 Value At Path 的内部工具函数。 */
const setValueAtPath = (source: any, namePath: NamePathSegment[], value: any): any => {
  if (namePath.length === 0) return cloneValue(value)

  const [segment, ...rest] = namePath
  const current = source ?? (typeof segment === 'number' ? [] : {})
  const next = (Array.isArray(current) ? [...current] : { ...current }) as any
  next[segment] = rest.length === 0 ? cloneValue(value) : setValueAtPath(next[segment], rest, value)
  return next
}

/** delete Value At Path 的内部工具函数。 */
const deleteValueAtPath = (source: any, namePath: NamePathSegment[]): any => {
  if (namePath.length === 0) return undefined
  if (!isObjectLike(source) && !Array.isArray(source)) return source

  const [segment, ...rest] = namePath
  const next = (Array.isArray(source) ? [...source] : { ...source }) as any

  if (rest.length === 0) {
    if (Array.isArray(next) && typeof segment === 'number') {
      next.splice(segment, 1)
    } else {
      delete next[segment]
    }
    return next
  }

  next[segment] = deleteValueAtPath(next[segment], rest)
  return next
}

/** merge Values 的内部工具函数。 */
const mergeValues = (base: any, patch: any): any => {
  if (!isObjectLike(patch) && !Array.isArray(patch)) return cloneValue(patch)
  if (Array.isArray(patch)) return patch.map(item => cloneValue(item))

  const current = isObjectLike(base) ? { ...base } : {}
  Object.keys(patch).forEach(key => {
    current[key] = mergeValues(current[key], patch[key])
  })
  return current
}

/** 构建 Changed Values 的内部工具函数。 */
const buildChangedValues = (namePath: NamePathSegment[], value: any) => {
  return setValueAtPath({}, namePath, value)
}

/** 归一化 Trigger List 的内部工具函数。 */
const normalizeTriggerList = (trigger?: string | string[]) => {
  if (!trigger) return ['onChange']
  return Array.isArray(trigger) ? trigger : [trigger]
}

/** 判断 Renderable Node 的内部工具函数。 */
const isRenderableNode = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object'
}

/** patch Renderable Props 的内部工具函数。 */
const patchRenderableProps = (node: any, patch: Record<string, any>) => {
  if (!isRenderableNode(node) || !node.props || typeof node.props !== 'object') return node
  const originalProps = node.props as Record<string, any>
  const nextProps = {
    ...originalProps,
    ...patch,
  }
  nextProps.className = mergeClassName(originalProps.className, patch.className)
  nextProps.style = {
    ...originalProps.style,
    ...patch.style,
  }
  if (patch.children !== undefined) {
    nextProps.children = patch.children
  }
  node.props = nextProps
  return node
}

/** patch Control Node 的内部工具函数。 */
const _patchControlNode = (node: any, patch: Record<string, any>): any => {
  if (Array.isArray(node)) {
    let patched = false
    return node.map(child => {
      if (patched) return child
      const nextChild = _patchControlNode(child, patch)
      if (nextChild !== child) patched = true
      return nextChild
    })
  }

  if (!isRenderableNode(node)) return node

  if (node.type === 'fragment' && node.props && typeof node.props === 'object') {
    const nextChildren = _patchControlNode((node.props as Record<string, any>).children, patch)
    if (nextChildren === (node.props as Record<string, any>).children) return node
    return patchRenderableProps(node, { children: nextChildren })
  }

  return patchRenderableProps(node, patch)
}

/** inject Form Context 的内部工具函数。 */
const _injectFormContext = (
  value: unknown,
  formContext: FormContextValue,
  pathPrefix: NamePathSegment[],
): unknown => {
  if (typeof value === 'function' && (value as { kind?: unknown }).kind === 'block-factory') {
    return _injectFormContext((value as () => unknown)(), formContext, pathPrefix)
  }

  if (Array.isArray(value)) {
    return value.map(child => _injectFormContext(child, formContext, pathPrefix))
  }
  if (!isRenderableNode(value)) {
    return value
  }

  const props = value.props
  if (!props || typeof props !== 'object') {
    return value
  }

  const nextProps = {
    ...(props as Record<string, unknown>),
  }

  const type = value[RUE_COMPONENT_TYPE_KEY] ?? value.type
  if (type === FormItem || type === FormList) {
    nextProps[FORM_CONTEXT_PROP] = formContext
    nextProps[FORM_PATH_PROP] = pathPrefix
    value.props = nextProps
    return value
  }

  if ((typeof type === 'string' || type === 'fragment') && 'children' in nextProps) {
    nextProps.children = _injectFormContext(nextProps.children, formContext, pathPrefix)
    value.props = nextProps
    return value
  }

  return value
}

/** 解析 Default Slot Children 的内部工具函数。 */
const resolveDefaultSlotChildren = (source: Record<string, unknown>, fallback: any) => {
  const slots = source[RUE_SLOT_KEY]
  if (slots && typeof slots === 'object' && 'default' in (slots as Record<string, unknown>)) {
    const defaultSlot = (slots as Record<string, unknown>).default
    if (typeof defaultSlot === 'function') {
      return defaultSlot()
    }
    return defaultSlot
  }
  if ('children' in source) {
    return source.children
  }
  return fallback
}

/** materialize Slot Children 的内部工具函数。 */
const materializeSlotChildren = (children: any): any => {
  if (typeof children === 'function' && (children as { kind?: unknown }).kind === 'block-factory') {
    return children()
  }
  return children
}

/** 判断是否存在 Default Slot 的内部工具函数。 */
const hasDefaultSlot = (source: Record<string, unknown>) => {
  const slots = source[RUE_SLOT_KEY]
  return !!(slots && typeof slots === 'object' && 'default' in (slots as Record<string, unknown>))
}

/** patch Default Slot Source 的内部工具函数。 */
const patchDefaultSlotSource = (
  source: Record<string, unknown>,
  transform: (children: any) => any,
) => {
  const slots = source[RUE_SLOT_KEY]
  if (!slots || typeof slots !== 'object' || !('default' in (slots as Record<string, unknown>))) {
    return source
  }

  const slotRecord = slots as Record<string, unknown>
  const originalDefault = slotRecord[FORM_ORIGINAL_SLOT_PROP] ?? slotRecord.default
  slotRecord[FORM_ORIGINAL_SLOT_PROP] = originalDefault
  slotRecord.default = (...args: any[]) =>
    transform(
      typeof originalDefault === 'function'
        ? (originalDefault as (...args: any[]) => any)(...args)
        : originalDefault,
    )
  return source
}

/** render Transformed Children 的内部工具函数。 */
const _renderTransformedChildren = (
  source: Record<string, unknown>,
  fallback: any,
  transform: (children: any) => any,
) => {
  if (hasDefaultSlot(source)) {
    return (
      <Slot
        source={patchDefaultSlotSource(source, children =>
          transform(materializeSlotChildren(children)),
        )}
      />
    )
  }

  return transform(materializeSlotChildren(resolveDefaultSlotChildren(source, fallback)))
}

/** 读取 Rule Length Type 的内部工具函数。 */
const getRuleLengthType = (value: any, type?: FormRuleType) => {
  if (type === 'number') return 'number'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return 'number'
  return 'string'
}

/** 读取 Rule Length Value 的内部工具函数。 */
const getRuleLengthValue = (value: any, type?: FormRuleType) => {
  const lengthType = getRuleLengthType(value, type)
  if (lengthType === 'array') return Array.isArray(value) ? value.length : 0
  if (lengthType === 'number') return Number(value)
  if (value == null) return 0
  return String(value).length
}

/** 判断 Empty Value 的内部工具函数。 */
const isEmptyValue = (value: any, type?: FormRuleType) => {
  if (value == null) return true
  if (type === 'array') return !Array.isArray(value) || value.length === 0
  if (typeof value === 'string') return value === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** 判断 Valid Url 的内部工具函数。 */
const isValidUrl = (value: string) => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/** 读取 Type Valid 的内部工具函数。 */
const getTypeValid = (value: any, type?: FormRuleType) => {
  if (!type) return true
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case 'url':
      return typeof value === 'string' && isValidUrl(value)
    default:
      return true
  }
}

/** extract Rule Message 的内部工具函数。 */
const extractRuleMessage = (
  rule: FormRule,
  value: any,
  label: string,
  messages: FormValidateMessages,
  fallbackType?: 'required' | 'whitespace' | 'pattern' | 'type' | 'len' | 'min' | 'max',
) => {
  if (rule.message) return rule.message

  if (fallbackType === 'required') {
    return messages.required ?? defaultValidateMessages.required ?? '${label} 为必填项'
  }

  if (fallbackType === 'whitespace') {
    return messages.whitespace ?? defaultValidateMessages.whitespace ?? '${label} 不能为空'
  }

  if (fallbackType === 'pattern') {
    return messages.pattern ?? defaultValidateMessages.pattern ?? '${label} 格式不正确'
  }

  if (fallbackType === 'type') {
    return (
      messages.types?.[rule.type ?? 'string'] ??
      defaultValidateMessages.types?.[rule.type ?? 'string'] ??
      '${label} 类型不正确'
    )
  }

  const lengthType = getRuleLengthType(value, rule.type)
  const source = messages[lengthType] ?? defaultValidateMessages[lengthType] ?? {}
  return source[fallbackType ?? 'len'] ?? '${label} 校验失败'
}

/** format Message 的内部工具函数。 */
const formatMessage = (
  template: string,
  variables: Record<string, string | number | undefined>,
) => {
  return template.replace(/\$\{(.*?)\}/g, (_, key) => {
    const trimmedKey = String(key).trim()
    return variables[trimmedKey] == null ? '' : String(variables[trimmedKey])
  })
}

/** 读取 Label Text 的内部工具函数。 */
const getLabelText = (label: any, namePath: NamePathSegment[]) => {
  if (typeof label === 'string' || typeof label === 'number') return String(label)
  const last = namePath[namePath.length - 1]
  return last == null ? '字段' : String(last)
}

/** 解析 Item Required 的内部工具函数。 */
const resolveItemRequired = (required: boolean | undefined, rules: FormRule[] | undefined) => {
  if (required !== undefined) return required
  return !!rules?.some(rule => rule.required && !rule.warningOnly)
}

/** run Rules 的内部工具函数。 */
const runRules = async (
  namePath: NamePathSegment[],
  value: any,
  rules: FormRule[],
  values: any,
  label: any,
  messageVariables: Record<string, string> | undefined,
  messages: FormValidateMessages,
) => {
  const errors: string[] = []
  const warnings: string[] = []
  const labelText = getLabelText(messageVariables?.label ?? label, namePath)

  for (const rule of rules) {
    const nextValue = typeof rule.transform === 'function' ? rule.transform(value) : value
    let nextMessage: string | null = null

    if (rule.required && isEmptyValue(nextValue, rule.type)) {
      nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'required')
    } else if (rule.whitespace && typeof nextValue === 'string' && nextValue.trim() === '') {
      nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'whitespace')
    } else if (
      !isEmptyValue(nextValue, rule.type) &&
      rule.type &&
      !getTypeValid(nextValue, rule.type)
    ) {
      nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'type')
    } else if (
      !isEmptyValue(nextValue, rule.type) &&
      rule.pattern &&
      !rule.pattern.test(String(nextValue))
    ) {
      nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'pattern')
    } else if (!isEmptyValue(nextValue, rule.type) && rule.len !== undefined) {
      const length = getRuleLengthValue(nextValue, rule.type)
      if (length !== rule.len) {
        nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'len')
      }
    } else if (!isEmptyValue(nextValue, rule.type) && rule.min !== undefined) {
      const length = getRuleLengthValue(nextValue, rule.type)
      if (length < rule.min) {
        nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'min')
      }
    } else if (!isEmptyValue(nextValue, rule.type) && rule.max !== undefined) {
      const length = getRuleLengthValue(nextValue, rule.type)
      if (length > rule.max) {
        nextMessage = extractRuleMessage(rule, nextValue, labelText, messages, 'max')
      }
    }

    if (!nextMessage && typeof rule.validator === 'function') {
      try {
        const validatorResult = await rule.validator(rule, nextValue, values)
        if (typeof validatorResult === 'string' && validatorResult.trim()) {
          nextMessage = validatorResult
        }
      } catch (error) {
        nextMessage = error instanceof Error ? error.message : String(error)
      }
    }

    if (!nextMessage) continue

    const message = formatMessage(nextMessage, {
      label: labelText,
      name: labelText,
      min: rule.min,
      max: rule.max,
      len: rule.len,
      ...messageVariables,
    })

    if (rule.warningOnly) warnings.push(message)
    else errors.push(message)
  }

  return { errors, warnings }
}

/** resolve Size Class 的内部工具函数。 */
const _resolveSizeClass = (size?: FormSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** 读取 Default Value From Event 的内部工具函数。 */
const getDefaultValueFromEvent = (valuePropName: string, ...args: any[]) => {
  const [first, second] = args

  if (valuePropName === 'checked') {
    if (isObjectLike(second) && typeof second.checked === 'boolean') {
      return second.checked
    }
    if (
      isObjectLike(first) &&
      isObjectLike(first.target) &&
      typeof first.target.checked === 'boolean'
    ) {
      return first.target.checked
    }
    if (typeof first === 'boolean') return first
    return !!first
  }

  if (args.length > 1 && first !== undefined && !(isObjectLike(first) && 'target' in first)) {
    return first
  }

  if (isObjectLike(first) && isObjectLike(first.target)) {
    const target = first.target as Record<string, any>
    if (valuePropName in target) return target[valuePropName]
    if ('value' in target) return target.value
  }

  return first
}

/** 读取 Feedback Icon 的内部工具函数。 */
const getFeedbackIcon = (status: ValidateStatus | undefined) => {
  if (!status) return null
  if (status === 'error') return <span className="text-error">!</span>
  if (status === 'warning') return <span className="text-warning">!</span>
  if (status === 'success') return <span className="text-success">✓</span>
  return <span className="loading loading-spinner loading-xs text-primary" />
}

/** 解析 Col Width 的内部工具函数。 */
const resolveColWidth = (config?: FormColConfig) => {
  if (!config?.span) return undefined
  return `${(config.span / 24) * 100}%`
}

/** should Keep Field 的内部工具函数。 */
const shouldKeepField = (entity: RegisteredFieldEntity, formPreserve?: boolean) => {
  if (entity.getPreserve() !== undefined) return entity.getPreserve() !== false
  return formPreserve !== false
}

/** 创建 Form Instance 的内部工具函数。 */
const createFormInstance = (): InternalFormInstance => {
  const version = ref(0)
  const fields = new Map<string, RegisteredFieldEntity>()
  const fieldRegistrationKeys = new Map<string, string>()
  const fieldMeta = new Map<string, InternalFieldMeta>()
  const subscribers = new Set<() => void>()
  let notifyQueued = false
  let values: Record<string, any> = {}
  let initialValues: Record<string, any> = {}
  let initialized = false
  let rootElement: HTMLElement | null = null
  let runtimeOptions: FormRuntimeOptions = {
    validateTrigger: ['onChange'],
    validateMessages: defaultValidateMessages,
  }

  const notify = () => {
    version.value += 1
    subscribers.forEach(subscriber => subscriber())
  }

  const scheduleNotify = () => {
    if (notifyQueued) return
    notifyQueued = true
    queueMicrotask(() => {
      notifyQueued = false
      notify()
    })
  }

  const getMeta = (namePath: NamePathSegment[]) => {
    const pathKey = getPathKey(namePath)
    const current = fieldMeta.get(pathKey)
    if (current) return current
    const next = {
      touched: false,
      validating: false,
      errors: [],
      warnings: [],
    }
    fieldMeta.set(pathKey, next)
    return next
  }

  const getEntityRegistrationKey = (entity: RegisteredFieldEntity) => {
    const namePath = entity.getNamePath()
    return namePath && namePath.length ? `${entity.kind}:${getPathKey(namePath)}` : entity.id
  }

  const buildFieldData = (namePath: NamePathSegment[]): FieldData => {
    const meta = getMeta(namePath)
    return {
      name: [...namePath],
      errors: [...meta.errors],
      warnings: [...meta.warnings],
      touched: meta.touched,
      validating: meta.validating,
      value: cloneValue(getValueAtPath(values, namePath)),
    }
  }

  const emitFieldsChange = (namePath: NamePathSegment[]) => {
    runtimeOptions.onFieldsChange?.([buildFieldData(namePath)], internal.getFieldsValue(true))
  }

  const updateMeta = (
    namePath: NamePathSegment[],
    patch: Partial<InternalFieldMeta>,
    shouldNotify = true,
  ) => {
    const meta = getMeta(namePath)
    Object.assign(meta, patch)
    if (shouldNotify) {
      emitFieldsChange(namePath)
      notify()
      scheduleNotify()
    }
  }

  const getEntityByPath = (namePath: NamePathSegment[]) => {
    for (const entity of fields.values()) {
      const entityPath = entity.getNamePath()
      if (entityPath && pathMatches(entityPath, namePath)) return entity
    }
    return null
  }

  const validateEntity = async (entity: RegisteredFieldEntity, triggerName?: string) => {
    const namePath = entity.getNamePath()
    if (!namePath || namePath.length === 0) return null

    const validateTriggers = entity.getValidateTrigger()
    if (triggerName && validateTriggers.length > 0 && !validateTriggers.includes(triggerName)) {
      return null
    }

    const rules = entity.getRules()
    if (!rules.length) {
      updateMeta(namePath, { errors: [], warnings: [], validating: false })
      return null
    }

    updateMeta(namePath, { validating: true })
    const value = getValueAtPath(values, namePath)
    const result = await runRules(
      namePath,
      value,
      rules,
      values,
      entity.getLabel(),
      entity.getMessageVariables(),
      runtimeOptions.validateMessages,
    )
    updateMeta(namePath, {
      validating: false,
      errors: result.errors,
      warnings: result.warnings,
    })

    if (!result.errors.length && !result.warnings.length) return null
    return {
      name: [...namePath],
      errors: [...result.errors],
      warnings: [...result.warnings],
    }
  }

  const validateDependents = async (changedPath: NamePathSegment[]) => {
    const entities = Array.from(fields.values())
    for (const entity of entities) {
      const namePath = entity.getNamePath()
      if (!namePath || pathMatches(namePath, changedPath)) continue
      const dependencies = entity.getDependencies()
      if (!dependencies.some(dependency => pathMatches(dependency, changedPath))) continue
      await validateEntity(entity)
    }
  }

  const setFieldValueInternal = async (
    namePath: NamePathSegment[],
    value: any,
    info?: { touch?: boolean; triggerName?: string; emitValues?: boolean },
  ) => {
    values = setValueAtPath(values, namePath, value)
    if (info?.touch) {
      const meta = getMeta(namePath)
      meta.touched = true
    }
    notify()
    emitFieldsChange(namePath)

    if (info?.emitValues !== false) {
      runtimeOptions.onValuesChange?.(
        buildChangedValues(namePath, value),
        internal.getFieldsValue(true),
      )
    }

    const entity = getEntityByPath(namePath)
    if (entity) {
      await validateEntity(entity, info?.triggerName)
    }
    await validateDependents(namePath)
    scheduleNotify()
  }

  const registerField = (entity: RegisteredFieldEntity) => {
    const registrationKey = getEntityRegistrationKey(entity)
    const previousEntityId = fieldRegistrationKeys.get(registrationKey)
    if (previousEntityId && previousEntityId !== entity.id) {
      fields.delete(previousEntityId)
    }
    fields.set(entity.id, entity)
    fieldRegistrationKeys.set(registrationKey, entity.id)

    const namePath = entity.getNamePath()
    if (namePath && namePath.length) {
      const initialValue = entity.getInitialValue()
      if (!hasValueAtPath(initialValues, namePath) && initialValue !== undefined) {
        initialValues = setValueAtPath(initialValues, namePath, initialValue)
      }
      if (!hasValueAtPath(values, namePath) && initialValue !== undefined) {
        values = setValueAtPath(values, namePath, initialValue)
      }
      getMeta(namePath)
    }

    return () => {
      const isActiveEntity = fieldRegistrationKeys.get(registrationKey) === entity.id
      fields.delete(entity.id)
      if (!isActiveEntity) return
      fieldRegistrationKeys.delete(registrationKey)

      const entityPath = entity.getNamePath()
      if (!entityPath || !entityPath.length) return
      if (!shouldKeepField(entity, runtimeOptions.preserve)) {
        values = deleteValueAtPath(values, entityPath)
        fieldMeta.delete(getPathKey(entityPath))
        notify()
      }
    }
  }

  const ensureInitialized = (nextValues?: Record<string, any>) => {
    if (initialized) return false
    initialValues = cloneValue(nextValues ?? {})
    values = cloneValue(nextValues ?? {})
    initialized = true
    return true
  }

  const validateFields = async (nameList?: NamePath[]) => {
    const names = nameList?.map(name => toNamePathArray(name))
    const errorFields: FieldError[] = []
    const entities = Array.from(fields.values())
    const validatedKeys = new Set<string>()

    for (const entity of entities) {
      const registrationKey = getEntityRegistrationKey(entity)
      if (validatedKeys.has(registrationKey)) continue
      validatedKeys.add(registrationKey)

      const entityPath = entity.getNamePath()
      if (!entityPath || !entityPath.length) continue
      if (names && !names.some(namePath => pathMatches(entityPath, namePath))) continue
      const result = await validateEntity(entity)
      if (result && result.errors.length > 0) {
        errorFields.push(result)
      }
    }

    if (errorFields.length > 0) {
      throw {
        values: internal.getFieldsValue(true),
        errorFields,
        outOfDate: false,
      } satisfies FormFinishFailedInfo
    }

    return internal.getFieldsValue(true)
  }

  const scrollToField = (name: NamePath, options?: ScrollIntoViewOptions & { focus?: boolean }) => {
    const namePath = toNamePathArray(name)
    const formName = runtimeOptions.name?.trim()
    const fieldId = namePath.map(segment => String(segment)).join('__')
    const ids = formName ? [`${formName}__${fieldId}`, fieldId] : [fieldId]
    const target =
      ids
        .map(id => rootElement?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null)
        .find(Boolean) ??
      ids
        .map(id =>
          typeof document === 'undefined'
            ? null
            : (document.getElementById(id) as HTMLElement | null),
        )
        .find(Boolean)
    if (!target) return
    target.scrollIntoView(options)
    if (options?.focus && 'focus' in target && typeof target.focus === 'function') {
      target.focus()
    }
  }

  const internal = {
    getFieldValue(name: NamePath) {
      void version.value
      return cloneValue(getValueAtPath(values, toNamePathArray(name)))
    },
    getFieldsValue(nameList?: true | NamePath[]) {
      void version.value
      if (nameList === true || nameList == null) {
        return cloneValue(values)
      }

      return nameList.reduce<Record<string, any>>((result, name) => {
        const namePath = toNamePathArray(name)
        return setValueAtPath(result, namePath, getValueAtPath(values, namePath))
      }, {})
    },
    setFieldValue(name: NamePath, value: any) {
      void setFieldValueInternal(toNamePathArray(name), value, { emitValues: false })
    },
    setFieldsValue(nextValues: Record<string, any>) {
      values = mergeValues(values, nextValues)
      notify()
    },
    resetFields(nameList?: NamePath[]) {
      if (!nameList?.length) {
        values = cloneValue(initialValues)
        fieldMeta.forEach(meta => {
          meta.touched = false
          meta.validating = false
          meta.errors = []
          meta.warnings = []
        })
        notify()
        return
      }

      nameList.forEach(name => {
        const namePath = toNamePathArray(name)
        const initialValue = getValueAtPath(initialValues, namePath)
        values =
          initialValue === undefined
            ? deleteValueAtPath(values, namePath)
            : setValueAtPath(values, namePath, initialValue)
        const meta = getMeta(namePath)
        meta.touched = false
        meta.validating = false
        meta.errors = []
        meta.warnings = []
      })
      notify()
    },
    validateFields,
    submit() {
      void validateFields()
        .then(submitValues => {
          runtimeOptions.onFinish?.(submitValues)
        })
        .catch((info: FormFinishFailedInfo) => {
          runtimeOptions.onFinishFailed?.(info)
          if (runtimeOptions.scrollToFirstError && info.errorFields[0]) {
            const options =
              runtimeOptions.scrollToFirstError === true
                ? ({ block: 'center' } as ScrollIntoViewOptions & { focus?: boolean })
                : runtimeOptions.scrollToFirstError
            scrollToField(info.errorFields[0].name, options)
          }
        })
    },
    scrollToField,
    isFieldTouched(name: NamePath) {
      return getMeta(toNamePathArray(name)).touched
    },
    getFieldError(name: NamePath) {
      return [...getMeta(toNamePathArray(name)).errors]
    },
    getFieldsError(nameList?: NamePath[]) {
      if (!nameList?.length) {
        const seenKeys = new Set<string>()
        return Array.from(fields.values())
          .filter(entity => {
            const registrationKey = getEntityRegistrationKey(entity)
            if (seenKeys.has(registrationKey)) return false
            seenKeys.add(registrationKey)
            return true
          })
          .map(entity => entity.getNamePath())
          .filter((path): path is NamePathSegment[] => !!path && path.length > 0)
          .map(path => {
            const meta = getMeta(path)
            return {
              name: [...path],
              errors: [...meta.errors],
              warnings: [...meta.warnings],
            }
          })
      }

      return nameList.map(name => {
        const namePath = toNamePathArray(name)
        const meta = getMeta(namePath)
        return {
          name: [...namePath],
          errors: [...meta.errors],
          warnings: [...meta.warnings],
        }
      })
    },
    __INTERNAL__: {
      version,
      setRuntimeOptions(options: FormRuntimeOptions) {
        runtimeOptions = options
      },
      ensureInitialized,
      registerField,
      getMeta,
      validateFieldByPath(namePath: NamePathSegment[], triggerName?: string) {
        const entity = getEntityByPath(namePath)
        if (!entity) return Promise.resolve(null)
        return validateEntity(entity, triggerName)
      },
      updateValueFromControl(
        namePath: NamePathSegment[],
        value: any,
        info: { touch?: boolean; triggerName?: string },
      ) {
        return setFieldValueInternal(namePath, value, {
          touch: info.touch,
          triggerName: info.triggerName,
        })
      },
      updateListValue(namePath: NamePathSegment[], nextValue: any[]) {
        return setFieldValueInternal(namePath, nextValue, {
          touch: true,
          emitValues: false,
        })
      },
      getDefaultValidateTrigger() {
        return runtimeOptions.validateTrigger
      },
      setRootElement(element: HTMLElement | null) {
        rootElement = element
      },
      subscribe(subscriber: () => void) {
        subscribers.add(subscriber)
        return () => {
          subscribers.delete(subscriber)
        }
      },
      emitUpdate() {
        notify()
      },
    },
  } as InternalFormInstance

  return internal
}

/** 渲染 Required Mark 的内部工具函数。 */
const renderRequiredMark = (label: any, required: boolean, requiredMark: FormRequiredMark) => {
  if (typeof requiredMark === 'function') {
    return requiredMark(label, { required })
  }

  if (requiredMark === 'optional' && !required) {
    return (
      <span className="ml-2 text-xs text-base-content/45" aria-hidden="true">
        optional
      </span>
    )
  }

  if (requiredMark !== false && required) {
    return (
      <span className="ml-1 text-error" aria-hidden="true">
        *
      </span>
    )
  }

  return null
}

/** Error List 的内部工具函数。 */
const ErrorList: FC<FormErrorListProps> = ({ errors, warnings, className, style }) => {
  const list = [...(errors ?? []), ...(warnings ?? [])].filter(item => item != null)
  if (!list.length) return null

  return (
    <ul
      className={mergeClassName('mt-3 grid gap-1.5 text-[0.8rem] leading-6', className)}
      style={style}
    >
      {(errors ?? []).map((message, index) => (
        <li key={`error-${index}`} className="text-error">
          {message}
        </li>
      ))}
      {(warnings ?? []).map((message, index) => (
        <li key={`warning-${index}`} className="text-warning">
          {message}
        </li>
      ))}
    </ul>
  )
}

/** Form Item 的内部工具函数。 */
const FormItem: FC<FormItemProps> = props => {
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children: props.children,
  }) as Record<string, unknown>
  const formInstance = props.form as InternalFormInstance | undefined
  const entityIdRef = useRef<string>()
  const unregisterRef = useRef<(() => void) | null>(null)
  const subscriptionFormRef = useRef<InternalFormInstance | undefined>(undefined)
  const unsubscribeRenderRef = useRef<(() => void) | null>(null)
  const [renderVersion, setRenderVersion] = useState(0, { kind: 'ref' })
  const renderCacheRef = useRef<any>()
  const previousValuesRef = useRef<any>()
  const lastRegisteredKeyRef = useRef<string>()
  const latestPropsRef = useRef<FormItemProps>(props)
  const noStyleHostRef = useRef<HTMLElement | null>(null)
  const controlHostRef = useRef<HTMLElement | null>(null)
  const helpHostRef = useRef<HTMLElement | null>(null)
  const feedbackHostRef = useRef<HTMLElement | null>(null)
  latestPropsRef.current = props

  if (!entityIdRef.current) {
    entityIdRef.current = `rue-form-item-${formEntitySeed++}`
  }

  if (props.name != null && !formInstance) {
    throw new Error('Form.Item 绑定字段时需要显式传入 form')
  }

  const namePath = props.name == null ? undefined : toNamePathArray(props.name)
  const nameKey = namePath ? getPathKey(namePath) : undefined
  const layout = props.layout ?? 'horizontal'
  const required = resolveItemRequired(props.required, props.rules)
  const labelAlign = props.labelAlign ?? 'right'
  const labelWrap = false
  const labelCol = props.labelCol
  const wrapperCol = props.wrapperCol
  const controlId =
    props.htmlFor ?? (namePath ? namePath.map(segment => String(segment)).join('__') : undefined)

  if (namePath && formInstance && lastRegisteredKeyRef.current !== nameKey) {
    const latestProps = latestPropsRef.current ?? props
    unregisterRef.current?.()
    unregisterRef.current = formInstance.__INTERNAL__.registerField({
      id: entityIdRef.current,
      kind: 'item',
      getNamePath: () => namePath,
      getRules: () => latestProps.rules ?? [],
      getRequired: () => latestProps.required,
      getLabel: () => latestProps.label,
      getMessageVariables: () => latestProps.messageVariables,
      getValidateTrigger: () => normalizeTriggerList(latestProps.validateTrigger),
      getDependencies: () =>
        (latestProps.dependencies ?? []).map(dependency => toNamePathArray(dependency)),
      getInitialValue: () => latestProps.initialValue,
      getPreserve: () => latestProps.preserve,
    })
    lastRegisteredKeyRef.current = nameKey
  }

  const getRenderState = () => {
    const allValues = formInstance?.getFieldsValue(true) ?? {}
    const meta = namePath && formInstance ? formInstance.__INTERNAL__.getMeta(namePath) : null
    const currentValue = namePath && formInstance ? formInstance.getFieldValue(namePath) : undefined
    const triggerName = props.trigger ?? 'onChange'
    const validateTrigger = normalizeTriggerList(props.validateTrigger)
    const status =
      props.validateStatus ??
      (meta?.validating
        ? 'validating'
        : meta?.errors.length
          ? 'error'
          : meta?.warnings.length
            ? 'warning'
            : meta?.touched && (props.rules?.length ?? 0) > 0
              ? 'success'
              : undefined)
    return {
      allValues,
      meta,
      currentValue,
      triggerName,
      validateTrigger,
      status,
    }
  }

  const renderManagedContent = () => {
    const { allValues, meta, currentValue, triggerName, validateTrigger, status } = getRenderState()
    const renderField = props.render ?? props.children
    let controlNode: any

    if (
      typeof renderField === 'function' &&
      (renderField as { kind?: unknown }).kind !== 'block-factory' &&
      namePath &&
      formInstance &&
      !props.shouldUpdate
    ) {
      const injectedValueProps = props.getValueProps
        ? props.getValueProps(currentValue)
        : {
            [props.valuePropName ?? 'value']:
              props.valuePropName === 'checked' ? !!currentValue : currentValue,
          }

      const controlProps: Record<string, any> = {
        ...injectedValueProps,
        id: controlId,
      }

      controlProps[triggerName] = (...args: any[]) => {
        const rawValue = props.getValueFromEvent
          ? props.getValueFromEvent(...args)
          : getDefaultValueFromEvent(props.valuePropName ?? 'value', ...args)
        const nextValue = props.normalize
          ? props.normalize(rawValue, currentValue, formInstance.getFieldsValue(true))
          : rawValue

        void formInstance.__INTERNAL__.updateValueFromControl(namePath, nextValue, {
          touch: true,
          triggerName,
        })
      }

      validateTrigger
        .filter(eventName => eventName !== triggerName)
        .forEach(eventName => {
          controlProps[eventName] = (..._args: any[]) => {
            void formInstance.__INTERNAL__.validateFieldByPath(namePath, eventName)
          }
        })

      controlNode = renderField(
        controlProps,
        {
          value: currentValue,
          touched: meta?.touched ?? false,
          validating: meta?.validating ?? false,
          errors: meta?.errors ?? [],
          warnings: meta?.warnings ?? [],
          status,
        },
        formInstance,
      )
    } else if (
      typeof renderField === 'function' &&
      (renderField as { kind?: unknown }).kind !== 'block-factory' &&
      (!namePath || props.shouldUpdate)
    ) {
      const shouldRender =
        typeof props.shouldUpdate === 'function'
          ? props.shouldUpdate(previousValuesRef.current ?? allValues, allValues)
          : props.shouldUpdate === true || renderCacheRef.current === undefined

      if (shouldRender || renderCacheRef.current === undefined) {
        renderCacheRef.current = renderField(allValues, formInstance)
      }
      previousValuesRef.current = cloneValue(allValues)
      controlNode = renderCacheRef.current
    } else {
      controlNode = <Slot source={slotSource} />
    }

    if (props.noStyle) {
      if (noStyleHostRef.current) {
        renderRue(<>{controlNode}</>, noStyleHostRef.current)
      }
      return
    }

    if (controlHostRef.current) {
      renderRue(<>{controlNode}</>, controlHostRef.current)
    }

    if (helpHostRef.current) {
      renderRue(
        props.help !== undefined ? (
          <>{props.help}</>
        ) : meta && (meta.errors.length > 0 || meta.warnings.length > 0) ? (
          <ul className="mt-2 grid gap-1 text-xs">
            {meta.errors.map((message, index) => (
              <li key={`error-${index}`} className="text-error">
                {message}
              </li>
            ))}
            {meta.warnings.map((message, index) => (
              <li key={`warning-${index}`} className="text-warning">
                {message}
              </li>
            ))}
          </ul>
        ) : (
          <></>
        ),
        helpHostRef.current,
      )
    }

    if (feedbackHostRef.current) {
      renderRue(props.hasFeedback ? <>{getFeedbackIcon(status)}</> : <></>, feedbackHostRef.current)
    }
  }

  const assignControlHost = (element: HTMLElement | null) => {
    controlHostRef.current = element
    if (element) {
      queueMicrotask(() => {
        renderManagedContent()
      })
    }
  }

  if (subscriptionFormRef.current !== formInstance) {
    unsubscribeRenderRef.current?.()
    subscriptionFormRef.current = formInstance
    unsubscribeRenderRef.current = formInstance
      ? formInstance.__INTERNAL__.subscribe(() => {
          setRenderVersion(renderVersion.value + 1)
        })
      : null
  }

  watch(
    () => renderVersion.value,
    () => {
      renderManagedContent()
    },
    { immediate: true },
  )

  onCleanup(() => {
    unregisterRef.current?.()
    unregisterRef.current = null
    unsubscribeRenderRef.current?.()
    unsubscribeRenderRef.current = null
    subscriptionFormRef.current = undefined
  })

  onMounted(() => {
    renderManagedContent()
  })

  onUpdated(() => {
    renderManagedContent()
  })

  if (props.noStyle) {
    return <div ref={noStyleHostRef} style={{ display: 'contents' }} />
  }

  const labelNode =
    props.label !== undefined ? (
      <label
        className={mergeClassName(
          'text-[0.95rem] leading-7 font-medium text-base-content/78',
          labelAlign === 'left' ? 'text-left' : 'text-right md:text-right',
          labelWrap ? 'whitespace-normal' : 'md:whitespace-nowrap',
        )}
        style={{ width: layout === 'horizontal' ? resolveColWidth(labelCol) : undefined }}
        for={controlId}
      >
        <span>{props.label}</span>
        {layout === 'horizontal' && props.colon !== false ? (
          <span className="ml-1 text-base-content/45">:</span>
        ) : null}
        {renderRequiredMark(props.label, required, true)}
      </label>
    ) : null

  const wrapperStyle =
    layout === 'horizontal' && wrapperCol?.offset
      ? {
          marginLeft: `${(wrapperCol.offset / 24) * 100}%`,
          width: resolveColWidth(wrapperCol),
        }
      : layout === 'horizontal'
        ? { width: resolveColWidth(wrapperCol) }
        : undefined

  return (
    <div
      className={mergeClassName(
        'rue-form-item',
        props.hidden ? 'hidden' : undefined,
        layout === 'horizontal' ? 'flex flex-col gap-3 md:flex-row md:items-start' : 'grid gap-3',
        props.className,
      )}
      style={props.style}
    >
      {labelNode}
      <div className="min-w-0 flex-1" style={wrapperStyle}>
        <div className="flex items-start gap-3">
          <div
            key={nameKey ?? '__rue_form_item_control__'}
            className="min-w-0 flex-1"
            ref={assignControlHost}
          />
          {props.hasFeedback ? <span className="mt-3 shrink-0" ref={feedbackHostRef} /> : null}
        </div>

        <div className="mt-3" ref={helpHostRef} />

        {props.extra != null ? (
          <div className="mt-3 text-[0.8rem] leading-6 text-base-content/55">{props.extra}</div>
        ) : null}
      </div>
    </div>
  )
}

/** Form List 的内部工具函数。 */
const FormList: FC<FormListProps> = props => {
  const { form, name, children, render, initialValue, rules } = props
  const formInstance = form as InternalFormInstance | undefined
  if (!formInstance) {
    throw new Error('Form.List 需要显式传入 form')
  }

  const renderList = render ?? children
  if (typeof renderList !== 'function') {
    throw new Error('Form.List 需要通过 render 提供列表内容')
  }

  const namePath = toNamePathArray(name)
  const entityIdRef = useRef<string>()
  const unregisterRef = useRef<(() => void) | null>(null)
  const subscriptionFormRef = useRef<InternalFormInstance | undefined>(undefined)
  const unsubscribeRenderRef = useRef<(() => void) | null>(null)
  const [renderVersion, setRenderVersion] = useState(0, { kind: 'ref' })
  const latestRulesRef = useRef<FormRule[] | undefined>(rules)
  const latestInitialValueRef = useRef<any[]>(initialValue)
  const keyListRef = useRef<number[]>([])
  const nextKeyRef = useRef(0)
  latestRulesRef.current = rules
  latestInitialValueRef.current = initialValue

  if (!entityIdRef.current) {
    entityIdRef.current = `rue-form-list-${formEntitySeed++}`
  }

  if (!unregisterRef.current) {
    unregisterRef.current = formInstance.__INTERNAL__.registerField({
      id: entityIdRef.current,
      kind: 'list',
      getNamePath: () => namePath,
      getRules: () => latestRulesRef.current ?? [],
      getRequired: () => undefined,
      getLabel: () => namePath[namePath.length - 1],
      getMessageVariables: () => undefined,
      getValidateTrigger: () => ['onChange'],
      getDependencies: () => [],
      getInitialValue: () => latestInitialValueRef.current,
      getPreserve: () => true,
    })
  }

  if (subscriptionFormRef.current !== formInstance) {
    unsubscribeRenderRef.current?.()
    subscriptionFormRef.current = formInstance
    unsubscribeRenderRef.current = formInstance.__INTERNAL__.subscribe(() => {
      setRenderVersion(renderVersion.value + 1)
    })
  }

  onCleanup(() => {
    unregisterRef.current?.()
    unregisterRef.current = null
    unsubscribeRenderRef.current?.()
    unsubscribeRenderRef.current = null
    subscriptionFormRef.current = undefined
  })

  return (() => {
    void renderVersion.value

    const listValue = formInstance.getFieldValue(namePath)
    const normalizedList = Array.isArray(listValue) ? listValue : []
    const meta = formInstance.__INTERNAL__.getMeta(namePath)
    const keyList = keyListRef.current ?? []
    const nextKey = nextKeyRef.current ?? 0

    if (keyListRef.current == null) {
      keyListRef.current = keyList
    }
    if (nextKeyRef.current == null) {
      nextKeyRef.current = nextKey
    }
    const takeNextKey = () => {
      const currentKey = nextKeyRef.current ?? 0
      nextKeyRef.current = currentKey + 1
      return currentKey
    }

    if (keyList.length < normalizedList.length) {
      while (keyList.length < normalizedList.length) {
        keyList.push(takeNextKey())
      }
    }
    if (keyList.length > normalizedList.length) {
      keyListRef.current = keyList.slice(0, normalizedList.length)
    }

    const operations: FormListOperation = {
      add(defaultValue, insertIndex) {
        const nextItems = [...normalizedList]
        const index =
          insertIndex == null
            ? nextItems.length
            : Math.max(0, Math.min(insertIndex, nextItems.length))
        nextItems.splice(index, 0, defaultValue ?? null)
        keyList.splice(index, 0, takeNextKey())
        void formInstance.__INTERNAL__.updateListValue(namePath, nextItems)
      },
      remove(index) {
        const indexes = (Array.isArray(index) ? index : [index]).sort((left, right) => right - left)
        const nextItems = [...normalizedList]
        indexes.forEach(currentIndex => {
          if (currentIndex < 0 || currentIndex >= nextItems.length) return
          nextItems.splice(currentIndex, 1)
          keyList.splice(currentIndex, 1)
        })
        void formInstance.__INTERNAL__.updateListValue(namePath, nextItems)
      },
      move(from, to) {
        if (
          from < 0 ||
          to < 0 ||
          from >= normalizedList.length ||
          to >= normalizedList.length ||
          from === to
        ) {
          return
        }

        const nextItems = [...normalizedList]
        const [moved] = nextItems.splice(from, 1)
        nextItems.splice(to, 0, moved)
        const [movedKey] = keyList.splice(from, 1)
        keyList.splice(to, 0, movedKey)
        void formInstance.__INTERNAL__.updateListValue(namePath, nextItems)
      },
    }

    const fields: FormListFieldData[] = normalizedList.map((_, index) => ({
      key: keyList[index],
      name: index,
      fieldKey: keyList[index],
    }))

    return (
      <div
        key={fields.map(field => `${String(field.fieldKey)}:${field.name}`).join('|')}
        data-rue-form-list-shell="true"
      >
        {renderList(fields, operations, { errors: meta.errors, warnings: meta.warnings })}
      </div>
    )
  })()
}

/** use Form Instance 的内部工具函数。 */
const useFormInstance = () => {
  throw new Error('当前运行时不支持自动解析祖先 Form，请显式持有并传递 form 实例')
}

/** use Watch 的内部工具函数。 */
const useWatch = (name: NamePath, form?: FormInstance) => {
  const instanceProps = (getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO as Record<string, any> | undefined
  const context = instanceProps?.[FORM_CONTEXT_PROP] as FormContextValue | undefined
  const targetForm = (form ?? context?.form) as InternalFormInstance | undefined
  const [renderVersion, setRenderVersion] = useState(0, { kind: 'ref' })
  const observedFormRef = useRef<InternalFormInstance | undefined>(undefined)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  if (observedFormRef.current !== targetForm) {
    unsubscribeRef.current?.()
    observedFormRef.current = targetForm
    unsubscribeRef.current = targetForm
      ? targetForm.__INTERNAL__.subscribe(() => {
          setRenderVersion(renderVersion.value + 1)
        })
      : null
  }

  onCleanup(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    observedFormRef.current = undefined
  })

  if (!targetForm) return undefined
  return (() => {
    void renderVersion.value
    return targetForm.getFieldValue(name)
  })()
}

/** use Form 的内部工具函数。 */
const useForm = (form?: FormInstance): [FormInstance] => {
  const formRef = useRef<FormInstance>()
  if (!formRef.current) {
    formRef.current = form ?? createFormInstance()
  }
  return [formRef.current]
}

/** Form Root 的内部工具函数。 */
const FormRoot: FC<FormProps> = ({
  className,
  style,
  children,
  render,
  component = 'form',
  layout = 'horizontal',
  initialValues,
  form,
  name,
  preserve,
  validateMessages,
  validateTrigger,
  scrollToFirstError,
  onValuesChange,
  onFieldsChange,
  onFinish,
  onFinishFailed,
  onSubmit,
  ...rest
}) => {
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const internalFormRef = useRef<InternalFormInstance>()
  const rootElementRef = useRef<HTMLElement | null>(null)
  const subscriptionFormRef = useRef<InternalFormInstance | undefined>(undefined)
  const unsubscribeRenderRef = useRef<(() => void) | null>(null)
  const [renderVersion, setRenderVersion] = useState(0, { kind: 'ref' })

  if (!internalFormRef.current) {
    internalFormRef.current = (form as InternalFormInstance | undefined) ?? createFormInstance()
  }

  const resolvedForm = ((form as InternalFormInstance | undefined) ??
    internalFormRef.current) as InternalFormInstance
  const initializedNow = resolvedForm.__INTERNAL__.ensureInitialized(initialValues)
  // Keep render-prop consumers subscribed when they read values through the form instance.
  const formVersionSnapshot = resolvedForm.__INTERNAL__.version.value

  resolvedForm.__INTERNAL__.setRuntimeOptions({
    name,
    preserve,
    validateTrigger: normalizeTriggerList(validateTrigger),
    validateMessages: {
      ...defaultValidateMessages,
      ...validateMessages,
    },
    scrollToFirstError,
    onValuesChange,
    onFieldsChange,
    onFinish,
    onFinishFailed,
  })

  if (subscriptionFormRef.current !== resolvedForm) {
    unsubscribeRenderRef.current?.()
    subscriptionFormRef.current = resolvedForm
    unsubscribeRenderRef.current = resolvedForm.__INTERNAL__.subscribe(() => {
      setRenderVersion(renderVersion.value + 1)
    })
  }

  const handleNativeSubmit = (event: Event) => {
    event.preventDefault()
    onSubmit?.(event)
    resolvedForm.submit()
  }

  onMounted(() => {
    if (initializedNow) {
      resolvedForm.__INTERNAL__.emitUpdate()
    }
  })

  onCleanup(() => {
    unsubscribeRenderRef.current?.()
    unsubscribeRenderRef.current = null
    subscriptionFormRef.current = undefined
  })

  const resolveContent = () => {
    void formVersionSnapshot

    return typeof render === 'function' ? (
      <>{render(resolvedForm)}</>
    ) : typeof children === 'function' &&
      (children as { kind?: unknown }).kind !== 'block-factory' ? (
      <>{children(resolvedForm)}</>
    ) : (
      <Slot source={slotSource} />
    )
  }

  const content = resolveContent()

  if (component === false) {
    return content
  }

  const rootProps = {
    ...rest,
    ref: (element: HTMLElement | null) => {
      rootElementRef.current = element
      resolvedForm.__INTERNAL__.setRootElement(element)
    },
    onSubmit: component === 'form' ? handleNativeSubmit : undefined,
    className: mergeClassName(
      'rue-form',
      layout === 'inline' ? 'flex flex-wrap items-start gap-5' : 'grid content-start gap-6',
      className,
    ),
    style,
    'data-rue-form': 'true',
  }

  if (component === 'form') {
    return (
      <form {...rootProps}>
        {(() => {
          void renderVersion.value
          return resolveContent()
        })()}
      </form>
    )
  }

  if (component === 'div') {
    return (
      <div {...rootProps}>
        {(() => {
          void renderVersion.value
          return resolveContent()
        })()}
      </div>
    )
  }

  if (component === 'section') {
    return (
      <section {...rootProps}>
        {(() => {
          void renderVersion.value
          return resolveContent()
        })()}
      </section>
    )
  }

  if (typeof component === 'string') {
    return h(
      component,
      rootProps,
      (() => {
        void renderVersion.value
        return resolveContent()
      })(),
    )
  }

  const Component = component as any

  return (
    <Component {...rootProps}>
      {(() => {
        void renderVersion.value
        return resolveContent()
      })()}
    </Component>
  )
}

type FormCompound = FC<FormProps> & {
  Item: FC<FormItemProps>
  List: FC<FormListProps>
  ErrorList: FC<FormErrorListProps>
  useForm: (form?: FormInstance) => [FormInstance]
  useFormInstance: () => FormInstance
  useWatch: (name: NamePath, form?: FormInstance) => any
}

const Form = Object.assign(FormRoot, {
  Item: FormItem,
  List: FormList,
  ErrorList,
  useForm,
  useFormInstance,
  useWatch,
}) as FormCompound

/** 默认导出表单组件。 */
export default Form
