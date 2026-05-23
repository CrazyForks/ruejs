/*
路由示例概述
- 目标：在站点主路由上直接演示嵌套路由、命名路由、redirect、replace 与 beforeEnter。
- 层级：本页是 /examples/router-demo 的父路由，内部 RouterView 会继续渲染 depth=1/2 的子视图。
- 反馈：通过 useRoute 展示当前匹配结果，并用 afterEach 记录本轮导航结果。
*/
import { type FC, onMounted, onUnmounted, ref } from '@rue-js/rue'
import {
  isNavigationFailure,
  NavigationFailureType,
  RouterLink,
  RouterView,
  useRoute,
  useRouter,
} from '@rue-js/router'
import { routerDemoLabEnabled } from './state'

type TopicContent = {
  eyebrow: string
  title: string
  summary: string
  bullets: string[]
}

const TOPIC_CONTENT: Record<string, Record<string, TopicContent>> = {
  router: {
    overview: {
      eyebrow: 'Nested RouterView',
      title: '嵌套路由总览',
      summary:
        '父路由负责壳层与导航，子路由把真正的内容继续交给下一层 RouterView。当前页面正是这样搭出来的。',
      bullets: [
        '父级 /examples/router-demo 只负责示例框架与状态面板。',
        '子级 /guide/:section(router|data) 负责 section 导航与布局。',
        '叶子路由 /:topic 负责内容面板，并把 params 暴露给组件。',
      ],
    },
    guards: {
      eyebrow: 'beforeEnter',
      title: '守卫与重定向',
      summary:
        '实验页被 beforeEnter 保护。当“允许进入实验页”关闭时，访问 /lab 会自动跳回这个页面。',
      bullets: [
        '守卫直接读共享 signal，不需要手动解析 URL。',
        '守卫返回 location 对象时，路由会继续完成一次重定向导航。',
        '你可以先点“实验页”，再切换开关，观察 route.path 与日志变化。',
      ],
    },
    history: {
      eyebrow: 'Push / Replace',
      title: '历史记录行为',
      summary:
        'push 会追加一条历史记录，replace 则直接覆盖当前条目。这个 demo 用 replace 跳去参数页。',
      bullets: [
        'RouterLink 支持 replace 属性，不需要额外写点击逻辑。',
        'router.push(current.path) 会返回 duplicated failure，可用来做重复导航保护。',
        'currentPath、route 都是 signal，历史变化会立刻同步到界面。',
      ],
    },
  },
  data: {
    overview: {
      eyebrow: 'Params',
      title: '参数如何传递',
      summary: '父子命中链会共享同一份 params，父组件和叶子组件都能直接拿到 section/topic。',
      bullets: [
        'GuideShell 能读到 section，也能读到子级 topic。',
        'Route.meta 会沿 matched 链从父到子合并。',
        'useRoute() 返回的是当前命中的整条结果，而不是单一记录。',
      ],
    },
    params: {
      eyebrow: 'Named Route',
      title: '命名路由与参数对象',
      summary:
        '本页通过 { name, params } 进行跳转，不依赖手写路径字符串，适合嵌套路由和参数较多的场景。',
      bullets: [
        '按钮和链接都使用 router-demo-topic 这个命名路由。',
        'section/topic 会被编码进路径，同时继续保留对象式调用体验。',
        '如果缺少必填参数，router.push 会直接抛错，便于尽早发现配置问题。',
      ],
    },
  },
}

const SECTION_TABS = [
  { id: 'router', label: 'Router API', defaultTopic: 'overview' },
  { id: 'data', label: '参数与命名路由', defaultTopic: 'params' },
] as const

const readTopicList = (section: string) => {
  if (section === 'data') {
    return [
      { id: 'overview', label: '参数总览' },
      { id: 'params', label: '命名路由' },
    ]
  }

  return [
    { id: 'overview', label: '嵌套路由' },
    { id: 'guards', label: '守卫' },
    { id: 'history', label: '历史记录' },
  ]
}

const readTopicContent = (section: string, topic: string): TopicContent => {
  return (
    TOPIC_CONTENT[section]?.[topic] ?? {
      eyebrow: 'Fallback',
      title: `${section}/${topic}`,
      summary: '这个叶子页没有单独定义内容，但你仍然能看到 params、matched 与 meta 已经同步更新。',
      bullets: [
        '当前路径仍然由 createRouter 正常匹配。',
        '你可以继续切换到已定义的 topic，观察当前面板即时更新。',
      ],
    }
  )
}

const formatNavigationLog = (
  to: ReturnType<ReturnType<typeof useRoute>['get']>,
  from: ReturnType<ReturnType<typeof useRoute>['get']>,
  failure?: unknown,
) => {
  const fromPath = from?.path ?? '(初始状态)'
  const toPath = to?.path ?? '(无匹配)'

  if (!failure) {
    return `${fromPath} -> ${toPath} [ok]`
  }

  if (failure instanceof Error) {
    return `${fromPath} -> ${toPath} [error: ${failure.message}]`
  }

  return `${fromPath} -> ${toPath} [failure: ${(failure as any).type}]`
}

