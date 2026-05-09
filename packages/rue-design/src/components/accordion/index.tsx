/* RUE_VAPOR_TRANSFORMED */
/*
Accordion 组件概述
- 数据驱动：支持 items 配置与 children 组合两种写法。
- 状态模型：支持单开、多开、受控与非受控，并兼容原有 open / force 语义。
- 复合能力：items 可直接表达 description / extra / disabled，Title / Content 仍可单独组合。
*/
import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
/* 局部响应式引用：用于保存非受控开合状态与自动分组名 */

let accordionNameSeed = 0

export type AccordionIcon = 'arrow' | 'plus'
export type AccordionForce = 'open' | 'close'
export type AccordionUse = 'radio' | 'details'
export type AccordionItemKey = string | number

export interface AccordionDataItem {
  key?: AccordionItemKey
  title?: any
  description?: any
  extra?: any
  content?: any
  titleClassName?: string
  descriptionClassName?: string
  extraClassName?: string
  contentClassName?: string
  icon?: AccordionIcon
  force?: AccordionForce
  use?: AccordionUse
  open?: boolean
  disabled?: boolean
  className?: string
}

export interface AccordionChangeContext {
  key: AccordionItemKey
  index: number
  open: boolean
  item?: AccordionDataItem
}

export interface AccordionProps {
  icon?: AccordionIcon
  force?: AccordionForce
  use?: AccordionUse
  name?: string
  open?: boolean
  defaultOpen?: boolean
  activeKey?: AccordionItemKey | null
  defaultActiveKey?: AccordionItemKey | null
  openKeys?: ReadonlyArray<AccordionItemKey>
  defaultOpenKeys?: ReadonlyArray<AccordionItemKey>
  multiple?: boolean
  collapsible?: boolean
  disabled?: boolean
  className?: string
  titleClassName?: string
  contentClassName?: string
  children?: any
  items?: ReadonlyArray<AccordionDataItem>
  onChange?: (
    nextValue: AccordionItemKey | ReadonlyArray<AccordionItemKey> | null,
    context: AccordionChangeContext,
  ) => void
  onToggle?: (open: boolean, context: AccordionChangeContext) => void
}

interface NormalizedAccordionItem extends AccordionDataItem {
  key: AccordionItemKey
  index: number
}

interface AccordionPartProps {
  className?: string
  children?: any
  as?: 'div' | 'summary' | 'button'
}

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const uniqueKeys = (keys: ReadonlyArray<AccordionItemKey>) => {
  const next: AccordionItemKey[] = []
  keys.forEach(key => {
    if (!next.some(current => current === key)) {
      next.push(key)
    }
  })
  return next
}

const normalizeOpenKeys = (
  keys: ReadonlyArray<AccordionItemKey> | null | undefined,
  multiple?: boolean,
) => {
  const normalized = uniqueKeys(Array.isArray(keys) ? keys : [])
  return multiple ? normalized : normalized.slice(0, 1)
}

const keyToArray = (key: AccordionItemKey | null | undefined) => {
  return key == null ? [] : [key]
}

const resolveInitialGroupOpenKeys = (
  normalizedItems: ReadonlyArray<NormalizedAccordionItem>,
  activeKey: AccordionItemKey | null | undefined,
  defaultActiveKey: AccordionItemKey | null | undefined,
  openKeys: ReadonlyArray<AccordionItemKey> | undefined,
  defaultOpenKeys: ReadonlyArray<AccordionItemKey> | undefined,
  multiple?: boolean,
) => {
  if (openKeys !== undefined) return normalizeOpenKeys(openKeys, multiple)
  if (activeKey !== undefined) return normalizeOpenKeys(keyToArray(activeKey), multiple)
  if (defaultOpenKeys !== undefined) return normalizeOpenKeys(defaultOpenKeys, multiple)
  if (defaultActiveKey !== undefined)
    return normalizeOpenKeys(keyToArray(defaultActiveKey), multiple)
  return normalizeOpenKeys(
    normalizedItems.filter(item => item.open).map(item => item.key),
    multiple,
  )
}

const resolveInitialSingleOpen = (
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  force: AccordionForce | undefined,
) => {
  if (force === 'open') return true
  if (force === 'close') return false
  if (typeof open === 'boolean') return open
  if (typeof defaultOpen === 'boolean') return defaultOpen
  return false
}

