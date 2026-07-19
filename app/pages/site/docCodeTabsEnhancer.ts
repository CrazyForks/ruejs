const codeTabsSelector = '[data-rue-doc-code-tabs]'
const tabSelector = '[role="tab"][aria-controls]'

const findCodeTabs = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>(codeTabsSelector) : null

const readTabs = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>(tabSelector))

const selectTab = (root: HTMLElement, selectedTab: HTMLButtonElement, focus: boolean) => {
  for (const tab of readTabs(root)) {
    const selected = tab === selectedTab
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    tab.classList.toggle('tab-active', selected)

    const panelId = tab.getAttribute('aria-controls')
    const panel = panelId ? root.ownerDocument.getElementById(panelId) : null
    if (panel && root.contains(panel)) {
      panel.setAttribute('aria-hidden', String(!selected))
      panel.classList.toggle('hidden', !selected)
    }
  }

  if (focus) {
    selectedTab.focus()
  }
}

export const installDocCodeTabsEnhancer = (doc: Document = document) => {
  const handleClick = (event: MouseEvent) => {
    const root = findCodeTabs(event.target)
    const tab =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>(tabSelector) : null
    if (!root || !tab || !root.contains(tab)) {
      return
    }
    selectTab(root, tab, false)
  }

  const handleKeydown = (event: KeyboardEvent) => {
    const root = findCodeTabs(event.target)
    const tab =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>(tabSelector) : null
    if (!root || !tab || !root.contains(tab)) {
      return
    }

    const tabs = readTabs(root)
    const currentIndex = tabs.indexOf(tab)
    if (currentIndex < 0 || tabs.length === 0) {
      return
    }

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex == null) {
      return
    }

    event.preventDefault()
    selectTab(root, tabs[nextIndex], true)
  }

  doc.addEventListener('click', handleClick)
  doc.addEventListener('keydown', handleKeydown)

  return () => {
    doc.removeEventListener('click', handleClick)
    doc.removeEventListener('keydown', handleKeydown)
  }
}
