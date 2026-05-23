import type { FC } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'

type PluginLink = {
  label: string
  to: string
  primary?: boolean
}

type SupportedPlugin = {
  name: string
  packageName: string
  symbol: string
  summary: string
  install: string
  scenarios: string[]
  apis: string[]
  highlights: string[]
  links: PluginLink[]
}

const supportedPlugins: SupportedPlugin[] = [
  {
    name: 'Router',
    packageName: '@rue-js/router',
    symbol: 'R',
    summary: '官方客户端路由插件，覆盖 Hash / History 历史、命名路由、嵌套路由、重定向与导航守卫。',
    install: 'pnpm add @rue-js/router',
    scenarios: ['多页面应用', '文档站', '带参数详情页'],
    apis: [
      'createRouter',
      'createWebHashHistory',
      'createWebHistory',
      'RouterView',
      'RouterLink',
      'useRoute',
      'useRouter',
    ],
    highlights: [
      '支持 path params、命名路由、redirect、children 和 beforeEnter / beforeEach / afterEach。',
      'RouterView 与 RouterLink 已经是完整运行时能力，不需要额外胶水层。',
      '同一套 API 可以覆盖文档、后台、实验性 Demo 等常见路由场景。',
    ],
    links: [
      { label: '路由指南', to: '/page/routing', primary: true },
      { label: '交互 Demo', to: '/examples/router-demo/guide/router/overview' },
    ],
  },
  {
    name: 'Store',
    packageName: '@rue-js/store',
    symbol: 'S',
    summary:
      '官方状态管理插件，提供 createStore / defineStore 双入口，并内建面向 URL 查询串的同步插件。',
    install: 'pnpm add @rue-js/store',
    scenarios: ['全局状态', '业务模块拆分', 'URL 驱动筛选页'],
    apis: [
      'createStore',
      'defineStore',
      'useStoreRoot',
      'createQuerySync',
      'parseAsString',
      'parseAsInteger',
      'parseAsBoolean',
      'debounce',
      'throttle',
    ],
    highlights: [
      'Store 实例自带 $patch、$set、$reset、$subscribe，既支持集中式修改，也支持细粒度路径更新。',
      'createQuerySync 可以把 store 字段映射到 URL 查询参数，并提供 parser 与节流/防抖能力。',
      '适合后台筛选、搜索表单、分页条件等需要刷新可恢复的状态场景。',
    ],
    links: [
      { label: '状态管理指南', to: '/guide/guide/scaling-up/state-management', primary: true },
      { label: 'Query Sync 示例', to: '/examples/store-query-sync' },
    ],
  },
  {
    name: 'I18n',
    packageName: '@rue-js/i18n',
    symbol: 'I',
    summary:
      '官方国际化插件，提供全局 composer、Provider、按需语言包加载，以及消息 / 日期 / 数字格式化能力。',
    install: 'pnpm add @rue-js/i18n',
    scenarios: ['多语言站点', '后台管理', '需要本地化日期和金额的应用'],
    apis: [
      'createI18n',
      'useI18n',
      'I18nProvider',
      'loadLocaleMessages',
      'setLocale',
      'availableLocales',
      'd',
      'n',
      '_',
    ],
    highlights: [
      '支持 fallbackLocale、messageLoader、datetimeFormats、numberFormats，能覆盖常见国际化基建。',
      '既可以使用全局 i18n，也可以通过 I18nProvider / useI18n 做局部作用域国际化。',
      '适合先从消息翻译起步，再逐步补齐日期、数字和懒加载语言包。',
    ],
    links: [
      { label: '插件基础', to: '/guide/guide/reusability/plugins', primary: true },
      { label: 'Context API', to: '/api/api/composition-api-dependency-injection' },
      { label: '交互 Demo', to: '/examples/i18n-switcher' },
    ],
  },
]

const appUseExample = `import { type FC, useApp } from '@rue-js/rue'
import { createRouter, createWebHashHistory, RouterView } from '@rue-js/router'
import { createStore } from '@rue-js/store'
import { createI18n } from '@rue-js/i18n'

const Home: FC = () => <div>你好，Rue</div>
const Root: FC = () => <RouterView />

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: Home }],
})

const store = createStore()

const i18n = createI18n({
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': { hello: '你好，Rue' },
    en: { hello: 'Hello, Rue' },
  },
})

useApp(Root).use(router).use(store).use(i18n).mount('#app')`

const PluginCard: FC<SupportedPlugin> = props => (
  <article className="card border border-base-200 bg-base-100/90 shadow-sm">
    <div className="card-body gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full border border-base-300/70 bg-base-200/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
            官方运行时插件
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-base-content">{props.name}</h2>
          <div className="mt-1 text-sm text-base-content/55">
            <code>{props.packageName}</code>
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-500/10 text-lg font-semibold text-sky-700">
          {props.symbol}
        </div>
      </div>

      <p className="text-sm leading-7 text-base-content/72">{props.summary}</p>

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
          适合场景
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.scenarios.map(item => (
            <span
              key={item}
              className="rounded-full border border-base-300/70 bg-base-100 px-3 py-1 text-xs text-base-content/70"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
          核心 API
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.apis.map(api => (
            <code
              key={api}
              className="rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/75"
            >
              {api}
            </code>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-base-300/70 bg-base-200/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
          安装
        </div>
        <pre className="mt-2 overflow-x-auto text-sm leading-6 text-base-content">
          <code>{props.install}</code>
        </pre>
      </div>

      <ul className="space-y-2 text-sm leading-6 text-base-content/75">
        {props.highlights.map(item => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 pt-1">
        {props.links.map(link => (
          <RouterLink
            key={link.to}
            to={link.to}
            className={link.primary ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          >
            {link.label}
          </RouterLink>
        ))}
      </div>
    </div>
  </article>
)

const PluginsIndex: FC = () => (
  <div className="space-y-8">
    <section className="overflow-hidden rounded-[28px] border border-base-200 bg-gradient-to-br from-sky-500/10 via-base-100 to-emerald-500/10 shadow-sm">
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] md:p-8">
        <div>
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
            Plugins Overview
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-base-content md:text-4xl">
            当前官方支持的运行时插件
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-base-content/72 md:text-base">
            这页不再泛化讨论“如何写插件”，而是直接列出 Rue 当前已经提供、且可以通过{' '}
            <code>app.use()</code> 接入的官方插件。基于 monorepo
            现有入口，当前支持三类核心能力：路由、状态管理、国际化。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <RouterLink to="/guide/guide/reusability/plugins" className="btn btn-primary btn-sm">
              插件基础
            </RouterLink>
            <RouterLink to="/guide/api/application#app-use" className="btn btn-outline btn-sm">
              app.use 参考
            </RouterLink>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
          <div className="rounded-2xl border border-base-300/70 bg-base-100/85 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
              官方插件数
            </div>
            <div className="mt-2 text-3xl font-semibold text-base-content">3</div>
            <div className="mt-1 text-sm text-base-content/65">Router / Store / I18n</div>
          </div>
          <div className="rounded-2xl border border-base-300/70 bg-base-100/85 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
              统一接入
            </div>
            <div className="mt-2 text-lg font-semibold text-base-content">app.use()</div>
            <div className="mt-1 text-sm text-base-content/65">安装入口统一，应用装配更直接</div>
          </div>
          <div className="rounded-2xl border border-base-300/70 bg-base-100/85 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
              页面范围
            </div>
            <div className="mt-2 text-lg font-semibold text-base-content">运行时插件</div>
            <div className="mt-1 text-sm text-base-content/65">
              Vite / SWC 等构建层能力放在工具链页面
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-3">
      {supportedPlugins.map(plugin => (
        <PluginCard key={plugin.name} {...plugin} />
      ))}
    </section>

    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="card border border-base-200 bg-base-100 shadow-sm">
        <div className="card-body p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
            统一接入示例
          </div>
          <h3 className="mt-2 text-xl font-semibold text-base-content">
            一个应用同时安装三类官方插件
          </h3>
          <p className="mt-2 text-sm leading-7 text-base-content/70">
            下面的示例使用当前仓库真实存在的入口名，展示如何把 Router、Store 和 I18n
            一次性装配到应用中。
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl border border-base-300/70 bg-base-200/50 p-4 text-sm leading-6 text-base-content">
            <code>{appUseExample}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card border border-base-200 bg-base-100 shadow-sm">
          <div className="card-body p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
              选择建议
            </div>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-base-content/72">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span>页面层有跳转、嵌套视图、守卫和参数路由需求时，先上 Router。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span>状态需要跨页面共享，或者要和 URL 查询参数联动时，补上 Store。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span>应用要面向多语言、多地区格式化输出时，再引入 I18n。</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card border border-base-200 bg-base-100 shadow-sm">
          <div className="card-body p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
              相关资源
            </div>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-base-content/72">
              <li>
                <RouterLink to="/guide/guide/scaling-up/tooling" className="link link-hover">
                  工具链
                </RouterLink>
                ：查看 Vite / SWC 等构建层插件与工程化集成。
              </li>
              <li>
                <RouterLink to="/guide/guide/testing" className="link link-hover">
                  测试
                </RouterLink>
                ：为插件接入增加单元测试与行为回归校验。
              </li>
              <li>
                <RouterLink
                  to="/guide/guide/best-practices/performance"
                  className="link link-hover"
                >
                  性能优化
                </RouterLink>
                ：在业务场景里验证路由切换、状态同步与国际化格式化开销。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
)

export default PluginsIndex