const getStateClass = (open: boolean, force: AccordionForce | undefined) => {
  if (force === 'open') return 'collapse-open'
  if (force === 'close') return 'collapse-close'
  return open ? 'collapse-open' : 'collapse-close'
}

const getAccordionGroupRoots = (groupName: string, source?: Element | null) => {
  const queryRoot = source?.getRootNode?.()
  const scope =
    queryRoot && typeof (queryRoot as ParentNode).querySelectorAll === 'function'
      ? (queryRoot as ParentNode)
      : typeof document !== 'undefined'
        ? document
        : null

  if (!scope) return []

  return Array.from(scope.querySelectorAll<HTMLElement>('[data-rue-accordion-group]')).filter(
    root => root.dataset.rueAccordionGroup === groupName,
  )
}

const getDirectAccordionInput = (root: Element) => {
  return Array.from(root.children).find(
    child =>
      child instanceof HTMLInputElement && (child.type === 'checkbox' || child.type === 'radio'),
  ) as HTMLInputElement | undefined
}

const getDirectAccordionTitle = (root: Element) => {
  return Array.from(root.children).find(
    child => child instanceof HTMLElement && child.classList.contains('collapse-title'),
  ) as HTMLElement | undefined
}

const syncAccordionPanelState = (
  root: Element,
  open: boolean,
  force: AccordionForce | undefined,
) => {
  if (!(root instanceof HTMLElement)) return

  root.classList.remove('collapse-open', 'collapse-close')
  root.classList.add(getStateClass(open, force))

  const input = getDirectAccordionInput(root)
  if (input && input.checked !== open) {
    input.checked = open
  }

  if (root instanceof HTMLDetailsElement && root.open !== open) {
    root.open = open
  }

  const title = getDirectAccordionTitle(root)
  if (title) {
    title.setAttribute('aria-expanded', open ? 'true' : 'false')
  }
}

const buildGroupNextKeys = (
  currentKeys: ReadonlyArray<AccordionItemKey>,
  key: AccordionItemKey,
  shouldOpen: boolean,
  multiple?: boolean,
  collapsible?: boolean,
) => {
  if (multiple) {
    if (shouldOpen) {
      return uniqueKeys([...currentKeys, key])
    }
    return currentKeys.filter(current => current !== key)
  }

  if (shouldOpen) {
    return [key]
  }

  if (collapsible) {
    return []
  }

  return currentKeys.some(current => current === key) ? [...currentKeys] : [key]
}

const isRadioInput = (input: HTMLInputElement | null | undefined) => input?.type === 'radio'

const renderHeaderBody = (item: AccordionDataItem) => {
  if (item.description == null && item.extra == null) {
    return item.title
  }

  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div>{item.title}</div>
        {item.description != null ? (
          <div className={appendClassName('mt-1 text-xs opacity-70', item.descriptionClassName)}>
            {item.description}
          </div>
        ) : null}
      </div>
      {item.extra != null ? (
        <div className={appendClassName('shrink-0 text-xs opacity-70', item.extraClassName)}>
          {item.extra}
        </div>
      ) : null}
    </div>
  )
}

