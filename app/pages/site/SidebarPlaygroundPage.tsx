import { type FC } from '@rue-js/rue'

type SidebarPlaygroundPageProps = {
  currentPath?: string
  children?: any
}

const SidebarPlayground: FC<SidebarPlaygroundPageProps> = p => {
  return <article>{p.children}</article>
}

export default SidebarPlayground
