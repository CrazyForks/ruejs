import { type FC, onMounted, onUnmounted, render, useRef } from '@rue-js/rue'
import { Anchor } from '@rue-js/design'

type PageContentAnchorItem = {
  key: string
  href: string
  title: string
  children?: PageContentAnchorItem[]
}

type PageContentAnchorProps = {
  containerRef: {
    current?: HTMLElement | null
  }
}

const HEADING_SELECTOR = 'h2, h3'
const MAX_ANCHOR_ITEMS = 48

const normalizeHeadingText = (value: string) => {
  return value.replace(/^#\s*/, '').replace(/\s+/g, ' ').trim()
}

const slugifyHeading = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=[\]{};:'",.<>/?\\|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'section'
}

const shouldSkipHeading = (heading: HTMLHeadingElement) => {
  if (heading.closest('[data-rue-anchor="true"]')) {
    return true
  }

  const notProseRoot = heading.closest('.not-prose')
  return !!notProseRoot && !heading.classList.contains('component-preview-title')
}

const ensureHeadingId = (heading: HTMLHeadingElement, title: string, usedIds: Set<string>) => {
  const existingId = heading.getAttribute('id')?.trim()
  if (existingId) {
    usedIds.add(existingId)
    return existingId
  }

  const baseId = `page-nav-${slugifyHeading(title)}`
  let id = baseId
  let index = 2

  while (
    (document.getElementById(id) && document.getElementById(id) !== heading) ||
    usedIds.has(id)
  ) {
    id = `${baseId}-${index}`
    index += 1
  }

  heading.id = id
  usedIds.add(id)
  return id
}

const buildAnchorItems = (container: HTMLElement): PageContentAnchorItem[] => {
  const usedIds = new Set<string>()
  const roots: PageContentAnchorItem[] = []
  let currentRoot: PageContentAnchorItem | null = null

  const headings = Array.from(container.querySelectorAll<HTMLHeadingElement>(HEADING_SELECTOR))
    .filter(heading => !shouldSkipHeading(heading))
    .slice(0, MAX_ANCHOR_ITEMS)

  headings.forEach(heading => {
    const title = normalizeHeadingText(heading.textContent || '')
    if (!title) {
      return
    }

    const id = ensureHeadingId(heading, title, usedIds)
    const item: PageContentAnchorItem = {
      key: id,
      href: `#${id}`,
      title,
    }

    if (heading.tagName.toLowerCase() === 'h3' && currentRoot) {
      currentRoot.children = [...(currentRoot.children || []), item]
      return
    }

    roots.push(item)
    currentRoot = item
  })

  return roots
}

const flattenSignature = (items: PageContentAnchorItem[]): string => {
  return items
    .map(item => {
      const childSignature = item.children?.length ? `(${flattenSignature(item.children)})` : ''
      return `${item.href}:${item.title}${childSignature}`
    })
    .join('|')
}

const PageContentAnchor: FC<PageContentAnchorProps> = ({ containerRef }) => {
  const shellRef = useRef<HTMLElement>()
  const anchorHostRef = useRef<HTMLDivElement>()
  const frameRef = useRef<number | undefined>()
  const observerRef = useRef<MutationObserver | undefined>()
  const signatureRef = useRef('')

  const renderAnchor = (items: PageContentAnchorItem[]) => {
    const shell = shellRef.current
    const anchorHost = anchorHostRef.current
    if (!shell || !anchorHost) {
      return
    }

    if (items.length === 0) {
      shell.setAttribute('aria-hidden', 'true')
      shell.style.visibility = 'hidden'
      render(null as any, anchorHost)
      return
    }

    shell.removeAttribute('aria-hidden')
    shell.style.visibility = ''
    render(
      <Anchor
        affix={false}
        targetOffset={96}
        items={items}
        classNames={{
          root: 'rounded-box border-base-300/60 bg-base-100/95 p-3 shadow-sm backdrop-blur',
          list: 'space-y-1',
          link: 'rounded-xl px-2.5 py-1.5',
          title: 'text-xs',
          description: 'hidden',
        }}
      />,
      anchorHost,
    )
  }

  const collectItems = () => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const nextItems = buildAnchorItems(container)
    const nextSignature = flattenSignature(nextItems)
    if (nextSignature === signatureRef.current) {
      return
    }

    signatureRef.current = nextSignature
    renderAnchor(nextItems)
  }

  const scheduleCollect = () => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      collectItems()
      return
    }

    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current)
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = undefined
      collectItems()
    })
  }

  onMounted(() => {
    scheduleCollect()

    const container = containerRef.current
    if (!container || typeof MutationObserver === 'undefined') {
      return
    }

    observerRef.current = new MutationObserver(() => {
      scheduleCollect()
    })
    observerRef.current.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })

  onUnmounted(() => {
    observerRef.current?.disconnect()
    observerRef.current = undefined
    if (anchorHostRef.current) {
      render(null as any, anchorHostRef.current)
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.cancelAnimationFrame === 'function' &&
      frameRef.current != null
    ) {
      window.cancelAnimationFrame(frameRef.current)
    }
    frameRef.current = undefined
  })

  return (
    <aside
      ref={shellRef}
      className="hidden xl:block w-60 shrink-0"
      aria-hidden="true"
      style={{ visibility: 'hidden' }}
    >
      <div
        className="fixed top-24 w-60 max-h-[calc(100vh-7rem)] overflow-auto"
        style={{
          right: 'max(1.5rem, calc((100vw - 1400px) / 2 + 1.5rem))',
        }}
      >
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
          页内导航
        </div>
        <div ref={anchorHostRef} />
      </div>
    </aside>
  )
}

export default PageContentAnchor
