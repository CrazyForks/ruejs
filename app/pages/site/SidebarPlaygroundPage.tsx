import { Slot, type FC } from '@rue-js/rue'

type SidebarPlaygroundPageProps = {
  currentPath?: string
  children?: any
}

const SidebarPlayground: FC<SidebarPlaygroundPageProps> = props => {
  return (
    <article>
      <Slot source={props} />
    </article>
  )
}

export default SidebarPlayground
