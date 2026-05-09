import { type FC, useState, watch } from '@rue-js/rue'
import { RouterLink, useRoute } from '@rue-js/router'
import SidebarPlayground, { SECTIONS_BY_TYPE } from '../site/SidebarPlaygroundDesign'

type DesignMenuItem = {
  id: string
  title: string
  href?: string
  children?: DesignMenuItem[]
}

const flattenItems = (items: DesignMenuItem[]): DesignMenuItem[] => {
  return items.flatMap(item => {
    if (item.children && item.children.length) {
      return flattenItems(item.children)
    }
    return [item]
  })
}

const DESIGN_ITEMS = SECTIONS_BY_TYPE.design.flatMap(section => flattenItems(section.items))

const DesignPlaceholder: FC = () => {
  const route = useRoute()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('组件')

  watch(
    route,
    (data: any) => {
      const nextSlug = (data?.params?.slug as string) || ''
      const meta = DESIGN_ITEMS.find(item => item.id === nextSlug)
      setSlug(nextSlug)
      setTitle(meta?.title || nextSlug || '组件')
    },
    { immediate: true },
  )

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>{title.value}</h1>
        <p className="text-sm mt-3 mb-3">
          这个组件的菜单入口和路由已经预留，正式示例页还没有补齐。
        </p>

        <div role="alert" className="alert alert-soft alert-info not-prose my-6">
          <span>当前先提供占位页，便于完整浏览组件目录与信息架构。</span>
        </div>

        <div className="card bg-base-100 shadow not-prose my-6">
          <div className="card-body gap-4">
            <div>
              <div className="text-sm text-base-content/60">组件标识</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge badge-outline">{slug.value || 'unknown'}</span>
                <span className="badge badge-ghost">待补示例</span>
              </div>
            </div>

            <p className="text-sm text-base-content/75 m-0">
              后续可以在这里补充基础用法、变体演示、JSX 代码以及 Rue Design 对应封装说明。
            </p>

            <div className="card-actions justify-start gap-3">
              <a
                className="btn btn-primary btn-sm"
                href={`https://daisyui.com/components/${slug.value || 'button'}/`}
                target="_blank"
                rel="noreferrer"
              >
                查看 daisyUI 文档
              </a>
              <RouterLink to="/design/button" className="btn btn-outline btn-sm">
                参考已完成示例
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default DesignPlaceholder
