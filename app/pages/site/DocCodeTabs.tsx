import { type FC, useRef, useState } from '@rue-js/rue'

type CodeTabProps = {
  value: string
  label?: string
}

type CodeTabsProps = {
  ariaLabel?: string
}

type CodeTabModel = {
  value: string
  label: string
  children?: unknown
}

let codeTabsIdSeed = 0

const toChildrenArray = (children: unknown): unknown[] => {
  if (Array.isArray(children)) {
    return children.flatMap(toChildrenArray)
  }
  return children == null || children === false ? [] : [children]
}

const readCodeTab = (child: unknown): CodeTabModel | null => {
  if (!child || typeof child !== 'object') {
    return null
  }

  const props = (child as { props?: Record<string, unknown> }).props
  if (!props || props.value == null) {
    return null
  }

  const value = String(props.value)
  return {
    value,
    label: props.label == null ? value : String(props.label),
    children: props.children,
  }
}

const readCodeTabs = (children: unknown) =>
  toChildrenArray(children).flatMap(child => {
    const tab = readCodeTab(child)
    return tab ? [tab] : []
  })

const toDomIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tab'

export const CodeTabs: FC<CodeTabsProps> = props => {
  const idRef = useRef('')
  if (!idRef.current) {
    codeTabsIdSeed += 1
    idRef.current = `doc-code-tabs-${codeTabsIdSeed}`
  }

  const tabs = readCodeTabs(props.children)
  const initialValue = tabs[0]?.value ?? ''
  const [activeValue, setActiveValue] = useState(initialValue)
  const selectedValue = tabs.some(tab => tab.value === activeValue.value)
    ? activeValue.value
    : initialValue

  return (
    <div className="doc-code-tabs my-5">
      <div className="tabs tabs-boxed w-fit" role="tablist" aria-label={props.ariaLabel ?? 'Code'}>
        {tabs.map(tab => {
          const selected = tab.value === selectedValue
          const tabId = `${idRef.current}-tab-${toDomIdPart(tab.value)}`
          const panelId = `${idRef.current}-panel-${toDomIdPart(tab.value)}`

          return (
            <button
              type="button"
              id={tabId}
              className={`tab ${selected ? 'tab-active' : ''}`}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveValue(tab.value)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map(tab => {
        const selected = tab.value === selectedValue
        const idPart = toDomIdPart(tab.value)

        return (
          <div
            id={`${idRef.current}-panel-${idPart}`}
            className={`mt-3 ${selected ? '' : 'hidden'}`}
            role="tabpanel"
            aria-labelledby={`${idRef.current}-tab-${idPart}`}
            aria-hidden={selected ? 'false' : 'true'}
          >
            {tab.children}
          </div>
        )
      })}
    </div>
  )
}

export const CodeTab: FC<CodeTabProps> = props => {
  return (
    <div className="mt-3" role="tabpanel" data-doc-code-tab={props.value}>
      {props.children}
    </div>
  )
}