const RouteMetric: FC<{ label: string; value: string }> = props => (
  <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
    <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">{props.label}</div>
    <div className="mt-2 break-all font-mono text-sm text-base-content">{props.value}</div>
  </div>
)

const RouterDemoScene: FC = () => {
  const router = useRouter()
  const currentRoute = useRoute()
  const navigationLogs = ref<string[]>([
    '进入 /examples/router-demo 时，会先命中默认子路由 redirect 到 /guide/router/overview。',
  ])
  const lastNavigationResult = ref('等待操作')

  onMounted(() => {
    const off = router.afterEach((to, from, failure) => {
      navigationLogs.value = [
        formatNavigationLog(to, from, failure),
        ...navigationLogs.value,
      ].slice(0, 6)
    })

    onUnmounted(off)
  })

  const probeDuplicateNavigation = async () => {
    const route = currentRoute.get()
    if (!route) {
      lastNavigationResult.value = '当前没有命中路由，无法测试 duplicated。'
      return
    }

    const result = await router.push(route.path)
    if (!result) {
      lastNavigationResult.value = 'push 成功，没有返回 failure。'
      return
    }

    if (isNavigationFailure(result, NavigationFailureType.duplicated)) {
      lastNavigationResult.value = '检测到 duplicated：重复 push 当前地址会被安全拦截。'
      return
    }

    lastNavigationResult.value = `收到导航失败：${String((result as { type: string }).type)}`
  }

  const route = currentRoute.get()
  const matchedChain =
    route?.matched.map((record: { path: string }) => record.path).join(' -> ') || '无'
  const paramsText = JSON.stringify(route?.params ?? {}, null, 2)
  const metaText = JSON.stringify(route?.meta ?? {}, null, 2)

  return (
    <div className="grid gap-6">
      <section className="rounded-box border border-primary/20 bg-primary/10 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.26em] text-primary/75">Router Demo</div>
            <h2 className="mt-2 text-2xl font-semibold text-base-content">
              在真实应用路由里演示嵌套、命名路由、redirect 和 beforeEnter
            </h2>
            <p className="mt-3 leading-7 text-base-content/75">
              这个示例没有再起一个内层 router，而是直接挂在站点主路由下，所以你看到的
              RouterView、RouterLink、useRoute 和守卫结果都是真实行为。
            </p>
          </div>

          <div className="badge badge-primary badge-outline badge-lg">
            {route?.name || 'anonymous route'}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
                命名路由与 replace
              </div>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                下面的按钮全部走 RouterLink。其中“replace
                到参数页”会覆盖当前历史记录，而不是追加一条。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <RouterLink
                to={{ name: 'router-demo-topic', params: { section: 'router', topic: 'overview' } }}
                className="btn btn-sm btn-primary"
              >
                命名路由：总览
              </RouterLink>
              <RouterLink
                to={{ name: 'router-demo-topic', params: { section: 'router', topic: 'guards' } }}
                className="btn btn-sm btn-outline"
              >
                守卫说明
              </RouterLink>
              <RouterLink
                to={{ name: 'router-demo-topic', params: { section: 'data', topic: 'params' } }}
                className="btn btn-sm btn-outline"
              >
                参数页
              </RouterLink>
              <RouterLink
                to={{ name: 'router-demo-topic', params: { section: 'data', topic: 'params' } }}
                replace
                className="btn btn-sm btn-secondary"
              >
                replace 到参数页
              </RouterLink>
              <RouterLink to={{ name: 'router-demo-lab' }} className="btn btn-sm btn-accent">
                实验页
              </RouterLink>
            </div>

            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-sm btn-ghost border border-base-300"
                  onClick={() => {
                    void probeDuplicateNavigation()
                  }}
                >
                  重复 push 当前地址
                </button>
                <div className="text-sm text-base-content/70">{lastNavigationResult.value}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
                beforeEnter 开关
              </div>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                关闭时访问实验页会重定向到守卫说明页；打开后才能进入 /examples/router-demo/lab。
              </p>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-4">
              <div>
                <div className="font-medium text-base-content">允许进入实验页</div>
                <div className="mt-1 text-sm text-base-content/65">当前值直接被路由守卫读取。</div>
              </div>

              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={routerDemoLabEnabled.value}
                onChange={(event: Event) => {
                  routerDemoLabEnabled.value = (event.target as HTMLInputElement).checked
                }}
              />
            </label>

            <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm leading-6 text-base-content/70">
              推荐操作：先保持关闭状态点“实验页”，观察 route.path 与日志如何落到
              guards；再打开开关重试。
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
              当前 route
            </div>

            <RouteMetric label="path" value={route?.path || 'null'} />
            <RouteMetric label="name" value={route?.name || 'undefined'} />
            <RouteMetric label="matched" value={matchedChain} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                  params
                </div>
                <pre className="mt-3 overflow-auto text-xs leading-6 text-base-content/80">
                  {paramsText}
                </pre>
              </div>

              <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-base-content/45">meta</div>
                <pre className="mt-3 overflow-auto text-xs leading-6 text-base-content/80">
                  {metaText}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
                afterEach 日志
              </div>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                每次导航结束后，都会把 from/to/failure 归纳成一行文本，方便确认 redirect 和
                duplicated 的最终结果。
              </p>
            </div>

            <ul className="space-y-2 text-sm leading-6 text-base-content/75">
              {navigationLogs.value.map((line, index) => (
                <li
                  key={`router-demo-log-${index}`}
                  className="rounded-box border border-base-300 bg-base-100 px-3 py-2"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
                RouterView Depth 1
              </div>
              <div className="mt-2 text-xl font-semibold text-base-content">子路由内容区</div>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                父路由只负责示例壳层和状态面板，真正的页面内容继续交给内部 RouterView 渲染。
              </p>
            </div>

            <div className="badge badge-outline badge-lg">depth = 1</div>
          </div>

          <div className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4">
            <RouterView />
          </div>
        </div>
      </section>
    </div>
  )
}

export const RouterDemoGuideShell: FC<{ params: { section: string; topic?: string } }> = props => {
  const section = props.params.section || 'router'
  const activeTopic = props.params.topic || 'overview'
  const topics = readTopicList(section)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="badge badge-primary badge-outline">/guide/:section(router|data)</span>
        <h3 className="text-xl font-semibold text-base-content">
          父级 section 布局：{section === 'data' ? '参数与命名路由' : 'Router API'}
        </h3>
      </div>

      <p className="text-sm leading-6 text-base-content/70">
        这层对应 children 路由的父节点，负责切换 section 与 topic，再把叶子内容交给下一层
        RouterView。
      </p>

      <div className="flex flex-wrap gap-2">
        {SECTION_TABS.map(tab => (
          <RouterLink
            key={tab.id}
            to={{ name: 'router-demo-topic', params: { section: tab.id, topic: tab.defaultTopic } }}
            className={`btn btn-sm ${section === tab.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {tab.label}
          </RouterLink>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <RouterLink
            key={topic.id}
            to={{ name: 'router-demo-topic', params: { section, topic: topic.id } }}
            className={`btn btn-sm ${activeTopic === topic.id ? 'btn-secondary' : 'btn-ghost border border-base-300'}`}
          >
            {topic.label}
          </RouterLink>
        ))}
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-base-content/65">下一层内容由第二个 RouterView 渲染。</div>
          <div className="badge badge-outline">depth = 2</div>
        </div>
        <RouterView />
      </div>
    </section>
  )
}

export const RouterDemoTopicPage: FC<{ params: { section: string; topic: string } }> = props => {
  const content = readTopicContent(props.params.section, props.params.topic)

  return (
    <article className="space-y-4 rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-base-content/45">
          {content.eyebrow}
        </div>
        <h4 className="mt-2 text-2xl font-semibold text-base-content">{content.title}</h4>
        <p className="mt-3 leading-7 text-base-content/75">{content.summary}</p>
      </div>

      <ul className="space-y-2 text-sm leading-6 text-base-content/75">
        {content.bullets.map((bullet, index) => (
          <li
            key={`router-demo-bullet-${props.params.section}-${props.params.topic}-${index}`}
            className="rounded-box border border-base-300 bg-base-100 px-3 py-2"
          >
            {bullet}
          </li>
        ))}
      </ul>

      <div className="grid gap-3 md:grid-cols-2">
        <RouteMetric label="section param" value={props.params.section} />
        <RouteMetric label="topic param" value={props.params.topic} />
      </div>

      {props.params.topic === 'guards' && (
        <div className="rounded-box border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-base-content/75">
          <div className="font-medium text-base-content">守卫说明</div>
          <p className="mt-2">
            关闭“允许进入实验页”后点击“实验页”，beforeEnter
            会把你重定向回这里；打开开关后再试，就能进入 lab 页面。
          </p>
        </div>
      )}
    </article>
  )
}

export const RouterDemoLabPage: FC = () => {
  return (
    <article className="rounded-box border border-success/30 bg-success/10 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="badge badge-success badge-outline">beforeEnter 已放行</span>
        <h4 className="text-2xl font-semibold text-base-content">实验页</h4>
      </div>

      <p className="mt-3 leading-7 text-base-content/75">
        这个页面只有在守卫开关打开时才会被真正渲染。它说明当前导航已经穿过
        beforeEnter，进入最终目标路由。
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <RouterLink
          to={{ name: 'router-demo-topic', params: { section: 'router', topic: 'guards' } }}
          className="btn btn-sm btn-outline"
        >
          回到守卫说明
        </RouterLink>
        <RouterLink
          to={{ name: 'router-demo-topic', params: { section: 'data', topic: 'params' } }}
          className="btn btn-sm btn-ghost border border-base-300"
        >
          看参数页
        </RouterLink>
      </div>
    </article>
  )
}

export default RouterDemoScene
