import {
  type FC,
  onBeforeUnmount,
  onMounted,
  render,
  useSetup,
  useState,
  vapor,
  watch,
} from '@rue-js/rue'
import { extend } from '@rue-js/shared'
import { RouterLink, useRoute } from '@rue-js/router'

export type SidebarItem = {
  id: string
  title: string
  href?: string
  children?: SidebarItem[]
}

export type SidebarSection = {
  id: string
  title: string
  items: SidebarItem[]
}

type PersistentSidebarPlaygroundOptions = {
  sections: SidebarSection[]
  wrapperClassName?: string
}

const SidebarItemsList: FC<{ items: SidebarItem[]; currentPath: string }> = props => {
  return (
    <>
      {props.items.map(item => (
        <li key={item.id}>
          {item.children && item.children.length ? (
            <div>
              <div className="px-3 py-2 font-medium text-base-content/80">{item.title}</div>
              <ul className="menu menu-sm bg-transparent rounded-box w-full">
                <SidebarItemsList items={item.children} currentPath={props.currentPath} />
              </ul>
            </div>
          ) : item.href ? (
            <RouterLink
              to={`${item.href}`}
              className={`${props.currentPath === item.href ? 'active' : ''} w-full`}
            >
              {item.title}
            </RouterLink>
          ) : (
            <span className="block w-full cursor-default rounded-btn px-3 py-2 text-base-content/45">
              {item.title}
            </span>
          )}
        </li>
      ))}
    </>
  )
}

export const createPersistentSidebarPlayground = ({
  sections,
  wrapperClassName,
}: PersistentSidebarPlaygroundOptions): FC => {
  let sharedSidebarMount: HTMLDivElement | null = null

  const SidebarPlaygroundNavigation: FC = () => {
    const route = useRoute()
    const [currentPath, setCurrentPath] = useState('')

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
      const initialState: Record<string, boolean> = {}
      sections.forEach(section => {
        initialState[section.id] = true
      })
      return initialState
    })

    const toggleSection = (id: string) => {
      setOpenSections(prev => extend(prev, { [id]: !prev[id] }))
    }

    watch(
      route,
      (data: any) => {
        setCurrentPath((data && data.path) || '')
      },
      { immediate: true },
    )

    return (
      <aside className="w-full">
        <div className="sticky top-20">
          <nav className="space-y-3 w-full">
            {sections.map(section => (
              <div
                key={section.id}
                className={`collapse collapse-arrow bg-base-100 rounded-box shadow w-full ${
                  openSections[section.id] ? 'collapse-open' : ''
                }`}
              >
                <button
                  className="collapse-title px-3 py-2 font-medium text-base-content w-full text-left"
                  onClick={() => toggleSection(section.id)}
                >
                  {section.title}
                </button>
                <div className="collapse-content px-0">
                  <ul className="menu menu-sm bg-transparent rounded-box w-full">
                    <SidebarItemsList items={section.items} currentPath={currentPath.value} />
                  </ul>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    )
  }

  const ensureSharedSidebarMount = () => {
    if (!sharedSidebarMount) {
      const mount = globalThis.document.createElement('div')
      mount.className = 'w-full'
      render(<SidebarPlaygroundNavigation />, mount as any)
      sharedSidebarMount = mount
    }

    return sharedSidebarMount
  }

  const SharedSidebarHost: FC = () => {
    const ctx = useSetup(() => {
      const host = globalThis.document.createElement('div')
      host.className = 'md:w-45 shrink-0'
      return { host }
    })

    onMounted(() => {
      const mount = ensureSharedSidebarMount()
      if (mount.parentNode !== ctx.host) {
        ctx.host.appendChild(mount)
      }
    })

    onBeforeUnmount(() => {
      const mount = sharedSidebarMount
      if (mount && mount.parentNode === ctx.host) {
        ctx.host.removeChild(mount)
      }
    })

    return vapor(() => ctx.host)
  }

  const SidebarPlayground: FC = props => {
    const rootClassName = [
      'sidebar-playground',
      wrapperClassName,
      'md:flex',
      'md:items-start',
      'md:gap-6',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={rootClassName}>
        <SharedSidebarHost />
        <article class="component-preview">{props.children}</article>
      </div>
    )
  }

  return SidebarPlayground
}
