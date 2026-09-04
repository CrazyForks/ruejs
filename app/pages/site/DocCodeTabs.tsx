import { onMounted, type FC, useRef } from '@rue-js/rue'
import { initializeDocCodeTabs, installDocCodeTabsEnhancer } from './docCodeTabsEnhancer'

type CodeTabProps = {
  value: string
  label?: string
}

type CodeTabsProps = {
  ariaLabel?: string
}

let codeTabsIdSeed = 0

if (!import.meta.env.SSR && typeof document !== 'undefined') {
  installDocCodeTabsEnhancer(document)
}

export const CodeTabs: FC<CodeTabsProps> = props => {
  const idRef = useRef('')
  const rootRef = useRef<HTMLElement | null>(null)
  if (!idRef.current) {
    codeTabsIdSeed += 1
    idRef.current = `doc-code-tabs-${codeTabsIdSeed}`
  }

  onMounted(() => {
    if (rootRef.current) initializeDocCodeTabs(rootRef.current)
  })

  return (
    <div ref={rootRef} id={idRef.current} className="doc-code-tabs my-5" data-rue-doc-code-tabs="">
      <div
        className="tabs tabs-boxed w-fit"
        role="tablist"
        aria-label={props.ariaLabel ?? 'Code'}
      />
      {props.children}
    </div>
  )
}

export const CodeTab: FC<CodeTabProps> = props => {
  return (
    <div
      className="mt-3"
      role="tabpanel"
      data-doc-code-tab={props.value}
      data-doc-code-tab-label={props.label ?? props.value}
    >
      {props.children}
    </div>
  )
}
