import { renderToString } from '@rue-js/server-renderer'
import { createServerApp, staticRoutes } from './main'
import './style.css'

export { staticRoutes }

export const render = async (url: string) => {
  const { app, router } = createServerApp()

  await router.push(url)
  await router.isReady()

  return renderToString(app)
}