/** 手风琴组件：统一归一化 items 与 children 两种模式的开合状态。 */
const Accordion: FC<AccordionProps> = ({
  icon,
  force,
  use = 'radio',
  name,
  open,
  defaultOpen,
  activeKey,
  defaultActiveKey,
  openKeys,
  defaultOpenKeys,
  multiple,
  collapsible,
  disabled,
  className,
  titleClassName,
  contentClassName,
  children,
  items,
  onChange,
  onToggle,
}) => {
  const normalizedItems: NormalizedAccordionItem[] =
    items?.map((item, index) => ({
      ...item,
      key: item.key ?? index,
      index,
    })) ?? []
  const generatedName = ref(`rue-accordion-${accordionNameSeed++}`)
  const uncontrolledSingleOpen = ref(resolveInitialSingleOpen(open, defaultOpen, force))
  const uncontrolledGroupOpenKeys = ref(
    resolveInitialGroupOpenKeys(
      normalizedItems,
      activeKey,
      defaultActiveKey,
      openKeys,
      defaultOpenKeys,
      multiple,
    ),
  )
  const groupName = name ?? generatedName.value
  const hasItems = normalizedItems.length > 0
  const isGroupControlled = openKeys !== undefined || activeKey !== undefined
  const currentSingleOpen =
    force === 'open'
      ? true
      : force === 'close'
        ? false
        : open !== undefined
          ? !!open
          : uncontrolledSingleOpen.value

  const getCurrentGroupOpenKeys = () => {
    if (openKeys !== undefined) return normalizeOpenKeys(openKeys, multiple)
    if (activeKey !== undefined) return normalizeOpenKeys(keyToArray(activeKey), multiple)
    return uncontrolledGroupOpenKeys.value
  }

  const syncItemsDom = (nextOpenKeys: ReadonlyArray<AccordionItemKey>, source?: Element | null) => {
    getAccordionGroupRoots(groupName, source).forEach(root => {
      const itemIndex = Number(root.dataset.rueAccordionIndex ?? -1)
      const item = normalizedItems[itemIndex]

      if (!item) return

      const itemForce = item.force ?? force
      const itemOpen =
        itemForce === 'open'
          ? true
          : itemForce === 'close'
            ? false
            : nextOpenKeys.some(key => key === item.key)

      syncAccordionPanelState(root, itemOpen, itemForce)
    })
  }

  const syncSingleDom = (source?: Element | null) => {
    getAccordionGroupRoots(groupName, source).forEach(root => {
      const panelForce = (root.dataset.rueAccordionForce as AccordionForce | undefined) ?? force
      const input = getDirectAccordionInput(root)
      const domOpen =
        panelForce === 'open'
          ? true
          : panelForce === 'close'
            ? false
            : root instanceof HTMLDetailsElement
              ? root.open
              : input?.checked === true

      syncAccordionPanelState(root, domOpen, panelForce)
    })
  }

  const commitGroupChange = (
    item: NormalizedAccordionItem,
    shouldOpen: boolean,
    source?: Element | null,
  ) => {
    const resolvedForce = item.force ?? force
    if (disabled || item.disabled || resolvedForce) return

    const nextOpenKeys = buildGroupNextKeys(
      getCurrentGroupOpenKeys(),
      item.key,
      shouldOpen,
      multiple,
      collapsible,
    )
    const itemOpen = nextOpenKeys.some(key => key === item.key)

    if (!isGroupControlled) {
      uncontrolledGroupOpenKeys.value = nextOpenKeys
      syncItemsDom(nextOpenKeys, source)
    }

    if (onChange) {
      onChange(multiple ? nextOpenKeys : (nextOpenKeys[0] ?? null), {
        key: item.key,
        index: item.index,
        open: itemOpen,
        item,
      })
    }
  }

  const commitSingleChange = (shouldOpen: boolean, source?: Element | null) => {
    if (disabled || force) return
    if (open === undefined) {
      uncontrolledSingleOpen.value = shouldOpen
      syncSingleDom(source)
    }
    if (onToggle) {
      onToggle(shouldOpen, {
        key: groupName,
        index: 0,
        open: shouldOpen,
      })
    }
  }

  if (hasItems) {
    return (
      <>
        {normalizedItems.map(item => {
          const itemUse = item.use ?? use
          const itemIcon = item.icon ?? icon
          const itemForce = item.force ?? force
          const itemOpen =
            itemForce === 'open'
              ? true
              : itemForce === 'close'
                ? false
                : getCurrentGroupOpenKeys().some(key => key === item.key)
          let itemClassName = appendClassName('collapse', getStateClass(itemOpen, itemForce))
          if (itemIcon === 'arrow') itemClassName += ' collapse-arrow'
          if (itemIcon === 'plus') itemClassName += ' collapse-plus'
          if (className) itemClassName += ` ${className}`
          if (item.className) itemClassName += ` ${item.className}`
          if (disabled || item.disabled) itemClassName += ' opacity-70'
          const arrowAlignClassName =
            itemIcon === 'arrow' && (item.description != null || item.extra != null)
              ? 'after:top-6'
              : undefined
          const mergedTitleClassName = appendClassName(
            appendClassName('collapse-title', titleClassName),
            appendClassName(item.titleClassName, arrowAlignClassName),
          )
          const mergedContentClassName = appendClassName(
            appendClassName('collapse-content', contentClassName),
            item.contentClassName,
          )

          if (itemUse === 'details') {
            return (
              <details
                className={itemClassName}
                name={groupName}
                open={itemOpen}
                key={item.key}
                data-rue-accordion-group={groupName}
                data-rue-accordion-index={String(item.index)}
                data-rue-accordion-force={itemForce}
              >
                <summary
                  className={mergedTitleClassName}
                  aria-expanded={itemOpen ? 'true' : 'false'}
                  onClick={(event: MouseEvent) => {
                    event.preventDefault()
                    commitGroupChange(item, !itemOpen, event.currentTarget as Element)
                  }}
                >
                  {renderHeaderBody(item)}
                </summary>
                <div className={mergedContentClassName}>{item.content}</div>
              </details>
            )
          }

          const inputType = multiple ? 'checkbox' : 'radio'

          return (
            <div
              className={itemClassName}
              key={item.key}
              data-rue-accordion-group={groupName}
              data-rue-accordion-index={String(item.index)}
              data-rue-accordion-force={itemForce}
            >
              <input
                type={inputType}
                name={inputType === 'radio' ? groupName : undefined}
                checked={itemOpen}
                disabled={disabled || item.disabled || !!itemForce}
                onClick={(event: MouseEvent) => {
                  const input = event.currentTarget as HTMLInputElement
                  if (!collapsible || !itemOpen || !isRadioInput(input)) return

                  event.preventDefault()
                  input.checked = false
                  commitGroupChange(item, false, input)
                }}
                onChange={(event: Event) => {
                  const nextOpen = (event.target as HTMLInputElement).checked
                  commitGroupChange(item, nextOpen, event.currentTarget as Element)
                }}
              />
              <div className={mergedTitleClassName} aria-expanded={itemOpen ? 'true' : 'false'}>
                {renderHeaderBody(item)}
              </div>
              <div className={mergedContentClassName}>{item.content}</div>
            </div>
          )
        })}
      </>
    )
  }

  let wrapperClassName = appendClassName('collapse', getStateClass(currentSingleOpen, force))
  if (icon === 'arrow') wrapperClassName += ' collapse-arrow'
  if (icon === 'plus') wrapperClassName += ' collapse-plus'
  if (className) wrapperClassName += ` ${className}`
  if (disabled) wrapperClassName += ' opacity-70'

  if (use === 'details') {
    return (
      <details
        className={wrapperClassName}
        name={groupName}
        open={currentSingleOpen}
        data-rue-accordion-group={groupName}
        data-rue-accordion-force={force}
        onToggle={(event: Event) => {
          const nextOpen = (event.currentTarget as HTMLDetailsElement).open
          if (disabled || force) {
            if ((event.currentTarget as HTMLDetailsElement).open !== currentSingleOpen) {
              ;(event.currentTarget as HTMLDetailsElement).open = currentSingleOpen
            }
            return
          }
          commitSingleChange(nextOpen, event.currentTarget as Element)
        }}
      >
        {children}
      </details>
    )
  }

  const singleInputType = 'radio'

  return (
    <div
      className={wrapperClassName}
      data-rue-accordion-group={groupName}
      data-rue-accordion-force={force}
    >
      <input
        type={singleInputType}
        name={singleInputType === 'radio' ? groupName : undefined}
        checked={currentSingleOpen}
        disabled={disabled || !!force}
        onClick={(event: MouseEvent) => {
          const input = event.currentTarget as HTMLInputElement
          if (!collapsible || !currentSingleOpen || !isRadioInput(input)) return

          event.preventDefault()
          input.checked = false
          commitSingleChange(false, input)
        }}
        onChange={(event: Event) => {
          const nextOpen = (event.target as HTMLInputElement).checked
          commitSingleChange(nextOpen, event.currentTarget as Element)
        }}
      />
      {children}
    </div>
  )
}

/** 标题子组件：兼容 div / summary / button 三种标题容器。 */
const Title: FC<AccordionPartProps> = ({ className, children, as = 'div' }) => {
  const mergedClassName = appendClassName('collapse-title', className)
  if (as === 'summary') {
    return <summary className={mergedClassName}>{children}</summary>
  }
  if (as === 'button') {
    return (
      <button type="button" className={mergedClassName}>
        {children}
      </button>
    )
  }
  return <div className={mergedClassName}>{children}</div>
}

/** 内容子组件：统一输出 collapse-content，便于 children 模式复用。 */
const Content: FC<AccordionPartProps> = ({ className, children }) => {
  return <div className={appendClassName('collapse-content', className)}>{children}</div>
}

type AccordionCompound = FC<AccordionProps> & {
  Title: FC<AccordionPartProps>
  Content: FC<AccordionPartProps>
}

const AccordionCompound: AccordionCompound = Object.assign(Accordion, {
  Title,
  Content,
})

export default AccordionCompound
