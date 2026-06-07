/**
 * onServerPrefetch 示例页。
 *
 * 展示 SSR 预取钩子与客户端 mounted 兜底加载之间的协作关系。
 */
import { type FC, onMounted, onServerPrefetch, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const SOURCE_CODE = `import { type FC, onMounted, onServerPrefetch, ref } from '@rue-js/rue'

const fetchServerMessage = async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return {
    title: '服务端数据已就绪',
    body: 'onServerPrefetch 会在 SSR renderer 渲染组件前完成。',
    loadedAt: new Date().toLocaleTimeString(),
  }
}

const Demo: FC = () => {
  const status = ref<'idle' | 'loading' | 'server' | 'client'>('idle')
  const title = ref('等待预取')
  const body = ref('SSR 期间会先等待 onServerPrefetch 返回的 Promise。')
  const loadedAt = ref('-')

  const applyResult = (result: Awaited<ReturnType<typeof fetchServerMessage>>, source: 'server' | 'client') => {
    status.value = source
    title.value = result.title
    body.value = result.body
    loadedAt.value = result.loadedAt
  }

  const loadFromServer = async () => {
    status.value = 'loading'
    applyResult(await fetchServerMessage(), 'server')
  }

  onServerPrefetch(loadFromServer)

  onMounted(async () => {
    if (status.value === 'idle') {
      status.value = 'loading'
      applyResult(await fetchServerMessage(), 'client')
    }
  })

  return (
    <section>
      <p>{title.value}</p>
      <p>{body.value}</p>
      <p>来源: {status.value}</p>
      <p>时间: {loadedAt.value}</p>
    </section>
  )
}

export default Demo`

type PrefetchResult = {
  title: string
  body: string
  loadedAt: string
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** 模拟 SSR 预取请求，返回可在服务端或客户端复用的数据结构。 */
const fetchServerMessage = async (): Promise<PrefetchResult> => {
  await wait(500)
  return {
    title: '服务端数据已就绪',
    body: 'onServerPrefetch 会在 SSR renderer 渲染组件前完成。',
    loadedAt: new Date().toLocaleTimeString(),
  }
}

const PreviewPanel: FC = () => {
  const status = ref<'idle' | 'loading' | 'server' | 'client'>('idle')
  const title = ref('等待预取')
  const body = ref('SSR 期间会先等待 onServerPrefetch 返回的 Promise。')
  const loadedAt = ref('-')
  const runCount = ref(0)

  const applyResult = (result: PrefetchResult, source: 'server' | 'client') => {
    status.value = source
    title.value = result.title
    body.value = result.body
    loadedAt.value = result.loadedAt
    runCount.value += 1
  }

  const loadFromServer = async () => {
    status.value = 'loading'
    applyResult(await fetchServerMessage(), 'server')
  }

  const loadFromClient = async () => {
    status.value = 'loading'
    const result = await fetchServerMessage()
    applyResult(
      {
        ...result,
        title: '客户端补取完成',
        body: '当前浏览器预览没有 SSR renderer，因此 mounted 后走客户端 fallback。',
      },
      'client',
    )
  }

  onServerPrefetch(loadFromServer)

  onMounted(async () => {
    if (status.value === 'idle') {
      await loadFromClient()
    }
  })

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`badge ${
              status.value === 'server'
                ? 'badge-success'
                : status.value === 'client'
                  ? 'badge-warning'
                  : 'badge-ghost'
            }`}
          >
            {status.value === 'loading'
              ? 'loading'
              : status.value === 'server'
                ? 'server prefetch'
                : status.value === 'client'
                  ? 'client fallback'
                  : 'idle'}
          </span>
          <span className="text-sm opacity-70">运行次数：{runCount.value}</span>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">{title.value}</h2>
          <p className="mt-2 text-base opacity-80">{body.value}</p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-box bg-base-200 p-4">
            <dt className="text-sm opacity-70">数据来源</dt>
            <dd className="mt-1 font-mono">{status.value}</dd>
          </div>
          <div className="rounded-box bg-base-200 p-4">
            <dt className="text-sm opacity-70">加载时间</dt>
            <dd className="mt-1 font-mono">{loadedAt.value}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={status.value === 'loading'}
            onClick={() => {
              void loadFromServer()
            }}
          >
            模拟 SSR 预取
          </button>
          <button
            type="button"
            className="btn"
            disabled={status.value === 'loading'}
            onClick={() => {
              status.value = 'idle'
              title.value = '等待预取'
              body.value = 'SSR 期间会先等待 onServerPrefetch 返回的 Promise。'
              loadedAt.value = '-'
            }}
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}

/** onServerPrefetch 交互示例入口。 */
const OnServerPrefetch: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">服务端预取</h1>

      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'preview'
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'code'
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab.value === 'preview' && <PreviewPanel />}

        {activeTab.value === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto h-[360px] md:h-[720px]">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={SOURCE_CODE} />
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnServerPrefetch
