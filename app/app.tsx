/*
应用入口概述
- 错误处理：独立安装浏览器错误桥接、控制台报告与开发覆盖层。
- 根组件：RootApp 组合站点布局与路由视图。
- 启动流程：useApp 创建应用，挂载到 #app，并安装路由插件。
*/
import {
  type FC,
  useApp,
  installBrowserErrorBridge,
  installErrorConsole,
  installDevErrorOverlay,
} from '@rue-js/rue'
import { I18nProvider } from '@rue-js/i18n'
import { RouterView, type HistoryLike, useRoute } from '@rue-js/router'
import i18n from './i18n'
import { createAppRouter } from './router'
import SiteLayout from './pages/site/components/Layout'

// 开发阶段显示 overlay，生产环境与 SSR 保留控制台输出
const stopBrowserErrors = installBrowserErrorBridge()
const stopErrorConsole = installErrorConsole()
const stopErrorOverlay =
  import.meta.env.DEV && !import.meta.env.SSR ? installDevErrorOverlay() : undefined

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopErrorOverlay?.()
    stopErrorConsole()
    stopBrowserErrors()
  })
}

/** 根应用组件：提供布局与路由视图 */
export const RootApp: FC = () => {
  const route = useRoute()

  const isRustLayers = route.get()?.path === '/rust-layers'

  return (
    <I18nProvider i18n={i18n}>
      {isRustLayers ? (
        <RouterView />
      ) : (
        <SiteLayout>
          <RouterView />
        </SiteLayout>
      )}
    </I18nProvider>
  )
}

export const createRueSiteApp = (history?: HistoryLike) => {
  const router = createAppRouter(history)
  const app = useApp(RootApp).use(router).use(i18n)

  return { app, router }
}

// 创建并挂载应用，安装路由
if (!import.meta.env.SSR) {
  createRueSiteApp().app.mount('#app')
}
